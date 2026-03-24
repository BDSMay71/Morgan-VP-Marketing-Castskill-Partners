// Morgan Cole – Intelligent Presentation Builder v9
// CommonJS — zero external deps, pure Node built-ins
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const deflateRaw = promisify(zlib.deflateRaw);
const inflateRaw = promisify(zlib.inflateRaw);

const MAIN_SLIDES={cover:0,disclaimer:1,toc:2,firm_overview:3,deal_process:4,strategy:5,sector_focus:6,market_data:7,pipeline:8,deal_flow:9,underwriting:10,playbook:11,value_creation:12,why_now:13,closing:14,legal_structure:15,is_economics:16,fund_economics:17,team:18,deal_summary:19};
const APPENDIX_MAP={a_legal:15,a_is_econ:16,a_fund_econ:17,a_team:18,a_deal_summary:19,a_pipeline:8,a_sector_adv:6,a_sector_eng:7,a_sector_prec:6,a_cases_cover:11,a_bios:18};
const DEFAULT_SLIDES={lp:['cover','toc','firm_overview','market_data','strategy','sector_focus','pipeline','value_creation','why_now','fund_economics','team','closing','disclaimer'],ib:['cover','toc','firm_overview','deal_process','pipeline','deal_flow','sector_focus','value_creation','why_now','deal_summary','closing','disclaimer'],founder:['cover','firm_overview','strategy','value_creation','why_now','playbook','closing'],general:['cover','toc','firm_overview','market_data','strategy','pipeline','value_creation','why_now','fund_economics','closing','disclaimer']};

function getAudienceKey(a){a=(a||'').toLowerCase();if(['lp','institutional','family','hnw'].some(x=>a.includes(x)))return'lp';if(['banker','intermediary','ib','broker'].some(x=>a.includes(x)))return'ib';if(['founder','owner','seller','operator'].some(x=>a.includes(x)))return'founder';return'general';}

