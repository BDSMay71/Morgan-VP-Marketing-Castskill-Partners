"""
Catskill Partners - Morgan Cole Intelligent Presentation Builder v7
Real internet images via web_search + fixed appendix sector slide mapping.
All imports at module level to satisfy Vercel Python scanner.
"""
from http.server import BaseHTTPRequestHandler
import json, io, os, re, base64, zipfile, urllib.request, urllib.parse
from urllib.parse import urljoin, quote
from lxml import etree

_DIR = os.path.dirname(os.path.abspath(__file__))

MAIN_SLIDES = {
    "cover":0,"disclaimer":1,"toc":2,"firm_overview":3,"deal_process":4,
    "strategy":5,"sector_focus":6,"market_data":7,"pipeline":8,"deal_flow":9,
    "underwriting":10,"playbook":11,"value_creation":12,"why_now":13,
    "closing":14,"legal_structure":15,"is_economics":16,"fund_economics":17,
    "team":18,"deal_summary":19,
}

APPENDIX_MAP = {
    "a_legal":15,"a_is_econ":16,"a_fund_econ":17,"a_team":18,
    "a_deal_summary":19,"a_pipeline":8,
    "a_sector_adv":6,"a_sector_eng":7,"a_sector_prec":6,
    "a_cases_cover":11,"a_bios":18,
}

DEFAULT_SELECTIONS = {
    "lp":["cover","toc","firm_overview","market_data","strategy","sector_focus",
          "pipeline","value_creation","why_now","fund_economics","team","closing","disclaimer"],
    "ib":["cover","toc","firm_overview","deal_process","pipeline","deal_flow",
          "sector_focus","value_creation","why_now","deal_summary","closing","disclaimer"],
    "founder":["cover","firm_overview","strategy","value_creation","why_now","playbook","closing"],
    "general":["cover","toc","firm_overview","market_data","strategy","pipeline",
               "value_creation","why_now","fund_economics","closing","disclaimer"],
}

def get_audience_key(a):
    a = a.lower()
    if any(x in a for x in ["lp","institutional","family","hnw"]): return "lp"
    if any(x in a for x in ["banker","intermediary","ib","broker"]): return "ib"
    if any(x in a for x in ["founder","owner","seller","operator"]): return "founder"
    return "general"

