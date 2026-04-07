// Morgan Cole – LMM Industrial M&A Transaction Intelligence v4
// Cumulative GitHub DB + Monday 8am auto-send + verified domain
'use strict';
var REPO='BDSMay71/Morgan-VP-Marketing-Castskill-Partners';
var DB_PATH='api/transaction_db.json';
var TO=['brian.steel@catskillpartners.com','mike.fuller@catskillpartners.com'];

function cell(v){return '<td style="padding:5px 8px;font-size:11px;vertical-align:top;">'+(v||'-')+'</td>';}
function boldCell(v){return '<td style="padding:5px 8px;font-size:12px;font-weight:600;color:#1A4C3D;vertical-align:top;">'+(v||'-')+'</td>';}
function arrCell(a){return cell(Array.isArray(a)?a.filter(Boolean).join(', '):(a||''));}
function thRow(cols){return '<tr>'+cols.map(function(c){return '<th style="background:#1A4C3D;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;">'+c+'</th>';}).join('')+'</tr>';}

function emptyDB(){
  var d=new Date();d.setMonth(d.getMonth()-18);
  return{metadata:{created:new Date().toISOString(),last_scan:null,last_email:null,total:0,covered_from:d.toISOString().split('T')[0],version:'4.0'},transactions:[],pe_platforms:{}};
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
    var r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DB_PATH,{method:'PUT',headers:{'Authorization':'token '+gh,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(payload)});
    var res=await r.json();
    return res.commit&&res.commit.sha?res.commit.sha.slice(0,10):null;
  }catch(e){return null;}
}