// ZIP helpers
function ru32(b,o){return(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
function ru16(b,o){return b[o]|(b[o+1]<<8);}
function wu32(b,v,o){b[o]=v&255;b[o+1]=(v>>8)&255;b[o+2]=(v>>16)&255;b[o+3]=(v>>24)&255;}
function wu16(b,v,o){b[o]=v&255;b[o+1]=(v>>8)&255;}
function crc32(buf){let c=0xFFFFFFFF;for(const b of buf){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xEDB88320:0);}return(c^0xFFFFFFFF)>>>0;}

async function parseZip(buf){
  let eocd=-1;for(let i=buf.length-22;i>=0;i--){if(buf[i]===0x50&&buf[i+1]===0x4B&&buf[i+2]===0x05&&buf[i+3]===0x06){eocd=i;break;}}
  if(eocd<0)throw new Error('Invalid ZIP');
  const cdOff=ru32(buf,eocd+16),numEnt=ru16(buf,eocd+8);
  const entries={};let pos=cdOff;
  for(let i=0;i<numEnt;i++){
    if(ru32(buf,pos)!==0x02014B50)break;
    const meth=ru16(buf,pos+10),csz=ru32(buf,pos+20),usz=ru32(buf,pos+24),fnl=ru16(buf,pos+28),exl=ru16(buf,pos+30),cml=ru16(buf,pos+32),loff=ru32(buf,pos+42);
    const fn=buf.slice(pos+46,pos+46+fnl).toString('utf8');
    entries[fn]={meth,csz,usz,loff};pos+=46+fnl+exl+cml;
  }
  return entries;
}
async function readEntry(buf,e){
  if(ru32(buf,e.loff)!==0x04034B50)throw new Error('Bad LH');
  const fnl=ru16(buf,e.loff+26),exl=ru16(buf,e.loff+28),ds=e.loff+30+fnl+exl;
  const d=buf.slice(ds,ds+e.csz);
  if(e.meth===0)return d;if(e.meth===8)return inflateRaw(d);throw new Error('Unsupported '+e.meth);
}
async function buildEntry(fn,data,compress=true){
  const fb=Buffer.from(fn,'utf8');let cd=data,meth=0;
  if(compress&&data.length>100){const t=await deflateRaw(data,{level:6});if(t.length<data.length){cd=t;meth=8;}}
  const cr=crc32(data);const lh=Buffer.alloc(30+fb.length);
  wu32(lh,0x04034B50,0);wu16(lh,20,4);wu16(lh,0,6);wu16(lh,meth,8);wu16(lh,0,10);wu16(lh,0,12);wu32(lh,cr,14);wu32(lh,cd.length,18);wu32(lh,data.length,22);wu16(lh,fb.length,26);wu16(lh,0,28);fb.copy(lh,30);
  return{lh,cd,fn:fb,meth,cr,csz:cd.length,usz:data.length};
}
async function buildZip(files){
  const built=[];for(const f of files)built.push(await buildEntry(f.fn,f.data,f.compress!==false));
  const parts=[],cds=[];let off=0;
  for(const e of built){
    parts.push(e.lh,e.cd);
    const cd=Buffer.alloc(46+e.fn.length);wu32(cd,0x02014B50,0);wu16(cd,20,4);wu16(cd,20,6);wu16(cd,0,8);wu16(cd,e.meth,10);wu16(cd,0,12);wu16(cd,0,14);wu32(cd,e.cr,16);wu32(cd,e.csz,20);wu32(cd,e.usz,24);wu16(cd,e.fn.length,28);wu16(cd,0,30);wu16(cd,0,32);wu16(cd,0,34);wu16(cd,0,36);wu32(cd,0,38);wu32(cd,off,42);e.fn.copy(cd,46);cds.push(cd);off+=e.lh.length+e.cd.length;
  }
  const cdb=Buffer.concat(cds),eocd=Buffer.alloc(22);wu32(eocd,0x06054B50,0);wu16(eocd,0,4);wu16(eocd,0,6);wu16(eocd,built.length,8);wu16(eocd,built.length,10);wu32(eocd,cdb.length,12);wu32(eocd,off,16);wu16(eocd,0,20);
  return Buffer.concat([...parts,cdb,eocd]);
}

async function subsetDeck(deckPath,idxArr){
  const raw=fs.readFileSync(deckPath);
  const entries=await parseZip(raw);
  const relsXml=(await readEntry(raw,entries['ppt/_rels/presentation.xml.rels'])).toString('utf8');
  const slideOrder=[...relsXml.matchAll(/Id="([^"]+)"[^>]*Type="[^"]*\/slide"[^>]*Target="slides\/slide(\d+)\.xml"/g)]
    .map(m=>({rId:m[1],num:parseInt(m[2])})).sort((a,b)=>a.num-b.num);
  if(!slideOrder.length)throw new Error('No slides');
  const maxI=slideOrder.length-1,seen=new Set(),valid=[];
  for(const i of idxArr){if(i>=0&&i<=maxI&&!seen.has(i)){seen.add(i);valid.push(i);}}
  const kRIds=new Set(valid.map(i=>slideOrder[i].rId)),kNums=new Set(valid.map(i=>slideOrder[i].num));
  const unwanted=new Set(slideOrder.map(e=>e.num).filter(n=>!kNums.has(n)));
  let prsXml=(await readEntry(raw,entries['ppt/presentation.xml'])).toString('utf8');
  let newRels=relsXml;
  prsXml=prsXml.replace(/<p:sldId[^/]*\/>/g,m=>{const m2=m.match(/r:id="([^"]+)"/);return m2&&kRIds.has(m2[1])?m:'';});
  newRels=newRels.replace(/<Relationship[^>]*Type="[^"]*\/slide"[^>]*\/>/g,m=>{const m2=m.match(/Id="([^"]+)"/);return m2&&kRIds.has(m2[1])?m:'';});
  const skip=new Set();
  for(const n of unwanted){['ppt/slides/slide'+n+'.xml','ppt/slides/_rels/slide'+n+'.xml.rels','ppt/notesSlides/notesSlide'+n+'.xml','ppt/notesSlides/_rels/notesSlide'+n+'.xml.rels'].forEach(f=>skip.add(f));}
  const out=[];
  for(const[fn,e]of Object.entries(entries)){
    if(skip.has(fn))continue;
    let data;if(fn==='ppt/presentation.xml')data=Buffer.from(prsXml,'utf8');
    else if(fn==='ppt/_rels/presentation.xml.rels')data=Buffer.from(newRels,'utf8');
    else data=await readEntry(raw,e);
    out.push({fn,data});
  }
  return buildZip(out);
}

