/* Reads rendered controls; sends only ordinary key events. No game stores,
 success callbacks, animation edits, focus stealing, or recurring input timers.
 Every key-down requires a live host call. */
(() => {
  if (window.__fpProbe3 && window.__fpProbe3.version==='0.6.3-background') return window.__fpProbe3.sample(false,null);
  if(window.__fpProbe3 && window.__fpProbe3.dispose)window.__fpProbe3.dispose();else if(window.__fpProbe3 && window.__fpProbe3.stop)window.__fpProbe3.stop();
  const norm = a => (a % 360 + 360) % 360;
  const delta = (a,b) => (a-b+540)%360-180;
  const nodes = new WeakMap(), notices = new WeakMap(); let nextId=1, noticeId=1;
  const id = e => {if(!nodes.has(e))nodes.set(e,nextId++);return nodes.get(e);};
  const visible = e => {if(!e || !e.isConnected||e.closest('[data-fishingpilot-overlay]'))return false;for(let p=e;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;}const b=e.getBoundingClientRect();return b.width>0&&b.height>0;};
  const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};
  const kind=s=>{const v=String(s).match(/[\d.]+/g);if(!v||v.length<3)return '';const [r,g,b]=v.map(Number);if(v.length>3&&+v[3]===0)return '';return Math.min(r,g,b)>170&&Math.max(r,g,b)-Math.min(r,g,b)<65?'white':g>r+18&&g>65&&(g>b+5||b>r+10)?'green':r>120&&r>g+45&&r>b+45?'indicator':'';};
  const toScreen=(m,p)=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});
  const angle=(p,c)=>norm(Math.atan2(p.x-c.x,c.y-p.y)*180/Math.PI);
  function lengthValue(raw,e){const v=parseFloat(raw);if(!Number.isFinite(v))return NaN;const s=String(raw);if(s.endsWith('vw'))return v*innerWidth/100;if(s.endsWith('vh'))return v*innerHeight/100;if(s.endsWith('%')){const svg=e.ownerSVGElement,b=svg&&svg.viewBox.baseVal;return v/100*(b&&b.width?Math.hypot(b.width,b.height)/Math.SQRT2:Math.hypot(svg.clientWidth||svg.getBoundingClientRect().width,svg.clientHeight||svg.getBoundingClientRect().height)/Math.SQRT2);}return v;}
  function arc(e){
    if(!visible(e))return null;const s=getComputedStyle(e),k=kind(s.stroke);if(!k)return null;
    const m=e.getScreenCTM();if(!m)return null;
    let center,r,L,p0,full=true,orientation=1;
    if(e.tagName.toLowerCase()==='circle'){
      const geometry=(value,attribute,axis)=>{let text=String(value||'').trim();if(!text||text==='auto'||text==='none')return attribute.baseVal.value;
        if(text.endsWith('%')){const svg=e.ownerSVGElement,v=svg.viewBox.baseVal,w=v&&v.width?v.width:svg.clientWidth,h=v&&v.height?v.height:svg.clientHeight;return parseFloat(text)/100*(axis==='x'?w:axis==='y'?h:Math.hypot(w,h)/Math.SQRT2);}
        const result=lengthValue(text,e);return Number.isFinite(result)?result:attribute.baseVal.value;};
      r=geometry(s.r,e.r,'r');center={x:geometry(s.cx,e.cx,'x'),y:geometry(s.cy,e.cy,'y')};L=2*Math.PI*r;p0={x:center.x+r,y:center.y};
    } else {
      try{L=e.getTotalLength();if(L<8)return null;const a=e.getPointAtLength(0),b=e.getPointAtLength(L*.5),c=e.getPointAtLength(L*.95);const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<.01)return null;
        const A=a.x*a.x+a.y*a.y,B=b.x*b.x+b.y*b.y,C=c.x*c.x+c.y*c.y;center={x:(A*(b.y-c.y)+B*(c.y-a.y)+C*(a.y-b.y))/d,y:(A*(c.x-b.x)+B*(a.x-c.x)+C*(b.x-a.x))/d};r=Math.hypot(a.x-center.x,a.y-center.y);p0=a;
        for(let i=1;i<=6;i++){const p=e.getPointAtLength(L*i/7);if(Math.abs(Math.hypot(p.x-center.x,p.y-center.y)-r)>r*.04)return null;}
        const p=e.getPointAtLength(Math.min(1,L*.02));orientation=((a.x-center.x)*(p.y-a.y)-(a.y-center.y)*(p.x-a.x))>=0?1:-1;full=L>2*Math.PI*r*.98;
      }catch{return null;}
    }
    if(!(r>0&&Number.isFinite(r)))return null;
    const c=toScreen(m,center),p=toScreen(m,p0),x=toScreen(m,{x:center.x+r,y:center.y}),y=toScreen(m,{x:center.x,y:center.y+r});
    const radius=Math.hypot(x.x-c.x,x.y-c.y);if(radius<12||radius>Math.min(innerWidth,innerHeight)*.28||Math.abs(Math.hypot(y.x-c.x,y.y-c.y)-radius)>radius*.12)return null;
    orientation*=m.a*m.d-m.b*m.c>=0?1:-1;if(orientation!==1)return null;
    let start=angle(p,c),sweep=L/(2*Math.PI*r)*360;
    const dash=String(s.strokeDasharray).split(/[ ,]+/).filter(Boolean).map(v=>lengthValue(v,e));const off=lengthValue(s.strokeDashoffset,e)||0;
    const pathLength=e.pathLength&&e.pathLength.baseVal&&e.pathLength.baseVal.value;
    const factor=pathLength>0?L/pathLength:1;
    if(dash.length&&Number.isFinite(dash[0])){
      let d0=dash[0]*factor,o=off*factor;
      if(d0>=L*.9){sweep=Math.max(0,Math.min(L,d0-o))/(2*Math.PI*r)*360;}
      else if(dash.length>=2&&dash[1]*factor>=L-d0-1){start=norm(start-o/L*360);sweep=d0/(2*Math.PI*r)*360;}
      else return null;
    }else if(full)return null;
    if(sweep<0||sweep>360.5)return null;
    return {e,k,c,r:radius,start,sweep,end:norm(start+sweep),L};
  }
  let selection=null,scanAt=0;
  function readRing(){
    const W=innerWidth,H=innerHeight;
    function pair(d,g,a){if(!d||!visible(d)||!g||!a||g.k!=='green'||(a.k!=='white'&&a.k!=='indicator'))return null;const text=(d.textContent||'').trim();if(!/^[0-9]$/.test(text))return null;const b=box(d);if(Math.hypot(b.x+b.w/2-g.c.x,b.y+b.h/2-g.c.y)>g.r*.55||g.sweep<2||g.sweep>130||a.sweep<.2)return null;if(Math.hypot(a.c.x-g.c.x,a.c.y-g.c.y)>Math.max(4,g.r*.04)||Math.abs(a.r-g.r)>g.r*.15)return null;
      return {valid:true,present:true,key:+text,pointer:a.sweep<10?a.start:a.end,start:g.start,end:norm(g.start+g.sweep),span:g.sweep,radius:g.r,stamp:id(a.e)+':'+id(g.e),x:g.c.x-g.r*1.5,y:g.c.y-g.r*1.5,w:g.r*3,h:g.r*3};}
    if(selection){const g=arc(selection.g),a=arc(selection.a),r=pair(selection.d,g,a);if(r)return r;selection=null;}
    const t=performance.now();if(t<scanAt)return {valid:false,present:false};scanAt=t+20;
    const digits=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/^[0-9]$/.test((e.textContent||'').trim())&&visible(e)).map(e=>({e,b:box(e)})).filter(d=>Math.abs(d.b.x+d.b.w/2-W/2)<W*.28&&Math.abs(d.b.y+d.b.h/2-H/2)<H*.28&&d.b.h>9&&d.b.h<H*.23);
    const arcs=[...document.querySelectorAll('svg circle,svg path')].map(arc).filter(Boolean),matches=[];
    for(const d of digits)for(const g of arcs.filter(a=>a.k==='green'&&a.sweep>=2&&a.sweep<=130)){
      const whites=arcs.filter(a=>(a.k==='white'||a.k==='indicator')&&Math.hypot(a.c.x-g.c.x,a.c.y-g.c.y)<Math.max(4,g.r*.04)&&Math.abs(a.r-g.r)<g.r*.15);
      if(whites.length!==1)continue;const r=pair(d.e,g,whites[0]);if(r)matches.push({r,s:{d:d.e,g:g.e,a:whites[0].e}});
    }
    if(matches.length===1){selection=matches[0].s;return matches[0].r;}
    if(matches.length>1)return {valid:false,present:true,ambiguous:true};
    if(digits.length===1){const d=digits[0];let shape=null;for(let p=d.e.parentElement,n=0;p&&n<5;p=p.parentElement,n++){const b=box(p);if(b.w>40&&b.w<Math.min(W,H)*.65&&b.h>40&&b.h<Math.min(W,H)*.65&&Math.abs(b.w-b.h)<Math.max(b.w,b.h)*.25){shape=b;break;}}
      if(shape&&[...document.querySelectorAll('svg,canvas')].some(e=>{if(!visible(e))return false;const b=box(e);return b.w>30&&b.h>30&&Math.abs(d.b.x+d.b.w/2-(b.x+b.w/2))<b.w*.4&&Math.abs(d.b.y+d.b.h/2-(b.y+b.h/2))<b.h*.4;}))return {valid:false,present:true,key:+d.e.textContent.trim(),stamp:'pixel:'+id(d.e),...shape};}
    return {valid:false,present:false};
  }
  const messageVitals={hunger:null,water:null,at:-100000};
  function hudMessage(event){const d=event&&event.data;if(!d||typeof d!=="object")return;
    const body=d.data&&typeof d.data==="object"?d.data:d;
    const clean=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100?Number(v):null;
    const h=clean(body.hunger),w=clean(body.thirst===undefined?body.water:body.thirst);
    if(h!==null||w!==null){messageVitals.hunger=h;messageVitals.water=w;messageVitals.at=performance.now();}
  }
  window.addEventListener('message',hudMessage);
  let ancillary={busy:false,notices:[],hunger:null,water:null},ancillaryAt=-1;
  function readAncillary(){
    const recent=performance.now()-messageVitals.at<10000;let hunger=recent?messageVitals.hunger:null,water=recent?messageVitals.water:null;const out=[];
    for(const e of document.querySelectorAll('[role="alert"],[class*="Notification"],[class*="notification"],[class*="toast"]')){
      if(!visible(e)||e.querySelector('[role="alert"],[class*="Notification-root"],[class*="notification-item"]'))continue;const t=(e.innerText||e.textContent||'').trim();if(!t){notices.delete(e);continue;}if(t.length>400)continue;
      const k=/インベントリ.*(いっぱい|満|重)|持ち物.*(いっぱい|持て)|所持.*(上限|重量)|not enough (space|capacity)|inventory.*full/i.test(t)?'FULL':/釣り竿.*(壊|ない)|釣り餌.*[足無]|餌が[足無]|エサが[足無]|no.*bait|rod.*broken/i.test(t)?'BLOCK':/魚に逃げ|釣りに失敗|逃げられ|逃がし|釣れなか|fish.*(escaped|got away)|failed.*fish/i.test(t)?'FAIL':/釣り.*(やめ|終了|中断)|fishing.*(cancel|stop)/i.test(t)?'CANCEL':/魚.*(釣れ|釣り上げた)|釣り上げました|魚を.*(獲得|入手)|caught.*fish/i.test(t)?'CAUGHT':/食いつ|アタリ|fish.*bit/i.test(t)?'BITE':/釣り.*(開始|始め)|竿.*投げ|キャスト|エサ.*待|fishing.*start|cast.*line/i.test(t)?'CAST':/使用できません|今は.*(使え|使用)|already.*fishing|釣り中|busy/i.test(t)?'BUSY':'NONE';
      if(k==='NONE')continue;const old=notices.get(e),n=old&&old.text===t?old.id:noticeId++;notices.set(e,{text:t,id:n});out.push({kind:k,id:n});
    }
    const busy=[...document.querySelectorAll('[role="progressbar"],#progressbar,#progress-container,.progress-bar')].some(e=>{if(!visible(e))return false;const b=box(e);return b.x+b.w/2>innerWidth*.25&&b.x+b.w/2<innerWidth*.75&&b.y>innerHeight*.5&&b.w>30;});
    for(const e of document.querySelectorAll('[aria-valuenow],[data-value],progress')){if(!visible(e))continue;const name=((e.getAttribute('aria-label')||'')+' '+(e.id||'')+' '+(e.getAttribute('class')||'')).toLowerCase(),raw=e.getAttribute('aria-valuenow')??e.getAttribute('data-value')??e.value;if(raw==null)continue;const v=+raw,m=+(e.getAttribute('aria-valuemax')||e.max||100);if(!Number.isFinite(v)||m<=0||v<0||v>m)continue;if(/hunger|空腹|食事/.test(name))hunger=v/m*100;if(/thirst|hydration|水分/.test(name))water=v/m*100;}
    return {busy,notices:out,hunger,water};
  }
  const state={cycle:'',stamp:'',key:-1,start:0,span:0,lastPointer:0,lastAt:0,stable:0,round:0,latched:false,lastDown:-1,seq:0,delivery:'idle',lastSent:null,up:null};
  function keyboard(r,cycle){
    if(!cycle||!r.valid||!selection)return {sent:false,reason:'no_native_ring'};const now=performance.now();
    if(state.cycle!==cycle){Object.assign(state,{cycle,stamp:'',key:-1,stable:0,round:0,latched:false,lastDown:-1,lastAt:0,delivery:'idle'});}
    const changed=state.stamp!==r.stamp||state.key!==r.key||Math.abs(delta(r.start,state.start))>5||Math.abs(r.span-state.span)>5||(state.lastAt>0&&r.pointer<state.lastPointer-45&&!(state.lastPointer>300&&r.pointer<60&&now-state.lastAt<200));
    if(changed){if(state.latched)state.delivery='transition_observed';state.stamp=r.stamp;state.key=r.key;state.start=r.start;state.span=r.span;state.round++;state.latched=false;state.stable=0;}
    state.stable++;state.lastPointer=r.pointer;state.lastAt=now;
    const progress=norm(r.pointer-r.start),margin=Math.max(.35,Math.min(3,r.span*.10));
    if(state.latched||state.stable<2||progress<margin||progress>r.span-margin)return {sent:false,reason:state.latched?'latched':'tracking'};
    const active=document.activeElement;if(active&&active.matches('input,textarea,[contenteditable="true"]'))return {sent:false,reason:'editing'};
    if(state.release){state.release();state.release=null;}
    const target=selection.d;state.latched=true;state.lastDown=now;state.seq++;state.delivery='sent_unconfirmed';
    const init={key:String(r.key),code:'Digit'+r.key,keyCode:48+r.key,which:48+r.key,bubbles:true,composed:true,cancelable:true,repeat:false};
    target.dispatchEvent(new KeyboardEvent('keydown',init));
    const release=()=>{if(state.up){clearTimeout(state.up);state.up=null;}(target.isConnected?target:window).dispatchEvent(new KeyboardEvent('keyup',init));};
    // Only release is deferred; no delayed key-down.
    state.up=setTimeout(release,24);state.release=release;
    state.lastSent={key:r.key,round:state.round,pointer:r.pointer,start:r.start,end:r.end,at:now,seq:state.seq};
    return {sent:true,...state.lastSent,reason:'inside_observed_window'};
  }
  const api={version:'0.6.3-background',
    sample(fast,command){
      const begin=performance.now(),r=readRing();let input={sent:false,reason:'observe'};
      if(command&&command.enabled===true&&typeof command.cycle==='string')input=keyboard(r,command.cycle);
      if(!r.present&&state.latched)state.delivery='transition_observed';
      if(!fast||(!r.present&&begin-ancillaryAt>=100)){ancillary=readAncillary();ancillaryAt=begin;}
      return JSON.stringify({w:innerWidth,h:innerHeight,at:begin,ring:r,...ancillary,input,delivery:state.delivery,cost:performance.now()-begin,documentVisible:document.visibilityState,focused:document.hasFocus(),svgCount:document.querySelectorAll("svg").length});
    },
    dispose(){this.stop();window.removeEventListener('message',hudMessage);},
    stop(){if(state.release){state.release();state.release=null;}state.latched=true;state.cycle='';return 'STOPPED';},
    pixelKey(request){const r=readRing();if(!r.present||r.key!==request.key||r.stamp!==request.stamp||!request.inside)return 'STALE';if(r.valid){const p=norm(r.pointer-r.start),s=norm(r.end-r.start);if(p<1||p>s-1)return 'LATE';}
      const d=[...document.querySelectorAll('body *')].find(e=>e.children.length===0&&visible(e)&&id(e)===+String(r.stamp).split(':')[1]);
      const a=document.activeElement;if(a&&a.matches('input,textarea,[contenteditable="true"]'))return 'EDITING';const target=d||document.body;
      const init={key:String(r.key),code:'Digit'+r.key,keyCode:48+r.key,which:48+r.key,bubbles:true,composed:true,cancelable:true};target.dispatchEvent(new KeyboardEvent('keydown',init));setTimeout(()=>target.dispatchEvent(new KeyboardEvent('keyup',init)),24);return 'SENT';}
  };
  window.__fpProbe3=api;
  return api.sample(false,null);
})()
