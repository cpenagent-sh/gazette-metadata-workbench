/* Gazette Metadata Workbench: static, no build step, no server.
   Reads:  ./data/*           this site's archive.org shards
           SCC_BASE/*         the Indian Legislation Explorer's public JSON (CORS open)
   The SCC site is READ ONLY from here and is never modified. */
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf=n=>Number(n).toLocaleString('en-US');
const $=id=>document.getElementById(id);
const jget=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(u+' '+r.status);return r.json()};

let ST=null, SCC={base:'',SUM:null,MAN:null,PFX:null,KIDS:{},OPEN:new Set(),ROOTS:[],RSH:{},SHARDSZ:5000,LOADING:new Set(),SHOW:{}};
const C={}; // column index by name, filled from stats.json so the page never guesses
const cache={};
async function shard(url){return cache[url]||(cache[url]=await jget(url))}

/* ---------------- tabs ---------------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('.tab'); if(!t)return;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  $('t-'+t.dataset.t).classList.add('on');
  if(t.dataset.t==='scc'&&!SCC.ROOTS.length)initScc();
  if(t.dataset.t==='eg')initEg();
  if(t.dataset.t==='link')drawLinks();
});

/* ---------------- overview ---------------- */
function heat(p){ // fill-rate cell: green good, red poor
  const c=p>=80?'#123a1f':p>=40?'#3a3210':'#3a1414', f=p>=80?'#4ade80':p>=40?'#fbbf24':'#f87171';
  return `<span class="heat" style="background:${c};color:${f}">${p}%</span>`;
}
function drawOverview(){
  const s=ST, mx=Math.max(...Object.values(s.decades));
  let h='<h3>Items by decade <span class="q">all publishers</span></h3>';
  Object.entries(s.decades).forEach(([k,v])=>{
    h+=`<div class="bc"><div class="lab">${esc(k)}</div><div class="tr"><div class="fi" style="width:${v/mx*100}%"></div></div><div class="v">${nf(v)}</div></div>`;
  });
  h+='<h3>Publishers <span class="q">who is in the archive.org collection; click a row to browse it</span></h3>';
  h+='<table><thead><tr><th>Publisher</th><th class="n">Items</th><th>Years</th><th class="n">Size GB</th><th class="n">Ministry</th><th class="n">Dept</th><th class="n">Subject</th><th class="n">Gazette ID</th></tr></thead><tbody>';
  s.publishers.forEach(p=>{
    h+=`<tr class="pubrow" data-pub="${esc(p.key)}" style="cursor:pointer"><td>${esc(p.label)}<div class="crumb mono">${esc(p.key)}</div></td>
    <td class="n">${nf(p.rows)}</td><td>${esc(p.first)}&ndash;${esc(p.last)}</td><td class="n">${p.size_gb}</td>
    <td class="n">${heat(p.fill.ministry||0)}</td><td class="n">${heat(p.fill.department||0)}</td>
    <td class="n">${heat(p.fill.subject||0)}</td><td class="n">${heat(p.fill.gazette_id||0)}</td></tr>`;
  });
  h+='</tbody></table>';
  h+='<h3>Field fill rate, whole collection <span class="q">use this to decide which filters are even possible</span></h3>';
  Object.entries(s.fill).forEach(([k,v])=>{
    h+=`<div class="bc"><div class="lab">${esc(k)}</div><div class="tr"><div class="fi" style="width:${v}%"></div></div><div class="v">${v}%</div></div>`;
  });
  $('t-overview').innerHTML=h;
  document.querySelectorAll('.pubrow').forEach(r=>r.onclick=()=>{
    document.querySelector('.tab[data-t=rows]').click();
    $('f-pub').value=r.dataset.pub; fillYears(); loadRows();
  });
}

