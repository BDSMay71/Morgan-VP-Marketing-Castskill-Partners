"""
Catskill Partners — Python PPTX Generator
Template-based: clones real slides from reference deck, injects Claude content
Vercel serverless handler
"""

from http.server import BaseHTTPRequestHandler
import json, base64, io, os, copy, re, urllib.request, urllib.parse

# ─── Text replacement helpers ────────────────────────────────────────────────

def qn(tag):
    nsmap = {
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    }
    ns, local = tag.split(':')
    return f'{{{nsmap[ns]}}}{local}'

def set_para_text(para, new_text):
    """Replace paragraph text, keep first run's rPr format"""
    from lxml import etree
    runs = para._p.findall(qn('a:r'))
    if not runs:
        return
    # Capture first run's rPr
    first_rPr = None
    rPr = runs[0].find(qn('a:rPr'))
    if rPr is not None:
        first_rPr = copy.deepcopy(rPr)
    # Remove all runs
    for r in runs:
        para._p.remove(r)
    # Add single run
    r_new = etree.SubElement(para._p, qn('a:r'))
    if first_rPr is not None:
        r_new.append(first_rPr)
    t_new = etree.SubElement(r_new, qn('a:t'))
    t_new.text = new_text

def replace_in_slide(slide, replacements):
    """Apply text replacements to all shapes in a slide"""
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            full = ''.join(r.text for r in para.runs)
            for old, new in replacements.items():
                if old in full:
                    set_para_text(para, full.replace(old, new))
                    break

def replace_text_multi(slide, replacements):
    """Replace text across merged runs (handles split text in XML)"""
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        # Collect shapes text block for substring matching
        for para in shape.text_frame.paragraphs:
            full = ''.join(r.text for r in para.runs)
            for old, new in replacements.items():
                if old and old in full:
                    set_para_text(para, full.replace(old, new, 1))


# ─── Slide cloning ────────────────────────────────────────────────────────────

def clone_slide(src_prs, src_idx, tgt_prs):
    """Clone a slide from src_prs (by index) into tgt_prs, preserving images"""
    from lxml import etree
    src = src_prs.slides[src_idx]
    blank = tgt_prs.slide_layouts[6]
    dst = tgt_prs.slides.add_slide(blank)

    # Replace spTree
    dst_sp = dst.shapes._spTree
    for child in list(dst_sp):
        dst_sp.remove(child)
    for elem in src.shapes._spTree:
        dst_sp.append(copy.deepcopy(elem))

    # Copy background
    src_csld = src._element.find(qn('p:cSld'))
    dst_csld = dst._element.find(qn('p:cSld'))
    src_bg = src_csld.find(qn('p:bg'))
    if src_bg is not None:
        dst_bg = dst_csld.find(qn('p:bg'))
        if dst_bg is not None:
            dst_csld.remove(dst_bg)
        dst_csld.insert(0, copy.deepcopy(src_bg))

    # Copy relationships (images, etc.)
    rId_map = {}
    for rId, rel in src.part.rels.items():
        try:
            if rel.is_external:
                new_rId = dst.part.relate_to(rel.target, rel.reltype, is_external=True)
            else:
                new_rId = dst.part.relate_to(rel.target_part, rel.reltype)
            if new_rId != rId:
                rId_map[rId] = new_rId
        except Exception:
            pass

    # Fix rId references in XML if any changed
    if rId_map:
        xml_str = etree.tostring(dst._element, encoding='unicode')
        for old, new in rId_map.items():
            xml_str = xml_str.replace(f'r:embed="{old}"', f'r:embed="{new}"')
            xml_str = xml_str.replace(f'r:id="{old}"', f'r:id="{new}"')
        new_elem = etree.fromstring(xml_str)
        parent = dst._element.getparent()
        if parent is not None:
            idx_in_parent = list(parent).index(dst._element)
            parent.remove(dst._element)
            parent.insert(idx_in_parent, new_elem)

    return dst


# ─── Slide type handlers ──────────────────────────────────────────────────────
# Each function applies structured content to a cloned template slide

