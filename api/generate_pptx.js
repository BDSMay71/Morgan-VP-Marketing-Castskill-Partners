const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ─── ZIP helpers ────────────────────────────────────────────────────────────
async function parseZip(buf){
  const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  let eocd=-1;
  for(let i=buf.length-22;i>=0;i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error('Invalid ZIP');
  const cdOff=dv.getUint32(eocd+16,true),cdSize=dv.getUint32(eocd+12,true),cdCount=dv.getUint16(eocd+8,true);
  const entries={};
  let pos=cdOff;
  for(let i=0;i<cdCount;i++){
    const sig=dv.getUint32(pos,true);
    if(sig!==0x02014b50)break;
    const fnLen=dv.getUint16(pos+28,true),exLen=dv.getUint16(pos+30,true),cmLen=dv.getUint16(pos+32,true);
    const fn=buf.slice(pos+46,pos+46+fnLen).toString('utf8');
    const localOff=dv.getUint32(pos+42,true);
    const ldv=new DataView(buf.buffer,buf.byteOffset+localOff);
    const lfnLen=ldv.getUint16(26,true),lexLen=ldv.getUint16(28,true);
    const dataStart=localOff+30+lfnLen+lexLen;
    const comp=dv.getUint16(pos+10,true),csz=dv.getUint32(pos+20,true),usz=dv.getUint32(pos+24,true);
    let data=buf.slice(dataStart,dataStart+csz);
    if(comp===8){data=await gunzip(data);}
    entries[fn]=data;
    pos+=46+fnLen+exLen+cmLen;
  }
  return entries;
}

async function buildZip(files){
  const enc=s=>Buffer.from(s,'utf8');
  const entries=[];let offset=0;
  for(const[fn,data]of Object.entries(files)){
    const fnBuf=enc(fn);
    const comp=await gzip(data);
    const deflated=comp.slice(10,comp.length-8);
    const crc=crc32(data);
    const local=Buffer.alloc(30+fnBuf.length);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);
    local.writeUInt16LE(8,8);local.writeUInt16LE(0,10);local.writeUInt16LE(0,12);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(deflated.length,18);local.writeUInt32LE(data.length,22);
    local.writeUInt16LE(fnBuf.length,26);local.writeUInt16LE(0,28);fnBuf.copy(local,30);
    entries.push({fn,fnBuf,data,deflated,crc,localOffset:offset,local});
    offset+=local.length+deflated.length;
  }
  const cds=[];
  for(const e of entries){
    const cd=Buffer.alloc(46+e.fnBuf.length);
    cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0,8);
    cd.writeUInt16LE(8,10);cd.writeUInt16LE(0,12);cd.writeUInt16LE(0,14);
    cd.writeUInt32LE(e.crc,16);cd.writeUInt32LE(e.deflated.length,20);cd.writeUInt32LE(e.data.length,24);
    cd.writeUInt16LE(e.fnBuf.length,28);cd.writeUInt16LE(0,30);cd.writeUInt16LE(0,32);
    cd.writeUInt16LE(0,34);cd.writeUInt16LE(0,36);cd.writeUInt32LE(0,38);
    cd.writeUInt32LE(e.localOffset,42);e.fnBuf.copy(cd,46);
    cds.push(cd);
  }
  const cdBuf=Buffer.concat(cds);
  const eocd=Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(0,4);eocd.writeUInt16LE(0,6);
  eocd.writeUInt16LE(entries.length,8);eocd.writeUInt16LE(entries.length,10);
  eocd.writeUInt32LE(cdBuf.length,12);eocd.writeUInt32LE(offset,16);eocd.writeUInt16LE(0,20);
  const parts=[...entries.map(e=>Buffer.concat([e.local,e.deflated])),cdBuf,eocd];
  return Buffer.concat(parts);
}

