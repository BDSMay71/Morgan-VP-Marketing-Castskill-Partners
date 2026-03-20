import PptxGenJS from 'pptxgenjs';

// ================================================================
// CATSKILL PARTNERS — LOCKED BRAND STANDARDS
// Baseline deck: Investor Overview Summary_MAR_Presentment_3.17.2026
// OneDrive: https://1drv.ms/p/c/18334eea8b635807/IQBVzUUSUQD2TZk1i2t9eDXdAYJ1aL_99XbNdYGjfLQgkSE
//
// Colors extracted from deck theme XML (ppt/theme/theme1.xml):
//   #1A4C3D — Deep Forest Green (PRIMARY — titles, headers, cover bg)
//   #2D6A4F — Forest Green (secondary elements, accents)
//   #41AC48 — Bright Accent Green (CTAs, highlights, data callouts)
//   #1B4D3E — Cover/section background
//   #EDF7F2 — Light green tint (card backgrounds, alternating rows)
//   #F9F9F7 — Off-white (slide background)
//   #C8C8C3 — Light gray (footer text, captions)
//   #2C2C2C — Dark gray (body text)
//   #FFFFFF — White
//
// NEVER USE: #132240 (navy), #B8962E (gold) — NOT Catskill brand
// ================================================================
const B = {
  primary:  '1A4C3D',
  forest:   '2D6A4F',
  accent:   '41AC48',
  dark:     '1B4D3E',
  light:    'EDF7F2',
  off:      'F9F9F7',
  lgray:    'C8C8C3',
  mgray:    '4a4a4a',
  dgray:    '2C2C2C',
  white:    'FFFFFF',
  black:    '000000',
  font:     'Inter',
};
const W = 13.33, H = 7.5;