/* ---------------- row browser ---------------- */
let CUR=[];
function fillPubs(){
  $('f-pub').innerHTML='<option value="">choose a publisher&hellip;</option>'+
    ST.publishers.map(p=>`<option value="${esc(p.key)}">${esc(p.label)} (${nf(p.rows)})</option>`).join('');
}
function fillYears(){
  const p=ST.publishers.find(x=>x.key===$('f-pub').value);
  $('f-year').innerHTML='<option value="">all years</option>'+(p?Object.entries(p.years).map(([y,n])=>`<option value="${esc(y)}">${esc(y)} (${nf(n)})</option>`).join(''):'');
}
async function loadRows(){
  const pk=$('f-pub').value, yr=$('f-year').value;
  if(!pk){CUR=[];drawRows();return}
  const p=ST.publishers.find(x=>x.key===pk);
  const years=yr?[yr]:Object.keys(p.years);
  $('f-hint').textContent='loading '+years.length+' shard'+(years.length>1?'s':'')+'…';
  const parts=await Promise.all(years.map(y=>shard(`data/ia/${pk}__${y}.json`).catch(()=>[])));
  CUR=[].concat(...parts);
  drawRows();
}
function filtered(){
  const q=$('f-q').value.trim().toLowerCase(), ty=$('f-type').value, hm=$('f-min').checked, hg=$('f-gid').checked;
  return CUR.filter(r=>{
    if(ty&&r[C.type]!==ty)return false;
    if(hm&&!r[C.ministry])return false;
    if(hg&&!r[C.gazette_id])return false;
    if(q&&!(r[C.subject]+' '+r[C.ministry]+' '+r[C.department]+' '+r[C.identifier]+' '+r[C.title]).toLowerCase().includes(q))return false;
    return true;
  });
}
function drawRows(){
  const f=filtered(), lim=1000;
  if(!CUR.length){$('rows-out').innerHTML='<div class="empty">Choose a publisher above.</div>';$('f-hint').textContent='';return}
  let h=`<table><thead><tr><th>Identifier</th><th>Date</th><th>Type</th><th>Ministry</th><th>Department</th><th>Subject</th><th>Gazette ID</th><th class="n">MB</th></tr></thead><tbody>`;
  f.slice(0,lim).forEach(r=>{
    h+=`<tr><td class="mono"><a target="_blank" rel="noopener" href="https://archive.org/details/${encodeURIComponent(r[C.identifier])}">${esc(r[C.identifier])}</a></td>
    <td>${esc(r[C.date])}</td><td>${esc(r[C.type])}</td><td class="clip">${esc(r[C.ministry])}</td><td class="clip">${esc(r[C.department])}</td>
    <td class="clip" title="${esc(r[C.subject])}">${esc(r[C.subject])}</td><td class="mono">${esc(r[C.gazette_id])}</td>
    <td class="n">${(r[C.size]/1e6).toFixed(1)}</td></tr>`;
  });
  h+='</tbody></table>';
  $('rows-out').innerHTML=h;
  $('f-hint').textContent=`${nf(f.length)} of ${nf(CUR.length)} rows`+(f.length>lim?` (showing first ${nf(lim)}; use the CSV button for all)`:'');
}
function toCsv(){
  const f=filtered(), q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv=[ST.cols.join(',')].concat(f.map(r=>r.map(q).join(','))).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='gazette_filtered_'+($('f-pub').value||'all')+'.csv'; a.click();
}

