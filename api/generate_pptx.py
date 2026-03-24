"""
Morgan Cole — Intelligent Presentation Builder v7
KEY CHANGES FROM v6:
  1. REAL INTERNET IMAGES: Claude web-searches for actual chart images from 
     McKinsey, BCG, Bain, CBRE, Deloitte, PitchBook, etc. then downloads
     the actual image file and embeds it directly into the slide.
  2. APPENDIX SECTOR SLIDES: Properly maps sector-specific slides.
     a_sector_adv/eng/prec now use main deck slides 6,7 with different 
     framing, plus v2 handles real appendix when available.
  3. SMART IMAGE SEARCH: Uses web_search tool to find public chart images
     from real research reports, then fetches binary image data.
"""
from http.server import BaseHTTPRequestHandler
import json, io, os, re, base64, zipfile, urllib.request, urllib.parse
from lxml import etree

_DIR = os.path.dirname(os.path.abspath(__file__))

MAIN_SLIDES = {
    "cover":0,"disclaimer":1,"toc":2,"firm_overview":3,"deal_process":4,
    "strategy":5,"sector_focus":6,"market_data":7,"pipeline":8,"deal_flow":9,
    "underwriting":10,"playbook":11,"value_creation":12,"why_now":13,
    "closing":14,"legal_structure":15,"is_economics":16,"fund_economics":17,
    "team":18,"deal_summary":19,
}

# Appendix slides — indices into appendix_deck.pptx
# When appendix_deck.pptx = main_deck.pptx copy, we use the best matching slides
APPENDIX_MAP = {
    "a_legal":15,"a_is_econ":16,"a_fund_econ":17,"a_team":18,
    "a_deal_summary":19,"a_pipeline":8,
    # Sector deep dives — main deck slides 6,7 are most relevant
    "a_sector_adv":6,"a_sector_eng":7,"a_sector_prec":6,
    "a_cases_cover":11,"a_bios":18,
}

DEFAULT_SELECTIONS = {
    "lp":      ["cover","toc","firm_overview","market_data","strategy","sector_focus",
                "pipeline","value_creation","why_now","fund_economics","team","closing","disclaimer"],
    "ib":      ["cover","toc","firm_overview","deal_process","pipeline","deal_flow",
                "sector_focus","value_creation","why_now","deal_summary","closing","disclaimer"],
    "founder": ["cover","firm_overview","strategy","value_creation","why_now","playbook","closing"],
    "general": ["cover","toc","firm_overview","market_data","strategy","pipeline",
                "value_creation","why_now","fund_economics","closing","disclaimer"],
}

def get_audience_key(a):
    a=a.lower()
    if any(x in a for x in ["lp","institutional","family","hnw"]): return "lp"
    if any(x in a for x in ["banker","intermediary","ib","broker"]): return "ib"
    if any(x in a for x in ["founder","owner","seller","operator"]): return "founder"
    return "general"

def call_anthropic(messages, system, api_key, max_tokens=1500, tools=None, timeout=30):
    body={"model":"claude-sonnet-4-20250514","max_tokens":max_tokens,"system":system,"messages":messages}
    if tools: body["tools"]=tools
    req=urllib.request.Request("https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode(),
        headers={"Content-Type":"application/json","x-api-key":api_key,"anthropic-version":"2023-06-01"})
    with urllib.request.urlopen(req,timeout=timeout) as r: return json.loads(r.read())

def extract_text(data):
    return " ".join(b.get("text","") for b in data.get("content",[]) if b.get("type")=="text").strip()

def parse_json(text):
    text=re.sub(r"```json\n?","",text).replace("```","").strip()
    m=re.search(r"\{.*\}",text,re.DOTALL)
    return json.loads(m.group(0)) if m else {}

