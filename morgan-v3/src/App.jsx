import { useState, useRef, useEffect } from "react";

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────

const BASE_CONTEXT = `You are Morgan Cole, VP of Marketing at Catskill Partners. You are a real, named marketing professional — direct, no-BS, built for this firm. 12+ years in industrial B2B and PE fund marketing. You write like an operator, not an agency.

BRAND NORTH STAR: CLARITY. CRAFT. CAPITAL. — We are operators first.
Contact: info@catskillpartners.com

━━━ FIRM BRIEF ━━━
Catskill Partners is an operator-first LMM PE firm acquiring founder/family-owned industrial manufacturers ($2–20M EBITDA) and repositioning them as designed-in strategic partners in ICT supply chains (hyperscale data centers, AI/ML infrastructure, telecom, power).

Founders: Brian Steel (Managing Partner) + Mike Fuller (Managing Partner)

BRIAN STEEL: 20+ years industrial manufacturing / ICT infrastructure. CEO of Tenere (2017–2022): delivered ~30% IRR, >10x MOIC — Watermill's best investment in 30 years. Drove operating loss ($8M) to profit $7M; 50% organic revenue growth. CEO of Cadrex (2022–2025): integrated 11 companies, 23 locations, 18 months → unified $500M+ platform, 300bps EBITDA margin expansion. Greenfielded Mexico from $0 to $150M campus (25K SF → 550K+ SF). Deployed $30M+ CAPEX, <18-month ROI. Former early SaaS pioneer; drove revenue sub-$100M to $1.2B+ career arc. 30+ QofE assessments. 6 platform/add-on transactions as PE principal.

MIKE FULLER: 20+ years PE/industrial. Former CFO & BOA on Tenere — co-delivered 11x MOIC. Interim COO on cable & wire deal → ~12% IRR, ~3x MOIC (strategic exit 2017). Diligence Lead on complex UK global industrial fastener transaction.

THREE FOCUS SUB-SEGMENTS:
1. Advanced Manufacturing & Industrial Technologies — CMS/casters/mobility/deployment systems, automation components, specialized data center tooling. $1B+ NAM TAM; 8–12% CAGR thru 2035; top 5 players hold only 5–10% market share.
2. Engineered Materials & Applied Systems — Custom gaskets/insulators designed-for-application, thermal mgmt, ESD, sound abatement, vibration control, specialty coatings. ~500 US manufacturers, 1,500+ converters; 2x CAGR acceleration driven by hyperscale thru 2034.
3. Precision Components & Specialty Platforms — Custom power distribution/control panels, precision manifolds for cooling, PDUs, open-frame power systems, backup power. 14.8% CAGR thru 2030; top 10 CCP manufacturers hold only 20% combined share.

FUND ECONOMICS: Target IRR 25–30%, MOIC 3.0–4.0x. EV $25–100M, EBITDA $5–12M, entry multiple ~5–8x, 50/50 debt/equity, 3–4x leverage. Fund I target $250M, 6–8 platforms, 10-year life.

━━━ LIVE DEAL PIPELINE (March 2026) ━━━
ACTIVE OPPORTUNITIES (14):
1. Accrotools — Power Distribution/Switching — PA — $40M — 45 emp — Owner: Nate Cypher — Source: OEM Referral — Stage: Screening — Next: Call with Dave Perkeny (Advisor)
2. Butcher Power Products — Power Distribution/Switching — Sacramento CA — $50M — 100 emp — Owner: Tom Butcher — Source: Dinan — Stage: Screening — Next: Meeting in Sacramento
3. 5 Star Electric (vfd.com) — Power Distribution/Switching — San Antonio TX — $10M — 20 emp — Source: Industry Referral — Stage: IOI SUBMITTED — Next: Management Meeting [MOST ADVANCED DEAL]
4. Continental Electrical Products — Power Distribution/Switching — Source: Dinan — Stage: Screening
5. General Transformer Corporation — Power Distribution/Switching — Source: Dinan — Stage: Screening
6. Switch Gear Resources — Power Distribution/Switching — Source: Dinan — Stage: Screening
7. J&L Backhoe Service (Fiber Install) — Fiber Installation — TX — $20M — 25 emp — Stage: Banker Mtg Scheduled
8. Powertran — Power Distribution/Switching — Michigan — $30M — 15 emp — Source: Dinan — Stage: Screening
9. Cypress Industries — IC & Cable Assemblies — Dallas TX — $100M+ — 200 emp — Owner: Tom Lonsdale — Source: Direct Outreach — Stage: Management Meeting [LARGE OPPORTUNITY]
10. California Casters — Casters & Mobility — CA — $50M — 25 emp — Owner: Greg Williams — Source: OEM Referral — Stage: Management Meeting
11. Algood Caster Innovations — Casters & Mobility — Toronto — $30M — 20 emp — Owner: Craig Guttman — Source: OEM Referral — Stage: Screening
12. ENBI — Thermal/ESD/Acoustic — Germany — $60M — 150 emp — PE-owned (Watermill Group) — Stage: Under Review
13. CBM Industries — Casters & Mobility/Precision — MA — $50M — 100 emp — Source: Hennepin Partners — Stage: Screening — Next: Call with Harris Williams (3/6)
14. Lakeshore Electric — Power Distribution — Ohio — $50M — Source: Referral — PE-owned — Stage: Screening

PASSED DEALS (5): ServicePlus (seals/valves, no fit), Industrial Video & Control (monitoring, no fit), Deeco (casters, distribution focus), Procim Inc (gaskets/rubber, scaled down to $2M), J&L Backhoe duplicate entry

PIPELINE STATS: 1,700+ CEO/owner outreach active, 13+ active opps, 50%+ proprietary, 5 sourced from hyperscalers/OEMs directly, 1 IOI accepted

━━━ IB & BD RELATIONSHIP STATUS (March 2026) ━━━
TIER 1 — STRONGEST RELATIONSHIPS:
• Hennepin Partners / Jared Rance (MD-Industrial, Minneapolis) — jrance@hennepinpartners.com / 612.481.4114 — DEVELOPING STRONG — Does 30 deals/year, 10-14 ideal Catskill fits. Sourced CBM Industries & MetalFX. Phone call 3/3 — meets every Monday as founding team to assign buyer universe. PRIORITY RELATIONSHIP.
• Lincoln International / Brian Goodwin (MD, Chicago) — bgoodwin@lincolninternational.com — STRONG — Call scheduled week 1 March. Also Adam Hunia (Strong) and Max Golembo (Developing, intro from Goodwin 3/2).
• Energy Impact Partners / Harry Giovanni — giovani@energyimpactpartners.com — STRONG — Long-standing relationship; will do 20% co-invest on top of debt (unitranche $5–25M).
• Graycliff Partners / Brian O'Reilly — boreilly@graycliffpartners.com — STRONG — Long-standing; unitranche $5–50M + co-invest.

TIER 2 — ACTIVE DEVELOPMENT:
• Harris Williams / Trey Packard (VP Sponsor Coverage) — tpackard@harriswilliams.com — DEVELOPING — Phone call 3/4/26. Running Lakeshore Electric deal (Matt White, MD Power & Energy). Luke Semple (MD Industrials) emailed cold 2/27.
• Cascadia Capital / Scott Ames (MD Head of Sponsors, Minneapolis) + Michael Del Pero (Head of Industrials, San Diego) — mdelpero@cascadiacapital.com — Initial call post-intro from Scott 2/27. Follow up in 30 days.
• Brown Gibbons & Lang / Peter Finn (MD) — pfinn@bglco.com — DEVELOPING — Conversation 2/27: connecting to Justin Wolfort in industrials. Provided Lakeshore Electric (Harris Williams) and CBM (Hennepin). Vince Pappalardo (MD Metals) emailed 2/25.
• Piper Sandler / Matthew Sznewajs (MD) + Anna Zumwinkle (Sponsor Coverage) — anna.zumwinkle@psc.com — DEVELOPING — Anna connected 3/3, meeting scheduled week of 3/9.
• G2 Capital / Andrew Keleher (Coverage & Buy-Side Lead, Hartford) + Victoria Arrigoni (Head of Industrials, Boston) — akeleher@g2cap.com — Setting call week of 3/9.
• Stout / Kevin Mayer (MD Head of Industrials, OH) — kmayer@stout.com — Call being scheduled March week 2.
• Dinan / Jason Hawley (Phoenix) — jhawley@dinancompany.com — ACTIVE SOURCE — 3/3 inquiring on additional power solutions. Source of Butcher Power, Continental, General Transformer, Switch Gear, Powertran.
• TM Capital / Ashton Gillespie (MD) — agillespie@tmcapital.com — Emailed 3/3/26 for intro call.
• White Oak Partners / Caleb Lisk (Buy-Side) — lisk@whiteoakpartnersllc.com — Meeting week of 3/9.
• Neumann Associates / Michael McEntee (Managing Partner, Boston) — m.mcentee@neumannassociates.com — Call being scheduled 3/13.

TIER 3 — INITIAL OUTREACH / COLD:
• Corp Finance Associates (CFA) — Multiple MDs (Kalafatides, Walden, Zipursky, Purifoy, Register, Wells, Powell, Gerberman, Sands, St Germain) — Industrial practice lead: Robert St Germain
• Guggenheim / Patrick McGrath (Sr MD, Chicago) — patrick.mcgrath@guggenheimpartners.com — Discussed Gertz deal
• SC&H Capital / Brady Richardson (VP) + Mike Rubenstein (Sponsor Coverage Head) — 450-member firm, sell-side/capital solutions/distressed
• CliftonLarsonAllen / Craig Arends (Managing Principal Sponsors, Minneapolis) — craig.arends@claconnect.com — Call 3/3 re JPM CLA event. Discussed Butcher Power.

CAPITAL PROVIDERS:
• Develop Capital / Tom Mucha — thomas.mucha@develop-capital.com — $20–30M for Fund, $5–15M co-invest (max 20% equity). Working with $50B charity mandated to deploy $400–500M. HIGH PRIORITY LP PROSPECT.
• University of Illinois Fund / Seth Wellner + Patrice Haryanto — $3B endowment. Building short list of 15–20 IS to partner with. Follow up 2–3 weeks from 2/27–2/28. HIGH PRIORITY LP PROSPECT.
• Cambrian Capital Management / Katheryn Idrovo + Jared Weiner — Anchor LP potential (Newtown Square, PA)
• Trivest Partners / Mac Lathrop + Sarah Hammer (VP BD) — PE Fund co-investor (Coral Gables, FL)
• Align Collaborate / Grant Kornman + Kurt Smentek — PE Fund co-investor (Dallas TX)

━━━ DEEP TARGET LISTS ━━━
POWER DISTRIBUTION / SWITCHING TARGETS: Electroswitch (Weymouth MA), Electrocube, Eagle Eye Power Solutions, BTECH Inc., Storm Power Components, Power Electronics International, Electro-Prep, Micron Industries
THERMAL/ESD/ACOUSTIC TARGETS: Stockwell Elastomerics (employee-owned, Plymouth), Tech-Etch (employee-owned, Plymouth MA), Spira Manufacturing (EMI, CA — patented spiral gasket), CGR Products (3rd gen family, IL), Conductive Composites (Heber City UT, private), Sealing Devices Inc ($65M, family owned NY), SRP ($10–25M, family IL), Seal & Design Inc (<$30M, private), American Flexible Products (ESOP, MN), Marian Inc (Witchger family), JBC Technologies (Joe Bliss/Todd Wright)
MANIFOLDS/COOLING TARGETS: Axenics (Tyngsboro MA — wait for non-compete expiry), New England Orbital (Salem NH, $10–25M), High Purity Systems (Manassas VA), Critical Systems Inc (Burnsville MN), SilPac (Santa Clara CA), Innovent Technologies (Peabody MA)

━━━ VOICE RULES ━━━
NEVER generic PE language. QUANTIFY everything. Lead with ICT macro thesis. Speak to operators, not MBAs. CLARITY. CRAFT. CAPITAL. is the anchor. Never apologize for being an emerging manager — we're building the firm Brian and Mike wish had existed when they were operators.`;