/* ---------------- SCC tree (read-only, from the Explorer's public JSON) ---------------- */
async function initScc(){
  const B=SCC.base=ST.scc_base;
  $('scc-out').innerHTML='<div class="empty">loading the SCC tree from '+esc(B)+' …</div>';
  try{
    [SCC.SUM,SCC.MAN,SCC.PFX]=await Promise.all([jget(B+'summary.json'),jget(B+'manifest.json'),jget(B+'search-prefix.json')]);
    SCC.SHARDSZ=SCC.PFX.shard||5000;
    SCC.SUM.forEach(x=>{const o=document.createElement('option');o.value=x.section;o.textContent=x.section;$('s-sec').appendChild(o)});
    SCC.ROOTS=await sccKids('');
    SCC.ROOTS.forEach(r=>SCC.OPEN.add(r.p));
    for(const r of SCC.ROOTS) await sccKids(r.p);
    drawScc();
  }catch(e){$('scc-out').innerHTML='<div class="empty">Could not load the SCC tree.<br>'+esc(e.message)+'</div>'}
}
async function sccKids(p){
  if(SCC.KIDS[p])return SCC.KIDS[p];
  const h=SCC.MAN[p]; if(!h){SCC.KIDS[p]=[];return[]}
  return SCC.KIDS[p]=await jget(SCC.base+'d/'+h+'.json');
}
function node(rec,d){
  const p=rec.p,isF=rec.c>0,open=SCC.OPEN.has(p);
  let h=`<div class="node"><div class="row"><span class="tw${isF?'':' leaf'}" data-p="${esc(p)}">${SCC.LOADING.has(p)?'◌':isF?(open?'▾':'▸'):'·'}</span>
  <span class="nm${isF?' f':''}" data-p="${esc(p)}">${esc(rec.n)}</span>
  <span class="pill p-pur">${esc(rec.k.split(' ')[0])}</span>${isF?`<span class="cnt mono">${nf(rec.c)}</span>`:''}</div>`;
  if(isF&&open&&SCC.KIDS[p]){
    const all=SCC.KIDS[p],lim=SCC.SHOW[p]||300;
    h+='<div class="kids">'+all.slice(0,lim).map(c=>node(c,d+1)).join('');
    if(all.length>lim)h+=`<div class="more" data-more="${esc(p)}">+ ${nf(all.length-lim)} more…</div>`;
    h+='</div>';
  }
  return h+'</div>';
}
function drawScc(){$('scc-out').innerHTML=SCC.ROOTS.map(r=>node(r,0)).join('');$('s-hint').textContent='click a folder to expand'}
$('scc-out').addEventListener('click',async e=>{
  const m=e.target.closest('[data-more]');
  if(m){SCC.SHOW[m.dataset.more]=(SCC.SHOW[m.dataset.more]||300)+2000;drawScc();return}
  const o=e.target.closest('[data-open]');
  if(o){const parts=o.dataset.open.split(' > ');for(let i=1;i<=parts.length;i++){const p=parts.slice(0,i).join(' > ');SCC.OPEN.add(p);await sccKids(p)}$('s-q').value='';drawScc();return}
  const t=e.target.closest('.tw:not(.leaf)')||e.target.closest('.nm.f[data-p]'); if(!t)return;
  const p=t.dataset.p;
  if(SCC.OPEN.has(p)){SCC.OPEN.delete(p);drawScc();return}
  SCC.OPEN.add(p);
  if(!SCC.KIDS[p]){SCC.LOADING.add(p);drawScc();await sccKids(p);SCC.LOADING.delete(p)}
  drawScc();
});
async function sccSearch(){
  const raw=$('s-q').value.trim();
  if(!raw){drawScc();return}
  const words=raw.toLowerCase().match(/[a-z0-9]+/g)||[]; if(!words.length){drawScc();return}
  $('s-hint').textContent='searching…';
  let seeds=[];
  for(const w of words){
    const key=w.length>=3?w.slice(0,3):w, h=SCC.PFX.p[key];
    if(h){const d=await jget(SCC.base+'s/'+h+'.json');seeds.push(d.i)}
  }
  if(!seeds.length){$('scc-out').innerHTML='<div class="empty">No matches.</div>';$('s-hint').textContent='0 matches';return}
  seeds.sort((a,b)=>a.length-b.length);
  const ids=seeds[0].slice(0,20000);
  const need=[...new Set(ids.map(g=>Math.floor(g/SCC.SHARDSZ)))];
  await Promise.all(need.map(async s=>{if(!SCC.RSH[s])SCC.RSH[s]=await jget(SCC.base+'r/'+String(s).padStart(2,'0')+'.json')}));
  const sec=$('s-sec').value,out=[];
  for(const g of ids){
    const r=SCC.RSH[Math.floor(g/SCC.SHARDSZ)][g%SCC.SHARDSZ]; if(!r)continue;
    const hay=(r[0]+' '+r[1]).toLowerCase();
    if(!words.every(w=>hay.includes(w)))continue;
    if(sec&&r[1].indexOf(sec)!==0)continue;
    out.push(r); if(out.length>=400)break;
  }
  $('scc-out').innerHTML=out.length?out.map(r=>`<div class="rowcard"><div class="s nm f" data-open="${esc(r[1])}" style="cursor:pointer">${esc(r[0])}</div>
    <div class="m">${esc(r[1].split(' > ').slice(0,-1).join(' › '))} &middot; <span class="pill p-pur">${esc(r[2].split(' ')[0])}</span></div></div>`).join(''):'<div class="empty">No matches.</div>';
  $('s-hint').textContent=nf(out.length)+(out.length>=400?'+':'')+' matches';
}

