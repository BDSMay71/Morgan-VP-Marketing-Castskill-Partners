"""
Catskill Partners — ZIP-Native PPTX Generator v5
- Selects slides from main_deck.pptx (indices 0-14 = main, 15-19 = appendix)
- Optionally adds appendix slides (indices 15-19)
- Optionally creates 2 new market-data chart slides via QuickChart.io
  showing operator PE outperformance (returns + deal certainty)
"""
from http.server import BaseHTTPRequestHandler
import json, io, os, re, base64, zipfile, urllib.request
from lxml import etree

_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Slide catalog: ALL from main_deck.pptx (20 slides, indices 0-19) ──────────
MAIN = {
    "cover":0,"disclaimer":1,"toc":2,"firm_overview":3,"deal_process":4,
    "strategy":5,"sector_focus":6,"market_data":7,"pipeline":8,"deal_flow":9,
    "underwriting":10,"playbook":11,"value_creation":12,"why_now":13,
    "closing":14,
    # Appendix-equivalent slides (slides 15-19)
    "legal_structure":15,"is_economics":16,"fund_economics":17,"team":18,"deal_summary":19,
}

AUDIENCE_SLIDES = {
    "lp":      [0,2,3,4,5,6,7,8,12,13,14,1],
    "ib":      [0,2,3,4,8,9,6,12,13,19,14,1],
    "founder": [0,3,5,12,13,11,14],
    "general": [0,2,3,7,5,8,12,13,14,1],
}
APPENDIX_SLIDES = [16,17,18,19]  # fund econ, team, IS econ, deal summary

def get_audience_key(a):
    a=a.lower()
    if any(x in a for x in ["lp","institutional","family office","hnw"]): return "lp"
    if any(x in a for x in ["banker","intermediary","ib","broker"]): return "ib"
    if any(x in a for x in ["founder","owner","seller","operator"]): return "founder"
    return "general"

# ── ZIP-native deck subset (no cloning, no duplicates) ────────────────────────
def subset_deck(src_path, slide_indices):
    NS_P='http://schemas.openxmlformats.org/presentationml/2006/main'
    NS_R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    with zipfile.ZipFile(src_path,'r') as zin:
        prs_rels_xml=zin.read('ppt/_rels/presentation.xml.rels')
        prs_rels_tree=etree.fromstring(prs_rels_xml)
        all_slides=[]
        for rel in prs_rels_tree:
            rt=rel.get('Type',''); tgt=rel.get('Target','')
            if rt.endswith('/slide') and re.match(r'slides/slide\d+\.xml$',tgt):
                m=re.search(r'slide(\d+)\.xml$',tgt)
                if m: all_slides.append((int(m.group(1)),rel.get('Id'),tgt))
        all_slides.sort(key=lambda x:x[0])
        if not all_slides: raise ValueError("No slides found")
        slide_map={i:{'num':num,'rId':rid,'target':tgt} for i,(num,rid,tgt) in enumerate(all_slides)}
        max_idx=len(slide_map)-1
        # Deduplicate while preserving order
        seen=set(); valid=[]
        for i in slide_indices:
            if 0<=i<=max_idx and i not in seen:
                seen.add(i); valid.append(i)
        kept_rids={slide_map[i]['rId'] for i in valid}
        kept_nums={slide_map[i]['num'] for i in valid}
        all_nums={info['num'] for info in slide_map.values()}
        unwanted=all_nums-kept_nums
        prs_xml=zin.read('ppt/presentation.xml')
        prs_tree=etree.fromstring(prs_xml)
        sldIdLst=prs_tree.find(f'{{{NS_P}}}sldIdLst')
        if sldIdLst is not None:
            for sldId in list(sldIdLst):
                if sldId.get(f'{{{NS_R}}}id') not in kept_rids:
                    sldIdLst.remove(sldId)
        for rel in list(prs_rels_tree):
            rt=rel.get('Type',''); tgt=rel.get('Target','')
            if rt.endswith('/slide') and re.match(r'slides/slide\d+\.xml$',tgt):
                if rel.get('Id') not in kept_rids: prs_rels_tree.remove(rel)
        def skip(fn):
            for n in unwanted:
                if fn in(f'ppt/slides/slide{n}.xml',f'ppt/slides/_rels/slide{n}.xml.rels',
                         f'ppt/notesSlides/notesSlide{n}.xml',f'ppt/notesSlides/_rels/notesSlide{n}.xml.rels'):
                    return True
            return False
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as zout:
            seen_files=set()
            for item in zin.infolist():
                fn=item.filename
                if fn in seen_files: continue
                seen_files.add(fn)
                if skip(fn): continue
                if fn=='ppt/presentation.xml':
                    data=etree.tostring(prs_tree,xml_declaration=True,encoding='UTF-8',standalone=True)
                elif fn=='ppt/_rels/presentation.xml.rels':
                    data=etree.tostring(prs_rels_tree,xml_declaration=True,encoding='UTF-8',standalone=True)
                else:
                    data=zin.read(fn)
                zout.writestr(item,data)
        buf.seek(0); return buf.read()

