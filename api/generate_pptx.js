// Morgan Cole – Intelligent Presentation Builder v8
// Pure Node.js: jszip for PPTX manipulation, Anthropic for orchestration,
// web_search for real internet images, dual-deck support.
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Slide catalog ─────────────────────────────────────────────────────────────
const MAIN_SLIDES = {
  cover:0, disclaimer:1, toc:2, firm_overview:3, deal_process:4,
  strategy:5, sector_focus:6, market_data:7, pipeline:8, deal_flow:9,
  underwriting:10, playbook:11, value_creation:12, why_now:13,
  closing:14, legal_structure:15, is_economics:16, fund_economics:17,
  team:18, deal_summary:19,
};

const APPENDIX_MAP = {
  a_legal:15, a_is_econ:16, a_fund_econ:17, a_team:18,
  a_deal_summary:19, a_pipeline:8,
  a_sector_adv:6, a_sector_eng:7, a_sector_prec:6,
  a_cases_cover:11, a_bios:18,
};

const DEFAULT_SLIDES = {
  lp:      ['cover','toc','firm_overview','market_data','strategy','sector_focus','pipeline','value_creation','why_now','fund_economics','team','closing','disclaimer'],
  ib:      ['cover','toc','firm_overview','deal_process','pipeline','deal_flow','sector_focus','value_creation','why_now','deal_summary','closing','disclaimer'],
  founder: ['cover','firm_overview','strategy','value_creation','why_now','playbook','closing'],
  general: ['cover','toc','firm_overview','market_data','strategy','pipeline','value_creation','why_now','fund_economics','closing','disclaimer'],
};

function getAudienceKey(a) {
  a = (a||'').toLowerCase();
  if (['lp','institutional','family','hnw'].some(x=>a.includes(x))) return 'lp';
  if (['banker','intermediary','ib','broker'].some(x=>a.includes(x))) return 'ib';
  if (['founder','owner','seller','operator'].some(x=>a.includes(x))) return 'founder';
  return 'general';
}

// ── Anthropic helpers ─────────────────────────────────────────────────────────
async function callAnthropic(messages, system, apiKey, maxTokens=1500, tools=null) {
  const body = { model:'claude-sonnet-4-20250514', max_tokens:maxTokens, system, messages };
  if (tools) body.tools = tools;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  return r.json();
}

function extractText(data) {
  return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(' ').trim();
}

function parseJSON(text) {
  const cleaned = text.replace(/```json\n?/g,'').replace(/```/g,'').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}

// ── Orchestration ─────────────────────────────────────────────────────────────
const ORCH_SYS = `You are Morgan Cole, VP of Marketing at Catskill Partners LP.
Plan a custom investor deck. Return ONLY valid JSON (no markdown fences):
{
  "slide_selection": ["cover","toc","firm_overview"],
  "appendix_selection": ["a_fund_econ","a_team"],
  "image_requests": [
    {
      "title": "Operator PE Outperforms Financial Buyers",
      "search_query": "operator led private equity returns IRR chart McKinsey BCG Bain 2023 2024",
      "fallback_query": "private equity value creation operational improvement returns chart"
    }
  ],
  "deck_rationale": "Why this selection fits the request"
}
MAIN SLIDES: cover, disclaimer, toc, firm_overview, deal_process, strategy,
sector_focus, market_data, pipeline, deal_flow, underwriting, playbook,
value_creation, why_now, closing, legal_structure, is_economics, fund_economics, team, deal_summary
APPENDIX: a_legal, a_is_econ, a_fund_econ, a_team, a_pipeline, a_deal_summary,
a_sector_adv (Advanced Mfg), a_sector_eng (Engineered Materials), a_sector_prec (Precision Components)
For image_requests: 0-3 max. Find real charts from McKinsey BCG Bain CBRE JLL Deloitte PitchBook.`;

async function orchestrate(topic, audience, brief, taskType, inclApp, inclImg, apiKey) {
  const key = getAudienceKey(audience);
  const prompt = `Build custom Catskill deck.
Topic: ${topic}
Audience: ${audience} (profile: ${key})
Brief: ${brief||'Standard overview'}
Include appendix: ${inclApp}
Include market images: ${inclImg}
${inclImg ? 'Select 2-3 image_requests for real research chart images.' : 'Set image_requests to [].'}
${inclApp ? 'Include 3-5 relevant appendix slides.' : 'Set appendix_selection to [].'}`;
  try {
    const d = await callAnthropic([{role:'user',content:prompt}], ORCH_SYS, apiKey, 1000);
    const r = parseJSON(extractText(d));
    if (!r.slide_selection?.length) r.slide_selection = DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general;
    return r;
  } catch {
    return {
      slide_selection: DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general,
      appendix_selection: inclApp ? ['a_fund_econ','a_team'] : [],
      image_requests: [],
    };
  }
}

