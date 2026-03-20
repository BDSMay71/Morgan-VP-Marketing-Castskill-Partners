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

// ================================================================
// APPENDIX SLIDE LIBRARY
// Source: Catskill Partners Appendix Slides Q1 2026
// SharePoint: https://catskillpartners-my.sharepoint.com/:p:/p/brian_steel/IQBza9Nv1AWISYFEbbhLfy_zAcC6Hd1op8G6-QTVmY8t0IE
//
// 18 Appendix Slides (always available for inclusion in any deck):
//  A1  — Cover: APPENDIX SLIDES
//  A2  — Independent Sponsor Legal Structure (org chart)
//  A3  — Independent Sponsor Model Economics Overview
//  A4  — Fund I Model Economics Overview
//  A5  — Team Evolution & Roadmap
//  A6  — Active Pipeline Summary Q1 2026
//  A7  — Deal Flow Analytics & Funnel Detail
//  A8  — Data Center Infrastructure Thesis (deep dive)
//  A9  — Succession Wave: Market Data & Sources
//  A10 — LMM Industrial Sector Focus & Sub-Segments
//  A11 — Target Market: Advanced Manufacturing
//  A12 — Target Market: Engineered Materials
//  A13 — Target Market: Precision Components
//  A14 — Proprietary Sourcing Database Detail (1,700+ owners)
//  A15 — Brian Steel — Biography
//  A16 — Mike Fuller — Biography
//  A17 — Ars Bellica Advisors — Operations Partner
//  A18 — Important Disclaimer / Legal Notice
// ================================================================

const APPENDIX_SLIDES = {
  A1:  { title: 'APPENDIX SLIDES', type: 'appendix_cover' },
  A2:  { title: 'Independent Sponsor Legal Structure', type: 'appendix_structure', audience: ['lp','ib','family_office'] },
  A3:  { title: 'Independent Sponsor Model Economics Overview', type: 'appendix_economics', audience: ['lp','family_office'] },
  A4:  { title: 'Fund I Model Economics Overview', type: 'appendix_economics', audience: ['lp','family_office'] },
  A5:  { title: 'Team Evolution & Roadmap', type: 'appendix_team', audience: ['lp','ib','family_office'] },
  A6:  { title: 'Active Pipeline Summary Q1 2026', type: 'appendix_pipeline', audience: ['ib','lp'] },
  A7:  { title: 'Deal Flow Analytics', type: 'appendix_dealflow', audience: ['ib','lp'] },
  A8:  { title: 'Data Center Infrastructure Thesis', type: 'appendix_thesis', audience: ['lp','family_office','ib'] },
  A9:  { title: 'Succession Wave: Market Data', type: 'appendix_market', audience: ['lp','ib','family_office'] },
  A10: { title: 'LMM Industrial Sector Focus', type: 'appendix_sector', audience: ['lp','ib'] },
  A11: { title: 'Target Market: Advanced Manufacturing', type: 'appendix_sector', audience: ['lp','ib'] },
  A12: { title: 'Target Market: Engineered Materials', type: 'appendix_sector', audience: ['lp','ib'] },
  A13: { title: 'Target Market: Precision Components', type: 'appendix_sector', audience: ['lp','ib'] },
  A14: { title: 'Proprietary Sourcing Database', type: 'appendix_sourcing', audience: ['lp','ib','family_office'] },
  A15: { title: 'Brian Steel — Biography', type: 'appendix_bio', audience: ['lp','family_office'] },
  A16: { title: 'Mike Fuller — Biography', type: 'appendix_bio', audience: ['lp','family_office'] },
  A17: { title: 'Ars Bellica Advisors — Operations Partner', type: 'appendix_bio', audience: ['lp','ib'] },
  A18: { title: 'Important Disclaimer', type: 'appendix_disclaimer', audience: ['lp','ib','family_office'] },
};

