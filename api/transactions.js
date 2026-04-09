// Morgan Cole – LMM Industrial M&A Transaction Intelligence v5
// Browser-orchestrated: server proxies Anthropic API, browser chains 6 scans
'use strict';
var REPO='BDSMay71/Morgan-VP-Marketing-Castskill-Partners';
var DB_PATH='api/transaction_db.json';
var TO=['brian.steel@catskillpartners.com','mike.fuller@catskillpartners.com'];

// ── helpers ───────────────────────────────────────────────────────────────────
function cell(v){return '<td style="padding:5px 8px;font-size:11px;vertical-align:top;">'+(v||'-')+'</td>';}
function boldCell(v){return '<td style="padding:5px 8px;font-size:12px;font-weight:600;color:#1A4C3D;">'+(v||'-')+'</td>';}
function arrCell(a){return cell(Array.isArray(a)?a.filter(Boolean).join(', '):(a||''));}
function thRow(cols){return '<tr>'+cols.map(function(c){return '<th style="background:#1A4C3D;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;">'+c+'</th>';}).join('')+'</tr>';}
function emptyDB(){
  var d=new Date();d.setMonth(d.getMonth()-18);
  return{metadata:{created:new Date().toISOString(),last_scan:null,last_email:null,total:0,
    covered_from:d.toISOString().split('T')[0],version:'5.0'},transactions:[],pe_platforms:{}};
}

// ── GitHub DB ─────────────────────────────────────────────────────────────────
async function loadDB(gh){
  if(!gh)return{sha:null,db:emptyDB()};
  try{
    var r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,
      {headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json'}});
    if(!r.ok)return{sha:null,db:emptyDB()};
    var data=await r.json();
    var s=atob(data.content.replace(/\n/g,''));
    var u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
    var db=JSON.parse(new TextDecoder().decode(u));
    if(!db.transactions)db.transactions=[];
    if(!db.pe_platforms)db.pe_platforms={};
    return{sha:data.sha,db:db};
  }catch(e){return{sha:null,db:emptyDB()};}
}
async function saveDB(db,sha,msg,gh){
  if(!gh)return null;
  try{
    var enc=btoa(unescape(encodeURIComponent(JSON.stringify(db,null,2))));
    var payload={message:msg,content:enc};if(sha)payload.sha=sha;
    var r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{
      method:'PUT',
      headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},
      body:JSON.stringify(payload)});
    var res=await r.json();return res.commit&&res.commit.sha?res.commit.sha.slice(0,10):null;
  }catch(e){return null;}
}

// ── Scan ONE period via Anthropic (fast — 1 search call) ─────────────────────
async function scanOnePeriod(period,apiKey){
  var today=new Date().toISOString().split('T')[0];
  // Single focused prompt — 1 web search, return strict JSON
  var prompt='Search for real lower middle market industrial M&A transactions announced in '+period+'. '
    +'Search: "acquired" manufacturer "lower middle market" '+period+'. '
    +'Also search: "private equity" industrial manufacturer "platform acquisition" '+period+'. '
    +'Return ONLY a JSON array of deals found. Each deal object: '
    +'{id,date_announced,buyer,buyer_type,pe_firm,seller,target,market_segment,deal_type,'
    +'revenue_disclosed,banking_advisors,legal_buyer,description,platform_context,source,catskill_relevance}. '
    +'id: slug like "kohlberg-precision-parts-202410". buyer_type: "PE" or "Strategic". '
    +'market_segment: Advanced Manufacturing | Engineered Materials | Precision Components | ICT Data Center | Industrial Services | Other Industrial. '
    +'deal_type: Platform | Add-on | Recapitalization | Sale. '
    +'banking_advisors and legal_buyer: arrays. '
    +'Only include deals where target company manufactures physical goods or provides industrial services, $5M-$200M revenue range. '
    +'Be thorough — scan multiple search results pages. Return [] only if truly nothing found. '
    +'Today: '+today+'. DO NOT include markdown fences around JSON.';

  var body={
    model:'claude-sonnet-4-20250514',
    max_tokens:4000,
    messages:[{role:'user',content:prompt}],
    tools:[{type:'web_search_20250305',name:'web_search'}]
  };
  var r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
    body:JSON.stringify(body)
  });
  if(!r.ok)throw new Error('Anthropic '+r.status);
  var d=await r.json();
  var txt=(d.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('\n');
  // Try JSON parse — strip fences if present
  var clean=txt.replace(/```json\n?/g,'').replace(/```/g,'').trim();
  var m=clean.match(/\[[\s\S]*\]/);
  if(!m)return[];
  try{
    var arr=JSON.parse(m[0]);
    return Array.isArray(arr)?arr.filter(function(t){return t&&t.target&&t.buyer&&t.id;}):[]; 
  }catch(e){return[];}
}