// ── Real image search ─────────────────────────────────────────────────────────
const IMG_SYS = `Find a real published chart image. Return ONLY valid JSON:
{"image_url":"https://...","page_url":"https://...","source_name":"McKinsey","source_date":"2024","title_override":"Better title"}`;

async function fetchRealImage(imgReq, apiKey) {
  const prompt = `Find a real published chart/graph image for an investor presentation.
Primary search: ${imgReq.search_query||'operator PE returns chart'}
Fallback: ${imgReq.fallback_query||'private equity returns chart 2024'}
Context: ${imgReq.title||'Market data'}
Search and find a direct image URL or page with charts from McKinsey BCG Bain CBRE JLL Deloitte PitchBook Preqin.`;
  
  try {
    const tools = [{type:'web_search_20250305',name:'web_search'}];
    const d = await callAnthropic([{role:'user',content:prompt}], IMG_SYS, apiKey, 600, tools);
    const result = parseJSON(extractText(d));
    
    // Try direct image URL
    const imgUrl = result.image_url||'';
    if (imgUrl && /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(imgUrl)) {
      const r = await fetch(imgUrl, {
        headers:{'User-Agent':'Mozilla/5.0 (compatible; research-bot/1.0)'},
        signal:AbortSignal.timeout(10000),
      });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 5000) {
          const ct = r.headers.get('content-type')||'image/png';
          return { bytes:Buffer.from(buf), ext:ct.includes('jpeg')||ct.includes('jpg')?'jpg':'png',
                   source:result.source_name||'Research', date:result.source_date||'2024',
                   titleOverride:result.title_override||'' };
        }
      }
    }
    
    // Try page URL — scrape for chart images
    const pageUrl = result.page_url||'';
    if (pageUrl) {
      const pr = await fetch(pageUrl, {
        headers:{'User-Agent':'Mozilla/5.0'},
        signal:AbortSignal.timeout(8000),
      }).catch(()=>null);
      if (pr?.ok) {
        const html = await pr.text();
        const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:png|jpg|jpeg|webp))[^>]*>/gi)]
          .map(m=>m[1]).slice(0,8);
        for (const src of imgMatches) {
          const fullUrl = src.startsWith('http') ? src : new URL(src,pageUrl).href;
          const ir = await fetch(fullUrl,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)}).catch(()=>null);
          if (ir?.ok) {
            const buf = await ir.arrayBuffer();
            if (buf.byteLength > 10000) {
              return { bytes:Buffer.from(buf), ext:'png',
                       source:result.source_name||'Research', date:result.source_date||'2024',
                       titleOverride:result.title_override||'' };
            }
          }
        }
      }
    }
  } catch {}
  return null;
}