async function injectImageSlides(pptxBuf,imgs){
  const raw=pptxBuf,entries=await parseZip(raw);
  const sfns=Object.keys(entries).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
  const maxS=Math.max(0,...sfns.map(f=>parseInt(f.match(/\d+/)[0])));
  const maxI=Math.max(0,...Object.keys(entries).filter(f=>/^ppt\/media\/image\d+\./.test(f)).map(f=>parseInt(f.match(/\d+/)[0])));
  let prsRels=(await readEntry(raw,entries['ppt/_rels/presentation.xml.rels'])).toString('utf8');
  let prsXml=(await readEntry(raw,entries['ppt/presentation.xml'])).toString('utf8');
  let ctXml=(await readEntry(raw,entries['[Content_Types].xml'])).toString('utf8');
  const maxRId=Math.max(0,...[...prsRels.matchAll(/Id="rId(\d+)"/g)].map(m=>parseInt(m[1])));
  const maxSId=Math.max(256,...[...prsXml.matchAll(/id="(\d+)"/g)].map(m=>parseInt(m[1])));
  let lt='../slideLayouts/slideLayout1.xml';
  for(const sf of sfns.slice(0,1)){const rn=sf.replace('slides/slide','slides/_rels/slide').replace('.xml','.xml.rels');if(entries[rn]){const rx=(await readEntry(raw,entries[rn])).toString('utf8');const lm=rx.match(/Type="[^"]*slideLayout"[^>]*Target="([^"]+)"/);if(lm)lt=lm[1];}}
  const newFiles={};
  for(let i=0;i<imgs.length;i++){
    const cs=imgs[i],sn=maxS+1+i,iN=maxI+1+i,ext=cs.ext||'png',sr='rId'+(maxRId+1+i);
    const it='../media/image'+iN+'.'+ext;
    const ts=(cs.title||'Market Data').substring(0,80).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const src=('Source: '+(cs.source||'Research')+' '+(cs.date||'2024')+'  |  CATSKILL PARTNERS').substring(0,140).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    newFiles['ppt/media/image'+iN+'.'+ext]=cs.bytes;
    newFiles['ppt/slides/slide'+sn+'.xml']=Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="1A4C3D"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="190500"/><a:ext cx="8229600" cy="600075"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1800" b="1" dirty="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="+mj-lt"/></a:rPr><a:t>'+ts+'</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="Chart"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="457200" y="857250"/><a:ext cx="8229600" cy="5029200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic><p:sp><p:nvSpPr><p:cNvPr id="4" name="Source"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="6096000"/><a:ext cx="8229600" cy="228600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="900" dirty="0"><a:solidFill><a:srgbClr val="6BAE7F"/></a:solidFill><a:latin typeface="+mn-lt"/></a:rPr><a:t>'+src+'</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClr/></p:clrMapOvr></p:sld>','utf8');
    newFiles['ppt/slides/_rels/slide'+sn+'.xml.rels']=Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="'+lt+'"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="'+it+'"/></Relationships>','utf8');
    prsXml=prsXml.replace('</p:sldIdLst>','<p:sldId id="'+(maxSId+1+i)+'" r:id="'+sr+'"/></p:sldIdLst>');
    prsRels=prsRels.replace('</Relationships>','<Relationship Id="'+sr+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide'+sn+'.xml"/></Relationships>');
    const pn='/ppt/slides/slide'+sn+'.xml';if(!ctXml.includes(pn))ctXml=ctXml.replace('</Types>','<Override PartName="'+pn+'" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
  }
  const out=[];
  for(const[fn,e]of Object.entries(entries)){
    let data;if(fn==='ppt/presentation.xml')data=Buffer.from(prsXml,'utf8');
    else if(fn==='ppt/_rels/presentation.xml.rels')data=Buffer.from(prsRels,'utf8');
    else if(fn==='[Content_Types].xml')data=Buffer.from(ctXml,'utf8');
    else data=await readEntry(raw,e);
    out.push({fn,data});
  }
  for(const[fn,data]of Object.entries(newFiles))out.push({fn,data});
  return buildZip(out);
}

// Anthropic + image search
async function callAnthropic(messages,system,apiKey,maxTokens,tools){
  const body={model:'claude-sonnet-4-20250514',max_tokens:maxTokens||1500,system,messages};
  if(tools)body.tools=tools;
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error('Anthropic '+r.status+': '+await r.text());
  return r.json();
}
function extractText(d){return(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(' ').trim();}
function parseJSON(t){const c=t.replace(/```json\n?/g,'').replace(/```/g,'').trim();const m=c.match(/\{[\s\S]*\}/);if(!m)return{};try{return JSON.parse(m[0]);}catch{return{};}}

const ORCH_SYS='You are Morgan Cole, VP Marketing at Catskill Partners. Return ONLY valid JSON (no fences):\n{"slide_selection":["cover","toc","firm_overview"],"appendix_selection":["a_fund_econ","a_team"],"image_requests":[{"title":"Operator PE Returns","search_query":"operator PE IRR returns outperformance chart McKinsey BCG Bain 2023 2024","fallback_query":"private equity value creation operational improvement returns chart"}],"deck_rationale":"reason"}\nMAIN: cover,disclaimer,toc,firm_overview,deal_process,strategy,sector_focus,market_data,pipeline,deal_flow,underwriting,playbook,value_creation,why_now,closing,legal_structure,is_economics,fund_economics,team,deal_summary\nAPPENDIX: a_legal,a_is_econ,a_fund_econ,a_team,a_pipeline,a_deal_summary,a_sector_adv,a_sector_eng,a_sector_prec\nimage_requests 0-3 max. Find from McKinsey BCG Bain CBRE JLL Deloitte PitchBook Preqin.';

async function orchestrate(topic,audience,brief,taskType,inclApp,inclImg,apiKey){
  const key=getAudienceKey(audience);
  try{
    const prompt='Custom Catskill deck.\nTopic:'+topic+'\nAudience:'+audience+' ('+key+')\nBrief:'+(brief||'Standard')+'\nAppendix:'+inclApp+' Images:'+inclImg+(inclImg?'\nInclude 2-3 image_requests.':'\nimage_requests:[].')+(inclApp?'\nInclude 3-5 appendix slides.':'\nappendix_selection:[].');
    const d=await callAnthropic([{role:'user',content:prompt}],ORCH_SYS,apiKey,1000);
    const r=parseJSON(extractText(d));
    if(!r.slide_selection?.length)r.slide_selection=DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general;
    return r;
  }catch{return{slide_selection:DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general,appendix_selection:inclApp?['a_fund_econ','a_team']:[],image_requests:[]};}
}

const IMG_SYS='Find a real published chart image. Return ONLY valid JSON (no fences):\n{"image_url":"https://...","page_url":"https://...","source_name":"McKinsey","source_date":"2024","title_override":"Better title"}';
async function fetchRealImage(req,apiKey){
  const prompt='Find real published chart for investor deck.\nSearch: '+req.search_query+'\nFallback: '+req.fallback_query+'\nContext: '+req.title+'\nPrioritize McKinsey BCG Bain CBRE JLL Deloitte PitchBook Preqin.';
  try{
    const d=await callAnthropic([{role:'user',content:prompt}],IMG_SYS,apiKey,600,[{type:'web_search_20250305',name:'web_search'}]);
    const res=parseJSON(extractText(d));
    const iu=res.image_url||'';
    if(iu&&/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(iu)){
      const r=await fetch(iu,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(10000)});
      if(r.ok){const b=Buffer.from(await r.arrayBuffer());if(b.length>5000){const ct=r.headers.get('content-type')||'';return{bytes:b,ext:ct.includes('jpg')||ct.includes('jpeg')?'jpg':'png',source:res.source_name||'Research',date:res.source_date||'2024',titleOverride:res.title_override||''};}}
    }
    const pu=res.page_url||'';
    if(pu){
      const pr=await fetch(pu,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)}).catch(()=>null);
      if(pr?.ok){
        const html=await pr.text();
        const is=[...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:png|jpg|jpeg|webp))[^>]*>/gi)].map(m=>m[1]).slice(0,6);
        for(const s of is){const u=s.startsWith('http')?s:new URL(s,pu).href;const ir=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)}).catch(()=>null);if(ir?.ok){const b=Buffer.from(await ir.arrayBuffer());if(b.length>10000)return{bytes:b,ext:'png',source:res.source_name||'Research',date:res.source_date||'2024',titleOverride:res.title_override||''};}}
      }
    }
  }catch(e){console.error('fetchRealImage error:',e.message);}
  return null;
}