SLIDE_IDX = {
    'cover':           0,   # Mountain photo, CLARITY. CRAFT. CAPITAL.
    'disclaimer':      1,   # Confidential disclaimer
    'toc':             2,   # Table of Contents
    'firm_overview':   3,   # WHO WE ARE / WHY WE WIN
    'deal_stats':      4,   # 20+ / 30+ / 11 / ~11x key metrics
    'investment_strategy': 5, # Proven Investment Strategy lifecycle
    'sector_focus':    6,   # LMM Sub-Segment Focus
    'market_data':     7,   # 60%+ / $250B+ / <10%
    'pipeline':        8,   # 1,700+ owner database
    'deal_flow':       9,   # Deal Flow Funnel YTD
    'underwriting':    10,  # How We Underwrite Risk & Earnings Power
    'playbook':        11,  # Value Creation Playbook numbered
    'value_creation':  12,  # Catskill Value Creation Model
    'why_now':         13,  # Why Now / Why Us
    'closing':         14,  # Let's Build Enduring Value Together
    'legal_structure': 15,  # IS Legal Entity Structure
    'is_economics':    16,  # Independent Sponsor Model Economics
    'fund_economics':  17,  # Fund I Model Economics
    'team':            18,  # Team Evolution & Readiness
    'deal_summary':    19,  # Deal summary (Project Anchor format)
}

def apply_cover(slide, c):
    r = {}
    if c.get('audience_line'):
        r['Investor Overview'] = c['audience_line']
    if c.get('tagline'):
        r['CLARITY. CRAFT. CAPITAL.'] = c['tagline']
    replace_in_slide(slide, r)

def apply_toc(slide, c):
    items = c.get('items', [])
    if not items:
        return
    # Right column text block contains the TOC items
    existing = 'Catskill Partners Overview\nDifferentiated Investment Strategy\nThe Market Opportunity\nSourcing Strategy\nUnderwriting Discipline\nValue Creation Playbook\nFund Structure & Economics\nTeam\nCurrent Portfolio & Pipeline'
    new_items = '\n'.join(items[:9])
    replace_in_slide(slide, {'Table of Contents': c.get('title', 'Table of Contents')})
    replace_text_multi(slide, {existing: new_items})

def apply_firm_overview(slide, c):
    r = {}
    if c.get('who_we_are'): r['AN OPERATOR-FIRST PRIVATE EQUITY FIRM'] = c['who_we_are'][:60]
    if c.get('why_we_win'): r['WHY WE WIN'] = c.get('why_we_win_heading', 'WHY WE WIN')
    if c.get('stat1_label'): r['50+ Years'] = c['stat1_label']
    if c.get('stat1_desc'): r['Senior operating leadership'] = c['stat1_desc']
    if c.get('stat2_label'): r['25+ Years'] = c['stat2_label']
    if c.get('stat2_desc'): r['ICT / Data Center Experience'] = c['stat2_desc']
    if c.get('stat3_label'): r['20+ Years '] = c['stat3_label']
    if c.get('stat3_desc'): r['PE Experience'] = c['stat3_desc']
    replace_in_slide(slide, r)

def apply_market_data(slide, c):
    r = {}
    if c.get('stat1_value'): r['60%+'] = c['stat1_value']
    if c.get('stat1_label'): r['SUCCESSION WAVE'] = c['stat1_label']
    if c.get('stat1_desc'): r['of LMM industrial owners are 55+ years old'] = c.get('stat1_desc', '')
    if c.get('stat2_value'): r['$250B+'] = c['stat2_value']
    if c.get('stat2_label'): r['DEMAND SUPERCYCLE'] = c['stat2_label']
    if c.get('stat2_desc'): r['in global data center infrastructure capex through 2030'] = c.get('stat2_desc', '')
    if c.get('stat3_value'): r['<10%'] = c['stat3_value']
    if c.get('stat3_label'): r['SUPPLY GAP'] = c['stat3_label']
    replace_in_slide(slide, r)