// ── PE platforms ──────────────────────────────────────────────────────────────
function buildPlatforms(db){
  db.pe_platforms={};
  var peTxns=(db.transactions||[]).filter(function(t){return t.buyer_type==='PE';});
  for(var i=0;i<peTxns.length;i++){
    var t=peTxns[i];var k=t.pe_firm||t.buyer;if(!k)continue;
    if(!db.pe_platforms[k])db.pe_platforms[k]={firm_name:k,platform_thesis:'',target_segments:[],deal_count:0,acquisitions:[]};
    var p=db.pe_platforms[k];
    if(p.acquisitions.indexOf(t.id)<0){p.acquisitions.push(t.id);p.deal_count++;}
    if(t.market_segment&&p.target_segments.indexOf(t.market_segment)<0)p.target_segments.push(t.market_segment);
    if((t.platform_context||'').length>(p.platform_thesis||'').length)p.platform_thesis=t.platform_context;
  }
}
function sortedTxns(db){
  return[].concat(db.transactions||[]).sort(function(a,b){
    if(a.buyer_type!==b.buyer_type)return a.buyer_type==='PE'?-1:1;
    var ak=(a.pe_firm||a.buyer||'').toLowerCase(),bk=(b.pe_firm||b.buyer||'').toLowerCase();
    if(ak!==bk)return ak<bk?-1:1;
    return(b.date_announced||'')>(a.date_announced||'')?1:-1;
  });
}