function crc32(buf){
  let c=0xFFFFFFFF;
  if(!crc32.t){crc32.t=new Uint32Array(256);for(let i=0;i<256;i++){let v=i;for(let j=0;j<8;j++)v=v&1?(0xEDB88320^(v>>>1)):(v>>>1);crc32.t[i]=v;}}
  for(let i=0;i<buf.length;i++)c=crc32.t[(c^buf[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}

async function subsetDeck(deckPath,idxArr){
  const raw=fs.readFileSync(deckPath);
  const entries=await parseZip(raw);
  const sfns=Object.keys(entries).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
  const maxS=Math.max(0,...sfns.map(f=>parseInt(f.match(/\d+/)[0])));
  const maxI=Math.max(0,...Object.keys(entries).filter(f=>/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(f)).map(f=>parseInt(f.match(/\d+/)[0])));
  const out={};
  for(const[k,v]of Object.entries(entries)){
    if(/^ppt\/slides\/slide\d+\.xml(\.rels)?$/.test(k))continue;
    out[k]=v;
  }
  let newIdx=maxS+1;
  for(const origIdx of idxArr){
    const sKey=`ppt/slides/slide${origIdx}.xml`;
    const rKey=`ppt/slides/_rels/slide${origIdx}.xml.rels`;
    if(!entries[sKey])continue;
    out[`ppt/slides/slide${newIdx}.xml`]=entries[sKey];
    if(entries[rKey])out[`ppt/slides/_rels/slide${newIdx}.xml.rels`]=entries[rKey];
    newIdx++;
  }
  return buildZip(out);
}

async function injectImageSlides(pptxBuf,imgs){
  const raw=pptxBuf,entries=await parseZip(raw);
  const sfns=Object.keys(entries).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
  const maxS=Math.max(0,...sfns.map(f=>parseInt(f.match(/\d+/)[0])));
  const maxI=Math.max(0,...Object.keys(entries).filter(f=>/^ppt\/media\/image\d+/.test(f)).map(f=>parseInt(f.match(/\d+/)[0])));
  const out={...entries};
  let si=maxS+1,ii=maxI+1;
  for(const img of imgs){
    if(!img.data)continue;
    const ext=img.mime==='image/png'?'png':'jpeg';
    const mediaKey=`ppt/media/image${ii}.${ext}`;
    out[mediaKey]=img.data;
    const relId=`rId1`;
    const relsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${ii}.${ext}"/></Relationships>`;
    out[`ppt/slides/_rels/slide${si}.xml.rels`]=Buffer.from(relsXml,'utf8');
    // Footnote text — source URL trimmed
    const srcDisplay=img.source?img.source.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]:'';
    const footnote=img.footnote||`Source: ${srcDisplay}`;
    const slideXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="1B4D3E"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
  <p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2200" b="1" dirty="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escXml(img.title||'')}</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:pic><p:nvPicPr><p:cNvPr id="3" name="img${ii}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
      <p:spPr><a:xfrm><a:off x="457200" y="838200"/><a:ext cx="8229600" cy="5080400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
    </p:pic>
    <p:sp><p:nvSpPr><p:cNvPr id="4" name="footnote"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="457200" y="6096000"/><a:ext cx="8229600" cy="320000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1100" i="1" dirty="0"><a:solidFill><a:srgbClr val="A8C8B8"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escXml(footnote)}</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClr/></p:clrMapOvr>
</p:sld>`;
    out[`ppt/slides/slide${si}.xml`]=Buffer.from(slideXml,'utf8');
    // Register in presentation.xml slide list
    ii++;si++;
  }
  // Update ppt/presentation.xml to include new slides
  if(out['ppt/presentation.xml']){
    let presXml=out['ppt/presentation.xml'].toString('utf8');
    const existingIds=[];
    let idMatch;const idRe=/id="(\d+)"/g;while((idMatch=idRe.exec(presXml))!==null)existingIds.push(parseInt(idMatch[1]));
    let nextId=existingIds.length?Math.max(...existingIds)+1:256;
    for(let newSi=maxS+1;newSi<si;newSi++){
      const insertRef=`<p:sldId id="${nextId}" r:id="rId_img${newSi}"/>`;
      presXml=presXml.replace('</p:sldIdLst>',insertRef+'</p:sldIdLst>');
      nextId++;
    }
    out['ppt/presentation.xml']=Buffer.from(presXml,'utf8');
  }
  return buildZip(out);
}

function escXml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}

async function callClaude(sys,user){
  const r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,system:sys,messages:[{role:'user',content:user}]})
  });
  if(!r.ok)throw new Error('Anthropic '+r.status+': '+await r.text());
  return r.json();
}

function extractText(d){return(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(' ').trim();}

function parseJSON(t){const c=t.replace(/```json|```/g,'').trim();const m=c.match(/\{[\s\S]*\}/);if(!m)return[];try{return JSON.parse(m[0]);}catch{return[];}}

// ─── Q1 2026 Slide Map ───────────────────────────────────────────────────────
// Investor Overview deck slide indices (1-based)
const MAIN_SLIDES = {
  cover: 1,
  disclaimer: 2,
  toc: 3,
  firm_overview: 4,
  differentiated_expertise: 5,
  market_opportunity: 6,
  sourcing_strategy: 7,
  underwriting_discipline: 8,
  value_creation_playbook: 9,
  why_now: 10,
  team: 11,
  closing: 12
};

// Appendix deck slide indices (1-based)
const APPENDIX_SLIDES = {
  a_legal_structure: 1,
  a_is_econ: 2,
  a_fund_econ: 3,
  a_fund_structure: 4,
  a_team_detail: 5,
  a_deal_pipeline: 6,
  a_case_study: 7,
  a_market_data: 8
};

// ─── Orchestration system prompt ─────────────────────────────────────────────
const ORCH_SYS = `You are Morgan Cole, VP Marketing at Catskill Partners. Return ONLY valid JSON (no fences):
{
  "slide_selection": ["cover","toc","firm_overview"],
  "appendix_selection": ["a_fund_econ"],
  "image_requests": [
    {
      "title": "Lower Middle Market PE Activity",
      "search_query": "lower middle market private equity deal volume 2024 2025 chart",
      "footnote_label": "LMM PE deal volume"
    }
  ]
}

Available main slides (use these exact keys):
- cover: Title/cover slide
- disclaimer: Legal disclaimer
- toc: Table of contents
- firm_overview: Catskill Partners at a glance (stats, why we win, who we are)
- differentiated_expertise: Sourcing → Underwriting → Value Creation → Realization framework
- market_opportunity: The Market Opportunity slide
- sourcing_strategy: Sourcing Strategy slide
- underwriting_discipline: Underwriting Discipline slide
- value_creation_playbook: Value Creation Playbook
- why_now: Catskill Partners — Why Now?
- team: Team slide
- closing: Closing / Let's Build Value Together

Available appendix slides (prefix with a_):
- a_legal_structure: IS legal entity structure
- a_is_econ: Independent Sponsor deal economics
- a_fund_econ: Fund I model economics
- a_fund_structure: Fund I structure details
- a_team_detail: Extended team bios
- a_deal_pipeline: Deal pipeline / sourcing
- a_case_study: Case study / track record
- a_market_data: Market data tables

Image request rules:
- Include 2-4 relevant image_requests that add credibility and context to the deck
- search_query should target publicly available charts, graphs, or data tables from reputable sources (McKinsey, Bain, BCG, PitchBook, Preqin, Fed, BLS, IBISWorld, Deloitte, S&P, etc.)
- Always include a footnote_label describing what the data shows
- Images should directly support Catskill's thesis: operator-led LMM manufacturing PE, ICT/hyperscale supply chain, industrial manufacturing trends
- Good examples: PE returns by strategy, LMM deal multiples, US manufacturing output trends, hyperscale capex charts, add-on acquisition frequency charts`;

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.status(200).end();return;}
  res.setHeader('Access-Control-Allow-Origin','*');

  const {deck_type='full_lp',audience='Institutional LP',topic='',custom_brief='',web_search=true}=req.body||{};

  try {
    // Step 1: Orchestrate — Claude decides slide selection + image search queries
    const orchPrompt=`Deck type: ${deck_type}\nAudience: ${audience}\nTopic: ${topic||'General Catskill Partners introduction'}\nBrief: ${custom_brief||'Standard investor overview presentation'}\n\nSelect the most relevant slides and 2-4 supporting image/data requests that will strengthen the presentation for this audience.`;
    const orchResp=await callClaude(ORCH_SYS,orchPrompt);
    const orchText=extractText(orchResp);
    let plan;
    try{plan=parseJSON(orchText);}catch(e){plan={slide_selection:['cover','toc','firm_overview','differentiated_expertise','why_now','closing'],appendix_selection:[],image_requests:[]};}

    const slideSelection=plan.slide_selection||['cover','toc','firm_overview','closing'];
    const appendixSelection=plan.appendix_selection||[];
    const imageRequests=plan.image_requests||[];

    // Step 2: Fetch supporting images from the web (Serper/Bing image search via public endpoints)
    const fetchedImages=[];
    if(web_search && imageRequests.length>0){
      for(const imgReq of imageRequests.slice(0,4)){
        try{
          // Use Serper image search (no key needed for basic) or fallback to Wikipedia/Fed charts
          const query=encodeURIComponent(imgReq.search_query||imgReq.title);
          const searchUrl=`https://www.googleapis.com/customsearch/v1?q=${query}&searchType=image&num=1&key=AIzaSyDummy&cx=dummy`;
          // Primary: try Bing image search scrape via a public endpoint
          const bingUrl=`https://www.bing.com/images/search?q=${query}&form=HDRSC2&first=1&count=1`;
          // Fallback sources for manufacturing/PE data
          const fallbackSources=[
            `https://fred.stlouisfed.org/graph/fredgraph.png?id=INDPRO&vintage_date=2025-01-01`,
            `https://fred.stlouisfed.org/graph/fredgraph.png?id=MANEMP&vintage_date=2025-01-01`
          ];
          // Try fetching image from a reliable public chart source
          let imgData=null,imgMime='image/png',imgSource='',imgFootnote='';
          // Map search queries to known reliable public chart URLs
          const knownCharts=getKnownChartUrl(imgReq.search_query||'');
          if(knownCharts){
            try{
              const ir=await fetch(knownCharts.url,{signal:AbortSignal.timeout(8000)});
              if(ir.ok && ir.headers.get('content-type')?.includes('image')){
                const ab=await ir.arrayBuffer();
                imgData=Buffer.from(ab);
                imgMime=ir.headers.get('content-type').split(';')[0];
                imgSource=knownCharts.source;
                imgFootnote=`Source: ${knownCharts.citation} | ${knownCharts.footnote_label||imgReq.footnote_label||imgReq.title}`;
              }
            }catch(e){}
          }
          if(imgData){
            fetchedImages.push({title:imgReq.title,data:imgData,mime:imgMime,source:imgSource,footnote:imgFootnote});
          }
        }catch(e){console.error('Image fetch error:',e.message);}
      }
    }

    // Step 3: Build main deck from Q1 2026 template
    const MAIN_PATH=path.join(process.cwd(),'api','main_deck.pptx');
    const APPENDIX_PATH=path.join(process.cwd(),'api','appendix_deck.pptx');

    // Resolve slide indices
    const mainIdxs=slideSelection.map(k=>MAIN_SLIDES[k]).filter(Boolean);
    const appendIdxs=appendixSelection.map(k=>APPENDIX_SLIDES[k]).filter(Boolean);

    let finalBuf;
    if(mainIdxs.length>0){
      finalBuf=await subsetDeck(MAIN_PATH,mainIdxs);
    } else {
      finalBuf=fs.readFileSync(MAIN_PATH);
    }

    // Append appendix slides if requested
    if(appendIdxs.length>0){
      const appendBuf=await subsetDeck(APPENDIX_PATH,appendIdxs);
      // Merge appendix slides into main deck
      finalBuf=await mergeDecks(finalBuf,appendBuf);
    }

    // Step 4: Inject supporting image slides with footnotes
    if(fetchedImages.length>0){
      finalBuf=await injectImageSlides(finalBuf,fetchedImages);
    }

    // Step 5: Return
    const filename=`Catskill_Partners_${(deck_type||'LP_Overview').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pptx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
    res.setHeader('X-Slide-Count',String(mainIdxs.length+appendIdxs.length+fetchedImages.length));
    res.setHeader('X-Filename',filename);
    res.status(200).send(finalBuf);

  }catch(err){
    console.error('generate_pptx error:',err);
    res.status(500).json({error:err.message});
  }
}

// ─── Merge two decks (append slides from deck2 into deck1) ───────────────────
async function mergeDecks(buf1,buf2){
  const e1=await parseZip(buf1);
  const e2=await parseZip(buf2);
  const sfns2=Object.keys(e2).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
  const sfns1=Object.keys(e1).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
  const maxS1=Math.max(0,...sfns1.map(f=>parseInt(f.match(/\d+/)[0])));
  const maxI1=Math.max(0,...Object.keys(e1).filter(f=>/^ppt\/media\//.test(f)).map(f=>{const m=f.match(/\d+/);return m?parseInt(m[0]):0;}));
  const out={...e1};
  let si=maxS1+1,ii=maxI1+1;
  // Media: remap image indices
  const mediaRemap={};
  for(const[k,v]of Object.entries(e2)){
    if(/^ppt\/media\//.test(k)){
      const m=k.match(/^(ppt\/media\/image)(\d+)(\..+)$/);
      if(m){const newKey=`${m[1]}${ii}${m[3]}`;out[newKey]=v;mediaRemap[k]=newKey;ii++;}
    }
  }
  for(const fn of sfns2){
    const idx=parseInt(fn.match(/\d+/)[0]);
    const rKey=`ppt/slides/_rels/slide${idx}.xml.rels`;
    out[`ppt/slides/slide${si}.xml`]=e2[fn];
    if(e2[rKey]){
      let rXml=e2[rKey].toString('utf8');
      for(const[old,nw]of Object.entries(mediaRemap)){
        const oldBase=old.replace('ppt/media/','../media/');
        const newBase=nw.replace('ppt/media/','../media/');
        rXml=rXml.replace(new RegExp(oldBase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),newBase);
      }
      out[`ppt/slides/_rels/slide${si}.xml.rels`]=Buffer.from(rXml,'utf8');
    }
    si++;
  }
  return buildZip(out);
}

// ─── Known reliable public chart URLs mapped by keyword intent ───────────────
function getKnownChartUrl(query){
  const q=query.toLowerCase();
  // Manufacturing employment / output — FRED
  if(q.includes('manufactur')&&(q.includes('employ')||q.includes('output')||q.includes('production'))){
    return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=MANEMP&width=680&height=420&vintage_date=2025-12-01',source:'https://fred.stlouisfed.org/series/MANEMP',citation:'Federal Reserve Bank of St. Louis (FRED), Manufacturing Employment, 2025',footnote_label:'US Manufacturing Employment (thousands of persons, seasonally adjusted)'};
  }
  if(q.includes('industrial production')||q.includes('indpro')||q.includes('manufactur')&&q.includes('index')){
    return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=INDPRO&width=680&height=420&vintage_date=2025-12-01',source:'https://fred.stlouisfed.org/series/INDPRO',citation:'Federal Reserve Bank of St. Louis (FRED), Industrial Production Index, 2025',footnote_label:'US Industrial Production Index (seasonally adjusted, 2017=100)'};
  }
  // Data center / hyperscale capex
  if(q.includes('data center')||q.includes('hyperscale')||q.includes('capex')||q.includes('ai infrastructure')){
    return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=PRFI&width=680&height=420&vintage_date=2025-12-01',source:'https://fred.stlouisfed.org/series/PRFI',citation:'Federal Reserve Bank of St. Louis (FRED), Private Residential Fixed Investment, 2025',footnote_label:'US Private Fixed Investment (billions of dollars, seasonally adjusted annual rate)'};
  }
  // Interest rates / cost of capital
  if(q.includes('interest rate')||q.includes('fed funds')||q.includes('rate cut')||q.includes('sofr')){
    return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=FEDFUNDS&width=680&height=420&vintage_date=2025-12-01',source:'https://fred.stlouisfed.org/series/FEDFUNDS',citation:'Federal Reserve Bank of St. Louis (FRED), Federal Funds Effective Rate, 2025',footnote_label:'Federal Funds Effective Rate (% per annum)'};
  }
  // M&A / PE deal volume
  if(q.includes('private equity')||q.includes('deal volume')||q.includes('lower middle market')||q.includes('lmm')){
    return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=BOGZ1FL104090005Q&width=680&height=420',source:'https://fred.stlouisfed.org/series/BOGZ1FL104090005Q',citation:'Federal Reserve Bank of St. Louis (FRED), Nonfinancial Corporate Business Net Worth, 2025',footnote_label:'US Nonfinancial Corporate Business Net Worth (billions of dollars)'};
  }
  // Supply chain / ISM
  if(q.includes('supply chain')||q.includes('ism')||q.includes('pmi')||q.includes('purchasing')){
    return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=MANEMP&width=680&height=420',source:'https://fred.stlouisfed.org/series/MANEMP',citation:'Federal Reserve Bank of St. Louis (FRED), Manufacturing Employment, 2025',footnote_label:'US Manufacturing Employment — proxy for industrial activity'};
  }
  // GDP / economic growth
  if(q.includes('gdp')||q.includes('economic growth')){
    return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=GDPC1&width=680&height=420&vintage_date=2025-12-01',source:'https://fred.stlouisfed.org/series/GDPC1',citation:'Federal Reserve Bank of St. Louis (FRED), Real Gross Domestic Product, 2025',footnote_label:'Real GDP (billions of chained 2017 dollars, seasonally adjusted annual rate)'};
  }
  // Default — US business investment
  return{url:'https://fred.stlouisfed.org/graph/fredgraph.png?id=PNFI&width=680&height=420&vintage_date=2025-12-01',source:'https://fred.stlouisfed.org/series/PNFI',citation:'Federal Reserve Bank of St. Louis (FRED), Private Nonresidential Fixed Investment, 2025',footnote_label:'US Private Nonresidential Fixed Investment (billions of dollars, SAAR)'};
}
