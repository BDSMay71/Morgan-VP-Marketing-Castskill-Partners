// Morgan Cole – LMM Industrial M&A Transaction Intelligence v1
// CommonJS, zero external deps — Anthropic web search + GitHub DB + Resend email
'use strict';
const REPO='BDSMay71/Morgan-VP-Marketing-Castskill-Partners';
const DB_PATH='api/transaction_db.json';
const EMAILS=['brian.steel@catskillpartners.com','mike.fuller@catskillpartners.com'];

function emptyDB(){
  const d=new Date();d.setMonth(d.getMonth()-18);
  return{metadata:{created:new Date().toISOString(),last_scan:null,last_email:null,total:0,covered_from:d.toISOString().split('T')[0],version:'1.0'},transactions:[],pe_platforms:{}};
}

async function loadDB(gh){
  if(!gh)return{sha:null,db:emptyDB()};
  const r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json'}});
  if(!r.ok)return{sha:null,db:emptyDB()};
  const data=await r.json();
  const dec=b64=>{const s=atob(b64.replace(/\n/g,''));const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new TextDecoder().decode(u);};
  try{return{sha:data.sha,db:JSON.parse(dec(data.content))};}catch{return{sha:data.sha,db:emptyDB()};}
}

async function saveDB(db,sha,msg,gh){
  if(!gh)return null;
  const body=JSON.stringify(db,null,2);
  const enc=btoa(unescape(encodeURIComponent(body)));
  const payload={message:msg,content:enc};if(sha)payload.sha=sha;
  const r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{method:'PUT',headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(payload)});
  const res=await r.json();return res.commit?.sha?.slice(0,10);
}

