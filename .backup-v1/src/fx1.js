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

  /* --- loader --- */
  const ldN = $('#ld-n'), ldBar = $('#ld-bar'), ldMsg = $('#ld-msg');
  const msgs = ['preheating…', 'sharpening knives…', 'searing shaders…', 'plating…', 'served.'];
  let lp = 0; const lt0 = performance.now();
  (function load(now){
    const k = Math.min(1, (now - lt0) / 2000), e = 1 - Math.pow(1 - k, 3);
    lp = Math.round(e * 100);
    ldN.textContent = String(lp).padStart(3, '0');
    ldBar.style.width = lp + '%';
    ldMsg.textContent = msgs[Math.min(msgs.length - 1, Math.floor(k * msgs.length))];
    if(k < 1) requestAnimationFrame(load);
    else setTimeout(() => {
      $('#loader').classList.add('out');
      document.body.classList.remove('loading');
      document.body.classList.add('ready');
      APP.ready = true; APP.pulse = 1;
      setTimeout(() => chars.forEach(c => c.style.transitionDelay = '0s'), 2200);
    }, 250);
  })(lt0);

  /* --- sound (synthesized, off by default) --- */
  let AC = null, master = null, sndOn = false;
  function initAudio(){
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = .35; master.connect(AC.destination);
  }
  APP.sfx = function(kind){
    if(!sndOn || !AC) return;
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(master);
    if(kind === 'tick'){ o.type = 'sine'; o.frequency.setValueAtTime(1800 + Math.random() * 600, t); g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05); o.start(t); o.stop(t + .06); }
    else if(kind === 'click'){ o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(120, t + .12); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.0001, t + .15); o.start(t); o.stop(t + .16); }
    else if(kind === 'boom'){
      o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(32, t + .5);
      g.gain.setValueAtTime(.7, t); g.gain.exponentialRampToValueAtTime(.0001, t + .6); o.start(t); o.stop(t + .62);
      const nb = AC.createBuffer(1, AC.sampleRate * .3, AC.sampleRate), ch = nb.getChannelData(0);
      for(let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3);
      const ns = AC.createBufferSource(), ng = AC.createGain(), f = AC.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1400; ns.buffer = nb; ng.gain.value = .3;
      ns.connect(f); f.connect(ng); ng.connect(master); ns.start(t);
    }
    else if(kind === 'whoosh'){ o.type = 'sawtooth'; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 8; o.disconnect(); o.connect(f); f.connect(g);
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + .25); o.frequency.value = 80; g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3); o.start(t); o.stop(t + .32); }
  };
  $('#snd').addEventListener('click', e => {
    e.stopPropagation();
    if(!AC) initAudio();
    sndOn = !sndOn; if(sndOn) AC.resume();
    $('#snd').classList.toggle('on', sndOn);
    $('#snd-t').textContent = sndOn ? 'Sound on' : 'Sound off';
    APP.sfx('click');
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
  $('#hero').addEventListener('click', () => { APP.pulse = 1; APP.sfx('boom'); });

  /* --- smooth anchor scroll --- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href')); if(!t) return;
    e.preventDefault(); APP.sfx('whoosh');
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