async function buildDeck(topic,audience,brief,tone,taskType,inclApp,inclImg,apiKey){
  const mainPath=path.join(__dirname,'main_deck.pptx');
  if(!fs.existsSync(mainPath))throw new Error('main_deck.pptx not found at '+mainPath);
  const plan=await orchestrate(topic,audience,brief,taskType,inclApp,inclImg,apiKey);
  const key=getAudienceKey(audience);
  let indices=(plan.slide_selection||DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general).map(n=>MAIN_SLIDES[n]).filter(i=>i!=null);
  if(!indices.length)indices=(DEFAULT_SLIDES[key]||DEFAULT_SLIDES.general).map(n=>MAIN_SLIDES[n]).filter(i=>i!=null);
  if(inclApp&&plan.appendix_selection?.length){
    const extra=plan.appendix_selection.map(n=>APPENDIX_MAP[n]).filter(i=>i!=null&&!indices.includes(i));
    if(extra.length){const cp=indices.indexOf(14);const at=cp>=0?cp:indices.length;indices=[...indices.slice(0,at),...extra,...indices.slice(at)];}
  }
  let buf=await subsetDeck(mainPath,indices);
  const imgSlides=[];
  if(inclImg&&plan.image_requests?.length){
    for(const req of plan.image_requests.slice(0,3)){
      const r=await fetchRealImage(req,apiKey).catch(()=>null);
      if(r?.bytes)imgSlides.push({title:r.titleOverride||req.title||'Market Data',bytes:r.bytes,ext:r.ext||'png',source:r.source||'Research',date:r.date||'2024'});
    }
    if(imgSlides.length)buf=await injectImageSlides(buf,imgSlides);
  }
  const entries2=await parseZip(buf);
  const rX=(await readEntry(buf,entries2['ppt/_rels/presentation.xml.rels'])).toString('utf8');
  const sc=(rX.match(/Type="[^"]*\/slide"/g)||[]).length;
  return{buf,imgCount:imgSlides.length,slideCount:sc,rationale:plan.deck_rationale||'Custom deck assembled'};
}

module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey)return res.status(500).json({error:'API key not configured'});
  try{
    const b=req.body||{};
    const{buf,imgCount,slideCount,rationale}=await buildDeck(b.topic||'Catskill Partners Overview',b.audience||'LP / Institutional Investor',b.brief||'',b.tone||'Institutional',b.taskType||'full_deck',!!b.includeAppendix,!!b.includeMarketCharts,apiKey);
    const slug=(b.topic||'deck').replace(/[^a-zA-Z0-9]/g,'-').substring(0,40);
    return res.status(200).json({success:true,filename:'Catskill-'+slug+'.pptx',base64:buf.toString('base64'),slideCount,imageSlides:imgCount,title:b.topic||'',rationale});
  }catch(e){
    console.error('PPTX error:',e.message,e.stack?.substring(0,300));
    return res.status(500).json({error:e.message,detail:e.stack?.substring(0,400)});
  }
};
