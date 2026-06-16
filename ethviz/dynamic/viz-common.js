/* viz-common.js — shared data + layout for the Ethereum deck.gl examples.
   Loaded as a classic <script src> (works from file://, unlike fetch/modules). */

/* ---------- seeded RNG ---------- */
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

/* ---------- CSV ---------- */
// Minimal CSV parse: header row -> array of objects. Our data has no quoted
// commas, so a plain split is correct and keeps this dependency-free.
function parseCSV(text){
  const lines=text.replace(/\r/g,'').split('\n').filter(l=>l.length);
  const head=lines[0].split(',');
  return lines.slice(1).map(line=>{
    const cells=line.split(',');
    const o={};
    head.forEach((h,i)=>o[h.trim()]=cells[i]);
    return o;
  });
}

/* ---------- graph from raw transactions ---------- */
// Rows need from_address, to_address, value_eth (+ optional block_number, hash...).
function buildGraph(rows){
  const idOf=new Map(); const nodes=[];
  const id=a=>{ if(!idOf.has(a)){ idOf.set(a, nodes.length); nodes.push({index:nodes.length,address:a,degree:0,inDeg:0,outDeg:0,cluster:0,isHub:false}); } return idOf.get(a); };
  const edges=rows.map(r=>{
    const si=id(r.from_address), ti=id(r.to_address);
    const value=parseFloat(r.value_eth)||0;
    nodes[si].degree++; nodes[si].outDeg++;
    nodes[ti].degree++; nodes[ti].inDeg++;
    return {si, ti, from:r.from_address, to:r.to_address, value,
            block:+r.block_number||0, hash:r.hash||'', gas:+r.gas_used||0};
  });
  return {nodes, edges};
}

// Flag the top-degree addresses as hubs (exchange/contract-like).
function markHubs(nodes, frac=0.08){
  const k=Math.max(1, Math.round(nodes.length*frac));
  [...nodes].sort((a,b)=>b.degree-a.degree).slice(0,k).forEach(n=>n.isHub=true);
}

/* ---------- Fruchterman–Reingold layout (small graphs, run live) ----------
   Stand-in for the offline cuGraph ForceAtlas2 pass; fine at this scale. */
function layoutForce(nodes, edges, {iterations=400, seed=7, area=700, gravity=0.06}={}){
  const rnd=mulberry32(seed), n=nodes.length;
  const k=area/Math.sqrt(Math.max(1,n));
  nodes.forEach(nd=>{nd.x=(rnd()-0.5)*area; nd.y=(rnd()-0.5)*area;});
  let temp=area*0.12;
  const dx=new Float64Array(n), dy=new Float64Array(n);
  for(let it=0; it<iterations; it++){
    dx.fill(0); dy.fill(0);
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
      let ex=nodes[i].x-nodes[j].x, ey=nodes[i].y-nodes[j].y;
      let d=Math.hypot(ex,ey)||0.01, f=k*k/d, ux=ex/d, uy=ey/d;
      dx[i]+=ux*f; dy[i]+=uy*f; dx[j]-=ux*f; dy[j]-=uy*f;
    }
    for(const e of edges){
      let ex=nodes[e.si].x-nodes[e.ti].x, ey=nodes[e.si].y-nodes[e.ti].y;
      let d=Math.hypot(ex,ey)||0.01, f=d*d/k, ux=ex/d, uy=ey/d;
      dx[e.si]-=ux*f; dy[e.si]-=uy*f; dx[e.ti]+=ux*f; dy[e.ti]+=uy*f;
    }
    for(let i=0;i<n;i++){
      dx[i]-=nodes[i].x*gravity; dy[i]-=nodes[i].y*gravity;   // pull toward center, stops drift
      let d=Math.hypot(dx[i],dy[i])||0.01;
      nodes[i].x+=dx[i]/d*Math.min(d,temp);
      nodes[i].y+=dy[i]/d*Math.min(d,temp);
    }
    temp*=0.985;
  }
  normalizeLayout(nodes, edges);
}

// Center on the centroid and scale so the bulk of the graph fits a fixed box,
// so the initial camera framing is robust regardless of force constants.
function normalizeLayout(nodes, edges, target=340){
  let cx=0, cy=0; nodes.forEach(n=>{cx+=n.x; cy+=n.y;}); cx/=nodes.length||1; cy/=nodes.length||1;
  nodes.forEach(n=>{n.x-=cx; n.y-=cy;});
  const rads=nodes.map(n=>Math.hypot(n.x,n.y)).sort((a,b)=>a-b);
  const p=rads[Math.floor(rads.length*0.98)]||1, s=target/(p||1);
  nodes.forEach(n=>{n.x*=s; n.y*=s;});
  edges.forEach(e=>{ e.sx=nodes[e.si].x; e.sy=nodes[e.si].y; e.tx=nodes[e.ti].x; e.ty=nodes[e.ti].y; });
}