async function callClaude(messages,system,apiKey,maxTokens,tools){
  const body={model:'claude-sonnet-4-20250514',max_tokens:maxTokens||2500,system,messages};
  if(tools)body.tools=tools;
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
  if(!r.ok){const t=await r.text();throw new Error('Anthropic '+r.status+': '+t.substring(0,200));}
  return r.json();
}
function getTexts(d){return(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();}
function safeJSON(t){
  try{
    const c=t.replace(/```json\n?/g,'').replace(/```/g,'').trim();
    const m=c.match(/\[([\s\S]*)\]/s);
    if(m)return JSON.parse('['+m[1]+']');
    const m2=c.match(/\{[\s\S]*\}/s);
    if(m2){const x=JSON.parse(m2[0]);return Array.isArray(x)?x:[x];}
  }catch(e){}
  return[];
}

const SCAN_SYS=`You are Morgan Cole, VP Marketing at Catskill Partners LP. Search for REAL lower middle market industrial M&A transactions. 
Focus sectors: Advanced Manufacturing (CNC/stamping/fabrication/casting), Engineered Materials (seals/gaskets/composites/specialty polymers), Precision Components (aerospace/defense/medical/auto components), ICT Data Center supply chain (power distribution/cooling/cabling/enclosures), Industrial Services.
Target: companies with $10M-$150M revenue.
Return a JSON ARRAY of real announced deals. Each deal:
{
  "id":"unique-buyer-target-YYYYMM",
  "date_announced":"YYYY-MM-DD",
  "buyer":"buyer name",
  "buyer_type":"PE or Strategic",
  "pe_firm":"PE fund name if PE buyer",
  "seller":"previous owner if known",
  "target":"acquired company name",
  "market_segment":"Advanced Manufacturing|Engineered Materials|Precision Components|ICT Data Center|Industrial Services|Other Industrial",
  "deal_type":"Platform|Add-on|Recapitalization|Sale",
  "revenue_disclosed":"$XM or null",
  "ebitda_disclosed":"$XM or null",
  "banking_advisors":["advisor names"],
  "legal_buyer":["law firms"],
  "legal_seller":["law firms"],
  "description":"2-3 sentences: what company makes, who they serve, deal rationale",
  "platform_context":"what platform/thesis is buyer building?",
  "source":"PR Newswire|Business Wire|Globe Newswire|ACG|PE Hub|Other",
  "catskill_relevance":"high|medium|low"
}
Only return REAL announced deals. Return [] if no relevant deals found.`;

async function scanPeriod(period,apiKey){
  const today=new Date().toISOString().split('T')[0];
  const prompt='Search press releases and M&A news for lower middle market INDUSTRIAL M&A transactions in '+period+'. Search sources: PR Newswire prnewswire.com, Business Wire businesswire.com, Globe Newswire, ACG (Association for Corporate Growth), PE Hub, Mergers & Acquisitions magazine, Axial, CapIQ. Use targeted searches like: "lower middle market" manufacturing acquisition '+period+', precision components PE acquisition '+period+', engineered materials manufacturer buyout '+period+', advanced manufacturing private equity '+period+'. Return real deals as JSON array. Today is '+today;
  try{
    const tools=[{type:'web_search_20250305',name:'web_search'}];
    const d=await callClaude([{role:'user',content:prompt}],SCAN_SYS,apiKey,3000,tools);
    const text=getTexts(d);
    const arr=safeJSON(text);
    return arr.filter(t=>t&&t.target&&t.buyer&&t.buyer_type);
  }catch(e){console.error('Scan error for '+period+':',e.message);return[];}
}

function buildPlatforms(db){
  db.pe_platforms={};
  for(const t of(db.transactions||[]).filter(x=>x.buyer_type==='PE')){
    const k=t.pe_firm||t.buyer;if(!k)continue;
    if(!db.pe_platforms[k])db.pe_platforms[k]={firm_name:k,platform_thesis:'',target_segments:[],deal_count:0,acquisitions:[]};
    const p=db.pe_platforms[k];
    if(!p.acquisitions.includes(t.id)){p.acquisitions.push(t.id);p.deal_count++;}
    if(t.market_segment&&!p.target_segments.includes(t.market_segment))p.target_segments.push(t.market_segment);
    if((t.platform_context||'').length>(p.platform_thesis||'').length)p.platform_thesis=t.platform_context||'';
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

function row(t,cols){return'<tr style="border-bottom:1px solid #f0f0f0;">'+cols.map(c=>'<td style="padding:6px 8px;font-size:11px;vertical-align:top;">'+(c==='target'?'<strong style=color:#1A4C3D>'+(t.target||'-')+'</strong>':c==='desc'?'<span style=color:#555>'+(t.description||'').substring(0,100)+'</span>':c==='advisors'?(t.banking_advisors||[]).join(', ')||'-':c==='legal'?(t.legal_buyer||[]).join(', ')||'-':(t[c]||'-'))+'</td>').join('')+'</tr>';}

function buildHTML(db,newTxns){
  const now=new Date();
  const s=sorted(db);
  const pe=s.filter(t=>t.buyer_type==='PE');
  const strat=s.filter(t=>t.buyer_type==='Strategic');
  const pl=db.pe_platforms||{};
  const TH=cols=>'<tr>'+cols.map(c=>'<th style="background:#1A4C3D;color:#fff;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">'+c+'</th>').join('')+'</tr>';
  const newSect=newTxns.length?'<div style="background:#EDF7F2;border-left:4px solid #41AC48;padding:16px;margin:20px 0;border-radius:4px;"><h3 style="color:#1A4C3D;margin:0 0 12px;">🆕 '+newTxns.length+' New Deal'+(newTxns.length>1?'s':'')+' This Week</h3>'+newTxns.map(t=>'<div style="margin-bottom:10px;padding:10px;background:#fff;border-radius:6px;"><strong style="color:#1A4C3D;">'+t.target+'</strong> <span style="color:#888;font-size:11px;">'+t.date_announced+'</span><br><span style="font-size:12px;"><b>'+(t.pe_firm||t.buyer)+'</b> ('+t.buyer_type+') · '+t.market_segment+' · '+t.deal_type+'</span><br><span style="font-size:11px;color:#555;">'+(t.description||'').substring(0,150)+'</span>'+(t.platform_context?'<br><em style="font-size:10px;color:#1A4C3D;">Platform: '+t.platform_context.substring(0,120)+'</em>':'')+'</div>').join('')+'</div>':'';
  const peSect=Object.entries(pl).sort((a,b)=>b[1].deal_count-a[1].deal_count).slice(0,25).map(([firm,p])=>'<div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><div style="background:#EDF7F2;padding:9px 14px;display:flex;justify-content:space-between;align-items:center;"><strong style="color:#1A4C3D;font-size:13px;">'+firm+'</strong><span style="font-size:11px;color:#666;">'+p.deal_count+' deal'+(p.deal_count>1?'s':'')+' · '+p.target_segments.slice(0,3).join(' / ')+'</span></div>'+(p.platform_thesis?'<div style="padding:5px 14px;font-size:11px;color:#555;font-style:italic;border-bottom:1px solid #f3f3f3;">'+p.platform_thesis.substring(0,200)+'</div>':'')+'<table style="width:100%;border-collapse:collapse;">'+TH(['Date','Company Acquired','Segment','Type','M&A Advisor','Legal (Buyer)'])+pe.filter(t=>(t.pe_firm||t.buyer)===firm).map(t=>row(t,['date_announced','target','market_segment','deal_type','advisors','legal'])).join('')+'</table></div>').join('');
  const stratSect=strat.length?'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:28px;">🏭 STRATEGIC BUYERS</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px;">'+TH(['Date','Target','Buyer','Segment','Type','M&A Advisor','Description'])+strat.map(t=>row(t,['date_announced','target','buyer','market_segment','deal_type','advisors','desc'])).join('')+'</table>':'';
  const stats=[['Total Deals',db.metadata?.total||0],['PE-Backed',pe.length],['Strategic',strat.length],['New This Week',newTxns.length],['PE Firms',Object.keys(pl).length]];
  return'<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2937;margin:0;background:#f9fafb;}table{border-collapse:collapse;width:100%;}</style></head><body><div style="max-width:980px;margin:0 auto;background:#fff;"><div style="background:#1A4C3D;padding:22px 30px;"><div style="font-size:21px;font-weight:800;color:#fff;letter-spacing:-0.5px;">CATSKILL PARTNERS</div><div style="font-size:11px;color:#41AC48;letter-spacing:2px;margin-top:3px;">MORGAN COLE · VP OF MARKETING</div><div style="color:#a8d5b5;font-size:11px;margin-top:6px;">'+now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'</div></div><div style="padding:20px 30px;border-bottom:2px solid #1A4C3D;"><h1 style="margin:0;font-size:20px;color:#1A4C3D;">LMM Industrial M&A Transaction Intelligence</h1><p style="margin:6px 0 0;color:#666;font-size:12px;">Database: '+(db.metadata?.total||0)+' deals · Covers '+(db.metadata?.covered_from||'2024-10-01')+' to present · '+(db.metadata?.last_scan?new Date(db.metadata.last_scan).toLocaleDateString():'not yet scanned')+'</p></div><div style="padding:20px 30px;"><div style="display:flex;gap:12px;margin-bottom:18px;">'+stats.map(([l,v])=>'<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#1A4C3D;">'+v+'</div><div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.05em;">'+l+'</div></div>').join('')+'</div>'+newSect+'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:20px;">🏦 PRIVATE EQUITY BUYERS — Sorted by Firm</h2>'+peSect+stratSect+'<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#999;text-align:center;"><strong style="color:#1A4C3D;">CATSKILL PARTNERS LP</strong> · CLARITY. CRAFT. CAPITAL.<br>Generated by Morgan Cole · VP of Marketing · brian.steel@catskillpartners.com<br>To unsubscribe or update frequency, reply to this email.</div></div></div></body></html>';
}

async function sendEmail(db,newTxns,resendKey){
  const html=buildHTML(db,newTxns);
  const n=newTxns.length;
  const subject='LMM Industrial M&A Intelligence — '+new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+(n?' · '+n+' New Deal'+(n>1?'s':''):'');
  if(!resendKey)return{status:'no_resend_key',html_length:html.length,note:'Add RESEND_API_KEY to Vercel env vars to enable auto-send'};
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+resendKey,'Content-Type':'application/json'},body:JSON.stringify({from:'Morgan Cole <onboarding@resend.dev>',reply_to:'brian.steel@catskillpartners.com',to:EMAILS,subject,html})});
  const res=await r.json();
  return{status:r.ok?'sent':'error',to:EMAILS,id:res.id,error:res.message||null};
}