// ── HTML report ───────────────────────────────────────────────────────────────
function buildHTML(db,newTxns){
  var now=new Date();
  var s=sortedTxns(db);
  var pe=s.filter(function(t){return t.buyer_type==='PE';});
  var strat=s.filter(function(t){return t.buyer_type!=='PE';});
  var pl=db.pe_platforms||{};
  var total=db.metadata&&db.metadata.total?db.metadata.total:0;
  var covFrom=db.metadata&&db.metadata.covered_from?db.metadata.covered_from:'2024-10-01';
  var lastScan=db.metadata&&db.metadata.last_scan?new Date(db.metadata.last_scan).toLocaleString():'never';

  var newSect='';
  if(newTxns.length>0){
    newSect='<div style="background:#EDF7F2;border-left:4px solid #41AC48;padding:14px;margin:16px 0;border-radius:4px;">'
      +'<h3 style="color:#1A4C3D;margin:0 0 10px;">&#128197; NEW SINCE LAST REPORT: '+newTxns.length+' Deal'+(newTxns.length!==1?'s':'')+'</h3>'
      +newTxns.map(function(t){return'<div style="margin-bottom:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid #c6e8d0;">'
        +'<strong style="color:#1A4C3D;">'+t.target+'</strong> <span style="color:#888;font-size:11px;">'+t.date_announced+'</span><br>'
        +'<span style="font-size:12px;"><b>'+(t.pe_firm||t.buyer)+'</b> ('+t.buyer_type+') &middot; '+(t.market_segment||'')+'  &middot; '+(t.deal_type||'')+'</span><br>'
        +'<span style="font-size:11px;color:#555;">'+(t.description||'').substring(0,180)+'</span>'
        +(t.banking_advisors&&t.banking_advisors.length?'<br><span style="font-size:10px;color:#777;">M&A Advisor: '+t.banking_advisors.join(', ')+'</span>':'')
        +'</div>';}).join('')+'</div>';
  }

  var peSect='';
  if(Object.keys(pl).length>0){
    peSect=Object.entries(pl).sort(function(a,b){return b[1].deal_count-a[1].deal_count;}).map(function(entry){
      var firm=entry[0],p=entry[1];
      var firmDeals=pe.filter(function(t){return(t.pe_firm||t.buyer)===firm;});
      var rows=firmDeals.map(function(t){return'<tr style="border-bottom:1px solid #f5f5f5;">'
        +cell(t.date_announced)+boldCell(t.target)+cell(t.market_segment)+cell(t.deal_type)
        +(t.revenue_disclosed?'<td style="padding:5px 8px;font-size:11px;">'+t.revenue_disclosed+'</td>':'<td style="padding:5px 8px;font-size:11px;color:#ccc;">—</td>')
        +arrCell(t.banking_advisors)
        +'<td style="padding:5px 8px;font-size:11px;color:#555;">'+(t.description||'').substring(0,90)+'</td>'
        +'</tr>';}).join('');
      return'<div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
        +'<div style="background:#EDF7F2;padding:9px 14px;display:flex;justify-content:space-between;align-items:center;">'
        +'<strong style="color:#1A4C3D;font-size:13px;">'+firm+'</strong>'
        +'<span style="font-size:11px;color:#666;">'+p.deal_count+' acq &middot; '+p.target_segments.slice(0,3).join(' / ')+'</span></div>'
        +(p.platform_thesis?'<div style="padding:5px 14px;font-size:11px;color:#555;font-style:italic;border-bottom:1px solid #f0f0f0;">'+p.platform_thesis.substring(0,230)+'</div>':'')
        +'<table style="width:100%;border-collapse:collapse;">'+thRow(['Date','Company Acquired','Segment','Type','Revenue','M&A Advisor','Description'])+rows+'</table></div>';
    }).join('');
  } else {
    peSect='<p style="color:#888;font-size:13px;padding:12px;background:#f9f9f9;border-radius:6px;">No PE deals in database yet.</p>';
  }

  var stratSect='';
  if(strat.length>0){
    stratSect='<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:28px;">STRATEGIC BUYERS</h2>'
      +'<table style="width:100%;border-collapse:collapse;">'+thRow(['Date','Target','Buyer','Segment','Type','Revenue','M&A Advisor'])
      +strat.map(function(t){return'<tr style="border-bottom:1px solid #eee;">'
        +cell(t.date_announced)+boldCell(t.target)+cell(t.buyer)+cell(t.market_segment)+cell(t.deal_type)
        +(t.revenue_disclosed?'<td style="padding:5px 8px;font-size:11px;">'+t.revenue_disclosed+'</td>':'<td>—</td>')
        +arrCell(t.banking_advisors)+'</tr>';}).join('')+'</table>';
  }

  var stats=[['Total Deals',total],['PE-Backed',pe.length],['Strategic',strat.length],['New Since Last Report',newTxns.length],['PE Firms Tracked',Object.keys(pl).length]];
  return'<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1f2937;margin:0;background:#f9fafb;}table{border-collapse:collapse;width:100%;}</style></head><body>'
    +'<div style="max-width:1000px;margin:0 auto;background:#fff;">'
    +'<div style="background:#1A4C3D;padding:22px 30px;">'
    +'<div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">CATSKILL PARTNERS</div>'
    +'<div style="font-size:11px;color:#41AC48;letter-spacing:2px;margin-top:3px;">MORGAN COLE &middot; VP OF MARKETING</div>'
    +'<div style="color:#a8d5b5;font-size:11px;margin-top:6px;">'+now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'</div>'
    +'</div>'
    +'<div style="padding:18px 30px;border-bottom:2px solid #1A4C3D;">'
    +'<h1 style="margin:0;font-size:20px;color:#1A4C3D;">LMM Industrial M&A Transaction Intelligence</h1>'
    +'<p style="margin:6px 0 0;color:#666;font-size:12px;">Cumulative database: '+total+' deals &middot; Covers '+covFrom+' to present &middot; Last scan: '+lastScan+'</p>'
    +'</div>'
    +'<div style="padding:18px 30px;">'
    +'<div style="display:flex;gap:10px;margin-bottom:16px;">'
    +stats.map(function(sv){return'<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">'
      +'<div style="font-size:22px;font-weight:800;color:#1A4C3D;">'+sv[1]+'</div>'
      +'<div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.04em;">'+sv[0]+'</div></div>';}).join('')
    +'</div>'+newSect
    +'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:20px;">PRIVATE EQUITY BUYERS — Sorted by Acquisition Volume</h2>'
    +peSect+stratSect
    +'<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#999;text-align:center;">'
    +'<strong style="color:#1A4C3D;">CATSKILL PARTNERS LP</strong> &middot; CLARITY. CRAFT. CAPITAL.<br>'
    +'Morgan Cole &middot; VP of Marketing &middot; Auto-sent every Monday 8am CT &middot; <a href="mailto:morgan@catskillpartners.com" style="color:#1A4C3D;">morgan@catskillpartners.com</a>'
    +'</div></div></div></body></html>';
}