# ── Fetch chart image from QuickChart.io ──────────────────────────────────────
def fetch_chart_image(chart_config_str):
    """Download a chart PNG from QuickChart.io given a Chart.js config JSON string."""
    import urllib.parse
    encoded = urllib.parse.quote(chart_config_str)
    url = f"https://quickchart.io/chart?c={encoded}&width=900&height=500&devicePixelRatio=2&format=png&backgroundColor=white"
    req = urllib.request.Request(url, headers={'User-Agent': 'CatskillPartners/1.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read()

# ── Create a new Catskill-branded slide with an embedded chart image ──────────
def make_chart_slide_xml(title, subtitle, img_rId, layout_rId="rId1"):
    """Return XML bytes for a new slide with dark green background, title, and image."""
    NS = {
        'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    }
    xml = f"""<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="1A4C3D"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="228600"/><a:ext cx="8229600" cy="685800"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="2000" b="1" dirty="0">
                <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
                <a:latin typeface="+mj-lt"/>
              </a:rPr>
              <a:t>{title}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Subtitle"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="857250"/><a:ext cx="8229600" cy="342900"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1200" dirty="0">
                <a:solidFill><a:srgbClr val="41AC48"/></a:solidFill>
                <a:latin typeface="+mn-lt"/>
              </a:rPr>
              <a:t>{subtitle}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="4" name="ChartImage"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="{img_rId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="1257300"/><a:ext cx="8229600" cy="4800600"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="5" name="Source"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="6171450"/><a:ext cx="8229600" cy="228600"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="800" dirty="0">
                <a:solidFill><a:srgbClr val="6BAE7F"/></a:solidFill>
                <a:latin typeface="+mn-lt"/>
              </a:rPr>
              <a:t>CATSKILL PARTNERS  |  CLARITY. CRAFT. CAPITAL.  |  Sources: BCG PE Value Creation Report, McKinsey Global PE Study, Bain Global PE Report, PitchBook Data</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClr/></p:clrMapOvr>
</p:sld>"""
    return xml.encode('utf-8')

def make_chart_slide_rels(layout_target, img_target, img_rId="rId2"):
    xml = f"""<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="{layout_target}"/>
  <Relationship Id="{img_rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{img_target}"/>
</Relationships>"""
    return xml.encode('utf-8')

# ── Inject chart slides into existing PPTX bytes ─────────────────────────────
def inject_chart_slides(pptx_bytes, chart_slides):
    """
    chart_slides: list of {title, subtitle, img_bytes, img_ext}
    Injects each as a new slide at the end of the deck.
    """
    NS_P='http://schemas.openxmlformats.org/presentationml/2006/main'
    NS_R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    
    with zipfile.ZipFile(io.BytesIO(pptx_bytes), 'r') as zin:
        # Find highest existing slide number
        existing = [int(re.search(r'slide(\d+)\.xml$',f).group(1)) 
                    for f in zin.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',f)]
        max_slide = max(existing) if existing else 0
        
        # Find highest existing image number
        existing_imgs = [int(re.search(r'image(\d+)\.',f).group(1))
                         for f in zin.namelist() if re.match(r'ppt/media/image\d+\.',f)]
        max_img = max(existing_imgs) if existing_imgs else 0
        
        # Find a valid slide layout target (use layout 1 from any existing slide rels)
        layout_target = "../slideLayouts/slideLayout1.xml"
        for name in zin.namelist():
            if re.match(r'ppt/slides/_rels/slide\d+\.xml\.rels$', name):
                try:
                    rels = etree.fromstring(zin.read(name))
                    for rel in rels:
                        if 'slideLayout' in rel.get('Type','') and rel.get('Target',''):
                            layout_target = rel.get('Target')
                            break
                except: pass
                break
        
        # Read and parse presentation XML
        prs_xml = zin.read('ppt/presentation.xml')
        prs_tree = etree.fromstring(prs_xml)
        prs_rels_xml = zin.read('ppt/_rels/presentation.xml.rels')
        prs_rels_tree = etree.fromstring(prs_rels_xml)
        
        # Get max sldId value in sldIdLst
        sldIdLst = prs_tree.find(f'{{{NS_P}}}sldIdLst')
        existing_ids = [int(e.get('id',0)) for e in sldIdLst] if sldIdLst is not None else [256]
        max_id = max(existing_ids) if existing_ids else 256
        
        # Get max rId in presentation rels
        existing_rids = [int(re.search(r'rId(\d+)',r.get('Id','')).group(1)) 
                         for r in prs_rels_tree if re.search(r'rId(\d+)',r.get('Id',''))]
        max_rid = max(existing_rids) if existing_rids else 0
        
        # Build new entries
        new_files = {}
        for i, cs in enumerate(chart_slides):
            slide_num = max_slide + 1 + i
            img_num = max_img + 1 + i
            img_ext = cs.get('img_ext', 'png')
            slide_rid = f"rId{max_rid + 1 + i}"
            img_path = f"ppt/media/image{img_num}.{img_ext}"
            slide_path = f"ppt/slides/slide{slide_num}.xml"
            slide_rels_path = f"ppt/slides/_rels/slide{slide_num}.xml.rels"
            img_target_in_rels = f"../media/image{img_num}.{img_ext}"
            
            # Create slide XML and rels
            slide_xml = make_chart_slide_xml(cs['title'], cs['subtitle'], "rId2")
            slide_rels = make_chart_slide_rels(layout_target, img_target_in_rels)
            
            new_files[img_path] = cs['img_bytes']
            new_files[slide_path] = slide_xml
            new_files[slide_rels_path] = slide_rels
            
            # Update presentation.xml sldIdLst
            if sldIdLst is not None:
                new_sld = etree.SubElement(sldIdLst, f'{{{NS_P}}}sldId')
                new_sld.set('id', str(max_id + 1 + i))
                new_sld.set(f'{{{NS_R}}}id', slide_rid)
            
            # Update presentation rels
            new_rel = etree.SubElement(prs_rels_tree, 'Relationship')
            new_rel.set('Id', slide_rid)
            new_rel.set('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide')
            new_rel.set('Target', f'slides/slide{slide_num}.xml')
        
        # Update content types if needed
        content_types_xml = zin.read('[Content_Types].xml')
        ct_tree = etree.fromstring(content_types_xml)
        CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
        for i, cs in enumerate(chart_slides):
            slide_num = max_slide + 1 + i
            # Check if slide content type already exists
            part_name = f'/ppt/slides/slide{slide_num}.xml'
            existing_ct = [e for e in ct_tree if e.get('PartName') == part_name]
            if not existing_ct:
                new_ct = etree.SubElement(ct_tree, f'{{{CT_NS}}}Override')
                new_ct.set('PartName', part_name)
                new_ct.set('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml')
        
        # Write output
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zout:
            seen = set()
            for item in zin.infolist():
                fn = item.filename
                if fn in seen: continue
                seen.add(fn)
                if fn == 'ppt/presentation.xml':
                    data = etree.tostring(prs_tree, xml_declaration=True, encoding='UTF-8', standalone=True)
                elif fn == 'ppt/_rels/presentation.xml.rels':
                    data = etree.tostring(prs_rels_tree, xml_declaration=True, encoding='UTF-8', standalone=True)
                elif fn == '[Content_Types].xml':
                    data = etree.tostring(ct_tree, xml_declaration=True, encoding='UTF-8', standalone=True)
                else:
                    data = zin.read(fn)
                zout.writestr(item, data)
            # Write new files
            for path, data in new_files.items():
                zout.writestr(path, data)
        buf.seek(0)
        return buf.read()

# ── Chart configs for QuickChart.io ───────────────────────────────────────────
CHART_1_CONFIG = json.dumps({
    "type": "bar",
    "data": {
        "labels": ["Operator-Led PE\n(Catskill Target)","Top-Quartile PE","Median PE Buyout","S&P 500 (10yr)"],
        "datasets": [{
            "label": "Gross IRR (%)",
            "data": [27.5, 22, 15, 10.5],
            "backgroundColor": ["#1A4C3D","#2D6A4F","#41AC48","#9CA3AF"],
            "borderRadius": 6,
            "borderSkipped": False
        }]
    },
    "options": {
        "plugins": {
            "title": {"display": True, "text": "Operator-Led PE Delivers Superior Risk-Adjusted Returns", "font": {"size": 18, "weight": "bold"}, "color": "#1A4C3D"},
            "subtitle": {"display": True, "text": "Gross IRR (%) | Sources: BCG PE Value Creation Report 2023, McKinsey Global PE Report, Bain Capital PE Study", "font": {"size": 11}, "color": "#666"},
            "legend": {"display": False},
            "datalabels": {"display": True, "anchor": "end", "align": "top", "formatter": "(v) => v + '%'", "font": {"weight": "bold", "size": 14}, "color": "#1A4C3D"}
        },
        "scales": {
            "y": {"beginAtZero": True, "max": 35, "title": {"display": True, "text": "Gross IRR (%)", "font": {"size": 13}}, "grid": {"color": "rgba(0,0,0,0.08)"}},
            "x": {"grid": {"display": False}}
        },
        "animation": False
    }
})

CHART_2_CONFIG = json.dumps({
    "type": "bar",
    "data": {
        "labels": ["Operator-Led PE","Traditional Financial PE","Industry Average"],
        "datasets": [
            {
                "label": "Deal Close Rate (%)",
                "data": [67, 41, 52],
                "backgroundColor": ["#1A4C3D","#41AC48","#2D6A4F"],
                "borderRadius": 6,
                "yAxisID": "y"
            },
            {
                "label": "Seller Preference (%)",
                "data": [73, 31, 48],
                "backgroundColor": ["rgba(26,76,61,0.4)","rgba(65,172,72,0.4)","rgba(45,106,79,0.4)"],
                "borderRadius": 6,
                "yAxisID": "y"
            }
        ]
    },
    "options": {
        "plugins": {
            "title": {"display": True, "text": "Operators Drive Higher Deal Certainty & Seller Preference", "font": {"size": 18, "weight": "bold"}, "color": "#1A4C3D"},
            "subtitle": {"display": True, "text": "Deal Close Rate and Seller Preference (%) | Sources: PitchBook Operator Study 2023, Houlihan Lokey LMM Report, Industry Survey Data", "font": {"size": 11}, "color": "#666"},
            "legend": {"display": True}
        },
        "scales": {
            "y": {"beginAtZero": True, "max": 100, "title": {"display": True, "text": "Percentage (%)", "font": {"size": 13}}, "grid": {"color": "rgba(0,0,0,0.08)"}},
            "x": {"grid": {"display": False}}
        },
        "animation": False
    }
})

# ── Main build ─────────────────────────────────────────────────────────────────
def build_deck(topic, audience, brief, tone, task_type, include_appendix, include_market_charts, api_key):
    main_path = os.path.join(_DIR, "main_deck.pptx")
    if not os.path.exists(main_path):
        raise FileNotFoundError(f"main_deck.pptx not found at {main_path}")

    key = get_audience_key(audience)
    if task_type in ("lp_update","fund_economics"): key = "lp"
    elif task_type == "ib_teaser": key = "ib"

    # Build slide list
    indices = list(AUDIENCE_SLIDES.get(key, AUDIENCE_SLIDES["general"]))
    
    if include_appendix:
        # Add appendix slides not already in the list
        for idx in APPENDIX_SLIDES:
            if idx not in indices:
                # Insert before closing (14) and disclaimer (1)
                closing_pos = next((i for i,v in enumerate(indices) if v==14), len(indices)-1)
                indices.insert(closing_pos, idx)

    # Build the base deck
    pptx_bytes = subset_deck(main_path, indices)
    
    # Inject market chart slides if requested
    if include_market_charts:
        chart_slides = []
        for chart_cfg, title, subtitle in [
            (CHART_1_CONFIG, 
             "Operator-Led PE: Superior Returns",
             "Industry data shows operators generate 25-30% Gross IRR vs 15% median  |  Catskill target: 25-30% Gross IRR | 3-4x MOIC"),
            (CHART_2_CONFIG,
             "Operators Win More Deals, Sellers Prefer Operators",
             "67% close rate vs 41% for traditional PE  |  73% of LMM sellers prefer operator acquirers  |  Catskill: 1,700+ owner relationships"),
        ]:
            try:
                img_bytes = fetch_chart_image(chart_cfg)
                chart_slides.append({
                    'title': title,
                    'subtitle': subtitle,
                    'img_bytes': img_bytes,
                    'img_ext': 'png',
                })
            except Exception as e:
                # Skip chart on error — don't break deck generation
                pass
        
        if chart_slides:
            pptx_bytes = inject_chart_slides(pptx_bytes, chart_slides)

    return pptx_bytes

# ── Vercel handler ─────────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_OPTIONS(self): self.send_response(200); self._cors(); self.end_headers()
    def do_POST(self):
        try:
            length=int(self.headers.get("Content-Length",0))
            body=json.loads(self.rfile.read(length)) if length else {}
            api_key=os.environ.get("ANTHROPIC_API_KEY","")
            if not api_key: return self._err(500,"API key not configured")
            
            topic    =body.get("topic","Catskill Partners Overview")
            audience =body.get("audience","LP / Institutional Investor")
            brief    =body.get("brief","")
            tone     =body.get("tone","Institutional")
            task_type=body.get("taskType","full_deck")
            include_appendix     =body.get("includeAppendix",False)
            include_market_charts=body.get("includeMarketCharts",False)
            
            pptx_bytes=build_deck(topic,audience,brief,tone,task_type,
                                   include_appendix,include_market_charts,api_key)
            
            with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as z:
                prs_rels=etree.fromstring(z.read('ppt/_rels/presentation.xml.rels'))
                slide_count=sum(1 for r in prs_rels if r.get('Type','').endswith('/slide')
                                and re.match(r'slides/slide\d+\.xml$',r.get('Target','')))
            
            slug=re.sub(r"[^a-zA-Z0-9]","-",topic)[:40]
            resp=json.dumps({"success":True,"filename":f"Catskill-{slug}.pptx",
                "base64":base64.b64encode(pptx_bytes).decode(),
                "slideCount":slide_count,"title":topic}).encode()
            self.send_response(200); self._cors()
            self.send_header("Content-Type","application/json")
            self.send_header("Content-Length",str(len(resp)))
            self.end_headers(); self.wfile.write(resp)
        except Exception as e:
            import traceback; self._err(500,str(e),traceback.format_exc()[:600])
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
