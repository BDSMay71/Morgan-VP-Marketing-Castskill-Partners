// Morgan Cole – LMM Industrial M&A Transaction Intelligence v2
// Clean rewrite: CommonJS, zero deps, Resend email, GitHub DB
'use strict';
const REPO='BDSMay71/Morgan-VP-Marketing-Castskill-Partners';
const DB_PATH='api/transaction_db.json';
const TO=['brian.steel@catskillpartners.com','mike.fuller@catskillpartners.com'];

function emptyDB(){
  const d=new Date();d.setMonth(d.getMonth()-18);
  return{metadata:{created:new Date().toISOString(),last_scan:null,last_email:null,total:0,covered_from:d.toISOString().split('T')[0],version:'2.0'},transactions:[],pe_platforms:{}};
}

async function loadDB(gh){
  if(!gh)return{sha:null,db:emptyDB()};
  try{
    const r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json'}});
    if(!r.ok)return{sha:null,db:emptyDB()};
    const data=await r.json();
    const s=atob(data.content.replace(/\n/g,''));
    const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
    return{sha:data.sha,db:JSON.parse(new TextDecoder().decode(u))};
  }catch(e){console.error('loadDB err:',e.message);return{sha:null,db:emptyDB()};}
}

async function saveDB(db,sha,msg,gh){
  if(!gh)return null;
  try{
    const body=JSON.stringify(db,null,2);
    const enc=btoa(unescape(encodeURIComponent(body)));
    const payload={message:msg,content:enc};if(sha)payload.sha=sha;
    const r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{method:'PUT',headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(payload)});
    const res=await r.json();return res.commit?.sha?.slice(0,10);
  }catch(e){console.error('saveDB err:',e.message);return null;}
}

