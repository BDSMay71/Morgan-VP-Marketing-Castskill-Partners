// Morgan Cole – LMM Industrial M&A Transaction Intelligence v5
// Firm-based search strategy — searches known active PE firms for real deal press releases
'use strict';
var REPO='BDSMay71/Morgan-VP-Marketing-Castskill-Partners';
var DB_PATH='api/transaction_db.json';
var TO=['brian.steel@catskillpartners.com','mike.fuller@catskillpartners.com'];

// Known active LMM industrial PE firms — grouped into 6 batches for parallel scanning
var FIRM_BATCHES=[
  // Batch 0: Riverside, Pfingsten, Shore Capital
  ['The Riverside Company','Pfingsten Partners','Shore Capital Partners'],
  // Batch 1: Sterling, Align Capital, Audax
  ['Sterling Group','Align Capital Partners','Audax Private Equity'],
  // Batch 2: Graham Partners, Arsenal Capital, Industrial Opportunity Partners
  ['Graham Partners','Arsenal Capital Partners','Industrial Opportunity Partners','Tonka Bay Equity'],
  // Batch 3: Monomoy, Stellex, Graycliff, Bertram
  ['Monomoy Capital Partners','Stellex Capital Management','Graycliff Partners','Bertram Capital'],
  // Batch 4: H.I.G., Kingswood, Linx, Blue Water Capital
  ['HIG Capital','Kingswood Capital Management','Linx Partners','Gentherm Capital'],
  // Batch 5: recent all-market sweep — broader search to catch any missed deals
  ['RECENT_SWEEP']
];

function cell(v){return '<td style="padding:5px 8px;font-size:11px;vertical-align:top;">'+(v||'-')+'</td>';}
function boldCell(v){return '<td style="padding:5px 8px;font-size:12px;font-weight:600;color:#1A4C3D;vertical-align:top;">'+(v||'-')+'</td>';}
function arrCell(a){return cell(Array.isArray(a)?a.filter(Boolean).join(', '):(a||''));}
function thRow(cols){return '<tr>'+cols.map(function(c){return '<th style="background:#1A4C3D;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;">'+c+'</th>';}).join('')+'</tr>';}

function emptyDB(){
  var d=new Date();d.setMonth(d.getMonth()-18);
  return{metadata:{created:new Date().toISOString(),last_scan:null,last_email:null,total:0,covered_from:d.toISOString().split('T')[0],version:'5.0'},transactions:[],pe_platforms:{}};
}

async function loadDB(gh){
  if(!gh)return{sha:null,db:emptyDB()};
  try{
    var r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json'}});
    if(!r.ok)return{sha:null,db:emptyDB()};
    var data=await r.json();
    var s=atob(data.content.replace(/\n/g,''));
    var u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
    var db=JSON.parse(new TextDecoder().decode(u));
    if(!db.transactions)db.transactions=[];
    if(!db.pe_platforms)db.pe_platforms={};
    if(!db.metadata)db.metadata=emptyDB().metadata;
    return{sha:data.sha,db:db};
  }catch(e){console.error('loadDB:',e.message);return{sha:null,db:emptyDB()};}
}

async function saveDB(db,sha,msg,gh){
  if(!gh)return null;
  try{
    var enc=btoa(unescape(encodeURIComponent(JSON.stringify(db,null,2))));
    var payload={message:msg,content:enc};if(sha)payload.sha=sha;
    var r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{method:'PUT',
      headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},
      body:JSON.stringify(payload)});
    var res=await r.json();
    return res.commit&&res.commit.sha?res.commit.sha.slice(0,10):null;
  }catch(e){return null;}
}

function makeId(buyer,target,date){
  var b=(buyer||'unknown').toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,20);
  var t=(target||'unknown').toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,20);
  var d=(date||new Date().toISOString()).slice(0,7).replace('-','');
  return b+'-'+t+'-'+d;
}

