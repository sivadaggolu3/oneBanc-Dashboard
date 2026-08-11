/* ============================================================
   ONEBANC — central state object.
   Every render function reads from this single source of truth,
   so an action taken in one time state (e.g. saving toward Goa,
   reserving the bill) is remembered when the user moves to a
   later part of the day.
   ============================================================ */
const state = {
  time: 'plan',              // 'plan' | 'guide' | 'review'
  goaSaved: 5000,
  goaGoal: 15000,
  goaDaysLeft: 200,
  goaSavedToday: false,
  goaPhoto: null,
  rahulReminded: false,
  rahulPhoto: null,
  billReserved: false,
  offerSaved: { plan:false, guide:false, review:false },
};

const TRANSACTIONS = [
  {id:'t1', name:'Breakfast', time:'8:40 AM',  amount:150, category:'Food',     icon:'☕', method:'OneBanc UPI',  security:'Verified ✓'},
  {id:'t2', name:'Uber',      time:'10:20 AM', amount:220, category:'Travel',   icon:'🚗', method:'OneBanc Card', security:'Verified ✓'},
  {id:'t3', name:'Lunch',     time:'1:15 PM',  amount:280, category:'Food',     icon:'🍽️', method:'OneBanc UPI',  security:'Verified ✓'},
  {id:'t4', name:'Shopping',  time:'3:30 PM',  amount:300, category:'Shopping', icon:'🛍️', method:'OneBanc Card', security:'Verified ✓'},
];
const VISIBLE_COUNT = { plan:1, guide:3, review:4 };
const DAILY_BUDGET = 1000;
const BASE_BALANCE = 25000;

function visibleTx(){ return TRANSACTIONS.slice(0, VISIBLE_COUNT[state.time]); }
function spentToday(){ return visibleTx().reduce((s,t)=> s + t.amount, 0); }
function isRahulPaid(){ return state.time === 'review'; } // scripted resolution: resolves by evening
function currentBalance(){
  let b = BASE_BALANCE - spentToday();
  if(isRahulPaid()) b += 500;
  if(state.billReserved) b -= 1200;
  return b;
}

/* ============================================================
   HELPERS
   ============================================================ */
function fmt(n){ return '₹' + Math.round(n).toLocaleString('en-IN'); }

function animateNumber(el, to){
  const from = parseInt(el.dataset.current || '0', 10);
  const dur = 600, start = performance.now();
  function step(now){
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = fmt(val);
    if(p < 1) requestAnimationFrame(step);
    else el.dataset.current = to;
  }
  requestAnimationFrame(step);
}

let toastTimer = null;
function showToast(msg){
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toast.classList.remove('show'), 2400);
}

/* ============================================================
   RENDER: HERO
   ============================================================ */
function renderHero(){
  const copy = {
    plan:   {g:'Good morning, Siva ☀️', s:"Here's your money for today"},
    guide:  {g:'Good afternoon, Siva', s:"Let's see how you're doing today"},
    review: {g:'Good evening, Siva 🌙', s:"Here's how your day went"},
  }[state.time];
  document.getElementById('greeting').textContent = copy.g;
  document.getElementById('greetingSub').textContent = copy.s;

  const balEl = document.getElementById('balanceFigure');
  animateNumber(balEl, currentBalance());

  document.body.classList.toggle('is-evening', state.time === 'review');
  document.body.classList.toggle('is-afternoon', state.time === 'guide');
}

/* ============================================================
   RENDER: PERSONAL MOMENT (birthday — light contextual touch)
   ============================================================ */
