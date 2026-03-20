import PptxGenJS from 'pptxgenjs';

// ================================================================
// CATSKILL PARTNERS — LOCKED BRAND PALETTE
// Master: https://1drv.ms/p/c/18334eea8b635807/IQBVzUUSUQD2TZk1i2t9eDXdAYJ1aL_99XbNdYGjfLQgkSE
// Appendix: https://catskillpartners-my.sharepoint.com/:p:/p/brian_steel/IQBza9Nv1AWISYFEbbhLfy_zAcC6Hd1op8G6-QTVmY8t0IE
// NEVER: #132240 navy, #B8962E gold — NOT Catskill colors
// ================================================================
const B={
  primary:'1A4C3D', forest:'2D6A4F', accent:'41AC48', dark:'1B4D3E',
  light:'EDF7F2', off:'F9F9F7', lgray:'C8C8C3', mgray:'4a4a4a',
  dgray:'2C2C2C', white:'FFFFFF', font:'Inter'
};
const W=13.33, H=7.5;

async function genContent(topic, audience, brief, tone, apiKey) {
  const sys = `You are Morgan Cole, VP of Marketing at Catskill Partners LP.

FIRM: Brian Steel (CEO/operator) + Mike Fuller (PE investor) | Fund I $250M | 6-8 platforms | $2-20M EBITDA | North America
SECTORS: Advanced Mfg, Engineered Materials, Precision Components, ICT/Data Center supply chain
THESIS: 70%+ LMM owners 55+ (succession wave) | $250B+ data center capex through 2030
RETURNS: 25-30% target IRR | 3-4x MOIC | 6yr hold
TAGLINE: CLARITY. CRAFT. CAPITAL.

MASTER DECK SLIDES (20): Cover, Table of Contents, Who We Are, Sourcing, Market Opportunity,
Deal Flow Funnel, Underwriting Discipline, Value Creation Playbook, Returns Waterfall,
Why Now/Why Us, IS Legal Structure, IS Model Economics, Fund I Economics, Team/Roadmap, Closing

APPENDIX DECK SLIDES (18): Appendix Cover, IS Legal Structure Detail, IS Model Economics Overview,
Fund I Model Economics, Team Evolution Roadmap, Active Pipeline Q1 2026, Deal Flow Analytics,
Data Center Thesis Deep Dive, Succession Wave Market Data, LMM Sector Focus, Advanced Mfg Target,
Engineered Materials Target, Precision Components Target, Proprietary Database (1700+ owners),
Brian Steel Bio, Mike Fuller Bio, Ars Bellica Advisors, Disclaimer

AUDIENCE: ${audience} | TONE: ${tone}

Return ONLY valid JSON — no markdown, no backticks:
{
  "title": "string",
  "subtitle": "string",
  "slides": [
    {"type":"cover","title":"...","subtitle":"...","audience_line":"..."},
    {"type":"toc","items":["..."]},
    {"type":"content","title":"TITLE","bullets":["...","...","...","..."],"callout":"key stat"},
    {"type":"data","title":"TITLE","metrics":[{"label":"...","value":"...","desc":"..."}],"note":"source"},
    {"type":"twocol","title":"TITLE","left_heading":"...","left_bullets":["..."],"right_heading":"...","right_bullets":["..."]},
    {"type":"appendix_cover"},
    {"type":"appendix","title":"APPENDIX SLIDE TITLE","bullets":["..."],"callout":"..."},
    {"type":"closing","title":"...","body":"..."}
  ]
}
RULES: 10-16 slides | max 4 bullets per slide | specific data always | operator voice
Include relevant appendix slides for the audience (LPs get Fund Economics, Team Bios, IS Structure; IBs get Pipeline, Deal Flow)`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({
      model:'claude-sonnet-4-20250514', max_tokens:5000, system:sys,
      messages:[{role:'user',content:`Create a complete institutional investor presentation.
Topic: ${topic}
Audience: ${audience}
Context: ${brief||'Standard Catskill Partners LP overview'}
Tone: ${tone}
Generate 12-14 slides. Include real firm data throughout. Add relevant appendix slides at the end.`}]
    })
  });
  const d = await res.json();
  const raw=(d.content?.[0]?.text||'').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  try{return JSON.parse(raw);}catch(e){return fallback(topic);}
}