def apply_pipeline(slide, c):
    r = {}
    if c.get('stat1_value'): r['1,700+'] = c['stat1_value']
    if c.get('stat1_desc'): r['Proprietary Owner \nData base'] = c.get('stat1_desc', '')
    if c.get('stat2_value'): r['14'] = c['stat2_value']
    if c.get('stat2_desc'): r['Active Opportunities\n(March 2026)'] = c.get('stat2_desc', '')
    if c.get('stat3_value'): r['>50%'] = c['stat3_value']
    if c.get('stat4_value'): r['1'] = c['stat4_value']
    replace_in_slide(slide, r)

def apply_deal_stats(slide, c):
    r = {}
    stats = c.get('stats', [])
    keys = [('20+', 'SOURCING', 'Proprietary deal opportunities sourced'),
            ('30+', 'UNDERWRITING', 'In-depth underwriting models built'),
            ('11', 'MANAGEMENT MEETINGS', 'Management presentations completed'),
            ('~11x', 'FUNNEL EFFICIENCY', 'Opportunities evaluated per closed deal')]
    for i, (val_k, lbl_k, desc_k) in enumerate(keys):
        if i < len(stats):
            s = stats[i]
            if s.get('value'): r[val_k] = s['value']
            if s.get('label'): r[lbl_k] = s['label']
    replace_in_slide(slide, r)

def apply_why_now(slide, c):
    r = {}
    if c.get('stat1'): r['60%+'] = c['stat1']
    if c.get('stat2'): r['$250B+'] = c['stat2']
    if c.get('stat3'): r['<10%'] = c['stat3']
    if c.get('edge1_label'): r['SOURCING EDGE'] = c['edge1_label']
    if c.get('edge2_label'): r['UNDERWRITING EDGE'] = c.get('edge2_label', 'UNDERWRITING EDGE')
    replace_in_slide(slide, r)

def apply_fund_economics(slide, c):
    r = {}
    # Fund structure block
    orig = 'Fund Structure\nTarget Fund Size: $250M\nInvestment Period: 5 years with two 1-year extensions at GP discretion\nFund Life: 10 years, with two 1-year extensions subject to LP approval\nReserve: ~25% for add-on acquisitions (flexible based on opportunities)'
    new_struct = c.get('fund_structure', orig)
    replace_text_multi(slide, {orig[:40]: new_struct})
    replace_in_slide(slide, r)

def apply_is_economics(slide, c):
    # Keep mostly as-is, update specific numbers if provided
    r = {}
    if c.get('pref_return'): r['Preferred Return to LPs: 8%'] = f"Preferred Return to LPs: {c['pref_return']}"
    replace_in_slide(slide, r)

def apply_team(slide, c):
    r = {}
    if c.get('today_heading'): r['TODAY'] = c['today_heading']
    if c.get('month24_heading'): r['MONTH 24'] = c['month24_heading']
    replace_in_slide(slide, r)

def apply_closing(slide, c):
    r = {}
    if c.get('title'): r["Let's Build Enduring Value Together"] = c['title']
    if c.get('body'): r['We partner with management teams, investors, and strategic operators'] = c['body'][:80]
    replace_in_slide(slide, r)

def apply_deal_summary(slide, c):
    r = {}
    if c.get('name'): r['PROJECT ANCHOR'] = c['name'].upper()
    if c.get('description'): r['Industrial Power Solutions Platform: Platform Investment Summary'] = c['description'][:70]
    if c.get('revenue'): r['~$50M'] = c['revenue']
    if c.get('ebitda'): r['~$13M'] = c['ebitda']
    replace_in_slide(slide, r)

SLIDE_APPLIERS = {
    'cover': apply_cover,
    'toc': apply_toc,
    'firm_overview': apply_firm_overview,
    'market_data': apply_market_data,
    'pipeline': apply_pipeline,
    'deal_stats': apply_deal_stats,
    'why_now': apply_why_now,
    'fund_economics': apply_fund_economics,
    'is_economics': apply_is_economics,
    'team': apply_team,
    'closing': apply_closing,
    'deal_summary': apply_deal_summary,
}


# ─── Claude content generation ───────────────────────────────────────────────