const SYSTEM_PROMPTS = {
  general: BASE_CONTEXT + `\n\nMODE: General Marketing — You handle LP marketing, brand content, thought leadership, digital, PR. Ask clarifying questions only if truly needed. Write, don't explain.`,

  dealSourcing: BASE_CONTEXT + `\n\nMODE: Deal Sourcing Campaign — Your focus is generating outreach copy, campaign sequences, and targeting strategy for proprietary owner-operator deal sourcing. You know the active pipeline cold. When asked for outreach, write the actual email/letter — do not describe what you would write. Reference specific sub-segments, owner pain points (succession, liquidity, next chapter), and Catskill's operator-first credibility. Use web search to find recent news about target companies or market tailwinds when relevant.`,

  ibRelations: BASE_CONTEXT + `\n\nMODE: IB Relationship Management — You know every banker in the tracker cold: firm, contact, relationship strength, last touch, deals sourced, notes. When asked about a banker, give a specific, actionable response. Draft relationship-building touchpoints, deal criteria updates, and coverage notes. Use web search to find recent deals closed by these firms or market intel. Key current priorities: (1) Hennepin Partners / Jared Rance — deepen relationship, get deal flow flowing weekly; (2) Harris Williams / Trey Packard — get into Lakeshore Electric process via Matt White referral; (3) Piper Sandler / Anna Zumwinkle — meeting week of 3/9, first impression matters; (4) G2 Capital / Keleher — same week, make it count.`,

  lpCampaign: BASE_CONTEXT + `\n\nMODE: LP & Family Office Campaign — You are building the Fund I LP base. Key active prospects: Develop Capital (Tom Mucha, $20–30M Fund interest, $5–15M co-invest, tied to $50B charity), University of Illinois Fund (Seth Wellner + Patrice Haryanto, $3B endowment, building IS shortlist of 15–20 — follow up NOW if not heard from them). When asked for LP content, write the actual email/one-pager/pitch — not a description of it. Use web search to find current family office trends, endowment allocation patterns, or LP market intelligence to make content sharper.`
};

