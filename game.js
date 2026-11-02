'use strict';
(()=>{
const $=id=>document.getElementById(id), KEY='suitedBJ.v1', START=500, MIN=5;
const SUITS=['♠','♥','♦','♣'], RANKS=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
// Payouts (X to 1). Tune here.
const PAY={pair:25,ties:50,sbj:10,match:{ss:100,sr:30,rr:8,s:9,r:4}};
const SIDE_NAMES={pair:'Suited Pair',ties:'Suited Ties',match:'Match Dealer',sbj:'Suited BJ'};
const DEF={h17:false,splits:1,rsa:false,das:true,ins:false,surr:true};
let st=load();
function load(){try{const o=JSON.parse(localStorage.getItem(KEY));if(o&&typeof o.bal==='number')return Object.assign(fresh(),o,{set:Object.assign({},DEF,o.set)})}catch(e){}return fresh()}
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
let bets={main:0,pair:0,ties:0,match:0,sbj:0}, spot='main', phase='bet', hands=[], dealer=[], active=0, insBet=0, wager=0, ret=0, holeDown=true, busy=false;
const money=n=>'$'+(Math.round(n*100)/100).toLocaleString(undefined,{maximumFractionDigits:2});
const sleep=ms=>new Promise(r=>setTimeout(r,FAST?0:ms));let FAST=false;
const betSum=()=>Object.values(bets).reduce((a,b)=>a+b,0);

// ---- rendering ----
function cardEl(c,down){const e=document.createElement('div');e.className='card'+(down?' down':'');const red=c.s===1||c.s===2;
  const rk=RANKS[c.r],su=SUITS[c.s];
  e.innerHTML=`<div class="face${red?' red':''}"><div class="tl">${rk}<br>${su}</div><div class="mid">${c.r>10?(['J','Q','K'][c.r-11]+su):su}</div><div class="br">${rk}<br>${su}</div></div><div class="back"></div>`;
  if(c.shown)e.style.animation='none';c.shown=true;return e}
let wasDown=false;function renderDealer(){const d=$('dealer');d.innerHTML='';dealer.forEach((c,i)=>{const e=cardEl(c,i===1&&holeDown);if(i===1&&!holeDown&&wasDown)e.classList.add('flip');d.appendChild(e)});wasDown=dealer.length>1&&holeDown;
  $('dTot').textContent=dealer.length?(holeDown?totStr([dealer[0]]):totStr(dealer)):''}
function renderHands(){const h=$('hands');h.innerHTML='';
  hands.forEach((hd,i)=>{const w=document.createElement('div');w.className='hand n'+hands.length+(phase==='play'&&i===active?' act':'');
    const cs=document.createElement('div');cs.className='cards';hd.cards.forEach(c=>cs.appendChild(cardEl(c)));
    w.innerHTML=`<div class="lbl">${hands.length>1?'Hand '+(i+1)+' · ':''}${money(hd.bet)} <span class="tot">${hd.cards.length?totStr(hd.cards):''}</span></div>`;
    w.appendChild(cs);const r=document.createElement('div');r.className='res';r.textContent=hd.res||'';r.style.color=/Win|Blackjack/.test(hd.res||'')?'#8ef0a6':/Push/.test(hd.res||'')?'#ddd':'#ff9a9a';w.appendChild(r);h.appendChild(w)})}
function renderBets(){document.querySelectorAll('.spot').forEach(s=>{s.querySelector('b').textContent=money(bets[s.dataset.b]);s.classList.toggle('sel',s.dataset.b===spot)});
  $('bal').textContent=money(st.bal);$('bDeal').disabled=bets.main<MIN||betSum()>st.bal;
  $('bRD').disabled=!st.last||st.last.main<MIN||Object.values(st.last).reduce((a,b)=>a+b,0)>st.bal;$('bRebet').disabled=$('bRD').disabled;
  $('ruleLine').textContent=st.set.h17?'DEALER HITS SOFT 17':'DEALER STANDS ON SOFT 17'}
function showArea(a){for(const x of ['betArea','actArea','insArea'])$(x).classList.toggle('hidden',x!==a)}
function banner(txt,cls){const b=$('banner');b.textContent=txt;b.className=cls+' show';clearTimeout(b._t);b._t=setTimeout(()=>b.className='',1700)}
function toastLast(net){const l=$('last');l.textContent=net>0?'Won '+money(net):net<0?'Lost '+money(-net):'Push';l.className='last '+(net>0?'w':net<0?'l':'')}

// ---- betting ----
document.querySelectorAll('.spot').forEach(s=>s.onclick=()=>{if(phase!=='bet')return;spot=s.dataset.b;sfx('tick');renderBets()});
document.querySelectorAll('.chip').forEach(c=>c.onclick=e=>{if(phase!=='bet')return;const v=+c.dataset.v;
  if(betSum()+v>st.bal){sfx('err');flash('Not enough balance');return}
  bets[spot]+=v;sfx('chip');vib(8);chipFly(c,document.querySelector('.spot[data-b="'+spot+'"]'));renderBets()});
$('bClear').onclick=()=>{if(phase!=='bet')return;for(const k in bets)bets[k]=0;sfx('tick');renderBets()};
$('bX2').onclick=()=>{if(phase!=='bet')return;if(betSum()*2>st.bal||!betSum()){sfx('err');flash('Not enough balance');return}for(const k in bets)bets[k]*=2;sfx('chip');renderBets()};
$('bMax').onclick=()=>{if(phase!=='bet')return;const other=betSum()-bets.main;bets.main=Math.max(0,Math.floor((st.bal-other)/5)*5);sfx('chip');renderBets()};
$('bRebet').onclick=()=>{if(phase!=='bet'||!st.last)return;bets={...st.last};renderBets()};
$('bDeal').onclick=()=>deal();
$('bRD').onclick=()=>{if(!st.last)return;bets={...st.last};renderBets();deal()};
function flash(m){const l=$('last');l.textContent=m;l.className='last l'}

// ---- round ----
async function deal(){
  if(phase!=='bet'||busy)return;
  if(bets.main<MIN){flash('Place a main bet');sfx('err');return}
  if(betSum()>st.bal){flash('Not enough balance');sfx('err');return}
  busy=true;st.last={...bets};wager=betSum();ret=0;st.bal-=wager;insBet=0;
  if(shoe.length<cut||!shoe.length){newShoe();flash('Shuffling new shoe…');await sleep(500)}
  hands=[{cards:[],bet:bets.main}];dealer=[];holeDown=true;active=0;phase='deal';$('sideRes').innerHTML='';
  showArea(null);renderBets();renderDealer();renderHands();
  for(const who of ['p','d','p','d']){if(who==='p')hands[0].cards.push(draw());else dealer.push(draw());sfx('card');vib(5);renderDealer();renderHands();await sleep(320)}
  settleSides();
  const up=dealer[0], p=hands[0].cards, pBJ=isBJ(p);
  if(up.r===1&&st.set.ins){
    const half=Math.floor(hands[0].bet/2*100)/100;
    if(pBJ){$('insTxt').textContent='Even money? (take 1:1 now)';const ok=await ask();
      if(ok){holeDown=false;renderDealer();hands[0].res='Even money';payout(hands[0].bet*2);return finish()}}
    else if(st.bal>=half){$('insTxt').textContent='Insurance for '+money(half)+'?';const ok=await ask();if(ok){insBet=half;st.bal-=half;wager+=half;renderBets()}}
  }
  if(up.r===1||val(up)===10){
    if(isBJ(dealer)){holeDown=false;sfx('flip');renderDealer();await sleep(400);
      if(insBet){payout(insBet*3);flash('Insurance pays!')}
      hands[0].res=pBJ?'Push':'Dealer Blackjack';if(pBJ)payout(hands[0].bet);return finish()}
    else if(insBet){flash('No dealer blackjack, insurance lost')}
  }
  if(pBJ){holeDown=false;sfx('flip');renderDealer();hands[0].res='Blackjack!';payout(hands[0].bet*2.5);st.stats.bj++;return finish()}
  phase='play';busy=false;showArea('actArea');renderHands();updateActions();
}
function ask(){showArea('insArea');return new Promise(r=>{$('iYes').onclick=()=>{showArea(null);r(true)};$('iNo').onclick=()=>{showArea(null);r(false)}})}
function payout(a){ret+=a;st.bal+=a}
function settleSides(){
  const [a,b]=hands[0].cards, up=dealer[0], out=[];
  const pairS=a.r===b.r&&a.s===b.s;
  const res={pair:pairS?PAY.pair:0, ties:pairS&&up.s===a.s?PAY.ties:0, sbj:isBJ([a,b])&&a.s===b.s?PAY.sbj:0};
  const m=[a,b].map(c=>c.r===up.r?(c.s===up.s?'s':'r'):'').sort().join('');
  res.match={ss:PAY.match.ss,rs:PAY.match.sr,rr:PAY.match.rr,s:PAY.match.s,r:PAY.match.r}[m]||0;
  for(const k of ['pair','ties','match','sbj']){if(!bets[k])continue;const x=res[k];
    if(x){const win=bets[k]*x;payout(bets[k]+win);out.push(`<span class="win">${SIDE_NAMES[k]} ${x}:1 +${money(win)}</span>`);sfx('win');vib([20,30,20])}
    else out.push(`<span>${SIDE_NAMES[k]} ✗</span>`)}
  $('sideRes').innerHTML=out.join('');lastSide=res;renderBets();
}
let lastSide=null;
function cur(){return hands[active]}
function canDouble(h){return phase==='play'&&h.cards.length===2&&!h.aces&&st.bal>=h.bet&&(!h.split||st.set.das)}
function canSplit(h){return phase==='play'&&h.cards.length===2&&val(h.cards[0])===val(h.cards[1])&&hands.length<st.set.splits+1&&st.bal>=h.bet&&(!h.aces||st.set.rsa)}
function canSurr(h){return phase==='play'&&st.set.surr&&hands.length===1&&h.cards.length===2&&!h.split}
function updateActions(){const h=cur();if(!h)return;$('aHit').disabled=!!h.aces;$('aDouble').disabled=!canDouble(h);$('aSplit').disabled=!canSplit(h);$('aSurr').disabled=!canSurr(h);$('aStand').disabled=false}
async function act(fn){if(phase!=='play'||busy)return;busy=true;await fn();busy=false;if(phase==='play')updateActions()}
$('aHit').onclick=()=>act(async()=>{const h=cur();if(h.aces)return;h.cards.push(draw());sfx('card');vib(5);renderHands();await sleep(250);const t=total(h.cards).t;if(t>21){h.res='Bust';sfx('bust');await next()}else if(t===21)await next()});
$('aStand').onclick=()=>act(async()=>{sfx('tick');await next()});
$('aDouble').onclick=()=>act(async()=>{const h=cur();if(!canDouble(h))return;st.bal-=h.bet;wager+=h.bet;h.bet*=2;h.doubled=true;h.cards.push(draw());sfx('chip');renderBets();renderHands();await sleep(300);if(total(h.cards).t>21){h.res='Bust';sfx('bust')}await next()});
$('aSplit').onclick=()=>act(async()=>{const h=cur();if(!canSplit(h))return;st.bal-=h.bet;wager+=h.bet;const aces=h.cards[0].r===1;
  const nh={cards:[h.cards.pop()],bet:h.bet,split:true,aces};h.split=true;h.aces=aces;hands.splice(active+1,0,nh);renderBets();renderHands();await sleep(250);
  h.cards.push(draw());sfx('card');renderHands();await sleep(250);nh.cards.push(draw());sfx('card');renderHands();await sleep(250);
  if(aces){const pairAgain=h=>h.cards[1].r===1&&st.set.rsa&&hands.length<st.set.splits+1;if(!pairAgain(h)){await next()}}
  else if(total(h.cards).t===21)await next()});
$('aSurr').onclick=()=>act(async()=>{const h=cur();if(!canSurr(h))return;h.res='Surrendered';h.surr=true;payout(h.bet/2);sfx('bust');await next()});
async function next(){
  // advance; auto-finish split-ace hands
  active++;
  while(active<hands.length){const h=hands[active];
    if(h.aces&&!(h.cards[1]&&h.cards[1].r===1&&st.set.rsa&&hands.length<st.set.splits+1)){active++;continue}
    if(total(h.cards).t===21){active++;continue}break}
  renderHands();
  if(active>=hands.length)await dealerPlay();else updateActions();
}
async function dealerPlay(){
  phase='dealer';showArea(null);holeDown=false;sfx('flip');renderDealer();renderHands();await sleep(500);
  const live=hands.some(h=>!h.surr&&total(h.cards).t<=21);
  if(live){for(;;){const d=total(dealer);if(d.t<17||(d.t===17&&d.soft&&st.set.h17)){dealer.push(draw());sfx('card');renderDealer();await sleep(450)}else break}}
  const dt=total(dealer).t;
  for(const h of hands){if(h.surr)continue;const t=total(h.cards).t;
    if(t>21)h.res='Bust';else if(dt>21||t>dt){h.res='Win';payout(h.bet*2)}else if(t===dt){h.res='Push';payout(h.bet)}else h.res='Lose'}
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
  if(bj){banner('BLACKJACK!','bj');sfx('bj');vib([30,50,30,50,60]);chipShower()}
  else if(net>0){banner('YOU WIN '+money(net),'win');sfx('win');vib([20,40,20]);chipShower()}
  else if(net<0){banner(desc.includes('Bust')&&hands.length===1?'BUST':'DEALER WINS','lose');sfx('lose')}
  else banner('PUSH','push');
  toastLast(net);
  for(const k in bets)if(bets[k]>0&&false)bets[k]=0;
  // keep bets for rebet but cap to balance
  if(betSum()>st.bal)for(const k in bets)bets[k]=0;
  await sleep(900);phase='bet';showArea('betArea');renderBets();
  if(st.bal<MIN)gameOver();
}
function gameOver(){modal(`<h2>💸 Out of chips</h2><p>You played ${st.stats.hands} hands. Biggest win: ${money(st.stats.big)}.</p><button class="btn gold big" id="go">Reset to $500</button>`);$('go').onclick=()=>{resetAll();closeModal()}}
function resetAll(){const t=st.tut,m=st.muted;st=fresh();st.tut=t;st.muted=m;for(const k in bets)bets[k]=0;hands=[];dealer=[];$('sideRes').innerHTML='';$('last').textContent='';renderDealer();renderHands();renderBets();save()}

// ---- sheets ----
function sheet(h){const s=$('sheet');s.innerHTML='<button class="ib x" id="sx">✕</button>'+h;s.classList.remove('hidden');$('sx').onclick=()=>s.classList.add('hidden')}
function modal(h){$('mCard').innerHTML=h;$('modal').classList.remove('hidden')}
function closeModal(){$('modal').classList.add('hidden')}
$('bHelp').onclick=()=>sheet(`<h3>Rules</h3><ul><li>6-deck shoe, reshuffled at ~75% penetration.</li><li>Blackjack pays 3:2. Dealer ${st.set.h17?'hits':'stands on'} soft 17 (change in ⚙️).</li><li>Double on any first two cards${st.set.das?' (also after split)':''}. Split up to ${st.set.splits+1} hands. Split aces get one card each${st.set.rsa?' (resplit aces allowed)':''}. 21 after a split is not a blackjack.</li><li>Late surrender ${st.set.surr?'allowed':'off'} (get half back). Insurance/even money ${st.set.ins?'offered':'off'} (insurance pays 2:1).</li><li>Dealer peeks for blackjack with an Ace or 10 up.</li></ul>
<h3>Side bets</h3><p>Settled right after the deal, using your first two cards and the dealer's upcard only.</p>
<table><tr><th>Bet</th><th>Pays</th></tr><tr><td>Suited Pair: your 2 cards same rank &amp; suit</td><td>${PAY.pair}:1</td></tr>
<tr><td>Suited Ties: suited pair AND dealer upcard same suit</td><td>${PAY.ties}:1</td></tr>
<tr><td>Suited Blackjack: blackjack with both cards same suit (paid on top of 3:2)</td><td>${PAY.sbj}:1</td></tr></table>
<h3>Match the Dealer</h3><p>Each of your 2 cards is compared to the dealer upcard. Suited match = same rank and suit, rank match = same rank only. Best tier pays:</p>
<table><tr><td>2 suited matches</td><td>${PAY.match.ss}:1</td></tr><tr><td>1 suited + 1 rank match</td><td>${PAY.match.sr}:1</td></tr><tr><td>1 suited match</td><td>${PAY.match.s}:1</td></tr><tr><td>2 rank matches</td><td>${PAY.match.rr}:1</td></tr><tr><td>1 rank match</td><td>${PAY.match.r}:1</td></tr></table>
<p>Tap a betting spot to select it, then tap chips. Main bet minimum $${MIN}.</p>`);
$('bHist').onclick=()=>{const s=st.stats;sheet(`<h3>Session stats</h3><table>
<tr><td>Balance</td><td>${money(st.bal)}</td></tr><tr><td>Hands played</td><td>${s.hands}</td></tr><tr><td>Wins / Losses / Pushes</td><td>${s.w} / ${s.l} / ${s.p}</td></tr>
<tr><td>Blackjacks</td><td>${s.bj}</td></tr><tr><td>Biggest win</td><td>${money(s.big)}</td></tr><tr><td>Current streak</td><td>${s.streak>0?s.streak+' W':s.streak<0?(-s.streak)+' L':'-'}</td></tr>
<tr><td>Net profit/loss</td><td class="${s.net>=0?'pos':'neg'}">${s.net>=0?'+':''}${money(s.net)}</td></tr></table>
<h3>Last 25 rounds</h3><table><tr><th>#</th><th>Result</th><th>Net</th></tr>${st.hist.map(h=>`<tr><td>${h.n}</td><td>${h.desc} <small>(${h.p} vs ${h.d})</small></td><td class="${h.net>=0?'pos':'neg'}">${h.net>=0?'+':''}${money(h.net)}</td></tr>`).join('')||'<tr><td colspan=3>No rounds yet</td></tr>'}</table>
<button class="btn red big" id="rst" style="width:100%;margin-top:12px">Reset to $500</button>`);
  $('rst').onclick=()=>{if(confirm('Reset balance to $500 and clear stats?')){resetAll();$('sheet').classList.add('hidden')}}};
$('bSet').onclick=()=>{const s=st.set;sheet(`<h3>Table rules</h3>
<label class="set">Dealer on soft 17<select id="sH17"><option value="0">Stands (S17)</option><option value="1" ${s.h17?'selected':''}>Hits (H17)</option></select></label>
<label class="set">Max splits<select id="sSp"><option value="1">1 (2 hands)</option><option value="2" ${s.splits==2?'selected':''}>2</option><option value="3" ${s.splits==3?'selected':''}>3 (4 hands)</option></select></label>
<label class="set">Resplit aces<input type="checkbox" id="sRsa" ${s.rsa?'checked':''}></label>
<label class="set">Double after split<input type="checkbox" id="sDas" ${s.das?'checked':''}></label>
<label class="set">Surrender<input type="checkbox" id="sSurr" ${s.surr?'checked':''}></label>
<label class="set">Insurance / even money<input type="checkbox" id="sIns" ${s.ins?'checked':''}></label>
<button class="btn alt" id="sTut" style="width:100%;margin-top:12px">Show tutorial</button>`);
  const up=()=>{s.h17=$('sH17').value==='1';s.splits=+$('sSp').value;s.rsa=$('sRsa').checked;s.das=$('sDas').checked;s.surr=$('sSurr').checked;s.ins=$('sIns').checked;save();renderBets()};
  ['sH17','sSp','sRsa','sDas','sSurr','sIns'].forEach(i=>$(i).onchange=up);$('sTut').onclick=()=>{$('sheet').classList.add('hidden');tutorial()}};
$('bMute').onclick=()=>{st.muted=!st.muted;$('bMute').textContent=st.muted?'🔇':'🔊';save()};
function tutorial(){modal(`<h2>♠ Welcome to Suited Blackjack</h2><p>You start with <b>$500</b>. Tap a betting spot, then tap chips to bet. Hit <b>Deal</b>.</p>
<ul><li><b>Suited Pair</b>: your first 2 cards are identical (e.g. 7♥ 7♥). ${PAY.pair}:1</li><li><b>Suited Ties</b>: a suited pair plus the dealer's upcard in the same suit. ${PAY.ties}:1</li><li><b>Match Dealer</b>: your cards match the dealer's upcard rank (and suit for more). Up to ${PAY.match.ss}:1</li><li><b>Suited BJ</b>: blackjack in one suit. ${PAY.sbj}:1</li></ul><p>Side bets pay right after the deal. Full paytable under <b>?</b>.</p><button class="btn gold big" id="tOk" style="width:100%">Let's play</button>`);
  $('tOk').onclick=()=>{st.tut=true;save();closeModal()}}

// ---- fx ----
function chipFly(from,to){const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();const e=document.createElement('div');e.className='fly';e.style.background=getComputedStyle(from).backgroundColor;
  e.style.left=a.left+a.width/2-17+'px';e.style.top=a.top+a.height/2-17+'px';document.body.appendChild(e);
  requestAnimationFrame(()=>{e.style.transform=`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.6)`;e.style.opacity='.2'});setTimeout(()=>e.remove(),700)}
function chipShower(){const cols=['#d93636','#2f6fd6','#1f9a4a','#ef8a1a','#222'],t=$('bal').getBoundingClientRect();
  for(let i=0;i<12;i++){const e=document.createElement('div');e.className='fly';e.style.background=cols[i%5];const x=innerWidth/2+(Math.random()-.5)*160,y=innerHeight*.45+(Math.random()-.5)*80;
    e.style.left=x+'px';e.style.top=y+'px';document.body.appendChild(e);setTimeout(()=>{e.style.transform=`translate(${t.left-x}px,${t.top-y}px) scale(.4)`;e.style.opacity='0'},60+i*50);setTimeout(()=>e.remove(),1000+i*50)}}
let AC=null;
function tone(f,d,type='sine',v=.12,delay=0,slide=0){if(st.muted)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
  const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+d)}catch(e){}}