CLAUDE_SYSTEM = """You are Morgan Cole, VP of Marketing at Catskill Partners LP.

FIRM FACTS:
- Operator-led PE: Brian Steel (CEO/operator, Tenere/Cadrex) + Mike Fuller (PE investor, ICT expert)
- Fund I: $250M target | 6-8 platform companies | $2-20M EBITDA | $25-150M EV | North America
- Sectors: Advanced Manufacturing, Engineered Materials, Precision Components, ICT/Data Center supply chain
- Market thesis: 70%+ LMM owners 55+ (succession wave) | $250B+ data center capex through 2030
- Returns: 25-30% target IRR | 3-4x MOIC | 6yr avg hold | Independent Sponsor → Fund I in 18-24 months
- Tagline: CLARITY. CRAFT. CAPITAL. | We are operators first.

AVAILABLE SLIDE TYPES (pick 8-12 for each deck):
- cover: Photo cover with title and audience line
- toc: Table of Contents (list up to 8 items)
- firm_overview: WHO WE ARE stats grid (stat1/2/3 with label+desc, who_we_are text)
- market_data: Three big stats (stat1/2/3 each with value, label, desc)
- pipeline: Four big pipeline stats (stat1-4 with value+desc)
- deal_stats: Four deal metrics (stats array: [{value, label}])
- investment_strategy: Proven strategy lifecycle (no edits needed, include as-is)
- sector_focus: Sub-segment focus (no edits needed, include as-is)
- deal_flow: Deal flow funnel (no edits needed, include as-is)
- underwriting: Underwriting discipline (no edits needed, include as-is)
- playbook: Value creation playbook numbered (no edits needed, include as-is)
- value_creation: Value creation model (no edits needed, include as-is)
- why_now: Why Now/Why Us (stat1/2/3 big numbers, edge1/2 labels)
- legal_structure: IS Legal Structure (no edits needed, include as-is)
- is_economics: IS Model Economics (pref_return if needed)
- fund_economics: Fund I Model Economics (fund_structure text if needed)
- team: Team Evolution timeline (today/month24 headings)
- deal_summary: Deal summary (name, description, revenue, ebitda)
- closing: Closing slide (title, body)
- disclaimer: Disclaimer (no edits needed, always include last)

Always include: cover (first), closing (second to last), disclaimer (last).
Choose additional slides based on audience:
- LP/Family Office: firm_overview, market_data, why_now, fund_economics, is_economics, team
- Investment Banker/IB: deal_flow, pipeline, deal_stats, value_creation, sector_focus, deal_summary
- General: firm_overview, market_data, investment_strategy, why_now, value_creation

RETURN ONLY VALID JSON — no markdown, no backticks:
{
  "title": "string",
  "slides": [
    {"type": "cover", "audience_line": "...", "tagline": "CLARITY. CRAFT. CAPITAL."},
    {"type": "toc", "title": "Table of Contents", "items": ["Firm Overview", ...]},
    {"type": "market_data", "stat1_value": "70%+", "stat1_label": "SUCCESSION WAVE", "stat1_desc": "of LMM industrial owners are 55+ years old", "stat2_value": "$250B+", "stat2_label": "DEMAND SUPERCYCLE", "stat2_desc": "in global data center infrastructure capex through 2030", "stat3_value": "<10%", "stat3_label": "SUPPLY GAP", "stat3_desc": "of LMM manufacturers serve ICT markets today"},
    {"type": "closing", "title": "Let's Build Enduring Value Together", "body": "We partner with..."},
    {"type": "disclaimer"}
  ]
}"""