function renderPersonalMoment(){
  const el = document.getElementById('personalMoment');
  const map = {
    plan:   `🎂 <span>Your birthday is tomorrow — we've planned something within your budget. <b>₹1,500</b> kept aside.</span>`,
    guide:  `🎂 <span>Planning tonight's birthday dinner with friends? Dinner for 4 · <b>₹1,500</b> · 20% OFF with OneBanc — estimated saving ₹300.</span><span class="pm-link" id="pmLink">View suggestion →</span>`,
    review: `🌙 <span>Tomorrow's the big day 🎂 — your <b>₹1,500</b> is kept aside and everything's ready for your birthday.</span><span class="pm-link" id="pmLink">View my plan →</span>`,
  };
  el.innerHTML = map[state.time];
  const link = document.getElementById('pmLink');
  if(link) link.addEventListener('click', ()=> showToast('Your birthday plan is ready to view.'));
}

/* ============================================================
   RENDER: JOURNEY CONTROLLER
   ============================================================ */
function renderJourney(){
  const order = ['plan','guide','review'];
  const idx = order.indexOf(state.time);
  document.querySelectorAll('.j-stop').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.time === state.time);
  });
  document.getElementById('journeyFill').style.width = (idx / (order.length - 1) * 100) + '%';
  document.getElementById('navLogo').classList.remove('pulse');
  void document.getElementById('navLogo').offsetWidth;
  document.getElementById('navLogo').classList.add('pulse');
}

/* ============================================================
   RENDER: SMART FOR YOU CAROUSEL
   ============================================================ */
// Scripted resolution, same pattern as Rahul's repayment: the day
// automatically resolves to "saved" by evening, regardless of whether
// the user tapped the button earlier. An early manual save is still
// honored (and carries forward), it just isn't required.
function isGoaSaved(){ return state.time === 'review' || state.goaSavedToday; }
// Total to display: if evening auto-resolved the save (user never tapped
// the button), fold the ₹50 in for display without mutating state —
// same approach as currentBalance() does for Rahul's ₹500.
function goaSavedAmount(){ return state.goaSaved + (isGoaSaved() && !state.goaSavedToday ? 50 : 0); }

function goaCardHTML(){
  const pct = Math.min(100, (state.goaSaved / state.goaGoal) * 100).toFixed(1);

  if(isGoaSaved()){
    return `
      <div class="smart-card compact" data-card="goa">
        <div class="sc-icon-badge">🌴</div>
        <div class="sc-eyebrow">Today's saving</div>
        <div class="sc-title">₹50 saved today ✓</div>
        <div class="sc-meta">${fmt(goaSavedAmount())} of ${fmt(state.goaGoal)} saved</div>
        <div class="sc-track"><div class="sc-fill" style="width:${pct}%;"></div></div>
      </div>`;
  }

  // Morning — full invite card, plenty of day left.
 if (state.time === 'plan') {

    return `
        <div class="smart-card" data-card="goa">

            <div class="sc-media">
                <img 
                    src="images/savings_image.jpeg"
                    alt="Saving money"
                    onerror="var p=this.parentElement; p.classList.add('fallback'); p.textContent='🌴';"
                >
            </div>

            <div class="sc-eyebrow">🌴 Your goal</div>

            <div class="sc-title">Goa Trip</div>

            <div class="sc-num">
                <span class="g-saved">${fmt(state.goaSaved)}</span>
                saved of ${fmt(state.goaGoal)}
            </div>

            <div class="sc-track">
                <div class="sc-fill g-fill" style="width:${pct}%;"></div>
            </div>

            <div class="sc-body">
                <span class="g-remaining">
                    ${fmt(state.goaGoal - state.goaSaved)}
                </span>
                remaining ·
                <span class="g-days">
                    ${state.goaDaysLeft}
                </span>
                days at this pace
            </div>

            <div class="sc-cta-row">
                <button class="sc-cta solid" data-action="goa-save">
                    Save ₹50 today →
                </button>
            </div>

        </div>
    `;
}

  // Afternoon — half the day's gone and nothing saved yet, so nudge.
  // Also give space to upload a personal Goa photo for motivation.
 if (state.time === 'guide') {

    const saved = goaSavedAmount();

    return `
        <div class="smart-card" data-card="goa">

            <div class="sc-media">
                <img src="images/goa_image.jpg" alt="Goa trip">
            </div>

            <div class="sc-eyebrow">🌴 Your goal</div>

            <div class="sc-title">
                Half your day's done — no savings for Goa yet.
            </div>

            <div class="sc-meta">
                ${fmt(saved)} of ${fmt(state.goaGoal)} saved
            </div>

            <div class="sc-cta-row">
                <button class="sc-cta solid" data-action="goa-save">
                    Save ₹50 now →
                </button>
            </div>

        </div>
    `;
}
}

