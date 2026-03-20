import * as XLSX from 'xlsx';

// ================================================================
// CATSKILL PARTNERS CRM — ONEDRIVE FILE ACCESS
// File 1: BD Active Target List Q1 2026.xlsx
//   https://1drv.ms/x/c/18334eea8b635807/IQCX5zWbN2GFTYb2CrCMFHH7AduqXb_egMrP9_TMTgToW6Y
// File 2: CP Tracker_Draft.xlsx (IB, LP, Capital Providers, Comm Log)
//   https://1drv.ms/x/c/18334eea8b635807/IQBvmYp9dxvwSJsMd2guPVFRAcS96KoSD4XaIk7ahY8_ZlQ
// ================================================================

const FILES = {
  bdTargets: {
    name: 'BD Active Target List Q1 2026',
    shareUrl: 'https://1drv.ms/x/c/18334eea8b635807/IQCX5zWbN2GFTYb2CrCMFHH7AduqXb_egMrP9_TMTgToW6Y',
    downloadUrl: 'https://onedrive.live.com/download?resid=18334EEA8B635807!s9b35e79761374d8586f60ab08c1471fb&authkey=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy8xODMzNGVlYThiNjM1ODA3L0lRQ1g1eldiTjJHRlRZYjJDckNNRkhIN0FkdXFYYl9lZ01yUDlfVE1UZ1RvVzZZ',
  },
  cpTracker: {
    name: 'CP Tracker - IB, LP, Capital Providers',
    shareUrl: 'https://1drv.ms/x/c/18334eea8b635807/IQBvmYp9dxvwSJsMd2guPVFRAcS96KoSD4XaIk7ahY8_ZlQ',
    downloadUrl: 'https://onedrive.live.com/download?resid=18334EEA8B635807!s7d8a996f1b7748f09b0c77682e3d5151&authkey=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy8xODMzNGVlYThiNjM1ODA3L0lRQnZtWXA5ZHh2d1NKc01kMmd1UFZGUkFjUzk2S29TRDRYYUlrN2FoWThfWmxR',
  },
};