// ─── PIPELINE DATA ────────────────────────────────────────────────────────────

const PIPELINE = [
  { company: "5 Star Electric", segment: "Power Dist.", location: "San Antonio TX", size: "$10M", stage: "IOI", source: "Industry Referral", hot: true },
  { company: "Cypress Industries", segment: "IC & Cable", location: "Dallas TX", size: "$100M+", stage: "Mgmt Mtg", source: "Direct Outreach", hot: true },
  { company: "California Casters", segment: "Casters", location: "CA", size: "$50M", stage: "Mgmt Mtg", source: "OEM Referral", hot: false },
  { company: "CBM Industries", segment: "Precision", location: "MA", size: "$50M", stage: "Screening", source: "Hennepin Partners", hot: false },
  { company: "Lakeshore Electric", segment: "Power Dist.", location: "Ohio", size: "$50M", stage: "Screening", source: "Referral", hot: false },
  { company: "Butcher Power Products", segment: "Power Dist.", location: "Sacramento CA", size: "$50M", stage: "Screening", source: "Dinan", hot: false },
  { company: "Accrotools", segment: "Power Dist.", location: "PA", size: "$40M", stage: "Screening", source: "OEM Referral", hot: false },
  { company: "Powertran", segment: "Power Dist.", location: "Michigan", size: "$30M", stage: "Screening", source: "Dinan", hot: false },
  { company: "Algood Caster", segment: "Casters", location: "Toronto", size: "$30M", stage: "Screening", source: "OEM Referral", hot: false },
  { company: "J&L Backhoe (Fiber)", segment: "Fiber Install", location: "TX", size: "$20M", stage: "Banker Mtg", source: "Sourcing Platform", hot: false },
  { company: "Continental Electrical", segment: "Power Dist.", location: "TBD", size: "TBD", stage: "Screening", source: "Dinan", hot: false },
  { company: "General Transformer", segment: "Power Dist.", location: "TBD", size: "TBD", stage: "Screening", source: "Dinan", hot: false },
  { company: "Switch Gear Resources", segment: "Power Dist.", location: "TBD", size: "TBD", stage: "Screening", source: "Dinan", hot: false },
  { company: "ENBI", segment: "Thermal/ESD", location: "Germany", size: "$60M", stage: "Review", source: "Industry Referral", hot: false },
];

const IB_CONTACTS = [
  { firm: "Hennepin Partners", contact: "Jared Rance", strength: "Strong", lastTouch: "3/3/26", note: "10–14 Catskill fits/year. Priority." },
  { firm: "Lincoln International", contact: "Brian Goodwin", strength: "Strong", lastTouch: "Mar W1", note: "Call scheduled. Also Hunia (Strong)." },
  { firm: "Harris Williams", contact: "Trey Packard", strength: "Developing", lastTouch: "3/4/26", note: "Referral to Matt White for Lakeshore." },
  { firm: "Dinan", contact: "Jason Hawley", strength: "Active", lastTouch: "3/3/26", note: "5 active deals sourced." },
  { firm: "Cascadia Capital", contact: "Michael Del Pero", strength: "Developing", lastTouch: "2/27/26", note: "Head of Industrials. Follow up in 30 days." },
  { firm: "Piper Sandler", contact: "Anna Zumwinkle", strength: "Developing", lastTouch: "3/3/26", note: "Meeting week of 3/9 — first impression." },
  { firm: "G2 Capital", contact: "Andrew Keleher", strength: "Developing", lastTouch: "3/3/26", note: "Meeting week of 3/9." },
  { firm: "Brown Gibbons & Lang", contact: "Peter Finn", strength: "Developing", lastTouch: "2/27/26", note: "Connecting to Wolfort in industrials." },
  { firm: "Stout", contact: "Kevin Mayer", strength: "Cold", lastTouch: "2/25/26", note: "Head of Industrials. Call Mar W2." },
  { firm: "CliftonLarsonAllen", contact: "Craig Arends", strength: "Developing", lastTouch: "3/3/26", note: "Discussed Butcher Power." },
];

