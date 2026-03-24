// Morgan Cole Presentation Builder v8.1
// Node.js built-ins only: zlib + Buffer for ZIP/PPTX manipulation
// No external dependencies needed.
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deflateRaw = promisify(zlib.deflateRaw);
const inflateRaw = promisify(zlib.inflateRaw);

// ── Slide catalogs ────────────────────────────────────────────────────────────
const MAIN_SLIDES = {
  cover:0,disclaimer:1,toc:2,firm_overview:3,deal_process:4,
  strategy:5,sector_focus:6,market_data:7,pipeline:8,deal_flow:9,
  underwriting:10,playbook:11,value_creation:12,why_now:13,closing:14,
  legal_structure:15,is_economics:16,fund_economics:17,team:18,deal_summary:19
};
const APPENDIX_MAP = {
  a_legal:15,a_is_econ:16,a_fund_econ:17,a_team:18,a_deal_summary:19,a_pipeline:8,
  a_sector_adv:6,a_sector_eng:7,a_sector_prec:6,a_cases_cover:11,a_bios:18
};
const DEFAULT_SLIDES = {
  lp:['cover','toc','firm_overview','market_data','strategy','sector_focus','pipeline','value_creation','why_now','fund_economics','team','closing','disclaimer'],
  ib:['cover','toc','firm_overview','deal_process','pipeline','deal_flow','sector_focus','value_creation','why_now','deal_summary','closing','disclaimer'],
  founder:['cover','firm_overview','strategy','value_creation','why_now','playbook','closing'],
  general:['cover','toc','firm_overview','market_data','strategy','pipeline','value_creation','why_now','fund_economics','closing','disclaimer']
};

function getAudienceKey(a) {
  a=(a||'').toLowerCase();
  if(['lp','institutional','family','hnw'].some(x=>a.includes(x)))return'lp';
  if(['banker','intermediary','ib','broker'].some(x=>a.includes(x)))return'ib';
  if(['founder','owner','seller','operator'].some(x=>a.includes(x)))return'founder';
  return'general';
}

// ── Pure Node.js ZIP parser ───────────────────────────────────────────────────
function readUint32LE(buf,off){return buf[off]|(buf[off+1]<<8)|(buf[off+2]<<16)|(buf[off+3]<<24)>>>0;}
function readUint16LE(buf,off){return buf[off]|(buf[off+1]<<8);}
function writeUint32LE(buf,val,off){buf[off]=val&255;buf[off+1]=(val>>8)&255;buf[off+2]=(val>>16)&255;buf[off+3]=(val>>24)&255;}
function writeUint16LE(buf,val,off){buf[off]=val&255;buf[off+1]=(val>>8)&255;}

async function parseZip(buf) {
  // Find End of Central Directory
  let eocd=-1;
  for(let i=buf.length-22;i>=0;i--){
    if(buf[i]===0x50&&buf[i+1]===0x4B&&buf[i+2]===0x05&&buf[i+3]===0x06){eocd=i;break;}
  }
  if(eocd<0) throw new Error('Invalid ZIP');
  const cdOffset=readUint32LE(buf,eocd+16);
  const cdSize=readUint32LE(buf,eocd+12);
  const numEntries=readUint16LE(buf,eocd+8);
  
  const entries={};
  let pos=cdOffset;
  for(let i=0;i<numEntries;i++){
    if(readUint32LE(buf,pos)!==0x02014B50) break;
    const compMethod=readUint16LE(buf,pos+10);
    const compSize=readUint32LE(buf,pos+20);
    const uncompSize=readUint32LE(buf,pos+24);
    const fnLen=readUint16LE(buf,pos+28);
    const extraLen=readUint16LE(buf,pos+30);
    const cmtLen=readUint16LE(buf,pos+32);
    const localOff=readUint32LE(buf,pos+42);
    const fname=buf.slice(pos+46,pos+46+fnLen).toString('utf8');
    entries[fname]={compMethod,compSize,uncompSize,localOff,fname};
    pos+=46+fnLen+extraLen+cmtLen;
  }
  return entries;
}