// ── PPTX manipulation ─────────────────────────────────────────────────────────
async function subsetDeck(deckPath, slideIndices) {
  const deckBytes = fs.readFileSync(deckPath);
  const zip = await JSZip.loadAsync(deckBytes);
  
  // Parse presentation.xml and relationships
  const prsXml = await zip.file('ppt/presentation.xml').async('string');
  const prsRelsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  
  // Extract slide order from rels
  const relMatches = [...prsRelsXml.matchAll(/Id="([^"]+)"[^>]*Type="[^"]*\/slide"[^>]*Target="slides\/slide(\d+)\.xml"/g)];
  const slideEntries = relMatches.map(m=>({rId:m[1],num:parseInt(m[2])}))
    .sort((a,b)=>a.num-b.num);
  
  if (!slideEntries.length) throw new Error('No slides found in deck');
  
  // Dedup indices while preserving order
  const maxIdx = slideEntries.length-1;
  const seen = new Set(); const valid = [];
  for (const i of slideIndices) {
    if (i>=0 && i<=maxIdx && !seen.has(i)) { seen.add(i); valid.push(i); }
  }
  
  const keptRIds = new Set(valid.map(i=>slideEntries[i].rId));
  const keptNums = new Set(valid.map(i=>slideEntries[i].num));
  const allNums = new Set(slideEntries.map(e=>e.num));
  const unwanted = [...allNums].filter(n=>!keptNums.has(n));
  
  // Remove unwanted slides from presentation.xml sldIdLst
  let newPrsXml = prsXml.replace(/<p:sldId\s[^/]*\/>/g, match => {
    const ridM = match.match(/r:id="([^"]+)"/);
    return ridM && keptRIds.has(ridM[1]) ? match : '';
  });
  
  // Remove from rels
  let newPrsRels = prsRelsXml.replace(/<Relationship[^>]*Type="[^"]*\/slide"[^>]*\/>/g, match => {
    const idM = match.match(/Id="([^"]+)"/);
    return idM && keptRIds.has(idM[1]) ? match : '';
  });
  
  // Build new ZIP without unwanted slide files
  const skipFiles = new Set();
  for (const n of unwanted) {
    skipFiles.add(`ppt/slides/slide${n}.xml`);
    skipFiles.add(`ppt/slides/_rels/slide${n}.xml.rels`);
    skipFiles.add(`ppt/notesSlides/notesSlide${n}.xml`);
    skipFiles.add(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`);
  }
  
  const newZip = new JSZip();
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir || skipFiles.has(name)) continue;
    if (name === 'ppt/presentation.xml') {
      newZip.file(name, newPrsXml);
    } else if (name === 'ppt/_rels/presentation.xml.rels') {
      newZip.file(name, newPrsRels);
    } else {
      newZip.file(name, await file.async('nodebuffer'));
    }
  }
  
  return newZip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
}

async function injectImageSlides(pptxBuf, imageSlides) {
  const zip = await JSZip.loadAsync(pptxBuf);
  const prsXml = await zip.file('ppt/presentation.xml').async('string');
  const prsRelsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const ctXml = await zip.file('[Content_Types].xml').async('string');
  
  // Get max slide number
  const slideFiles = Object.keys(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
  const maxSlide = Math.max(0,...slideFiles.map(f=>parseInt(f.match(/\d+/)[0])));
  
  // Get max image number
  const imgFiles = Object.keys(zip.files).filter(f=>/^ppt\/media\/image\d+\./.test(f));
  const maxImg = Math.max(0,...imgFiles.map(f=>parseInt(f.match(/\d+/)[0])));
  
  // Get max rId
  const ridMatches = [...prsRelsXml.matchAll(/Id="rId(\d+)"/g)];
  const maxRId = Math.max(0,...ridMatches.map(m=>parseInt(m[1])));
  
  // Get max sldId
  const sldIdMatches = [...prsXml.matchAll(/id="(\d+)"/g)];
  const maxSldId = Math.max(256,...sldIdMatches.map(m=>parseInt(m[1])));
  
  // Find layout target
  let layoutTarget = '../slideLayouts/slideLayout1.xml';
  for (const fn of slideFiles.slice(0,1)) {
    const relsFile = zip.file(fn.replace('slides/slide','slides/_rels/slide').replace('.xml','.xml.rels'));
    if (relsFile) {
      const relsXml = await relsFile.async('string');
      const lm = relsXml.match(/Type="[^"]*slideLayout"[^>]*Target="([^"]+)"/);
      if (lm) layoutTarget = lm[1];
    }
  }
  
  let newPrsXml = prsXml;
  let newPrsRels = prsRelsXml;
  let newCtXml = ctXml;
  
  for (let i=0; i<imageSlides.length; i++) {
    const cs = imageSlides[i];
    const sn = maxSlide+1+i;
    const imgN = maxImg+1+i;
    const ext = cs.ext||'png';
    const sr = `rId${maxRId+1+i}`;
    const slidePath = `ppt/slides/slide${sn}.xml`;
    const slideRelsPath = `ppt/slides/_rels/slide${sn}.xml.rels`;
    const imgPath = `ppt/media/image${imgN}.${ext}`;
    const imgTarget = `../media/image${imgN}.${ext}`;
    const srcLine = `Source: ${cs.source||'Research'} ${cs.date||'2024'}  |  CATSKILL PARTNERS · CLARITY. CRAFT. CAPITAL.`;
    const titleSafe = (cs.title||'Market Data').substring(0,80).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const srcSafe = srcLine.substring(0,140).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    
    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="1A4C3D"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="457200" y="190500"/><a:ext cx="8229600" cy="600075"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1800" b="1" dirty="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="+mj-lt"/></a:rPr><a:t>${titleSafe}</a:t></a:r></a:p></p:txBody></p:sp>
<p:pic><p:nvPicPr><p:cNvPr id="3" name="Chart"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="457200" y="857250"/><a:ext cx="8229600" cy="5029200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
<p:sp><p:nvSpPr><p:cNvPr id="4" name="Source"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="457200" y="6096000"/><a:ext cx="8229600" cy="228600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="900" dirty="0"><a:solidFill><a:srgbClr val="6BAE7F"/></a:solidFill><a:latin typeface="+mn-lt"/></a:rPr><a:t>${srcSafe}</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClr/></p:clrMapOvr></p:sld>`;
    
    const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="${layoutTarget}"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imgTarget}"/>
</Relationships>`;
    
    zip.file(slidePath, slideXml);
    zip.file(slideRelsPath, slideRelsXml);
    zip.file(imgPath, cs.bytes);
    
    // Update presentation.xml — add to sldIdLst
    newPrsXml = newPrsXml.replace('</p:sldIdLst>',
      `<p:sldId id="${maxSldId+1+i}" r:id="${sr}"/></p:sldIdLst>`);
    
    // Update presentation rels
    newPrsRels = newPrsRels.replace('</Relationships>',
      `<Relationship Id="${sr}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${sn}.xml"/></Relationships>`);
    
    // Update content types
    const partName = `/ppt/slides/slide${sn}.xml`;
    if (!newCtXml.includes(partName)) {
      newCtXml = newCtXml.replace('</Types>',
        `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
    }
  }
  
  zip.file('ppt/presentation.xml', newPrsXml);
  zip.file('ppt/_rels/presentation.xml.rels', newPrsRels);
  zip.file('[Content_Types].xml', newCtXml);
  
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
}

