"""
Catskill Partners — Python Template-Based PPTX Generator
Builds presentations by selecting slides from the reference deck.
All design, photos, charts, and formatting preserved pixel-perfect.
"""
import json, io, os, re, base64, zipfile
from http.server import BaseHTTPRequestHandler
from lxml import etree
from copy import deepcopy

CATALOG = {
    'cover':0,'disclaimer':1,'toc':2,'overview':3,'sourcing_strat':4,
    'lifecycle':5,'sector_focus':6,'market_forces':7,'sourcing_db':8,
    'deal_flow':9,'underwriting':10,'playbook':11,'returns':12,
    'why_now':13,'closing':14,'is_structure':15,'is_economics':16,
    'fund_economics':17,'team':18,'platform':19,
}

PRESETS = {
    'lp': {
        'slides': ['cover','toc','overview','market_forces','why_now',
                   'underwriting','playbook','returns','fund_economics',
                   'is_economics','is_structure','team','closing','disclaimer'],
        'toc': ['Catskill Partners Overview','The Market Opportunity',
                'Why Now? Why Catskill Partners?','Underwriting Discipline',
                'Value Creation Playbook','Fund I Economics',
                'IS Model & Structure','Team & Roadmap'],
    },
    'family_office': {
        'slides': ['cover','toc','overview','market_forces','why_now',
                   'returns','fund_economics','is_economics','team','closing','disclaimer'],
        'toc': ['Catskill Partners Overview','The Market Opportunity',
                'Why Now? Why Catskill?','Returns Framework',
                'Fund I Economics','IS Model','Team & Roadmap'],
    },
    'investment_banker': {
        'slides': ['cover','toc','overview','sourcing_strat','market_forces',
                   'sourcing_db','deal_flow','playbook','why_now',
                   'platform','closing','disclaimer'],
        'toc': ['Catskill Partners Overview','Sourcing Strategy',
                'Market Opportunity','Sourcing Database','Deal Flow YTD 2026',
                'Value Creation Playbook','Why Now? Why Catskill?','Active Platform'],
    },
    'general': {
        'slides': ['cover','toc','overview','market_forces','sourcing_strat',
                   'deal_flow','underwriting','playbook','returns','why_now',
                   'closing','disclaimer'],
        'toc': ['Catskill Partners Overview','The Market Opportunity',
                'Sourcing Strategy','Deal Flow','Underwriting Discipline',
                'Value Creation Playbook','Returns Framework','Why Now?'],
    },
}

NS_P   = 'http://schemas.openxmlformats.org/presentationml/2006/main'
NS_R   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_A   = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
SLIDE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'


def build_pptx(template_bytes, slide_keys, audience_line=None, toc_items=None, topic=None):
    slide_indices = [CATALOG[k] for k in slide_keys if k in CATALOG]
    with zipfile.ZipFile(io.BytesIO(template_bytes), 'r') as zin:
        all_files = zin.namelist()
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zout:
            skip = lambda f: (re.match(r'ppt/slides/slide\d+\.xml$', f) or
                              re.match(r'ppt/slides/_rels/slide\d+\.xml\.rels$', f) or
                              f in ('ppt/_rels/presentation.xml.rels','ppt/presentation.xml'))
            for fname in all_files:
                if not skip(fname):
                    zout.writestr(fname, zin.read(fname))
            prs_rels_tree = etree.fromstring(zin.read('ppt/_rels/presentation.xml.rels'))
            for rel in list(prs_rels_tree):
                if rel.get('Type','').endswith('/slide'):
                    prs_rels_tree.remove(rel)
            nums = [int(re.search(r'\d+',r.get('Id','rId0')).group()) for r in prs_rels_tree if re.search(r'\d+',r.get('Id',''))]
            base_id = max(nums, default=10) + 1
            slide_rid_map = {}
            for i in range(len(slide_indices)):
                rid = f'rId{base_id+i}'; new_num = i+1; slide_rid_map[new_num] = rid
                rel = etree.SubElement(prs_rels_tree, f'{{{NS_REL}}}Relationship')
                rel.set('Id',rid); rel.set('Type',SLIDE_REL_TYPE); rel.set('Target',f'slides/slide{new_num}.xml')
            zout.writestr('ppt/_rels/presentation.xml.rels',
                etree.tostring(prs_rels_tree,xml_declaration=True,encoding='UTF-8',standalone=True))
            prs_tree = etree.fromstring(zin.read('ppt/presentation.xml'))
            sldIdLst = prs_tree.find(f'{{{NS_P}}}sldIdLst')
            if sldIdLst is not None:
                orig = list(sldIdLst); sldIdLst.clear()
                for i,sidx in enumerate(slide_indices):
                    new_num = i+1
                    elem = deepcopy(orig[sidx]) if sidx < len(orig) else etree.SubElement(sldIdLst,f'{{{NS_P}}}sldId')
                    elem.set('id',str(256+i)); elem.set(f'{{{NS_R}}}id',slide_rid_map[new_num])
                    sldIdLst.append(elem)
            zout.writestr('ppt/presentation.xml',
                etree.tostring(prs_tree,xml_declaration=True,encoding='UTF-8',standalone=True))
            for i,sidx in enumerate(slide_indices):
                new_num = i+1
                old_s = f'ppt/slides/slide{sidx+1}.xml'
                old_r = f'ppt/slides/_rels/slide{sidx+1}.xml.rels'
                if old_s in all_files:
                    raw = zin.read(old_s); tree = etree.fromstring(raw)
                    _update_slide(tree, sidx, audience_line=audience_line, toc_items=toc_items)
                    zout.writestr(f'ppt/slides/slide{new_num}.xml',
                        etree.tostring(tree,xml_declaration=True,encoding='UTF-8',standalone=True))
                if old_r in all_files:
                    zout.writestr(f'ppt/slides/_rels/slide{new_num}.xml.rels', zin.read(old_r))
        output.seek(0); return output.read()