async function readZipEntry(buf,entry) {
  const lh=entry.localOff;
  if(readUint32LE(buf,lh)!==0x04034B50) throw new Error('Bad local header: '+entry.fname);
  const fnLen=readUint16LE(buf,lh+26);
  const extraLen=readUint16LE(buf,lh+28);
  const dataStart=lh+30+fnLen+extraLen;
  const data=buf.slice(dataStart,dataStart+entry.compSize);
  if(entry.compMethod===0) return data;
  if(entry.compMethod===8) return inflateRaw(data);
  throw new Error('Unsupported compression '+entry.compMethod);
}

async function buildZipEntry(fname,data,compress=true) {
  const fnBuf=Buffer.from(fname,'utf8');
  let compData,method;
  if(compress&&data.length>100){
    compData=await deflateRaw(data,{level:6});
    if(compData.length>=data.length){compData=data;method=0;}
    else method=8;
  }else{compData=data;method=0;}
  const crc=crc32(data);
  // Local header
  const lh=Buffer.alloc(30+fnBuf.length);
  writeUint32LE(lh,0x04034B50,0);
  writeUint16LE(lh,20,4); // version needed
  writeUint16LE(lh,0,6);  // flags
  writeUint16LE(lh,method,8);
  writeUint16LE(lh,0,10); writeUint16LE(lh,0,12); // mod time/date
  writeUint32LE(lh,crc,14);
  writeUint32LE(lh,compData.length,18);
  writeUint32LE(lh,data.length,22);
  writeUint16LE(lh,fnBuf.length,26);
  writeUint16LE(lh,0,28);
  fnBuf.copy(lh,30);
  return {localHeader:lh,data:compData,fname,method,crc,compSize:compData.length,uncompSize:data.length};
}

function crc32(buf) {
  let crc=0xFFFFFFFF;
  for(const b of buf){
    crc^=b;
    for(let j=0;j<8;j++) crc=(crc>>>1)^(crc&1?0xEDB88320:0);
  }
  return (crc^0xFFFFFFFF)>>>0;
}

async function buildZip(files) {
  // files: [{fname, data, compress}]
  const built=[];
  for(const f of files) built.push(await buildZipEntry(f.fname,f.data,f.compress!==false));
  
  const parts=[];
  const cdEntries=[];
  let offset=0;
  for(const e of built){
    parts.push(e.localHeader,e.data);
    // Central directory entry
    const fnBuf=Buffer.from(e.fname,'utf8');
    const cd=Buffer.alloc(46+fnBuf.length);
    writeUint32LE(cd,0x02014B50,0);
    writeUint16LE(cd,20,4);writeUint16LE(cd,20,6);
    writeUint16LE(cd,0,8);writeUint16LE(cd,e.method,10);
    writeUint16LE(cd,0,12);writeUint16LE(cd,0,14);
    writeUint32LE(cd,e.crc,16);
    writeUint32LE(cd,e.compSize,20);
    writeUint32LE(cd,e.uncompSize,24);
    writeUint16LE(cd,fnBuf.length,28);
    writeUint16LE(cd,0,30);writeUint16LE(cd,0,32);
    writeUint16LE(cd,0,34);writeUint16LE(cd,0,36);
    writeUint32LE(cd,0,38);writeUint32LE(cd,offset,42);
    fnBuf.copy(cd,46);
    cdEntries.push(cd);
    offset+=e.localHeader.length+e.data.length;
  }
  
  const cdBuf=Buffer.concat(cdEntries);
  const eocd=Buffer.alloc(22);
  writeUint32LE(eocd,0x06054B50,0);
  writeUint16LE(eocd,0,4);writeUint16LE(eocd,0,6);
  writeUint16LE(eocd,built.length,8);writeUint16LE(eocd,built.length,10);
  writeUint32LE(eocd,cdBuf.length,12);writeUint32LE(eocd,offset,16);
  writeUint16LE(eocd,0,20);
  
  return Buffer.concat([...parts,cdBuf,eocd]);
}

