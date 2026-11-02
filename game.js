'use strict';
(()=>{
const $=id=>document.getElementById(id), KEY='bj-save-v4', START=500, MIN=5;
const SUITS=['♠','♥','♦','♣'], RANKS=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
// Payouts (X to 1). Tune here.
// Combined card-match side bet: two spots, same tiers, highest tier only.
// LEFT 'Dealer Match' = your first 2 cards vs the dealer's upcard. RIGHT 'Hand Match' = your first 2 cards vs each other.
const PAY={sbj:100,stie:50,spair:25,pair:10,smatch:5,rmatch:3,consec:3};
const TIER={sbj:'Suited Blackjack',stie:'Suited Tie',spair:'Suited Pair',pair:'Pair',smatch:'Suited Match',rmatch:'Rank Match',consec:'Consecutive'};
const SIDE_NAMES={dm:'Dealer Match',hm:'Hand Match'},SIDES=['dm','hm'];const SMIN=1,DENOMS=[500,100,50,25,10,5,1];
const DEF={h17:false,splits:1,rsa:false,das:true,ins:false,surr:true,speed:'normal'};
let st=load();
function load(){try{const old=JSON.parse(localStorage.getItem('suitedBJ.v1')||'null');if(old&&!localStorage.getItem(KEY)){localStorage.removeItem('suitedBJ.v1');const f=fresh();if(old.stats)f.stats=old.stats;if(old.hist)f.hist=old.hist;if(old.set)f.set=Object.assign({},DEF,old.set);f.tut=!!old.tut;f.muted=!!old.muted;return f}}catch(e){}
  try{const o=JSON.parse(localStorage.getItem(KEY));if(o&&typeof o.bal==='number')return Object.assign(fresh(),o,{set:Object.assign({},DEF,o.set)})}catch(e){}return fresh()}
function fresh(){return{bal:START,stats:{hands:0,w:0,l:0,p:0,big:0,streak:0,net:0,bj:0},hist:[],set:{...DEF},last:null,tut:false,muted:false}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}

// ---- shoe ----
let shoe=[],cut=0,forced=[];
function newShoe(){shoe=[];for(let d=0;d<6;d++)for(let s=0;s<4;s++)for(let r=1;r<=13;r++)shoe.push({r,s});
  for(let i=shoe.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shoe[i],shoe[j]]=[shoe[j],shoe[i]]}cut=Math.floor(shoe.length*.25);}
function draw(){if(forced.length)return forced.shift();return shoe.pop()}
const val=c=>c.r>=10?10:c.r;
function total(cs){let t=0,a=0;for(const c of cs){t+=val(c);if(c.r===1)a++}const soft=a&&t+10<=21;return{t:soft?t+10:t,soft:!!soft}}
const isBJ=cs=>cs.length===2&&total(cs).t===21;
const totStr=cs=>{const x=total(cs);return x.t>21?'Bust '+x.t:(x.soft&&x.t<21?'soft '+x.t:''+x.t)};

// ---- state ----
let bets={main:0,dm:0,hm:0}, spot='main', phase='bet', hands=[], dealer=[], active=0, insBet=0, wager=0, ret=0, holeDown=true, busy=false;
const money=n=>'$'+(Math.round(n*100)/100).toLocaleString(undefined,{maximumFractionDigits:2});
const TMAX=1e9;const SPD=()=>RMQ?0.5:(st&&st.set&&st.set.speed==='fast'?0.6:1.1);const sleep=ms=>new Promise(r=>setTimeout(r,FAST?0:ms*SPD()));const RMQ=matchMedia('(prefers-reduced-motion: reduce)').matches;let FAST=false;
const betSum=()=>Object.values(bets).reduce((a,b)=>a+b,0);

// ---- rendering ----
function cardEl(c,down){const e=document.createElement('div');e.className='card'+(down?' down':'');const red=c.s===1||c.s===2;
  const rk=RANKS[c.r],su=SUITS[c.s];
  e.innerHTML=`<div class="in"><div class="face${red?' red':''}"><div class="tl">${rk}<br>${su}</div><div class="mid">${c.r>10?(['J','Q','K'][c.r-11]+su):su}</div><div class="br">${rk}<br>${su}</div></div><div class="back"></div></div>`;
  if(c.shown)e.style.animation='none';c.shown=true;return e}
let wasDown=false;function renderDealer(){const d=$('dealer');d.innerHTML='';dealer.forEach((c,i)=>{const e=cardEl(c,i===1&&holeDown);if(i===1&&!holeDown&&wasDown)e.classList.add('flip');d.appendChild(e)});wasDown=dealer.length>1&&holeDown;
  fitCards($('dealer'));$('dTot').textContent=dealer.length?(holeDown?totStr([dealer[0]]):totStr(dealer)):''}
function renderHands(){const h=$('hands');h.innerHTML='';
  hands.forEach((hd,i)=>{const w=document.createElement('div');w.className='hand n'+hands.length+(phase==='play'&&i===active?' act':'')+(phase==='done'?(/win|Blackjack|Even/i.test(hd.res||'')?' won':/Push/.test(hd.res||'')?' push':hd.res?' lost':''):'');
    const cs=document.createElement('div');cs.className='cards';hd.cards.forEach(c=>cs.appendChild(cardEl(c)));
    w.innerHTML=`<div class="lbl">${hands.length>1?'Hand '+(i+1)+' · ':''}${money(hd.bet)} <span class="tot">${hd.cards.length?totStr(hd.cards):''}</span></div>`;
    w.appendChild(cs);const r=document.createElement('div');r.className='res';r.textContent=hd.res||'';r.style.color=/win|Blackjack|Even/i.test(hd.res||'')?'#8ef0a6':/Push/.test(hd.res||'')?'#ddd':'#ff9a9a';w.appendChild(r);h.appendChild(w)});h.querySelectorAll('.cards').forEach(fitCards)}
// Spread cards edge-to-edge when they fit; otherwise overlap only enough to leave each card's rank/suit corner (>=PIP px) visible.
function fitCards(cs){const c=[...cs.children];if(!c.length)return;const W=c[0].offsetWidth||74,PIP=W>60?34:26,avail=Math.max(W,cs.clientWidth-8);
  const step=c.length>1?Math.max(PIP,Math.min(W+6,(avail-W)/(c.length-1))):0;c.forEach((e,i)=>{e.style.marginLeft=i?(step-W)+'px':'0';e.style.zIndex=i+1})}
addEventListener('resize',()=>document.querySelectorAll('.cards').forEach(fitCards));
let stacks={main:[],dm:[],hm:[]},fresh1=null,undoLog=[],selV=5;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
function decomp(a){const o=[];for(const d of DENOMS)while(a>=d-1e-9){o.push(d);a-=d}return o.reverse().length?o.sort((x,y)=>y-x):o}
const sum=a=>a.reduce((x,y)=>x+y,0);
function renderBets(){document.querySelectorAll('.spot').forEach(sp=>{const k=sp.dataset.b;if(sum(stacks[k])!==bets[k]){stacks[k]=decomp(bets[k]);undoLog=undoLog.filter(u=>u!==k)}
    const st_=sp.querySelector('.stack'),n=stacks[k].length,show=stacks[k].slice(-10);let h='';show.forEach((v,i)=>{const isNew=fresh1&&fresh1.k===k&&i===show.length-1;h+=`<div class="pc c${v}${isNew?' new':''}" style="bottom:${i*5}px;z-index:${i}"><i>${v}</i></div>`});
    st_.innerHTML=h;st_.style.setProperty('--h',show.length*5+'px');sp.classList.toggle('has',n>0);sp.querySelector('b').textContent=money(bets[k])});
  fresh1=null;$('tBet').textContent=money(betSum());
  $('bal').textContent=money(st.bal);const ok=bets.main>=MIN&&betSum()<=st.bal;$('bDeal').disabled=!ok;
  $('hint').textContent=bets.main<MIN?'Main bet min $'+MIN+' · side bets $'+SMIN+'+':'Ready — tap Deal';$('hint').className=bets.main<MIN?'':'ok';
  const L=st.last,ls=L?Object.values(L).reduce((a,b)=>a+b,0):0;$('bRD').disabled=!L||L.main<MIN||ls>st.bal;$('bRebet').disabled=$('bRD').disabled;$('bUndo').disabled=!undoLog.length;
  document.querySelectorAll('.rack .pc').forEach(c=>c.classList.toggle('sel',+c.dataset.v===selV));
  $('ruleLine').textContent=st.set.h17?'DEALER HITS SOFT 17':'DEALER STANDS ON SOFT 17'}
function showArea(a){for(const x of ['betArea','actArea','insArea'])$(x).classList.toggle('hidden',x!==a)}
function placeBanner(){const b=$('banner'),t=(b.offsetParent||document.body).getBoundingClientRect(),dc=[...document.querySelectorAll('#dealer .card')].map(e=>e.getBoundingClientRect()),hc=[...document.querySelectorAll('#hands .card')].map(e=>e.getBoundingClientRect());
  const lo=dc.length?Math.max(...dc.map(r=>r.bottom)):t.top+40,sr=$('sideRes'),srr=sr.getBoundingClientRect(),hi0=hc.length?Math.min(...hc.map(r=>r.top)):t.bottom-40,hi=(innerHeight>=620&&sr.children.length&&srr.height&&srr.top>lo)?Math.min(hi0,srr.top):hi0,gap=Math.max(22,hi-lo-4);
  b.style.top=((lo+hi)/2-t.top)+'px';b.style.whiteSpace='nowrap';b.style.padding=gap<40?'0 10px':gap<60?'2px 14px':'';let f=Math.min(32,gap*.62);b.style.fontSize=f+'px';
  for(let k=0;k<20&&(b.offsetHeight>gap||b.offsetWidth>innerWidth*.94)&&f>(innerHeight<620?10:14);k++){f-=1.5;b.style.fontSize=f+'px'}}
addEventListener('resize',placeBanner);
function banner(txt,cls){const b=$('banner');b.textContent=txt;b.className=cls+' show';document.body.classList.add('result');placeBanner();requestAnimationFrame(placeBanner);setTimeout(placeBanner,60);setTimeout(placeBanner,200);clearTimeout(b._t);b._t=setTimeout(()=>{b.className='';document.body.classList.remove('result')},1700)}
function toastLast(net){const l=$('last');l.textContent=net>0?'Won '+money(net):net<0?'Lost '+money(-net):'Push';l.className='last '+(net>0?'w':net<0?'l':'')}

// ---- betting ----
function spotEl(k){return document.querySelector('.spot[data-b="'+k+'"]')}
function nope(k,m){sfx('err');vib(30);flash(m);const e=k&&spotEl(k);if(e){e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake')}}
function place(k,v,from){if(phase!=='bet')return false;
  if(betSum()+v>st.bal){nope(k,'Not enough balance');return false}
  stacks[k].push(v);bets[k]+=v;undoLog.push(k);fresh1={k};renderBets();
  const top=spotEl(k).querySelector('.pc.new');
  if(top&&!RM){const d=from?flyChip(v,from,top):0;top.style.animationDelay=d+'ms';setTimeout(()=>sfx('clack'),d+140)}else{if(top)top.classList.remove('new');sfx('clack')}
  vib(8);return true}
function unplace(k){if(phase!=='bet'||!stacks[k].length)return;const v=stacks[k].pop();bets[k]-=v;const i=undoLog.lastIndexOf(k);if(i>=0)undoLog.splice(i,1);sfx('tick');renderBets()}
function flyChip(v,from,to){const a=from,b=to.getBoundingClientRect();const e=document.createElement('div');e.className='pc fly3 c'+v;e.innerHTML='<i>'+v+'</i>';document.body.appendChild(e);
  const sx=a.x-23,sy=a.y-23,ex=b.left+b.width/2-23,ey=b.top+b.height/2-23,sc=b.width/46;
  const dur=Math.min(520,280+Math.hypot(ex-sx,ey-sy)*.6);
  e.animate([{transform:`translate(${sx}px,${sy}px) scale(1)`},{transform:`translate(${(sx+ex)/2}px,${Math.min(sy,ey)-70}px) scale(${1.15})`,offset:.5},{transform:`translate(${ex}px,${ey}px) scale(${sc})`}],{duration:dur,easing:'cubic-bezier(.3,.6,.4,1)'}).onfinish=()=>e.remove();
  return dur}
// rack: tap selects, drag places
document.querySelectorAll('.rack .pc').forEach(c=>{c.addEventListener('pointerdown',e=>{if(phase!=='bet')return;e.preventDefault();const v=+c.dataset.v;const r=c.getBoundingClientRect();
  let drag=null,x0=e.clientX,y0=e.clientY;try{c.setPointerCapture(e.pointerId)}catch(_){}
  const mv=ev=>{if(!drag&&Math.hypot(ev.clientX-x0,ev.clientY-y0)>8){drag=document.createElement('div');drag.className='pc drag c'+v;drag.innerHTML='<i>'+v+'</i>';document.body.appendChild(drag);selV=v;renderBets()}
    if(drag){drag.style.transform=`translate(${ev.clientX-30}px,${ev.clientY-40}px) scale(1.15)`;const sp=hit(ev.clientX,ev.clientY);document.querySelectorAll('.spot.over').forEach(s=>s!==sp&&s.classList.remove('over'));if(sp)sp.classList.add('over')}};
  const up=ev=>{c.removeEventListener('pointermove',mv);c.removeEventListener('pointerup',up);c.removeEventListener('pointercancel',up);document.querySelectorAll('.spot.over').forEach(s=>s.classList.remove('over'));
    if(drag){const sp=ev.type==='pointerup'&&hit(ev.clientX,ev.clientY);drag.remove();if(sp)place(sp.dataset.b,v,{x:ev.clientX,y:ev.clientY-10})}
    else{selV=v;sfx('tick');renderBets()}};
  c.addEventListener('pointermove',mv);c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up)})});
function hit(x,y){const e=document.elementFromPoint(x,y),sp=e&&e.closest('.spot');if(sp)return sp;let best=null,bd=1e9;
  document.querySelectorAll('.spot .ring').forEach(r=>{const b=r.getBoundingClientRect(),d=Math.hypot(x-b.left-b.width/2,y-b.top-b.height/2);if(d<b.width*.62&&d<bd){bd=d;best=r.closest('.spot')}});return best}
document.querySelectorAll('.spot').forEach(sp=>{const k=sp.dataset.b;let t=null,held=false;
  sp.querySelector('.minus').addEventListener('click',e=>{e.stopPropagation();unplace(k)});
  sp.addEventListener('pointerdown',e=>{if(e.target.closest('.minus'))return;held=false;clearTimeout(t);t=setTimeout(()=>{held=true;unplace(k);vib(20)},550)});
  ['pointerup','pointercancel','pointerleave'].forEach(n=>sp.addEventListener(n,()=>clearTimeout(t)));
  sp.addEventListener('click',e=>{if(held||e.target.closest('.minus')){held=false;return}const r=document.querySelector('.rack .pc.sel').getBoundingClientRect();place(k,selV,{x:r.left+r.width/2,y:r.top+r.height/2})})});
$('bUndo').onclick=()=>{if(undoLog.length)unplace(undoLog[undoLog.length-1])};
$('bClear').onclick=()=>{if(phase!=='bet')return;for(const k in bets)bets[k]=0;sfx('tick');renderBets()};
$('bX2').onclick=()=>{if(phase!=='bet')return;if(betSum()*2>st.bal||!betSum()){sfx('err');flash('Not enough balance');return}for(const k in bets)bets[k]*=2;sfx('chip');renderBets()};
$('bMax').onclick=()=>{if(phase!=='bet')return;const other=betSum()-bets.main,m=Math.floor(st.bal-other);if(m<MIN){nope('main','Not enough balance for $'+MIN+' main bet');return}bets.main=m;sfx('clack');renderBets()};
$('bRebet').onclick=()=>{if(phase!=='bet'||!st.last)return;bets={...st.last};renderBets()};
$('bDeal').onclick=()=>deal();
$('bRD').onclick=()=>{if(!st.last)return;bets={...st.last};renderBets();deal()};
function flash(m){const l=$('last');l.textContent=m;l.className='last l'}

// ---- round ----
async function clearTable(){const cs=[...document.querySelectorAll('#table .card')];if(!cs.length||FAST)return;document.body.classList.add('clearing');cs.forEach((c,i)=>c.style.setProperty('--ci',i));await sleep(640);document.body.classList.remove('clearing')}
async function deal(){
  if(phase!=='bet'||busy)return;
  if(bets.main<MIN){flash('Place a main bet');sfx('err');return}
  if(betSum()>st.bal){flash('Not enough balance');sfx('err');return}
  busy=true;st.last={...bets};wager=betSum();ret=0;st.bal-=wager;insBet=0;
  if(shoe.length<cut||!shoe.length){newShoe();flash('Shuffling new shoe…');await sleep(500)}
  await clearTable();hands=[{cards:[],bet:bets.main}];dealer=[];holeDown=true;active=0;phase='deal';$('sideRes').innerHTML='';
  showArea(null);renderBets();renderDealer();renderHands();
  for(const who of ['p','d','p','d']){if(who==='p')hands[0].cards.push(draw());else dealer.push(draw());sfx('card');vib(5);renderDealer();renderHands();await sleep(320)}
  settleSides();
  const up=dealer[0], p=hands[0].cards, pBJ=isBJ(p);
  if(up.r===1&&st.set.ins){
    const half=Math.floor(hands[0].bet/2*100)/100;
    if(pBJ){$('insTxt').textContent='Even money? (take 1:1 now)';const ok=await ask();
      if(ok){holeDown=false;renderDealer();hands[0].res='Even money';hp(hands[0],hands[0].bet*2);return finish()}}
    else if(st.bal>=half){$('insTxt').textContent='Insurance for '+money(half)+'?';const ok=await ask();if(ok){insBet=half;st.bal-=half;wager+=half;renderBets()}}
  }
  if(up.r===1||val(up)===10){
    if(isBJ(dealer)){holeDown=false;sfx('flip');renderDealer();await sleep(400);
      if(insBet){payout(insBet*3);flash('Insurance pays!')}
      hands[0].res=pBJ?'Push':'Dealer Blackjack';if(pBJ)hp(hands[0],hands[0].bet);return finish()}
    else if(insBet){flash('No dealer blackjack, insurance lost')}
  }
  if(pBJ){holeDown=false;sfx('flip');renderDealer();hands[0].res='Blackjack!';hp(hands[0],hands[0].bet*2.5);st.stats.bj++;return finish()}
  phase='play';busy=false;showArea('actArea');renderHands();updateActions();
}
function ask(){showArea('insArea');return new Promise(r=>{$('iYes').onclick=()=>{showArea(null);r(true)};$('iNo').onclick=()=>{showArea(null);r(false)}})}
function payout(a){ret+=a;st.bal+=a}
function hp(h,a){h.ret=(h.ret||0)+a;payout(a)}
// One shared evaluator. ref = dealer upcard (left spot) or null (right spot: player's own two cards).
function sideTier(a,b,ref){
  const suited=a.s===b.s, sameR=a.r===b.r;
  if(isBJ([a,b])&&suited)return 'sbj';
  if(sameR&&suited)return (!ref||ref.s===a.s)?'stie':'spair';
  if(sameR)return 'pair';
  if(ref){if([a,b].some(c=>c.r===ref.r&&c.s===ref.s))return 'smatch';if([a,b].some(c=>c.r===ref.r))return 'rmatch';return null}
  return Math.abs(a.r-b.r)===1?'consec':null}
function settleSides(){
  const [a,b]=hands[0].cards, up=dealer[0], out=[], res={dm:sideTier(a,b,up),hm:sideTier(a,b,null)};
  for(const k of SIDES){const amt=+bets[k]||0;if(!amt)continue;const t=res[k];
    if(t){const x=PAY[t],win=amt*x;payout(amt+win);out.push(`<span class="win">${SIDE_NAMES[k]}: ${TIER[t]} ${x}:1 +${money(win)}</span>`);sfx('win');vib([20,30,20])}
    else out.push(`<span>${SIDE_NAMES[k]} ✗</span>`)}
  if(!bets.hm&&!bets.dm&&res.hm==='sbj')out.push('<span>Suited Blackjack! (no side bet placed)</span>');
  $('sideRes').innerHTML=out.join('');lastSide=res;renderBets();
}
let lastSide=null,lastBanner='';
function cur(){return hands[active]}
function canDouble(h){return phase==='play'&&h.cards.length===2&&!h.aces&&st.bal>=h.bet&&(!h.split||st.set.das)}
function canSplit(h){return phase==='play'&&h.cards.length===2&&val(h.cards[0])===val(h.cards[1])&&hands.length<st.set.splits+1&&st.bal>=h.bet&&(!h.aces||st.set.rsa)}
function canSurr(h){return phase==='play'&&st.set.surr&&hands.length===1&&h.cards.length===2&&!h.split}
function updateActions(){const h=cur();if(!h)return;$('aHit').disabled=!!h.aces;$('aDouble').disabled=!canDouble(h);$('aSplit').disabled=!canSplit(h);$('aSurr').disabled=!canSurr(h);$('aStand').disabled=false}
async function act(fn){if(phase!=='play'||busy)return;busy=true;await fn();busy=false;if(phase==='play')updateActions()}
$('aHit').onclick=()=>act(async()=>{const h=cur();if(h.aces)return;h.cards.push(draw());sfx('card');vib(5);renderHands();await sleep(420);const t=total(h.cards).t;if(t>21){h.res='Bust';sfx('bust');await next()}else if(t===21)await next()});
$('aStand').onclick=()=>act(async()=>{sfx('tick');await next()});
$('aDouble').onclick=()=>act(async()=>{const h=cur();if(!canDouble(h))return;st.bal-=h.bet;wager+=h.bet;h.bet*=2;h.doubled=true;h.cards.push(draw());sfx('chip');renderBets();renderHands();await sleep(300);if(total(h.cards).t>21){h.res='Bust';sfx('bust')}await next()});
$('aSplit').onclick=()=>act(async()=>{const h=cur();if(!canSplit(h))return;st.bal-=h.bet;wager+=h.bet;const aces=h.cards[0].r===1;
  const nh={cards:[h.cards.pop()],bet:h.bet,split:true,aces};h.split=true;h.aces=aces;hands.splice(active+1,0,nh);renderBets();renderHands();await sleep(250);
  h.cards.push(draw());sfx('card');renderHands();await sleep(250);nh.cards.push(draw());sfx('card');renderHands();await sleep(250);
  if(aces){const pairAgain=h=>h.cards[1].r===1&&st.set.rsa&&hands.length<st.set.splits+1;if(!pairAgain(h)){await next()}}
  else if(total(h.cards).t===21)await next()});
$('aSurr').onclick=()=>act(async()=>{const h=cur();if(!canSurr(h))return;h.res='Surrendered';h.surr=true;hp(h,h.bet/2);sfx('bust');await next()});
async function next(){
  // advance; auto-finish split-ace hands
  active++;
  while(active<hands.length){const h=hands[active];
    if(h.aces&&!(h.cards[1]&&h.cards[1].r===1&&st.set.rsa&&hands.length<st.set.splits+1)){active++;continue}
    if(total(h.cards).t===21){active++;continue}break}
  renderHands();
  if(active>=hands.length)await dealerPlay();else updateActions();
}
// busts first, then compare; equal totals push. (BJ handled before play.)
function outcome(t,dt){if(t>21)return 'Bust';if(dt>21)return 'Dealer busts — You win';if(t>dt)return 'Win';if(t===dt)return 'Push';return 'Lose'}
async function dealerPlay(){
  phase='dealer';showArea(null);await sleep(250);holeDown=false;sfx('flip');renderDealer();renderHands();await sleep(700);
  const live=hands.some(h=>!h.surr&&total(h.cards).t<=21);
  if(live){for(;;){const d=total(dealer);if(d.t<17||(d.t===17&&d.soft&&st.set.h17)){dealer.push(draw());sfx('card');renderDealer();await sleep(520)}else break}}
  const dt=total(dealer).t;
  for(const h of hands){if(h.surr)continue;const t=total(h.cards).t;
    h.res=outcome(t,dt);if(h.res!=='Bust'&&h.res!=='Lose')hp(h,h.res==='Push'?h.bet:h.bet*2)}
  finish();
}
async function finish(){
  phase='done';busy=false;renderDealer();renderHands();
  const net=Math.round((ret-wager)*100)/100, s=st.stats;
  s.hands++;s.net+=net;if(net>0){s.w++;s.streak=s.streak>0?s.streak+1:1;s.big=Math.max(s.big,net)}else if(net<0){s.l++;s.streak=s.streak<0?s.streak-1:-1}else s.p++;
  const desc=hands.map(h=>h.res).join(' / ');
  st.hist.unshift({n:s.hands,net,desc,p:hands.map(h=>totStr(h.cards)).join(','),d:totStr(dealer),bal:st.bal});st.hist=st.hist.slice(0,25);
  st.bal=Math.max(0,Math.round(st.bal*100)/100);save();
  const bj=hands.some(h=>h.res==='Blackjack!');
  // Banner reflects the MAIN hand(s) only; side bets are reported separately.
  const mBet=hands.reduce((a,h)=>a+h.bet,0),mRet=hands.reduce((a,h)=>a+(h.ret||0),0),dBust=total(dealer).t>21&&hands.some(h=>/Dealer busts/.test(h.res||''));
  const sideTxt=net!==mRet-mBet?' (net '+(net>=0?'+':'−')+money(Math.abs(net))+')':'';
  if(bj){banner('BLACKJACK!','bj');sfx('bj');vib([30,50,30,50,60]);chipShower();sparkle(18)}
  else if(dBust&&mRet>mBet){banner('DEALER BUSTS — YOU WIN','win');sfx('win');vib([20,40,20]);chipShower();sparkle(10)}
  else if(mRet>mBet){banner('YOU WIN '+money(mRet-mBet),'win');sfx('win');vib([20,40,20]);chipShower();sparkle(10)}
  else if(mRet<mBet){banner(hands.length===1&&hands[0].res==='Bust'?'BUST':hands.length===1&&hands[0].surr?'SURRENDERED':'DEALER WINS','lose');sfx('lose');pullChips()}
  else {banner('PUSH','push');sfx('tick')}
  lastBanner=$('banner').textContent+sideTxt;
  toastLast(net);
  for(const k in bets)if(bets[k]>0&&false)bets[k]=0;
  // keep bets for rebet but cap to balance
  if(betSum()>st.bal)for(const k in bets)bets[k]=0;
  await sleep(900);phase='bet';showArea('betArea');renderBets();
  if(st.bal<MIN)gameOver();
}
function gameOver(){modal(`<h2>💸 Out of chips</h2><p>You played ${st.stats.hands} hands. Biggest win: ${money(st.stats.big)}.</p>`,'<button class="okbtn" id="go">Reset to $500</button>',()=>{if(st.bal<MIN)resetAll()});$('go').onclick=()=>closeModal()}
function resetAll(){undoLog=[];const t=st.tut,m=st.muted;st=fresh();st.tut=t;st.muted=m;for(const k in bets)bets[k]=0;hands=[];dealer=[];$('sideRes').innerHTML='';$('last').textContent='';renderDealer();renderHands();renderBets();save()}

// ---- sheets ----
let sheetBg=document.createElement('div');sheetBg.id='sheetBg';sheetBg.className='hidden';document.body.appendChild(sheetBg);
function closeSheet(){$('sheet').classList.add('hidden');sheetBg.classList.add('hidden')}
sheetBg.addEventListener('click',closeSheet);
function sheet(h){const s=$('sheet');s.innerHTML='<button class="ib x" id="sx" aria-label="Close">✕</button>'+h;s.classList.remove('hidden');sheetBg.classList.remove('hidden');$('sx').onclick=closeSheet}
let onModalClose=null;
function modal(h,foot,onClose){onModalClose=onClose||null;$('mCard').innerHTML='<button class="mx" id="mx" aria-label="Close">✕</button><div class="mbody">'+h+'</div>'+(foot?'<div class="mfoot">'+foot+'</div>':'');$('modal').classList.remove('hidden');$('mx').onclick=()=>closeModal()}
function closeModal(){$('modal').classList.add('hidden');$('mCard').innerHTML='';const f=onModalClose;onModalClose=null;if(f)f()}
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
$('bHelp').onclick=()=>sheet(`<h3>Rules</h3><ul><li>6-deck shoe, reshuffled at ~75% penetration.</li><li>Blackjack pays 3:2. Dealer ${st.set.h17?'hits':'stands on'} soft 17 (change in ⚙️).</li><li>Double on any first two cards${st.set.das?' (also after split)':''}. Split up to ${st.set.splits+1} hands. Split aces get one card each${st.set.rsa?' (resplit aces allowed)':''}. 21 after a split is not a blackjack.</li><li>Late surrender ${st.set.surr?'allowed':'off'} (get half back). Insurance/even money ${st.set.ins?'offered':'off'} (insurance pays 2:1).</li><li>Dealer peeks for blackjack with an Ace or 10 up.</li></ul>
<h3>Side bet: Dealer Match (left) &amp; Hand Match (right)</h3><p>One combined side bet with two spots, each its own bet ($${SMIN} min, $1 steps). Settled right after the deal from your first two cards. <b>Left</b> compares them to the <b>dealer's upcard</b>; <b>right</b> compares them to <b>each other</b>. Only the highest tier pays.</p>
<table class="pt"><tr><th>Tier</th><th>Dealer Match (left)</th><th>Hand Match (right)</th></tr>
<tr><td>Suited Blackjack: A + 10/J/Q/K, same suit</td><td>${PAY.sbj}:1</td><td>${PAY.sbj}:1</td></tr>
<tr><td>Suited Tie: suited pair (left: dealer upcard same suit too)</td><td>${PAY.stie}:1</td><td>${PAY.stie}:1</td></tr>
<tr><td>Suited Pair: same rank &amp; suit, upcard a different suit</td><td>${PAY.spair}:1</td><td>—</td></tr>
<tr><td>Pair: same rank, different suits</td><td>${PAY.pair}:1</td><td>${PAY.pair}:1</td></tr>
<tr><td>Suited Match: a card equals the upcard (rank &amp; suit)</td><td>${PAY.smatch}:1</td><td>—</td></tr>
<tr><td>Rank Match: a card has the upcard's rank</td><td>${PAY.rmatch}:1</td><td>—</td></tr>
<tr><td>Consecutive ranks (e.g. 7-8, Q-K; A-2 counts, K-A doesn't)</td><td>—</td><td>${PAY.consec}:1</td></tr></table>
<p>Pick a chip, then tap or drag it onto a spot. Main bet minimum $${MIN}; side bets $${SMIN} minimum in $1 steps. Equal totals push; dealer bust pays 1:1.</p>`);
$('bHist').onclick=()=>{const s=st.stats;sheet(`<h3>Session stats</h3><table>
<tr><td>Balance</td><td>${money(st.bal)}</td></tr><tr><td>Hands played</td><td>${s.hands}</td></tr><tr><td>Wins / Losses / Pushes</td><td>${s.w} / ${s.l} / ${s.p}</td></tr>
<tr><td>Blackjacks</td><td>${s.bj}</td></tr><tr><td>Biggest win</td><td>${money(s.big)}</td></tr><tr><td>Current streak</td><td>${s.streak>0?s.streak+' W':s.streak<0?(-s.streak)+' L':'-'}</td></tr>
<tr><td>Net profit/loss</td><td class="${s.net>=0?'pos':'neg'}">${s.net>=0?'+':''}${money(s.net)}</td></tr></table>
<h3>Last 25 rounds</h3><table><tr><th>#</th><th>Result</th><th>Net</th></tr>${st.hist.map(h=>`<tr><td>${h.n}</td><td>${h.desc} <small>(${h.p} vs ${h.d})</small></td><td class="${h.net>=0?'pos':'neg'}">${h.net>=0?'+':''}${money(h.net)}</td></tr>`).join('')||'<tr><td colspan=3>No rounds yet</td></tr>'}</table>
<button class="btn red big" id="rst" style="width:100%;margin-top:12px">Reset to $500</button>`);
  $('rst').onclick=()=>{if(confirm('Reset balance to $500 and clear stats?')){resetAll();closeSheet()}}};
$('bSet').onclick=()=>{const s=st.set;sheet(`<h3>Table rules</h3>
<label class="set">Dealer on soft 17<select id="sH17"><option value="0">Stands (S17)</option><option value="1" ${s.h17?'selected':''}>Hits (H17)</option></select></label>
<label class="set">Max splits<select id="sSp"><option value="1">1 (2 hands)</option><option value="2" ${s.splits==2?'selected':''}>2</option><option value="3" ${s.splits==3?'selected':''}>3 (4 hands)</option></select></label>
<label class="set">Resplit aces<input type="checkbox" id="sRsa" ${s.rsa?'checked':''}></label>
<label class="set">Double after split<input type="checkbox" id="sDas" ${s.das?'checked':''}></label>
<label class="set">Surrender<input type="checkbox" id="sSurr" ${s.surr?'checked':''}></label>
<label class="set">Animation speed<select id="sSpd"><option value="normal">Normal</option><option value="fast" ${s.speed==='fast'?'selected':''}>Fast</option></select></label>
<label class="set">Insurance / even money<input type="checkbox" id="sIns" ${s.ins?'checked':''}></label>
<button class="btn alt" id="sTut" style="width:100%;margin-top:12px">Show tutorial</button>`);
  const up=()=>{s.h17=$('sH17').value==='1';s.splits=+$('sSp').value;s.rsa=$('sRsa').checked;s.das=$('sDas').checked;s.surr=$('sSurr').checked;s.ins=$('sIns').checked;s.speed=$('sSpd').value;document.body.classList.toggle('fast',s.speed==='fast');save();renderBets()};
  ['sH17','sSp','sRsa','sDas','sSurr','sIns','sSpd'].forEach(i=>$(i).onchange=up);$('sTut').onclick=()=>{closeSheet();tutorial()}};
$('bMute').onclick=()=>{st.muted=!st.muted;$('bMute').textContent=st.muted?'🔇':'🔊';save()};
function tutorial(){modal(`<h2>♠ Welcome to Landon’s Casino</h2><p>You start with <b>$500</b>. Pick a chip from the rack, then <b>tap or drag</b> it onto the <b>BET</b> circle — watch it drop onto the stack. The optional side bet has two spots: <b>left</b> (Dealer Match — your two cards vs the dealer's upcard) and <b>right</b> (Hand Match — your two cards vs each other). Main bet min <b>$5</b>, side bets from <b>$1</b>. Hold a spot or tap <b>−</b> to remove a chip. Then hit <b>Deal</b>.</p>
<ul><li>Suited Blackjack (A + 10-value, same suit): ${PAY.sbj}:1</li><li>Suited Tie: ${PAY.stie}:1 · Suited Pair: ${PAY.spair}:1 · Pair: ${PAY.pair}:1</li><li>Left: Suited Match ${PAY.smatch}:1, Rank Match ${PAY.rmatch}:1 · Right: Consecutive ${PAY.consec}:1</li></ul><p>Side bets pay right after the deal. Full paytable under <b>?</b>.</p>`,'<button class="okbtn" id="tOk">Got it, let\'s play</button>',()=>{st.tut=true;save()});
  $('tOk').onclick=()=>closeModal()}

// ---- fx ----
function chipFly(from,to){const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();const e=document.createElement('div');e.className='fly';e.style.background=getComputedStyle(from).backgroundColor;
  e.style.left=a.left+a.width/2-17+'px';e.style.top=a.top+a.height/2-17+'px';document.body.appendChild(e);
  requestAnimationFrame(()=>{e.style.transform=`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.6)`;e.style.opacity='.2'});setTimeout(()=>e.remove(),700)}
function sparkle(n){if(RMQ||FAST)return;const b=$('banner').getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2;
  for(let i=0;i<n;i++){const e=document.createElement('div');e.className='spark';e.style.left=cx+'px';e.style.top=cy+'px';document.body.appendChild(e);
    const a=Math.PI*2*i/n+Math.random()*.4,r=70+Math.random()*60;e.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*r}px),calc(-50% + ${Math.sin(a)*r*.6}px)) scale(.2)`,opacity:0}],{duration:700+Math.random()*300,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>e.remove()}}
function pullChips(){if(RMQ||FAST)return;const d=$('dealer').getBoundingClientRect();document.querySelectorAll('.spot[data-b=main] .stack .pc').forEach((c,i)=>{const r=c.getBoundingClientRect(),e=c.cloneNode(true);e.classList.add('fly3');e.classList.remove('new');Object.assign(e.style,{left:r.left+'px',top:r.top+'px',bottom:'auto',width:r.width+'px',height:r.height+'px'});document.body.appendChild(e);
  e.animate([{transform:'none',opacity:1},{transform:`translate(${d.left+d.width/2-r.left-r.width/2}px,${d.top-r.top}px) scale(.5)`,opacity:0}],{duration:650,delay:i*40,easing:'cubic-bezier(.5,0,.7,1)',fill:'both'}).onfinish=()=>e.remove()})}
function chipShower(){const cols=['#d93636','#2f6fd6','#1f9a4a','#ef8a1a','#222'],t=$('bal').getBoundingClientRect();
  for(let i=0;i<12;i++){const e=document.createElement('div');e.className='fly';e.style.background=cols[i%5];const x=innerWidth/2+(Math.random()-.5)*160,y=innerHeight*.45+(Math.random()-.5)*80;
    e.style.left=x+'px';e.style.top=y+'px';document.body.appendChild(e);setTimeout(()=>{e.style.transform=`translate(${t.left-x}px,${t.top-y}px) scale(.4)`;e.style.opacity='0'},60+i*50);setTimeout(()=>e.remove(),1000+i*50)}}
let AC=null;
function tone(f,d,type='sine',v=.12,delay=0,slide=0){if(st.muted)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
  const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+d)}catch(e){}}
function noise(d,v=.1){if(st.muted)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const b=AC.createBuffer(1,AC.sampleRate*d,AC.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=(Math.random()*2-1)*(1-i/x.length)**3;
  const s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=1500;g.gain.value=v;s.buffer=b;s.connect(f).connect(g).connect(AC.destination);s.start()}catch(e){}}
function sfx(k){({card:()=>noise(.08,.25),flip:()=>noise(.12,.2),clack:()=>{tone(2600,.035,'square',.05);tone(1800,.05,'triangle',.06,.02);noise(.04,.12)},chip:()=>{tone(2400,.05,'square',.04);tone(3100,.06,'square',.03,.03)},tick:()=>tone(900,.03,'square',.04),err:()=>tone(150,.15,'sawtooth',.08,0,110),
  win:()=>[660,880,1100].forEach((f,i)=>tone(f,.15,'triangle',.1,i*.08)),bj:()=>[523,659,784,1046,1318].forEach((f,i)=>tone(f,.2,'triangle',.12,i*.08)),lose:()=>tone(300,.4,'sine',.1,0,150),bust:()=>tone(200,.3,'sawtooth',.07,0,90)})[k]?.()}
function vib(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}

// ---- boot ----
newShoe();$('bMute').textContent=st.muted?'🔇':'🔊';renderBets();renderDealer();renderHands();
if(!st.tut)tutorial();else if(st.bal<MIN)gameOver();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
// test hook
const parse=s=>{const m=s.match(/^(10|[2-9AJQK])([SHDC])$/);return{r:m[1]==='A'?1:m[1]==='J'?11:m[1]==='Q'?12:m[1]==='K'?13:+m[1],s:'SHDC'.indexOf(m[2])}};
document.body.classList.toggle('fast',st.set.speed==='fast');
window.__bj={force:a=>{forced=a.map(parse)},get st(){return st},get phase(){return phase},get hands(){return hands},get dealer(){return dealer},setBets:b=>{bets=Object.assign({main:0,dm:0,hm:0},b);renderBets()},fast:v=>FAST=v,total,get bets(){return bets},get stacks(){return stacks},get banner(){return lastBanner},outcome,sideTier:(a,b,r)=>sideTier(parse(a),parse(b),r?parse(r):null),PAY,get lastSide(){return lastSide}};
})();