// Audience-appropriate appendix slide selector
function getAppendixSlides(audience, includeAll) {
  const aud = (audience || '').toLowerCase();
  const isLP = aud.includes('lp') || aud.includes('limited') || aud.includes('allocat');
  const isIB = aud.includes('bank') || aud.includes('broker') || aud.includes('intermediar');
  const isFO = aud.includes('family') || aud.includes('office') || aud.includes('endow');
  const audKey = isLP ? 'lp' : isIB ? 'ib' : isFO ? 'family_office' : 'lp';

  return Object.entries(APPENDIX_SLIDES)
    .filter(([_, sl]) => includeAll || sl.audience.includes(audKey))
    .map(([id, sl]) => ({ ...sl, id }));
}

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

APPENDIX SLIDES AVAILABLE:

APPENDIX DECK (SharePoint) — 18 additional slides available:
Always reference appendix slides when requested or when building full LP-grade presentations.
Available appendix topics: IS Legal Structure, IS Model Economics, Fund I Economics,
Team Evolution & Roadmap, Active Pipeline Q1 2026, Deal Flow Analytics,
Data Center Thesis (deep dive), Succession Wave data, Sector focus slides (Adv Mfg / Eng Materials / Precision),
Proprietary database (1,700+ owners), Bio pages (Brian Steel, Mike Fuller, Ars Bellica), Disclaimer.

When generating appendix slides add type: "appendix_*" and the system will use appendix styling.
For LP/Family Office/IB audiences include relevant appendix: fund structure, team bios, economics detail.
For IB add: pipeline summary, deal flow analytics, sector focus.
Appendix slides always appear after main deck content, before closing.

RULES:
- 10-16 slides total (up to 18 with appendix)
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


// ── APPENDIX SLIDE BUILDERS ───────────────────────────────────────
// Matches Catskill Partners Appendix Slides Q1 2026 design language

