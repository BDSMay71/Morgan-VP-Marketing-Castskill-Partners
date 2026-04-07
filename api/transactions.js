// Morgan Cole - LMM Industrial M&A Transaction Intelligence v3
// Cumulative GitHub DB + Monday 8am auto-send + body-param fallback
'use strict';
var REPO='BDSMay71/Morgan-VP-Marketing-Castskill-Partners';
var DB_PATH='api/transaction_db.json';
var TO=['brian.steel@catskillpartners.com','mike.fuller@catskillpartners.com'];
function cell(v){return '<td style="padding:5px 8px;font-size:11px;vertical-align:top;">'+(v||'-')+'</td>';}
function boldCell(v){return '<td style="padding:5px 8px;font-size:12px;font-weight:600;color:#1A4C3D;">'+(v||'-')+'</td>';}
function arrCell(a){return cell(Array.isArray(a)?a.join(', '):(a||''));}
function thRow(cols){return '<tr>'+cols.map(function(c){return '<th style="background:#1A4C3D;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;">'+c+'</th>';}).join('')+'</tr>';}
function emptyDB(){var d=new Date();d.setMonth(d.getMonth()-18);return{metadata:{created:new Date().toISOString(),last_scan:null,last_email:null,total:0,covered_from:d.toISOString().split('T')[0],version:'3.0'},transactions:[],pe_platforms:{}};}
async function loadDB(gh){
  if(!gh)return{sha:null,db:emptyDB()};
  try{
    var r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json'}});
    if(!r.ok)return{sha:null,db:emptyDB()};
    var data=await r.json();var s=atob(data.content.replace(/\n/g,''));
    var u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
    var db=JSON.parse(new TextDecoder().decode(u));
    if(!db.transactions)db.transactions=[];if(!db.pe_platforms)db.pe_platforms={};if(!db.metadata)db.metadata=emptyDB().metadata;
    return{sha:data.sha,db:db};
  }catch(e){console.error('loadDB:',e.message);return{sha:null,db:emptyDB()};}
}
async function saveDB(db,sha,msg,gh){
  if(!gh)return null;
  try{
    var body=JSON.stringify(db,null,2);var enc2=btoa(unescape(encodeURIComponent(body)));
    var payload={message:msg,content:enc2};if(sha)payload.sha=sha;
    var r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{method:'PUT',headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(payload)});
    var res=await r.json();return res.commit&&res.commit.sha?res.commit.sha.slice(0,10):null;
  }catch(e){return null;}
}
var SCAN_SYS='You are Morgan Cole, VP Marketing at Catskill Partners LP. Search press releases for REAL lower middle market industrial M&A deals ($10M-$150M revenue). Sectors: Advanced Manufacturing, Engineered Materials, Precision Components, ICT Data Center, Industrial Services. Return JSON array with: id,date_announced,buyer,buyer_type,pe_firm,seller,target,market_segment,deal_type,revenue_disclosed,banking_advisors,legal_buyer,legal_seller,description,platform_context,source,catskill_relevance. Return [] if none.';
async function scanPeriod(period,apiKey){
  var today=new Date().toISOString().split('T')[0];
  var prompt='Find real LMM industrial M&A deals in '+period+'. Search: "lower middle market" manufacturing acquisition '+period+', precision components PE buyout '+period+', engineered materials acquired '+period+', advanced manufacturing private equity '+period+'. Sources: prnewswire.com businesswire.com globenewswire.com middlemarketgrowth.org acg.org. Return JSON array. Today:'+today;
  try{
    var bd={model:'claude-sonnet-4-20250514',max_tokens:3000,system:SCAN_SYS,messages:[{role:'user',content:prompt}],tools:[{type:'web_search_20250305',name:'web_search'}]};
    var r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify(bd),signal:AbortSignal.timeout(55000)});
    if(!r.ok)throw new Error('Claude '+r.status);
    var d=await r.json();var txt=(d.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
    var m=txt.match(/\[[\s\S]*\]/);if(!m)return[];
    var arr=JSON.parse(m[0]);
    return Array.isArray(arr)?arr.filter(function(t){return t&&t.target&&t.buyer&&t.buyer_type;}):[]; 
  }catch(e){console.error('scan '+period+':',e.message);return[];}
}
function buildPlatforms(db){
  db.pe_platforms={};
  var peTxns=(db.transactions||[]).filter(function(t){return t.buyer_type==='PE';});
  for(var i=0;i<peTxns.length;i++){
    var t=peTxns[i];var k=t.pe_firm||t.buyer;if(!k)continue;
    if(!db.pe_platforms[k])db.pe_platforms[k]={firm_name:k,platform_thesis:'',target_segments:[],deal_count:0,acquisitions:[]};
    var p=db.pe_platforms[k];
    if(!p.acquisitions.includes(t.id)){p.acquisitions.push(t.id);p.deal_count++;}
    if(t.market_segment&&!p.target_segments.includes(t.market_segment))p.target_segments.push(t.market_segment);
    if((t.platform_context||'').length>(p.platform_thesis||'').length)p.platform_thesis=t.platform_context;
  }
}
function sortedTxns(db){return[].concat(db.transactions||[]).sort(function(a,b){if(a.buyer_type!==b.buyer_type)return a.buyer_type==='PE'?-1:1;var ak=(a.pe_firm||a.buyer||'').toLowerCase(),bk=(b.pe_firm||b.buyer||'').toLowerCase();if(ak!==bk)return ak<bk?-1:1;return(b.date_announced||'')>(a.date_announced||'')?1:-1;});}
function buildHTML(db,newTxns){
  var now=new Date();var s=sortedTxns(db);var pe=s.filter(function(t){return t.buyer_type==='PE';});var strat=s.filter(function(t){return t.buyer_type!=='PE';});var pl=db.pe_platforms||{};
  var total=db.metadata&&db.metadata.total?db.metadata.total:0;var covFrom=db.metadata&&db.metadata.covered_from?db.metadata.covered_from:'2024-10-01';var lastScan=db.metadata&&db.metadata.last_scan?new Date(db.metadata.last_scan).toLocaleString():'never';
  var newSect='';
  if(newTxns.length>0){var cards=newTxns.map(function(t){return'<div style="margin-bottom:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid #c6e8d0;"><strong style="color:#1A4C3D;">'+t.target+'</strong> <span style="color:#888;font-size:11px;">'+t.date_announced+'</span><br><span style="font-size:12px;"><b>'+(t.pe_firm||t.buyer)+'</b> ('+t.buyer_type+') &middot; '+t.market_segment+' &middot; '+t.deal_type+'</span><br><span style="font-size:11px;color:#555;">'+(t.description||'').substring(0,160)+'</span>'+(t.platform_context?'<br><em style="font-size:10px;color:#1A4C3D;">Platform: '+t.platform_context.substring(0,130)+'</em>':'')+(t.banking_advisors&&t.banking_advisors.length?'<br><span style="font-size:10px;color:#777;">Advisor: '+t.banking_advisors.join(', ')+'</span>':'')+'</div>';}).join('');newSect='<div style="background:#EDF7F2;border-left:4px solid #41AC48;padding:14px;margin:16px 0;border-radius:4px;"><h3 style="color:#1A4C3D;margin:0 0 10px;">NEW THIS WEEK: '+newTxns.length+' Deal'+(newTxns.length>1?'s':'')+'</h3>'+cards+'</div>';}
  var peSect=Object.entries(pl).sort(function(a,b){return b[1].deal_count-a[1].deal_count;}).slice(0,30).map(function(entry){var firm=entry[0],p=entry[1];var rows=pe.filter(function(t){return(t.pe_firm||t.buyer)===firm;}).map(function(t){return'<tr style="border-bottom:1px solid #f5f5f5;">'+cell(t.date_announced)+boldCell(t.target)+cell(t.market_segment)+cell(t.deal_type)+arrCell(t.banking_advisors)+arrCell(t.legal_buyer)+'</tr>';}).join('');return'<div style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><div style="background:#EDF7F2;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;"><strong style="color:#1A4C3D;">'+firm+'</strong><span style="font-size:11px;color:#666;">'+p.deal_count+' deal'+(p.deal_count>1?'s':'')+' &middot; '+p.target_segments.join(' / ')+'</span></div>'+(p.platform_thesis?'<div style="padding:5px 14px;font-size:11px;color:#555;font-style:italic;border-bottom:1px solid #f0f0f0;">'+p.platform_thesis.substring(0,220)+'</div>':'')+'<table style="width:100%;border-collapse:collapse;">'+thRow(['Date','Company Acquired','Segment','Type','M&A Advisor','Legal (Buyer)'])+rows+'</table></div>';}).join('');
  var stratSect='';if(strat.length>0){var stratRows=strat.map(function(t){return'<tr style="border-bottom:1px solid #eee;">'+cell(t.date_announced)+boldCell(t.target)+cell(t.buyer)+cell(t.market_segment)+cell(t.deal_type)+arrCell(t.banking_advisors)+'<td style="padding:5px 8px;font-size:11px;color:#666;">'+(t.description||'').substring(0,100)+'</td></tr>';}).join('');stratSect='<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:28px;">STRATEGIC BUYERS</h2><table style="width:100%;border-collapse:collapse;">'+thRow(['Date','Target','Buyer','Segment','Type','M&A Advisor','Description'])+stratRows+'</table>';}
  var stats=[['Total Deals',total],['PE-Backed',pe.length],['Strategic',strat.length],['New This Week',newTxns.length],['PE Firms',Object.keys(pl).length]];var statBoxes=stats.map(function(sv){return'<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#1A4C3D;">'+sv[1]+'</div><div style="font-size:10px;color:#666;text-transform:uppercase;">'+sv[0]+'</div></div>';}).join('');
  return'<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1f2937;margin:0;background:#f9fafb;}table{border-collapse:collapse;width:100%;}</style></head><body><div style="max-width:980px;margin:0 auto;background:#fff;"><div style="background:#1A4C3D;padding:22px 30px;"><div style="font-size:21px;font-weight:800;color:#fff;">CATSKILL PARTNERS</div><div style="font-size:11px;color:#41AC48;letter-spacing:2px;margin-top:3px;">MORGAN COLE &middot; VP OF MARKETING</div><div style="color:#a8d5b5;font-size:11px;margin-top:6px;">'+now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'</div></div><div style="padding:18px 30px;border-bottom:2px solid #1A4C3D;"><h1 style="margin:0;font-size:20px;color:#1A4C3D;">LMM Industrial M&A Transaction Intelligence</h1><p style="margin:6px 0 0;color:#666;font-size:12px;">Cumulative database: '+total+' deals &middot; Covers '+covFrom+' to present &middot; Last scan: '+lastScan+'</p></div><div style="padding:18px 30px;"><div style="display:flex;gap:10px;margin-bottom:16px;">'+statBoxes+'</div>'+newSect+'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:20px;">PRIVATE EQUITY BUYERS</h2>'+peSect+stratSect+'<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#999;text-align:center;"><strong style="color:#1A4C3D;">CATSKILL PARTNERS LP</strong> &middot; CLARITY. CRAFT. CAPITAL.<br>Morgan Cole &middot; Auto-sent every Monday 8am CT</div></div></div></body></html>';
}
async function sendEmail(db,newTxns,resendKey){
  var h=buildHTML(db,newTxns);var n=newTxns.length;var total=db.metadata&&db.metadata.total?db.metadata.total:0;
  var subj='LMM Industrial M&A Intelligence — '+new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' | '+total+' Deals'+(n>0?' | '+n+' New This Week':'');
  if(!resendKey)return{status:'no_resend_key',html_length:h.length};
  try{
    var r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+resendKey,'Content-Type':'application/json'},body:JSON.stringify({from:'Morgan Cole <onboarding@resend.dev>',to:TO,subject:subj,html:h,reply_to:'brian.steel@catskillpartners.com'})});
    var res=await r.json();return{status:r.ok?'sent':'error',to:TO,id:res.id,error:res.message||null};
  }catch(e){return{status:'error',error:e.message};}
}
module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  var apiKey=process.env.ANTHROPIC_API_KEY;if(!apiKey)return res.status(500).json({error:'ANTHROPIC_API_KEY not set'});
  var body={};try{body=req.body||{};}catch(e){}
  var ghToken=process.env.GITHUB_TOKEN||body.github_token||'';
  var resendKey=process.env.RESEND_API_KEY||body.resend_key||'';
  var action=body.action||(req.method==='GET'?'get':'weekly_scan');
  console.log('[tx] action='+action+' gh='+!!ghToken+' resend='+!!resendKey+' envR='+!!process.env.RESEND_API_KEY);
  try{
    if(action==='get'){var L=await loadDB(ghToken);return res.status(200).json({success:true,db:L.db,sorted:sortedTxns(L.db),resendPresent:!!resendKey,envResend:!!process.env.RESEND_API_KEY});}
    if(action==='weekly_scan'||action==='initial_scan'){
      var isInit=action==='initial_scan';
      var periods=isInit?['October through December 2024','January through March 2025','April through June 2025','July through September 2025','October through December 2025','January through April 2026']:['last 10 days'];
      var LD=await loadDB(ghToken);var sha=LD.sha;var db=LD.db;
      var existing=new Set((db.transactions||[]).map(function(t){return t.id;}));
      console.log('[tx] Loaded '+existing.size+' existing deals');
      var allNew=[];
      for(var i=0;i<periods.length;i++){
        var period=periods[i];console.log('[tx] Scanning: '+period);
        var txns=await scanPeriod(period,apiKey);
        var fresh=txns.filter(function(t){return t&&t.id&&t.target&&t.buyer&&!existing.has(t.id);});
        fresh.forEach(function(t){t.date_added=new Date().toISOString().split('T')[0];existing.add(t.id);});
        allNew=allNew.concat(fresh);if(!db.transactions)db.transactions=[];db.transactions=db.transactions.concat(fresh);
        console.log('[tx] '+period+': +'+fresh.length+' new (total:'+db.transactions.length+')');
      }
      db.metadata=db.metadata||{};db.metadata.last_scan=new Date().toISOString();db.metadata.total=db.transactions.length;
      buildPlatforms(db);
      var newSha=null;if(ghToken){newSha=await saveDB(db,sha,(isInit?'Initial':'Weekly')+' scan +'+allNew.length+' deals (cumulative:'+db.metadata.total+')',ghToken);console.log('[tx] Saved sha:'+newSha);}
      var emailResult=await sendEmail(db,allNew,resendKey);console.log('[tx] Email:'+JSON.stringify(emailResult));
      return res.status(200).json({success:true,added:allNew.length,total:db.metadata.total,periods_scanned:periods.length,emailResult:emailResult,dbSha:newSha,resendPresent:!!resendKey,envResend:!!process.env.RESEND_API_KEY});
    }
    if(action==='send_email'){
      var LS=await loadDB(ghToken);var dbs=LS.db;var cutoff=new Date();cutoff.setDate(cutoff.getDate()-7);
      var recent=(dbs.transactions||[]).filter(function(t){try{return new Date(t.date_added||t.date_announced||0)>cutoff;}catch(e){return false;}});
      var result=await sendEmail(dbs,recent,resendKey);
      return res.status(200).json({success:true,emailResult:result,total:dbs.metadata&&dbs.metadata.total,resendPresent:!!resendKey,envResend:!!process.env.RESEND_API_KEY});
    }
    if(action==='get_html'){var LH=await loadDB(ghToken);return res.status(200).json({success:true,html:buildHTML(LH.db,[])});}
    return res.status(400).json({error:'Unknown action: '+action});
  }catch(e){console.error('[tx] Error:',e.message);return res.status(500).json({error:e.message,detail:e.stack&&e.stack.substring(0,400)});}
};