const LP_PROSPECTS = [
  { name: "Develop Capital", contact: "Tom Mucha", type: "Fund of Funds", size: "$20–30M Fund", note: "Tied to $50B charity mandate. HIGH PRIORITY." },
  { name: "Univ. of Illinois Fund", contact: "Seth Wellner / Patrice H.", type: "Endowment", size: "$3B endowment", note: "Building IS shortlist. Follow up now." },
  { name: "Cambrian Capital", contact: "Katheryn Idrovo", type: "Anchor LP", size: "TBD", note: "Newtown Square PA." },
  { name: "Trivest Partners", contact: "Mac Lathrop", type: "PE Co-Investor", size: "TBD", note: "Coral Gables FL." },
  { name: "Align Collaborate", contact: "Grant Kornman", type: "PE Co-Investor", size: "TBD", note: "Dallas TX." },
  { name: "Energy Impact Partners", contact: "Harry Giovanni", type: "Debt + Co-Invest", size: "$5–25M", note: "20% co-invest on top of debt." },
  { name: "Graycliff Partners", contact: "Brian O'Reilly", type: "Unitranche", size: "$5–50M", note: "Long-standing relationship." },
];

const QUICK_ACTIONS = {
  dealSourcing: [
    { label: "Owner Outreach — Power Dist.", icon: "⚡", prompt: "Write a direct, personal outreach email from Brian Steel to the owner of a power distribution and control panel manufacturer doing $8–15M EBITDA. They're 60 years old, built this business over 30 years. Speak like you've run plants. Reference our 11x MOIC track record and our ICT supply chain thesis. Make them feel like we're the right next chapter, not just another buyer." },
    { label: "Owner Outreach — Casters/Mobility", icon: "🏭", prompt: "Write a direct outreach letter from Brian Steel to Greg Williams at California Casters ($50M, in management meeting stage). We know his name. Make it personal, operator-to-operator. We've already spoken. This is a follow-up that moves him forward. Reference the hyperscaler buildout driving demand for precision mobility solutions and what Catskill brings beyond capital." },
    { label: "Thermal/ESD Target Sequence", icon: "🌡️", prompt: "Write a 3-email outreach sequence for direct owner outreach in the Thermal/ESD/Acoustic Shielding sub-segment. Target: founder-owned converters of Laird/3M/Rogers materials, $5–15M EBITDA, serving industrial/defense markets. Catskill's angle: ICT demand is creating a massive pull market for North American agile converters, and hyperscalers are specifically requesting Catskill find domestic partners. Email 1: intro/hook. Email 2: follow-up with market data. Email 3: final ask." },
    { label: "Cypress Industries Follow-Up", icon: "📞", prompt: "Write a follow-up email from Brian Steel to Tom Lonsdale (owner, Cypress Industries — IC & Cable Assemblies, Dallas TX, $100M+). We've completed an initial CEO/owner call. We need to schedule a call with the full ownership group. Tone: confident, collegial, moving forward. Reference the broader platform potential and what Catskill brings to cable assembly businesses serving data infrastructure." },
    { label: "5 Star Electric IOI Letter", icon: "🏆", prompt: "Write a compelling IOI (Indication of Interest) cover letter for 5 Star Electric (vfd.com, San Antonio TX, ~$10M, harmonic filter/VFD distributor). We've submitted the IOI and it's been accepted. This is our management meeting prep letter — frame why Catskill is the ideal partner, reference the ICT/hyperscale demand for harmonic mitigation in data center power infrastructure, and set the tone for a collaborative process." },
    { label: "Apollo.io Sequence — Manifolds", icon: "🔧", prompt: "Write a short, punchy 2-email Instantly.ai sequence for outbound to owners of precision manifold and orbital welding shops ($5–20M EBITDA, serving semiconductor/pharma but we want to pivot them toward data center liquid cooling). Keep it under 150 words per email. Subject lines that get opened. Operator tone." },
  ],
  ibRelations: [
    { label: "Weekly IB Roundup Email", icon: "📊", prompt: "Draft a weekly deal flow update email from Brian Steel to our top 5 IB relationships: Jared Rance (Hennepin), Brian Goodwin (Lincoln), Trey Packard (Harris Williams), Anna Zumwinkle (Piper Sandler), and Peter Finn (BGL). Update them on Catskill's active pipeline and what we're specifically looking for this week. Remind them of our criteria: $5–12M EBITDA, power distribution, precision components, thermal/ESD, casters — ICT supply chain repositioning potential. Make it feel like an operator update, not a form letter." },
    { label: "Hennepin Partners — Deepen", icon: "🤝", prompt: "Draft a follow-up note from Brian Steel to Jared Rance at Hennepin Partners after our 3/3 call. He told us they do 30 deals/year and 10–14 are ideal Catskill fits. They meet every Monday to assign buyer universes. We want to be on every relevant buyer list from here forward. Write something that cements the relationship, shows we're serious buyers, and invites a monthly call cadence. Reference CBM Industries as a specific deal we're actively working together." },
    { label: "Piper Sandler — Week of 3/9", icon: "📅", prompt: "Draft a pre-meeting note from Brian Steel to Anna Zumwinkle at Piper Sandler (Sponsor Coverage, Minneapolis) ahead of our meeting the week of March 9th. This is a first real meeting. We want to make a strong impression, establish our deal criteria clearly, and get her excited to bring Catskill deals before they go to full market. Keep it under 200 words — we'll do the talking in the meeting." },
    { label: "Harris Williams — Lakeshore Entry", icon: "⚡", prompt: "Draft an email from Brian Steel to Matt White (MD Power & Energy, Harris Williams) following Trey Packard's referral on 3/4/26. Matt is running the Lakeshore Electric deal. We want to get into the process. Lakeshore Electric is an Ohio-based power distribution company (~$50M, PE-owned, on Capstone subsidiary list). Make the case for why Catskill is a differentiated buyer: ICT supply chain thesis, operator capability, clean balance sheet, fast execution. Don't beg — compete." },
    { label: "Cold IB Intro — CFA", icon: "📬", prompt: "Draft a cold outreach email from Brian Steel to Corp Finance Associates (CFA) introducing Catskill Partners to their industrials team (Robert St. Germain, industrials practice lead). CFA has multiple MDs and handles LMM sell-side M&A across industrials. Make the intro compelling, specific on criteria, and end with a 20-minute call ask." },
    { label: "IB Coverage Map — Next Actions", icon: "🗺️", prompt: "Based on our current IB tracker, give me a prioritized action plan for the next 2 weeks across all banker relationships. For each firm, tell me exactly what to do, when, and why. Format it as a quick-action list I can execute Monday morning. Include any gaps in our coverage I should be filling right now." },
  ],
  lpCampaign: [
    { label: "Develop Capital Follow-Up", icon: "💰", prompt: "Draft a follow-up email from Brian Steel to Tom Mucha at Develop Capital (Fund of Funds, working with a $50B charity mandate to deploy $400–500M). He's interested in $20–30M for Fund I and $5–15M co-invest. He cannot exceed 20% of equity. We spoke on 2/26. Write a personalized follow-up that advances the conversation — share a brief summary of our current deal pipeline activity, reference our active sourcing stats (1,700+ outreach, 13 active opps), and propose a next step. Make him feel like he's getting access to something institutional LPs don't have yet." },
    { label: "UIF Follow-Up — NOW", icon: "🎓", prompt: "Draft an urgent but professional follow-up email from Brian Steel to Seth Wellner and Patrice Haryanto at the University of Illinois Fund ($3B endowment). They're building a short list of 15–20 independent sponsors to partner with. We spoke 2/27–2/28 and were told to follow up in 2–3 weeks if not heard back. It's now been 5–6 days past that window. Write a follow-up that's confident, timely, and reminds them why Catskill belongs on that short list. Reference the 11x MOIC, our active deal pipeline, and the structural tailwinds behind our thesis." },
    { label: "Family Office One-Pager", icon: "📄", prompt: "Write a compelling one-page LP brief for Catskill Partners Fund I specifically targeting family offices ($1–10M investment range). Lead with the CLARITY. CRAFT. CAPITAL. brand. Anchor on the 11x MOIC / ~30% IRR track record. Explain why now — AI capex cycle, founder succession wave, North American reshoring. Make it feel like a conversation with an operator, not a pitch deck. Include the key fund terms (8% pref, 80/20 carry, 25–30% target IRR, $1M minimum)." },
    { label: "LP Objection Handler", icon: "🛡️", prompt: "Give me complete handling language for these 5 LP objections Catskill faces: (1) No prior fund, emerging manager risk — (2) Small team, execution bandwidth — (3) Non-traditional PE pedigree, operators not investors — (4) Fund I premium, why not wait for Fund II — (5) Deal-by-deal vs. fund structure, less certainty. I want honest, confident language that turns each into a differentiation point. No hedging. These need to stand up in a real LP meeting." },
    { label: "Quarterly Market Brief — ICT", icon: "📡", prompt: "Write a short (400-word) quarterly market intelligence brief for LP audiences on why the AI infrastructure buildout continues to be the single most important demand driver for Catskill's target companies. Reference current hyperscaler capex trends, data center power and cooling market dynamics, and why LMM industrial manufacturers are the most under-appreciated beneficiaries of this cycle. This goes out to all LP prospects as a quarterly touchpoint." },
    { label: "Endowment Pitch Deck Narrative", icon: "🏛️", prompt: "Write a 5-slide narrative for our pitch to university endowments and foundations. Frame: (1) Why LMM industrials now — structural macro thesis; (2) Why Catskill specifically — operator-first, ICT thesis, verifiable track record; (3) Why operator-led outperforms in this market — returns data, qualitative differentiation; (4) Deal economics and pipeline momentum; (5) Why this is a time-sensitive vintage opportunity. Voice: rigorous, institutional, but not corporate-generic." },
  ],
};