# ── ORCHESTRATION ──────────────────────────────────────────────────────────────
ORCHESTRATE_SYS = """You are Morgan Cole, VP of Marketing at Catskill Partners.
Plan a custom investor deck. Return ONLY valid JSON:
{
  "slide_selection": ["cover","toc","firm_overview",...],
  "appendix_selection": ["a_fund_econ","a_team",...],
  "image_requests": [
    {
      "title": "Operator PE Generates Higher Returns Than Financial Buyers",
      "subtitle": "Source attribution will appear here",
      "search_query": "operator private equity IRR returns chart McKinsey BCG site:mckinsey.com OR site:bcg.com OR site:bain.com",
      "fallback_query": "private equity returns operator versus financial buyers chart graph 2023 2024"
    }
  ],
  "deck_rationale": "Why this selection fits the request"
}

MAIN SLIDES: cover, disclaimer, toc, firm_overview, deal_process, strategy,
sector_focus, market_data, pipeline, deal_flow, underwriting, playbook,
value_creation, why_now, closing, legal_structure, is_economics, fund_economics,
team, deal_summary

APPENDIX SLIDES: a_legal, a_is_econ, a_fund_econ, a_team, a_pipeline,
a_deal_summary, a_sector_adv (Advanced Manufacturing), a_sector_eng (Engineered
Materials), a_sector_prec (Precision Components)

For image_requests: 0-3 requests max. Search for REAL chart images from:
McKinsey, BCG, Bain, CBRE, JLL, Deloitte, PitchBook, ACG, PwC, IBISWorld.
Use targeted searches with site: operators to find published research charts."""

def orchestrate(topic,audience,brief,task_type,incl_app,incl_img,api_key):
    key=get_audience_key(audience)
    if task_type=="lp_update": key="lp"
    elif task_type=="ib_teaser": key="ib"
    prompt=f"""Build custom Catskill Partners deck:
Topic: {topic}
Audience: {audience}
Brief: {brief or "Standard overview"}
Task: {task_type}, Audience profile: {key}
Include appendix: {incl_app}, Include market images: {incl_img}

{"Select 2-3 image_requests for real research charts from public sources." if incl_img else "Set image_requests to []."}
{"Include 3-5 relevant appendix slides." if incl_app else "Set appendix_selection to []."}"""
    try:
        d=call_anthropic([{"role":"user","content":prompt}],ORCHESTRATE_SYS,api_key,max_tokens=1000,timeout=20)
        r=parse_json(extract_text(d))
        if not r.get("slide_selection"):
            r["slide_selection"]=DEFAULT_SELECTIONS.get(key,DEFAULT_SELECTIONS["general"])
        return r
    except:
        return {"slide_selection":DEFAULT_SELECTIONS.get(key,DEFAULT_SELECTIONS["general"]),
                "appendix_selection":["a_fund_econ","a_team"] if incl_app else [],
                "image_requests":[]}

# ── REAL IMAGE FETCHING ────────────────────────────────────────────────────────
IMAGE_SEARCH_SYS = """You are a research analyst finding real chart images for an investor presentation.
Use web_search to find actual published charts/graphs from research reports.
Find a direct image URL (ending in .png, .jpg, .jpeg, .gif, .webp) OR a page URL
where a relevant chart is displayed.

Return ONLY valid JSON:
{
  "image_url": "https://example.com/path/to/chart.png",
  "page_url": "https://example.com/article-with-chart",  
  "source_name": "McKinsey Global Institute",
  "source_date": "2023",
  "chart_description": "What this chart shows",
  "title_override": "Suggested slide title based on actual data found"
}

CRITICAL: Only return URLs you actually found in search results. Do NOT fabricate URLs."""

