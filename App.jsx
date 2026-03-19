import { useState, useRef, useEffect } from "react";

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  green: "#1a5c3a", greenBright: "#3db857", greenLight: "#f0f7f3",
  black: "#1a1a1a", gray: "#4a4a4a", grayLight: "#f5f5f5",
  border: "#e0e0e0", white: "#ffffff",
  gold: "#c8922a", blue: "#2563eb", teal: "#0d7377",
};

// ─── SYSTEM PROMPT BASE ───────────────────────────────────────────────────────
const BASE = `You are Morgan Cole, VP of Marketing at Catskill Partners. You are a seasoned B2B and PE marketing executive with 12+ years in industrial, manufacturing, and private equity marketing. Direct, clear, operator-credibility voice — no buzzwords, no fluff.

FIRM: Catskill Partners — operator-first lower-middle-market PE firm acquiring founder/family-owned industrial manufacturers ($2–20M EBITDA), repositioning them as strategic partners in ICT/data center supply chains.
BRAND: CLARITY. CRAFT. CAPITAL. — We are operators first. | info@catskillpartners.com
BRIAN STEEL (Managing Partner): CEO Tenere 2017–2022 → ~30% IRR, >10x MOIC (Watermill Group best in 30-year history). CEO Cadrex 2022–2025 → 11 acquisitions, 23 facilities, $500M+ platform in 18 months, 300bps EBITDA expansion.
MIKE FULLER (Managing Partner): CFO/BOA Tenere → co-delivered 11x MOIC. Deep operational finance background.
FUND I: $250M target. IRR target 25–30%, MOIC 3.0–4.0x. 6–8 platform companies.
THESIS: Three converging forces — (1) Succession Wave: 60%+ of LMM industrial owners are 55+. (2) Demand Supercycle: $250B+ data center mech/systems spend through 2030. (3) Supply Gap: top 5 players hold <10% combined share in target segments.
SEGMENTS: Advanced Mfg & Industrial Tech (casters/mobility, 8–12% CAGR) · Engineered Materials & ESD/Thermal (2x CAGR) · Precision Components & Power Distribution (14.8% CAGR).
POSITIONING: "The right operators. The right moment. The only platform built for both."`;

const MODES = {
  research: BASE + `\nMODE: Market Research. Produce rigorous, data-forward research reports and competitive intelligence for Catskill Partners. Output should be well-structured, cite real market dynamics, and be actionable for an operator-led PE firm. Cover sector trends, competitive landscape, end-market dynamics, and investment implications. Weekly cadence. Institutional quality.`,

  content: BASE + `\nMODE: Content & Articles. Draft high-quality written content for Catskill Partners — website articles, thought leadership pieces, op-eds, press releases, executive bylines, and firm updates. Voice is operator-credibility: specific, grounded, direct. No generic PE language. Brian Steel's perspective is the anchor — he has sat in the seat.`,

  linkedin: BASE + `\nMODE: LinkedIn Content for Catskill Partners company page. Posts must: Lead with a strong hook (first 2 lines compel 'see more'). 150–280 words. Sound like Brian Steel — operator credibility, specific numbers, real insight. End with clear POV or CTA. Avoid buzzwords. Biweekly cadence.`,

  presentations: BASE + `\nMODE: Presentation Content. Generate structured slide content, narratives, and talking points for Catskill Partners presentations — investor decks, LP updates, firm overviews, market briefings, and conference materials. Use the Catskill template structure: Title → Thesis → Market Evidence → Team/Track Record → Strategy → Opportunity. Output should be slide-ready: clear headlines, 3–5 bullet points per slide, data-backed, institutional quality.`,
};