// ── Email ─────────────────────────────────────────────────────────────────────
async function sendEmail(db,newTxns,resendKey){
  var h=buildHTML(db,newTxns);
  var n=newTxns.length,total=db.metadata&&db.metadata.total?db.metadata.total:0;
  var subj='LMM Industrial M&A Intelligence \u2014 '
    +new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
    +' | '+total+' Deals in Database'+(n?' | '+n+' New':' | Weekly Update');
  if(!resendKey)return{status:'no_resend_key',html_length:h.length};
  try{
    var r=await fetch('https://api.resend.com/emails',{method:'POST',
      headers:{'Authorization':'Bearer '+resendKey,'Content-Type':'application/json'},
      body:JSON.stringify({from:'Morgan Cole <morgan@catskillpartners.com>',to:TO,subject:subj,html:h,reply_to:'brian.steel@catskillpartners.com'})});
    var res=await r.json();
    return{status:r.ok?'sent':'error',to:TO,id:res.id,error:res.message||null};
  }catch(e){return{status:'error',error:e.message};}
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();

  var apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey)return res.status(500).json({error:'ANTHROPIC_API_KEY not set'});
  var body={};try{body=req.body||{};}catch(e){}
  var ghToken=process.env.GITHUB_TOKEN||body.github_token||'';
  var resendKey=process.env.RESEND_API_KEY||body.resend_key||'';
  var action=body.action||(req.method==='GET'?'get':'weekly_scan');

  try{
    // GET current DB
    if(action==='get'){
      var L=await loadDB(ghToken);
      return res.status(200).json({success:true,db:L.db,sorted:sortedTxns(L.db),
        resendPresent:!!resendKey,ghPresent:!!ghToken,apiKeyPresent:!!apiKey});
    }

    // SCAN_PERIOD — scan ONE period, return deals (no email, no save — browser handles that)
    if(action==='scan_period'){
      var period=body.period||'last 10 days';
      var deals=await scanOnePeriod(period,apiKey);
      return res.status(200).json({success:true,period:period,count:deals.length,deals:deals});
    }

    // SAVE_AND_EMAIL — browser passes all deals, server saves to GitHub and emails
    if(action==='save_and_email'){
      var newDeals=body.deals||[];
      var isInitial=body.is_initial||false;
      var LD=await loadDB(ghToken);var sha=LD.sha;var db=LD.db;
      var existing=new Set((db.transactions||[]).map(function(t){return t.id;}));
      var fresh=newDeals.filter(function(t){return t&&t.id&&!existing.has(t.id);});
      fresh.forEach(function(t){t.date_added=new Date().toISOString().split('T')[0];});
      if(!db.transactions)db.transactions=[];
      db.transactions=db.transactions.concat(fresh);
      db.metadata=db.metadata||{};
      db.metadata.last_scan=new Date().toISOString();
      db.metadata.total=db.transactions.length;
      buildPlatforms(db);
      var newSha=null;
      if(ghToken)newSha=await saveDB(db,sha,(isInitial?'Inaugural':'Weekly')+' scan: +'+fresh.length+' deals (total: '+db.metadata.total+')',ghToken);
      var emailResult=await sendEmail(db,fresh,resendKey);
      return res.status(200).json({success:true,added:fresh.length,total:db.metadata.total,
        emailResult:emailResult,dbSha:newSha,resendPresent:!!resendKey});
    }

    // WEEKLY_SCAN — cron-triggered: scan last 14 days server-side
    if(action==='weekly_scan'){
      var wDeals=await scanOnePeriod('the past 14 days ending '+new Date().toISOString().split('T')[0],apiKey);
      var wLD=await loadDB(ghToken);var wSha=wLD.sha;var wDb=wLD.db;
      var wExisting=new Set((wDb.transactions||[]).map(function(t){return t.id;}));
      var wFresh=wDeals.filter(function(t){return t&&t.id&&!wExisting.has(t.id);});
      wFresh.forEach(function(t){t.date_added=new Date().toISOString().split('T')[0];});
      if(!wDb.transactions)wDb.transactions=[];
      wDb.transactions=wDb.transactions.concat(wFresh);
      wDb.metadata=wDb.metadata||{};wDb.metadata.last_scan=new Date().toISOString();wDb.metadata.total=wDb.transactions.length;
      buildPlatforms(wDb);
      var wNewSha=null;
      if(ghToken)wNewSha=await saveDB(wDb,wSha,'Weekly scan: +'+wFresh.length+' deals (total: '+wDb.metadata.total+')',ghToken);
      var wEmail=await sendEmail(wDb,wFresh,resendKey);
      return res.status(200).json({success:true,added:wFresh.length,total:wDb.metadata.total,emailResult:wEmail,dbSha:wNewSha});
    }

    // GET_HTML
    if(action==='get_html'){
      var lh=await loadDB(ghToken);
      return res.status(200).json({success:true,html:buildHTML(lh.db,[])});
    }

    return res.status(400).json({error:'Unknown action: '+action+'. Valid: get, scan_period, save_and_email, weekly_scan, get_html'});
  }catch(e){
    return res.status(500).json({error:e.message,detail:e.stack&&e.stack.substring(0,300)});
  }
};