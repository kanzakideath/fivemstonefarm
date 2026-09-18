/* Read rendered NUI only. No game globals, success callbacks, or game-state edits. */
(() => {
  const W=innerWidth,H=innerHeight;
  const visible=e=>{if(!e||!e.isConnected)return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;}const b=e.getBoundingClientRect();return b.width>0&&b.height>0;};
  const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};
  const color=s=>{const a=String(s).match(/[\d.]+/g);return a&&a.length>=3?a.slice(0,3).map(Number):[0,0,0];};
  const kind=s=>{const [r,g,b]=color(s);return Math.min(r,g,b)>175&&Math.max(r,g,b)-Math.min(r,g,b)<60?'white':g>r+18&&b>r+12&&g>65&&Math.abs(g-b)<95?'green':'other';};
  const norm=a=>(a%360+360)%360;
  let cache=window.__fishingPilotObservationV2;
  if(!cache)cache=window.__fishingPilotObservationV2={nodes:new WeakMap(),next:1,noticeNodes:new WeakMap(),noticeNext:1};
  const identity=e=>{if(!cache.nodes.has(e))cache.nodes.set(e,cache.next++);return cache.nodes.get(e);};
  const texts=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/^[0-9]$/.test((e.textContent||'').trim())&&visible(e));
  const digits=texts.map(e=>({e,b:box(e),key:+e.textContent.trim()})).filter(t=>Math.abs(t.b.x+t.b.w/2-W/2)<W*.28&&Math.abs(t.b.y+t.b.h/2-H/2)<H*.28&&t.b.h>10&&t.b.h<H*.2);
  const circles=[...document.querySelectorAll('svg circle')].filter(visible);
  const arcs=[];
  for(const e of circles){
    const s=getComputedStyle(e),k=kind(s.stroke);if(k==='other')continue;
    const r=+e.getAttribute('r')||parseFloat(s.r),cx=+e.getAttribute('cx')||parseFloat(s.cx)||0,cy=+e.getAttribute('cy')||parseFloat(s.cy)||0,m=e.getScreenCTM();
    if(!m||!Number.isFinite(r)||r<8)continue;
    const pt=(x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
    const c=pt(cx,cy),p=pt(cx+r,cy),q=pt(cx,cy+r),radius=Math.hypot(p.x-c.x,p.y-c.y),r2=Math.hypot(q.x-c.x,q.y-c.y);
    if(radius<14||radius>Math.min(W,H)*.25||Math.abs(r2-radius)>radius*.12)continue;
    const L=2*Math.PI*r,dash=String(s.strokeDasharray).match(/[\d.]+/g),off=parseFloat(s.strokeDashoffset)||0;
    if(!dash||Math.abs(+dash[0]-L)>L*.08)continue; // Unsupported paths never produce a timing decision.
    const len=Math.max(0,Math.min(L,L-off));const sweep=len/L*360;
    const start=norm(Math.atan2(p.x-c.x,c.y-p.y)*180/Math.PI);
    arcs.push({e,k,c,r:radius,start,sweep,end:norm(start+sweep)});
  }
  const matches=[];
  for(const d of digits)for(const g of arcs.filter(a=>a.k==='green'&&a.sweep>=4&&a.sweep<=130)){
    if(Math.hypot(d.b.x+d.b.w/2-g.c.x,d.b.y+d.b.h/2-g.c.y)>g.r*.6)continue;
    const whites=arcs.filter(a=>a.k==='white'&&Math.hypot(a.c.x-g.c.x,a.c.y-g.c.y)<4&&Math.abs(a.r-g.r)<Math.max(6,g.r*.12));
    if(whites.length!==1)continue;const a=whites[0];
    matches.push({valid:true,present:true,key:d.key,pointer:a.end,start:g.start,end:norm(g.start+g.sweep),span:g.sweep,confidence:1,
      stamp:identity(a.e)+':'+identity(g.e),x:g.c.x-g.r*1.5,y:g.c.y-g.r*1.5,w:g.r*3,h:g.r*3,radius:g.r});
  }
  let ring={valid:false,present:false};
  if(matches.length===1)ring=matches[0];
  else if(matches.length>1)ring={valid:false,present:true,ambiguous:true};
  else if(digits.length===1){
    const d=digits[0];let shape=null;
    for(let p=d.e.parentElement,n=0;p&&n<4;p=p.parentElement,n++){
      const b=box(p);if(b.w>30&&b.w<Math.min(W,H)*.55&&b.h>30&&b.h<Math.min(W,H)*.55&&Math.abs(b.w-b.h)<Math.max(b.w,b.h)*.35){shape=b;break;}
    }
    const canvas=[...document.querySelectorAll('canvas,svg')].filter(visible).map(box).find(b=>d.b.x>=b.x&&d.b.x<=b.x+b.w&&d.b.y>=b.y&&d.b.y<=b.y+b.h&&b.w>40&&b.w<Math.min(W,H)*.7&&b.h>40&&b.h<Math.min(W,H)*.7);
    const b=shape||canvas;
    if(b)ring={valid:false,present:true,key:d.key,stamp:'pixel:'+identity(d.e),x:b.x,y:b.y,w:b.w,h:b.h};
  }
  const candidates=[...document.querySelectorAll('[role="alert"], [class*="Notification"], [class*="notification"], [class*="toast"], [id*="notification"]')].filter(visible);
  const notices=[];
  for(const e of candidates){
    if(e.querySelector('[role="alert"], [class*="Notification-root"], [class*="notification-item"]'))continue;
    const t=(e.innerText||e.textContent||'').trim();if(!t||t.length>400)continue;
    const k=/インベントリ.*(いっぱい|満|重)|持ち物.*(いっぱい|持て)|所持.*(上限|重量)|not enough (space|capacity)|inventory.*full/i.test(t)?'FULL':
      /釣り竿.*(壊|ない)|釣り餌.*[足無]|餌が[足無]|エサが[足無]|no.*bait|rod.*broken/i.test(t)?'BLOCK':
      /魚に逃げ|釣りに失敗|逃げられ|逃がし|釣れなか|fish.*(escaped|got away)|failed.*fish/i.test(t)?'FAIL':
      /釣り.*(やめ|終了|中断)|fishing.*(cancel|stop)/i.test(t)?'CANCEL':
      /魚.*(釣れ|釣り上げた)|釣り上げました|魚を.*(獲得|入手)|caught.*fish/i.test(t)?'CAUGHT':
      /食いつ|アタリ|fish.*bit/i.test(t)?'BITE':
      /釣り.*(開始|始め)|竿.*投げ|キャスト|エサ.*待|fishing.*start|cast.*line/i.test(t)?'CAST':
      /使用できません|今は.*(使え|使用)|already.*fishing|釣り中|busy/i.test(t)?'BUSY':'NONE';
    if(k==='NONE')continue;
    const old=cache.noticeNodes.get(e);let id=old&&old.text===t?old.id:cache.noticeNext++;
    cache.noticeNodes.set(e,{id,text:t});notices.push({kind:k,id});
  }
  const busy=[...document.querySelectorAll('[role="progressbar"],#progressbar,#progress-container,.progress-bar')].some(e=>{if(!visible(e))return false;const b=box(e);return b.x+b.w/2>W*.25&&b.x+b.w/2<W*.75&&b.y>H*.5&&b.w>30;});
  let hunger=null,water=null;
  for(const e of document.querySelectorAll('[aria-valuenow],[data-value],progress')){
    if(!visible(e))continue;const name=((e.getAttribute('aria-label')||'')+' '+(e.id||'')+' '+(e.className&&e.className.baseVal||e.className||'')).toLowerCase();
    let value=Number(e.getAttribute('aria-valuenow')||e.getAttribute('data-value')||e.value),max=Number(e.getAttribute('aria-valuemax')||e.max||100);if(!Number.isFinite(value)||max<=0||value<0||value>max)continue;
    if(/hunger|空腹|食事/.test(name))hunger=value/max*100;
    if(/thirst|hydration|水分/.test(name))water=value/max*100;
  }
  return JSON.stringify({w:W,h:H,at:performance.now(),ring,busy,notices,hunger,water});
})()