// ── PPTX subset (ZIP-native) ──────────────────────────────────────────────────
async function subsetDeck(deckPath,slideIndices) {
  const raw=fs.readFileSync(deckPath);
  const entries=await parseZip(raw);
  
  // Read presentation rels to get slide order
  const prsRelsEntry=entries['ppt/_rels/presentation.xml.rels'];
  const prsRelsXml=(await readZipEntry(raw,prsRelsEntry)).toString('utf8');
  
  const relMatches=[...prsRelsXml.matchAll(/Id="([^"]+)"[^>]*Type="[^"]*\/slide"[^>]*Target="slides\/slide(\d+)\.xml"/g)];
  const slideOrder=relMatches.map(m=>({rId:m[1],num:parseInt(m[2])})).sort((a,b)=>a.num-b.num);
  if(!slideOrder.length) throw new Error('No slides found');
  
  // Dedup valid indices
  const maxIdx=slideOrder.length-1;
  const seen=new Set();const valid=[];
  for(const i of slideIndices){if(i>=0&&i<=maxIdx&&!seen.has(i)){seen.add(i);valid.push(i);}}
  
  const keptRIds=new Set(valid.map(i=>slideOrder[i].rId));
  const keptNums=new Set(valid.map(i=>slideOrder[i].num));
  const unwanted=new Set(slideOrder.map(e=>e.num).filter(n=>!keptNums.has(n)));
  
  // Read and patch presentation.xml
  const prsEntry=entries['ppt/presentation.xml'];
  let prsXml=(await readZipEntry(raw,prsEntry)).toString('utf8');
  prsXml=prsXml.replace(/<p:sldId[^/]*\/>/g,m=>{
    const m2=m.match(/r:id="([^"]+)"/);
    return m2&&keptRIds.has(m2[1])?m:'';
  });
  
  // Patch rels
  let newRels=prsRelsXml.replace(/<Relationship[^>]*Type="[^"]*\/slide"[^>]*\/>/g,m=>{
    const m2=m.match(/Id="([^"]+)"/);
    return m2&&keptRIds.has(m2[1])?m:'';
  });
  
  // Build output files
  const skipSet=new Set();
  for(const n of unwanted){
    skipSet.add('ppt/slides/slide'+n+'.xml');
    skipSet.add('ppt/slides/_rels/slide'+n+'.xml.rels');
    skipSet.add('ppt/notesSlides/notesSlide'+n+'.xml');
    skipSet.add('ppt/notesSlides/_rels/notesSlide'+n+'.xml.rels');
  }
  
  const outFiles=[];
  for(const [fname,entry] of Object.entries(entries)){
    if(skipSet.has(fname)) continue;
    let data;
    if(fname==='ppt/presentation.xml') data=Buffer.from(prsXml,'utf8');
    else if(fname==='ppt/_rels/presentation.xml.rels') data=Buffer.from(newRels,'utf8');
    else data=await readZipEntry(raw,entry);
    outFiles.push({fname,data});
  }
  return buildZip(outFiles);
}