/* ---------------- SCC Acts that appear in archive.org rows ---------------- */
let LINKS=[];
async function drawLinks(){
  if(!LINKS.length){LINKS=await jget('data/act_links.json').catch(()=>[])}
  const q=$('l-q').value.trim().toLowerCase(), tier=$('l-tier').value;
  const f=LINKS.filter(a=>(!tier||a.tier===tier)&&(!q||a.act.toLowerCase().includes(q)));
  $('l-hint').textContent=`${nf(f.length)} of ${nf(LINKS.length)} Acts`;
  $('l-list').innerHTML=f.slice(0,600).map(a=>`<div class="item" data-k="${esc(a.key)}"><div class="t">${esc(a.act)}</div>
    <div class="m"><span class="pill ${a.tier==='EXACT'?'p-ok':'p-warn'}">${a.tier}</span> ${nf(a.rows)} archive.org rows &middot; ${esc(a.sections.join(', '))}</div></div>`).join('')||'<div class="empty">Nothing matches.</div>';
}
$('l-list').addEventListener('click',async e=>{
  const it=e.target.closest('.item'); if(!it)return;
  document.querySelectorAll('#l-list .item').forEach(x=>x.classList.toggle('on',x===it));
  const rows=await jget('data/acts/'+it.dataset.k+'.json');
  const a=LINKS.find(x=>x.key===it.dataset.k);
  $('l-detail').innerHTML=`<h3>${esc(a.act)} <span class="q">${nf(a.rows)} rows${a.rows>rows.length?`, first ${rows.length} shown`:''}</span></h3>`+
   rows.map(r=>`<div class="rowcard"><div class="s">${esc(r[3])}</div><div class="m"><a target="_blank" rel="noopener" href="https://archive.org/details/${encodeURIComponent(r[0])}" class="mono">${esc(r[0])}</a> &middot; ${esc(r[1])} &middot; <span class="pill ${r[2]==='EXACT'?'p-ok':'p-warn'}">${esc(r[2])}</span></div></div>`).join('');
});

