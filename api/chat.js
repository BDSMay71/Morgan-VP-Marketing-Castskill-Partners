// Morgan Cole — Content Generation API v3
// Fixed: model field required, web_search tool, all task types

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const {
    taskType = 'article', topic = '', audience = 'LP / Institutional Investor',
    brief = '', tone = 'operator', outputFormat = 'article',
    notes = '', mode = 'content', enableWebSearch = false,
  } = req.body || {};

  const SYSTEM = `You are Morgan Cole, VP of Marketing at Catskill Partners LP — an operator-first PE firm acquiring lower-middle market industrial businesses.

FIRM FACTS:
- Brian Steel: CEO/operator. Built Tenere Products $0→$350M revenue, sold 2022 >10x MOIC. Also led Cadrex Manufacturing.
- Mike Fuller: 20+ years ICT/Data Center PE investing. Deep institutional LP network.
- Fund I: $250M target | 6-8 platforms | $2-20M EBITDA | $25-150M EV | North America focus
- Target sectors: Advanced Manufacturing, Engineered Materials, Precision Components, ICT/Data Center supply chain
- Market thesis: 70%+ of LMM owners 55+ | $250B+ data center capex by 2030 | reshoring tailwinds
- Returns target: 25-30% gross IRR | 3-4x MOIC | 6yr hold | 8% preferred return | 80/20 LP/GP carry
- Sourcing edge: 1,700+ proprietary owner database | 14 active opportunities March 2026 | proactive origination
- Tagline: CLARITY. CRAFT. CAPITAL. | We are operators first.

Write in Morgan Cole's voice. Be specific. Use real Catskill data. No generic PE speak.`;

  const FORMAT = {
    article: 'Write a 700-900 word byline article with clear headers. Data-driven throughout. Embed Catskill positioning naturally.',
    brief: 'Write a crisp 300-400 word executive brief with 3-4 labeled sections. Tight and scannable.',
    bullets: 'Write 12-18 slide-ready bullets grouped under 3-4 headers. Each bullet = one sentence with a specific data point or insight.',
    report: 'Write a full structured report 800-1200 words: Executive Summary → Key Findings (3-5 sections with data) → Catskill Positioning → Conclusion.',
    post: 'Write a LinkedIn post 150-250 words. Strong hook opening line. 2-3 insight paragraphs. Punchy close with clear POV. Max 3 relevant hashtags at end.',
    script: 'Write a 400-600 word spoken talk track. Natural first-person language. Operator-credentialed. Punchy delivery.',
  };

  const TONE = {
    operator: 'Direct, factory-floor credibility. Numbers-first. Operator who has actually run companies. No buzzwords.',
    institutional: 'Rigorous, data-forward, institutional-grade precision. Language expected by sophisticated LPs.',
    executive: 'Measured boardroom gravitas. Confident without being flashy.',
    editorial: 'Thought leadership. Provocative framing. Strong POV. Compelling narrative arc.',
    concise: 'Tight and scannable. Short sentences. Dense data. Every word earns its place.',
  };

  const TASK_EXTRA = {
    weekly_report: 'Structure the weekly report with these sections: DEAL FLOW THIS WEEK | SECTOR SIGNALS | MACRO UPDATE | DATA CENTER DEMAND TRACKER | SUCCESSION WAVE INDICATORS | CATSKILL PIPELINE NOTE. Use current market conditions and data.',
    sector_analysis: 'Include: TAM size, CAGR projections, key players, supply/demand dynamics, Catskill competitive angle and specific fit.',
    competitive_intel: 'Cover: active PE buyers in LMM industrials, current deal multiples, who is winning and why, where Catskill differentiates.',
    end_market_brief: 'Include specific capex figures, growth rates, supply chain dynamics. Be quantitative throughout.',
    target_profile: 'Include acquisition thesis, value creation angles, sector fit, deal structure considerations.',
    macro_brief: 'Cover macro factors relevant to LMM industrial M&A: rates, reshoring, supply chains, buyer/seller dynamics.',
    lp_letter: 'Professional LP communication. Cover: fund progress, current market conditions, active pipeline, forward outlook.',
    deal_memo: 'Investment memo structure: Thesis → Target Overview → Market Context → Value Creation Plan → Financial Considerations → Risks & Mitigants.',
    press_release: 'Standard press release format: headline, dateline, lead paragraph, quotes, company description, boilerplate.',
    article: 'Thought leadership byline piece. Strong narrative. Data-backed. Catskill POV throughout.',
    thought_leadership: 'LinkedIn thought leadership post. Strong operator POV. Brian Steel or Morgan Cole voice.',
    market_insight: 'LinkedIn market insight post. Data-led. Specific numbers. Catskill positioning angle.',
    industry_commentary: 'LinkedIn industry commentary. Timely, opinionated, backed by specific data points.',
    firm_news: 'LinkedIn firm announcement. Professional, confident, forward-looking.',
    deal_announcement: 'LinkedIn deal announcement. Operator narrative. Value creation forward-looking angle.',
  };

  const taskExtra = TASK_EXTRA[taskType] || '';
  const formatInstr = FORMAT[outputFormat] || FORMAT.article;
  const toneInstr = TONE[tone] || TONE.operator;

  const userPrompt = `TASK: ${taskType}${taskExtra ? '\nGUIDANCE: ' + taskExtra : ''}

TOPIC: ${topic || brief}
AUDIENCE: ${audience}
BRIEF: ${brief}
${notes ? 'NOTES: ' + notes : ''}

FORMAT: ${formatInstr}
TONE: ${toneInstr}

Generate now. Be specific. Use real Catskill facts and data.`;

  try {
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    };

    if (enableWebSearch) {
      body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error', detail: JSON.stringify(data).substring(0,500) });
    }

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return res.status(200).json({ content: [{ type: 'text', text }], result: text });

  } catch (err) {
    return res.status(500).json({ error: err.message, detail: err.stack?.substring(0,400) });
  }
}