// ─── LINKEDIN SCHEDULE ────────────────────────────────────────────────────────
const LI_SCHEDULE = [
  { date:"Mar 24, 2026", topic:"Founder Succession in Manufacturing", theme:"70%+ of US LMM industrial owners are 55+. The succession wave is real — and most aren't prepared for what comes next.", status:"due" },
  { date:"Apr 7, 2026", topic:"Operator vs. Investor PE", theme:"What it actually means to run a factory vs. manage a spreadsheet — and why it matters when you're acquiring one.", status:"upcoming" },
  { date:"Apr 21, 2026", topic:"ICT Supply Chain: North American Reshoring", theme:"Hyperscalers are building in the US at unprecedented scale. Who supplies the precision components?", status:"upcoming" },
  { date:"May 5, 2026", topic:"LMM Manufacturing: The Overlooked Asset Class", theme:"Why institutional LPs are sleeping on lower-middle-market industrial manufacturing — and what the return data says.", status:"upcoming" },
  { date:"May 19, 2026", topic:"The 300bps EBITDA Story", theme:"What operational excellence actually looks like across a $500M manufacturing platform. The numbers behind the numbers.", status:"upcoming" },
  { date:"Jun 2, 2026", topic:"The $250B Demand Supercycle", theme:"Data center mechanical and systems spend through 2030. Most manufacturers have no idea they're sitting on the edge of this market.", status:"upcoming" },
];

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
const QA = {
  research: [
    { icon:"📊", label:"Weekly Market Research Report", prompt:"Generate a weekly market research report for Catskill Partners covering: (1) LMM industrial M&A activity this week, (2) ICT/data center supply chain news, (3) advanced manufacturing sector trends, (4) notable founder/family-owned business transactions, (5) macro factors affecting target segments. Structured executive brief format." },
    { icon:"🏭", label:"Advanced Mfg Sector Deep Dive", prompt:"Produce a competitive landscape analysis for the advanced manufacturing and precision components sector. Cover: market size, CAGR, top players, fragmentation dynamics, M&A multiples, and why this segment is attractive for Catskill's thesis. Include ICT/data center end-market demand drivers." },
    { icon:"⚡", label:"Power Distribution Segment Report", prompt:"Research report on the US power distribution equipment market — switchgear, transfer switches, PDUs, eHouse substations. Market size, key players, supply/demand dynamics, hyperscaler procurement trends, and acquisition opportunity assessment for a consolidation platform." },
    { icon:"🔄", label:"Succession Wave Analysis", prompt:"Analyze the founder/family-owned manufacturing succession wave in the US LMM market. Data on owner age demographics, exit readiness, deal structures preferred by sellers, and why operator-led buyers have a structural advantage over financial engineers." },
    { icon:"🌐", label:"ICT End-Market Demand Brief", prompt:"Brief on ICT infrastructure demand drivers for advanced manufacturing: hyperscaler capex commitments, AI infrastructure buildout, data center mechanical component spend, telecom infrastructure. Frame through the lens of Catskill's repositioning thesis for acquired manufacturers." },
    { icon:"🏆", label:"Competitive Intel: PE Landscape", prompt:"Competitive analysis of PE firms active in LMM industrial manufacturing M&A. Generalists vs. operator-led specialists. Where is Catskill Partners differentiated? Typical entry multiples, hold periods, and value creation approaches by competitor type." },
  ],
  content: [
    { icon:"✍️", label:"Operator-First Thought Leadership", prompt:"Write a 600-800 word thought leadership article from Brian Steel's perspective on why operator-led PE creates superior outcomes in manufacturing acquisitions vs. financial engineering. Ground it in specific operational experience: running factories, vendor management, customer accountability. For the Catskill Partners website." },
    { icon:"📰", label:"ICT Supply Chain Article", prompt:"Write a 500-700 word article on how the AI infrastructure buildout is creating a demand supercycle for advanced manufacturers who can reposition into ICT supply chains. Include data on hyperscaler capex, demand for precision components, and why most LMM manufacturers are unaware of this opportunity. Catskill Partners byline." },
    { icon:"🎯", label:"Firm Overview — About Us", prompt:"Draft a compelling 'About Catskill Partners' page for the firm's website. Cover: who we are (operators first), what we do (acquire and reposition advanced manufacturers), why we're different (track record, ICT thesis, hands-on partnership), and who we partner with (founder-owned businesses ready for next phase). 400-500 words." },
    { icon:"📣", label:"Press Release — New Acquisition", prompt:"Draft a press release template for announcing a Catskill Partners platform acquisition. Include: firm intro paragraph, deal rationale, quote from Brian Steel as operator-partner, target company description placeholder, strategic context (ICT thesis), and boilerplate. Professional newswire format." },
    { icon:"📬", label:"Monthly Newsletter", prompt:"Draft the Catskill Partners monthly firm update newsletter. Sections: Market Pulse (2-3 key sector developments), Firm Activity (pipeline activity, meetings, conferences), Team Insight (Brian or Mike perspective piece), and Looking Ahead. Tone: institutional but personal. 400-600 words." },
    { icon:"🔖", label:"Case Study — Tenere Track Record", prompt:"Write a case study on the Tenere investment and exit — Catskill's anchor track record. Situation (op loss of $8M), approach (operator-led turnaround), actions (revenue growth, cost discipline, team), results (50% organic revenue growth, ~11x MOIC, ~30% IRR, Watermill's best in 30+ years). 300-400 words for website/deck use." },
  ],
  linkedin: [
    { icon:"🔵", label:"Operator-First Post", prompt:"Write a LinkedIn post for Catskill Partners on why operator-led PE is fundamentally different from financial engineering in manufacturing acquisitions. Lead with a hook that every manufacturing owner has heard the standard PE pitch. 150-280 words. Brian Steel's voice — specific, direct, no buzzwords." },
    { icon:"🏭", label:"Founder Succession Hook", prompt:"Write a LinkedIn post on the manufacturing succession wave — 60%+ of LMM industrial owners are 55+. What does that mean for sellers? What should they actually look for in a partner? Strong hook, operator perspective, ends with a clear POV. 150-280 words." },
    { icon:"⚡", label:"$250B Demand Opportunity", prompt:"Write a LinkedIn post on the AI infrastructure buildout creating a demand supercycle for advanced manufacturers. Lead with a stat that will stop the scroll. Frame for both owners (opportunity they may not see) and LPs (why this is the right moment). 150-280 words." },
    { icon:"📈", label:"Track Record Post", prompt:"Write a LinkedIn post anchored on Brian Steel's operator track record — Tenere (11x MOIC, ~30% IRR) and Cadrex (11 acquisitions, 23 facilities, 300bps EBITDA expansion). Not a brag post — frame it as proof that operational experience creates returns. 150-280 words." },
    { icon:"🤝", label:"Partnership Philosophy Post", prompt:"Write a LinkedIn post on what Catskill Partners actually means by 'partnership' with a founder selling their business. We've taken the midnight call, traveled to vendors, carried the sales bag. The next chapter deserves someone who has done the work. 150-280 words." },
    { icon:"🔍", label:"Supply Gap Post", prompt:"Write a LinkedIn post on the supply gap in target manufacturing segments — top 5 players hold less than 10% combined market share. No dominant national platforms. Frame this as the exact right moment for an operator-led consolidator. 150-280 words." },
  ],
  presentations: [
    { icon:"📑", label:"Fund I Investor Overview Deck", prompt:"Generate complete slide content for a Catskill Partners Fund I investor overview presentation. Slides: (1) Cover, (2) Three Converging Forces, (3) Our Thesis, (4) Target Profile, (5) Value Creation Approach, (6) Team & Track Record, (7) Fund Terms, (8) Why Now. For each slide: headline, 4-5 bullets, featured data point. Catskill template format." },
    { icon:"🏢", label:"Firm One-Pager", prompt:"Generate content for a Catskill Partners one-page firm overview. Sections: Who We Are, What We Do (investment criteria), How We Create Value (operator approach, ICT thesis), Track Record (Tenere + Cadrex highlights), Fund Terms. Single-page leave-behind format." },
    { icon:"📊", label:"Market Opportunity Slide Set", prompt:"Generate slide content for a 4-slide market opportunity section. Slide 1: Succession Wave (60%+ owners 55+). Slide 2: Demand Supercycle ($250B+ ICT spend). Slide 3: Supply Gap (<10% combined share). Slide 4: Why Catskill / Why Now. Each: headline + 4 bullets + featured stat." },
    { icon:"🏆", label:"Track Record Slide", prompt:"Generate a track record slide for Catskill Partners investor presentations. Tenere: situation, actions, results (11x MOIC, ~30% IRR, $8M op loss to $7M profit, 50% revenue growth). Cadrex: 11 acquisitions, 23 facilities, $500M+ platform, 300bps EBITDA expansion in 18 months. Single slide with headline, two deal summaries, callout stats." },
    { icon:"🎤", label:"Conference Talking Points", prompt:"Generate talking points for Brian Steel presenting Catskill Partners at an industrial PE conference. Firm intro (30 sec), thesis (60 sec), differentiation from generalists (60 sec), what we look for in targets (30 sec), call to action for bankers/sellers in the room (30 sec). Conversational, operator-credibility voice." },
    { icon:"📅", label:"LP Quarterly Update", prompt:"Generate content for a Catskill Partners LP quarterly update presentation. Sections: Quarter Highlights, Market Commentary (3 key thesis-relevant developments), Pipeline Activity (high-level), Team Updates, Outlook. 5-6 slides, each with headline and 3-4 bullets. Institutional tone." },
  ],
};

