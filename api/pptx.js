import PptxGenJS from 'pptxgenjs';

// ============================================================
// CATSKILL PARTNERS BRAND STANDARDS (LOCKED — NO NAVY/GOLD)
// Primary: #1a5c3a (deep green), #2D6A4F (forest), #41AD49 (accent)
// NEVER: #132240 (navy), #B8962E (gold) — NOT Catskill colors
// ============================================================
const B = {
  dark:    '1a5c3a',
  forest:  '2D6A4F',
  accent:  '41AD49',
  deep:    '0f3d28',
  light:   'EBF5EE',
  mid:     'f0f7f3',
  white:   'FFFFFF',
  off:     'F9F9F7',
  lgray:   'C8C8C3',
  mgray:   '4a4a4a',
  dgray:   '2C2C2C',
  font:    'Inter',
};
const W = 13.33, H = 7.5;

async function generateContent(topic, audience, brief, tone, apiKey) {
  const sys = `You are Morgan Cole, VP of Marketing at Catskill Partners LP — operator-led PE firm targeting founder-owned industrial manufacturers in the lower-middle market.

FIRM FACTS:
- Brian Steel (CEO/operator, Tenere/Cadrex) + Mike Fuller (PE investor/operator)
- Fund I: $250M target, 6-8 platforms, $2-20M EBITDA, $25-150M EV, North America
- Sectors: Advanced Mfg, Engineered Materials, Precision Components, ICT/Data Center supply chain
- Thesis: 70%+ LMM owners 55+ (succession wave), $250B+ data center spend through 2030
- Returns: 25-30% target IRR, 3-4x MOIC
- Audience: ${audience}
- Tone: ${tone}

OUTPUT RULES:
- Return VALID JSON ONLY — no markdown, no backticks, no preamble
- 8-12 slides total
- Max 4 bullets per content slide — specific, data-backed
- Never use vague language
- Always: specific numbers, operator credibility, institutional framing
- Footer on every slide: "Catskill Partners LP | Confidential"
- Slide structure: cover, agenda, content (thesis), data (market), content (strategy), content (team), data (returns), content (value creation), data (pipeline), closing

JSON schema:
{
  "title": "string",
  "subtitle": "string", 
  "slides": [
    {"type":"cover","title":"...","subtitle":"..."},
    {"type":"agenda","items":["item1","item2"]},
    {"type":"content","title":"TITLE","bullets":["..."],"callout":"key stat"},
    {"type":"data","title":"TITLE","metrics":[{"label":"...","value":"...","desc":"..."}],"note":"source"},
    {"type":"closing","title":"...","body":"..."}
  ]
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: sys,
      messages: [{ role: 'user', content: `Create a complete institutional investor presentation.
Topic: ${topic}
Audience: ${audience}
Brief: ${brief || 'Standard Catskill Partners overview'}
Tone: ${tone}
Generate 10 slides with specific data and operator-credibility framing throughout.` }],
    }),
  });
  const d = await res.json();
  const txt = (d.content?.[0]?.text || '').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  try { return JSON.parse(txt); } catch(e) { return fallback(topic); }
}

function fallback(topic) {
  return {
    title: topic || 'Catskill Partners LP',
    subtitle: 'Operator-Led Private Equity | Lower-Middle Market Manufacturing',
    slides: [
      { type: 'cover', title: topic || 'Catskill Partners LP', subtitle: 'Operator-Led Private Equity | Lower-Middle Market Industrial Manufacturing' },
      { type: 'content', title: 'FIRM OVERVIEW', bullets: ['Independent Sponsor transitioning to Fund I — $250M target raise', 'Brian Steel (CEO/operator) + Mike Fuller (PE investor) — 20+ years combined experience', 'Targeting founder-owned industrial manufacturers: $2-20M EBITDA, $25-150M EV', 'Data center supply chain specialization: ICT, power, precision components'], callout: '$250M Fund I\n6-8 Platforms\n25-30% Target IRR' },
      { type: 'data', title: 'MARKET OPPORTUNITY', metrics: [{ label: 'LMM Owners 55+', value: '70%+', desc: 'Succession wave creating motivated sellers' }, { label: 'Data Center Spend', value: '$250B+', desc: 'Global through 2030' }, { label: 'Target IRR', value: '25-30%', desc: 'Fund I gross return target' }, { label: 'Target MOIC', value: '3-4x', desc: 'Gross return multiple' }], note: 'McKinsey, Goldman Sachs, Blackstone infrastructure thesis 2025' },
      { type: 'closing', title: "LET'S BUILD ENDURING VALUE TOGETHER", body: 'We partner with management teams, investors, and strategic operators who share our belief in clarity, craft, and stewardship of capital.' },
    ],
  };
}

function footer(s, n) {
  s.addShape('rect', { x:0, y:H-0.35, w:W, h:0.35, fill:{color:B.dark}, line:{color:B.dark} });
  s.addText('Catskill Partners LP  |  Confidential', { x:0.3, y:H-0.32, w:W-1.2, h:0.28, fontSize:7, color:B.light, fontFace:B.font, align:'left', valign:'middle' });
  if (n) s.addText(String(n), { x:W-0.6, y:H-0.32, w:0.4, h:0.28, fontSize:7, color:B.light, fontFace:B.font, align:'right', valign:'middle' });
}

function titleBar(s, title) {
  s.addShape('rect', { x:0, y:0, w:W, h:1.35, fill:{color:B.off}, line:{color:B.off} });
  s.addShape('rect', { x:0, y:0, w:0.08, h:H, fill:{color:B.dark}, line:{color:B.dark} });
  s.addText(title.toUpperCase(), { x:0.3, y:0.2, w:W-0.6, h:0.75, fontSize:20, color:B.dark, fontFace:B.font, bold:true, align:'left', valign:'middle' });
  s.addShape('rect', { x:0.3, y:1.1, w:W-0.6, h:0.03, fill:{color:B.accent}, line:{color:B.accent} });
}

function cover(pptx, sl) {
  const s = pptx.addSlide();
  s.addShape('rect', { x:0, y:0, w:W, h:H, fill:{color:B.dark}, line:{color:B.dark} });
  s.addShape('rect', { x:0, y:0, w:0.08, h:H, fill:{color:B.accent}, line:{color:B.accent} });
  s.addShape('rect', { x:0, y:H-1.8, w:W, h:0.04, fill:{color:B.accent}, line:{color:B.accent} });
  s.addText('CLARITY. CRAFT. CAPITAL.', { x:0.5, y:0.45, w:W-1, h:0.4, fontSize:9, color:B.accent, fontFace:B.font, bold:true, align:'left', charSpacing:3 });
  s.addText((sl.title||'CATSKILL PARTNERS LP').toUpperCase(), { x:0.5, y:1.3, w:W-1.5, h:1.7, fontSize:36, color:B.white, fontFace:B.font, bold:true, align:'left', valign:'middle', breakLine:true });
  s.addText(sl.subtitle||'Operator-Led Private Equity | Lower-Middle Market Manufacturing', { x:0.5, y:3.1, w:W-1.5, h:0.6, fontSize:14, color:B.light, fontFace:B.font, align:'left' });
  s.addShape('rect', { x:0.5, y:3.85, w:2.0, h:0.04, fill:{color:B.accent}, line:{color:B.accent} });
  const dt = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
  s.addText(dt, { x:0.5, y:4.1, w:4, h:0.35, fontSize:11, color:B.light, fontFace:B.font, align:'left' });
  s.addText('info@catskillpartners.com  |  www.catskillpartners.com', { x:0.5, y:H-1.6, w:W-1, h:0.35, fontSize:10, color:B.lgray, fontFace:B.font, align:'left' });
  s.addText('CONFIDENTIAL - NOT FOR DISTRIBUTION', { x:0.5, y:H-1.2, w:W-1, h:0.3, fontSize:8, color:B.lgray, fontFace:B.font, align:'left', charSpacing:1 });
}

function section(pptx, sl) {
  const s = pptx.addSlide();
  s.addShape('rect', { x:0, y:0, w:W, h:H, fill:{color:B.forest}, line:{color:B.forest} });
  s.addShape('rect', { x:0, y:0, w:0.08, h:H, fill:{color:B.accent}, line:{color:B.accent} });
  s.addText('SECTION', { x:0.5, y:2.5, w:W-1, h:0.4, fontSize:10, color:B.accent, fontFace:B.font, bold:true, align:'left', charSpacing:4 });
  s.addText((sl.title||'').toUpperCase(), { x:0.5, y:3.0, w:W-1, h:1.0, fontSize:32, color:B.white, fontFace:B.font, bold:true, align:'left' });
  if (sl.subtitle) s.addText(sl.subtitle, { x:0.5, y:4.1, w:W-1, h:0.4, fontSize:14, color:B.light, fontFace:B.font, align:'left' });
  footer(s);
}

function agenda(pptx, sl) {
  const s = pptx.addSlide();
  s.addShape('rect', { x:0, y:0, w:W, h:H, fill:{color:B.white}, line:{color:B.white} });
  titleBar(s, 'AGENDA');
  const items = sl.items || ['Firm Overview','Market Opportunity','Investment Strategy','Value Creation','Team','Fund Economics'];
  items.forEach((item, i) => {
    const y = 1.65 + (i * 0.58);
    s.addShape('rect', { x:0.4, y:y+0.06, w:0.35, h:0.35, fill:{color:B.accent}, line:{color:B.accent}, rectRadius:0.04 });
    s.addText(String(i+1), { x:0.4, y:y+0.06, w:0.35, h:0.35, fontSize:11, color:B.white, fontFace:B.font, bold:true, align:'center', valign:'middle' });
    s.addText(item, { x:0.9, y:y, w:W-1.4, h:0.47, fontSize:14, color:B.dgray, fontFace:B.font, align:'left', valign:'middle' });
  });
  footer(s);
}

function content(pptx, sl, n) {
  const s = pptx.addSlide();
  s.addShape('rect', { x:0, y:0, w:W, h:H, fill:{color:B.white}, line:{color:B.white} });
  titleBar(s, sl.title||'OVERVIEW');
  const hasCallout = !!sl.callout;
  const cw = hasCallout ? W-5.2 : W-0.9;
  if (hasCallout) {
    s.addShape('rect', { x:W-4.6, y:1.5, w:4.2, h:H-2.2, fill:{color:B.light}, line:{color:B.accent, pt:1.5}, rectRadius:0.08 });
    s.addShape('rect', { x:W-4.6, y:1.5, w:4.2, h:0.06, fill:{color:B.accent}, line:{color:B.accent} });
    s.addText('KEY INSIGHT', { x:W-4.5, y:1.62, w:4.0, h:0.3, fontSize:8, color:B.dark, fontFace:B.font, bold:true, charSpacing:2, align:'center' });
    s.addText(sl.callout, { x:W-4.5, y:2.1, w:4.0, h:H-3.7, fontSize:16, color:B.dark, fontFace:B.font, bold:true, align:'center', valign:'middle', breakLine:true });
  }
  (sl.bullets||[]).slice(0,5).forEach((b,i) => {
    const y = 1.55 + (i*0.78);
    s.addShape('rect', { x:0.3, y:y+0.18, w:0.12, h:0.12, fill:{color:B.accent}, line:{color:B.accent}, rectRadius:0.06 });
    s.addText(b, { x:0.55, y:y, w:cw, h:0.65, fontSize:13, color:B.mgray, fontFace:B.font, align:'left', valign:'middle', breakLine:true });
  });
  footer(s, n);
}

function data(pptx, sl, n) {
  const s = pptx.addSlide();
  s.addShape('rect', { x:0, y:0, w:W, h:H, fill:{color:B.white}, line:{color:B.white} });
  titleBar(s, sl.title||'KEY METRICS');
  const metrics = (sl.metrics||[]).slice(0,4);
  const cols = Math.min(metrics.length, 4);
  const cw = (W-0.8)/cols;
  metrics.forEach((m,i) => {
    const x = 0.4 + (i*cw);
    const bg = i%2===0 ? B.light : B.off;
    s.addShape('rect', { x, y:1.55, w:cw-0.15, h:H-2.3, fill:{color:bg}, line:{color:B.accent, pt:1}, rectRadius:0.08 });
    s.addShape('rect', { x, y:1.55, w:cw-0.15, h:0.06, fill:{color:B.dark}, line:{color:B.dark} });
    s.addText(m.value||'', { x:x+0.1, y:2.0, w:cw-0.35, h:1.1, fontSize:38, color:B.dark, fontFace:B.font, bold:true, align:'center', valign:'middle' });
    s.addText((m.label||'').toUpperCase(), { x:x+0.1, y:3.15, w:cw-0.35, h:0.45, fontSize:11, color:B.forest, fontFace:B.font, bold:true, align:'center', charSpacing:1 });
    if (m.desc) s.addText(m.desc, { x:x+0.1, y:3.65, w:cw-0.35, h:0.8, fontSize:10, color:B.mgray, fontFace:B.font, align:'center', valign:'top', breakLine:true });
  });
  if (sl.note) s.addText('Source: '+sl.note, { x:0.4, y:H-0.7, w:W-0.8, h:0.3, fontSize:8, color:B.lgray, fontFace:B.font, italic:true, align:'left' });
  footer(s, n);
}

function closing(pptx, sl) {
  const s = pptx.addSlide();
  s.addShape('rect', { x:0, y:0, w:W, h:H, fill:{color:B.deep}, line:{color:B.deep} });
  s.addShape('rect', { x:0, y:0, w:0.08, h:H, fill:{color:B.accent}, line:{color:B.accent} });
  s.addShape('rect', { x:0, y:H-1.8, w:W, h:0.04, fill:{color:B.accent}, line:{color:B.accent} });
  s.addText((sl.title||"LET'S BUILD ENDURING VALUE TOGETHER").toUpperCase(), { x:0.5, y:1.2, w:W-1.0, h:1.4, fontSize:28, color:B.white, fontFace:B.font, bold:true, align:'left', valign:'middle', breakLine:true });
  if (sl.body) s.addText(sl.body, { x:0.5, y:2.8, w:W-2, h:1.0, fontSize:13, color:B.light, fontFace:B.font, align:'left', valign:'middle', breakLine:true });
  s.addText('info@catskillpartners.com  |  www.catskillpartners.com', { x:0.5, y:H-1.6, w:W-1, h:0.35, fontSize:11, color:B.lgray, fontFace:B.font, align:'left' });
  s.addText('CLARITY. CRAFT. CAPITAL.', { x:0.5, y:H-1.15, w:W-1, h:0.35, fontSize:11, color:B.accent, fontFace:B.font, bold:true, align:'left', charSpacing:3 });
}

function build(deckData) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name:'WIDESCREEN', width:W, height:H });
  pptx.layout = 'WIDESCREEN';
  let pageNum = 1;
  for (const sl of deckData.slides) {
    if      (sl.type==='cover')   cover(pptx, sl);
    else if (sl.type==='section') section(pptx, sl);
    else if (sl.type==='agenda')  agenda(pptx, sl);
    else if (sl.type==='data')    data(pptx, sl, pageNum++);
    else if (sl.type==='closing') closing(pptx, sl);
    else                          content(pptx, sl, pageNum++);
  }
  return pptx;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error:'API key not configured' });
  try {
    const { topic, audience, brief, tone } = req.body;
    const deckData = await generateContent(
      topic||'Catskill Partners Overview',
      audience||'Investment Bankers and Capital Allocators',
      brief||'',
      tone||'Institutional (rigorous, data-forward)',
      apiKey
    );
    const pptx = build(deckData);
    const base64 = await pptx.write({ outputType:'base64' });
    const name = 'Catskill-Partners-'+(topic||'Overview').replace(/[^a-zA-Z0-9]/g,'-').substring(0,40)+'-'+Date.now()+'.pptx';
    res.status(200).json({ success:true, filename:name, base64, slideCount:deckData.slides?.length||0, title:deckData.title });
  } catch(err) {
    console.error('PPTX error:',err);
    res.status(500).json({ error:'Failed to generate presentation', detail:err.message });
  }
}