function rahulCardHTML(){
  if(state.time === 'plan'){
    return `
      <div class="smart-card compact" data-card="rahul">
        <div class="sc-icon-badge">💸</div>
        <div class="sc-eyebrow">Money you're waiting for</div>
        <div class="sc-title">Rahul owes you ₹500</div>
        <div class="sc-meta">Borrowed 3 days ago</div>
        ${state.rahulReminded
          ? `<div class="sc-confirm pending">🔔 Reminder scheduled for Rahul</div>`
          : `<div class="sc-cta-row"><button class="sc-cta" data-action="rahul-remind">Remind Rahul →</button><button class="sc-cta" data-action="rahul-remind">Remind tomorrow</button></div>`}
      </div>`;
  }
  if(state.time === 'guide'){
    return `
      <div class="smart-card compact" data-card="rahul">
        <div class="sc-icon-badge">💸</div>
        <div class="sc-eyebrow">Still waiting</div>
        <div class="sc-title">Rahul hasn't paid ₹500 yet.</div>
        <div class="sc-meta">Borrowed 3 days ago</div>
        ${state.rahulReminded
          ? `<div class="sc-confirm pending">🔔 Reminder scheduled for Rahul</div>`
          : `<div class="sc-cta-row"><button class="sc-cta" data-action="rahul-remind">Remind Rahul →</button></div>`}
      </div>`;
  }
  // review — resolves positively, and gets a photo space (evening only)
return `
    <div class="smart-card" data-card="rahul">
      <div class="sc-media">
        <img src="images/rahul_payment_img.png" alt="Payment received" onerror="var p=this.parentElement; p.classList.add('fallback'); p.textContent='💸';">
      </div>
      <div class="sc-eyebrow">Payment update</div>
      <div class="sc-title">Rahul paid you ₹500</div>
      <div class="sc-meta">Received today at 4:32 PM.</div>
    </div>`;
}
function billCardHTML(){
  if(state.time !== 'review'){
    return `
      <div class="smart-card compact" data-card="bill">
        <div class="sc-icon-badge">⚡</div>
        <div class="sc-eyebrow">Coming up</div>
        <div class="sc-title">Electricity bill</div>
        <div class="sc-meta">₹1,200 · due tomorrow</div>
        ${state.billReserved
          ? `<div class="sc-confirm">✓ ₹1,200 secured for tomorrow</div>`
          : `<div class="sc-cta-row"><button class="sc-cta solid" data-action="bill-reserve">Set aside ₹1,200 →</button></div>`}
      </div>`;
  }
  if(state.billReserved){
    return `
      <div class="smart-card compact" data-card="bill">
        <div class="sc-icon-badge">✓</div>
        <div class="sc-eyebrow">Bill secured</div>
        <div class="sc-title">Electricity bill</div>
        <div class="sc-meta">₹1,200 secured for tomorrow.</div>
      </div>`;
  }
  return `
    <div class="smart-card compact" data-card="bill">
      <div class="sc-icon-badge">⚡</div>
      <div class="sc-eyebrow">Bill tomorrow</div>
      <div class="sc-title">Electricity bill</div>
      <div class="sc-meta">₹1,200 due tomorrow. You haven't set aside the money yet.</div>
      <div class="sc-cta-row"><button class="sc-cta solid" data-action="bill-reserve">Set aside ₹1,200</button></div>
    </div>`;
}