function noise(d,v=.1){if(st.muted)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const b=AC.createBuffer(1,AC.sampleRate*d,AC.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=(Math.random()*2-1)*(1-i/x.length)**3;
  const s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=1500;g.gain.value=v;s.buffer=b;s.connect(f).connect(g).connect(AC.destination);s.start()}catch(e){}}
function sfx(k){({card:()=>noise(.08,.25),flip:()=>noise(.12,.2),chip:()=>{tone(2400,.05,'square',.04);tone(3100,.06,'square',.03,.03)},tick:()=>tone(900,.03,'square',.04),err:()=>tone(150,.15,'sawtooth',.08,0,110),
  win:()=>[660,880,1100].forEach((f,i)=>tone(f,.15,'triangle',.1,i*.08)),bj:()=>[523,659,784,1046,1318].forEach((f,i)=>tone(f,.2,'triangle',.12,i*.08)),lose:()=>tone(300,.4,'sine',.1,0,150),bust:()=>tone(200,.3,'sawtooth',.07,0,90)})[k]?.()}
function vib(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}

// ---- boot ----
newShoe();$('bMute').textContent=st.muted?'🔇':'🔊';renderBets();renderDealer();renderHands();
if(!st.tut)tutorial();else if(st.bal<MIN)gameOver();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
// test hook
const parse=s=>{const m=s.match(/^(10|[2-9AJQK])([SHDC])$/);return{r:m[1]==='A'?1:m[1]==='J'?11:m[1]==='Q'?12:m[1]==='K'?13:+m[1],s:'SHDC'.indexOf(m[2])}};
window.__bj={force:a=>{forced=a.map(parse)},get st(){return st},get phase(){return phase},get hands(){return hands},get dealer(){return dealer},setBets:b=>{bets=Object.assign({main:0,pair:0,ties:0,match:0,sbj:0},b);renderBets()},fast:v=>FAST=v,total};
})();