def fetch_real_image(img_req, api_key):
    """Search for a real chart image from the web and fetch its bytes."""
    query = img_req.get("search_query","operator PE returns chart site:mckinsey.com")
    fallback = img_req.get("fallback_query","private equity operator returns chart 2023")
    
    prompt = f"""Find a real published chart/graph image for an investor presentation slide.
    
Primary search: {query}
Fallback search: {fallback}
Slide context: {img_req.get("title","")}

Search for the primary query first. If you find relevant results with charts, get a direct image URL.
If no good results, try the fallback. 
Prioritize: McKinsey, BCG, Bain, CBRE, JLL, Deloitte, S&P Global, PitchBook, Preqin, Houlihan Lokey."""

    try:
        tools=[{"type":"web_search_20250305","name":"web_search"}]
        d=call_anthropic([{"role":"user","content":prompt}],IMAGE_SEARCH_SYS,api_key,
                          max_tokens=600,tools=tools,timeout=25)
        result=parse_json(extract_text(d))
        
        # Try to fetch the actual image
        img_url = result.get("image_url","")
        page_url = result.get("page_url","")
        
        # First try direct image URL
        if img_url and re.search(r'\.(png|jpg|jpeg|gif|webp)(\?|$)',img_url,re.I):
            try:
                req=urllib.request.Request(img_url,headers={"User-Agent":"Mozilla/5.0 (compatible; CatskillPartners/1.0)"})
                with urllib.request.urlopen(req,timeout=10) as r:
                    img_bytes=r.read()
                    content_type=r.headers.get("Content-Type","image/png")
                    if len(img_bytes) > 5000:  # Must be a real image
                        ext="png" if "png" in content_type else "jpg"
                        return {
                            "bytes": img_bytes,
                            "ext": ext,
                            "source": result.get("source_name","Research Report"),
                            "date": result.get("source_date","2024"),
                            "desc": result.get("chart_description",""),
                            "title_override": result.get("title_override",""),
                        }
            except: pass
        
        # Try page URL - fetch the page and look for chart images
        if page_url:
            try:
                req=urllib.request.Request(page_url,headers={"User-Agent":"Mozilla/5.0"})
                with urllib.request.urlopen(req,timeout=8) as r:
                    page_html=r.read().decode("utf-8","ignore")
                # Find chart-like images on the page
                img_patterns=[
                    r'<img[^>]+src=["']([^"']+(?:chart|graph|figure|exhibit|display)[^"']*)["']',
                    r'<img[^>]+src=["']([^"']+\.(?:png|jpg|jpeg|webp))["']',
                ]
                for pat in img_patterns:
                    imgs=re.findall(pat,page_html,re.I)
                    for img in imgs[:5]:
                        if not img.startswith("http"):
                            from urllib.parse import urljoin
                            img=urljoin(page_url,img)
                        try:
                            req2=urllib.request.Request(img,headers={"User-Agent":"Mozilla/5.0"})
                            with urllib.request.urlopen(req2,timeout=8) as r2:
                                img_bytes=r2.read()
                                if len(img_bytes)>10000:
                                    return {
                                        "bytes":img_bytes,"ext":"png",
                                        "source":result.get("source_name","Research"),
                                        "date":result.get("source_date","2024"),
                                        "desc":result.get("chart_description",""),
                                        "title_override":result.get("title_override",""),
                                    }
                        except: continue
            except: pass
        
        return None  # Couldn't get a real image
    except:
        return None

# ── SLIDE XML BUILDER ──────────────────────────────────────────────────────────
def make_image_slide_xml(title,source_line,img_rId):
    xml=f"""<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="1A4C3D"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="190500"/><a:ext cx="8229600" cy="600075"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2000" b="1" dirty="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="+mj-lt"/></a:rPr><a:t>{title[:80]}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="3" name="ChartImage"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="{img_rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="457200" y="857250"/><a:ext cx="8229600" cy="5029200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Source"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="6096000"/><a:ext cx="8229600" cy="228600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="900" dirty="0"><a:solidFill><a:srgbClr val="6BAE7F"/></a:solidFill><a:latin typeface="+mn-lt"/></a:rPr><a:t>{source_line[:140]}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClr/></p:clrMapOvr>
</p:sld>"""
    return xml.encode("utf-8")

# ── ZIP SUBSET ─────────────────────────────────────────────────────────────────
def subset_deck(src_path,slide_indices):
    NS_P="http://schemas.openxmlformats.org/presentationml/2006/main"
    NS_R="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    with zipfile.ZipFile(src_path,"r") as zin:
        prs_rels_xml=zin.read("ppt/_rels/presentation.xml.rels")
        prs_rels_tree=etree.fromstring(prs_rels_xml)
        all_slides=[]
        for rel in prs_rels_tree:
            rt=rel.get("Type",""); tgt=rel.get("Target","")
            if rt.endswith("/slide") and re.match(r"slides/slide\d+\.xml$",tgt):
                m=re.search(r"slide(\d+)\.xml$",tgt)
                if m: all_slides.append((int(m.group(1)),rel.get("Id"),tgt))
        all_slides.sort(key=lambda x:x[0])
        if not all_slides: raise ValueError("No slides found")
        slide_map={i:{"num":num,"rId":rid,"target":tgt} for i,(num,rid,tgt) in enumerate(all_slides)}
        max_idx=len(slide_map)-1
        seen_i=set(); valid=[]
        for i in slide_indices:
            if 0<=i<=max_idx and i not in seen_i: seen_i.add(i); valid.append(i)
        kept_rids={slide_map[i]["rId"] for i in valid}
        kept_nums={slide_map[i]["num"] for i in valid}
        unwanted={info["num"] for info in slide_map.values()}-kept_nums
        prs_xml=zin.read("ppt/presentation.xml"); prs_tree=etree.fromstring(prs_xml)
        sldIdLst=prs_tree.find(f"{{{NS_P}}}sldIdLst")
        if sldIdLst is not None:
            for s in list(sldIdLst):
                if s.get(f"{{{NS_R}}}id") not in kept_rids: sldIdLst.remove(s)
        for rel in list(prs_rels_tree):
            rt=rel.get("Type",""); tgt=rel.get("Target","")
            if rt.endswith("/slide") and re.match(r"slides/slide\d+\.xml$",tgt):
                if rel.get("Id") not in kept_rids: prs_rels_tree.remove(rel)
        def skip(fn):
            for n in unwanted:
                if fn in(f"ppt/slides/slide{n}.xml",f"ppt/slides/_rels/slide{n}.xml.rels",
                         f"ppt/notesSlides/notesSlide{n}.xml",f"ppt/notesSlides/_rels/notesSlide{n}.xml.rels"): return True
            return False
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as zout:
            seen_files=set()
            for item in zin.infolist():
                fn=item.filename
                if fn in seen_files: continue
                seen_files.add(fn)
                if skip(fn): continue
                if fn=="ppt/presentation.xml":
                    data=etree.tostring(prs_tree,xml_declaration=True,encoding="UTF-8",standalone=True)
                elif fn=="ppt/_rels/presentation.xml.rels":
                    data=etree.tostring(prs_rels_tree,xml_declaration=True,encoding="UTF-8",standalone=True)
                else: data=zin.read(fn)
                zout.writestr(item,data)
        buf.seek(0); return buf.read()

# ── INJECT REAL IMAGE SLIDES ───────────────────────────────────────────────────
def inject_image_slides(pptx_bytes,image_slides):
    NS_P="http://schemas.openxmlformats.org/presentationml/2006/main"
    NS_R="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    CT_NS="http://schemas.openxmlformats.org/package/2006/content-types"
    with zipfile.ZipFile(io.BytesIO(pptx_bytes),"r") as zin:
        existing_s=[int(re.search(r"slide(\d+)\.xml$",f).group(1)) for f in zin.namelist() if re.match(r"ppt/slides/slide\d+\.xml$",f)]
        max_s=max(existing_s) if existing_s else 0
        existing_i=[int(re.search(r"image(\d+)\.",f).group(1)) for f in zin.namelist() if re.match(r"ppt/media/image\d+\.",f)]
        max_i=max(existing_i) if existing_i else 0
        layout_tgt="../slideLayouts/slideLayout1.xml"
        for name in zin.namelist():
            if re.match(r"ppt/slides/_rels/slide\d+\.xml\.rels$",name):
                try:
                    rels=etree.fromstring(zin.read(name))
                    for rel in rels:
                        if "slideLayout" in rel.get("Type","") and rel.get("Target",""):
                            layout_tgt=rel.get("Target"); break
                except: pass
                break
        prs_xml=zin.read("ppt/presentation.xml"); prs_tree=etree.fromstring(prs_xml)
        prs_rels_xml=zin.read("ppt/_rels/presentation.xml.rels"); prs_rels_tree=etree.fromstring(prs_rels_xml)
        sldIdLst=prs_tree.find(f"{{{NS_P}}}sldIdLst")
        max_id=max((int(e.get("id",0)) for e in sldIdLst),default=256) if sldIdLst is not None else 256
        max_rid=max((int(re.search(r"rId(\d+)",r.get("Id","")).group(1)) for r in prs_rels_tree if re.search(r"rId(\d+)",r.get("Id",""))),default=0)
        ct_xml=zin.read("[Content_Types].xml"); ct_tree=etree.fromstring(ct_xml)
        new_files={}
        for i,cs in enumerate(image_slides):
            sn=max_s+1+i; img_n=max_i+1+i
            ext=cs.get("ext","png"); sr=f"rId{max_rid+1+i}"
            sp=f"ppt/slides/slide{sn}.xml"; srp=f"ppt/slides/_rels/slide{sn}.xml.rels"
            ip=f"ppt/media/image{img_n}.{ext}"; it=f"../media/image{img_n}.{ext}"
            source_line=f"Source: {cs.get('source','Research Report')} {cs.get('date','2024')}  |  CATSKILL PARTNERS  ·  CLARITY. CRAFT. CAPITAL."
            new_files[ip]=cs["bytes"]
            new_files[sp]=make_image_slide_xml(cs["title"],source_line,"rId2")
            new_files[srp]=f"""<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="{layout_tgt}"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{it}"/>
</Relationships>""".encode("utf-8")
            if sldIdLst is not None:
                ns=etree.SubElement(sldIdLst,f"{{{NS_P}}}sldId")
                ns.set("id",str(max_id+1+i)); ns.set(f"{{{NS_R}}}id",sr)
            nr=etree.SubElement(prs_rels_tree,"Relationship")
            nr.set("Id",sr)
            nr.set("Type","http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide")
            nr.set("Target",f"slides/slide{sn}.xml")
            pn=f"/ppt/slides/slide{sn}.xml"
            if not any(e.get("PartName")==pn for e in ct_tree):
                nc=etree.SubElement(ct_tree,f"{{{CT_NS}}}Override")
                nc.set("PartName",pn)
                nc.set("ContentType","application/vnd.openxmlformats-officedocument.presentationml.slide+xml")
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as zout:
            seen_f=set()
            for item in zin.infolist():
                fn=item.filename
                if fn in seen_f: continue
                seen_f.add(fn)
                if fn=="ppt/presentation.xml":
                    data=etree.tostring(prs_tree,xml_declaration=True,encoding="UTF-8",standalone=True)
                elif fn=="ppt/_rels/presentation.xml.rels":
                    data=etree.tostring(prs_rels_tree,xml_declaration=True,encoding="UTF-8",standalone=True)
                elif fn=="[Content_Types].xml":
                    data=etree.tostring(ct_tree,xml_declaration=True,encoding="UTF-8",standalone=True)
                else: data=zin.read(fn)
                zout.writestr(item,data)
            for path,data in new_files.items(): zout.writestr(path,data)
        buf.seek(0); return buf.read()

# ── MAIN BUILD ─────────────────────────────────────────────────────────────────
def build_deck(topic,audience,brief,tone,task_type,incl_app,incl_img,api_key):
    main_path=os.path.join(_DIR,"main_deck.pptx")
    if not os.path.exists(main_path): raise FileNotFoundError("main_deck.pptx not found")
    
    plan=orchestrate(topic,audience,brief,task_type,incl_app,incl_img,api_key)
    
    # Resolve main slide names → indices
    main_indices=[]
    for name in plan.get("slide_selection",DEFAULT_SELECTIONS.get(get_audience_key(audience),DEFAULT_SELECTIONS["general"])):
        idx=MAIN_SLIDES.get(name)
        if idx is not None: main_indices.append(idx)
    if not main_indices:
        main_indices=list(DEFAULT_SELECTIONS["general"])
    
    # Appendix slides
    appendix_names=plan.get("appendix_selection",[])
    if incl_app and appendix_names:
        # Use appendix_deck.pptx if available, else fallback to main
        app_path=os.path.join(_DIR,"appendix_deck.pptx")
        app_src=app_path if os.path.exists(app_path) else main_path
        extra=[]
        for name in appendix_names:
            idx=APPENDIX_MAP.get(name)
            if idx is not None and idx not in main_indices:
                extra.append(idx)
        if extra:
            closing_pos=next((i for i,v in enumerate(main_indices) if v==14),len(main_indices))
            all_indices=main_indices[:closing_pos]+extra+main_indices[closing_pos:]
            main_indices=all_indices
    
    pptx_bytes=subset_deck(main_path,main_indices)
    
    # Real internet image slides
    image_slides=[]
    if incl_img:
        for img_req in plan.get("image_requests",[])[:3]:
            result=fetch_real_image(img_req,api_key)
            if result and result.get("bytes"):
                title=result.get("title_override","") or img_req.get("title","Market Data")
                image_slides.append({
                    "title":title,
                    "bytes":result["bytes"],
                    "ext":result.get("ext","png"),
                    "source":result.get("source","Public Research"),
                    "date":result.get("date","2024"),
                    "desc":result.get("desc",""),
                })
    
    if image_slides:
        pptx_bytes=inject_image_slides(pptx_bytes,image_slides)
    
    return pptx_bytes, len(image_slides), plan.get("deck_rationale","Custom deck assembled")

class handler(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_OPTIONS(self): self.send_response(200); self._cors(); self.end_headers()
    def do_POST(self):
        try:
            length=int(self.headers.get("Content-Length",0))
            body=json.loads(self.rfile.read(length)) if length else {}
            api_key=os.environ.get("ANTHROPIC_API_KEY","")
            if not api_key: return self._err(500,"API key not configured")
            pptx_bytes,img_count,rationale=build_deck(
                body.get("topic","Catskill Partners Overview"),
                body.get("audience","LP / Institutional Investor"),
                body.get("brief",""),body.get("tone","Institutional"),
                body.get("taskType","full_deck"),
                body.get("includeAppendix",False),
                body.get("includeMarketCharts",False),
                api_key)
            with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as z:
                pr=etree.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
                sc=sum(1 for r in pr if r.get("Type","").endswith("/slide") and re.match(r"slides/slide\d+\.xml$",r.get("Target","")))
            slug=re.sub(r"[^a-zA-Z0-9]","-",body.get("topic","deck"))[:40]
            resp=json.dumps({"success":True,"filename":f"Catskill-{slug}.pptx",
                "base64":base64.b64encode(pptx_bytes).decode(),"slideCount":sc,
                "imageSlides":img_count,"title":body.get("topic",""),"rationale":rationale}).encode()
            self.send_response(200); self._cors()
            self.send_header("Content-Type","application/json")
            self.send_header("Content-Length",str(len(resp)))
            self.end_headers(); self.wfile.write(resp)
        except Exception as e:
            import traceback; self._err(500,str(e),traceback.format_exc()[:800])
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
    def _err(self,code,msg,detail=""):
        r=json.dumps({"error":msg,"detail":detail}).encode()
        self.send_response(code); self._cors()
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(r)))
        self.end_headers(); self.wfile.write(r)