// IMPROVED SEARCH — specific named queries that return real results
async function scanPeriod(period,apiKey){
  var today=new Date().toISOString().split('T')[0];

  // Each prompt targets a specific search that Claude's web_search can actually retrieve
  var prompt='You are a PE deal researcher. Use web_search to find REAL announced M&A transactions from '+period+'. '
    +'Run these specific searches one at a time and report what you find:\n'
    +'1. Search: site:businesswire.com OR site:prnewswire.com "acquired" "manufacturer" '+period+'\n'
    +'2. Search: "private equity" "acquired" "manufacturing" "million" '+period+'\n'
    +'3. Search: ACG "deal" "manufacturing" "acquired" '+period+'\n'
    +'4. Search: "lower middle market" "acquired" "industrial" '+period+'\n'
    +'5. Search: "precision machining" OR "CNC" OR "metal fabrication" "acquired" OR "acquisition" '+period+'\n'
    +'6. Search: "engineered components" OR "specialty chemicals" OR "seals" OR "gaskets" "private equity" "acquired" '+period+'\n'
    +'7. Search: "data center" OR "power distribution" OR "cooling" "manufacturer" "acquired" '+period+'\n'
    +'For each REAL deal you find, extract: company acquired, buyer name, whether buyer is PE or Strategic, '
    +'PE fund name if applicable, brief description of what company makes, deal type (Platform/Add-on/Sale), '
    +'M&A advisors mentioned, approximate revenue if disclosed.\n'
    +'Return a JSON array. Each object: {id,date_announced,buyer,buyer_type,pe_firm,seller,target,'
    +'market_segment,deal_type,revenue_disclosed,banking_advisors,legal_buyer,legal_seller,description,platform_context,source,catskill_relevance}\n'
    +'id format: buyer-target-YYYYMM (lowercase, hyphens). buyer_type: "PE" or "Strategic". '
    +'market_segment: one of: Advanced Manufacturing, Engineered Materials, Precision Components, ICT Data Center, Industrial Services, Other Industrial.\n'
    +'IMPORTANT: Only include REAL announced deals you found via web search. Return [] if you found nothing concrete.\n'
    +'Today is '+today;

  try{
    var body={model:'claude-sonnet-4-20250514',max_tokens:4000,messages:[{role:'user',content:prompt}],tools:[{type:'web_search_20250305',name:'web_search'}]};
    var r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
    if(!r.ok){console.error('Claude HTTP error '+r.status);return[];}
    var d=await r.json();
    var txt=(d.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('\n');
    console.log('[tx] Period '+period+' response length:'+txt.length);
    var m=txt.match(/\[[\s\S]*\]/);
    if(!m){console.log('[tx] No JSON array found for period: '+period);return[];}
    var arr=JSON.parse(m[0]);
    var valid=Array.isArray(arr)?arr.filter(function(t){return t&&t.target&&t.buyer&&t.buyer_type&&t.id;}):[]; 
    console.log('[tx] '+period+': found '+valid.length+' valid deals');
    return valid;
  }catch(e){console.error('[tx] scanPeriod error '+period+':',e.message);return[];}
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
  var total=db.metadata&&db.metadata.total?db.metadata.total:0;
  var covFrom=db.metadata&&db.metadata.covered_from?db.metadata.covered_from:'2024-10-01';
  var lastScan=db.metadata&&db.metadata.last_scan?new Date(db.metadata.last_scan).toLocaleString():'never';

  var newSect='';
  if(newTxns.length>0){
    var cards=newTxns.map(function(t){
      return '<div style="margin-bottom:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid #c6e8d0;">'
        +'<strong style="color:#1A4C3D;font-size:13px;">'+(t.target||'')+'</strong>'
        +' <span style="color:#888;font-size:11px;">'+(t.date_announced||'')+'</span><br>'
        +'<span style="font-size:12px;"><b>'+(t.pe_firm||t.buyer||'')+'</b>'
        +' ('+(t.buyer_type||'')+') &middot; '+(t.market_segment||'')+' &middot; '+(t.deal_type||'')+'</span><br>'
        +'<span style="font-size:11px;color:#555;">'+(t.description||'').substring(0,160)+'</span>'
        +(t.platform_context?'<br><em style="font-size:10px;color:#1A4C3D;">Platform: '+t.platform_context.substring(0,130)+'</em>':'')
        +(t.banking_advisors&&t.banking_advisors.length?'<br><span style="font-size:10px;color:#777;">Advisor: '+t.banking_advisors.join(', ')+'</span>':'')
        +'<br><span style="font-size:10px;color:#999;">Source: '+(t.source||'')+'</span>'
        +'</div>';
    }).join('');
    newSect='<div style="background:#EDF7F2;border-left:4px solid #41AC48;padding:14px;margin:16px 0;border-radius:4px;">'
      +'<h3 style="color:#1A4C3D;margin:0 0 10px;">NEW THIS WEEK: '+newTxns.length+' Deal'+(newTxns.length>1?'s':'')+'</h3>'
      +cards+'</div>';
  }

  var peSect='';
  if(pe.length>0){
    peSect=Object.entries(pl).sort(function(a,b){return b[1].deal_count-a[1].deal_count;}).slice(0,30).map(function(entry){
      var firm=entry[0],p=entry[1];
      var firmDeals=pe.filter(function(t){return(t.pe_firm||t.buyer)===firm;});
      var rows=firmDeals.map(function(t){
        return'<tr style="border-bottom:1px solid #f5f5f5;">'
          +cell(t.date_announced)+boldCell(t.target)+cell(t.market_segment)+cell(t.deal_type)
          +arrCell(t.banking_advisors)+arrCell(t.legal_buyer)
          +'<td style="padding:5px 8px;font-size:11px;color:#555;">'+(t.description||'').substring(0,80)+'</td>'
          +'</tr>';
      }).join('');
      return'<div style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
        +'<div style="background:#EDF7F2;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;">'
        +'<strong style="color:#1A4C3D;font-size:13px;">'+firm+'</strong>'
        +'<span style="font-size:11px;color:#666;">'+p.deal_count+' deal'+(p.deal_count>1?'s':'')+' &middot; '+p.target_segments.join(' / ')+'</span>'
        +'</div>'
        +(p.platform_thesis?'<div style="padding:5px 14px;font-size:11px;color:#555;font-style:italic;border-bottom:1px solid #f0f0f0;">'+p.platform_thesis.substring(0,220)+'</div>':'')
        +'<table style="width:100%;border-collapse:collapse;">'
        +thRow(['Date','Company Acquired','Segment','Type','M&A Advisor','Legal (Buyer)','Description'])
        +rows+'</table></div>';
    }).join('');
  } else {
    peSect='<p style="color:#666;font-size:13px;padding:16px;background:#f9f9f9;border-radius:6px;">No PE-backed deals in database yet. Run initial_scan to populate.</p>';
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

  var stats=[['Total Deals',total],['PE-Backed',pe.length],['Strategic',strat.length],['New This Week',newTxns.length],['PE Firms',Object.keys(pl).length]];
  var statBoxes=stats.map(function(sv){
    return'<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">'
      +'<div style="font-size:22px;font-weight:800;color:#1A4C3D;">'+sv[1]+'</div>'
      +'<div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.04em;">'+sv[0]+'</div>'
      +'</div>';
  }).join('');

  return'<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2937;margin:0;background:#f9fafb;}table{border-collapse:collapse;width:100%;}</style>'
    +'</head><body><div style="max-width:980px;margin:0 auto;background:#fff;">'
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
    +'<h2 style="color:#1A4C3D;border-bottom:2px solid #1A4C3D;padding-bottom:8px;margin-top:20px;">PRIVATE EQUITY BUYERS</h2>'
    +peSect+stratSect
    +'<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#999;text-align:center;">'
    +'<strong style="color:#1A4C3D;">CATSKILL PARTNERS LP</strong> &middot; CLARITY. CRAFT. CAPITAL.<br>'
    +'Morgan Cole &middot; VP of Marketing &middot; Auto-sent every Monday 8am CT'
    +'</div></div></div></body></html>';
}

async function sendEmail(db,newTxns,resendKey){
  var h=buildHTML(db,newTxns);
  var n=newTxns.length;
  var total=db.metadata&&db.metadata.total?db.metadata.total:0;
  var subj='LMM Industrial M&A Intelligence — '
    +new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
    +' | '+total+' Deals'+(n>0?' | '+n+' New This Week':'');
  if(!resendKey)return{status:'no_resend_key',html_length:h.length};
  try{
    var r=await fetch('https://api.resend.com/emails',{method:'POST',
      headers:{'Authorization':'Bearer '+resendKey,'Content-Type':'application/json'},
      body:JSON.stringify({from:'Morgan Cole <morgan@catskillpartners.com>',to:TO,subject:subj,html:h,reply_to:'brian.steel@catskillpartners.com'})
    });
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

  console.log('[tx] v4 action='+action+' gh='+!!ghToken+' resend='+!!resendKey);

  try{
    if(action==='get'){
      var L=await loadDB(ghToken);
      return res.status(200).json({success:true,db:L.db,sorted:sortedTxns(L.db),resendPresent:!!resendKey});
    }

    if(action==='weekly_scan'||action==='initial_scan'){
      var isInit=action==='initial_scan';
      // For initial: scan 4 distinct time windows to maximise unique deal coverage
      // For weekly: just last 10 days
      // ALL 6 historical periods split into 3 batches of 2 to avoid Vercel 60s timeout
      var ALL_PERIODS=['Q4 2024 (October through December 2024)',
        'Q1 2025 (January through March 2025)',
        'Q2-Q3 2025 (April through September 2025)',
        'Q4 2025 (October through December 2025)',
        'Q1 2026 (January through March 2026)',
        'recent weeks in 2026 (March and April 2026)'];
      // batch: 0=first 2, 1=middle 2, 2=last 2, undefined=all (for cron weekly)
      var batchNum=typeof body.batch==='number'?body.batch:-1;
      var periods=isInit
        ?(batchNum>=0?ALL_PERIODS.slice(batchNum*2,(batchNum*2)+2):ALL_PERIODS.slice(0,2))
        :['the past 10 days ending '+new Date().toISOString().split('T')[0]];

      var LD=await loadDB(ghToken);
      var sha=LD.sha;var db=LD.db;
      var existing=new Set((db.transactions||[]).map(function(t){return t.id;}));
      console.log('[tx] Loaded '+existing.size+' existing deals, scanning '+periods.length+' periods');

      var allNew=[];
      for(var i=0;i<periods.length;i++){
        var period=periods[i];
        console.log('[tx] Scanning: '+period);
        var txns=await scanPeriod(period,apiKey);
        var fresh=txns.filter(function(t){return t&&t.id&&t.target&&t.buyer&&!existing.has(t.id);});
        fresh.forEach(function(t){t.date_added=new Date().toISOString().split('T')[0];existing.add(t.id);});
        allNew=allNew.concat(fresh);
        if(!db.transactions)db.transactions=[];
        db.transactions=db.transactions.concat(fresh);
        console.log('[tx] Period "'+period+'": +'+fresh.length+' new deals (running total: '+db.transactions.length+')');
      }

      db.metadata=db.metadata||{};
      db.metadata.last_scan=new Date().toISOString();
      db.metadata.total=db.transactions.length;
      buildPlatforms(db);

      var newSha=null;
      if(ghToken){
        newSha=await saveDB(db,sha,(isInit?'Initial':'Weekly')+' scan: +'+allNew.length+' deals (total: '+db.metadata.total+')',ghToken);
        console.log('[tx] DB saved, sha: '+newSha);
      }

      var emailResult=await sendEmail(db,allNew,resendKey);
      console.log('[tx] Email: '+JSON.stringify(emailResult));

      return res.status(200).json({
        success:true,added:allNew.length,total:db.metadata.total,
        periods_scanned:periods.length,emailResult:emailResult,
        dbSha:newSha,resendPresent:!!resendKey
      });
    }

    if(action==='send_email'){
      var LS=await loadDB(ghToken);var dbs=LS.db;
      var cutoff=new Date();cutoff.setDate(cutoff.getDate()-7);
      var recent=(dbs.transactions||[]).filter(function(t){
        try{return new Date(t.date_added||t.date_announced||0)>cutoff;}catch(e){return false;}
      });
      var result=await sendEmail(dbs,recent,resendKey);
      return res.status(200).json({success:true,emailResult:result,total:dbs.metadata&&dbs.metadata.total});
    }

    if(action==='get_html'){
      var LH=await loadDB(ghToken);
      return res.status(200).json({success:true,html:buildHTML(LH.db,[])});
    }

    return res.status(400).json({error:'Unknown action: '+action});

  }catch(e){
    console.error('[tx] Fatal error:',e.message,e.stack&&e.stack.substring(0,300));
    return res.status(500).json({error:e.message,detail:e.stack&&e.stack.substring(0,300)});
  }
};