// Count slides in PPTX buffer
async function countSlides(buf) {
  const zip = await JSZip.loadAsync(buf);
  const relsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  return (relsXml.match(/Type="[^"]*\/slide"/g)||[]).length;
}

// ── Main build ────────────────────────────────────────────────────────────────
async function buildDeck(topic, audience, brief, tone, taskType, inclApp, inclImg, apiKey) {
  const mainPath = path.join(__dirname, 'main_deck.pptx');
  if (!fs.existsSync(mainPath)) throw new Error('main_deck.pptx not found');
  
  const plan = await orchestrate(topic, audience, brief, taskType, inclApp, inclImg, apiKey);
  
  // Resolve slide names to indices
  const key = getAudienceKey(audience);
  const defaults = DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general;
  let indices = (plan.slide_selection||defaults).map(n=>MAIN_SLIDES[n]).filter(i=>i!=null);
  if (!indices.length) indices = defaults.map(n=>MAIN_SLIDES[n]).filter(i=>i!=null);
  
  // Appendix slides
  const appNames = plan.appendix_selection||[];
  if (inclApp && appNames.length) {
    const extra = appNames.map(n=>APPENDIX_MAP[n]).filter(i=>i!=null && !indices.includes(i));
    if (extra.length) {
      const closingPos = indices.indexOf(14);
      const insertAt = closingPos>=0 ? closingPos : indices.length;
      indices = [...indices.slice(0,insertAt), ...extra, ...indices.slice(insertAt)];
    }
  }
  
  let pptxBuf = await subsetDeck(mainPath, indices);
  
  // Real internet image slides
  const imageSlides = [];
  if (inclImg) {
    const requests = (plan.image_requests||[]).slice(0,3);
    for (const req of requests) {
      const result = await fetchRealImage(req, apiKey).catch(()=>null);
      if (result?.bytes) {
        imageSlides.push({
          title: result.titleOverride || req.title || 'Market Research',
          bytes: result.bytes,
          ext: result.ext||'png',
          source: result.source||'Public Research',
          date: result.date||'2024',
        });
      }
    }
    if (imageSlides.length) {
      pptxBuf = await injectImageSlides(pptxBuf, imageSlides);
    }
  }
  
  return { buf:pptxBuf, imgCount:imageSlides.length, rationale:plan.deck_rationale||'Custom deck assembled' };
}

// ── Vercel handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({error:'API key not configured'});
  
  try {
    const body = req.body||{};
    const { buf, imgCount, rationale } = await buildDeck(
      body.topic||'Catskill Partners Overview',
      body.audience||'LP / Institutional Investor',
      body.brief||'', body.tone||'Institutional',
      body.taskType||'full_deck',
      body.includeAppendix||false,
      body.includeMarketCharts||false,
      apiKey,
    );
    
    const slideCount = await countSlides(buf);
    const slug = (body.topic||'deck').replace(/[^a-zA-Z0-9]/g,'-').substring(0,40);
    
    return res.status(200).json({
      success:true,
      filename:`Catskill-${slug}.pptx`,
      base64: buf.toString('base64'),
      slideCount, imageSlides:imgCount, title:body.topic||'', rationale,
    });
  } catch(e) {
    console.error('generate_pptx error:', e);
    return res.status(500).json({error:e.message, detail:e.stack?.substring(0,400)});
  }
}