// ─── LOGO SVG ─────────────────────────────────────────────────────────────────

const CatskillLogo = ({ size = 44 }) => (
  <svg width={size * 2.6} height={size} viewBox="0 0 130 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="2,44 30,6 50,28 40,44" fill="#1a5c3a"/>
    <polygon points="2,44 30,6 58,44" fill="#1e6b43"/>
    <polygon points="44,44 58,20 72,44" fill="#1e6b43"/>
    <polygon points="60,44 72,16 86,44" fill="#3db857"/>
    <text x="0" y="58" fontFamily="'Arial Black','Arial',sans-serif" fontWeight="900" fontSize="13" fill="#1a5c3a" letterSpacing="0.8" style={{display:"none"}}>Catskill Partners</text>
  </svg>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function MorganColeV3() {
  const [mode, setMode] = useState("general");
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState({
    general: [{ role: "assistant", content: "Morning. Morgan Cole, VP of Marketing — Catskill Partners.\n\nFull deck loaded, live pipeline baked in (14 active deals), IB tracker current as of this week. What are we building today?\n\nOr switch to a campaign mode — Deal Sourcing, IB Relations, or LP Campaign — using the tabs above." }],
    dealSourcing: [{ role: "assistant", content: "Deal Sourcing mode. I know your pipeline cold — 14 active opps, 5 Star Electric at IOI stage, Cypress at management meeting, seven power distribution deals in screening.\n\nPick a quick action or tell me what you need: owner outreach, Instantly.ai sequences, sector-specific campaigns, follow-ups on specific deals." }],
    ibRelations: [{ role: "assistant", content: "IB Relations mode. I've got your full tracker loaded — 35+ contacts across Lincoln, Hennepin, Harris Williams, Cascadia, Piper Sandler, G2, BGL, Stout, Dinan, and more.\n\nPriority this week: Piper Sandler meeting (Anna Zumwinkle, 3/9), G2 Capital meeting (Keleher, 3/9), and getting Matt White at Harris Williams to let us into the Lakeshore process.\n\nWhat do you need?" }],
    lpCampaign: [{ role: "assistant", content: "LP Campaign mode. Two hot prospects right now:\n\n• Develop Capital (Tom Mucha) — $20–30M Fund interest, $5–15M co-invest, tied to a $50B charity mandate. Spoke 2/26.\n• University of Illinois Fund (Seth Wellner + Patrice Haryanto) — $3B endowment, building IS shortlist of 15–20. Spoke 2/27–2/28. If you haven't followed up in the last 2 weeks, you're late.\n\nWhat do you need — outreach, LP materials, objection prep?" }],
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mode]);

  const sendMessage = async (content) => {
    if (!content.trim() || loading) return;
    const currentMessages = messages[mode];
    const newMessages = [...currentMessages, { role: "user", content }];
    setMessages(prev => ({ ...prev, [mode]: newMessages }));
    setInput("");
    setLoading(true);

    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPTS[mode],
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
    };
    if (useWebSearch) {
      body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      const textBlocks = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
      const reply = textBlocks || "No response received.";
      setMessages(prev => ({ ...prev, [mode]: [...prev[mode], { role: "assistant", content: reply }] }));
    } catch (e) {
      setMessages(prev => ({ ...prev, [mode]: [...prev[mode], { role: "assistant", content: "API error — check connection." }] }));
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (text) => text.split("\n").map((line, i) => {
    if (!line) return <div key={i} style={{ height: "7px" }} />;
    if (/^#{1,3}\s/.test(line)) return <p key={i} style={{ color: "#3db857", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", marginTop: "14px", marginBottom: "5px" }}>{line.replace(/^#+\s/, "")}</p>;
    if (/^━+$/.test(line)) return <hr key={i} style={{ border: "none", borderTop: "1px solid rgba(76,175,80,0.2)", margin: "10px 0" }} />;
    if (/^[•\-]\s/.test(line)) return <p key={i} style={{ marginLeft: "10px", color: "#aac8b4", lineHeight: 1.65, marginTop: "2px", fontSize: "13.5px" }}>› {line.slice(2)}</p>;
    if (/^\d+\.\s/.test(line)) return <p key={i} style={{ marginLeft: "10px", color: "#aac8b4", lineHeight: 1.65, marginTop: "2px", fontSize: "13.5px" }}>{line}</p>;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} style={{ lineHeight: 1.7, marginTop: "2px", fontSize: "13.5px" }}>
        {parts.map((p, j) => p.startsWith("**") ? <strong key={j} style={{ color: "#8ecfa0" }}>{p.replace(/\*\*/g, "")}</strong> : p)}
      </p>
    );
  });

  const modeConfig = {
    general: { label: "Morgan Cole · VP Marketing", color: "#3db857", bg: "rgba(61,184,87,0.07)" },
    dealSourcing: { label: "Deal Sourcing Campaign", color: "#f0a830", bg: "rgba(240,168,48,0.07)" },
    ibRelations: { label: "IB Relationship Management", color: "#4ab4f0", bg: "rgba(74,180,240,0.07)" },
    lpCampaign: { label: "LP & Family Office Campaign", color: "#b47af0", bg: "rgba(180,122,240,0.07)" },
  };
  const mc = modeConfig[mode];
  const currentMsgs = messages[mode];
  const currentQuickActions = mode === "general" ? null : QUICK_ACTIONS[mode];
  const stageColor = (s) => {
    if (s === "IOI") return "#f0a830";
    if (s === "Mgmt Mtg") return "#3db857";
    if (s === "Screening") return "#4ab4f0";
    return "#8a8a8a";
  };
  const strengthColor = (s) => {
    if (s === "Strong" || s === "Active") return "#3db857";
    if (s === "Developing") return "#f0a830";
    return "#8a8a8a";
  };

  return (
    <div style={{ fontFamily: "'Georgia','Times New Roman',serif", background: "linear-gradient(160deg,#08140f 0%,#0b1a13 60%,#071210 100%)", minHeight: "100vh", color: "#d4e6d9", display: "flex", flexDirection: "column" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#2d6a4f;border-radius:2px}
        .mode-btn{background:none;border:none;cursor:pointer;padding:8px 14px;font-family:'Georgia',serif;font-size:11px;font-weight:400;letter-spacing:0.8px;text-transform:uppercase;transition:all .2s;border-bottom:2px solid transparent;color:#3a5e45;white-space:nowrap}
        .mode-btn.active{border-bottom-color:var(--mc);color:var(--mc)}
        .mode-btn:hover:not(.active){color:#89c994}
        .tab-btn{background:none;border:none;cursor:pointer;padding:7px 14px;font-family:'Georgia',serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;transition:all .2s;border-bottom:2px solid transparent;color:#2d4d35}
        .tab-btn.active{color:#3db857;border-bottom-color:#3db857}
        .tab-btn:hover:not(.active){color:#6aaa7a}
        .qa-btn{background:rgba(13,31,22,.8);border:1px solid rgba(76,175,80,.18);border-radius:7px;padding:11px 13px;cursor:pointer;font-family:'Georgia',serif;font-size:12px;color:#6aaa7a;text-align:left;transition:all .25s;display:flex;align-items:flex-start;gap:9px}
        .qa-btn:hover{background:rgba(76,175,80,.09);border-color:rgba(76,175,80,.4);color:#a8d5b0;transform:translateY(-1px);box-shadow:0 4px 16px rgba(76,175,80,.1)}
        .send-btn{background:linear-gradient(135deg,#1c5e42,#2d6a4f);border:1px solid rgba(76,175,80,.4);border-radius:6px;padding:10px 20px;color:#c8e6cc;font-family:'Georgia',serif;font-weight:700;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
        .send-btn:hover:not(:disabled){background:linear-gradient(135deg,#2d6a4f,#3d8a60);box-shadow:0 4px 18px rgba(76,175,80,.22);transform:translateY(-1px)}
        .send-btn:disabled{opacity:.3;cursor:not-allowed}
        .msg-user{background:rgba(76,175,80,.07);border:1px solid rgba(76,175,80,.2);border-radius:10px 10px 4px 10px;padding:12px 16px;max-width:78%;align-self:flex-end;font-size:14px;line-height:1.65;color:#d4e6d9}
        .msg-agent{background:rgba(13,31,22,.9);border:1px solid rgba(76,175,80,.15);border-radius:4px 10px 10px 10px;padding:14px 18px;max-width:90%;align-self:flex-start;font-size:14px;line-height:1.7;color:#c2d9c8}
        .msg-lbl{font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:5px}
        .input-ta{background:rgba(13,31,22,.9);border:1px solid rgba(76,175,80,.25);border-radius:8px;padding:11px 15px;font-family:'Georgia',serif;font-size:14px;color:#d4e6d9;resize:none;outline:none;flex:1;transition:border-color .2s;min-height:42px;max-height:110px}
        .input-ta:focus{border-color:rgba(76,175,80,.5)}
        .input-ta::placeholder{color:#2a4030}
        .copy-btn{background:rgba(13,31,22,.7);border:1px solid rgba(76,175,80,.2);border-radius:4px;padding:3px 9px;font-size:10px;font-family:'Georgia',serif;color:#3d6a4a;cursor:pointer;transition:all .2s;margin-top:5px}
        .copy-btn:hover{color:#3db857;border-color:rgba(76,175,80,.4)}
        .pulse{width:7px;height:7px;background:#3db857;border-radius:50%;animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(61,184,87,.4)}50%{opacity:.8;box-shadow:0 0 0 5px rgba(61,184,87,0)}}
        .typing span{display:inline-block;width:5px;height:5px;border-radius:50%;background:#3db857;margin:0 2px;animation:bounce 1.2s infinite;opacity:.5}
        .typing span:nth-child(2){animation-delay:.2s}
        .typing span:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}
        .card{background:rgba(13,31,22,.8);border:1px solid rgba(76,175,80,.18);border-radius:8px;padding:14px;margin-bottom:10px}
        .card-title{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#3db857;margin-bottom:9px}
        .row{display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(76,175,80,.07);gap:10px}
        .row:last-child{border-bottom:none}
        .badge{display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.5px}
        .toggle-btn{background:none;border:1px solid rgba(76,175,80,.25);border-radius:4px;padding:4px 10px;font-size:10px;font-family:'Georgia',serif;cursor:pointer;transition:all .2s;letter-spacing:.5px}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid rgba(76,175,80,.18)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(8,20,15,.97)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <CatskillLogo size={38} />
          <div style={{ borderLeft: "1px solid rgba(76,175,80,.22)", paddingLeft: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.3px" }}>Catskill Partners</div>
            <div style={{ fontSize: "10px", color: "#3db857", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "2px" }}>Morgan Cole · VP of Marketing</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button className="toggle-btn" onClick={() => setUseWebSearch(p => !p)} style={{ color: useWebSearch ? "#3db857" : "#4a7a56", borderColor: useWebSearch ? "rgba(61,184,87,.45)" : "rgba(76,175,80,.2)" }}>
            {useWebSearch ? "🔍 Web Search: ON" : "🔍 Web Search: OFF"}
          </button>
          <div className="pulse" />
        </div>
      </div>

      {/* ── MODE TABS ── */}
      <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid rgba(76,175,80,.12)", background: "rgba(8,20,15,.85)", overflowX: "auto" }}>
        {Object.entries(modeConfig).map(([key, cfg]) => (
          <button key={key} className={`mode-btn ${mode === key ? "active" : ""}`} style={{ "--mc": cfg.color }} onClick={() => { setMode(key); setActiveTab("chat"); }}>
            {key === "general" ? "General" : key === "dealSourcing" ? "Deal Sourcing" : key === "ibRelations" ? "IB Relations" : "LP Campaign"}
          </button>
        ))}
      </div>

      {/* ── MODE BADGE ── */}
      <div style={{ padding: "6px 20px", background: mc.bg, borderBottom: "1px solid rgba(76,175,80,.1)", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: mc.color, flexShrink: 0 }} />
        <span style={{ fontSize: "10px", color: mc.color, letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>{mc.label}</span>
      </div>

      {/* ── SUB TABS ── */}
      <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid rgba(76,175,80,.1)", background: "rgba(8,20,15,.7)" }}>
        <button className={`tab-btn ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>Chat</button>
        {currentQuickActions && <button className={`tab-btn ${activeTab === "quick" ? "active" : ""}`} onClick={() => setActiveTab("quick")}>Quick Actions</button>}
        <button className={`tab-btn ${activeTab === "pipeline" ? "active" : ""}`} onClick={() => setActiveTab("pipeline")}>Pipeline</button>
        <button className={`tab-btn ${activeTab === "bankers" ? "active" : ""}`} onClick={() => setActiveTab("bankers")}>Bankers</button>
        <button className={`tab-btn ${activeTab === "lps" ? "active" : ""}`} onClick={() => setActiveTab("lps")}>LPs</button>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "calc(100vh - 152px)" }}>

        {/* CHAT */}
        {activeTab === "chat" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {currentMsgs.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div className="msg-lbl" style={{ color: m.role === "user" ? mc.color : "#2d6a4f", padding: m.role === "user" ? "0 2px 0 0" : "0 0 0 2px" }}>
                    {m.role === "user" ? "YOU" : "MORGAN COLE · CATSKILL PARTNERS"}
                  </div>
                  <div className={m.role === "user" ? "msg-user" : "msg-agent"}>{formatMessage(m.content)}</div>
                  {m.role === "assistant" && <button className="copy-btn" onClick={() => navigator.clipboard.writeText(m.content)}>copy ↗</button>}
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div className="msg-lbl" style={{ color: "#2d6a4f" }}>MORGAN COLE · CATSKILL PARTNERS</div>
                  <div className="msg-agent"><div className="typing"><span /><span /><span /></div></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: "12px 20px 18px", borderTop: "1px solid rgba(76,175,80,.12)", background: "rgba(8,20,14,.85)", display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <textarea className="input-ta" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={mode === "dealSourcing" ? "Owner outreach, deal follow-ups, sector campaigns..." : mode === "ibRelations" ? "Banker touchpoints, deal criteria, relationship strategy..." : mode === "lpCampaign" ? "LP briefs, follow-ups, objection handling, fund materials..." : "LP materials, thought leadership, brand copy, LinkedIn posts..."} rows={1} />
              <button className="send-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>Send →</button>
            </div>
          </>
        )}

        {/* QUICK ACTIONS */}
        {activeTab === "quick" && currentQuickActions && (
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
            <div style={{ background: `linear-gradient(135deg, rgba(${mode === "dealSourcing" ? "240,168,48" : mode === "ibRelations" ? "74,180,240" : "180,122,240"},.12), rgba(13,31,22,.8))`, border: `1px solid ${mc.color}33`, borderRadius: "8px", padding: "12px 18px", marginBottom: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3px", color: mc.color, textTransform: "uppercase" }}>{mc.label}</div>
              <div style={{ fontSize: "10px", color: "#4a7a56", marginTop: "3px" }}>Click to fire into chat</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {currentQuickActions.map((a, i) => (
                <button key={i} className="qa-btn" onClick={() => { setActiveTab("chat"); setTimeout(() => sendMessage(a.prompt), 80); }}>
                  <span style={{ fontSize: "17px", flexShrink: 0 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: mc.color, fontSize: "12px", marginBottom: "3px" }}>{a.label}</div>
                    <div style={{ fontSize: "10px", color: "#2d5038", lineHeight: 1.5 }}>{a.prompt.slice(0, 60)}...</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PIPELINE */}
        {activeTab === "pipeline" && (
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
            <div className="card">
              <div className="card-title">Active Pipeline — 14 Deals (March 2026)</div>
              <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
                {[["14", "Active"], ["1", "IOI Stage"], ["2", "Mgmt Mtg"], ["1,700+", "Outreach Active"]].map(([n, l]) => (
                  <div key={l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#3db857" }}>{n}</div>
                    <div style={{ fontSize: "10px", color: "#4a7a56", letterSpacing: ".5px" }}>{l}</div>
                  </div>
                ))}
              </div>
              {PIPELINE.map((d, i) => (
                <div key={i} className="row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", color: d.hot ? "#f0a830" : "#c2d9c8", fontWeight: d.hot ? 700 : 400 }}>
                      {d.hot ? "🔥 " : ""}{d.company}
                    </div>
                    <div style={{ fontSize: "10px", color: "#4a7a56", marginTop: "2px" }}>{d.segment} · {d.location} · {d.size}</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                    <span className="badge" style={{ background: `${stageColor(d.stage)}22`, color: stageColor(d.stage), border: `1px solid ${stageColor(d.stage)}44` }}>{d.stage}</span>
                    <span style={{ fontSize: "10px", color: "#2d5038" }}>{d.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BANKERS */}
        {activeTab === "bankers" && (
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
            <div className="card">
              <div className="card-title">IB / BD Relationships — 35+ Contacts</div>
              {IB_CONTACTS.map((c, i) => (
                <div key={i} className="row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", color: "#c2d9c8", fontWeight: 600 }}>{c.firm}</div>
                    <div style={{ fontSize: "11px", color: "#4a7a56", marginTop: "2px" }}>{c.contact} · Last: {c.lastTouch}</div>
                    <div style={{ fontSize: "10px", color: "#2d5038", marginTop: "2px" }}>{c.note}</div>
                  </div>
                  <span className="badge" style={{ background: `${strengthColor(c.strength)}22`, color: strengthColor(c.strength), border: `1px solid ${strengthColor(c.strength)}44`, flexShrink: 0 }}>{c.strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LPs */}
        {activeTab === "lps" && (
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
            <div className="card">
              <div className="card-title">LP & Capital Prospects</div>
              {LP_PROSPECTS.map((l, i) => (
                <div key={i} className="row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", color: "#c2d9c8", fontWeight: 600 }}>{l.name}</div>
                    <div style={{ fontSize: "11px", color: "#4a7a56", marginTop: "2px" }}>{l.contact} · {l.type} · {l.size}</div>
                    <div style={{ fontSize: "10px", color: l.note.includes("PRIORITY") ? "#f0a830" : "#2d5038", marginTop: "2px" }}>{l.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