/* ---------------- eGazette Part & Section ---------------- */
let EG=null,EGC={},EGROWS=[],EGBOOT=false;
const MULTI=/^(this gazette may|not applicable)/i;
async function initEg(){
  if(EGBOOT)return; EGBOOT=true;
  try{EG=await jget('data/eg_stats.json')}catch(e){$('eg-top').innerHTML='<div class="empty">No eGazette data in this build.</div>';return}
  EG.cols.forEach((c,i)=>EGC[c]=i);
  drawEgTop();
  $('e-ps').innerHTML='<option value="">choose a Part &amp; Section&hellip;</option>'+EG.parts.map(p=>`<option value="${esc(p.key)}">${esc(p.name)} (${nf(p.rows)})</option>`).join('');
  $('e-ps').onchange=()=>{egYears();egLoad()};
  $('e-year').onchange=egLoad;
  ['e-cat','e-pdf','e-real'].forEach(id=>$(id).onchange=drawEg);
  $('e-q').oninput=()=>{clearTimeout(window.__e);window.__e=setTimeout(drawEg,200)};
  $('e-csv').onclick=egCsv;
}
function drawEgTop(){
  const decs=[...new Set(EG.parts.flatMap(p=>Object.keys(p.years).map(y=>/^\d{4}$/.test(y)?y.slice(0,3)+'0':'?')))].sort();
  const mx=Math.max(...EG.parts.flatMap(p=>decs.map(d=>Object.entries(p.years).filter(([y])=>y.slice(0,3)+'0'===d).reduce((a,[,n])=>a+n,0))));
  let h=`<div class="note"><b>${nf(EG.rows)}</b> gazettes collected from egazette.gov.in's own Part &amp; Section listing`+
   (EG.expected?` of ${nf(EG.expected)} the site reports (${(EG.rows/EG.expected*100).toFixed(1)}%)`:'')+
   `. Harvest finished${EG.expected&&EG.rows<EG.expected?`; <b>${nf(EG.expected-EG.rows)} listed rows were not retrievable</b> (the site's pager hides the tail of large result sets, and old gazettes with identical dates, ministry, subject and size merge into one row)`:''}. Metadata only, no PDFs. Built ${esc(EG.built)}.</div>`;
  h+='<h3>Part &amp; Section by decade <span class="q">click a row to browse it</span></h3><div style="overflow:auto"><table><thead><tr><th>Part &amp; Section</th><th class="n">Gazettes</th><th class="n">Site total</th>'+decs.map(d=>`<th class="n">${d==='?'?'?':d+'s'}</th>`).join('')+
   '<th class="n">Ministry</th><th class="n">PDF link</th></tr></thead><tbody>';
  EG.parts.forEach(p=>{
    h+=`<tr class="egrow" data-k="${esc(p.key)}" style="cursor:pointer"><td>${esc(p.name)}<div class="crumb">${esc(p.desc)}</div></td><td class="n">${nf(p.rows)}</td><td class="n">${p.expected?nf(p.expected):''}</td>`;
    decs.forEach(d=>{
      const n=Object.entries(p.years).filter(([y])=>(/^\d{4}$/.test(y)?y.slice(0,3)+'0':'?')===d).reduce((a,[,v])=>a+v,0);
      const a=n?Math.min(.9,.12+.78*Math.sqrt(n/mx)):0;
      h+=`<td class="n" style="background:rgba(47,129,247,${a.toFixed(2)})">${n?nf(n):''}</td>`;
    });
    h+=`<td class="n">${heat(p.fill.ministry||0)}</td><td class="n">${heat(p.fill.pdf||0)}</td></tr>`;
  });
  h+='</tbody></table></div>';
  $('eg-top').innerHTML=h;
  document.querySelectorAll('.egrow').forEach(r=>r.onclick=()=>{$('e-ps').value=r.dataset.k;egYears();egLoad();window.scrollTo({top:document.querySelector('#t-eg .bar').offsetTop-60,behavior:'smooth'})});
}
function egYears(){
  const p=EG.parts.find(x=>x.key===$('e-ps').value);
  $('e-year').innerHTML='<option value="">all years</option>'+(p?Object.entries(p.years).map(([y,n])=>`<option value="${esc(y)}">${esc(y)} (${nf(n)})</option>`).join(''):'');
  $('e-note').textContent=p?p.desc+(p.expected?` · site lists ${nf(p.expected)}, we hold ${nf(p.rows)}`:''):'';
}
async function egLoad(){
  const pk=$('e-ps').value,yr=$('e-year').value;
  if(!pk){EGROWS=[];drawEg();return}
  const p=EG.parts.find(x=>x.key===pk),ys=yr?[yr]:Object.keys(p.years);
  $('e-hint').textContent='loading '+ys.length+' shard'+(ys.length>1?'s':'')+'…';
  const parts=await Promise.all(ys.map(y=>shard(`data/eg/${pk}__${y}.json`).catch(()=>[])));
  EGROWS=[].concat(...parts);drawEg();
}
function egFiltered(){
  const q=$('e-q').value.trim().toLowerCase(),cat=$('e-cat').value,pdf=$('e-pdf').checked,real=$('e-real').checked;
  return EGROWS.filter(r=>{
    if(cat&&r[EGC.category]!==cat)return false;
    if(pdf&&!r[EGC.pdf])return false;
    if(real&&(!r[EGC.ministry]||MULTI.test(r[EGC.ministry])))return false;
    if(q&&!(r[EGC.subject]+' '+r[EGC.ministry]+' '+r[EGC.department]+' '+r[EGC.gazette_id]).toLowerCase().includes(q))return false;
    return true});
}
function drawEg(){
  if(!EGROWS.length){$('e-out').innerHTML='<div class="empty">Pick a Part &amp; Section above (or click a row in the table).</div>';$('e-hint').textContent='';return}
  const f=egFiltered(),lim=1000;
  let h='<table><thead><tr><th>Issue date</th><th>Published</th><th>Cat.</th><th>Ministry</th><th>Department</th><th>Subject</th><th>Gazette ID</th><th class="n">MB</th><th>PDF</th></tr></thead><tbody>';
  f.slice(0,lim).forEach(r=>{
    h+=`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${r[2]==='Weekly'?'W':'EO'}</td><td class="clip" title="${esc(r[3])}">${esc(r[3])}</td><td class="clip">${esc(r[4])}</td>
    <td class="clip" title="${esc(r[6])}">${esc(r[6])}</td><td class="mono">${esc(r[7])}</td><td class="n">${esc(r[8])}</td>
    <td>${r[10]?`<a target="_blank" rel="noopener" href="https://egazette.gov.in/WriteReadData/${esc(r[10])}.pdf">link</a>`:''}</td></tr>`;
  });
  $('e-out').innerHTML=h+'</tbody></table>';
  $('e-hint').textContent=`${nf(f.length)} of ${nf(EGROWS.length)} rows`+(f.length>lim?` (first ${nf(lim)} shown; CSV has all)`:'');
}
function egCsv(){
  const f=egFiltered(),q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv=[EG.cols.join(',')].concat(f.map(r=>r.map(q).join(','))).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='egazette_'+($('e-ps').value||'all')+'.csv';a.click();
}

/* ---------------- notes ---------------- */
function drawAbout(){
  $('t-about').innerHTML=`<h3>What this is</h3>
  <p>One place to look at all ${nf(ST.rows)} archive.org gazette metadata rows next to the SCC legislation tree, to decide which filters are worth using before downloading anything.</p>
  <h3>Sources</h3>
  <p><b>Archive.org rows:</b> metadata only, harvested from the <code>gazetteofindia</code> collection. No PDFs and no OCR text are stored here. Built ${esc(ST.built)}.<br>
  <b>SCC tree:</b> read live from the <a href="${esc(ST.scc_base)}" target="_blank" rel="noopener">Indian Legislation Explorer</a>'s public JSON. That site is separate and unchanged.</p>
  <h3>Things that will mislead you if you don't know them</h3>
  <p><b>Ministry, department and subject are not present for every publisher.</b> They are filled for the Union &ldquo;central&rdquo; items and Delhi, patchy for legacy Union items, and empty for most state mirrors. The Overview table shows fill rate per publisher.</p>
  <p><b>Gazette ID exists only for post-2020 Union items</b> (about 6% of rows).</p>
  <p><b>&ldquo;SCC Acts in archive.org&rdquo; matches gazette subjects that <i>cite</i> an Act.</b> The row is a gazette, not the Act text. EXACT means the whole subject equals the Act name; PHRASE means the full name with its year appears inside the subject. Land Acquisition Act, 1894 alone accounts for about 12,000 PHRASE rows.</p>
  <p><b>Some source dates are plainly wrong and are shown as archive.org has them.</b> For example the decade chart shows 1010s, 1800s and 1830s: two Odisha items are dated <code>1010-05-14</code> (title says 2010) and a Calcutta Gazette is dated 1808 while its title says 1908. Treat the earliest years with suspicion.</p>
  <p>The same Act name can appear more than once in the SCC tree (for example under several states); the list de-duplicates by name.</p>`;
}

/* ---------------- boot ---------------- */
(async function(){
  try{
    ST=await jget('data/stats.json');
    ST.cols.forEach((c,i)=>C[c]=i);
    $('sub').textContent=`${nf(ST.rows)} archive.org rows · ${ST.publishers.length} publishers · ${ST.total_size_gb.toLocaleString('en-IN')} GB if every item were downloaded · built ${ST.built}`;
    $('kpis').innerHTML=[['Archive.org rows',nf(ST.rows)],['Publishers',ST.publishers.length],['Data shards',nf(ST.shards)],['SCC Acts found in rows',nf(ST.acts_linked)]]
      .map(([l,v])=>`<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
    fillPubs();drawOverview();drawAbout();
    $('f-pub').onchange=()=>{fillYears();loadRows()};
    $('f-year').onchange=loadRows;
    ['f-type','f-min','f-gid'].forEach(id=>$(id).onchange=drawRows);
    $('f-q').oninput=()=>{clearTimeout(window.__a);window.__a=setTimeout(drawRows,200)};
    $('f-csv').onclick=toCsv;
    $('s-q').oninput=()=>{clearTimeout(window.__b);window.__b=setTimeout(sccSearch,300)};
    $('s-sec').onchange=sccSearch;
    $('l-q').oninput=()=>{clearTimeout(window.__c);window.__c=setTimeout(drawLinks,200)};
    $('l-tier').onchange=drawLinks;
  }catch(e){document.body.insertAdjacentHTML('beforeend','<div class="empty" style="padding:24px">Failed to load data: '+esc(e.message)+'</div>')}
})();
