/* ===== point-cloud globe with live arcs + rolling odometers ===== */
(function(){
  const cv = document.getElementById('globe'), ctx = cv.getContext('2d'), wrap = cv.parentNode;
  let W = 0, H = 0, vis = false;
  function rs(){ const d = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  new ResizeObserver(rs).observe(cv); rs();
  new IntersectionObserver(es => es.forEach(e => vis = e.isIntersecting)).observe(cv);

  const land = (x, y, z) => Math.sin(3 * x + 1.3) * Math.sin(2.7 * y + .4) * Math.sin(3.3 * z + 2.1)
    + .55 * Math.sin(6.1 * x + 2.2 * y + .7) * Math.sin(5.3 * z - 1.9 * y + 1.1) + .25 * Math.sin(11 * x + 9 * z);
  const N = 5200, pts = [], lands = [], ga = Math.PI * (3 - Math.sqrt(5));
  for(let i = 0; i < N; i++){
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i, x = Math.cos(th) * r, z = Math.sin(th) * r;
    const L = land(x, y, z) > .18 && Math.abs(y) < .93;
    pts.push([x, y, z, L]); if(L) lands.push([x, y, z]);
  }
  let yaw = 0, vy = .0025, tilt = .38, drag = null;
  wrap.addEventListener('pointerdown', e => { drag = e.clientX; wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointermove', e => { if(drag !== null){ vy = (e.clientX - drag) * .004; drag = e.clientX; } });
  wrap.addEventListener('pointerup', () => drag = null);

  const arcs = []; let spawnT = 0;
  const stars = Array.from({length:140}, () => [Math.random(), Math.random(), .2 + Math.random() * .6, .5 + Math.random() * 2]);
  function spawn(){
    const a = lands[(Math.random() * lands.length) | 0], b = lands[(Math.random() * lands.length) | 0];
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; if(dot > .9 || dot < -.6) return;
    arcs.push({a, b, om:Math.acos(dot), t:0, sp:.006 + Math.random() * .006});
  }
  function slerp(a, b, om, t){
    const s = Math.sin(om), k0 = Math.sin((1 - t) * om) / s, k1 = Math.sin(t * om) / s, lift = 1 + Math.sin(Math.PI * t) * om * .32;
    return [(a[0] * k0 + b[0] * k1) * lift, (a[1] * k0 + b[1] * k1) * lift, (a[2] * k0 + b[2] * k1) * lift];
  }
  let cy, sy, ct, st, R, cx, cyy;
  const proj = p => { const x1 = p[0] * cy - p[2] * sy, z1 = p[0] * sy + p[2] * cy, y1 = p[1] * ct - z1 * st, z2 = p[1] * st + z1 * ct;
    return [cx + x1 * R, cyy - y1 * R, z2]; };

  (function loop(now){
    requestAnimationFrame(loop);
    if(!vis || !W) return;
    if(drag === null) vy += (.0025 - vy) * .03;
    yaw += vy; cy = Math.cos(yaw); sy = Math.sin(yaw); ct = Math.cos(tilt); st = Math.sin(tilt);
    R = Math.min(W, H) * .4; cx = W / 2; cyy = H / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for(const s of stars){ ctx.globalAlpha = (.35 + .65 * Math.abs(Math.sin(now * .001 * s[3] + s[2] * 9))) * s[2]; ctx.fillRect(s[0] * W, s[1] * H, 1.2, 1.2); }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(cx, cyy, R * .9, cx, cyy, R * 1.35);
    g.addColorStop(0, 'rgba(255,91,36,.16)'); g.addColorStop(.35, 'rgba(255,91,36,.05)'); g.addColorStop(1, 'rgba(255,91,36,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cyy, R * 1.35, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#09090b'; ctx.beginPath(); ctx.arc(cx, cyy, R, 0, 6.2832); ctx.fill();
    const g2 = ctx.createRadialGradient(cx - R * .35, cyy - R * .4, R * .1, cx, cyy, R);
    g2.addColorStop(0, 'rgba(255,255,255,.07)'); g2.addColorStop(1, 'rgba(255,255,255,.01)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx, cyy, R, 0, 6.2832); ctx.fill();
    const g3 = ctx.createRadialGradient(cx, cyy, R * .86, cx, cyy, R * 1.02);
    g3.addColorStop(0, 'rgba(255,120,60,0)'); g3.addColorStop(.8, 'rgba(255,120,60,.12)'); g3.addColorStop(1, 'rgba(255,170,120,.5)');
    ctx.strokeStyle = g3; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cyy, R, 0, 6.2832); ctx.stroke();
    const lp = new Path2D(), lb = new Path2D(), op = new Path2D();
    for(const p of pts){
      const [x, y, z] = proj(p); if(z < 0) continue;
      if(p[3]) (z > .35 ? lb : lp).rect(x - .9, y - .9, 1.8, 1.8); else op.rect(x - .5, y - .5, 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(op);
    ctx.fillStyle = 'rgba(236,236,240,.45)'; ctx.fill(lp);
    ctx.fillStyle = 'rgba(245,245,248,.9)'; ctx.fill(lb);
    if(now - spawnT > 260 && arcs.length < 18){ spawnT = now; spawn(); }
    ctx.lineCap = 'round';
    for(let i = arcs.length - 1; i >= 0; i--){
      const A = arcs[i]; A.t += A.sp;
      if(A.t >= 1 && !A.hit){ A.hit = true; if(Math.random() < .3) APP.sfx('drop', {vol:.22, rate:1.4}); }
      const head = Math.min(1, A.t), tail = Math.max(0, A.t - .45);
      if(tail >= 1){ arcs.splice(i, 1); continue; }
      let prev = null;
      for(let s = 0; s <= 24; s++){
        const tt = tail + (head - tail) * s / 24, q = proj(slerp(A.a, A.b, A.om, tt));
        if(prev){ const k = s / 24; ctx.strokeStyle = q[2] < 0 ? `rgba(255,91,36,${k * .15})` : `rgba(255,${120 + k * 100 | 0},${60 + k * 120 | 0},${k * .95})`;
          ctx.lineWidth = .6 + k * 1.6; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
        prev = q;
      }
      if(A.t < 1){ const q = proj(slerp(A.a, A.b, A.om, head)); if(q[2] > -.1){ ctx.fillStyle = '#fff'; ctx.shadowColor = '#ff5b24'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0; } }
      const e = proj(A.b); if(A.t > 1 && e[2] > 0){ const k = (A.t - 1) / .45; ctx.strokeStyle = `rgba(255,91,36,${1 - k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e[0], e[1], 2 + k * 16, 0, 6.2832); ctx.stroke(); }
    }
  })(performance.now());

  /* --- odometers --- */
  const odos = [...document.querySelectorAll('.odo')];
  odos.forEach(o => {
    const v = String(o.dataset.v);
    o.innerHTML = [...v].map(() => '<span class="col">' + Array.from({length:20}, (_, i) => '<span>' + (i % 10) + '</span>').join('') + '</span>').join('')
      + (o.dataset.sx ? '<span class="sx">' + o.dataset.sx + '</span>' : '');
  });
  new IntersectionObserver((es, ob) => es.forEach(e => {
    if(!e.isIntersecting) return; ob.disconnect();
    odos.forEach((o, oi) => [...o.querySelectorAll('.col')].forEach((c, i) => {
      const d = +String(o.dataset.v)[i];
      c.style.transitionDelay = (oi * .15 + i * .1) + 's';
      c.style.transform = `translateY(-${10 + d}em)`;
    }));
    APP.sfx('whoosh'); for(let i = 0; i < 14; i++) APP.sfx('tick', {delay:.1 + i * .13, vol:1.4, rate:.8 + i * .02});
  }), {threshold:.4}).observe(document.getElementById('odos'));
})();
