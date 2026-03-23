// Catskill Partners Morgan Cole — Content & Research API
// Supports: market research, articles, LinkedIn posts, web search

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const {
    taskType = 'article',
    topic = '',
    audience = 'LP / Institutional Investor',
    brief = '',
    tone = 'operator',
    outputFormat = 'article',
    notes = '',
    mode = 'content',
    enableWebSearch = false,
  } = req.body || {};

  // ── System prompt ─────────────────────────────────────────────────────────
  const SYSTEM = `You are Morgan Cole, VP of Marketing at Catskill Partners LP — an operator-first private equity firm acquiring lower-middle market industrial businesses ($25–150M EV, $2–20M EBITDA).

FIRM FACTS (always accurate):
- Brian Steel: CEO/operator, built Tenere Products $0→$350M, sold 2022 >10x MOIC. Also led Cadrex Manufacturing.
- Mike Fuller: 20+ years ICT/Data Center PE. Deep LP network and sector expertise.
- Fund I: $250M target | 6–8 platforms | $2–20M EBITDA | $25–150M EV | North America
- Investment thesis: Advanced Manufacturing, Engineered Materials, Precision Components, ICT/Data Center supply chain
- Market: 70%+ of LMM owners 55+ | $250B+ data center capex by 2030 | supply chain reshoring
- Returns: 25–30% IRR target | 3–4x MOIC | 6yr hold | 8% preferred return | 80/20 LP/GP carry
- Sourcing: 1,700+ owner database | 14 active opportunities March 2026 | proactive origination 18+ months
- Tagline: CLARITY. CRAFT. CAPITAL. | We are operators first.

VOICE: Direct, data-driven, operator-credentialed. Never generic PE speak. Specific numbers always.
Always write in Morgan Cole's first-person voice as Catskill's VP of Marketing.`;

  // ── Format instructions ────────────────────────────────────────────────────
  const FORMAT_MAP = {
    'article':   'Write a 700–900 word byline/article with headers. Data-driven. Catskill positioning throughout.',
    'brief':     'Write a crisp 300–400 word executive brief. Structured with 3–4 sections. No fluff.',
    'bullets':   'Write 12–18 slide-ready bullets grouped under 3–4 headers. Each bullet is one tight sentence with data.',
    'report':    'Write a structured 800–1200 word report with: Executive Summary, Key Findings (3–5 sections with data), Catskill Positioning, Conclusion.',
    'post':      'Write a LinkedIn post: 150–250 words, hook first sentence, 2–3 key insight paragraphs, strong close. No hashtag spam. Max 3 hashtags at end.',
    'script':    'Write a 400–600 word talk track / spoken presentation script. Natural language, first-person, punchy.',
  };

  const TONE_MAP = {
    'operator':      'Direct, factory-floor credibility. Operator who has actually run companies. Numbers-first.',
    'institutional': 'Rigorous, data-forward, institutional-grade. Precise language expected by sophisticated LPs.',
    'executive':     'Measured, boardroom gravitas. Confident without being flashy.',
    'editorial':     'Thought leadership tone. Provocative framing, strong POV, compelling narrative.',
    'concise':       'Tight and scannable. Short sentences. Dense data. Every word earns its place.',
  };

  // ── Task-specific instructions ─────────────────────────────────────────────
  const TASK_MAP = {
    weekly_report:    'Generate a weekly LMM industrial M&A market report. Include: deal flow observations, sector trends, macro signals, data center demand updates, succession wave indicators. Structure as a proper report.',
    sector_analysis:  'Generate a deep sector analysis. Include: TAM, CAGR, key players, supply/demand dynamics, Catskill positioning and competitive angle, specific companies/data.',
    competitive_intel:'Generate competitive intelligence on PE activity in LMM industrials. Cover deal multiples, active buyers, where Catskill differentiates.',
    end_market_brief: 'Generate an end-market demand brief. Use current data. Include specific capex figures, growth rates, supply chain dynamics.',
    target_profile:   'Generate a target company profile. Acquisition thesis, value creation angles, sector fit, deal structure considerations.',
    lp_letter:        'Generate an LP communication letter. Professional, confident tone. Cover fund progress, market conditions, forward outlook.',
    deal_memo:        'Generate an investment memorandum. Thesis, target overview, value creation plan, financial considerations, risks and mitigants.',
    article:          'Generate a thought leadership article or byline piece.',
    thought_leadership: 'Generate a LinkedIn thought leadership post from Brian Steel or Morgan Cole perspective.',
    market_insight:   'Generate a LinkedIn market insight post. Data-led, specific, Catskill angle.',
    industry_commentary: 'Generate an industry commentary post. Timely, opinionated, backed by data.',
    firm_news:        'Generate a LinkedIn firm news/announcement post.',
    deal_announcement:'Generate a LinkedIn deal announcement post. Professional, forward-looking, operator narrative.',
  };

  const taskInstr = TASK_MAP[taskType] || 'Generate high-quality content as requested.';
  const formatInstr = FORMAT_MAP[outputFormat] || FORMAT_MAP['article'];
  const toneInstr = TONE_MAP[tone] || TONE_MAP['operator'];

  const userPrompt = `TASK: ${taskInstr}

TOPIC: ${topic || brief}
AUDIENCE: ${audience}
BRIEF: ${brief}
${notes ? 'ADDITIONAL NOTES: ' + notes : ''}

FORMAT: ${formatInstr}
TONE: ${toneInstr}

Generate the content now. Be specific. Use real data. Embed Catskill's story naturally.`;

  // ── Web search tool ────────────────────────────────────────────────────────
  const tools = enableWebSearch ? [{
    type: 'web_search_20250305',
    name: 'web_search',
  }] : undefined;

  // ── Call Anthropic ─────────────────────────────────────────────────────────
  try {
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    };
    if (tools) body.tools = tools;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error', detail: JSON.stringify(data) });
    }

    // Extract text from content blocks (handles web_search tool use too)
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return res.status(200).json({ content: [{ type: 'text', text }], result: text });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error', detail: err.stack?.substring(0, 400) });
  }
}