// ─── AGENT TASK TYPES ─────────────────────────────────────────────────────────
const AGENT_TASKS = {
  research: [
    { v:"weekly_report",     l:"Weekly Market Research Report" },
    { v:"sector_analysis",   l:"Sector Deep Dive / Analysis" },
    { v:"competitive_intel", l:"Competitive Intelligence Brief" },
    { v:"end_market_brief",  l:"End-Market Demand Brief" },
    { v:"target_profile",    l:"Target Company / Segment Profile" },
    { v:"macro_brief",       l:"Macro / Industry Trend Brief" },
  ],
  content: [
    { v:"article",           l:"Website Article / Thought Leadership" },
    { v:"press_release",     l:"Press Release" },
    { v:"newsletter",        l:"Newsletter / Firm Update" },
    { v:"case_study",        l:"Case Study" },
    { v:"bio",               l:"Executive Bio / Team Profile" },
    { v:"website_copy",      l:"Website Copy / Page Section" },
  ],
  linkedin: [
    { v:"linkedin_post",     l:"LinkedIn Post (Catskill Page)" },
    { v:"post_series",       l:"Multi-Post Content Series" },
    { v:"event_post",        l:"Event / Conference Post" },
    { v:"comment_response",  l:"Comment / Engagement Response" },
  ],
  presentations: [
    { v:"full_deck",         l:"Full Investor Deck" },
    { v:"slide_section",     l:"Deck Section / Slide Set" },
    { v:"one_pager",         l:"Firm One-Pager" },
    { v:"talking_points",    l:"Talking Points / Speaker Notes" },
    { v:"lp_update",         l:"LP Quarterly Update" },
    { v:"conference_deck",   l:"Conference / Event Presentation" },
  ],
};

const TONES = [
  { v:"operator",      l:"Operator (direct, factory-floor credibility)" },
  { v:"institutional", l:"Institutional (rigorous, data-forward)" },
  { v:"executive",     l:"Executive (measured, boardroom-ready)" },
  { v:"editorial",     l:"Editorial (thought leadership, byline-ready)" },
  { v:"concise",       l:"Concise (one-pager / summary format)" },
];

const FORMATS = [
  { v:"article",  l:"Long-form Article (600–900 words)" },
  { v:"brief",    l:"Executive Brief (300–400 words)" },
  { v:"bullets",  l:"Slide-Ready Bullets" },
  { v:"report",   l:"Structured Report with Sections" },
  { v:"post",     l:"LinkedIn Post (150–280 words)" },
  { v:"script",   l:"Talk Track / Script" },
];

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const Logo = ({ size = 38 }) => (
  <svg width={size * 1.6} height={size} viewBox="0 0 64 40" fill="none">
    <polygon points="4,36 20,10 29,24 22,24" fill="#1a5c3a" />
    <polygon points="18,36 36,4 54,36" fill="#1a5c3a" />
    <polygon points="36,4 44,18 36,14 28,18" fill="#3db857" />
    <rect x="4" y="35" width="56" height="2" rx="1" fill="#1a5c3a" />
  </svg>
);