async function injectImageSlides(pptxBuf,imageSlides) {
  const raw=pptxBuf;
  const entries=await parseZip(raw);
  
  const slideFiles=Object.keys(entries).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
  const maxSlide=Math.max(0,...slideFiles.map(f=>parseInt(f.match(/\d+/)[0])));
  const imgFiles=Object.keys(entries).filter(f=>/^ppt\/media\/image\d+\./.test(f));
  const maxImg=Math.max(0,...imgFiles.map(f=>parseInt(f.match(/\d+/)[0])));
  
  const prsRelsEntry=entries['ppt/_rels/presentation.xml.rels'];
  let prsRels=(await readZipEntry(raw,prsRelsEntry)).toString('utf8');
  const ridMs=[...prsRels.matchAll(/Id="rId(\d+)"/g)];
  const maxRId=Math.max(0,...ridMs.map(m=>parseInt(m[1])));
  
  const prsEntry=entries['ppt/presentation.xml'];
  let prsXml=(await readZipEntry(raw,prsEntry)).toString('utf8');
  const sldIdMs=[...prsXml.matchAll(/id="(\d+)"/g)];
  const maxSldId=Math.max(256,...sldIdMs.map(m=>parseInt(m[1])));
  
  // Find layout target
  let layoutTgt='../slideLayouts/slideLayout1.xml';
  for(const sf of slideFiles.slice(0,1)){
    const rn=sf.replace('slides/slide','slides/_rels/slide').replace('.xml','.xml.rels');
    if(entries[rn]){
      const rx=(await readZipEntry(raw,entries[rn])).toString('utf8');
      const lm=rx.match(/Type="[^"]*slideLayout"[^>]*Target="([^"]+)"/);
      if(lm) layoutTgt=lm[1];
    }
  }
  
  const ctEntry=entries['[Content_Types].xml'];
  let ctXml=(await readZipEntry(raw,ctEntry)).toString('utf8');
  
  const newEntries={};
  for(let i=0;i<imageSlides.length;i++){
    const cs=imageSlides[i];
    const sn=maxSlide+1+i;const imgN=maxImg+1+i;
    const ext=cs.ext||'png';const sr='rId'+(maxRId+1+i);
    const sp='ppt/slides/slide'+sn+'.xml';
    const srp='ppt/slides/_rels/slide'+sn+'.xml.rels';
    const ip='ppt/media/image'+imgN+'.'+ext;
    const it='../media/image'+imgN+'.'+ext;
    const tSafe=(cs.title||'Market Data').substring(0,80).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const src='Source: '+(cs.source||'Research')+' '+(cs.date||'2024')+'  |  CATSKILL PARTNERS · CLARITY. CRAFT. CAPITAL.';
    const srcSafe=src.substring(0,140).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    
    newEntries[ip]=cs.bytes;
    newEntries[sp]=Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="1A4C3D"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="190500"/><a:ext cx="8229600" cy="600075"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1800" b="1" dirty="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="+mj-lt"/></a:rPr><a:t>'+tSafe+'</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="Chart"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="457200" y="857250"/><a:ext cx="8229600" cy="5029200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic><p:sp><p:nvSpPr><p:cNvPr id="4" name="Source"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="6096000"/><a:ext cx="8229600" cy="228600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="900" dirty="0"><a:solidFill><a:srgbClr val="6BAE7F"/></a:solidFill><a:latin typeface="+mn-lt"/></a:rPr><a:t>'+srcSafe+'</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClr/></p:clrMapOvr></p:sld>','utf8');
    newEntries[srp]=Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="'+layoutTgt+'"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="'+it+'"/></Relationships>','utf8');
    
    prsXml=prsXml.replace('</p:sldIdLst>','<p:sldId id="'+(maxSldId+1+i)+'" r:id="'+sr+'"/></p:sldIdLst>');
    prsRels=prsRels.replace('</Relationships>','<Relationship Id="'+sr+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide'+sn+'.xml"/></Relationships>');
    const pn='/ppt/slides/slide'+sn+'.xml';
    if(!ctXml.includes(pn)) ctXml=ctXml.replace('</Types>','<Override PartName="'+pn+'" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
  }
  
  const outFiles=[];
  for(const[fname,entry]of Object.entries(entries)){
    let data;
    if(fname==='ppt/presentation.xml') data=Buffer.from(prsXml,'utf8');
    else if(fname==='ppt/_rels/presentation.xml.rels') data=Buffer.from(prsRels,'utf8');
    else if(fname==='[Content_Types].xml') data=Buffer.from(ctXml,'utf8');
    else data=await readZipEntry(raw,entry);
    outFiles.push({fname,data});
  }
  for(const[fname,data]of Object.entries(newEntries)) outFiles.push({fname,data});
  return buildZip(outFiles);
}

function countSlides(buf) {
  const relsStart=buf.indexOf(Buffer.from('ppt/_rels/presentation.xml.rels'));
  return 0; // Will count from response
}

// ── Anthropic + image search (same as v8) ─────────────────────────────────────
async function callAnthropic(messages,system,apiKey,maxTokens=1500,tools=null){
  const body={model:'claude-sonnet-4-20250514',max_tokens:maxTokens,system,messages};
  if(tools) body.tools=tools;
  const r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(30000)
  });
  if(!r.ok) throw new Error('Anthropic '+r.status);
  return r.json();
}
function extractText(d){return(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(' ').trim();}
function parseJSON(t){
  const c=t.replace(/```json\n?/g,'').replace(/```/g,'').trim();
  const m=c.match(/\{[\s\S]*\}/);if(!m)return{};
  try{return JSON.parse(m[0]);}catch{return{};}
}

const ORCH_SYS='You are Morgan Cole, VP Marketing at Catskill Partners.\nReturn ONLY valid JSON (no fences):\n{\n"slide_selection":["cover","toc","firm_overview"],\n"appendix_selection":["a_fund_econ","a_team"],\n"image_requests":[{"title":"Operator PE Returns","search_query":"operator PE IRR returns chart McKinsey BCG 2023 2024","fallback_query":"private equity value creation returns chart"}],\n"deck_rationale":"reason"\n}\nMAIN:cover,disclaimer,toc,firm_overview,deal_process,strategy,sector_focus,market_data,pipeline,deal_flow,underwriting,playbook,value_creation,why_now,closing,legal_structure,is_economics,fund_economics,team,deal_summary\nAPPENDIX:a_legal,a_is_econ,a_fund_econ,a_team,a_pipeline,a_deal_summary,a_sector_adv,a_sector_eng,a_sector_prec\nimage_requests 0-3 max from McKinsey BCG Bain CBRE JLL Deloitte PitchBook.';

async function orchestrate(topic,audience,brief,taskType,inclApp,inclImg,apiKey){
  const key=getAudienceKey(audience);
  const prompt='Build custom Catskill deck.\nTopic:'+topic+'\nAudience:'+audience+' ('+key+')\nBrief:'+(brief||'Standard')+'\nAppendix:'+inclApp+' Images:'+inclImg+(inclImg?'\nInclude 2-3 image_requests for real research charts.':'\nSet image_requests to [].')+(inclApp?'\nInclude 3-5 appendix slides.':'\nSet appendix_selection to [].');
  try{
    const d=await callAnthropic([{role:'user',content:prompt}],ORCH_SYS,apiKey,1000);
    const r=parseJSON(extractText(d));
    if(!r.slide_selection?.length) r.slide_selection=DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general;
    return r;
  }catch{
    return{slide_selection:DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general,appendix_selection:inclApp?['a_fund_econ','a_team']:[],image_requests:[]};
  }
}

const IMG_SYS='Find a real published chart image. Return ONLY valid JSON:\n{"image_url":"https://...","page_url":"https://...","source_name":"McKinsey","source_date":"2024","title_override":"Better title"}';
async function fetchRealImage(req,apiKey){
  const prompt='Find real published chart for investor deck.\nSearch: '+req.search_query+'\nFallback: '+req.fallback_query+'\nContext: '+req.title+'\nFind from McKinsey BCG Bain CBRE JLL Deloitte PitchBook Preqin.';
  try{
    const d=await callAnthropic([{role:'user',content:prompt}],IMG_SYS,apiKey,600,[{type:'web_search_20250305',name:'web_search'}]);
    const res=parseJSON(extractText(d));
    const imgUrl=res.image_url||'';
    if(imgUrl&&/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(imgUrl)){
      const r=await fetch(imgUrl,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(10000)});
      if(r.ok){const b=Buffer.from(await r.arrayBuffer());if(b.length>5000){const ct=r.headers.get('content-type')||'';return{bytes:b,ext:ct.includes('jpg')||ct.includes('jpeg')?'jpg':'png',source:res.source_name||'Research',date:res.source_date||'2024',titleOverride:res.title_override||''}; }}
    }
    const pageUrl=res.page_url||'';
    if(pageUrl){
      const pr=await fetch(pageUrl,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)}).catch(()=>null);
      if(pr?.ok){
        const html=await pr.text();
        const imgs=[...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:png|jpg|jpeg|webp))[^>]*>/gi)].map(m=>m[1]).slice(0,6);
        for(const src of imgs){
          const u=src.startsWith('http')?src:new URL(src,pageUrl).href;
          const ir=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)}).catch(()=>null);
          if(ir?.ok){const b=Buffer.from(await ir.arrayBuffer());if(b.length>10000) return{bytes:b,ext:'png',source:res.source_name||'Research',date:res.source_date||'2024',titleOverride:res.title_override||''};}
        }
      }
    }
  }catch{}
  return null;
}

