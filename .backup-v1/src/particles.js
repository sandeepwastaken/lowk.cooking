/* ===== particle text morph ===== */
(function(){
  const cv = document.getElementById('pt'), ctx = cv.getContext('2d');
  const words = ['lowk', 'cooking', 'hot', 'served'];
  const dotsEl = document.getElementById('pt-dots'), countEl = document.getElementById('pt-count');
  words.forEach(() => dotsEl.appendChild(document.createElement('i')));
  const NB = 12, COLS = [];
  for(let i = 0; i < NB; i++) COLS.push(`rgba(236,236,240,${(.3 + i * .06).toFixed(2)})`);
  COLS.push('#ff5b24');

  let W = 0, H = 0, dpr = 1, N = 0, P = [], wi = 0, visible = false, lastAct = 0, cache = {};
  const m = {x:-1e4, y:-1e4, vx:0, vy:0};

  function size(){
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    N = Math.min(10000, Math.floor(W * H / 100));
    cache = {};
  }

  function sample(word){
    if(cache[word]) return cache[word];
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    const o = oc.getContext('2d');
    let fs = Math.min(H * .4, W * 1.6 / word.length);
    const setF = () => { o.font = `700 ${fs}px Geist, system-ui, sans-serif`; if('letterSpacing' in o) o.letterSpacing = (-fs * .06) + 'px'; };
    setF(); while(o.measureText(word).width > W * .88){ fs *= .93; setF(); }
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    o.fillText(word, W / 2, H * .47);
    const d = o.getImageData(0, 0, W, H).data, pts = [], g = 2;
    for(let y = 0; y < H; y += g) for(let x = 0; x < W; x += g) if(d[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
    // shuffle pairs
    for(let i = pts.length / 2 - 1; i > 0; i--){
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i*2], pts[j*2]] = [pts[j*2], pts[i*2]]; [pts[i*2+1], pts[j*2+1]] = [pts[j*2+1], pts[i*2+1]];
    }
    return cache[word] = pts;
  }

  function setWord(i){
    wi = (i + words.length) % words.length;
    const pts = sample(words[wi]), L = pts.length / 2 || 1;
    for(let k = 0; k < P.length; k++){
      const p = P[k], j = k % L;
      p.tx = pts[j*2] + (k >= L ? (Math.random() - .5) * 3 : 0);
      p.ty = pts[j*2+1] + (k >= L ? (Math.random() - .5) * 3 : 0);
      p.c = (Math.random() * NB) | 0;
    }
    [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === wi));
  }

  function build(){
    size();
    if(W < 2 || H < 2) return;
    W = Math.floor(W); H = Math.floor(H);
    P = [];
    for(let i = 0; i < N; i++) P.push({x:Math.random() * W, y:Math.random() * H, vx:0, vy:0, tx:W/2, ty:H/2, c:0, k:.55 + Math.random() * .9});
    setWord(wi);
    countEl.textContent = N.toLocaleString() + ' particles';
  }

  function blast(x, y, power){
    for(const p of P){
      const dx = p.x - x, dy = p.y - y, d = Math.sqrt(dx*dx + dy*dy) + 1;
      const f = power * Math.max(0, 1 - d / (Math.max(W, H) * .9));
      p.vx += dx / d * f * (.6 + Math.random()) + (Math.random() - .5) * 4;
      p.vy += dy / d * f * (.6 + Math.random()) + (Math.random() - .5) * 4;
    }
  }

  function pos(e){ const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  cv.addEventListener('pointermove', e => {
    const [x, y] = pos(e);
    if(m.x > -1e3){ m.vx = x - m.x; m.vy = y - m.y; }
    m.x = x; m.y = y; lastAct = performance.now();
  });
  cv.addEventListener('pointerleave', () => { m.x = m.y = -1e4; });
  cv.addEventListener('click', e => {
    const [x, y] = pos(e);
    blast(x, y, 38); setWord(wi + 1); lastAct = performance.now();
    APP.sfx && APP.sfx('boom');
  });

  new IntersectionObserver(es => es.forEach(en => { visible = en.isIntersecting; if(visible) lastAct = performance.now(); }), {threshold:.15}).observe(cv);

  const R = 120, R2 = R * R;
  function frame(now){
    requestAnimationFrame(frame);
    if(!visible || !P.length) return;
    if(now - lastAct > 5200){ blast(W/2, H/2, 14); setWord(wi + 1); lastAct = now; }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const paths = COLS.map(() => new Path2D()), t = now * .001;
    m.vx *= .85; m.vy *= .85;
    for(let i = 0; i < P.length; i++){
      const p = P[i];
      let ax = (p.tx + Math.sin(t * 2 + i) * .6 - p.x) * .011 * p.k;
      let ay = (p.ty + Math.cos(t * 1.7 + i) * .6 - p.y) * .011 * p.k;
      const dx = p.x - m.x, dy = p.y - m.y, d2 = dx*dx + dy*dy;
      if(d2 < R2){
        const d = Math.sqrt(d2) || 1, f = 1 - d / R, nx = dx / d, ny = dy / d;
        ax += (nx * 3.4 - ny * 1.6) * f + m.vx * f * .09;
        ay += (ny * 3.4 + nx * 1.6) * f + m.vy * f * .09;
      }
      p.vx = (p.vx + ax) * .875; p.vy = (p.vy + ay) * .875;
      p.x += p.vx; p.y += p.vy;
      const sp = p.vx*p.vx + p.vy*p.vy;
      const s = sp > 30 ? 2 : 1.4;
      paths[sp > 30 ? NB : p.c].rect(p.x, p.y, s, s);
    }
    for(let b = 0; b <= NB; b++){ ctx.fillStyle = COLS[b]; ctx.fill(paths[b]); }
  }

  let rt, lastW = 0;
  new ResizeObserver(() => {
    const w = Math.floor(cv.getBoundingClientRect().width);
    if(w === lastW) return; lastW = w;
    clearTimeout(rt); rt = setTimeout(build, 150);
  }).observe(cv);
  requestAnimationFrame(frame);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { cache = {}; build(); });
})();