def _update_slide(tree, slide_idx, audience_line=None, toc_items=None):
    if slide_idx == 0 and audience_line:
        for sp in tree.iter(f'{{{NS_P}}}sp'):
            if sp.find(f'.//{{{NS_P}}}ph') is not None: continue
            txBody = sp.find(f'{{{NS_P}}}txBody')
            if txBody is None: continue
            all_text = ''.join(t.text or '' for t in txBody.iter(f'{{{NS_A}}}t'))
            if 'Investor' in all_text and 'Overview' in all_text:
                t_elems = list(txBody.iter(f'{{{NS_A}}}t'))
                if t_elems:
                    t_elems[0].text = audience_line
                    for t in t_elems[1:]: t.text = ''
                break
    elif slide_idx == 2 and toc_items:
        for sp in tree.iter(f'{{{NS_P}}}sp'):
            ph = sp.find(f'.//{{{NS_P}}}ph')
            if ph is not None and ph.get('idx') == '1':
                txBody = sp.find(f'{{{NS_P}}}txBody')
                if txBody is not None:
                    paras = txBody.findall(f'{{{NS_A}}}p')
                    for j,para in enumerate(paras):
                        if j < len(toc_items):
                            runs = para.findall(f'{{{NS_A}}}r')
                            if runs:
                                t_elem = runs[0].find(f'{{{NS_A}}}t')
                                if t_elem is not None: t_elem.text = toc_items[j]
                                for run in runs[1:]:
                                    t2 = run.find(f'{{{NS_A}}}t')
                                    if t2 is not None: t2.text = ''
                break


def classify_audience(s):
    a = (s or '').lower()
    if any(x in a for x in ['lp','limited partner','allocator','pension','endowment','institution','fund of fund']): return 'lp'
    if any(x in a for x in ['family','office','fo','hnw','wealth','high net']): return 'family_office'
    if any(x in a for x in ['bank','banker','broker','intermediar','ib','m&a','advisor','cpa','accountant']): return 'investment_banker'
    return 'general'


def get_template():
    paths = [
        os.path.join(os.path.dirname(__file__), 'template.pptx'),
        '/var/task/api/template.pptx',
    ]
    for path in paths:
        if os.path.exists(path):
            with open(path,'rb') as f: return f.read()
    raise FileNotFoundError(f'template.pptx not found. Tried: {paths}')


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length',0))
            body = json.loads(self.rfile.read(length)) if length else {}
            topic    = body.get('topic','Catskill Partners LP')
            audience = body.get('audience','General')
            aud_key  = classify_audience(audience)
            preset   = PRESETS[aud_key]
            labels   = {'lp':'LP / Limited Partner Overview','family_office':'Family Office Overview',
                        'investment_banker':'Investment Banker Overview','general':'Investor Overview'}
            aud_line = labels[aud_key]
            if topic and topic.strip() and 'catskill' not in topic.lower():
                aud_line = f"{topic.strip()[:45]} — {labels[aud_key]}"
            template_bytes = get_template()
            pptx_bytes = build_pptx(template_bytes, preset['slides'],
                                    audience_line=aud_line, toc_items=preset['toc'], topic=topic)
            b64 = base64.b64encode(pptx_bytes).decode()
            safe = re.sub(r'[^a-zA-Z0-9-]','-',topic or 'Overview')[:40]
            filename = f'Catskill-Partners-{safe}-{aud_key}.pptx'
            self._json(200,{'success':True,'filename':filename,'base64':b64,
                           'slideCount':len(preset['slides']),'audience':aud_key,'title':topic})
        except Exception as e:
            import traceback
            self._json(500,{'error':str(e),'detail':traceback.format_exc()[-800:]})
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
    def _json(self, code, data):
        payload = json.dumps(data).encode()
        self.send_response(code); self._cors()
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',len(payload))
        self.end_headers(); self.wfile.write(payload)
    def log_message(self, *a): pass