def call_anthropic(messages, system, api_key, max_tokens=1500, tools=None, timeout=30):
    body = {"model":"claude-sonnet-4-20250514","max_tokens":max_tokens,"system":system,"messages":messages}
    if tools:
        body["tools"] = tools
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=data,
        headers={"Content-Type":"application/json","x-api-key":api_key,"anthropic-version":"2023-06-01"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def extract_text(data):
    return " ".join(b.get("text","") for b in data.get("content",[]) if b.get("type")=="text").strip()

def parse_json_from_text(text):
    text = re.sub(r'```json
?', '', text).replace('```', '').strip()
    m = re.search(r'{.*}', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return {}
    return {}

ORCHESTRATE_SYS = """You are Morgan Cole, VP of Marketing at Catskill Partners LP.
Plan a custom investor deck. Return ONLY valid JSON with no markdown fences:
{
  "slide_selection": ["cover","toc","firm_overview"],
  "appendix_selection": ["a_fund_econ","a_team"],
  "image_requests": [
    {
      "title": "Operator PE Generates Higher Returns Than Financial Buyers",
      "subtitle": "Industry research supporting operator advantage",
      "search_query": "operator private equity returns IRR chart 2023 2024 McKinsey BCG Bain",
      "fallback_query": "private equity value creation operational improvement chart graph"
    }
  ],
  "deck_rationale": "Why this selection fits the request"
}
MAIN SLIDES: cover, disclaimer, toc, firm_overview, deal_process, strategy,
sector_focus, market_data, pipeline, deal_flow, underwriting, playbook,
value_creation, why_now, closing, legal_structure, is_economics, fund_economics,
team, deal_summary
APPENDIX SLIDES: a_legal, a_is_econ, a_fund_econ, a_team, a_pipeline,
a_deal_summary, a_sector_adv (Advanced Mfg), a_sector_eng (Engineered Materials),
a_sector_prec (Precision Components)
For image_requests 0-3 max. Find real published charts from McKinsey BCG Bain
CBRE JLL Deloitte PitchBook Preqin Houlihan Lokey ACG."""

def orchestrate(topic, audience, brief, task_type, incl_app, incl_img, api_key):
    key = get_audience_key(audience)
    if task_type == "lp_update": key = "lp"
    elif task_type == "ib_teaser": key = "ib"
    prompt = "Build custom Catskill deck.\nTopic: " + topic + "\nAudience: " + audience
    prompt += "\nBrief: " + (brief or "Standard overview")
    prompt += "\nInclude appendix: " + str(incl_app) + ", Include images: " + str(incl_img)
    if incl_img:
        prompt += "\nSelect 2-3 image_requests for real research chart images from public sources."
    else:
        prompt += "\nSet image_requests to []."
    if incl_app:
        prompt += "\nInclude 3-5 relevant appendix slides."
    else:
        prompt += "\nSet appendix_selection to []."
    try:
        d = call_anthropic([{"role":"user","content":prompt}], ORCHESTRATE_SYS, api_key, max_tokens=1000, timeout=20)
        r = parse_json_from_text(extract_text(d))
        if not r.get("slide_selection"):
            r["slide_selection"] = DEFAULT_SELECTIONS.get(key, DEFAULT_SELECTIONS["general"])
        return r
    except Exception:
        return {
            "slide_selection": DEFAULT_SELECTIONS.get(key, DEFAULT_SELECTIONS["general"]),
            "appendix_selection": ["a_fund_econ","a_team"] if incl_app else [],
            "image_requests": [],
        }

IMAGE_SEARCH_SYS = """You are a research analyst finding real chart images for investor presentations.
Use web_search to find actual published charts from research reports.
Return ONLY valid JSON with no markdown:
{
  "image_url": "https://example.com/chart.png",
  "page_url": "https://example.com/article",
  "source_name": "McKinsey Global Institute",
  "source_date": "2024",
  "chart_description": "What this chart shows",
  "title_override": "Better slide title based on what you found"
}
Only return URLs you actually found. Do NOT fabricate URLs."""

def _try_fetch_url(url, timeout=10):
    """Fetch a URL and return (bytes, content_type) or (None, None)."""
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent":"Mozilla/5.0 (compatible; research-bot/1.0)"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(), r.headers.get("Content-Type","image/png")
    except Exception:
        return None, None

def _ext_from_content_type(ct):
    if "jpeg" in ct or "jpg" in ct: return "jpg"
    if "gif" in ct: return "gif"
    if "webp" in ct: return "webp"
    return "png"

def _find_chart_img_on_page(page_bytes, page_url):
    """Scan page HTML for chart-like images and try to fetch one."""
    try:
        html = page_bytes.decode("utf-8", "ignore")
    except Exception:
        return None, None
    patterns = [
        r'<img[^>]+src=["']([^"']+(?:chart|graph|figure|exhibit|display)[^"']*)["']',
        r'<img[^>]+src=["']([^"']+.(?:png|jpg|jpeg|webp))["']',
    ]
    for pat in patterns:
        for img_src in re.findall(pat, html, re.I)[:6]:
            if not img_src.startswith("http"):
                img_src = urljoin(page_url, img_src)
            img_bytes, ct = _try_fetch_url(img_src, timeout=8)
            if img_bytes and len(img_bytes) > 10000:
                return img_bytes, _ext_from_content_type(ct or "")
    return None, None

def fetch_real_image(img_req, api_key):
    """Search web for a real published chart image, fetch its bytes."""
    query = img_req.get("search_query", "operator PE returns chart McKinsey BCG")
    fallback = img_req.get("fallback_query", "private equity returns chart 2024")
    prompt = ("Find a real published chart or graph image for an investor deck slide.\n"
              "Primary search: " + query + "\nFallback: " + fallback + "\n"
              "Slide context: " + img_req.get("title","") + "\n"
              "Search for the primary query first. If you find charts with direct image URLs return them. "
              "Prioritize McKinsey BCG Bain CBRE JLL Deloitte PitchBook Preqin Houlihan Lokey.")
    try:
        tools = [{"type":"web_search_20250305","name":"web_search"}]
        d = call_anthropic([{"role":"user","content":prompt}], IMAGE_SEARCH_SYS, api_key,
                           max_tokens=600, tools=tools, timeout=25)
        result = parse_json_from_text(extract_text(d))
        img_url = result.get("image_url","")
        page_url = result.get("page_url","")
        # Try direct image URL first
        if img_url and re.search(r'.(png|jpg|jpeg|gif|webp)(?|$)', img_url, re.I):
            img_bytes, ct = _try_fetch_url(img_url, timeout=10)
            if img_bytes and len(img_bytes) > 5000:
                return {
                    "bytes": img_bytes,
                    "ext": _ext_from_content_type(ct or ""),
                    "source": result.get("source_name","Research Report"),
                    "date": result.get("source_date","2024"),
                    "title_override": result.get("title_override",""),
                }
        # Try page URL - scrape for chart images
        if page_url:
            page_bytes, _ = _try_fetch_url(page_url, timeout=8)
            if page_bytes:
                img_bytes, ext = _find_chart_img_on_page(page_bytes, page_url)
                if img_bytes:
                    return {
                        "bytes": img_bytes,
                        "ext": ext or "png",
                        "source": result.get("source_name","Research"),
                        "date": result.get("source_date","2024"),
                        "title_override": result.get("title_override",""),
                    }
    except Exception:
        pass
    return None

def make_image_slide_xml(title, source_line, img_rId):
    title_safe = title[:80].replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')
    src_safe = source_line[:140].replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    return (
        "<?xml version='1.0' encoding='UTF-8' standalone='yes'?>"
        "<p:sld xmlns:p='http://schemas.openxmlformats.org/presentationml/2006/main'"
        " xmlns:a='http://schemas.openxmlformats.org/drawingml/2006/main'"
        " xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'>"
        "<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val='1A4C3D'/></a:solidFill>"
        "<a:effectLst/></p:bgPr></p:bg><p:spTree>"
        "<p:nvGrpSpPr><p:cNvPr id='1' name=''/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>"
        "<p:grpSpPr><a:xfrm><a:off x='0' y='0'/><a:ext cx='0' cy='0'/>"
        "<a:chOff x='0' y='0'/><a:chExt cx='0' cy='0'/></a:xfrm></p:grpSpPr>"
        "<p:sp><p:nvSpPr><p:cNvPr id='2' name='Title'/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>"
        "<p:spPr><a:xfrm><a:off x='457200' y='190500'/><a:ext cx='8229600' cy='600075'/></a:xfrm>"
        "<a:prstGeom prst='rect'><a:avLst/></a:prstGeom><a:noFill/></p:spPr>"
        "<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>"
        "<a:rPr lang='en-US' sz='1800' b='1' dirty='0'>"
        "<a:solidFill><a:srgbClr val='FFFFFF'/></a:solidFill>"
        "<a:latin typeface='+mj-lt'/></a:rPr>"
        "<a:t>" + title_safe + "</a:t></a:r></a:p></p:txBody></p:sp>"
        "<p:pic><p:nvPicPr><p:cNvPr id='3' name='ChartImg'/>"
        "<p:cNvPicPr><a:picLocks noChangeAspect='1'/></p:cNvPicPr><p:nvPr/></p:nvPicPr>"
        "<p:blipFill><a:blip r:embed='" + img_rId + "'/>"
        "<a:stretch><a:fillRect/></a:stretch></p:blipFill>"
        "<p:spPr><a:xfrm><a:off x='457200' y='857250'/><a:ext cx='8229600' cy='5029200'/></a:xfrm>"
        "<a:prstGeom prst='rect'><a:avLst/></a:prstGeom></p:spPr></p:pic>"
        "<p:sp><p:nvSpPr><p:cNvPr id='4' name='Source'/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>"
        "<p:spPr><a:xfrm><a:off x='457200' y='6096000'/><a:ext cx='8229600' cy='228600'/></a:xfrm>"
        "<a:prstGeom prst='rect'><a:avLst/></a:prstGeom><a:noFill/></p:spPr>"
        "<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>"
        "<a:rPr lang='en-US' sz='900' dirty='0'>"
        "<a:solidFill><a:srgbClr val='6BAE7F'/></a:solidFill>"
        "<a:latin typeface='+mn-lt'/></a:rPr>"
        "<a:t>" + src_safe + "</a:t></a:r></a:p></p:txBody></p:sp>"
        "</p:spTree></p:cSld>"
        "<p:clrMapOvr><a:masterClr/></p:clrMapOvr></p:sld>"
    ).encode("utf-8")

def subset_deck(src_path, slide_indices):
    NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    with zipfile.ZipFile(src_path, "r") as zin:
        prs_rels_tree = etree.fromstring(zin.read("ppt/_rels/presentation.xml.rels"))
        all_slides = []
        for rel in prs_rels_tree:
            rt = rel.get("Type",""); tgt = rel.get("Target","")
            if rt.endswith("/slide") and re.match(r"slides/slide\d+\.xml$", tgt):
                m = re.search(r"slide(\d+)\.xml$", tgt)
                if m:
                    all_slides.append((int(m.group(1)), rel.get("Id"), tgt))
        all_slides.sort(key=lambda x: x[0])
        if not all_slides:
            raise ValueError("No slides found in deck")
        slide_map = {i: {"num":num,"rId":rid} for i,(num,rid,_) in enumerate(all_slides)}
        max_idx = len(slide_map) - 1
        seen_i = set(); valid = []
        for i in slide_indices:
            if 0 <= i <= max_idx and i not in seen_i:
                seen_i.add(i); valid.append(i)
        kept_rids = {slide_map[i]["rId"] for i in valid}
        kept_nums = {slide_map[i]["num"] for i in valid}
        unwanted = {info["num"] for info in slide_map.values()} - kept_nums
        prs_tree = etree.fromstring(zin.read("ppt/presentation.xml"))
        sldIdLst = prs_tree.find("{" + NS_P + "}sldIdLst")
        if sldIdLst is not None:
            for s in list(sldIdLst):
                if s.get("{" + NS_R + "}id") not in kept_rids:
                    sldIdLst.remove(s)
        for rel in list(prs_rels_tree):
            rt = rel.get("Type",""); tgt = rel.get("Target","")
            if rt.endswith("/slide") and re.match(r"slides/slide\d+\.xml$", tgt):
                if rel.get("Id") not in kept_rids:
                    prs_rels_tree.remove(rel)
        def skip(fn):
            for n in unwanted:
                if fn in ("ppt/slides/slide"+str(n)+".xml",
                          "ppt/slides/_rels/slide"+str(n)+".xml.rels",
                          "ppt/notesSlides/notesSlide"+str(n)+".xml",
                          "ppt/notesSlides/_rels/notesSlide"+str(n)+".xml.rels"):
                    return True
            return False
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zout:
            seen_files = set()
            for item in zin.infolist():
                fn = item.filename
                if fn in seen_files:
                    continue
                seen_files.add(fn)
                if skip(fn):
                    continue
                if fn == "ppt/presentation.xml":
                    data = etree.tostring(prs_tree, xml_declaration=True, encoding="UTF-8", standalone=True)
                elif fn == "ppt/_rels/presentation.xml.rels":
                    data = etree.tostring(prs_rels_tree, xml_declaration=True, encoding="UTF-8", standalone=True)
                else:
                    data = zin.read(fn)
                zout.writestr(item, data)
        buf.seek(0)
        return buf.read()

def inject_image_slides(pptx_bytes, image_slides):
    NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
    with zipfile.ZipFile(io.BytesIO(pptx_bytes), "r") as zin:
        ex_s = [int(re.search(r"slide(\d+)\.xml$",f).group(1)) for f in zin.namelist() if re.match(r"ppt/slides/slide\d+\.xml$",f)]
        max_s = max(ex_s) if ex_s else 0
        ex_i = [int(re.search(r"image(\d+)\.",f).group(1)) for f in zin.namelist() if re.match(r"ppt/media/image\d+\.",f)]
        max_i = max(ex_i) if ex_i else 0
        layout_tgt = "../slideLayouts/slideLayout1.xml"
        for name in zin.namelist():
            if re.match(r"ppt/slides/_rels/slide\d+\.xml\.rels$", name):
                try:
                    rels = etree.fromstring(zin.read(name))
                    for rel in rels:
                        if "slideLayout" in rel.get("Type","") and rel.get("Target",""):
                            layout_tgt = rel.get("Target"); break
                except Exception:
                    pass
                break
        prs_tree = etree.fromstring(zin.read("ppt/presentation.xml"))
        prs_rels_tree = etree.fromstring(zin.read("ppt/_rels/presentation.xml.rels"))
        sldIdLst = prs_tree.find("{" + NS_P + "}sldIdLst")
        max_id = max((int(e.get("id",0)) for e in sldIdLst), default=256) if sldIdLst is not None else 256
        max_rid = max((int(re.search(r"rId(\d+)", r.get("Id","")).group(1)) for r in prs_rels_tree if re.search(r"rId(\d+)", r.get("Id",""))), default=0)
        ct_tree = etree.fromstring(zin.read("[Content_Types].xml"))
        new_files = {}
        for i, cs in enumerate(image_slides):
            sn = max_s + 1 + i
            img_n = max_i + 1 + i
            ext = cs.get("ext","png")
            sr = "rId" + str(max_rid + 1 + i)
            sp = "ppt/slides/slide" + str(sn) + ".xml"
            srp = "ppt/slides/_rels/slide" + str(sn) + ".xml.rels"
            ip = "ppt/media/image" + str(img_n) + "." + ext
            it = "../media/image" + str(img_n) + "." + ext
            src_line = ("Source: " + cs.get("source","Research Report") + " " +
                        cs.get("date","2024") + "  |  CATSKILL PARTNERS  .  CLARITY. CRAFT. CAPITAL.")
            new_files[ip] = cs["bytes"]
            new_files[sp] = make_image_slide_xml(cs["title"], src_line, "rId2")
            new_files[srp] = (
                "<?xml version='1.0' encoding='UTF-8' standalone='yes'?>"
                "<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>"
                "<Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout' Target='" + layout_tgt + "'/>"
                "<Relationship Id='rId2' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/image' Target='" + it + "'/>"
                "</Relationships>"
            ).encode("utf-8")
            if sldIdLst is not None:
                ns = etree.SubElement(sldIdLst, "{" + NS_P + "}sldId")
                ns.set("id", str(max_id + 1 + i))
                ns.set("{" + NS_R + "}id", sr)
            nr = etree.SubElement(prs_rels_tree, "Relationship")
            nr.set("Id", sr)
            nr.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide")
            nr.set("Target", "slides/slide" + str(sn) + ".xml")
            pn = "/ppt/slides/slide" + str(sn) + ".xml"
            if not any(e.get("PartName") == pn for e in ct_tree):
                nc = etree.SubElement(ct_tree, "{" + CT_NS + "}Override")
                nc.set("PartName", pn)
                nc.set("ContentType","application/vnd.openxmlformats-officedocument.presentationml.slide+xml")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zout:
            seen_f = set()
            for item in zin.infolist():
                fn = item.filename
                if fn in seen_f: continue
                seen_f.add(fn)
                if fn == "ppt/presentation.xml":
                    data = etree.tostring(prs_tree, xml_declaration=True, encoding="UTF-8", standalone=True)
                elif fn == "ppt/_rels/presentation.xml.rels":
                    data = etree.tostring(prs_rels_tree, xml_declaration=True, encoding="UTF-8", standalone=True)
                elif fn == "[Content_Types].xml":
                    data = etree.tostring(ct_tree, xml_declaration=True, encoding="UTF-8", standalone=True)
                else:
                    data = zin.read(fn)
                zout.writestr(item, data)
            for path, data in new_files.items():
                zout.writestr(path, data)
        buf.seek(0)
        return buf.read()

def build_deck(topic, audience, brief, tone, task_type, incl_app, incl_img, api_key):
    main_path = os.path.join(_DIR, "main_deck.pptx")
    if not os.path.exists(main_path):
        raise FileNotFoundError("main_deck.pptx not found at " + main_path)
    plan = orchestrate(topic, audience, brief, task_type, incl_app, incl_img, api_key)
    # Resolve main slides
    key = get_audience_key(audience)
    defaults = DEFAULT_SELECTIONS.get(key, DEFAULT_SELECTIONS["general"])
    main_indices = []
    for name in plan.get("slide_selection", defaults):
        idx = MAIN_SLIDES.get(name)
        if idx is not None:
            main_indices.append(idx)
    if not main_indices:
        main_indices = [MAIN_SLIDES[n] for n in defaults if n in MAIN_SLIDES]
    # Resolve appendix slides
    appendix_names = plan.get("appendix_selection", [])
    if incl_app and appendix_names:
        extra = []
        for name in appendix_names:
            idx = APPENDIX_MAP.get(name)
            if idx is not None and idx not in main_indices:
                extra.append(idx)
        if extra:
            closing_pos = next((i for i,v in enumerate(main_indices) if v==14), len(main_indices))
            main_indices = main_indices[:closing_pos] + extra + main_indices[closing_pos:]
    pptx_bytes = subset_deck(main_path, main_indices)
    # Fetch real internet images
    image_slides = []
    if incl_img:
        for img_req in plan.get("image_requests", [])[:3]:
            result = fetch_real_image(img_req, api_key)
            if result and result.get("bytes"):
                title = result.get("title_override","") or img_req.get("title","Market Research")
                image_slides.append({
                    "title": title,
                    "bytes": result["bytes"],
                    "ext": result.get("ext","png"),
                    "source": result.get("source","Public Research"),
                    "date": result.get("date","2024"),
                })
    if image_slides:
        pptx_bytes = inject_image_slides(pptx_bytes, image_slides)
    return pptx_bytes, len(image_slides), plan.get("deck_rationale","Custom deck assembled")

class handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            if not api_key:
                return self._err(500, "API key not configured")
            pptx_bytes, img_count, rationale = build_deck(
                body.get("topic","Catskill Partners Overview"),
                body.get("audience","LP / Institutional Investor"),
                body.get("brief",""), body.get("tone","Institutional"),
                body.get("taskType","full_deck"),
                body.get("includeAppendix",False),
                body.get("includeMarketCharts",False),
                api_key)
            with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as z:
                pr = etree.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
                sc = sum(1 for r in pr if r.get("Type","").endswith("/slide")
                         and re.match(r"slides/slide\d+\.xml$", r.get("Target","")))
            slug = re.sub(r"[^a-zA-Z0-9]", "-", body.get("topic","deck"))[:40]
            resp = json.dumps({
                "success": True,
                "filename": "Catskill-" + slug + ".pptx",
                "base64": base64.b64encode(pptx_bytes).decode(),
                "slideCount": sc,
                "imageSlides": img_count,
                "title": body.get("topic",""),
                "rationale": rationale,
            }).encode()
            self.send_response(200); self._cors()
            self.send_header("Content-Type","application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers(); self.wfile.write(resp)
        except Exception as e:
            import traceback
            self._err(500, str(e), traceback.format_exc()[:800])
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
    def _err(self, code, msg, detail=""):
        r = json.dumps({"error":msg,"detail":detail}).encode()
        self.send_response(code); self._cors()
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length", str(len(r)))
        self.end_headers(); self.wfile.write(r)
