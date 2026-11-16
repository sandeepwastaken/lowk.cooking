/* ===== core interactions: loader, cursor, scroll, hero, sound ===== */
(function(){
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  document.body.classList.add('loading');

  /* --- split hero letters --- */
  $$('[data-split]').forEach((el, li) => {
    const txt = el.textContent; el.textContent = '';
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span'); s.className = 'char'; s.textContent = ch;
      s.style.transitionDelay = (li * .12 + i * .06) + 's';
      el.appendChild(s);
    });
  });
  const chars = $$('.hero .char'), kchars = $$('.hero .line:first-child .char');

  /* --- loader, then a gate: the first click is what unlocks audio --- */
  const ld = $('#loader'), ldN = $('#ld-n'), ldBar = $('#ld-bar'), ldMsg = $('#ld-msg');
  const msgs = ['preheating…', 'sharpening knives…', 'searing shaders…', 'tuning the room…', 'plating…'];
  let entered = false; const lt0 = performance.now();
  (function load(now){
    const k = Math.min(1, (now - lt0) / 2200), e = 1 - Math.pow(1 - k, 3), lp = Math.round(e * 100);
    ldN.textContent = String(lp).padStart(3, '0');
    ldBar.style.width = lp + '%';
    ldMsg.textContent = msgs[Math.min(msgs.length - 1, Math.floor(k * msgs.length))];
    if(k < 1) requestAnimationFrame(load);
    else { ld.classList.add('done'); ldMsg.textContent = 'order up — choose how to enter'; }
  })(lt0);
  function enter(withSound){
    if(entered || !ld.classList.contains('done')) return; entered = true;
    if(withSound) APP.audio.set(true).then(() => { APP.sfx('ignite'); APP.sfx('sub', {vol:.6}); APP.sfx('bell', {delay:.9, vol:.7}); });
    ld.classList.add('out');
    document.body.classList.remove('loading');
    document.body.classList.add('ready');
    APP.ready = true; APP.pulse = 1; APP.click = {x:0, y:0, t:performance.now()};
    setTimeout(() => chars.forEach(c => c.style.transitionDelay = '0s'), 2200);
  }
  $('#enter-on').addEventListener('click', e => { e.stopPropagation(); enter(true); });
  $('#enter-off').addEventListener('click', e => { e.stopPropagation(); enter(false); });
  addEventListener('keydown', e => {
    if(e.key === 'Enter' && !entered) enter(true);
    else if((e.key === 'm' || e.key === 'M') && entered) APP.audio.set(!APP.audio.on);
  });

  /* --- sound toggle (real recordings; see audio.js) --- */
  $('#snd').addEventListener('click', e => {
    e.stopPropagation();
    const on = !APP.audio.on;
    APP.audio.set(on).then(() => { if(on) APP.sfx('click'); });
  });

  /* --- cursor --- */
  const cur = $('#cursor'), ring = $('.c-ring'), dot = $('.c-dot'), clabel = $('#c-label');
  let rx = APP.px, ry = APP.py;
  const mxEl = $('#mx'), myEl = $('#my');
  addEventListener('pointermove', e => {
    APP.px = e.clientX; APP.py = e.clientY; APP.lastMove = performance.now();
    APP.mx = (e.clientX - innerWidth / 2) / innerHeight;
    APP.my = -(e.clientY - innerHeight / 2) / innerHeight;
    dot.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
  }, {passive:true});
  addEventListener('pointerdown', () => cur.classList.add('down'));
  addEventListener('pointerup', () => cur.classList.remove('down'));
  document.addEventListener('pointerover', e => {
    const h = e.target.closest('[data-hover],a,button');
    if(h){ cur.classList.add('hover'); clabel.textContent = h.dataset.hover || 'OPEN'; APP.sfx('tick'); }
  });
  document.addEventListener('pointerout', e => {
    const h = e.target.closest('[data-hover],a,button');
    if(h && !h.contains(e.relatedTarget)) cur.classList.remove('hover');
  });

  /* --- hero click → shockwave the chrome --- */
  $('#hero').addEventListener('click', e => {
    APP.pulse = 1; APP.click = {x:(e.clientX - innerWidth / 2) / innerHeight, y:-(e.clientY - innerHeight / 2) / innerHeight, t:performance.now()};
    APP.sfx('boom', {pan:APP.pan(e.clientX)}); APP.sfx('whoosh', {vol:.5});
  });

  /* --- smooth anchor scroll --- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href')); if(!t) return;
    e.preventDefault(); APP.sfx('whoosh'); APP.sfx('click');
    const y = t.getBoundingClientRect().top + scrollY;
    APP.scrollTo ? APP.scrollTo(y) : window.scrollTo({top:y, behavior:'smooth'});
  }));

  /* --- clock --- */
  const clock = $('#clock');
  setInterval(() => { clock.textContent = new Date().toLocaleTimeString('en-GB'); }, 1000);

  /* --- main loop: cursor ring, scroll velocity, hero font weight --- */
  const prog = $('#prog'), fps = $('#fps');
  let lastY = scrollY, fpsT = 0;
  const title = $('#title');
  (function loop(now){
    requestAnimationFrame(loop);
    rx = lerp(rx, APP.px, .16); ry = lerp(ry, APP.py, .16);
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;

    const y = scrollY; APP.vel = lerp(APP.vel, y - lastY, .2); lastY = y; APP.scroll = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    prog.style.height = (max > 0 ? y / max * 100 : 0) + '%';

    if(now - fpsT > 250){ fpsT = now; fps.textContent = APP.fps; mxEl.textContent = APP.mx.toFixed(3); myEl.textContent = APP.my.toFixed(3); }

    // variable-font proximity on hero letters
    if(APP.ready && y < innerHeight){
      for(const c of kchars){
        const r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.hypot(APP.px - cx, APP.py - cy), k = Math.max(0, 1 - d / 420);
        const w = 600 - k * 460;
        c._w = lerp(c._w || 600, w, .14);
        c.style.fontVariationSettings = `'wght' ${c._w.toFixed(0)}`;
        c.style.fontWeight = c._w.toFixed(0);
      }
      title.style.transform = `translate3d(0,${y * .35}px,0)`;
      title.style.opacity = 1 - y / innerHeight * 1.2;
    }
  })(performance.now());
})();