// ================================================================
// CLAUDE CONTENT GENERATION
// Morgan calls claude-sonnet-4 with full Catskill context to
// generate all slide content — no static templates
// ================================================================
async function generateContent(topic, audience, brief, tone, apiKey) {
  const sys = `You are Morgan Cole, VP of Marketing at Catskill Partners LP.

CATSKILL PARTNERS FACTS:
- Operator-led PE firm: Brian Steel (CEO/operator, Tenere/Cadrex) + Mike Fuller (PE investor/operator)
- Fund I: $250M target, 6-8 platform companies, $2-20M EBITDA, $25-150M EV, North America
- Sectors: Advanced Manufacturing, Engineered Materials, Precision Components, ICT/Data Center supply chain
- Market thesis: 70%+ LMM owners 55+ (succession wave), $250B+ data center capex through 2030
- Strategy: proactive sourcing, full-potential underwriting, operator credibility, data center domain expertise
- Returns: 25-30% target IRR, 3-4x MOIC, 6-year average holds
- Structure: Independent Sponsor (current) transitioning to Fund I in 18-24 months
- Current portfolio: Project Anchor (Lake Shore Electric — industrial power solutions platform)
- Tagline: CLARITY. CRAFT. CAPITAL.

SLIDE STRUCTURE BASED ON BASELINE DECK (20 slides):
Cover -> Table of Contents -> Who We Are -> Sourcing Strategy -> Market Opportunity (Succession Wave) ->
Deal Flow/Pipeline -> Underwriting Discipline -> Value Creation Playbook -> Returns Waterfall ->
Why Now/Why Us -> Fund Structure (IS Model) -> Fund I Economics -> Team/Timeline -> Closing

OUTPUT: Return ONLY valid JSON, no markdown, no backticks.
Schema:
{
  "title": "string",
  "subtitle": "string",
  "audience": "string",
  "slides": [
    { "type": "cover", "title": "string", "subtitle": "string", "audience_line": "string" },
    { "type": "toc", "items": ["Section 1", "Section 2"] },
    { "type": "content", "title": "SLIDE TITLE", "bullets": ["specific bullet 1", "bullet 2", "bullet 3", "bullet 4"], "callout": "key stat or data point" },
    { "type": "data", "title": "SLIDE TITLE", "metrics": [{"label":"...", "value":"...", "desc":"..."}], "note": "source" },
    { "type": "twocol", "title": "SLIDE TITLE", "left_heading": "...", "left_bullets": ["..."], "right_heading": "...", "right_bullets": ["..."] },
    { "type": "closing", "title": "...", "body": "..." }
  ]
}

RULES:
- 10-14 slides total
- Max 4 bullets per slide — specific, data-backed, no vague language
- Use real numbers: 70%+, $250B+, 25-30% IRR, $2-20M EBITDA, etc.
- Operator voice: direct, credible, institutional
- Every closing: "info@catskillpartners.com | www.catskillpartners.com"
- Audience: ${audience}
- Tone: ${tone}`;

  const prompt = `Generate a complete institutional investor presentation.
Topic: ${topic}
Audience: ${audience}
Context: ${brief || 'Standard Catskill Partners LP overview for investment banks and capital allocators'}
Tone: ${tone}

Build a full 12-slide deck matching the Catskill Partners investor overview structure. Include real firm data throughout.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5000, system: sys, messages: [{ role: 'user', content: prompt }] }),
  });
  const d = await res.json();
  const raw = (d.content?.[0]?.text || '').replace(/\`\`\`json\n?/g,'').replace(/\`\`\`\n?/g,'').trim();
  try { return JSON.parse(raw); } catch(e) { return fallback(topic, audience); }
}

function fallback(topic, audience) {
  return { title: topic||'Catskill Partners LP', subtitle:'Operator-Led Private Equity | Lower-Middle Market Industrial Manufacturing', audience: audience||'', slides:[
    {type:'cover',title:topic||'Catskill Partners LP',subtitle:'Operator-Led Private Equity | Lower-Middle Market Industrial Manufacturing',audience_line:audience||'Investor Overview'},
    {type:'content',title:'FIRM AT A GLANCE',bullets:['Independent Sponsor (current) transitioning to $250M Fund I — 18-24 months','Brian Steel (CEO/operator, Tenere/Cadrex) + Mike Fuller (PE investor/operator) — 20+ years combined experience','Target: founder-owned industrial manufacturers, $2-20M EBITDA, $25-150M EV, North America','Data center supply chain specialization: ICT infrastructure, power distribution, precision components'],callout:'$250M Fund I\n6-8 Platforms\n25-30% IRR Target'},
    {type:'data',title:'THE MARKET OPPORTUNITY',metrics:[{label:'LMM Owners 55+',value:'70%+',desc:'Succession wave creating motivated, off-market sellers'},{label:'Data Center Spend',value:'$250B+',desc:'Global capex through 2030 driving industrial demand'},{label:'Target IRR',value:'25-30%',desc:'Fund I gross return target'},{label:'Target MOIC',value:'3-4x',desc:'Gross return multiple over 6-year hold'}],note:'McKinsey 2025, Goldman Sachs Power Report, Blackstone infrastructure thesis'},
    {type:'twocol',title:'WHY NOW. WHY CATSKILL.',left_heading:'WHY NOW — STRUCTURAL FORCES',left_bullets:['Succession wave: 70%+ of LMM industrial owners are 55+','Data center demand supercycle: $250B+ capex through 2030','Supply chain reshoring accelerating post-COVID','Trade buyers consolidating — sellers prefer operators'],right_heading:'WHY US — FOUR COMPOUNDING EDGES',right_bullets:['Operator credibility: CEO-level industrial operating experience','ICT domain expertise: proprietary data center supply chain sourcing','Full-potential underwriting: 300bps EBITDA expansion pre-close','Proactive origination: 1,700+ proprietary owner database']},
    {type:'content',title:'VALUE CREATION PLAYBOOK',bullets:['Strategic repositioning into data center supply chain — premium multiple expansion','Commercial & pricing discipline — 300bps+ EBITDA margin improvement','Operational execution — lean systems, working capital optimization','Add-on acquisition program — 25% of fund reserved for bolt-on platforms'],callout:'300bps\nAvg EBITDA\nExpansion'},
    {type:'closing',title:"LET'S BUILD ENDURING VALUE TOGETHER",body:'We partner with management teams, investors, and strategic operators who share our belief in clarity, craft, and stewardship of capital.'},
  ]};
}

// ================================================================
// SLIDE BUILDERS — Match exact Catskill baseline deck design
// ================================================================

function footer(s, n) {
  s.addShape('rect',{x:0,y:H-0.38,w:W,h:0.38,fill:{color:B.primary},line:{color:B.primary}});
  s.addText('Catskill Partners 2026 - CONFIDENTIAL',{x:0.35,y:H-0.35,w:W-1.4,h:0.3,fontSize:7,color:B.lgray,fontFace:B.font,align:'left',valign:'middle'});
  if(n) s.addText(String(n),{x:W-0.7,y:H-0.35,w:0.5,h:0.3,fontSize:7,color:B.lgray,fontFace:B.font,align:'right',valign:'middle'});
}

function titleBlock(s, title) {
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  s.addShape('rect',{x:0,y:0,w:W,h:1.3,fill:{color:B.white},line:{color:B.white}});
  s.addShape('rect',{x:0.35,y:1.22,w:W-0.7,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  s.addText(title.toUpperCase(),{x:0.35,y:0.18,w:W-0.7,h:0.8,fontSize:21,color:B.primary,fontFace:B.font,bold:true,align:'left',valign:'middle'});
}

// COVER — full-bleed dark with mountain imagery feel
function buildCover(pptx, sl) {
  const s = pptx.addSlide();
  // Dark green gradient feel
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.dark},line:{color:B.dark}});
  // Bottom accent band (matches real deck)
  s.addShape('rect',{x:0,y:H-1.1,w:W,h:1.1,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0,y:H-1.15,w:W,h:0.05,fill:{color:B.accent},line:{color:B.accent}});
  // Main headline
  s.addText('CLARITY. CRAFT. CAPITAL.',{x:0.6,y:0.55,w:W-1.2,h:0.55,fontSize:28,color:B.white,fontFace:B.font,bold:true,align:'center',charSpacing:4});
  s.addText('We are operators first.',{x:0.6,y:1.25,w:W-1.2,h:0.5,fontSize:16,color:B.light,fontFace:B.font,bold:true,align:'center'});
  s.addText('With deep private equity fluency, we bring clarity of vision, executional rigor, and disciplined stewardship to every investment.',{x:1.2,y:1.9,w:W-2.4,h:0.7,fontSize:12,color:B.light,fontFace:B.font,align:'center',valign:'middle',breakLine:true});
  // Audience/title line bottom
  s.addText((sl.audience_line||sl.title||'Investor Overview').toUpperCase(),{x:0.6,y:H-0.95,w:5,h:0.55,fontSize:14,color:B.white,fontFace:B.font,bold:true,align:'left',valign:'middle'});
  s.addText('Catskill Partners 2026 - CONFIDENTIAL',{x:W-5.5,y:H-0.85,w:5.2,h:0.35,fontSize:9,color:B.accent,fontFace:B.font,align:'right',valign:'middle'});
  // Slide number (1 = cover)
  s.addText('1',{x:W-0.7,y:H-0.5,w:0.4,h:0.3,fontSize:9,color:B.lgray,fontFace:B.font,align:'right',valign:'middle'});
}

// TABLE OF CONTENTS
function buildToc(pptx, sl, n) {
  const s = pptx.addSlide();
  titleBlock(s,'Table of Contents');
  const items = sl.items||['Catskill Partners Overview','Differentiated Investment Strategy','The Market Opportunity','Sourcing Strategy','Underwriting Discipline','Value Creation Playbook','Fund Structure & Economics','Team'];
  items.forEach((item,i)=>{
    const col = i<Math.ceil(items.length/2) ? 0 : 1;
    const row = col===0 ? i : i-Math.ceil(items.length/2);
    const x = col===0 ? 0.5 : W/2+0.3;
    const y = 1.5+(row*0.72);
    s.addShape('rect',{x,y:y+0.08,w:0.32,h:0.32,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.04});
    s.addText(String(i+1),{x,y:y+0.08,w:0.32,h:0.32,fontSize:10,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle'});
    s.addText(item,{x:x+0.42,y,w:(W/2)-0.8,h:0.48,fontSize:12,color:B.dgray,fontFace:B.font,align:'left',valign:'middle'});
  });
  footer(s,n);
}

// CONTENT slide with green accent bullets
function buildContent(pptx, sl, n) {
  const s = pptx.addSlide();
  titleBlock(s,sl.title||'OVERVIEW');
  const hasCallout = !!sl.callout;
  const bw = hasCallout ? W-5.0 : W-0.9;
  // Callout box right side
  if(hasCallout){
    s.addShape('rect',{x:W-4.4,y:1.4,w:4.0,h:H-2.2,fill:{color:B.light},line:{color:B.accent,pt:1.5},rectRadius:0.1});
    s.addShape('rect',{x:W-4.4,y:1.4,w:4.0,h:0.07,fill:{color:B.primary},line:{color:B.primary}});
    s.addText('KEY INSIGHT',{x:W-4.3,y:1.52,w:3.8,h:0.3,fontSize:8,color:B.primary,fontFace:B.font,bold:true,charSpacing:2,align:'center'});
    s.addText(sl.callout,{x:W-4.3,y:1.95,w:3.8,h:H-3.6,fontSize:17,color:B.primary,fontFace:B.font,bold:true,align:'center',valign:'middle',breakLine:true});
  }
  // Bullets with green dots
  (sl.bullets||[]).slice(0,4).forEach((b,i)=>{
    const y=1.45+(i*0.82);
    s.addShape('rect',{x:0.35,y:y+0.22,w:0.14,h:0.14,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.07});
    s.addText(b,{x:0.62,y,w:bw-0.3,h:0.68,fontSize:13,color:B.mgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  footer(s,n);
}

// DATA / METRICS slide — 4-metric card layout matching real deck
function buildData(pptx, sl, n) {
  const s = pptx.addSlide();
  titleBlock(s,sl.title||'KEY METRICS');
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
  footer(s,n);
}

// TWO-COLUMN slide (Why Now / Why Us — matching slide 6 of real deck)
function buildTwoCol(pptx, sl, n) {
  const s = pptx.addSlide();
  titleBlock(s,sl.title||'OVERVIEW');
  const hw=(W-0.7)/2;
  // Left column
  s.addShape('rect',{x:0.35,y:1.45,w:hw-0.15,h:H-2.2,fill:{color:B.primary},line:{color:B.primary},rectRadius:0.08});
  s.addText((sl.left_heading||'').toUpperCase(),{x:0.5,y:1.55,w:hw-0.4,h:0.45,fontSize:10,color:B.accent,fontFace:B.font,bold:true,charSpacing:2,align:'left'});
  s.addShape('rect',{x:0.5,y:2.05,w:hw-0.55,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  (sl.left_bullets||[]).slice(0,4).forEach((b,i)=>{
    const y=2.18+(i*0.78);
    s.addShape('rect',{x:0.52,y:y+0.2,w:0.12,h:0.12,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.06});
    s.addText(b,{x:0.76,y,w:hw-0.85,h:0.65,fontSize:12,color:B.white,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  // Right column
  const rx=hw+0.5;
  s.addShape('rect',{x:rx,y:1.45,w:hw-0.15,h:H-2.2,fill:{color:B.light},line:{color:B.accent,pt:1},rectRadius:0.08});
  s.addText((sl.right_heading||'').toUpperCase(),{x:rx+0.15,y:1.55,w:hw-0.4,h:0.45,fontSize:10,color:B.primary,fontFace:B.font,bold:true,charSpacing:2,align:'left'});
  s.addShape('rect',{x:rx+0.15,y:2.05,w:hw-0.55,h:0.03,fill:{color:B.primary},line:{color:B.primary}});
  (sl.right_bullets||[]).slice(0,4).forEach((b,i)=>{
    const y=2.18+(i*0.78);
    s.addShape('rect',{x:rx+0.17,y:y+0.2,w:0.12,h:0.12,fill:{color:B.primary},line:{color:B.primary},rectRadius:0.06});
    s.addText(b,{x:rx+0.4,y,w:hw-0.7,h:0.65,fontSize:12,color:B.dgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  footer(s,n);
}

// CLOSING — matches slide 7 of real deck (dark green, clean)
function buildClosing(pptx, sl) {
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.dark},line:{color:B.dark}});
  s.addShape('rect',{x:0,y:H-1.1,w:W,h:1.1,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0,y:H-1.15,w:W,h:0.05,fill:{color:B.accent},line:{color:B.accent}});
  s.addText((sl.title||"LET'S BUILD ENDURING VALUE TOGETHER").toUpperCase(),{x:0.8,y:1.4,w:W-1.6,h:1.5,fontSize:30,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle',breakLine:true});
  if(sl.body) s.addText(sl.body,{x:1.2,y:3.1,w:W-2.4,h:1.0,fontSize:13,color:B.light,fontFace:B.font,align:'center',valign:'middle',breakLine:true});
  s.addText('info@catskillpartners.com  |  www.catskillpartners.com',{x:0.6,y:H-0.95,w:W-1.2,h:0.35,fontSize:10,color:B.lgray,fontFace:B.font,align:'center'});
  s.addText('CLARITY. CRAFT. CAPITAL.',{x:0.6,y:H-0.55,w:W-1.2,h:0.32,fontSize:10,color:B.accent,fontFace:B.font,bold:true,align:'center',charSpacing:4});
}

function build(deck) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({name:'WIDESCREEN',width:W,height:H});
  pptx.layout='WIDESCREEN';
  let n=1;
  for(const sl of deck.slides){
    if     (sl.type==='cover')   { buildCover(pptx,sl); n++; }
    else if(sl.type==='toc')     { buildToc(pptx,sl,n++); }
    else if(sl.type==='data')    { buildData(pptx,sl,n++); }
    else if(sl.type==='twocol')  { buildTwoCol(pptx,sl,n++); }
    else if(sl.type==='closing') { buildClosing(pptx,sl); }
    else                         { buildContent(pptx,sl,n++); }
  }
  return pptx;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if(!apiKey) return res.status(500).json({error:'API key not configured'});
  try {
    const {topic,audience,brief,tone} = req.body;
    const deck = await generateContent(
      topic||'Catskill Partners Overview',
      audience||'Investment Bankers and Capital Allocators',
      brief||'',
      tone||'Institutional (rigorous, data-forward)',
      apiKey
    );
    const pptx = build(deck);
    const base64 = await pptx.write({outputType:'base64'});
    const name = 'Catskill-Partners-'+(topic||'Overview').replace(/[^a-zA-Z0-9]/g,'-').substring(0,40)+'-'+Date.now()+'.pptx';
    res.status(200).json({success:true,filename:name,base64,slideCount:deck.slides?.length||0,title:deck.title});
  } catch(err) {
    console.error('PPTX error:',err);
    res.status(500).json({error:'Failed to generate presentation',detail:err.message});
  }
}