async function fetchXlsx(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('Failed to fetch: ' + res.status);
  const buf = await res.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

function sheetToJson(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function classifyContact(row) {
  const type = (row['Provider Type'] || row['Type'] || row['Category'] || '').toLowerCase();
  const subCat = (row['Sub-Category'] || row['Sub Category'] || '').toLowerCase();
  if (type.includes('equity') && (subCat.includes('endow') || subCat.includes('family') || subCat.includes('fo'))) return 'family_office';
  if (type.includes('equity') && (subCat.includes('anchor') || subCat.includes('lp') || subCat.includes('fund'))) return 'lp';
  if (type.includes('equity') || type.includes('debt') || type.includes('hybrid')) return 'capital_provider';
  return 'other';
}

async function generateFollowUps(contacts, apiKey, date) {
  const today = new Date(date || Date.now());
  const isMonday = today.getDay() === 1;
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];

  const contactSummary = contacts.slice(0, 20).map(c =>
    `${c.name} (${c.title}, ${c.firm}) — ${c.type} — Last contact: ${c.lastContact || 'unknown'} — Email: ${c.email}`
  ).join('\n');

  const sys = `You are Morgan Cole, VP of Marketing at Catskill Partners LP — operator-led PE firm targeting founder-owned industrial manufacturers. Fund I: $250M target.

Today is ${dayName}, ${today.toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}.
${isMonday ? 'MONDAY MORNING PRIORITY BRIEFING — Generate this week\'s full follow-up list.' : 'Generate follow-up recommendations for the contacts provided.'}

OUTPUT: Return ONLY valid JSON — no markdown, no backticks.
{
  "briefing_date": "string",
  "is_monday": boolean,
  "priority": "HIGH/NORMAL",
  "summary": "2-sentence context",
  "follow_ups": [
    {
      "contact": "Name",
      "firm": "Firm Name",
      "title": "Title",
      "email": "email",
      "type": "investment_banker|lp|family_office|capital_provider",
      "priority": "HIGH|MEDIUM|LOW",
      "recommended_action": "specific action to take",
      "talking_points": ["point 1", "point 2", "point 3"],
      "suggested_subject": "email subject line",
      "suggested_message": "2-3 sentence personalized outreach draft"
    }
  ],
  "weekly_theme": "this week's outreach theme/focus"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: sys,
      messages: [{ role: 'user', content: `Generate Monday morning follow-up recommendations for these Catskill Partners contacts:\n\n${contactSummary}\n\nPrioritize: Investment Bankers who can bring deals, LPs and Family Offices who are considering Fund I commitment. Focus outreach on data center supply chain thesis and succession wave opportunity. Today is ${dayName}.` }],
    }),
  });
  const d = await res.json();
  const raw = (d.content?.[0]?.text || '').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  try { return JSON.parse(raw); } catch(e) { return { error: 'Parse failed', raw }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const action = req.body?.action || req.query?.action || 'monday_briefing';

  try {
    // ── Fetch and parse CP Tracker ────────────────────────────────────
    let contacts = [];
    let rawData = {};

    try {
      const wb = await fetchXlsx(FILES.cpTracker.downloadUrl);
      const ibContacts = sheetToJson(wb, 'IB-CPA-Broker Contacts').map(r => ({
        name: r['Contact Name'] || r['Name'] || '',
        firm: r['Provider Name'] || r['Firm'] || '',
        title: r['Title'] || '',
        email: r['Email'] || '',
        phone: r['Phone'] || '',
        city: r['City'] || '',
        state: r['State'] || '',
        type: 'investment_banker',
        lastContact: r['Last Contact'] || r['Last Activity'] || '',
      })).filter(c => c.name || c.firm);

      const capitalProviders = sheetToJson(wb, 'Capital Providers').map(r => ({
        name: r['Contact Name'] || '',
        firm: r['Provider Name'] || '',
        title: r['Title'] || '',
        email: r['Email'] || '',
        phone: r['Phone'] || '',
        city: r['City'] || '',
        state: r['State'] || '',
        type: classifyContact(r),
        providerType: r['Provider Type'] || '',
        subCategory: r['Sub-Category'] || '',
        lastContact: r['Last Contact'] || '',
      })).filter(c => c.name || c.firm);

      const lpLog = sheetToJson(wb, 'LP Communication Log').map(r => ({
        name: r['Contact'] || r['Name'] || r['Contact Name'] || '',
        firm: r['Firm'] || r['Organization'] || '',
        title: r['Title'] || '',
        email: r['Email'] || '',
        type: 'lp',
        lastContact: r['Date'] || r['Last Contact'] || '',
        notes: r['Notes'] || r['Summary'] || '',
      })).filter(c => c.name || c.firm);

      rawData = { ibContacts, capitalProviders, lpLog };
      contacts = [...ibContacts, ...capitalProviders, ...lpLog];
    } catch(fetchErr) {
      console.error('OneDrive fetch error:', fetchErr.message);
      // Return file links so user knows files are accessible
      return res.status(200).json({
        success: false,
        error: 'Could not fetch OneDrive files — files may require sign-in',
        files: {
          bdTargets: FILES.bdTargets.shareUrl,
          cpTracker: FILES.cpTracker.shareUrl,
        },
        message: 'OneDrive files are configured. If fetch fails, ensure files are set to "Anyone with link can view".',
      });
    }

    if (action === 'contacts') {
      return res.status(200).json({ success: true, contacts, rawData, fileUrls: { bdTargets: FILES.bdTargets.shareUrl, cpTracker: FILES.cpTracker.shareUrl } });
    }

    // ── Generate Monday Morning Follow-Up Briefing ────────────────────
    const briefing = await generateFollowUps(contacts, apiKey, req.body?.date);

    // ── Also fetch BD targets if available ───────────────────────────
    let bdTargets = [];
    try {
      const wb2 = await fetchXlsx(FILES.bdTargets.downloadUrl);
      const sheet = wb2.SheetNames[0];
      bdTargets = sheetToJson(wb2, sheet).slice(0, 20);
    } catch(e) { /* BD file optional */ }

    return res.status(200).json({
      success: true,
      briefing,
      contactCount: contacts.length,
      breakdown: {
        investment_bankers: contacts.filter(c => c.type === 'investment_banker').length,
        lps: contacts.filter(c => c.type === 'lp').length,
        family_offices: contacts.filter(c => c.type === 'family_office').length,
        capital_providers: contacts.filter(c => c.type === 'capital_provider').length,
      },
      bdTargetsCount: bdTargets.length,
      fileUrls: {
        bdTargets: FILES.bdTargets.shareUrl,
        cpTracker: FILES.cpTracker.shareUrl,
      },
      lastFetched: new Date().toISOString(),
    });

  } catch(err) {
    console.error('CRM error:', err);
    return res.status(500).json({ error: err.message });
  }
}