/* One offer card, present in all three time states — the product, price, and
   framing change with the time of day, but it never disappears. */
const OFFERS = {
  plan: {
    img: 'images/headset_image.avif',
    fallbackIcon: '🎧',
    eyebrow: '💳 Save with OneBanc',
    title: 'Sony Headphones',
    priceLine: `<span class="sc-strike">₹3,999</span> <span class="offer-badge">25% OFF</span>`,
    body: '₹2,999 with your OneBanc Card',
    highlight: 'You save ₹1,000',
    cta: 'View offer →',
  },
  guide: {
    img: 'images/burger.jpg',
    fallbackIcon: '🍔',
    eyebrow: '🍽️ Save on today\'s food',
    title: 'Food & grocery offer',
    priceLine: `<span class="offer-badge">20% OFF</span> with your OneBanc Card`,
    body: '',
    highlight: 'Save up to ₹300',
    cta: 'See offer →',
  },
  review: {
    img: 'images/hall_img.avif',
    fallbackIcon: '🎬',
    eyebrow: '🎬 Unwind tonight',
    title: 'Movie Tickets',
    priceLine: `<span class="offer-badge">20% OFF</span> with your OneBanc Card`,
    body: '',
    highlight: 'You could save ₹200',
    cta: 'View offer →',
  },
};

function offerCardHTML(){
  const o = OFFERS[state.time];
  const saved = state.offerSaved[state.time];
  return `
    <div class="smart-card" data-card="offer">
      <div class="sc-media"><img src="${o.img}" alt="${o.title}" onerror="var p=this.parentElement; p.classList.add('fallback'); p.textContent='${o.fallbackIcon}';"></div>
      <div class="sc-eyebrow">${o.eyebrow}</div>
      <div class="sc-title">${o.title}</div>
      <div class="sc-num">${o.priceLine}</div>
      ${o.body ? `<div class="sc-body">${o.body}</div>` : ''}
      <div class="sc-highlight">${o.highlight}</div>
      ${saved
        ? `<div class="sc-confirm">✓ Offer saved to your wallet</div>`
        : `<div class="sc-cta-row"><button class="sc-cta" data-action="offer-save">${o.cta}</button></div>`}
    </div>`;
}

function spendingGuideCardHTML(){
  const spent = spentToday();
  const remain = Math.max(0, DAILY_BUDGET - spent);
  return `
    <div class="smart-card compact" data-card="spend-guide">
      <div class="sc-icon-badge">✨</div>
      <div class="sc-eyebrow">You're doing well</div>
      <div class="sc-title">You've spent ${fmt(spent)} today</div>
      <div class="sc-meta">Keep the rest below ${fmt(remain)} to stay within your plan.</div>
    </div>`;
}

function buildCarouselCards(){
  if(state.time === 'plan')  return [goaCardHTML(), offerCardHTML(), billCardHTML(), rahulCardHTML()];
  if(state.time === 'guide') return [goaCardHTML(), offerCardHTML(), rahulCardHTML(), spendingGuideCardHTML()];
  return [ rahulCardHTML(), offerCardHTML(),billCardHTML(),goaCardHTML(),]; // review
}

let activeCarouselCleanup = null; // detaches the previous carousel's window listeners before a re-render

function renderCarousel(){
  if(activeCarouselCleanup){ activeCarouselCleanup(); activeCarouselCleanup = null; }
  const track = document.getElementById('carouselTrack');
  track.innerHTML = buildCarouselCards().join('');
  activeCarouselCleanup = initCarousel(track);
}

