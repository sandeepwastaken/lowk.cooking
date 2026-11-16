/* ===== sections: marquee, manifesto, reveals, cards, waves, stats, footer, sparks ===== */
(function(){
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;

  /* --- marquee --- */
  const rows = $$('.mq-row');
  const phr = [['lowkey', ''], ['cooking', 'em'], ['realtime', 'd'], ['served hot', 'em'], ['no recipes', ''], ['all heat', 'em d']];
  rows.forEach(r => {
    let h = '';
    for(let k = 0; k < 4; k++) phr.forEach(([t, c], i) => {
      const txt = c.includes('em') ? '<em>' + t + '</em>' : t;
      h += '<span class="' + (c.includes('d') ? 'd' : '') + '">' + txt + '<i class="sep' + (i % 3 === 2 ? ' acc' : '') + '"></i></span>';
    });
    r.innerHTML = h; r._x = 0;
  });

  /* --- manifesto word scrub --- */
  const mani = $('#mani'), words = [];
  (function wrap(node){
    [...node.childNodes].forEach(n => {
      if(n.nodeType === 3){
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t => {
          if(!t) return;
          if(/^\s+$/.test(t)){ frag.appendChild(document.createTextNode(t)); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = t;
          const p = node.classList && node !== mani ? [...node.classList] : [];
          p.forEach(c => s.classList.add(c));
          frag.appendChild(s); words.push(s);
        });
        node.replaceChild(frag, n);
      } else wrap(n);
    });
  })(mani);

  /* --- reveal on view --- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting){
      const el = e.target, i = [...el.parentNode.children].indexOf(el);
      el.style.transitionDelay = (Math.max(0, i) * .08) + 's';
      el.classList.add('in'); io.unobserve(el);
      setTimeout(() => el.style.transitionDelay = '', 1400);
      if(el.querySelector('[data-count]')) count(el.querySelector('[data-count]'));
    }
  }), {threshold:.2});
  $$('.rv').forEach(el => io.observe(el));

  /* --- counters --- */
  function count(el){
    const to = +el.dataset.count;
    if(to < 0){ // infinity: scramble then land
      let n = 0; const iv = setInterval(() => { el.textContent = (Math.random() * 999 | 0); if(++n > 22){ clearInterval(iv); el.textContent = '∞'; } }, 45);
      return;
    }
    const t0 = performance.now();
    (function tick(now){
      const k = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - k, 4);
      el.textContent = to === 0 ? (k < 1 ? (Math.random() * 9 | 0) : 0) : Math.round(e * to);
      if(k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* --- waves: spring dot grid with shockwaves --- */
  const wv = $('#wv'), wx = wv.getContext('2d');
  let WW, WH, G = [], gap, shocks = [], wVis = false;
  const wm = {x:-1e4, y:-1e4};
  function wsize(){
    const d = Math.min(devicePixelRatio || 1, 2), r = wv.getBoundingClientRect();
    WW = r.width; WH = r.height; wv.width = WW * d; wv.height = WH * d; wx.setTransform(d, 0, 0, d, 0, 0);
    gap = WW < 600 ? 22 : 28; G = [];
    for(let y = gap / 2; y < WH; y += gap) for(let x = gap / 2; x < WW; x += gap) G.push({ox:x, oy:y, x, y, vx:0, vy:0, e:0});
  }
  wv.parentNode.addEventListener('pointermove', e => { const r = wv.getBoundingClientRect(); wm.x = e.clientX - r.left; wm.y = e.clientY - r.top; });
  wv.parentNode.addEventListener('pointerleave', () => { wm.x = wm.y = -1e4; });
  wv.parentNode.addEventListener('click', e => {
    const r = wv.getBoundingClientRect();
    shocks.push({x:e.clientX - r.left, y:e.clientY - r.top, r:0, a:1});
    APP.sfx && APP.sfx('boom');
  });
  new IntersectionObserver(es => es.forEach(en => wVis = en.isIntersecting), {threshold:.1}).observe(wv);
  let autoT = 0;
  function wframe(now){
    requestAnimationFrame(wframe);
    if(!wVis) return;
    if(now - autoT > 2600 && wm.x < -1e3){ autoT = now; shocks.push({x:WW * (.2 + Math.random() * .6), y:WH * (.2 + Math.random() * .6), r:0, a:.7}); }
    wx.clearRect(0, 0, WW, WH);
    shocks.forEach(s => { s.r += 9; s.a *= .975; });
    shocks = shocks.filter(s => s.a > .04 && s.r < Math.max(WW, WH) * 1.4);
    for(const p of G){
      let ax = (p.ox - p.x) * .06, ay = (p.oy - p.y) * .06;
      const dx = p.x - wm.x, dy = p.y - wm.y, d2 = dx*dx + dy*dy;
      if(d2 < 160*160){ const d = Math.sqrt(d2) || 1, f = 1 - d / 160; ax += dx / d * f * 2.2; ay += dy / d * f * 2.2; p.e = Math.max(p.e, f); }
      for(const s of shocks){
        const sx = p.ox - s.x, sy = p.oy - s.y, sd = Math.sqrt(sx*sx + sy*sy) || 1, band = Math.abs(sd - s.r);
        if(band < 40){ const f = (1 - band / 40) * s.a; ax += sx / sd * f * 6; ay += sy / sd * f * 6; p.e = Math.max(p.e, f); }
      }
      p.vx = (p.vx + ax) * .82; p.vy = (p.vy + ay) * .82; p.x += p.vx; p.y += p.vy; p.e *= .94;
      const e = p.e, rad = 1.1 + e * 3.6;
      wx.fillStyle = e > .5 ? `rgba(255,91,36,${(.4 + e * .6).toFixed(2)})` : `rgba(236,236,240,${(.24 + e * 1.3).toFixed(2)})`;
      wx.beginPath(); wx.arc(p.x, p.y, rad, 0, 6.2832); wx.fill();
    }
    shocks.forEach(s => { wx.strokeStyle = `rgba(255,255,255,${s.a * .35})`; wx.lineWidth = 1; wx.beginPath(); wx.arc(s.x, s.y, s.r, 0, 6.2832); wx.stroke(); });
  }

  /* --- magnetic button + footer letters --- */
  const mag = $('#mag'), magS = mag.querySelector('span');
  mag.addEventListener('pointermove', e => {
    const r = mag.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    mag.style.transform = `translate(${x * .4}px,${y * .4}px)`; magS.style.transform = `translate(${x * .2}px,${y * .2}px)`;
  });
  mag.addEventListener('pointerleave', () => { mag.style.transition = 'transform .8s cubic-bezier(.16,1,.3,1)'; mag.style.transform = magS.style.transform = ''; setTimeout(() => mag.style.transition = '', 800); });
  const bigL = $$('#big span');

  /* --- click sparks + cursor trail on overlay canvas --- */
  const fx = $('#fx'), fc = fx.getContext('2d');
  let FW, FH, sparks = [], trail = [];
  function fsize(){ const d = Math.min(devicePixelRatio || 1, 2); FW = innerWidth; FH = innerHeight; fx.width = FW * d; fx.height = FH * d; fc.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener('click', e => {
    if(e.target.closest('#pt,#wv,.waves')) return;
    for(let i = 0; i < 26; i++){ const a = Math.random() * 6.283, s = 2 + Math.random() * 7; sparks.push({x:e.clientX, y:e.clientY, vx:Math.cos(a) * s, vy:Math.sin(a) * s, l:1, c:Math.random() < .35 ? '255,91,36' : '255,255,255'}); }
  });

  /* --- per-frame updates --- */
  (function loop(now){
    requestAnimationFrame(loop);
    const v = APP.vel || 0;
    rows.forEach((r, i) => {
      const dir = -1, w = r.scrollWidth / 4;
      r._x += dir * (1.1 + Math.abs(v) * .35) * (v < 0 ? -1 : 1);
      if(r._x < -w) r._x += w; if(r._x > 0) r._x -= w;
      r.style.transform = `translate3d(${r._x}px,0,0) skewX(${Math.max(-14, Math.min(14, -v * .35))}deg)`;
    });
    // manifesto scrub
    const mr = mani.getBoundingClientRect(), H = innerHeight;
    if(mr.top < H && mr.bottom > 0){
      const k = (H * .82 - mr.top) / (mr.height + H * .25), lit = Math.floor(k * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < lit));
    }
    // footer letters wave toward cursor
    const br = bigL[0] && bigL[0].parentNode.getBoundingClientRect();
    if(br && br.top < H){
      bigL.forEach((s, i) => {
        const r = s.getBoundingClientRect(), d = Math.abs(APP.px - (r.left + r.width / 2)), k = Math.max(0, 1 - d / 300);
        s._y = lerp(s._y || 0, -k * 60 + Math.sin(now * .002 + i * .6) * 6, .12);
        s.style.transform = `translate3d(0,${s._y}px,0)`;
      });
    }
    // trail + sparks
    fc.clearRect(0, 0, FW, FH);
    trail.push({x:APP.px, y:APP.py}); if(trail.length > 22) trail.shift();
    if(matchMedia('(hover:hover)').matches && trail.length > 2){
      fc.lineCap = 'round';
      for(let i = 1; i < trail.length; i++){
        const k = i / trail.length;
        fc.strokeStyle = `rgba(255,255,255,${(k * .16).toFixed(3)})`; fc.lineWidth = k * 2.5;
        fc.beginPath(); fc.moveTo(trail[i-1].x, trail[i-1].y); fc.lineTo(trail[i].x, trail[i].y); fc.stroke();
      }
    }
    fc.globalCompositeOperation = 'lighter';
    sparks.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.vx *= .93; s.vy = s.vy * .93 + .15; s.l -= .022;
      fc.strokeStyle = `rgba(${s.c},${s.l.toFixed(2)})`; fc.lineWidth = 1.5;
      fc.beginPath(); fc.moveTo(s.x, s.y); fc.lineTo(s.x - s.vx * 3, s.y - s.vy * 3); fc.stroke();
    });
    fc.globalCompositeOperation = 'source-over';
    sparks = sparks.filter(s => s.l > 0);
  })(performance.now());

  function rs(){ wsize(); fsize(); }
  rs(); addEventListener('resize', rs);
  requestAnimationFrame(wframe);
})();