module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  const apiKey=process.env.ANTHROPIC_API_KEY;
  const ghToken=process.env.GITHUB_TOKEN||'';
  const resendKey=process.env.RESEND_API_KEY||'';
  if(!apiKey)return res.status(500).json({error:'ANTHROPIC_API_KEY not set'});
  try{
    const body=req.body||{};
    const resendKeyFinal=process.env.RESEND_API_KEY||body.resend_key||'';
    const action=body.action||(req.method==='GET'?'get':'weekly_scan');

    if(action==='get'){
      const{db}=await loadDB(ghToken);
      return res.status(200).json({success:true,db,sorted:sorted(db),platform_count:Object.keys(db.pe_platforms||{}).length});
    }

    if(action==='weekly_scan'||action==='initial_scan'){
      const isInit=action==='initial_scan';
      const periods=isInit
        ?['October through December 2024','January through March 2025','April through June 2025','July through September 2025','October through December 2025','January through April 2026']
        :['last 10 days'];
      const{sha,db}=await loadDB(ghToken);
      const existing=new Set((db.transactions||[]).map(t=>t.id));
      const allNew=[];
      for(const period of periods){
        const txns=await scanPeriod(period,apiKey);
        const fresh=txns.filter(t=>t.id&&!existing.has(t.id)&&t.target&&t.buyer);
        fresh.forEach(t=>{t.date_added=new Date().toISOString().split('T')[0];existing.add(t.id);});
        allNew.push(...fresh);
        if(!db.transactions)db.transactions=[];
        db.transactions.push(...fresh);
      }
      db.metadata=db.metadata||{};
      db.metadata.last_scan=new Date().toISOString();
      db.metadata.total=db.transactions.length;
      buildPlatforms(db);
      let newSha=null;
      if(ghToken)newSha=await saveDB(db,sha,(isInit?'Initial':'Weekly')+' scan: +'+allNew.length+' LMM industrial deals',ghToken);
      db.metadata.last_email=new Date().toISOString();
      const emailResult=await sendEmail(db,allNew,resendKeyFinal);
      if(ghToken&&newSha)await saveDB(db,newSha,'Update: email sent '+new Date().toISOString().split('T')[0],ghToken);
      return res.status(200).json({success:true,added:allNew.length,total:db.transactions.length,periods_scanned:periods.length,emailResult});
    }

    if(action==='send_email'){
      const{db}=await loadDB(ghToken);
      const cutoff=new Date();cutoff.setDate(cutoff.getDate()-7);
      const recent=(db.transactions||[]).filter(t=>{try{return new Date(t.date_added||t.date_announced||0)>cutoff;}catch{return false;}});
      const result=await sendEmail(db,recent,resendKeyFinal);
      const result=await sendEmail(db,recent,resendKeyFinal);return res.status(200).json({success:true,...result,html_preview_length:buildHTML(db,recent).length});
    }

    if(action==='get_html'){
      const{db}=await loadDB(ghToken);
      const cutoff=new Date();cutoff.setDate(cutoff.getDate()-7);
      const recent=(db.transactions||[]).filter(t=>{try{return new Date(t.date_added||0)>cutoff;}catch{return false;}});
      return res.status(200).json({success:true,html:buildHTML(db,recent)});
    }

    return res.status(400).json({error:'Unknown action. Use: get, weekly_scan, initial_scan, send_email, get_html'});
  }catch(e){
    console.error('transactions.js error:',e.message,e.stack?.substring(0,300));
    return res.status(500).json({error:e.message,detail:e.stack?.substring(0,500)});
  }
};