// ── Main build ────────────────────────────────────────────────────────────────
async function buildDeck(topic,audience,brief,tone,taskType,inclApp,inclImg,apiKey){
  const mainPath=path.join(__dirname,'main_deck.pptx');
  if(!fs.existsSync(mainPath)) throw new Error('main_deck.pptx not found at '+mainPath);
  const plan=await orchestrate(topic,audience,brief,taskType,inclApp,inclImg,apiKey);
  const key=getAudienceKey(audience);
  let indices=(plan.slide_selection||DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general).map(n=>MAIN_SLIDES[n]).filter(i=>i!=null);
  if(!indices.length) indices=(DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general).map(n=>MAIN_SLIDES[n]).filter(i=>i!=null);
  const appNames=plan.appendix_selection||[];
  if(inclApp&&appNames.length){
    const extra=appNames.map(n=>APPENDIX_MAP[n]).filter(i=>i!=null&&!indices.includes(i));
    if(extra.length){const cp=indices.indexOf(14);const at=cp>=0?cp:indices.length;indices=[...indices.slice(0,at),...extra,...indices.slice(at)];}
  }
  let buf=await subsetDeck(mainPath,indices);
  const imgs=[];
  if(inclImg){
    for(const req of(plan.image_requests||[]).slice(0,3)){
      const r=await fetchRealImage(req,apiKey).catch(()=>null);
      if(r?.bytes) imgs.push({title:r.titleOverride||req.title||'Market Research',bytes:r.bytes,ext:r.ext||'png',source:r.source||'Research',date:r.date||'2024'});
    }
    if(imgs.length) buf=await injectImageSlides(buf,imgs);
  }
  // Count slides from rels
  const entries2=await parseZip(buf);
  const relsEntry=entries2['ppt/_rels/presentation.xml.rels'];
  const relsXml=(await readZipEntry(buf,relsEntry)).toString('utf8');
  const sc=(relsXml.match(/Type="[^"]*\/slide"/g)||[]).length;
  return{buf,imgCount:imgs.length,slideCount:sc,rationale:plan.deck_rationale||'Custom deck assembled'};
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey) return res.status(500).json({error:'API key not configured'});
  try{
    const b=req.body||{};
    const{buf,imgCount,slideCount,rationale}=await buildDeck(b.topic||'Catskill Partners Overview',b.audience||'LP / Institutional Investor',b.brief||'',b.tone||'Institutional',b.taskType||'full_deck',b.includeAppendix||false,b.includeMarketCharts||false,apiKey);
    const slug=(b.topic||'deck').replace(/[^a-zA-Z0-9]/g,'-').substring(0,40);
    return res.status(200).json({success:true,filename:'Catskill-'+slug+'.pptx',base64:buf.toString('base64'),slideCount,imageSlides:imgCount,title:b.topic||'',rationale});
  }catch(e){
    console.error('generate_pptx error:',e.message,e.stack?.substring(0,300));
    return res.status(500).json({error:e.message,detail:e.stack?.substring(0,400)});
  }
}