function fallback(topic){
  return{title:topic||'Catskill Partners LP',subtitle:'Operator-Led PE | LMM Industrial Manufacturing',slides:[
    {type:'cover',title:topic||'Catskill Partners LP',subtitle:'Operator-Led Private Equity | Lower-Middle Market Industrial Manufacturing',audience_line:'Investor Overview'},
    {type:'content',title:'FIRM AT A GLANCE',bullets:['Independent Sponsor transitioning to $250M Fund I — 18-24 months','Brian Steel (CEO/operator, Tenere/Cadrex) + Mike Fuller (PE investor) — 20+ years combined experience','Targeting founder-owned industrial manufacturers: $2-20M EBITDA, $25-150M EV, North America','Data center supply chain specialization: ICT, power distribution, precision components'],callout:'$250M Fund I\n6-8 Platforms\n25-30% IRR'},
    {type:'data',title:'THE MARKET OPPORTUNITY',metrics:[{label:'LMM Owners 55+',value:'70%+',desc:'Succession wave — motivated sellers'},{label:'Data Center Spend',value:'$250B+',desc:'Global capex through 2030'},{label:'Target IRR',value:'25-30%',desc:'Gross Fund I target'},{label:'Target MOIC',value:'3-4x',desc:'Gross return multiple'}],note:'McKinsey, Goldman Sachs, Blackstone 2025'},
    {type:'twocol',title:'WHY NOW. WHY CATSKILL.',left_heading:'WHY NOW',left_bullets:['70%+ LMM industrial owners are 55+','Data center capex supercycle: $250B+ through 2030','Supply chain reshoring accelerating','Trade buyers consolidating — sellers prefer operators'],right_heading:'WHY US',right_bullets:['CEO-level industrial operating experience','ICT domain sourcing expertise — proprietary database','Full-potential underwriting: 300bps EBITDA expansion','1,700+ owner database — proactive origination']},
    {type:'content',title:'VALUE CREATION PLAYBOOK',bullets:['Strategic repositioning into data center supply chain — multiple expansion','Commercial & pricing discipline — 300bps+ EBITDA margin improvement','Operational execution — lean systems, working capital optimization','Add-on acquisition program — 25% fund reserve for bolt-ons'],callout:'300bps\nAvg EBITDA\nExpansion'},
    {type:'closing',title:"LET'S BUILD ENDURING VALUE TOGETHER",body:'We partner with management teams, investors, and strategic operators who share our belief in clarity, craft, and stewardship of capital.'}
  ]};
}

function foot(s,n){
  s.addShape('rect',{x:0,y:H-0.38,w:W,h:0.38,fill:{color:B.primary},line:{color:B.primary}});
  s.addText('Catskill Partners 2026 - CONFIDENTIAL',{x:0.35,y:H-0.35,w:W-1.4,h:0.3,fontSize:7,color:B.light,fontFace:B.font,align:'left',valign:'middle'});
  if(n) s.addText(String(n),{x:W-0.7,y:H-0.35,w:0.5,h:0.3,fontSize:7,color:B.light,fontFace:B.font,align:'right',valign:'middle'});
}