async function claude(messages,system,apiKey,maxTokens,tools){
  const body={model:'claude-sonnet-4-20250514',max_tokens:maxTokens||2000,system,messages};
  if(tools)body.tools=tools;
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
  if(!r.ok)throw new Error('Claude '+r.status+': '+(await r.text()).substring(0,200));
  return r.json();
}
function txt(d){return(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();}
function parseArr(t){
  try{const c=t.replace(/```json\n?/g,'').replace(/```/g,'').trim();const m=c.match(/\[[\s\S]*\]/);if(m)return JSON.parse(m[0]);}catch{}
  return[];
}

const SYS=`You are Morgan Cole, VP Marketing at Catskill Partners LP. Search press releases and M&A news for REAL lower middle market INDUSTRIAL transactions. Sectors: Advanced Manufacturing (CNC/stamping/fabrication/casting), Engineered Materials (seals/gaskets/composites), Precision Components (aerospace/defense/medical/auto), ICT Data Center supply chain, Industrial Services. Target: $10M-$150M revenue companies.
Return a JSON array. Each deal: {id,date_announced,buyer,buyer_type,pe_firm,seller,target,market_segment,deal_type,revenue_disclosed,ebitda_disclosed,banking_advisors,legal_buyer,legal_seller,description,platform_context,source,catskill_relevance}. Only REAL announced deals. Return [] if none.`;

async function scan(period,apiKey){
  const prompt='Search for real LMM industrial M&A transactions in '+period+'. Use web_search. Search: "lower middle market" manufacturing acquisition '+period+', precision components PE buyout '+period+', engineered materials manufacturer acquired '+period+'. Sources: prnewswire.com businesswire.com globenewswire.com acg.org. Return JSON array of real deals. Today:'+new Date().toISOString().split('T')[0];
  try{
    const d=await claude([{role:'user',content:prompt}],SYS,apiKey,3000,[{type:'web_search_20250305',name:'web_search'}]);
    const arr=parseArr(txt(d));
    return arr.filter(t=>t&&t.target&&t.buyer&&t.buyer_type);
  }catch(e){console.error('scan err '+period+':',e.message);return[];}
}

function buildPlatforms(db){
  db.pe_platforms={};
  for(const t of(db.transactions||[]).filter(x=>x.buyer_type==='PE')){
    const k=t.pe_firm||t.buyer;if(!k)continue;
    if(!db.pe_platforms[k])db.pe_platforms[k]={firm_name:k,platform_thesis:'',target_segments:[],deal_count:0,acquisitions:[]};
    const p=db.pe_platforms[k];
    if(!p.acquisitions.includes(t.id)){p.acquisitions.push(t.id);p.deal_count++;}
    if(t.market_segment&&!p.target_segments.includes(t.market_segment))p.target_segments.push(t.market_segment);
    if((t.platform_context||'').length>(p.platform_thesis||'').length)p.platform_thesis=t.platform_context;
  }
}
function sorted(db){
  return[...(db.transactions||[])].sort((a,b)=>{
    if(a.buyer_type!==b.buyer_type)return a.buyer_type==='PE'?-1:1;
    const ak=(a.pe_firm||a.buyer||'').toLowerCase(),bk=(b.pe_firm||b.buyer||'').toLowerCase();
    if(ak!==bk)return ak.localeCompare(bk);
    return(b.date_announced||'').localeCompare(a.date_announced||'');
  });
}

function html(db,newTxns){
  const now=new Date();
  const s=sorted(db);
  const pe=s.filter(t=>t.buyer_type==='PE'),st=s.filter(t=>t.buyer_type!=='PE');
  const pl=db.pe_platforms||{};
  const TH=cols=>'<tr>'+cols.map(c=>'<th style="background:#1A4C3D;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;">'+c+'</th>').join('')+'</tr>';
  const newSect=newTxns.length?'<div style="background:#EDF7F2;border-left:4px solid #41AC48;padding:14px;margin:16px 0;border-radius:4px;"><h3 style="color:#1A4C3D;margin:0 0 10px;">🆕 '+newTxns.length+' New Deal'+(newTxns.length>1?'s':'')+' This Week</h3>'+newTxns.map(t=>'<div style="margin-bottom:8px;padding:8px;background:#fff;border-radius:6px;"><strong style="color:#1A4C3D;">'+t.target+'</strong> <span style="color:#888;font-size:11px;">'+t.date_announced+'</span><br><span style="font-size:12px;"><b>'+(t.pe_firm||t.buyer)+'</b> ('+t.buyer_type+') · '+t.market_segment+' · '+t.deal_type+'</span><br><span style="font-size:11px;color:#555;">'+(t.description||'').substring(0,150)+'</span>'+(t.platform_context?'<br><em style="font-size:10px;color:#1A4C3D;">Platform: '+t.platform_context.substring(0,120)+'</em>':'')+'</div>').join('')+'</div>':'';
  const peSection=Object.entries(pl).sort((a,b)=>b[1].deal_count-a[1].deal_count).slice(0,30).map(([firm,p])=>'<div style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><div style="background:#EDF7F2;padding:8px 12px;display:flex;justify-content:space-between;"><strong style="color:#1A4C3D;">'+firm+'</strong><span style="font-size:11px;color:#666;">'+p.deal_count+' deal'+(p.deal_count>1?'s':'')+' · '+p.target_segments.join(' / ')+'</span></div>'+(p.platform_thesis?'<div style="padding:5px 12px;font-size:11px;color:#555;font-style:italic;border-bottom:1px solid #f0f0f0;">'+p.platform_thesis.substring(0,200)+'</div>':'')+'<table style="width:100%;border-collapse:collapse;">'+TH(['Date','Company','Segment','Type','M&A Advisor','Legal Buyer'])+pe.filter(t=>(t.pe_firm||t.buyer)===firm).map(t=>'<tr style="border-bottom:1px solid #f5f5f5;"><td style="padding:5px 8px;font-size:11px;color:#777;">'+(t.date_announced||'-')+'</td><td style="padding:5px 8px;font-size:12px;font-weight:600;color:#1A4C3D;">'+(t.target||'-')+'</td><td style="padding:5px 8px;font-size:11px;">'+(t.market_segment||'-')+'</td><td style="padding:5px 8px;font-size:11px;">'+(t.deal_type||'-')+'</td><td style="padding:5px 8px;font-size:11px;color:#666;">'+(t.banking_advisors||[]).join(', ')||'-')+'</td><td style="padding:5px 8px;font-size:11px;color:#666;">'+(t.legal_buyer||[]).join(', ')||'-')+'</td></tr>').join('')+'</table></div>').join('');
  const stratSection=st.length?'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:24px;">🏭 STRATEGIC BUYERS</h2><table style="width:100%;border-collapse:collapse;">'+TH(['Date','Target','Buyer','Segment','Type','M&A Advisor'])+st.map(t=>'<tr style="border-bottom:1px solid #eee;"><td style="padding:5px 8px;font-size:11px;color:#777;">'+(t.date_announced||'-')+'</td><td style="padding:5px 8px;font-size:12px;font-weight:600;">'+(t.target||'-')+'</td><td style="padding:5px 8px;font-size:12px;">'+(t.buyer||'-')+'</td><td style="padding:5px 8px;font-size:11px;">'+(t.market_segment||'-')+'</td><td style="padding:5px 8px;font-size:11px;">'+(t.deal_type||'-')+'</td><td style="padding:5px 8px;font-size:11px;color:#666;">'+(t.banking_advisors||[]).join(', ')||'-')+'</td></tr>').join('')+'</table>':'';
  const stats=[['Total Deals',db.metadata?.total||0],['PE-Backed',pe.length],['Strategic',st.length],['New This Week',newTxns.length],['PE Firms',Object.keys(pl).length]];
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1f2937;margin:0;background:#f9fafb;}table{border-collapse:collapse;width:100%;}</style></head><body><div style="max-width:980px;margin:0 auto;background:#fff;"><div style="background:#1A4C3D;padding:20px 28px;"><div style="font-size:20px;font-weight:800;color:#fff;">CATSKILL PARTNERS</div><div style="font-size:11px;color:#41AC48;letter-spacing:2px;margin-top:3px;">MORGAN COLE · VP OF MARKETING</div><div style="color:#a8d5b5;font-size:11px;margin-top:6px;">'+now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'</div></div><div style="padding:18px 28px;border-bottom:2px solid #1A4C3D;"><h1 style="margin:0;font-size:20px;color:#1A4C3D;">LMM Industrial M&A Transaction Intelligence</h1><p style="margin:6px 0 0;color:#666;font-size:12px;">Database: '+(db.metadata?.total||0)+' deals tracked · Covers '+(db.metadata?.covered_from||'2024-10-01')+' – present</p></div><div style="padding:18px 28px;"><div style="display:flex;gap:10px;margin-bottom:16px;">'+stats.map(([l,v])=>'<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#1A4C3D;">'+v+'</div><div style="font-size:10px;color:#666;text-transform:uppercase;">'+l+'</div></div>').join('')+'</div>'+newSect+'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:18px;">🏦 PRIVATE EQUITY BUYERS</h2>'+peSection+stratSection+'<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#999;text-align:center;"><strong style="color:#1A4C3D;">CATSKILL PARTNERS LP</strong> · CLARITY. CRAFT. CAPITAL.<br>Generated by Morgan Cole · VP of Marketing · Last scan: '+new Date(db.metadata?.last_scan||Date.now()).toLocaleString()+'</div></div></div></body></html>';
}