function initCarousel(track){
  const dotsWrap = document.getElementById('carouselDots');
  const prevBtn = document.getElementById('carPrev');
  const nextBtn = document.getElementById('carNext');
  dotsWrap.innerHTML = '';
  let index = 0;

  function cardsPerView(){ return window.innerWidth > 900 ? 2 : 1; }

  function dotCount(){
    const cards = track.children.length;
    return Math.max(1, cards - cardsPerView() + 1);
  }

  function buildDots(){
    dotsWrap.innerHTML = '';
    for(let i=0; i<dotCount(); i++){
      const d = document.createElement('button');
      d.className = 'car-dot' + (i===0 ? ' active' : '');
      d.setAttribute('aria-label', 'Go to card ' + (i+1));
      d.addEventListener('click', ()=>{ index = i; update(); });
      dotsWrap.appendChild(d);
    }
  }

  function update(){
    const cards = Array.from(track.children);
    if(!cards.length) return;
    const maxIndex = Math.max(0, cards.length - cardsPerView());
    index = Math.max(0, Math.min(index, maxIndex));
    const gap = parseFloat(getComputedStyle(track).gap) || 16;
    const cardW = cards[0].getBoundingClientRect().width + gap;
    track.style.transform = 'translateX(' + (-index * cardW) + 'px)';
    const dots = Array.from(dotsWrap.children);
    dots.forEach((d,i)=> d.classList.toggle('active', i===index));
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === maxIndex;
  }

  function onResize(){ buildDots(); update(); }

  prevBtn.onclick = ()=>{ index--; update(); };
  nextBtn.onclick = ()=>{ index++; update(); };
  window.addEventListener('resize', onResize);

  // drag / swipe
  let startX = 0, baseTranslate = 0, dragging = false;
  function getTranslate(){
    const t = getComputedStyle(track).transform;
    if(t === 'none') return 0;
    return parseFloat(t.split(',')[4]) || 0;
  }
  function dragStart(x){ dragging = true; startX = x; baseTranslate = getTranslate(); track.classList.add('dragging'); }
  function dragMove(x){ if(!dragging) return; track.style.transform = 'translateX(' + (baseTranslate + (x - startX)) + 'px)'; }
  function dragEnd(x){
    if(!dragging) return;
    dragging = false; track.classList.remove('dragging');
    const delta = x - startX;
    if(Math.abs(delta) > 60) index += delta < 0 ? 1 : -1;
    update();
  }
  const onMouseMove = e=> dragMove(e.clientX);
  const onMouseUp = e=> dragEnd(e.clientX);
  track.onmousedown = e=> dragStart(e.clientX);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  track.addEventListener('touchstart', e=> dragStart(e.touches[0].clientX), {passive:true});
  track.addEventListener('touchmove', e=> dragMove(e.touches[0].clientX), {passive:true});
  track.addEventListener('touchend', e=> dragEnd(e.changedTouches[0].clientX));

  buildDots();
  update();

  // returned cleanup detaches this instance's window-level listeners before the next re-render
  return function cleanup(){
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
}

/* ============================================================
   RENDER: INSIGHT ROW
   ============================================================ */
function renderInsightRow(){
  const spent = spentToday();
  const remain = DAILY_BUDGET - spent;
  const rows = {
    plan:   [['✓ Good start', `Spent ${fmt(spent)} today`], ['🎯 Goal', `${fmt(goaSavedAmount())} saved`], ['📊 Under budget', `by ${fmt(remain)}`]],
    guide:  [['✓ On track', `${fmt(spent)} spent today`], ['🎯 Goal', `${fmt(goaSavedAmount())} saved`], ['📊 Remaining', `${fmt(remain)} left today`]],
    review: [['✓ Almost on target', `${fmt(spent)} spent today`], ['🎯 Goal', `${fmt(goaSavedAmount())} saved`], ['📊 Under budget', `by ${fmt(Math.max(0,remain))}`]],
  }[state.time];
  document.getElementById('insightRow').innerHTML = rows.map(([top,sub])=>
    `<div class="insight-chip"><div class="ic-top">${top}</div><div class="ic-sub">${sub}</div></div>`
  ).join('');
}

/* ============================================================
   RENDER: PLAN / SPENDING CARD
   ============================================================ */
function renderPlanCard(){
  const el = document.getElementById('planCard');
  const spent = spentToday();
  const remain = Math.max(0, DAILY_BUDGET - spent);
  const pct = Math.min(100, (spent / DAILY_BUDGET) * 100);

  if(state.time === 'plan'){
    el.innerHTML = `
      <div class="pc-eyebrow">Your plan for today</div>
      <div class="pc-title">Recommended daily spending — ${fmt(DAILY_BUDGET)}</div>
      <div class="pc-seg-bar">
        <div class="pc-seg" style="width:45%; background:var(--teal);"></div>
        <div class="pc-seg" style="width:20%; background:var(--slate);"></div>
        <div class="pc-seg" style="width:35%; background:var(--amber);"></div>
      </div>
      <div class="pc-legend">
        <div class="pc-legend-item"><span class="pc-swatch" style="background:var(--teal);"></span>Food ₹450</div>
        <div class="pc-legend-item"><span class="pc-swatch" style="background:var(--slate);"></span>Travel ₹200</div>
        <div class="pc-legend-item"><span class="pc-swatch" style="background:var(--amber);"></span>Other ₹350</div>
      </div>
      <div class="pc-progress-row"><span class="pc-progress-num">${fmt(spent)}</span><span class="pc-progress-sub">spent so far</span></div>
      <div class="pc-track"><div class="pc-fill" style="width:${pct}%;"></div></div>
      <div class="pc-caption"><span>of ${fmt(DAILY_BUDGET)} daily budget</span><span>${fmt(remain)} remaining</span></div>
    `;
  } else {
    const status = state.time === 'guide' ? "You're on track ✓" : 'Almost on target';
    el.innerHTML = `
      <div class="pc-eyebrow">Today's money</div>
      <div class="pc-progress-row"><span class="pc-progress-num">${fmt(spent)}</span><span class="pc-progress-sub">spent of ${fmt(DAILY_BUDGET)}</span></div>
      <div class="pc-track"><div class="pc-fill" style="width:${pct}%;"></div></div>
      <div class="pc-caption"><span>${fmt(remain)} remaining</span><span>${status}</span></div>
    `;
  }
}

/* ============================================================
   RENDER: TODAY'S ACTIVITY + DRAWER
   ============================================================ */
function renderActivity(){
  const list = document.getElementById('txList');
  list.innerHTML = visibleTx().map(t => `
    <div class="tx-row" data-tx="${t.id}">
      <div class="tx-ic">${t.icon}</div>
      <div class="tx-mid"><div class="tx-name">${t.name}</div><div class="tx-time">${t.time}</div></div>
      <div class="tx-amt">−${fmt(t.amount)}</div>
    </div>
  `).join('');
}

function openDrawer(txId){
  const t = TRANSACTIONS.find(x=> x.id === txId);
  if(!t) return;
  document.getElementById('drawerContent').innerHTML = `
    <div class="drawer-amt">−${fmt(t.amount)}</div>
    <div class="drawer-name">${t.name} · ${t.time}</div>
    <div class="drawer-row"><span class="drk">Merchant</span><span class="drv">${t.name}</span></div>
    <div class="drawer-row"><span class="drk">Category</span><span class="drv">${t.category}</span></div>
    <div class="drawer-row"><span class="drk">Payment method</span><span class="drv">${t.method}</span></div>
    <div class="drawer-row"><span class="drk">Security</span><span class="drv">${t.security}</span></div>
  `;
  document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer(){ document.getElementById('drawerOverlay').classList.remove('open'); }

/* ============================================================
   RENDER: EVENING REVIEW SUMMARY
   ============================================================ */
function renderReviewSummary(){
  const el = document.getElementById('reviewSummary');
  if(state.time !== 'review'){ el.hidden = true; return; }
  el.hidden = false;
  const spent = spentToday();
  const remain = DAILY_BUDGET - spent;
  el.innerHTML = `
    <div class="rs-title">Today's review</div>
    <div class="rs-stats">
      <div><div class="rs-stat-label">Spent</div><div class="rs-stat-val">${fmt(spent)}</div></div>
      <div><div class="rs-stat-label">Daily budget</div><div class="rs-stat-val">${fmt(DAILY_BUDGET)}</div></div>
      <div><div class="rs-stat-label">Remaining</div><div class="rs-stat-val">${fmt(remain)}</div></div>
    </div>
    <div class="rs-status">Almost on target</div>
    <div class="rs-chips">
      <div class="rs-chip">✓ Stayed within budget</div>
      <div class="rs-chip">🎯 ${fmt(goaSavedAmount())} saved toward Goa</div>
      <div class="rs-chip">💸 ₹500 received</div>
      <div class="rs-chip">⚡ Tomorrow's bill ${state.billReserved ? 'ready ✓' : 'not ready'}</div>
    </div>
  `;
}

/* ============================================================
   MASTER RENDER
   ============================================================ */
function renderAll(){
  renderHero();
  renderPersonalMoment();
  renderJourney();
  renderCarousel();
  renderInsightRow();
  renderPlanCard();
  renderActivity();
  renderReviewSummary();
}

function setTime(t){
  state.time = t;
  renderAll();
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
document.querySelectorAll('.j-stop').forEach(btn=>{
  btn.addEventListener('click', ()=> setTime(btn.dataset.time));
});

document.getElementById('journeyPlay').addEventListener('click', async function(){
  this.disabled = true; this.textContent = '▶ Playing…';
  const sleep = ms => new Promise(r=> setTimeout(r, ms));
  setTime('plan');  await sleep(2000);
  setTime('guide'); await sleep(2000);
  setTime('review'); await sleep(2000);
  this.disabled = false; this.textContent = '▶ Play Day Journey';
});

// delegated change handling for photo uploads (Goa afternoon card + Rahul's
// evening payment card) — inputs are re-created on every render, so we
// delegate from document rather than binding once
document.addEventListener('change', (e)=>{
  const id = e.target && e.target.id;
  if(!id || (id !== 'goaUploadInput' && id !== 'rahulUploadInput')) return;
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if(id === 'rahulUploadInput'){
      state.rahulPhoto = reader.result;
      showToast('Photo added to Rahul\'s payment');
    } else {
      state.goaPhoto = reader.result;
      showToast('Photo added to your Goa goal');
    }
    renderCarousel();
  };
  reader.readAsDataURL(file);
});

// delegated click handling for carousel actions + transaction rows
document.addEventListener('click', (e)=>{
  const action = e.target.closest('[data-action]');
  if(action){
    const type = action.dataset.action;
    if(type === 'goa-save'){
      state.goaSaved += 50;
      state.goaDaysLeft = Math.max(1, state.goaDaysLeft - 1);
      state.goaSavedToday = true;
      showToast('✓ ₹50 added to your Goa goal · ' + state.goaDaysLeft + ' days to go');
      renderCarousel(); renderInsightRow();
    } else if(type === 'rahul-remind'){
      state.rahulReminded = true;
      showToast('Reminder scheduled for Rahul');
      renderCarousel();
    } else if(type === 'bill-reserve'){
      state.billReserved = true;
      showToast('✓ ₹1,200 secured for tomorrow');
      renderCarousel(); renderHero(); renderReviewSummary();
    } else if(type === 'offer-save'){
      state.offerSaved[state.time] = true;
      showToast('Offer saved to your wallet');
      renderCarousel();
    }
    return;
  }
  const txRow = e.target.closest('.tx-row');
  if(txRow){ openDrawer(txRow.dataset.tx); return; }

  if(e.target.closest('#drawerClose') || e.target === document.getElementById('drawerOverlay')){
    closeDrawer();
  }
});

/* ============================================================
   INIT
   ============================================================ */
document.querySelectorAll('[data-current]').forEach(el=> el.dataset.current = '0');
renderAll();