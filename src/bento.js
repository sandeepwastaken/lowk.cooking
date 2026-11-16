/* ===== systems bento: spotlight, sphere, fps chart, terminal, dither field, nav state ===== */
(function(){
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const bento = $('#bento'), tiles = $$('.tile');
  let vis = false;
  new IntersectionObserver(es => es.forEach(e => vis = e.isIntersecting), {rootMargin:'100px'}).observe(bento);

  /* spotlight borders follow the cursor across every tile */
  bento.addEventListener('pointermove', e => tiles.forEach(t => {
    const r = t.getBoundingClientRect();
    t.style.setProperty('--x', (e.clientX - r.left) + 'px'); t.style.setProperty('--y', (e.clientY - r.top) + 'px');
  }));
  bento.addEventListener('pointerleave', () => tiles.forEach(t => { t.style.setProperty('--x', '-999px'); t.style.setProperty('--y', '-999px'); }));

  /* hi-dpi canvas helper */
  function fit(cv){
    const o = {cv, ctx:cv.getContext('2d'), W:0, H:0};
    const rs = () => { const d = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      o.W = r.width; o.H = r.height; cv.width = r.width * d; cv.height = r.height * d; o.ctx.setTransform(d, 0, 0, d, 0, 0); };
    new ResizeObserver(rs).observe(cv); rs(); return o;
  }

  /* --- point-cloud sphere --- */
  const S = fit($('#b-sphere')), NP = 2400, pts = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for(let i = 0; i < NP; i++){
    const y = 1 - (i / (NP - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random() < .025]);
  }
  let yaw = 0, pitch = -.35, vyaw = .004, vpitch = 0, drag = null;
  const sc = S.cv;
  sc.addEventListener('pointerdown', e => { drag = {x:e.clientX, y:e.clientY}; sc.setPointerCapture(e.pointerId); });
  sc.addEventListener('pointermove', e => {
    if(!drag) return;
    vyaw = (e.clientX - drag.x) * .0035; vpitch = (e.clientY - drag.y) * .0035;
    drag = {x:e.clientX, y:e.clientY};
  });
  sc.addEventListener('pointerup', () => drag = null);
  const ALPH = [.06, .1, .16, .24, .34, .46, .6, .78, .95];
  function sphere(t){
    const {ctx, W, H} = S; ctx.clearRect(0, 0, W, H);
    if(!drag){ vyaw += (.0035 - vyaw) * .02; vpitch *= .95; }
    yaw += vyaw; pitch = Math.max(-1.2, Math.min(1.2, pitch + vpitch));
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const R = Math.min(W, H) * .34, cx = W / 2, cyy = H * .44;
    const paths = ALPH.map(() => new Path2D()), acc = new Path2D();
    const scan = Math.sin(t * .0008) * .95;
    for(const p of pts){
      const wob = 1 + .045 * Math.sin(p[0] * 4 + t * .0015) * Math.sin(p[1] * 4 - t * .001);
      let x = p[0] * wob, y = p[1] * wob, z = p[2] * wob;
      let x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      let y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const f = 2.6 / (2.6 + z2), b = (1 - z2) / 2;
      const band = Math.max(0, 1 - Math.abs(p[1] - scan) * 9);
      const lum = Math.min(1, b * b * .9 + band * .8 * b);
      const sx = cx + x1 * R * f, syy = cyy + y1 * R * f, s = .6 + b * 1.5;
      if(p[3] && b > .35) acc.rect(sx - 1, syy - 1, s + 1.2, s + 1.2);
      else paths[Math.min(ALPH.length - 1, (lum * ALPH.length) | 0)].rect(sx, syy, s, s);
    }
    paths.forEach((p, i) => { ctx.fillStyle = `rgba(240,240,244,${ALPH[i]})`; ctx.fill(p); });
    ctx.shadowColor = '#ff5b24'; ctx.shadowBlur = 8; ctx.fillStyle = '#ff5b24'; ctx.fill(acc); ctx.shadowBlur = 0;
    // equator ring
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cyy, R * 1.35, R * 1.35 * Math.abs(Math.sin(pitch)) + 2, 0, 0, 6.2832); ctx.stroke();
  }

  /* --- fps chart --- */
  const F = fit($('#b-fps')), hist = [], fpsN = $('#b-fpsn');
  let ema = 60, lastF = performance.now(), numT = 0;
  function chart(t){
    const dt = t - lastF; lastF = t;
    if(dt > 0 && dt < 250) ema += (1000 / dt - ema) * .08;
    hist.push(ema); if(hist.length > 90) hist.shift();
    if(t - numT > 300){ numT = t; fpsN.textContent = Math.round(ema); }
    const {ctx, W, H} = F; ctx.clearRect(0, 0, W, H);
    const top = H * .42, bot = H * .78, y = v => bot - Math.min(1, v / 130) * (bot - top);
    ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    [30, 60, 120].forEach(v => { ctx.beginPath(); ctx.moveTo(22, y(v)); ctx.lineTo(W - 22, y(v)); ctx.stroke(); });
    ctx.setLineDash([]);
    if(hist.length < 2) return;
    const step = (W - 44) / 89, x0 = W - 22 - (hist.length - 1) * step;
    ctx.beginPath(); hist.forEach((v, i) => i ? ctx.lineTo(x0 + i * step, y(v)) : ctx.moveTo(x0, y(v)));
    const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.lineTo(W - 22, bot); ctx.lineTo(x0, bot); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    const lx = W - 22, ly = y(hist[hist.length - 1]);
    ctx.fillStyle = '#ff5b24'; ctx.shadowColor = '#ff5b24'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
  }

  /* --- terminal --- */
  const term = $('#term');
  const script = [
    ['c', './build.sh'],
    ['o', '  <span>→</span> 4 stylesheets  3 templates'],
    ['o', '  <span>→</span> 12 scripts  31 shaders'],
    ['o', '  <span>→</span> inlining 27 recordings…'],
    ['o', '<span class="o">✓ index.html</span>  ·  1 file  ·  0 deps'],
    ['c', 'open index.html'],
  ];
  let ti = 0, ci = 0, done = [], tWait = 0;
  function termTick(){
    if(!vis){ setTimeout(termTick, 400); return; }
    if(ti >= script.length){ if(++tWait > 12){ ti = 0; ci = 0; done = []; tWait = 0; } render(''); setTimeout(termTick, 300); return; }
    const [k, s] = script[ti];
    if(k === 'o'){ done.push(s); ti++; render(''); setTimeout(termTick, 180); return; }
    if(ci < s.length){ ci++; APP.sfx('key', {vol:.55}); render('<span class="p">$</span> <span class="o">' + s.slice(0, ci) + '</span>'); setTimeout(termTick, 45 + Math.random() * 50); return; }
    done.push('<span class="p">$</span> <span class="o">' + s + '</span>'); ti++; ci = 0; render(''); setTimeout(termTick, 380);
  }
  function render(cur){
    const lines = done.slice(-5);
    term.innerHTML = lines.join('\n') + (lines.length ? '\n' : '') + (cur || (ti >= script.length ? '<span class="p">$</span> ' : '')) + '<span class="caret"></span>';
  }
  termTick();

  /* --- dither field --- */
  const D = fit($('#b-grid')), BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const dm = {x:-1e4, y:-1e4, tx:-1e4, ty:-1e4};
  D.cv.parentNode.addEventListener('pointermove', e => { const r = D.cv.getBoundingClientRect(); dm.tx = e.clientX - r.left; dm.ty = e.clientY - r.top; if(dm.x < -1e3){ dm.x = dm.tx; dm.y = dm.ty; } });
  D.cv.parentNode.addEventListener('pointerleave', () => { dm.tx = dm.ty = -1e4; });
  function dither(t){
    const {ctx, W, H} = D; ctx.clearRect(0, 0, W, H);
    if(dm.tx > -1e3){ dm.x += (dm.tx - dm.x) * .15; dm.y += (dm.ty - dm.y) * .15; } else { dm.x = dm.y = -1e4; }
    const cs = 7, T = t * .001, white = new Path2D(), hot = new Path2D();
    for(let j = 0, y = 2; y < H; j++, y += cs){
      for(let i = 0, x = 2; x < W; i++, x += cs){
        let v = .2 + .2 * Math.sin(x * .011 + T * .9 + Math.sin(y * .035 + T * .6) * 1.8) * Math.cos(y * .02 - T * .4);
        v *= Math.min(1, x / (W * .5));
        const dx = x - dm.x, dy = y - dm.y, d2 = dx * dx + dy * dy;
        const c = Math.exp(-d2 / 9000);
        v += c * .95 + .25 * Math.max(0, Math.sin(Math.sqrt(d2) * .06 - T * 6)) * Math.exp(-d2 / 60000);
        if(v > BAY[(j & 3) * 4 + (i & 3)]) (c > .55 ? hot : white).rect(x, y, cs - 2, cs - 2);
      }
    }
    ctx.fillStyle = 'rgba(236,236,240,.28)'; ctx.fill(white);
    ctx.fillStyle = '#ff5b24'; ctx.fill(hot);
  }

  (function loop(t){
    requestAnimationFrame(loop);
    chart(t);
    if(!vis) return;
    sphere(t); dither(t);
  })(performance.now());

  /* --- nav active state --- */
  const links = $$('.pill a');
  const nio = new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), {rootMargin:'-45% 0px -50% 0px'});
  links.forEach(a => { const el = document.querySelector(a.getAttribute('href')); if(el) nio.observe(el); });
})();
