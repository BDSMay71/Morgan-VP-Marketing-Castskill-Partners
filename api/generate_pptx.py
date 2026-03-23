"""
Catskill Partners — ZIP-Native PPTX Generator v4
Builds decks by subsetting the real Catskill PPTX at the ZIP level.
NO python-pptx slide cloning = NO duplicate entries = NO PowerPoint errors.
"""
from http.server import BaseHTTPRequestHandler
import json, io, os, re, base64, zipfile, urllib.request
from lxml import etree

_DIR = os.path.dirname(os.path.abspath(__file__))

SLIDES = {
    "cover":0,"disclaimer":1,"toc":2,"firm_overview":3,"deal_process":4,
    "strategy":5,"sector_focus":6,"market_data":7,"pipeline":8,"deal_flow":9,
    "underwriting":10,"playbook":11,"value_creation":12,"why_now":13,
    "closing":14,"legal_structure":15,"is_economics":16,"fund_economics":17,
    "team":18,"deal_summary":19,
}

AUDIENCE_SLIDES = {
    "lp":[0,2,3,4,5,6,7,8,12,13,17,18,14,1],
    "ib":[0,2,3,4,8,9,6,12,13,19,14,1],
    "founder":[0,3,5,12,13,11,14],
    "general":[0,2,3,7,5,8,12,13,17,14,1],
}

def get_audience_key(a):
    a=a.lower()
    if any(x in a for x in ["lp","institutional","family office","hnw"]): return "lp"
    if any(x in a for x in ["banker","intermediary","ib","broker"]): return "ib"
    if any(x in a for x in ["founder","owner","seller","operator"]): return "founder"
    return "general"

def build_deck_zip(src_path, slide_indices):
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
        valid=list(dict.fromkeys(i for i in slide_indices if 0<=i<=max_idx))
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
            seen=set()
            for item in zin.infolist():
                fn=item.filename
                if fn in seen: continue
                seen.add(fn)
                if skip(fn): continue
                if fn=='ppt/presentation.xml':
                    data=etree.tostring(prs_tree,xml_declaration=True,encoding='UTF-8',standalone=True)
                elif fn=='ppt/_rels/presentation.xml.rels':
                    data=etree.tostring(prs_rels_tree,xml_declaration=True,encoding='UTF-8',standalone=True)
                else:
                    data=zin.read(fn)
                zout.writestr(item,data)
        buf.seek(0); return buf.read()

def build_deck(topic,audience,brief,tone,task_type,api_key):
    main_path=os.path.join(_DIR,"main_deck.pptx")
    if not os.path.exists(main_path): raise FileNotFoundError(f"main_deck.pptx not found at {main_path}")
    key=get_audience_key(audience)
    if task_type in("lp_update","fund_economics"): key="lp"
    elif task_type=="ib_teaser": key="ib"
    elif task_type=="one_pager": return build_deck_zip(main_path,[0,3,7,13,14])
    return build_deck_zip(main_path,AUDIENCE_SLIDES.get(key,AUDIENCE_SLIDES["general"]))

class handler(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_OPTIONS(self): self.send_response(200); self._cors(); self.end_headers()
    def do_POST(self):
        try:
            length=int(self.headers.get("Content-Length",0))
            body=json.loads(self.rfile.read(length)) if length else {}
            api_key=os.environ.get("ANTHROPIC_API_KEY","")
            if not api_key: return self._err(500,"API key not configured")
            topic=body.get("topic","Catskill Partners Overview")
            audience=body.get("audience","LP / Institutional Investor")
            brief=body.get("brief","")
            tone=body.get("tone","Institutional")
            task_type=body.get("taskType","full_deck")
            pptx_bytes=build_deck(topic,audience,brief,tone,task_type,api_key)
            with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as z:
                prs_rels=etree.fromstring(z.read('ppt/_rels/presentation.xml.rels'))
                slide_count=sum(1 for r in prs_rels if r.get('Type','').endswith('/slide') and re.match(r'slides/slide\d+\.xml$',r.get('Target','')))
            slug=re.sub(r"[^a-zA-Z0-9]","-",topic)[:40]
            resp=json.dumps({"success":True,"filename":f"Catskill-{slug}.pptx","base64":base64.b64encode(pptx_bytes).decode(),"slideCount":slide_count,"title":topic}).encode()
            self.send_response(200); self._cors()
            self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(resp)))
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
        self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(r)))
        self.end_headers(); self.wfile.write(r)