async function sendEmail(db,newTxns,resendKey){
  const h=html(db,newTxns);
  const n=newTxns.length;
  const subj='LMM Industrial M&A Intelligence — '+new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+(n?' · '+n+' New Deal'+(n!==1?'s':''):'');
  if(!resendKey)return{status:'no_resend_key',html_length:h.length};
  try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+resendKey,'Content-Type':'application/json'},body:JSON.stringify({from:'Morgan Cole <onboarding@resend.dev>',to:TO,subject:subj,html:h,reply_to:'brian.steel@catskillpartners.com'})});
    const res=await r.json();
    return{status:r.ok?'sent':'error',to:TO,id:res.id,error:res.message||null};
  }catch(e){return{status:'error',error:e.message};}
}

module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();

  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey)return res.status(500).json({error:'ANTHROPIC_API_KEY not set'});

  // Parse body first so all variables can reference it
  let body={};
  try{ body=req.body||{}; }catch(e){}

  const ghToken=process.env.GITHUB_TOKEN||body.github_token||'';
  const resendKey=process.env.RESEND_API_KEY||body.resend_key||'';
  const action=body.action||(req.method==='GET'?'get':'weekly_scan');

  // Debug: log env var status
  console.log('transactions.js action:',action,'ghToken:',!!ghToken,'resendKey:',!!resendKey,'envResend:',!!process.env.RESEND_API_KEY);

  try{
    if(action==='get'){
      const{db}=await loadDB(ghToken);
      return res.status(200).json({success:true,db,sorted:sorted(db),pe_count:Object.keys(db.pe_platforms||{}).length});
    }

    if(action==='weekly_scan'||action==='initial_scan'){
      const isInit=action==='initial_scan';
      const periods=isInit
        ?['October through December 2024','January through March 2025','April through June 2025','July through September 2025','October through December 2025','January through April 2026']
        :['last 10 days'];
      const{sha,db}=await loadDB(ghToken);
      const existing=new Set((db.transactions||[]).map(t=>t.id));
      const allNew=[];
      for(const p of periods){
        const txns=await scan(p,apiKey);
        const fresh=txns.filter(t=>t.id&&!existing.has(t.id));
        fresh.forEach(t=>{t.date_added=new Date().toISOString().split('T')[0];existing.add(t.id);});
        allNew.push(...fresh);
        if(!db.transactions)db.transactions=[];
        db.transactions.push(...fresh);
      }
      db.metadata=db.metadata||{};
      db.metadata.last_scan=new Date().toISOString();
      db.metadata.total=(db.transactions||[]).length;
      buildPlatforms(db);
      let newSha=null;
      if(ghToken)newSha=await saveDB(db,sha,(isInit?'Initial':'Weekly')+' scan: +'+allNew.length+' LMM deals',ghToken);
      const emailResult=await sendEmail(db,allNew,resendKey);
      return res.status(200).json({success:true,added:allNew.length,total:db.metadata.total,periods_scanned:periods.length,emailResult,resendKeyPresent:!!resendKey});
    }

    if(action==='send_email'){
      const{db}=await loadDB(ghToken);
      const cutoff=new Date();cutoff.setDate(cutoff.getDate()-7);
      const recent=(db.transactions||[]).filter(t=>{try{return new Date(t.date_added||t.date_announced||0)>cutoff;}catch{return false;}});
      const result=await sendEmail(db,recent,resendKey);
      return res.status(200).json({success:true,...result,resendKeyPresent:!!resendKey,envResend:!!process.env.RESEND_API_KEY});
    }

    if(action==='get_html'){
      const{db}=await loadDB(ghToken);
      const cutoff=new Date();cutoff.setDate(cutoff.getDate()-7);
      const recent=(db.transactions||[]).filter(t=>{try{return new Date(t.date_added||0)>cutoff;}catch{return false;}});
      return res.status(200).json({success:true,html:html(db,recent)});
    }

    return res.status(400).json({error:'Unknown action: '+action});
  }catch(e){
    console.error('transactions error:',e.message,e.stack?.substring(0,300));
    return res.status(500).json({error:e.message,detail:e.stack?.substring(0,400)});
  }
};