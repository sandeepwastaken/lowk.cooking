/* ===== v2 sections: pantry, simmer, knife, reduction, method, sound kitchen, freeze, the pass, storm,
   brigade, closing time — plus the soundscape that mixes the recorded loops by scroll position ===== */
(function(){
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const A = APP.audio, sfx = (n, o) => APP.sfx(n, o);
  const inView = r => r.bottom > 0 && r.top < innerHeight;
  const vis = el => { const r = el.getBoundingClientRect(), H = innerHeight; return clamp((Math.min(r.bottom, H) - Math.max(r.top, 0)) / H, 0, 1); };
  const sound = () => A.on ? Promise.resolve() : A.set(true);
  function fit(cv){
    const o = {cv, ctx:cv.getContext('2d'), W:0, H:0, vis:false, onsize:null};
    const rs = () => { const d = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      o.W = r.width; o.H = r.height; cv.width = r.width * d; cv.height = r.height * d; o.ctx.setTransform(d, 0, 0, d, 0, 0); o.onsize && o.onsize(); };
    new ResizeObserver(rs).observe(cv); rs();
    new IntersectionObserver(es => es.forEach(e => o.vis = e.isIntersecting)).observe(cv);
    return o;
  }
  // fire `fn(up)` once each time `v` crosses `at`
  const gates = {};
  const cross = (key, v, at, fn) => { const was = gates[key] || false, is = v > at; if(is !== was){ gates[key] = is; fn(is); } };

  /* ---------- (04) pantry: a shader swatch follows the cursor down the list ---------- */
  const ingList = $('#ingr-list'), ingF = $('#ing-float'), fl = {x:innerWidth / 2, y:innerHeight / 2, s:0, on:false};
  $$('#ingr-list li').forEach(li => {
    li.addEventListener('pointerenter', () => { fl.on = true; ingF._k = +li.dataset.i; ingList.classList.add('hov'); li.classList.add('on'); sfx('pop', {vol:.6, rate:.75}); });
    li.addEventListener('pointerleave', () => li.classList.remove('on'));
  });
  ingList.addEventListener('pointerleave', () => { fl.on = false; ingList.classList.remove('hov'); });
  ingF._a = 0;

  /* ---------- (06) simmer ---------- */
  const simSec = $('#simmer'), simStick = simSec.querySelector('.stick'), simH = $('#sim-h'), sRed = $('#s-red'), sBub = $('#s-bub');
  let boil = 0, popT = -1e6;
  simStick.addEventListener('click', e => {
    const r = simStick.getBoundingClientRect();
    APP.popX = ((e.clientX - r.left) / r.width - .5) * (r.width / r.height); popT = performance.now();
    for(let i = 0; i < 4; i++) sfx('pop', {delay:.001 + i * .07, rate:.7 + Math.random() * .9, pan:APP.pan(e.clientX)});
    sfx('drop', {vol:.7, pan:APP.pan(e.clientX)});
  });

  /* ---------- (09) knife work: one word, seven strips, six cuts ---------- */
  const kSec = $('#knife'), kStage = $('#knife-stage'), kUnder = $('#knife-under'), kCuts = $('#k-cuts'), NS = 7, slices = [];
  for(let i = 0; i < NS; i++){
    const s = document.createElement('div'); s.className = 'kslice';
    s.style.clipPath = `inset(${(i / NS * 100 - .08).toFixed(3)}% 0 ${(100 - (i + 1) / NS * 100 - .08).toFixed(3)}% 0)`;
    s.innerHTML = '<h2>julienne</h2>'; kStage.appendChild(s);
    let line = null;
    if(i){ line = document.createElement('i'); line.className = 'kline'; line.style.top = (i / NS * 100) + '%'; kStage.appendChild(line); }
    slices.push({el:s, line, off:(i % 2 ? 1 : -1) * (1.4 + (i * 37 % 5) * .7)});
  }
  let cuts = 0;

  /* ---------- (11) reduction ---------- */
  const bhSec = $('#reduce'), bhWords = $$('#bh-words h2'), bhD = $('#bh-d'), bhT = $('#bh-t'), bhSt = $('#bh-st');
  const bhStates = ['Stable orbit', 'Decaying orbit', 'Photon sphere', 'Event horizon'];
  let bhS = 0;

  /* ---------- (13) the method ---------- */
  const mSec = $('#method'), mSteps = $$('#m-steps .m-step'), mN = $('#m-n'), mBar = $('#m-bar'), mPlate = $('#m-plate');
  const mKinds = [15, 3, 14, 13, 5, 0]; let mi = 0; mPlate._k = mKinds[0];

  /* ---------- (14) sound kitchen ---------- */
  const PADS = [['bell','Bell','order up'],['chop','Chop','on the board'],['sharpen','Steel','honing'],['ignite','Ignite','gas ring'],['pop','Pop','bubble'],['drop','Drop','tap'],
    ['splash','Splash','sink'],['thunder','Thunder','outside'],['ice','Ice','crack'],['zap','Zap','neon'],['boom','Boom','impact'],['sub','Sub','cave'],
    ['riser','Riser','swell'],['whoosh','Whoosh','pass-by'],['chime','Chime','glass'],['click','Click','button'],['tick','Tick','hover'],['key','Key','switch']];
  const LOOPS = [['fire','Fireplace'],['sizzle','Steak'],['boil','Rolling boil'],['stir','Stirring'],['rain','Rain'],['coldwind','Cold wind'],['wind','Wind tunnel'],['neon','Neon hum'],['drone','Low drone']];
  const padsEl = $('#sk-pads'), loopsEl = $('#sk-loops'), skState = $('#sk-state');
  PADS.forEach(([n, label, sub], i) => {
    const b = document.createElement('button'); b.className = 'pad'; b.dataset.hover = 'PLAY';
    b.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span><span><b>${label}</b><br>${sub}</span>`;
    b.addEventListener('click', e => { e.stopPropagation(); sound().then(() => { sfx(n, {vol:n === 'tick' || n === 'key' ? 2.2 : 1}); b.classList.add('hit'); requestAnimationFrame(() => requestAnimationFrame(() => b.classList.remove('hit'))); }); });
    padsEl.appendChild(b);
  });
  LOOPS.forEach(([n, label]) => {
    const b = document.createElement('button'); b.className = 'lp'; b.dataset.hover = 'HOLD';
    b.innerHTML = `<i></i>${label}<span>loop</span>`;
    b.addEventListener('click', e => { e.stopPropagation(); sound().then(() => { const on = !A.boost[n]; A.boost[n] = on ? .85 : 0; b.classList.toggle('on', on); sfx('click'); }); });
    loopsEl.appendChild(b);
  });
  const V = fit($('#viz'));
  function viz(t){
    const {ctx, W, H} = V; ctx.clearRect(0, 0, W, H);
    const live = A.on && A.fd, cx = W / 2, cy = H * .47, R = Math.min(W, H) * .2 * (1 + (live ? A.bass * .25 : 0)), N = 72;
    ctx.lineCap = 'round';
    for(let pass = 0; pass < 2; pass++){
      ctx.beginPath();
      for(let i = 0; i < N; i++){
        const v = live ? A.fd[2 + Math.floor(Math.pow(i / N, 1.7) * 200)] / 255 : .1 + .07 * Math.sin(t * .0018 + i * .45) * Math.sin(t * .0007 + i * .13);
        if((v > .55) !== !!pass) continue;
        const len = 5 + v * v * Math.min(W, H) * .24, a0 = (i + .5) / N * Math.PI;
        for(const a of [a0 - Math.PI / 2, -a0 - Math.PI / 2]){ const c = Math.cos(a), s = Math.sin(a); ctx.moveTo(cx + c * (R + 8), cy + s * (R + 8)); ctx.lineTo(cx + c * (R + 8 + len), cy + s * (R + 8 + len)); }
      }
      ctx.strokeStyle = pass ? '#ff5b24' : 'rgba(236,236,240,.55)'; ctx.lineWidth = 2.2; ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgba(255,91,36,${live ? .12 + A.level * .7 : .06})`); g.addColorStop(1, 'rgba(255,91,36,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    if(live){   // waveform-ish inner ring from the low bins
      ctx.beginPath();
      for(let i = 0; i <= 90; i++){ const a = i / 90 * 6.2832, v = A.fd[4 + (i % 45)] / 255, r = R * (.45 + v * .35); i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + r, cy); }
      ctx.closePath(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    const act = A.loopNames.filter(n => A.on && Math.max(A.vol[n], A.boost[n]) > .05);
    skState.textContent = !A.on ? 'Sound off — tap any pad' : !A.ready ? 'Decoding 27 recordings…' : 'Live — ' + (act.length ? act.join(' + ') : 'silence');
  }

  /* ---------- (16) flash freeze: the cursor writes into a small mask the frost shader reads ---------- */
  const frSec = $('#freeze'), frStick = frSec.querySelector('.stick'), fTemp = $('#f-temp'), fCov = $('#f-cov');
  const wipe = document.createElement('canvas'); wipe.width = 256; wipe.height = 144;
  const wx = wipe.getContext('2d'); wx.fillStyle = '#000'; wx.fillRect(0, 0, 256, 144); APP.wipe = wipe;
  let frS = 0;
  const wpos = e => { const r = frStick.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 256, (e.clientY - r.top) / r.height * 144]; };
  frStick.addEventListener('pointermove', e => {
    const [x, y] = wpos(e), g = wx.createRadialGradient(x, y, 0, x, y, 20);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); wx.fillStyle = g; wx.fillRect(x - 20, y - 20, 40, 40);
  });
  frStick.addEventListener('click', e => {
    const [x, y] = wpos(e);
    wx.strokeStyle = '#fff'; wx.lineCap = 'round';
    for(let i = 0; i < 9; i++){   // jagged cracks radiating from the click
      let a = Math.random() * 6.2832, px = x, py = y; wx.lineWidth = 3.5; wx.beginPath(); wx.moveTo(px, py);
      for(let k = 0; k < 5; k++){ a += (Math.random() - .5) * .9; const l = 8 + Math.random() * 16; px += Math.cos(a) * l; py += Math.sin(a) * l * .8; wx.lineTo(px, py); }
      wx.stroke();
    }
    const g = wx.createRadialGradient(x, y, 0, x, y, 30); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); wx.fillStyle = g; wx.fillRect(x - 30, y - 30, 60, 60);
    sfx('ice', {pan:APP.pan(e.clientX)}); sfx('chime', {vol:.5, rate:1.5, delay:.05});
  });

  /* ---------- (17) the pass: plates fly at the camera ---------- */
  const dSec = $('#plates'), dStage = $('#depth-stage'), dH = $('#depth-h'), dN = $('#d-n');
  const DK = [0, 9, 2, 11, 4, 10, 15, 13, 1, 14], DNM = ['Liquid gold', 'Northern broth', 'Cold crystal', 'Charred crust', 'Molten silk', 'Clear consommé', 'Quicksilver', 'Lightspeed', 'Plasma bloom', 'Smoke'];
  const OX = [-.55, .6, -.2, .5, -.65, .25, .62, -.45, .1, -.6], OY = [-.3, .25, .4, -.35, .2, -.42, .05, -.1, .38, .3];
  const frames = [];
  for(let i = DK.length - 1; i >= 0; i--){   // far plates first, so nearer ones are drawn over them
    const el = document.createElement('div'); el.className = 'dframe';
    el.innerHTML = `<div class="slot" data-k="${DK[i]}"></div><span class="mono">Table ${String(i * 7 % 23 + 1).padStart(2, '0')} — ${DNM[i]}</span>`;
    dStage.appendChild(el);
    const slot = el.firstChild; slot._a = 0; APP.addSlot && APP.addSlot(slot);
    frames[i] = {el, slot};
  }
  let dOut = 0;

  /* ---------- (18) storm ---------- */
  const stSec = $('#storm'), ST = fit($('#storm-c'));
  let bolts = [], flash = 0, nextAuto = 0, rain = [], clouds = [];
  ST.onsize = () => {
    rain = Array.from({length:240}, () => ({x:Math.random() * ST.W * 1.2, y:Math.random() * ST.H, v:14 + Math.random() * 14, l:12 + Math.random() * 22}));
    clouds = Array.from({length:7}, (_, i) => ({x:Math.random() * ST.W, y:ST.H * (.02 + Math.random() * .3), r:ST.W * (.18 + Math.random() * .2), v:.15 + Math.random() * .3}));
  };
  ST.onsize();
  function mkBolt(x0, y0, x1, y1, w, depth, out){
    const pts = [[x0, y0]], len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(4, len / 22 | 0);
    for(let i = 1; i <= n; i++){
      const t = i / n, j = i === n ? 0 : (1 - t * .5) * len * .07;
      const x = lerp(x0, x1, t) + (Math.random() - .5) * j, y = lerp(y0, y1, t) + (Math.random() - .5) * j * .4;
      pts.push([x, y]);
      if(depth < 2 && i < n - 1 && Math.random() < (depth ? .1 : .22)){
        const a = Math.atan2(y1 - y0, x1 - x0) + (Math.random() - .5) * 1.6, l = len * (.18 + Math.random() * .3) * (1 - t * .5);
        mkBolt(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, w * .5, depth + 1, out);
      }
    }
    out.push({pts, w}); return out;
  }
  function strike(x, y, power){
    bolts.push({segs:mkBolt(x + (Math.random() - .5) * ST.W * .35, -10, x, y, 2.6 * power, 0, []), life:1, x, y});
    flash = Math.max(flash, power);
    sfx('zap', {vol:power, pan:APP.pan(x)}); sfx('thunder', {delay:.12 + Math.random() * .5, vol:.45 + power * .55, pan:APP.pan(x) * .6});
  }
  stSec.addEventListener('click', e => { const r = ST.cv.getBoundingClientRect(); strike(e.clientX - r.left, e.clientY - r.top, 1); nextAuto = performance.now() + 5000; });
  function storm(now){
    const {ctx, W, H} = ST;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${18 + flash * 120 | 0},${22 + flash * 130 | 0},${38 + flash * 160 | 0})`); g.addColorStop(1, '#020308');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for(const c of clouds){
      c.x += c.v; if(c.x - c.r > W) c.x = -c.r;
      const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r), a = .06 + flash * .24;
      cg.addColorStop(0, `rgba(150,165,210,${a})`); cg.addColorStop(1, 'rgba(150,165,210,0)');
      ctx.fillStyle = cg; ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }
    ctx.strokeStyle = `rgba(170,190,235,${.16 + flash * .35})`; ctx.lineWidth = 1; ctx.beginPath();
    for(const d of rain){ d.y += d.v; d.x -= d.v * .18; if(d.y > H){ d.y = -30; d.x = Math.random() * W * 1.2; } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * .18, d.y + d.l); }
    ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'lighter';
    for(const b of bolts){
      const a = b.life * (b.life > .55 && Math.random() < .3 ? .35 : 1);
      for(const s of b.segs){
        ctx.beginPath(); s.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.strokeStyle = `rgba(120,150,255,${a * .25})`; ctx.lineWidth = s.w * 7; ctx.stroke();
        ctx.strokeStyle = `rgba(200,215,255,${a * .5})`; ctx.lineWidth = s.w * 2.6; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = s.w; ctx.stroke();
      }
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 260);
      rg.addColorStop(0, `rgba(255,170,110,${a * .5})`); rg.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = rg; ctx.fillRect(b.x - 260, b.y - 260, 520, 520);
      b.life -= .035;
    }
    ctx.globalCompositeOperation = 'source-over';
    bolts = bolts.filter(b => b.life > 0); flash *= .88;
    if(now > nextAuto){ nextAuto = now + 4200 + Math.random() * 4500; strike(W * (.15 + Math.random() * .7), H * (.35 + Math.random() * .4), .55); }
  }

  /* ---------- (20) brigade: names scramble in when called ---------- */
  const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/*+<>';
  function scramble(el){
    const to = el._t || (el._t = el.textContent); let f = 0; clearInterval(el._iv);
    el._iv = setInterval(() => {
      f++; el.textContent = [...to].map((c, i) => c === ' ' || i < f * .6 ? c : CH[Math.random() * CH.length | 0]).join('');
      if(f * .6 > to.length){ clearInterval(el._iv); el.textContent = to; }
    }, 26);
  }
  $$('#brig li').forEach(li => li.addEventListener('pointerenter', () => { scramble(li.querySelector('b')); for(let i = 0; i < 5; i++) sfx('key', {delay:.001 + i * .05, vol:.8}); }));

  /* ---------- (22) closing time ---------- */
  const clSec = $('#closing'), neon = $('#neon'), cClock = $('#c-clock');
  let neonOn = true, flk = false; APP.neon = 1;
  neon.addEventListener('click', e => { e.stopPropagation(); neonOn = !neonOn; neon.classList.toggle('off', !neonOn); sfx('zap', {vol:1.4}); sfx('click'); });

  /* ---------- soundscape: where you are on the page decides which recordings you hear ---------- */
  const S = {heat:$('#heat'), foot:$('footer'), menu:$('#menu'), ingr:$('#ingredients'), tun:$('#tunnel'), sauce:$('#sauce'), waves:$('#waves')};
  function scape(){
    const v = A.vol, tp = APP.prog(S.tun), bv = vis(bhSec);
    v.drone = .32 + bv * .55; A.rate.drone = 1 - bv * bhS * .5;
    v.fire = vis(S.heat) * (.12 + (APP.heatLvl || 0) * .88) + vis(S.foot) * .6;
    v.sizzle = vis(S.menu) * .42 + vis(S.ingr) * (fl.on ? .5 : .1);
    v.boil = vis(simSec) * (.12 + boil * .88); A.rate.boil = .82 + boil * .36;
    v.wind = vis(S.tun) * (.2 + tp * .5 + Math.min(.35, Math.abs(APP.vel || 0) / 90)); A.rate.wind = .7 + tp * .7;
    v.coldwind = vis(frSec) * (.3 + frS * .7);
    v.rain = vis(clSec) * .9 + vis(stSec) * .75;
    v.neon = vis(clSec) * (APP.neon || 0) * .7;
    v.stir = vis(S.sauce) * (.12 + (APP.stir || 0) * .88);
  }

  /* ---------- one loop for all of it ---------- */
  (function loop(now){
    requestAnimationFrame(loop);
    const H = innerHeight, W = innerWidth;

    // pantry swatch
    if(fl.on){ const u = document.elementFromPoint(APP.px, APP.py); if(!u || !u.closest('#ingr-list')){ fl.on = false; ingList.classList.remove('hov'); $$('#ingr-list li.on').forEach(l => l.classList.remove('on')); } }
    fl.x = lerp(fl.x, APP.px, .14); fl.y = lerp(fl.y, APP.py, .14); fl.s = lerp(fl.s, fl.on ? 1 : 0, .13);
    if(fl.s > .004 || ingF._a){
      const fw = ingF.offsetWidth, fh = ingF.offsetHeight, x = Math.min(fl.x + 36, W - fw - 16), y = clamp(fl.y - fh * .6, 80, H - fh - 16);
      ingF.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${fl.s.toFixed(3)})`;
      ingF.style.opacity = ingF._a = fl.s < .004 ? 0 : fl.s;
    }

    // simmer
    let r = simSec.getBoundingClientRect();
    if(inView(r)){
      boil = lerp(boil, APP.prog(simSec), .08); APP.boil = boil; APP.popAge = (now - popT) / 1000;
      sRed.textContent = Math.round(boil * 68); sBub.textContent = Math.round(12 + boil * boil * 480);
      simH.classList.toggle('hot', boil > .5);
      cross('boil', boil, .5, up => up && sfx('ignite', {vol:.6, rate:.8}));
    }

    // knife
    r = kSec.getBoundingClientRect();
    if(inView(r)){
      const kp = APP.prog(kSec), nc = kp < .08 ? 0 : clamp(Math.floor((kp - .08) / .52 * (NS - 1)) + 1, 0, NS - 1);
      cross('knife', kp, .01, up => { if(up){ sfx('sharpen'); sfx('sharpen', {delay:.32, rate:1.18}); } });
      if(nc !== cuts){
        if(nc > cuts){ sfx('chop', {pan:(nc % 2 ? -.4 : .4)}); const l = slices[nc].line; if(l){ l.classList.remove('go'); void l.offsetWidth; l.classList.add('go'); } }
        cuts = nc; kCuts.textContent = cuts;
      }
      const fly = clamp((kp - .68) / .26, 0, 1), fe = fly * fly;
      slices.forEach((s, i) => {
        const loose = i < cuts || cuts === NS - 1, dir = i % 2 ? 1 : -1;
        s.el.style.transform = `translate3d(${((loose ? s.off : 0) + dir * fe * 125).toFixed(2)}vw,${(loose ? (i - (NS - 1) / 2) * cuts * .12 : 0).toFixed(2)}vw,0)`;
      });
      kUnder.style.opacity = fly; kUnder.style.transform = `scale(${.86 + fly * .14})`;
      cross('sharp', kp, .8, up => up && sfx('chime', {vol:.8}));
    }

    // reduction
    r = bhSec.getBoundingClientRect();
    if(inView(r)){
      const bp = APP.prog(bhSec); bhS = lerp(bhS, bp, .08); APP.bh = bhS;
      const dist = 60 * Math.pow(1 - bhS, 2.2) + 1.0005, td = 1 / Math.sqrt(1 - 1 / dist);
      bhD.textContent = dist.toFixed(1); bhT.textContent = td > 40 ? '∞' : td.toFixed(2);
      bhSt.textContent = bhStates[Math.min(3, Math.floor(bp * 4))];
      bhWords.forEach((w, i) => {
        const l = (bp - (.16 + i * .28)) / .13, o = clamp(1 - Math.abs(l), 0, 1);
        w.style.opacity = o; w.style.transform = `scale(${.55 + (clamp(l, -1, 1.4) + 1) * .5})`; w.style.filter = `blur(${Math.max(0, l) * 10}px)`;
      });
      cross('bh-in', bp, .02, up => up && sfx('sub'));
      cross('bh-end', bp, .7, up => up && sfx('riser', {vol:.9, rate:.85}));
    }

    // method
    r = mSec.getBoundingClientRect();
    if(inView(r)){
      const mp = APP.prog(mSec), n = mSteps.length, f = Math.min(n - .0001, mp * n), i = Math.floor(f), loc = f - i;
      if(i !== mi){
        mi = i; mSteps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('past', k < i); });
        mN.textContent = '0' + (i + 1); mPlate._k = mKinds[i]; sfx('whoosh', {vol:.4, rate:1.2}); sfx('tick', {vol:2});
      }
      mPlate._a = clamp(Math.min(i === 0 ? 1 : loc * 9, i === n - 1 ? 1 : (1 - loc) * 9), 0, 1);
      mBar.style.width = (mp * 100) + '%';
    }

    // sound kitchen + storm canvases
    if(V.vis) viz(now);
    if(ST.vis) storm(now);

    // freeze
    r = frSec.getBoundingClientRect();
    if(inView(r)){
      const fp = APP.prog(frSec); frS = lerp(frS, fp, .08); APP.frost = frS;
      wx.fillStyle = 'rgba(0,0,0,.022)'; wx.fillRect(0, 0, 256, 144);   // the glass slowly re-freezes
      fTemp.textContent = Math.round(4 - frS * 44); fCov.textContent = Math.round(clamp(frS * 1.15, 0, 1) * 100);
      cross('fr1', fp, .3, up => up && sfx('ice', {vol:.45, rate:.8}));
      cross('fr2', fp, .7, up => up && sfx('ice', {vol:.6, rate:.65}));
    }

    // the pass
    r = dSec.getBoundingClientRect();
    if(inView(r)){
      const dp = APP.prog(dSec), n = frames.length; let out = 0;
      frames.forEach((f, i) => {
        const z = i * .8 + 1.5 - dp * (n * .8 + 1.9);
        if(z < .6) out++;
        if(z < .3 || z > 4.2){ if(f.slot._a){ f.slot._a = 0; f.el.style.visibility = 'hidden'; } return; }
        const s = .8 / z, a = clamp((4.2 - z) / 1.6, 0, 1) * clamp((z - .32) / .4, 0, 1);
        f.slot._a = a; f.el.style.visibility = 'visible'; f.el.style.opacity = a;
        f.el.style.transform = `translate3d(${(OX[i] * W * .3 * s).toFixed(1)}px,${(OY[i] * H * .3 * s).toFixed(1)}px,0) scale(${s.toFixed(4)})`;
      });
      if(out !== dOut){ if(out > dOut) sfx('whoosh', {rate:.9 + Math.random() * .4, pan:OX[Math.min(n - 1, out - 1)] * .9}); dOut = out; dN.textContent = String(out).padStart(2, '0'); }
      dH.style.transform = `translateY(-50%) scale(${1 + dp * .5})`; dH.style.opacity = .25 + .75 * clamp(1 - dp * 3, 0, 1) + .75 * clamp((dp - .9) / .1, 0, 1);
      cross('pass-end', dp, .96, up => up && sfx('bell'));
    } else if(dOut && r.top > H){ frames.forEach(f => { f.slot._a = 0; }); }

    // closing time
    r = clSec.getBoundingClientRect();
    if(inView(r)){
      const cp = APP.prog(clSec), mins = 90 + Math.round(cp * 90);
      cClock.textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
      if(neonOn && !flk && Math.random() < .012){
        flk = true; neon.classList.add('flk'); sfx('zap', {vol:.5, rate:1.3});
        setTimeout(() => { flk = false; neon.classList.remove('flk'); }, 50 + Math.random() * 150);
      }
      APP.neon = lerp(APP.neon, neonOn && !flk ? 1 : .04, .35);
    }

    if(A.on) scape();
  })(performance.now());
})();