async function scanFirms(firms,apiKey){
  var today=new Date().toISOString().split('T')[0];
  var prompt;

  if(firms[0]==='RECENT_SWEEP'){
    // Broad recent sweep for last 2 weeks (used for weekly scan and batch 5)
    prompt='Search for lower middle market industrial M&A deals announced in the past 14 days. '
      +'Search: site:businesswire.com "acquired" "manufacturer" 2026, '
      +'site:prnewswire.com "private equity" "industrial" "acquisition" 2026, '
      +'"lower middle market" manufacturer acquired April 2026. '
      +'Also search: Axial network deal announcements, ACG deal news April 2026. '
      +'Extract every real acquisition announcement you find where a manufacturer or industrial company was acquired. '
      +'Return as JSON array.';
  } else {
    // Firm-specific search — MUCH more productive
    var firmList=firms.join(', ');
    prompt='Search for acquisitions made by these private equity firms between October 2024 and April 2026: '+firmList+'. '
      +'For each firm, search: "[firm name] acquires" OR "[firm name] acquired" OR "[firm name] acquisition" 2024 2025 2026. '
      +'Focus on manufacturing, industrial, engineered components, precision machining, specialty materials, '
      +'data center supply chain, and industrial services companies. '
      +'Check businesswire.com, prnewswire.com, and each firm\'s own press release pages. '
      +'Be thorough — these are ACTIVE acquirers and WILL have deals in this period. '
      +'For each deal found, extract the target company name, what they make, the buyer PE firm, approximate deal date, '
      +'M&A advisors if mentioned, and a 2-sentence description. '
      +'Return as JSON array.';
  }

  var fullPrompt=prompt+'\n\n'
    +'Return a JSON array where each item has these fields: '
    +'{id,date_announced,buyer,buyer_type,pe_firm,seller,target,market_segment,deal_type,'
    +'revenue_disclosed,banking_advisors,legal_buyer,legal_seller,description,platform_context,source,catskill_relevance}\n'
    +'buyer_type: "PE" or "Strategic". '
    +'market_segment: one of: Advanced Manufacturing, Engineered Materials, Precision Components, ICT Data Center, Industrial Services, Other Industrial. '
    +'deal_type: Platform, Add-on, Recapitalization, or Sale. '
    +'id: use format buyer-target-YYYYMM (all lowercase, hyphens). '
    +'catskill_relevance: high, medium, or low based on fit with advanced manufacturing / engineered components / ICT supply chain. '
    +'IMPORTANT: Include ALL deals you find, even if some details are missing — a partial record is better than no record. '
    +'If id is missing, generate one from buyer+target+date. '
    +'Today is '+today+'. Only return deals from October 2024 to present.';

  try{
    var body={model:'claude-sonnet-4-20250514',max_tokens:4000,
      messages:[{role:'user',content:fullPrompt}],
      tools:[{type:'web_search_20250305',name:'web_search'}]};
    var r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
    if(!r.ok){console.error('Claude HTTP '+r.status);return[];}
    var d=await r.json();
    var txt=(d.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('\n');
    console.log('[tx] firms='+firms.join(',')+' response_len='+txt.length);
    // Find JSON array — be permissive
    var m=txt.match(/\[[\s\S]*\]/);
    if(!m){console.log('[tx] No JSON array in response for firms: '+firms.join(','));return[];}
    var arr;try{arr=JSON.parse(m[0]);}catch(e){console.error('[tx] JSON parse error:',e.message);return[];}
    if(!Array.isArray(arr))return[];
    // Normalize — ensure every record has an id and required fields
    return arr.map(function(t){
      if(!t||typeof t!=='object')return null;
      if(!t.target||!t.buyer)return null;
      if(!t.id)t.id=makeId(t.pe_firm||t.buyer,t.target,t.date_announced);
      if(!t.buyer_type)t.buyer_type='PE';
      if(!t.deal_type)t.deal_type='Platform';
      if(!t.market_segment)t.market_segment='Advanced Manufacturing';
      if(!t.catskill_relevance)t.catskill_relevance='medium';
      if(!Array.isArray(t.banking_advisors))t.banking_advisors=t.banking_advisors?[t.banking_advisors]:[];
      if(!Array.isArray(t.legal_buyer))t.legal_buyer=t.legal_buyer?[t.legal_buyer]:[];
      if(!Array.isArray(t.legal_seller))t.legal_seller=t.legal_seller?[t.legal_seller]:[];
      return t;
    }).filter(Boolean);
  }catch(e){console.error('[tx] scanFirms error:',e.message);return[];}
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

function sortedTxns(db){
  return[].concat(db.transactions||[]).sort(function(a,b){
    if(a.buyer_type!==b.buyer_type)return a.buyer_type==='PE'?-1:1;
    var ak=(a.pe_firm||a.buyer||'').toLowerCase(),bk=(b.pe_firm||b.buyer||'').toLowerCase();
    if(ak!==bk)return ak<bk?-1:1;
    return(b.date_announced||'')>(a.date_announced||'')?1:-1;
  });
}

function buildHTML(db,newTxns){
  var now=new Date();
  var s=sortedTxns(db);
  var pe=s.filter(function(t){return t.buyer_type==='PE';});
  var strat=s.filter(function(t){return t.buyer_type!=='PE';});
  var pl=db.pe_platforms||{};
  var total=(db.metadata&&db.metadata.total)||0;
  var covFrom=(db.metadata&&db.metadata.covered_from)||'2024-10-01';
  var lastScan=db.metadata&&db.metadata.last_scan?new Date(db.metadata.last_scan).toLocaleString():'never';

  var newSect='';
  if(newTxns&&newTxns.length>0){
    var cards=newTxns.map(function(t){
      return'<div style="margin-bottom:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid #c6e8d0;">'
        +'<strong style="color:#1A4C3D;font-size:13px;">'+(t.target||'')+'</strong>'
        +' <span style="color:#888;font-size:11px;">'+(t.date_announced||'')+'</span><br>'
        +'<span style="font-size:12px;"><b>'+(t.pe_firm||t.buyer||'')+'</b>'
        +' ('+(t.buyer_type||'PE')+') &middot; '+(t.market_segment||'')+' &middot; '+(t.deal_type||'')+'</span><br>'
        +'<span style="font-size:11px;color:#555;">'+(t.description||'').substring(0,180)+'</span>'
        +(t.platform_context?'<br><em style="font-size:10px;color:#1A4C3D;">Platform: '+t.platform_context.substring(0,140)+'</em>':'')
        +(t.banking_advisors&&t.banking_advisors.length?'<br><span style="font-size:10px;color:#777;">Advisor: '+t.banking_advisors.join(', ')+'</span>':'')
        +'</div>';
    }).join('');
    newSect='<div style="background:#EDF7F2;border-left:4px solid #41AC48;padding:14px;margin:16px 0;border-radius:4px;">'
      +'<h3 style="color:#1A4C3D;margin:0 0 10px;">NEW THIS WEEK: '+newTxns.length+' Deal'+(newTxns.length>1?'s':'')+'</h3>'
      +cards+'</div>';
  }

  var peSect='';
  var firmEntries=Object.entries(pl).sort(function(a,b){return b[1].deal_count-a[1].deal_count;}).slice(0,40);
  if(firmEntries.length>0){
    peSect=firmEntries.map(function(entry){
      var firm=entry[0],p=entry[1];
      var firmDeals=pe.filter(function(t){return(t.pe_firm||t.buyer)===firm;});
      var rows=firmDeals.map(function(t){
        return'<tr style="border-bottom:1px solid #f5f5f5;">'
          +cell(t.date_announced)+boldCell(t.target)+cell(t.market_segment)+cell(t.deal_type)
          +arrCell(t.banking_advisors)+arrCell(t.legal_buyer)
          +'<td style="padding:5px 8px;font-size:11px;color:#555;">'+(t.description||'').substring(0,90)+'</td>'
          +'</tr>';
      }).join('');
      return'<div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
        +'<div style="background:#EDF7F2;padding:9px 14px;display:flex;justify-content:space-between;align-items:center;">'
        +'<strong style="color:#1A4C3D;font-size:13px;">'+firm+'</strong>'
        +'<span style="font-size:11px;color:#666;">'+p.deal_count+' deal'+(p.deal_count>1?'s':'')+' &middot; '+p.target_segments.join(' / ')+'</span>'
        +'</div>'
        +(p.platform_thesis?'<div style="padding:5px 14px;font-size:11px;color:#555;font-style:italic;border-bottom:1px solid #f0f0f0;">'+p.platform_thesis.substring(0,240)+'</div>':'')
        +'<table style="width:100%;border-collapse:collapse;">'
        +thRow(['Date','Company Acquired','Segment','Type','M&A Advisor','Legal (Buyer)','Description'])
        +rows+'</table></div>';
    }).join('');
  } else {
    peSect='<p style="color:#888;padding:16px;background:#f9f9f9;border-radius:6px;">Populating database — check back next Monday for a full deal ledger.</p>';
  }

  var stratSect='';
  if(strat.length>0){
    var stratRows=strat.map(function(t){
      return'<tr style="border-bottom:1px solid #eee;">'
        +cell(t.date_announced)+boldCell(t.target)+cell(t.buyer)+cell(t.market_segment)+cell(t.deal_type)
        +arrCell(t.banking_advisors)
        +'<td style="padding:5px 8px;font-size:11px;color:#555;">'+(t.description||'').substring(0,100)+'</td>'
        +'</tr>';
    }).join('');
    stratSect='<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:28px;">STRATEGIC BUYERS</h2>'
      +'<table style="width:100%;border-collapse:collapse;">'
      +thRow(['Date','Target','Buyer','Segment','Type','M&A Advisor','Description'])
      +stratRows+'</table>';
  }

  var stats=[['Total Deals',total],['PE-Backed',pe.length],['Strategic',strat.length],['New This Week',(newTxns||[]).length],['PE Firms',Object.keys(pl).length]];
  var statBoxes=stats.map(function(sv){
    return'<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">'
      +'<div style="font-size:22px;font-weight:800;color:#1A4C3D;">'+sv[1]+'</div>'
      +'<div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.04em;">'+sv[0]+'</div>'
      +'</div>';
  }).join('');

  return'<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2937;margin:0;background:#f9fafb;}table{border-collapse:collapse;width:100%;}</style>'
    +'</head><body><div style="max-width:1000px;margin:0 auto;background:#fff;">'
    +'<div style="background:#1A4C3D;padding:22px 30px;">'
    +'<div style="font-size:21px;font-weight:800;color:#fff;letter-spacing:-0.5px;">CATSKILL PARTNERS</div>'
    +'<div style="font-size:11px;color:#41AC48;letter-spacing:2px;margin-top:3px;">MORGAN COLE &middot; VP OF MARKETING</div>'
    +'<div style="color:#a8d5b5;font-size:11px;margin-top:6px;">'+now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'</div>'
    +'</div>'
    +'<div style="padding:18px 30px;border-bottom:2px solid #1A4C3D;">'
    +'<h1 style="margin:0;font-size:20px;color:#1A4C3D;">LMM Industrial M&A Transaction Intelligence</h1>'
    +'<p style="margin:6px 0 0;color:#666;font-size:12px;">Cumulative database: '+total+' deals &middot; Covers '+covFrom+' to present &middot; Last scan: '+lastScan+'</p>'
    +'</div>'
    +'<div style="padding:18px 30px;">'
    +'<div style="display:flex;gap:10px;margin-bottom:16px;">'+statBoxes+'</div>'
    +newSect
    +'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:20px;">PRIVATE EQUITY BUYERS &mdash; Sorted by Firm</h2>'
    +peSect+stratSect
    +'<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#999;text-align:center;">'
    +'<strong style="color:#1A4C3D;">CATSKILL PARTNERS LP</strong> &middot; CLARITY. CRAFT. CAPITAL.<br>'
    +'Generated by Morgan Cole &middot; VP of Marketing &middot; Auto-sent every Monday 8am CT'
    +'</div></div></div></body></html>';
}

async function sendEmail(db,newTxns,resendKey){
  var h=buildHTML(db,newTxns);
  var n=(newTxns||[]).length;
  var total=(db.metadata&&db.metadata.total)||0;
  var subj='LMM Industrial M&A Intelligence — '
    +new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
    +' | '+total+' Deals in Database'+(n>0?' | '+n+' New This Week':'');
  if(!resendKey)return{status:'no_resend_key',html_length:h.length};
  try{
    var r=await fetch('https://api.resend.com/emails',{method:'POST',
      headers:{'Authorization':'Bearer '+resendKey,'Content-Type':'application/json'},
      body:JSON.stringify({from:'Morgan Cole <morgan@catskillpartners.com>',to:TO,subject:subj,html:h,reply_to:'brian.steel@catskillpartners.com'})});
    var res=await r.json();
    return{status:r.ok?'sent':'error',to:TO,id:res.id,error:res.message||null};
  }catch(e){return{status:'error',error:e.message};}
}

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

  console.log('[tx] v5 action='+action+' gh='+!!ghToken+' resend='+!!resendKey);

  try{
    if(action==='get'){
      var L=await loadDB(ghToken);
      return res.status(200).json({success:true,db:L.db,sorted:sortedTxns(L.db),resendPresent:!!resendKey,envResend:!!process.env.RESEND_API_KEY});
    }

    if(action==='initial_scan'){
      // Batch-aware: each call scans ONE firm group (~15-25s)
      var batchNum=typeof body.batch==='number'?body.batch:0;
      var firms=FIRM_BATCHES[batchNum]||FIRM_BATCHES[0];
      var isLastBatch=(batchNum>=FIRM_BATCHES.length-1);

      var LD=await loadDB(ghToken);var sha=LD.sha;var db=LD.db;
      var existing=new Set((db.transactions||[]).map(function(t){return t.id;}));
      console.log('[tx] Batch '+batchNum+' firms: '+firms.join(', ')+' | existing: '+existing.size);

      var txns=await scanFirms(firms,apiKey);
      var fresh=txns.filter(function(t){return t&&t.id&&!existing.has(t.id);});
      fresh.forEach(function(t){t.date_added=new Date().toISOString().split('T')[0];existing.add(t.id);});
      if(!db.transactions)db.transactions=[];
      db.transactions=db.transactions.concat(fresh);
      db.metadata=db.metadata||{};
      db.metadata.last_scan=new Date().toISOString();
      db.metadata.total=db.transactions.length;
      buildPlatforms(db);

      var newSha=null;
      if(ghToken)newSha=await saveDB(db,sha,'Batch '+batchNum+' ('+firms.join(',')+') +'+fresh.length+' deals (total:'+db.metadata.total+')',ghToken);
      console.log('[tx] Batch '+batchNum+': +'+fresh.length+' new deals, total='+db.metadata.total);

      // Send email only on last batch
      var emailResult=isLastBatch?await sendEmail(db,fresh,resendKey):{status:'skipped_not_last',batch:batchNum};
      return res.status(200).json({success:true,added:fresh.length,total:db.metadata.total,batch:batchNum,firms:firms,emailResult:emailResult,dbSha:newSha});
    }

    if(action==='weekly_scan'){
      // Weekly: search recent 2 weeks, append new deals, email
      var WL=await loadDB(ghToken);var wSha=WL.sha;var wDb=WL.db;
      var wExisting=new Set((wDb.transactions||[]).map(function(t){return t.id;}));
      console.log('[tx] Weekly scan — existing: '+wExisting.size+' deals');

      var wTxns=await scanFirms(['RECENT_SWEEP'],apiKey);
      var wFresh=wTxns.filter(function(t){return t&&t.id&&!wExisting.has(t.id);});
      wFresh.forEach(function(t){t.date_added=new Date().toISOString().split('T')[0];wExisting.add(t.id);});
      if(!wDb.transactions)wDb.transactions=[];
      wDb.transactions=wDb.transactions.concat(wFresh);
      wDb.metadata=wDb.metadata||{};
      wDb.metadata.last_scan=new Date().toISOString();
      wDb.metadata.total=wDb.transactions.length;
      buildPlatforms(wDb);

      if(ghToken)await saveDB(wDb,wSha,'Weekly scan +'+wFresh.length+' deals (total:'+wDb.metadata.total+')',ghToken);
      var wEmail=await sendEmail(wDb,wFresh,resendKey);
      return res.status(200).json({success:true,added:wFresh.length,total:wDb.metadata.total,emailResult:wEmail});
    }

    if(action==='send_email'){
      var SL=await loadDB(ghToken);var sDb=SL.db;
      var cutoff=new Date();cutoff.setDate(cutoff.getDate()-7);
      var recent=(sDb.transactions||[]).filter(function(t){try{return new Date(t.date_added||t.date_announced||0)>cutoff;}catch(e){return false;}});
      var sRes=await sendEmail(sDb,recent,resendKey);
      return res.status(200).json({success:true,emailResult:sRes,total:sDb.metadata&&sDb.metadata.total});
    }

    if(action==='get_html'){
      var HL=await loadDB(ghToken);
      return res.status(200).json({success:true,html:buildHTML(HL.db,[])});
    }

    return res.status(400).json({error:'Unknown action: '+action+'. Valid: get, initial_scan, weekly_scan, send_email, get_html'});

  }catch(e){
    console.error('[tx] Fatal:',e.message,e.stack&&e.stack.substring(0,300));
    return res.status(500).json({error:e.message,detail:e.stack&&e.stack.substring(0,300)});
  }
};