function tBar(s,t){
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  s.addShape('rect',{x:0,y:0,w:W,h:1.3,fill:{color:B.white},line:{color:B.white}});
  s.addText(t.toUpperCase(),{x:0.35,y:0.18,w:W-0.7,h:0.8,fontSize:21,color:B.primary,fontFace:B.font,bold:true,align:'left',valign:'middle'});
  s.addShape('rect',{x:0.35,y:1.22,w:W-0.7,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
}

function bCover(p,sl){
  const s=p.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.dark},line:{color:B.dark}});
  s.addShape('rect',{x:0,y:0,w:0.08,h:H,fill:{color:B.accent},line:{color:B.accent}});
  s.addShape('rect',{x:0,y:H-1.1,w:W,h:1.1,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0,y:H-1.15,w:W,h:0.05,fill:{color:B.accent},line:{color:B.accent}});
  s.addText('CLARITY. CRAFT. CAPITAL.',{x:0.5,y:0.45,w:W-1,h:0.45,fontSize:10,color:B.accent,fontFace:B.font,bold:true,align:'left',charSpacing:4});
  s.addText((sl.title||'CATSKILL PARTNERS LP').toUpperCase(),{x:0.5,y:1.2,w:W-1.5,h:1.7,fontSize:36,color:B.white,fontFace:B.font,bold:true,align:'left',valign:'middle',breakLine:true});
  s.addText(sl.subtitle||'Operator-Led Private Equity | Lower-Middle Market Manufacturing',{x:0.5,y:3.05,w:W-1.5,h:0.6,fontSize:14,color:B.light,fontFace:B.font,align:'left'});
  s.addShape('rect',{x:0.5,y:3.8,w:2.0,h:0.04,fill:{color:B.accent},line:{color:B.accent}});
  const dt=new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
  s.addText(dt,{x:0.5,y:4.05,w:4,h:0.35,fontSize:11,color:B.light,fontFace:B.font,align:'left'});
  s.addText(sl.audience_line||'Investor Overview',{x:0.5,y:H-0.92,w:5,h:0.5,fontSize:13,color:B.white,fontFace:B.font,bold:true,align:'left',valign:'middle'});
  s.addText('info@catskillpartners.com | www.catskillpartners.com',{x:0.5,y:H-1.55,w:W-1,h:0.3,fontSize:9,color:B.lgray,fontFace:B.font,align:'left'});
}