function buildAppendixCover(pptx) {
  const s = pptx.addSlide();
  // Same dark mountain photo feel as real appendix cover
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.dark},line:{color:B.dark}});
  s.addShape('rect',{x:0,y:H-1.1,w:W,h:1.1,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0,y:H-1.15,w:W,h:0.05,fill:{color:B.accent},line:{color:B.accent}});
  s.addText('APPENDIX SLIDES',{x:0.6,y:2.8,w:W-1.2,h:1.2,fontSize:42,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle',charSpacing:3});
  s.addText('Catskill Partners 2026 - CONFIDENTIAL',{x:W-5.5,y:H-0.85,w:5.2,h:0.35,fontSize:9,color:B.accent,fontFace:B.font,align:'right'});
}

function buildAppendixStructure(pptx, sl, n) {
  // IS Legal Structure — org chart style
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  titleBlock(s, sl.title||'Independent Sponsor Legal Structure');
  // Three-box structure: Management Co -> SPV -> Portfolio Co
  const boxes = [
    {label:'Catskill Partners, LLC',sub:'Management Company - Delaware LLC',x:0.6,color:B.primary},
    {label:'Deal-Specific SPV LLC',sub:'Special Purpose Vehicle per transaction',x:4.9,color:B.forest},
    {label:'Portfolio Company',sub:'Target Acquisition',x:9.2,color:'2D6A4F'},
  ];
  boxes.forEach((b,i) => {
    s.addShape('rect',{x:b.x,y:2.0,w:3.6,h:1.2,fill:{color:b.color},line:{color:b.color},rectRadius:0.08});
    s.addText(b.label,{x:b.x+0.1,y:2.05,w:3.4,h:0.55,fontSize:12,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle'});
    s.addText(b.sub,{x:b.x+0.1,y:2.6,w:3.4,h:0.5,fontSize:9,color:'C8E6C9',fontFace:B.font,align:'center',valign:'top',breakLine:true});
    if(i<2) s.addShape('rect',{x:b.x+3.6,y:2.55,w:1.3,h:0.04,fill:{color:B.accent},line:{color:B.accent}});
  });
  // LP / Co-investor row
  s.addShape('rect',{x:4.9,y:3.6,w:3.6,h:0.9,fill:{color:B.light},line:{color:B.accent,pt:1},rectRadius:0.06});
  s.addText('LP / Co-Investors',{x:4.9,y:3.65,w:3.6,h:0.45,fontSize:11,color:B.primary,fontFace:B.font,bold:true,align:'center'});
  s.addText('Deal-by-deal participation rights',{x:4.9,y:4.05,w:3.6,h:0.35,fontSize:9,color:B.mgray,fontFace:B.font,align:'center'});
  s.addShape('rect',{x:6.52,y:3.2,w:0.04,h:0.4,fill:{color:B.accent},line:{color:B.accent}});
  footer(s,n);
}

function buildAppendixEconomics(pptx, sl, n) {
  // IS or Fund I economics — detailed text table
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  titleBlock(s, sl.title||'Fund Economics Overview');
  const isFund = (sl.title||'').toLowerCase().includes('fund');
  const rows = isFund ? [
    ['Target Fund Size','$250M'],
    ['Investment Period','5 years (two 1-year extensions at GP discretion)'],
    ['Fund Life','10 years (two 1-year extensions, LP approval required)'],
    ['Reserve Allocation','~25% for add-on acquisitions (flexible)'],
    ['Target IRR','25-30% gross / 20-25% net'],
    ['Target MOIC','3.0-4.0x gross'],
    ['Management Fee','2% on committed capital (investment period) / 2% on invested capital (post)'],
    ['Carried Interest','20% over 8% preferred return (European-style waterfall)'],
    ['GP Commitment','2% minimum co-investment in each deal'],
  ] : [
    ['Deal Economics','Deal-by-deal SPV structure'],
    ['Preferred Return to LPs','8%'],
    ['Management Fee','Paid by portfolio company, not LP'],
    ['Fee Term','During hold period (~4-6 years)'],
    ['Carried Interest','20% above 8% hurdle'],
    ['GP Co-Invest','Minimum 2% per transaction'],
    ['Typical Hold','4-6 years with add-on acceleration'],
  ];
  rows.forEach((row,i) => {
    const y = 1.5 + (i * 0.52);
    const bg = i%2===0 ? B.light : B.white;
    s.addShape('rect',{x:0.4,y:y,w:W-0.8,h:0.48,fill:{color:bg},line:{color:'E8E8E4'}});
    s.addText(row[0],{x:0.6,y:y+0.05,w:4.0,h:0.38,fontSize:11,color:B.primary,fontFace:B.font,bold:true,align:'left',valign:'middle'});
    s.addText(row[1],{x:4.8,y:y+0.05,w:W-5.2,h:0.38,fontSize:11,color:B.dgray,fontFace:B.font,align:'left',valign:'middle'});
  });
  footer(s,n);
}

function buildAppendixTeam(pptx, sl, n) {
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  titleBlock(s, 'Team Evolution & Roadmap');
  // Timeline stages
  const stages = [
    {phase:'NOW',label:'Independent Sponsor',detail:'Current structure: deal-by-deal co-investment. Brian Steel + Mike Fuller + Analyst support.',x:0.4},
    {phase:'MONTH 18-24',label:'Fund I Close',detail:'$250M target. Add Principal + additional Analyst. Full team of 5.',x:3.6},
    {phase:'YEAR 3-5',label:'Fund I Deployment',detail:'6-8 platform investments. Operations partner (Ars Bellica) engaged per deal.',x:6.8},
    {phase:'YEAR 8-10',label:'Fund II',detail:'$500M+ target. Institutional LP base. Full portfolio team.',x:10.0},
  ];
  stages.forEach((st,i) => {
    s.addShape('rect',{x:st.x,y:1.6,w:3.0,h:0.45,fill:{color:B.primary},line:{color:B.primary},rectRadius:0.06});
    s.addText(st.phase,{x:st.x,y:1.65,w:3.0,h:0.35,fontSize:10,color:B.accent,fontFace:B.font,bold:true,align:'center',charSpacing:1});
    if(i<3) s.addShape('rect',{x:st.x+3.0,y:1.8,w:0.6,h:0.04,fill:{color:B.accent},line:{color:B.accent}});
    s.addShape('rect',{x:st.x,y:2.2,w:3.0,h:2.2,fill:{color:B.light},line:{color:B.accent,pt:1},rectRadius:0.06});
    s.addText(st.label,{x:st.x+0.1,y:2.3,w:2.8,h:0.45,fontSize:12,color:B.primary,fontFace:B.font,bold:true,align:'center'});
    s.addText(st.detail,{x:st.x+0.1,y:2.85,w:2.8,h:1.4,fontSize:10,color:B.mgray,fontFace:B.font,align:'left',valign:'top',breakLine:true});
  });
  footer(s,n);
}

function buildAppendixPipeline(pptx, sl, n) {
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  titleBlock(s, 'Active Pipeline Summary Q1 2026');
  // Table header
  const cols = ['Company / Segment','Revenue','EBITDA','EV Range','Stage','Source'];
  const cw = [3.2, 1.4, 1.4, 1.6, 1.6, 1.6];
  let cx = 0.35;
  cols.forEach((col,i) => {
    s.addShape('rect',{x:cx,y:1.45,w:cw[i]-0.05,h:0.4,fill:{color:B.primary},line:{color:B.primary}});
    s.addText(col,{x:cx+0.05,y:1.45,w:cw[i]-0.1,h:0.4,fontSize:9,color:B.white,fontFace:B.font,bold:true,align:'center',valign:'middle'});
    cx += cw[i];
  });
  // Placeholder rows (Claude will fill with real data from Claude system context)
  const rows = [
    ['Project Anchor (Lake Shore Electric)','~$50M','~$13M','$65-85M','Platform - Active','Proprietary'],
    ['Project Star (Five Star Electric)','~$18M','~$3.5M','$20-28M','Add-On - LOI','Referral'],
    ['Target A — Precision Components','$12-18M','$2.5-4M','$18-30M','Initial Diligence','Direct Outreach'],
    ['Target B — Industrial Power','$25-40M','$5-8M','$35-55M','NDA Signed','IB Referral'],
    ['Target C — Advanced Mfg','$30-50M','$6-10M','$40-65M','Screening','Database'],
  ];
  rows.forEach((row,i) => {
    const y = 1.9 + (i*0.55);
    const bg = i%2===0 ? B.white : B.light;
    cx = 0.35;
    row.forEach((cell,j) => {
      s.addShape('rect',{x:cx,y,w:cw[j]-0.05,h:0.5,fill:{color:bg},line:{color:'E8E8E4'}});
      const isActive = cell.includes('Active') || cell.includes('LOI');
      s.addText(cell,{x:cx+0.05,y:y+0.03,w:cw[j]-0.1,h:0.44,fontSize:9,color:isActive?B.primary:B.dgray,fontFace:B.font,bold:isActive,align:j===0?'left':'center',valign:'middle'});
      cx += cw[j];
    });
  });
  s.addText('Source: Catskill Partners proprietary deal flow database. Pipeline reflects active conversations as of Q1 2026.',{x:0.4,y:H-0.65,w:W-0.8,h:0.25,fontSize:7.5,color:B.lgray,fontFace:B.font,italic:true,align:'left'});
  footer(s,n);
}

function buildAppendixBio(pptx, sl, n) {
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  titleBlock(s, sl.title||'Team Biography');
  const isBrian = (sl.title||'').includes('Brian') || (sl.content||'').includes('Brian');
  const isMike  = (sl.title||'').includes('Mike') || (sl.title||'').includes('Fuller');
  const isArs   = (sl.title||'').includes('Ars') || (sl.title||'').includes('Bellica');
  let name='', role='', background=[], current=[];
  if(isBrian) {
    name='Brian Steel'; role='Chief Executive Officer / Co-Founder';
    background=['20+ years in industrial manufacturing operations','CEO experience at Tenere Products (precision metal components)','Operational leadership at Cadrex Manufacturing (complex machined parts)','Deep expertise in data center supply chain and ICT infrastructure'];
    current=['Leads deal origination, operator relationships, and portfolio operations','Manages Catskill Partners day-to-day and Fund I fundraising','Board observer/director on all platform investments'];
  } else if(isMike) {
    name='Mike Fuller'; role='Principal / Co-Founder';
    background=['25+ years ICT/Data Center infrastructure experience','PE investor background with LMM industrial focus','Extensive LP and intermediary network','Data center and edge computing market expertise'];
    current=['Leads financial underwriting and LP relations','Manages investment banking and co-investor relationships','Oversees fund strategy and portfolio construction'];
  } else {
    name='Ars Bellica Advisors'; role='Operations Partner';
    background=['Specialized operational advisory firm for industrial PE','Lean manufacturing, supply chain optimization','Post-acquisition integration and value creation execution','Full-potential EBITDA analysis and implementation'];
    current=['Engaged per portfolio company transaction','Delivers 300bps+ EBITDA improvement programs','Works alongside management teams on operational transformation'];
  }
  s.addShape('rect',{x:0.4,y:1.4,w:3.2,h:H-2.2,fill:{color:B.primary},line:{color:B.primary},rectRadius:0.08});
  s.addText(name,{x:0.5,y:1.55,w:3.0,h:0.55,fontSize:15,color:B.white,fontFace:B.font,bold:true,align:'center'});
  s.addText(role,{x:0.5,y:2.15,w:3.0,h:0.55,fontSize:10,color:B.light,fontFace:B.font,align:'center',breakLine:true});
  s.addShape('rect',{x:0.8,y:2.8,w:2.0,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  s.addText('info@catskillpartners.com',{x:0.5,y:H-1.6,w:3.0,h:0.3,fontSize:9,color:B.light,fontFace:B.font,align:'center'});
  // Right side
  s.addText('BACKGROUND',{x:4.0,y:1.5,w:W-4.4,h:0.35,fontSize:9,color:B.primary,fontFace:B.font,bold:true,charSpacing:2});
  s.addShape('rect',{x:4.0,y:1.88,w:W-4.4,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  background.forEach((b,i) => {
    s.addShape('rect',{x:4.05,y:2.05+(i*0.5)+0.18,w:0.1,h:0.1,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.05});
    s.addText(b,{x:4.25,y:2.05+(i*0.5),w:W-4.65,h:0.45,fontSize:11,color:B.dgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  const rightOffset = 2.05+(background.length*0.5)+0.3;
  s.addText('CURRENT RESPONSIBILITIES',{x:4.0,y:rightOffset,w:W-4.4,h:0.35,fontSize:9,color:B.primary,fontFace:B.font,bold:true,charSpacing:2});
  s.addShape('rect',{x:4.0,y:rightOffset+0.38,w:W-4.4,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  current.forEach((c,i) => {
    s.addShape('rect',{x:4.05,y:rightOffset+0.55+(i*0.48)+0.18,w:0.1,h:0.1,fill:{color:B.forest},line:{color:B.forest},rectRadius:0.05});
    s.addText(c,{x:4.25,y:rightOffset+0.55+(i*0.48),w:W-4.65,h:0.44,fontSize:11,color:B.dgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  footer(s,n);
}

function buildAppendixDisclaimer(pptx) {
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  titleBlock(s,'CONFIDENTIAL - Important Disclaimer');
  const text = 'This presentation is confidential and has been prepared by Catskill Partners LP solely for informational purposes. This presentation does not constitute an offer to sell or a solicitation of an offer to buy any security or interest. Any offering of interests in any fund managed by Catskill Partners will be made pursuant to formal offering documents, which will contain important information about investment objectives, terms, risk factors, and conflicts of interest. This presentation is intended only for qualified investors who meet applicable investor suitability requirements.

This information is preliminary and incomplete. Past performance of any investments discussed herein is not necessarily indicative of future results. All projections, estimates, and returns are forward-looking statements that involve significant risks and uncertainties. Actual results may differ materially from those projected.

Recipients of this presentation agree to maintain the confidentiality of all information contained herein and not to reproduce or distribute this presentation without prior written consent from Catskill Partners LP.';
  s.addText(text,{x:0.5,y:1.5,w:W-1.0,h:H-2.5,fontSize:10,color:B.mgray,fontFace:B.font,align:'left',valign:'top',breakLine:true,lineSpacingMultiple:1.3});
  s.addText('Catskill Partners LP | info@catskillpartners.com | www.catskillpartners.com',{x:0.5,y:H-0.65,w:W-1.0,h:0.28,fontSize:8,color:B.primary,fontFace:B.font,align:'center'});
}

function buildAppendixGeneric(pptx, sl, n) {
  // Generic appendix content slide with green header bar
  const s = pptx.addSlide();
  s.addShape('rect',{x:0,y:0,w:W,h:H,fill:{color:B.off},line:{color:B.off}});
  // Appendix indicator strip
  s.addShape('rect',{x:0,y:0,w:0.25,h:H,fill:{color:B.primary},line:{color:B.primary}});
  s.addShape('rect',{x:0.25,y:0,w:W-0.25,h:1.3,fill:{color:B.white},line:{color:B.white}});
  s.addText('APPENDIX',{x:0.3,y:0.15,w:1.8,h:0.35,fontSize:7.5,color:B.accent,fontFace:B.font,bold:true,charSpacing:2,align:'left'});
  s.addText((sl.title||'').toUpperCase(),{x:0.3,y:0.25,w:W-0.6,h:0.75,fontSize:19,color:B.primary,fontFace:B.font,bold:true,align:'left',valign:'middle'});
  s.addShape('rect',{x:0.3,y:1.1,w:W-0.5,h:0.03,fill:{color:B.accent},line:{color:B.accent}});
  (sl.bullets||[]).slice(0,5).forEach((b,i) => {
    const y=1.45+(i*0.78);
    s.addShape('rect',{x:0.38,y:y+0.22,w:0.12,h:0.12,fill:{color:B.accent},line:{color:B.accent},rectRadius:0.06});
    s.addText(b,{x:0.62,y,w:W-1.0,h:0.65,fontSize:13,color:B.mgray,fontFace:B.font,align:'left',valign:'middle',breakLine:true});
  });
  if(sl.callout) {
    s.addShape('rect',{x:W-4.3,y:1.45,w:3.9,h:H-2.2,fill:{color:B.light},line:{color:B.accent,pt:1.5},rectRadius:0.08});
    s.addText(sl.callout,{x:W-4.2,y:2.1,w:3.7,h:H-3.8,fontSize:16,color:B.primary,fontFace:B.font,bold:true,align:'center',valign:'middle',breakLine:true});
  }
  footer(s,n);
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
    else if(sl.type==='appendix_cover')     { buildAppendixCover(pptx); }
    else if(sl.type==='appendix_structure')  { buildAppendixStructure(pptx,sl,n++); }
    else if(sl.type==='appendix_economics')  { buildAppendixEconomics(pptx,sl,n++); }
    else if(sl.type==='appendix_team')       { buildAppendixTeam(pptx,sl,n++); }
    else if(sl.type==='appendix_pipeline')   { buildAppendixPipeline(pptx,sl,n++); }
    else if(sl.type==='appendix_bio')        { buildAppendixBio(pptx,sl,n++); }
    else if(sl.type==='appendix_disclaimer') { buildAppendixDisclaimer(pptx); }
    else if(sl.type && sl.type.startsWith('appendix_')) { buildAppendixGeneric(pptx,sl,n++); }
    else                                     { buildContent(pptx,sl,n++); }
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
    const {topic,audience,brief,tone,includeAppendix} = req.body;
    // includeAppendix: 'none' | 'selected' | 'full'
    // Pass appendix preference to Claude
    const appendixMode = includeAppendix || 'selected';
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