def call_claude(topic, audience, brief, tone, api_key):
    prompt = f"""Generate a complete institutional presentation.
Topic: {topic}
Audience: {audience}
Brief: {brief or 'Standard Catskill Partners LP overview for institutional investors'}
Tone: {tone or 'Institutional, rigorous, data-forward'}

Generate 10-14 slides appropriate for this audience. Use real Catskill Partners data throughout.
Include appendix slides (legal_structure, fund_economics, team) for LP/Family Office audiences.
Include deal_flow, pipeline, deal_stats for IB audiences."""

    body = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 4000,
        "system": CLAUDE_SYSTEM,
        "messages": [{"role": "user", "content": prompt}]
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=body,
        headers={
            'Content-Type': 'application/json',
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
        }
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read())

    raw = data.get('content', [{}])[0].get('text', '{}')
    raw = re.sub(r'```json\n?', '', raw)
    raw = re.sub(r'```\n?', '', raw)
    try:
        return json.loads(raw.strip())
    except Exception:
        return _fallback_deck(topic, audience)


def _fallback_deck(topic, audience):
    return {
        "title": topic or "Catskill Partners LP",
        "slides": [
            {"type": "cover", "audience_line": audience or "Investor Overview"},
            {"type": "toc", "items": ["Firm Overview", "Market Opportunity", "Investment Strategy", "Why Catskill", "Fund Economics", "Team"]},
            {"type": "firm_overview"},
            {"type": "market_data", "stat1_value": "70%+", "stat1_label": "SUCCESSION WAVE", "stat1_desc": "of LMM industrial owners are 55+ years old", "stat2_value": "$250B+", "stat2_label": "DEMAND SUPERCYCLE", "stat2_desc": "in global data center capex through 2030", "stat3_value": "<10%", "stat3_label": "SUPPLY GAP", "stat3_desc": "of LMM manufacturers serve ICT markets today"},
            {"type": "investment_strategy"},
            {"type": "why_now"},
            {"type": "value_creation"},
            {"type": "fund_economics"},
            {"type": "team"},
            {"type": "closing", "title": "Let's Build Enduring Value Together"},
            {"type": "disclaimer"},
        ]
    }


# ─── Main build function ──────────────────────────────────────────────────────

def build_deck(template_path, deck_spec):
    from pptx import Presentation
    import io

    src = Presentation(template_path)

    # Build output presentation with same dimensions
    out = Presentation()
    out.slide_width = src.slide_width
    out.slide_height = src.slide_height

    for slide_spec in deck_spec.get('slides', []):
        stype = slide_spec.get('type', 'firm_overview')
        idx = SLIDE_IDX.get(stype)

        if idx is None:
            # Unknown type — skip
            continue

        # Clone the template slide
        slide = clone_slide(src, idx, out)

        # Apply content
        applier = SLIDE_APPLIERS.get(stype)
        if applier:
            try:
                applier(slide, slide_spec)
            except Exception as e:
                pass  # Don't crash on partial apply errors

    buf = io.BytesIO()
    out.save(buf)
    return buf.getvalue()


# ─── Vercel handler ───────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress default access log

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body) if body else {}

            api_key = os.environ.get('ANTHROPIC_API_KEY', '')
            if not api_key:
                return self._error(500, 'API key not configured')

            topic    = data.get('topic', 'Catskill Partners LP')
            audience = data.get('audience', 'Investment Bankers and Capital Allocators')
            brief    = data.get('brief', '')
            tone     = data.get('tone', 'Institutional (rigorous, data-forward)')

            # Generate content via Claude
            deck_spec = call_claude(topic, audience, brief, tone, api_key)

            # Load template from same directory as this file
            template_path = os.path.join(os.path.dirname(__file__), 'template.pptx')
            pptx_bytes = build_deck(template_path, deck_spec)

            # Return as base64
            slug = re.sub(r'[^a-zA-Z0-9]', '-', topic)[:40]
            filename = f'Catskill-Partners-{slug}.pptx'

            result = json.dumps({
                'success': True,
                'filename': filename,
                'base64': base64.b64encode(pptx_bytes).decode(),
                'slideCount': len(deck_spec.get('slides', [])),
                'title': deck_spec.get('title', topic),
            }).encode('utf-8')

            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(result)))
            self.end_headers()
            self.wfile.write(result)

        except Exception as e:
            import traceback
            self._error(500, str(e), traceback.format_exc())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _error(self, code, msg, detail=''):
        resp = json.dumps({'error': msg, 'detail': detail}).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)