function bToc(p,sl,n){
  const s=p.addSlide();tBar(s,'TABLE OF CONTENTS');
  const items=sl.items||['Firm Overview','Market Opportunity','Strategy','Value Creation','Team','Fund Economics'];
  items.forEach((item,i)=>{
    const col=i<Math.ceil(items.length/2)?0:1;
    const row=col===0?i:i-Math.ceil(items.length/2);
    const x=col===0?0.5:W/2+0.3;
    const y=1.55+(row*0.72);
    s.addShape('rect',{x,y:y+0.08,w:0.32,h:0.32,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.04});
    s.addText(String(i+1),{x,y:y+0.08,w:0.32,h:0.32,fontSize:10,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle'});
    s.addText(item,{x:x+0.42,y,w:(W/2)-0.8,h:0.48,fontSize:12,color:B.dgray,fontFace:B.font,align:'left',valign:'middle'});
  });
  foot(s,n);
}

function bContent(p,sl,n){
  const s=p.addSlide();tBar(s,sl.title||'OVERVIEW');
  const hc=!!sl.callout;
  const bw=hc?W-5.0:W-0.9;
  if(hc){
    s.addShape('rect',{x:W-4.4,y:1.4,w:4.0,h:H-2.2,fill:{color:B.light},line:{color:B.accent,pt:1.5},rectRadius:0.1});
    s.addShape('rect',{x:W-4.4,y:1.4,w:4.0,h:0.07,fill:{color:B.primary},line:{color:B.primary}});
    s.addText('KEY INSIGHT',{x:W-4.3,y:1.52,w:3.8,h:0.3,fontSize:8,color:B.primary,fontFace:B.font,bold:true,charSpacing:2,align:'center'});
    s.addText(sl.callout,{x:W-4.3,y:2.0,w:3.8,h:H-3.6,fontSize:17,color:B.primary,fontFace:B.font,bold:true,align:'center',valign:'middle',breakLine:true});
  }
  (sl.bullets||[]).slice(0,4).forEach((b,i)=>{
    const y=1.48+(i*0.82);
    s.addShape('rect',{x:0.35,y:y+0.22,w:0.14,h:0.14,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.07});
    s.addText(b,{x:0.62,y,w:bw-0.3,h:0.68,fontSize:13,color:B.mgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  foot(s,n);
}

function bData(p,sl,n){
  const s=p.addSlide();tBar(s,sl.title||'KEY METRICS');
  const metrics=(sl.metrics||[]).slice(0,4);
  const cols=Math.min(metrics.length,4);
  const cw=(W-0.7)/cols;
  metrics.forEach((m,i)=>{
    const x=0.35+(i*cw);
    const bg=i%2===0?B.light:B.white;
    s.addShape('rect',{x,y:1.45,w:cw-0.15,h:H-2.25,fill:{color:bg},line:{color:B.accent,pt:1.2},rectRadius:0.1});
    s.addShape('rect',{x,y:1.45,w:cw-0.15,h:0.07,fill:{color:B.primary},line:{color:B.primary}});
    s.addText(m.value||'',{x:x+0.1,y:1.85,w:cw-0.35,h:1.15,fontSize:40,color:B.primary,fontFace:B.font,bold:true,align:'center',valign:'middle'});
    s.addText((m.label||'').toUpperCase(),{x:x+0.1,y:3.1,w:cw-0.35,h:0.45,fontSize:10,color:B.forest,fontFace:B.font,bold:true,align:'center',charSpacing:1});
    if(m.desc) s.addText(m.desc,{x:x+0.1,y:3.62,w:cw-0.35,h:0.85,fontSize:10,color:B.mgray,fontFace:B.font,align:'center',valign:'top',breakLine:true});
  });
  if(sl.note) s.addText('Source: '+sl.note,{x:0.4,y:H-0.65,w:W-0.8,h:0.25,fontSize:8,color:B.lgray,fontFace:B.font,italic:true,align:'left'});
  foot(s,n);
}

function bTwoCol(p,sl,n){
  const s=p.addSlide();tBar(s,sl.title||'OVERVIEW');
  const hw=(W-0.7)/2;
  s.addShape('rect',{x:0.35,y:1.45,w:hw-0.15,h:H-2.2,fill:{color:B.primary},line:{color:B.primary},rectRadius:0.08});
  s.addText((sl.left_heading||'').toUpperCase(),{x:0.5,y:1.55,w:hw-0.4,h:0.45,fontSize:10,color:B.accent,fontFace:B.font,bold:true,charSpacing:2,align:'left'});
  s.addShape('rect',{x:0.5,y:2.05,w:hw-0.55,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  (sl.left_bullets||[]).slice(0,4).forEach((b,i)=>{
    const y=2.18+(i*0.78);
    s.addShape('rect',{x:0.52,y:y+0.2,w:0.12,h:0.12,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.06});
    s.addText(b,{x:0.76,y,w:hw-0.85,h:0.65,fontSize:12,color:B.white,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  const rx=hw+0.5;
  s.addShape('rect',{x:rx,y:1.45,w:hw-0.15,h:H-2.2,fill:{color:B.light},line:{color:B.accent,pt:1},rectRadius:0.08});
  s.addText((sl.right_heading||'').toUpperCase(),{x:rx+0.15,y:1.55,w:hw-0.4,h:0.45,fontSize:10,color:B.primary,fontFace:B.font,bold:true,charSpacing:2,align:'left'});
  s.addShape('rect',{x:rx+0.15,y:2.05,w:hw-0.55,h:0.03,fill:{color:B.primary},line:{color:B.primary}});
  (sl.right_bullets||[]).slice(0,4).forEach((b,i)=>{
    const y=2.18+(i*0.78);
    s.addShape('rect',{x:rx+0.17,y:y+0.2,w:0.12,h:0.12,fill:{color:B.primary},line:{color:B.primary},rectRadius:0.06});
    s.addText(b,{x:rx+0.4,y,w:hw-0.7,h:0.65,fontSize:12,color:B.dgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  foot(s,n);
}

function bAppendixCover(p){
  const s=p.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.dark},line:{color:B.dark}});
  s.addShape('rect',{x:0,y:H-1.1,w:W,h:1.1,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0,y:H-1.15,w:W,h:0.05,fill:{color:B.accent},line:{color:B.accent}});
  s.addText('APPENDIX SLIDES',{x:0.6,y:2.8,w:W-1.2,h:1.2,fontSize:42,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle',charSpacing:3});
  s.addText('Catskill Partners 2026 - CONFIDENTIAL',{x:W-5.5,y:H-0.85,w:5.2,h:0.35,fontSize:9,color:B.accent,fontFace:B.font,align:'right'});
}

function bAppendix(p,sl,n){
  // Generic appendix slide with left green strip indicator
  const s=p.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  s.addShape('rect',{x:0,y:0,w:0.22,h:H,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0.22,y:0,w:W-0.22,h:1.3,fill:{color:B.white},line:{color:B.white}});
  s.addText('APPENDIX',{x:0.3,y:0.12,w:2.0,h:0.32,fontSize:7.5,color:B.accent,fontFace:B.font,bold:true,charSpacing:2});
  s.addText((sl.title||'').toUpperCase(),{x:0.3,y:0.2,w:W-0.55,h:0.8,fontSize:19,color:B.primary,fontFace:B.font,bold:true,align:'left',valign:'middle'});
  s.addShape('rect',{x:0.3,y:1.1,w:W-0.5,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  const hc=!!sl.callout;
  const bw=hc?W-5.0:W-0.85;
  if(hc){
    s.addShape('rect',{x:W-4.4,y:1.4,w:4.0,h:H-2.2,fill:{color:B.light},line:{color:B.accent,pt:1.5},rectRadius:0.1});
    s.addText(sl.callout,{x:W-4.3,y:2.1,w:3.8,h:H-3.7,fontSize:16,color:B.primary,fontFace:B.font,bold:true,align:'center',valign:'middle',breakLine:true});
  }
  (sl.bullets||[]).slice(0,4).forEach((b,i)=>{
    const y=1.48+(i*0.82);
    s.addShape('rect',{x:0.35,y:y+0.22,w:0.14,h:0.14,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.07});
    s.addText(b,{x:0.62,y,w:bw-0.3,h:0.68,fontSize:13,color:B.mgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  foot(s,n);
}

function bClosing(p,sl){
  const s=p.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.dark},line:{color:B.dark}});
  s.addShape('rect',{x:0,y:0,w:0.08,h:H,fill:{color:B.accent},line:{color:B.accent}});
  s.addShape('rect',{x:0,y:H-1.1,w:W,h:1.1,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0,y:H-1.15,w:W,h:0.05,fill:{color:B.accent},line:{color:B.accent}});
  s.addText((sl.title||"LET'S BUILD ENDURING VALUE TOGETHER").toUpperCase(),{x:0.8,y:1.3,w:W-1.6,h:1.5,fontSize:30,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle',breakLine:true});
  if(sl.body) s.addText(sl.body,{x:1.2,y:3.0,w:W-2.4,h:1.1,fontSize:13,color:B.light,fontFace:B.font,align:'center',valign:'middle',breakLine:true});
  s.addText('info@catskillpartners.com  |  www.catskillpartners.com',{x:0.6,y:H-0.92,w:W-1.2,h:0.35,fontSize:10,color:B.lgray,fontFace:B.font,align:'center'});
  s.addText('CLARITY. CRAFT. CAPITAL.',{x:0.6,y:H-0.52,w:W-1.2,h:0.32,fontSize:10,color:B.accent,fontFace:B.font,bold:true,align:'center',charSpacing:4});
}

function build(deck){
  const p=new PptxGenJS();
  p.defineLayout({name:'WIDESCREEN',width:W,height:H});
  p.layout='WIDESCREEN';
  let n=1;
  for(const sl of deck.slides){
    if     (sl.type==='cover')         bCover(p,sl);
    else if(sl.type==='toc')           bToc(p,sl,n++);
    else if(sl.type==='data')          bData(p,sl,n++);
    else if(sl.type==='twocol')        bTwoCol(p,sl,n++);
    else if(sl.type==='appendix_cover')bAppendixCover(p);
    else if(sl.type==='appendix')      bAppendix(p,sl,n++);
    else if(sl.type==='closing')       bClosing(p,sl);
    else                               bContent(p,sl,n++);
  }
  return p;
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey) return res.status(500).json({error:'API key not configured'});
  try{
    const {topic,audience,brief,tone}=req.body;
    const deck=await genContent(
      topic||'Catskill Partners Overview',
      audience||'Investment Bankers and Capital Allocators',
      brief||'',
      tone||'Institutional (rigorous, data-forward)',
      apiKey
    );
    const pptx=build(deck);
    const base64=await pptx.write({outputType:'base64'});
    const name='Catskill-Partners-'+(topic||'Overview').replace(/[^a-zA-Z0-9]/g,'-').substring(0,40)+'-'+Date.now()+'.pptx';
    res.status(200).json({success:true,filename:name,base64,slideCount:deck.slides?.length||0,title:deck.title});
  }catch(err){
    console.error('PPTX error:',err);
    res.status(500).json({error:'Failed to generate presentation',detail:err.message});
  }
}