// ─── FORMAT TEXT ──────────────────────────────────────────────────────────────
const fmt = (text) =>
  text?.split("\n").map((l, i) => {
    if (!l) return <div key={i} style={{ height: 7 }} />;
    if (l.startsWith("## ")) return <div key={i} style={{ fontWeight:700, fontSize:15, marginTop:14, color:"#1a5c3a" }}>{l.slice(3)}</div>;
    if (l.startsWith("# "))  return <div key={i} style={{ fontWeight:700, fontSize:17, marginTop:14, color:"#1a1a1a" }}>{l.slice(2)}</div>;
    if (l.startsWith("**") && l.endsWith("**")) return <div key={i} style={{ fontWeight:700, marginTop:10 }}>{l.slice(2,-2)}</div>;
    if (l.startsWith("• ") || l.startsWith("- ")) return <div key={i} style={{ paddingLeft:14, marginTop:3, display:"flex", gap:6 }}><span style={{ color:"#3db857", flexShrink:0 }}>·</span><span>{l.slice(2)}</span></div>;
    if (l.match(/^\d+\./)) return <div key={i} style={{ paddingLeft:14, marginTop:3 }}>{l}</div>;
    return <div key={i}>{l}</div>;
  });

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode]           = useState("research");
  const [tab, setTab]             = useState("agent");
  const [msgs, setMsgs]           = useState({ research:[], content:[], linkedin:[], presentations:[] });
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [agentOut, setAgentOut]   = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [savedOuts, setSavedOuts] = useState([]);
  const [liOut, setLiOut]         = useState(null);
  const [liLoading, setLiLoading] = useState(false);
  const [drafts, setDrafts]       = useState([]);
  const [liForm, setLiForm]       = useState({ topicIdx:0, custom:"", data:"", angle:"" });
  const [form, setForm]           = useState({ taskType:"", topic:"", audience:"", context:"", tone:"operator", format:"article", notes:"" });
  const endRef = useRef(null);
  const isLI = mode === "linkedin";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  const callAPI = async (sys, userMsg, history = []) => {
    const apiMsgs = history.length ? history : [{ role:"user", content:userMsg }];
    const body = { model:"claude-sonnet-4-20250514", max_tokens:1500, system:sys, messages:apiMsgs };
    if (webSearch) body.tools = [{ type:"web_search_20250305", name:"web_search" }];
    const r = await fetch("/api/chat", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) });
    const d = await r.json();
    return d.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "No response.";
  };

  const sendChat = async (text) => {
    if (!text.trim() || loading) return;
    setInput("");
    const newMsg = { role:"user", content:text };
    const updated = [...msgs[mode], newMsg];
    setMsgs(p => ({ ...p, [mode]:updated }));
    setLoading(true); setTab("chat");
    try {
      const reply = await callAPI(MODES[mode] || MODES.research, "", updated.map(m => ({ role:m.role, content:m.content })));
      setMsgs(p => ({ ...p, [mode]:[...p[mode], { role:"assistant", content:reply }] }));
    } catch (e) {
      setMsgs(p => ({ ...p, [mode]:[...p[mode], { role:"assistant", content:"Error: " + e.message }] }));
    }
    setLoading(false);
  };

  const runAgent = async () => {
    if (!form.taskType || !form.context) return;
    setAgentLoading(true); setAgentOut(null);
    const prompt = `TASK TYPE: ${form.taskType}
OUTPUT FORMAT: ${form.format}
TONE: ${form.tone}
${form.topic ? `TOPIC / SUBJECT: ${form.topic}` : ""}
${form.audience ? `TARGET AUDIENCE: ${form.audience}` : ""}

CONTEXT & BRIEF:
${form.context}
${form.notes ? `\nADDITIONAL NOTES: ${form.notes}` : ""}

Deliver the full output now. No meta-commentary — just the finished piece, ready to use.`;
    try {
      const text = await callAPI(MODES[mode] || MODES.research, prompt);
      setAgentOut({ text, ts:new Date().toLocaleTimeString(), form:{ ...form } });
    } catch (e) {
      setAgentOut({ text:"Error: " + e.message, ts:new Date().toLocaleTimeString() });
    }
    setAgentLoading(false);
  };

  const genLIPost = async () => {
    setLiLoading(true); setLiOut(null);
    const topic = liForm.custom || LI_SCHEDULE[liForm.topicIdx];
    const topicStr = typeof topic === "string" ? topic : topic.topic;
    const themeStr = typeof topic === "object" ? topic.theme : "";
    const prompt = `Generate a LinkedIn post for the Catskill Partners company page.

TOPIC: ${topicStr}
THEME: ${themeStr}
${liForm.data ? `DATA TO INCLUDE: ${liForm.data}` : ""}
${liForm.angle ? `ANGLE / POV: ${liForm.angle}` : ""}

Respond EXACTLY in this format:
---POST START---
[Full post 150-280 words with line breaks]
---POST END---

---HASHTAGS START---
[6-8 hashtags, one per line]
---HASHTAGS END---

---GRAPHIC CONCEPT START---
[2-3 sentences describing the visual]
---GRAPHIC CONCEPT END---

---KEY MESSAGE START---
[One sentence — the single point this post drives home]
---KEY MESSAGE END---`;
    try {
      const text = await callAPI(MODES.linkedin, prompt);
      const get = (tag) => { const m = text.match(new RegExp(`---${tag} START---\\n([\\s\\S]*?)\\n---${tag} END---`)); return m ? m[1].trim() : ""; };
      setLiOut({ postText:get("POST"), hashtags:get("HASHTAGS").split("\n").filter(Boolean), graphic:get("GRAPHIC CONCEPT"), keyMsg:get("KEY MESSAGE"), topic:topicStr, date:typeof topic==="object"?topic.date:new Date().toLocaleDateString(), ts:new Date().toLocaleTimeString() });
    } catch (e) { setLiOut({ postText:"Error: " + e.message }); }
    setLiLoading(false);
  };

  const MC = {
    research:      { label:"Market Research",    color:C.blue,    bg:"#eff6ff", icon:"📊" },
    content:       { label:"Content & Articles", color:C.teal,    bg:"#f0fafa", icon:"✍️" },
    linkedin:      { label:"LinkedIn Studio",    color:"#0a66c2", bg:"#eff3ff", icon:"🔵" },
    presentations: { label:"Presentations",      color:C.gold,    bg:"#fdf8ef", icon:"📑" },
  };
  const mc = MC[mode] || MC.research;

  const NAV = [
    { k:"research",      l:"📊 Market Research" },
    { k:"content",       l:"✍️ Content & Articles" },
    { k:"linkedin",      l:"🔵 LinkedIn Studio" },
    { k:"presentations", l:"📑 Presentations" },
  ];
  const SUBTABS = [{ k:"agent", l:"⚡ Agent" }, { k:"chat", l:"💬 Chat" }, { k:"quick", l:"🚀 Quick Actions" }];
  const LI_TABS = [{ k:"li_gen", l:"✍️ Generate Post" }, { k:"li_sched", l:"📅 Schedule" }, { k:`li_drafts`, l:`📁 Drafts (${drafts.length})` }];

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif", background:C.white, minHeight:"100vh", color:C.black, display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}
        .nb{background:none;border:none;cursor:pointer;padding:11px 18px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;letter-spacing:.3px;transition:all .2s;border-bottom:2px solid transparent;color:#888;white-space:nowrap}
        .nb.a{border-bottom-color:var(--c);color:var(--c)}.nb:hover:not(.a){color:#1a5c3a;background:#f8faf8}
        .sb{background:none;border:none;cursor:pointer;padding:9px 15px;font-family:Inter,sans-serif;font-size:12px;font-weight:500;transition:all .2s;border-bottom:2px solid transparent;color:#999;white-space:nowrap}
        .sb.a{color:#1a5c3a;border-bottom-color:#3db857;font-weight:600}.sb:hover:not(.a){color:#1a5c3a;background:#f5faf6}
        .qab{background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:13px 15px;cursor:pointer;font-family:Inter,sans-serif;font-size:12px;color:#1a1a1a;text-align:left;transition:all .2s;display:flex;align-items:flex-start;gap:11px}
        .qab:hover{background:#f0f7f3;border-color:#3db857;transform:translateY(-1px);box-shadow:0 3px 12px rgba(26,92,58,.1)}
        .sendb{background:#1a5c3a;border:none;border-radius:7px;padding:10px 20px;color:#fff;font-family:Inter,sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
        .sendb:hover:not(:disabled){background:#2d6a4f;box-shadow:0 4px 14px rgba(26,92,58,.25);transform:translateY(-1px)}
        .sendb:disabled{opacity:.35;cursor:not-allowed}
        .genb{background:#1a5c3a;border:none;border-radius:7px;padding:11px 22px;color:#fff;font-family:Inter,sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;justify-content:center;width:100%}
        .genb:hover:not(:disabled){background:#2d6a4f;box-shadow:0 4px 14px rgba(26,92,58,.2)}.genb:disabled{opacity:.35;cursor:not-allowed}
        .lib{background:#0a66c2;border:none;border-radius:7px;padding:11px 22px;color:#fff;font-family:Inter,sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;width:100%}
        .lib:hover:not(:disabled){background:#0957a8}.lib:disabled{opacity:.35;cursor:not-allowed}
        .mu{background:#f0f7f3;border:1px solid #c8e6cc;border-radius:12px 12px 3px 12px;padding:12px 16px;max-width:78%;align-self:flex-end;font-size:14px;line-height:1.65;color:#1a1a1a}
        .ma{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:3px 12px 12px 12px;padding:14px 18px;max-width:92%;align-self:flex-start;font-size:14px;line-height:1.8;color:#1a1a1a}
        .ml{font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:5px;color:#aaa}
        .ita{background:#fff;border:1.5px solid #e0e0e0;border-radius:8px;padding:11px 15px;font-family:Inter,sans-serif;font-size:14px;color:#1a1a1a;resize:none;outline:none;flex:1;transition:border-color .2s;min-height:42px;max-height:120px}
        .ita:focus{border-color:#3db857}.ita::placeholder{color:#bbb}
        .fi{background:#fff;border:1.5px solid #e0e0e0;border-radius:7px;padding:9px 13px;font-family:Inter,sans-serif;font-size:13px;color:#1a1a1a;outline:none;transition:border-color .2s;width:100%}
        .fi:focus{border-color:#3db857}
        .fs{background:#fff;border:1.5px solid #e0e0e0;border-radius:7px;padding:9px 13px;font-family:Inter,sans-serif;font-size:13px;color:#1a1a1a;outline:none;cursor:pointer;width:100%}
        .fs:focus{border-color:#3db857}
        .fta{background:#fff;border:1.5px solid #e0e0e0;border-radius:7px;padding:10px 13px;font-family:Inter,sans-serif;font-size:13px;color:#1a1a1a;resize:vertical;outline:none;transition:border-color .2s;width:100%;min-height:80px}
        .fta:focus{border-color:#3db857}
        .sl{font-size:11px;font-weight:600;color:#666;margin-bottom:5px;letter-spacing:.3px}
        .card{background:#fff;border:1px solid #e8e8e8;border-radius:10px;padding:18px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
        .ct{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#1a5c3a;margin-bottom:12px}
        .ob{background:#fff;border:1.5px solid #e8e8e8;border-radius:10px;padding:18px;font-size:14px;line-height:1.8;color:#1a1a1a}
        .cpb{background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;padding:4px 10px;font-size:10px;font-family:Inter,sans-serif;color:#666;cursor:pointer;transition:all .2s;font-weight:500}
        .cpb:hover{background:#f0f7f3;color:#1a5c3a;border-color:#c8e6cc}
        .svb{background:#f0f7f3;border:1px solid #c8e6cc;border-radius:4px;padding:4px 10px;font-size:10px;font-family:Inter,sans-serif;color:#1a5c3a;cursor:pointer;font-weight:600}
        .svb:hover{background:#1a5c3a;color:#fff}
        .rgb{background:#fff;border:1.5px solid #e0e0e0;border-radius:6px;padding:8px 18px;font-size:12px;font-family:Inter,sans-serif;color:#666;cursor:pointer;font-weight:500;transition:all .2s}
        .rgb:hover{border-color:#3db857;color:#1a5c3a}
        .apb{background:#1a5c3a;border:none;border-radius:6px;padding:8px 18px;font-size:12px;font-family:Inter,sans-serif;color:#fff;cursor:pointer;font-weight:600}
        .apb:hover{background:#2d6a4f}
        .tob{background:none;border:1.5px solid #e0e0e0;border-radius:6px;padding:5px 12px;font-size:11px;font-family:Inter,sans-serif;cursor:pointer;transition:all .2s;font-weight:500;color:#666}
        .tob.on{border-color:#3db857;color:#1a5c3a;background:#f0f7f3}
        .pulse{width:7px;height:7px;background:#3db857;border-radius:50%;animation:pulse 2s infinite;flex-shrink:0}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(61,184,87,.4)}50%{opacity:.8;box-shadow:0 0 0 5px rgba(61,184,87,0)}}
        .dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:#3db857;margin:0 2px;animation:bounce 1.2s infinite;opacity:.5}
        .dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}
        .lsc{background:#fff;border:1.5px solid #e8e8e8;border-radius:10px;padding:14px 16px;cursor:pointer;transition:all .2s;margin-bottom:8px;display:flex;align-items:flex-start;gap:14px}
        .lsc:hover{border-color:#0a66c2;background:#f8fbff;transform:translateY(-1px)}.lsc.sel{border-color:#0a66c2;background:#eff6ff}
        .hp{display:inline-block;background:#eff6ff;color:#0a66c2;border:1px solid #bfdbfe;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:500;margin:2px}
        .pp{background:#fff;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden}
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", background:C.white, position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <Logo size={32} />
          <div style={{ borderLeft:`1px solid ${C.border}`, paddingLeft:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.black }}>Catskill Partners</div>
            <div style={{ fontSize:10, color:C.greenBright, letterSpacing:"1.2px", textTransform:"uppercase", marginTop:1, fontWeight:600 }}>Morgan Cole · VP of Marketing</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button className={`tob ${webSearch?"on":""}`} onClick={() => setWebSearch(p => !p)}>🔍 Web Search {webSearch?"ON":"OFF"}</button>
          <div className="pulse" />
        </div>
      </div>

      {/* TOP NAV */}
      <div style={{ display:"flex", padding:"0 12px", borderBottom:`1px solid ${C.border}`, background:"#fafafa", overflowX:"auto" }}>
        {NAV.map(({ k, l }) => (
          <button key={k} className={`nb ${mode===k?"a":""}`} style={{ "--c":MC[k].color }}
            onClick={() => { setMode(k); setTab(k==="linkedin"?"li_gen":"agent"); setAgentOut(null); }}>
            {l}
          </button>
        ))}
      </div>

      {/* MODE STRIPE */}
      <div style={{ padding:"4px 20px", background:mc.bg, borderBottom:`1px solid ${mc.color}22`, display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:5, height:5, borderRadius:"50%", background:mc.color }} />
        <span style={{ fontSize:10, color:mc.color, letterSpacing:"1px", textTransform:"uppercase", fontWeight:700 }}>{mc.label}</span>
      </div>

      {/* SUB TABS */}
      <div style={{ display:"flex", padding:"0 12px", borderBottom:`1px solid ${C.border}`, background:C.white, overflowX:"auto" }}>
        {isLI
          ? LI_TABS.map(({ k, l }) => (
              <button key={k} className={`sb ${tab===k?"a":""}`}
                style={{ color:tab===k?"#0a66c2":undefined, borderBottomColor:tab===k?"#0a66c2":undefined }}
                onClick={() => setTab(k)}>{l}</button>
            ))
          : SUBTABS.map(({ k, l }) => (
              <button key={k} className={`sb ${tab===k?"a":""}`} onClick={() => setTab(k)}>{l}</button>
            ))
        }
      </div>

      {/* CONTENT */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:"calc(100vh - 132px)" }}>

        {/* ── AGENT TAB ── */}
        {!isLI && tab==="agent" && (
          <div style={{ flex:1, overflowY:"auto", padding:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1.15fr", gap:20, maxWidth:1140 }}>
              <div className="card">
                <div className="ct">⚡ Agent Task Input</div>
                <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                  <div>
                    <div className="sl">Task Type *</div>
                    <select className="fs" value={form.taskType} onChange={e => setForm(p => ({ ...p, taskType:e.target.value }))}>
                      <option value="">— Select task type —</option>
                      {(AGENT_TASKS[mode]||AGENT_TASKS.research).map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="sl">Topic / Subject</div>
                    <input className="fi" placeholder="e.g. LMM manufacturing M&A trends, power distribution sector..." value={form.topic} onChange={e => setForm(p => ({ ...p, topic:e.target.value }))} />
                  </div>
                  <div>
                    <div className="sl">Target Audience</div>
                    <input className="fi" placeholder="e.g. LPs, manufacturing owners, industry press, internal team..." value={form.audience} onChange={e => setForm(p => ({ ...p, audience:e.target.value }))} />
                  </div>
                  <div>
                    <div className="sl">Context & Brief *</div>
                    <textarea className="fta" rows={4} style={{ minHeight:110 }} placeholder="Key points to cover, specific data, purpose, any constraints or angles..." value={form.context} onChange={e => setForm(p => ({ ...p, context:e.target.value }))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div>
                      <div className="sl">Tone</div>
                      <select className="fs" value={form.tone} onChange={e => setForm(p => ({ ...p, tone:e.target.value }))}>
                        {TONES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="sl">Output Format</div>
                      <select className="fs" value={form.format} onChange={e => setForm(p => ({ ...p, format:e.target.value }))}>
                        {FORMATS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div className="sl">Additional Notes</div>
                    <textarea className="fta" rows={2} style={{ minHeight:56 }} placeholder="Word count targets, publication, deadline, specific angles to include or avoid..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes:e.target.value }))} />
                  </div>
                  <button className="genb" onClick={runAgent} disabled={agentLoading||!form.taskType||!form.context}>
                    {agentLoading ? "⏳ Generating..." : "⚡ Generate Output"}
                  </button>
                </div>
              </div>

              <div>
                {agentLoading && (
                  <div className="card" style={{ textAlign:"center", padding:55, color:C.gray }}>
                    <div className="dots" style={{ justifyContent:"center", display:"flex", marginBottom:14 }}><span/><span/><span/></div>
                    <div style={{ fontSize:13, fontWeight:500 }}>Morgan is working on it...</div>
                  </div>
                )}
                {agentOut && !agentLoading && (
                  <div className="card">
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <div className="ct" style={{ marginBottom:0 }}>📄 Output · {agentOut.ts}</div>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="cpb" onClick={() => navigator.clipboard.writeText(agentOut.text)}>Copy ↗</button>
                        <button className="svb" onClick={() => setSavedOuts(p => [agentOut,...p.slice(0,9)])}>Save ✓</button>
                      </div>
                    </div>
                    <div className="ob">{fmt(agentOut.text)}</div>
                    <div style={{ marginTop:10, display:"flex", gap:8 }}>
                      <button className="rgb" onClick={runAgent}>↺ Regenerate</button>
                      <button className="rgb" onClick={() => { sendChat(agentOut.text+"\n\nRefine this — tighter and more punchy."); setTab("chat"); }}>Refine in Chat →</button>
                    </div>
                  </div>
                )}
                {!agentOut && !agentLoading && (
                  <div className="card" style={{ border:"2px dashed #e8e8e8", textAlign:"center", padding:"65px 30px", color:"#ccc" }}>
                    <div style={{ fontSize:36, marginBottom:12 }}>{mc.icon}</div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#aaa", marginBottom:6 }}>Output appears here</div>
                    <div style={{ fontSize:12 }}>Fill in the brief on the left and hit Generate</div>
                  </div>
                )}
                {savedOuts.length > 0 && (
                  <div className="card" style={{ marginTop:12 }}>
                    <div className="ct">💾 Saved Outputs ({savedOuts.length})</div>
                    {savedOuts.slice(0,3).map((o,i) => (
                      <div key={i} style={{ padding:"8px 0", borderBottom:i<2?`1px solid ${C.border}`:"none" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{o.form?.taskType||"Output"} · {o.ts}</div>
                          <div style={{ display:"flex", gap:5 }}>
                            <button className="cpb" onClick={() => navigator.clipboard.writeText(o.text)}>Copy</button>
                            <button className="cpb" onClick={() => setAgentOut(o)}>View</button>
                          </div>
                        </div>
                        <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{o.text.slice(0,90)}...</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {!isLI && tab==="chat" && (
          <>
            <div style={{ flex:1, overflowY:"auto", padding:"18px 20px", display:"flex", flexDirection:"column", gap:14 }}>
              {msgs[mode].length===0 && (
                <div style={{ textAlign:"center", padding:"50px 20px", color:"#ccc" }}>
                  <div style={{ fontSize:30, marginBottom:10 }}>💬</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#bbb" }}>Chat with Morgan Cole</div>
                  <div style={{ fontSize:12, marginTop:4 }}>
                    {mode==="research"&&"Ask for research reports, sector analysis, competitive intel..."}
                    {mode==="content"&&"Draft articles, press releases, newsletters, case studies..."}
                    {mode==="presentations"&&"Build slide content, talking points, deck narratives..."}
                    {mode==="linkedin"&&"Draft posts, refine copy, plan content series..."}
                  </div>
                </div>
              )}
              {msgs[mode].map((m,i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
                  <div className="ml" style={{ paddingLeft:m.role==="assistant"?4:0, paddingRight:m.role==="user"?4:0 }}>
                    {m.role==="user"?"YOU":"MORGAN COLE · CATSKILL PARTNERS"}
                  </div>
                  <div className={m.role==="user"?"mu":"ma"}>{m.role==="assistant"?fmt(m.content):m.content}</div>
                  {m.role==="assistant"&&<button className="cpb" style={{ marginTop:5 }} onClick={() => navigator.clipboard.writeText(m.content)}>copy ↗</button>}
                </div>
              ))}
              {loading && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
                  <div className="ml" style={{ paddingLeft:4 }}>MORGAN COLE</div>
                  <div className="ma"><div className="dots"><span/><span/><span/></div></div>
                </div>
              )}
              <div ref={endRef}/>
            </div>
            <div style={{ padding:"12px 20px 16px", borderTop:`1px solid ${C.border}`, background:C.white, display:"flex", gap:10, alignItems:"flex-end" }}>
              <textarea className="ita" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat(input);} }}
                placeholder={mode==="research"?"Ask for a report, sector analysis, competitive brief...":mode==="content"?"Draft an article, press release, newsletter section...":mode==="presentations"?"Build slides, talking points, deck narrative...":"Draft or refine a LinkedIn post..."} rows={1}/>
              <button className="sendb" onClick={() => sendChat(input)} disabled={loading||!input.trim()}>Send →</button>
            </div>
          </>
        )}

        {/* ── QUICK ACTIONS TAB ── */}
        {!isLI && tab==="quick" && (
          <div style={{ padding:20, overflowY:"auto", flex:1 }}>
            <div style={{ marginBottom:14, padding:"10px 16px", background:mc.bg, border:`1px solid ${mc.color}30`, borderRadius:8 }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"2px", color:mc.color, textTransform:"uppercase" }}>{mc.label} — Quick Actions</div>
              <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>Click any action to fire it into chat</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {(QA[mode]||[]).map((a,i) => (
                <button key={i} className="qab" onClick={() => { setTab("chat"); setTimeout(()=>sendChat(a.prompt),80); }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight:700, color:mc.color, fontSize:12, marginBottom:3 }}>{a.label}</div>
                    <div style={{ fontSize:10, color:"#aaa", lineHeight:1.5 }}>{a.prompt.slice(0,75)}...</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ LINKEDIN STUDIO ══ */}

        {isLI && tab==="li_gen" && (
          <div style={{ flex:1, overflowY:"auto", padding:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:20, maxWidth:1140 }}>
              <div className="card" style={{ borderTop:"3px solid #0a66c2" }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:14 }}>
                  <div style={{ width:22, height:22, background:"#0a66c2", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>in</span>
                  </div>
                  <div className="ct" style={{ marginBottom:0 }}>LinkedIn Post Generator</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                  <div>
                    <div className="sl">Scheduled Topic</div>
                    <select className="fs" value={liForm.topicIdx} onChange={e => setLiForm(p => ({ ...p, topicIdx:+e.target.value, custom:"" }))}>
                      {LI_SCHEDULE.map((t,i) => <option key={i} value={i}>{t.date} — {t.topic}{t.status==="due"?" ⚠️ DUE":""}</option>)}
                    </select>
                  </div>
                  <div style={{ padding:"10px 13px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:7 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#0a66c2", marginBottom:3 }}>TOPIC THEME</div>
                    <div style={{ fontSize:12, color:"#1e40af", lineHeight:1.6 }}>{LI_SCHEDULE[liForm.topicIdx]?.theme}</div>
                  </div>
                  <div>
                    <div className="sl">Or Custom Topic</div>
                    <input className="fi" placeholder="Enter a different topic..." value={liForm.custom} onChange={e => setLiForm(p => ({ ...p, custom:e.target.value }))} />
                  </div>
                  <div>
                    <div className="sl">Specific Data / Stats to Include</div>
                    <textarea className="fta" rows={3} style={{ minHeight:70 }} placeholder="e.g. '60%+ of LMM owners are 55+, $250B ICT demand, 300bps margin expansion...'" value={liForm.data} onChange={e => setLiForm(p => ({ ...p, data:e.target.value }))} />
                  </div>
                  <div>
                    <div className="sl">Specific Angle / POV</div>
                    <textarea className="fta" rows={2} style={{ minHeight:55 }} placeholder="Contrarian take, personal story, or specific angle..." value={liForm.angle} onChange={e => setLiForm(p => ({ ...p, angle:e.target.value }))} />
                  </div>
                  <button className="lib" onClick={genLIPost} disabled={liLoading}>
                    {liLoading?"⏳ Generating post...":"✍️ Generate LinkedIn Post"}
                  </button>
                </div>
              </div>
              <div>
                {liLoading&&<div className="card" style={{ textAlign:"center", padding:65 }}><div className="dots" style={{ justifyContent:"center", display:"flex", marginBottom:14 }}><span/><span/><span/></div><div style={{ fontSize:13, fontWeight:500, color:C.gray }}>Drafting your post...</div></div>}
                {liOut&&!liLoading&&(
                  <div>
                    <div className="pp">
                      <div style={{ padding:"13px 16px", borderBottom:`1px solid ${C.border}`, background:"#f8f9fa", display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:36, height:36, background:C.green, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:14 }}>CP</div>
                        <div><div style={{ fontSize:13, fontWeight:600 }}>Catskill Partners</div><div style={{ fontSize:11, color:"#aaa" }}>Private Equity · {liOut.date}</div></div>
                        <span style={{ marginLeft:"auto", background:"#fef3c7", color:"#92400e", border:"1px solid #fde68a", borderRadius:4, padding:"2px 8px", fontSize:10, fontWeight:700 }}>DRAFT</span>
                      </div>
                      <div style={{ padding:16, fontSize:14, lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:280, overflowY:"auto" }}>{liOut.postText}</div>
                      {liOut.hashtags?.length>0&&<div style={{ padding:"10px 16px", borderTop:`1px solid #f0f0f0`, background:"#fafafa" }}>{liOut.hashtags.map((h,i)=><span key={i} className="hp">{h}</span>)}</div>}
                    </div>
                    {liOut.graphic&&<div className="card" style={{ marginTop:10, borderLeft:"3px solid #f59e0b" }}><div style={{ fontSize:10, fontWeight:700, color:"#92400e", letterSpacing:"1px", textTransform:"uppercase", marginBottom:6 }}>🎨 Graphic Concept</div><div style={{ fontSize:13, lineHeight:1.65 }}>{liOut.graphic}</div></div>}
                    {liOut.keyMsg&&<div className="card" style={{ marginTop:10, borderLeft:"3px solid #3db857" }}><div style={{ fontSize:10, fontWeight:700, color:C.green, letterSpacing:"1px", textTransform:"uppercase", marginBottom:6 }}>💡 Key Message</div><div style={{ fontSize:13, fontWeight:500, lineHeight:1.65 }}>{liOut.keyMsg}</div></div>}
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      <button className="apb" onClick={() => { setDrafts(p=>[{...liOut,status:"approved"},...p.slice(0,11)]); setLiOut(null); }}>✓ Approve Draft</button>
                      <button className="rgb" onClick={genLIPost}>↺ Regenerate</button>
                      <button className="cpb" style={{ padding:"8px 14px", fontSize:12 }} onClick={() => navigator.clipboard.writeText(liOut.postText+"\n\n"+liOut.hashtags?.join(" "))}>Copy Post ↗</button>
                    </div>
                  </div>
                )}
                {!liOut&&!liLoading&&<div className="card" style={{ border:"2px dashed #e8e8e8", textAlign:"center", padding:"65px 30px", color:"#ccc" }}><div style={{ fontSize:34, marginBottom:12 }}>🔵</div><div style={{ fontSize:14, fontWeight:600, color:"#bbb", marginBottom:6 }}>Post Preview Appears Here</div><div style={{ fontSize:12 }}>Select a topic and hit Generate</div></div>}
              </div>
            </div>
          </div>
        )}

        {isLI && tab==="li_sched" && (
          <div style={{ padding:20, overflowY:"auto", flex:1 }}>
            <div className="card" style={{ maxWidth:700 }}>
              <div className="ct">📅 Biweekly Post Schedule — 2026</div>
              <div style={{ fontSize:12, color:"#aaa", marginBottom:16 }}>One post every two weeks. Click any topic to open it in the generator.</div>
              {LI_SCHEDULE.map((t,i) => (
                <div key={i} className={`lsc ${liForm.topicIdx===i?"sel":""}`} onClick={() => { setLiForm(p=>({...p,topicIdx:i,custom:""})); setTab("li_gen"); }}>
                  <div style={{ textAlign:"center", flexShrink:0, width:52 }}>
                    <div style={{ fontSize:9, color:"#aaa", fontWeight:700 }}>{t.date.split(" ")[0].toUpperCase()}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:t.status==="due"?"#0a66c2":C.black }}>{t.date.split(",")[0].split(" ")[1]}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{t.topic}</div>
                      {t.status==="due"&&<span style={{ background:"#fef3c7", color:"#92400e", border:"1px solid #fde68a", borderRadius:4, padding:"1px 7px", fontSize:10, fontWeight:700 }}>DUE</span>}
                      {t.status==="upcoming"&&<span style={{ background:"#f0f7f3", color:C.green, border:`1px solid #c8e6cc`, borderRadius:4, padding:"1px 7px", fontSize:10, fontWeight:600 }}>Upcoming</span>}
                    </div>
                    <div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>{t.theme}</div>
                  </div>
                  <div style={{ fontSize:16, color:"#ddd", flexShrink:0 }}>→</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLI && tab==="li_drafts" && (
          <div style={{ padding:20, overflowY:"auto", flex:1 }}>
            {drafts.length===0
              ? <div className="card" style={{ border:"2px dashed #e8e8e8", textAlign:"center", padding:55, color:"#ccc", maxWidth:600 }}><div style={{ fontSize:28, marginBottom:10 }}>📁</div><div style={{ fontSize:14, fontWeight:600, color:"#bbb" }}>No Approved Drafts Yet</div><div style={{ fontSize:12, marginTop:4 }}>Generate and approve posts — they appear here</div></div>
              : <div style={{ maxWidth:700 }}>{drafts.map((d,i)=>(
                  <div key={i} className="pp" style={{ marginBottom:14 }}>
                    <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:"#f8f9fa", display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:28, height:28, background:C.green, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:11 }}>CP</div>
                      <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600 }}>{d.topic}</div><div style={{ fontSize:10, color:"#aaa" }}>Approved · {d.date}</div></div>
                      <button className="cpb" onClick={() => navigator.clipboard.writeText(d.postText+"\n\n"+d.hashtags?.join(" "))}>Copy ↗</button>
                      <span style={{ background:"#f0f7f3", color:C.green, border:`1px solid #c8e6cc`, borderRadius:4, padding:"2px 8px", fontSize:10, fontWeight:700 }}>✓ Approved</span>
                    </div>
                    <div style={{ padding:"14px 16px", fontSize:13, lineHeight:1.75, whiteSpace:"pre-wrap", maxHeight:180, overflowY:"auto" }}>{d.postText}</div>
                    {d.hashtags?.length>0&&<div style={{ padding:"8px 16px", borderTop:`1px solid #f5f5f5`, background:"#fafafa" }}>{d.hashtags.map((h,hi)=><span key={hi} className="hp">{h}</span>)}</div>}
                    {d.graphic&&<div style={{ padding:"10px 16px", borderTop:`1px solid #f5f5f5`, fontSize:11, color:"#aaa", fontStyle:"italic" }}>🎨 {d.graphic}</div>}
                  </div>
                ))}</div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