/* ---------- label-propagation community detection ---------- */
function detectCommunities(nodes, edges, {seed=2, iterations=30}={}){
  const rnd=mulberry32(seed), n=nodes.length;
  const adj=nodes.map(()=>[]);
  edges.forEach(e=>{adj[e.si].push(e.ti); adj[e.ti].push(e.si);});
  nodes.forEach((nd,i)=>nd.cluster=i);
  const order=[...Array(n).keys()];
  for(let it=0; it<iterations; it++){
    for(let i=n-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    let changed=false;
    for(const i of order){
      const counts=new Map();
      for(const nb of adj[i]){const c=nodes[nb].cluster;counts.set(c,(counts.get(c)||0)+1);}
      let best=nodes[i].cluster, bestN=-1;
      counts.forEach((v,c)=>{ if(v>bestN || (v===bestN && c<best)){bestN=v;best=c;} });
      if(best!==nodes[i].cluster){nodes[i].cluster=best;changed=true;}
    }
    if(!changed)break;
  }
  const map=new Map(); let k=0;
  nodes.forEach(nd=>{ if(!map.has(nd.cluster))map.set(nd.cluster,k++); nd.cluster=map.get(nd.cluster); });
  return k;
}

/* ---------- color + geometry helpers ---------- */
function hslToRgb(h,s,l){let r,g,b;if(s===0){r=g=b=l;}else{const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q,f=(t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};r=f(h+1/3);g=f(h);b=f(h-1/3);}return[Math.round(r*255),Math.round(g*255),Math.round(b*255)];}
function clusterColor(c){return hslToRgb(((c*137.508)%360)/360,0.62,0.6);}
function valueColor(v){const t=Math.min(1,Math.log10(1+v)/Math.log10(1+45));const s=[[58,86,140],[64,150,170],[120,190,140],[235,170,70],[245,110,40]];const i=Math.min(s.length-2,Math.floor(t*(s.length-1))),f=t*(s.length-1)-i,a=s[i],b=s[i+1];return[Math.round(a[0]+(b[0]-a[0])*f),Math.round(a[1]+(b[1]-a[1])*f),Math.round(a[2]+(b[2]-a[2])*f)];}
function bezierPath(sx,sy,tx,ty,bend,steps){const mx=(sx+tx)/2,my=(sy+ty)/2,ex=tx-sx,ey=ty-sy,len=Math.hypot(ex,ey)||1,nx=-ey/len,ny=ex/len,cx=mx+nx*bend*len,cy=my+ny*bend*len,p=[];for(let i=0;i<=steps;i++){const t=i/steps,mt=1-t;p.push([mt*mt*sx+2*mt*t*cx+t*t*tx,mt*mt*sy+2*mt*t*cy+t*t*ty]);}return p;}
function short(a){return a?a.slice(0,6)+'\u2026'+a.slice(-4):'';}

/* ---------- loader: fetch the CSV, or fall back to a file picker ---------- */
// fetch() of a local file fails on file:// — when it does, we show a picker so
// the page still works without a server.
function loadTransactions(url, boot){
  const start=text=>{ try{ boot(parseCSV(text)); }catch(err){ showError('Could not parse CSV: '+err.message); } };
  fetch(url).then(r=>{ if(!r.ok) throw new Error(r.status); return r.text(); })
    .then(start)
    .catch(()=>showPicker(start));
}

function showPicker(onText){
  const el=document.getElementById('deck');
  const box=document.createElement('div');
  box.className='picker';
  box.innerHTML=
    '<div class="pk-inner">'+
    '<div class="pk-h">Load transactions.csv</div>'+
    '<p class="pk-p">The page is running from <code>file://</code>, so it can\u2019t fetch the CSV directly. '+
    'Either run a local server (recommended):</p>'+
    '<pre class="pk-code">python3 -m http.server\n# then open http://localhost:8000/</pre>'+
    '<p class="pk-p">\u2026or just pick the file:</p>'+
    '<label class="pk-btn">Choose CSV file<input id="pk-file" type="file" accept=".csv,text/csv" hidden></label>'+
    '</div>';
  el.appendChild(box);
  box.querySelector('#pk-file').addEventListener('change', ev=>{
    const file=ev.target.files[0]; if(!file) return;
    const rdr=new FileReader();
    rdr.onload=()=>{ box.remove(); onText(rdr.result); };
    rdr.readAsText(file);
  });
}

function showError(msg){
  const el=document.getElementById('deck');
  el.insertAdjacentHTML('beforeend','<div class="picker"><div class="pk-inner"><div class="pk-h">Error</div><p class="pk-p">'+msg+'</p></div></div>');
}
