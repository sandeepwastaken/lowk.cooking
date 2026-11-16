/* ===== smooth scroll + scroll choreography for pinned sections ===== */
(function(){
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const maxS = () => document.documentElement.scrollHeight - innerHeight;

  /* --- inertial wheel scrolling (keeps native sticky/anchors working) --- */
  let target = scrollY, cur = scrollY, active = false;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(fine) addEventListener('wheel', e => {
    if(e.ctrlKey || document.body.classList.contains('loading')) return;
    e.preventDefault();
    target = clamp(target + (e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY), 0, maxS()); active = true;
  }, {passive:false});
  addEventListener('scroll', () => { if(!active){ target = cur = scrollY; } }, {passive:true});
  APP.scrollTo = y => { if(!fine){ scrollTo({top:y, behavior:'smooth'}); return; } cur = scrollY; target = clamp(y, 0, maxS()); active = true; };

  /* --- word-by-word heading reveals --- */
  $$('[data-reveal]').forEach(el => {
    let i = 0;
    (function wrap(node){
      [...node.childNodes].forEach(n => {
        if(n.nodeType !== 3){ wrap(n); return; }
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if(!w) return;
          if(/^\s+$/.test(w)){ frag.appendChild(document.createTextNode(w)); return; }
          const o = document.createElement('span'), s = document.createElement('span');
          o.className = 'wd'; s.textContent = w; s.style.transitionDelay = (i++ * .045) + 's';
          o.appendChild(s); frag.appendChild(o);
        });
        node.replaceChild(frag, n);
      });
    })(el);
  });
  const rio = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); rio.unobserve(e.target); } }), {threshold:.25});
  $$('[data-reveal]').forEach(el => rio.observe(el));

  /* --- elements --- */
  const heat = $('#heat'), temp = $('#temp'), hMode = $('#h-mode'), hFlux = $('#h-flux'), hEmb = $('#h-emb'), hBar = $('#h-bar');
  const says = $$('#heat-say span');
  const kin = $('#kinetic'), krows = $$('.k-row');
  const menu = $('#menu'), track = $('#track'), mProg = $('#menu-prog'), mCount = $('#menu-count');
  const cards = $$('.scard');
  const tun = $('#tunnel'), tWords = $$('.tun-words h2'), tVel = $('#t-vel'), tDepth = $('#t-depth'), tStage = $('#t-stage');
  const mask = $('#served'), maskH = $('#mask-h'), maskL = $('#mz-l'), maskOver = $('#mask-over'), maskAfter = $('#mask-after');
  const modes = ['Idle', 'Warming', 'Searing', 'Molten'];
  let heatS = 0, trackX = 0, origin = null, hModeI = 0, mIdx = 0, tStageI = 0, served = false;
  const nDish = $$('.dish').length;
  heat.querySelector('.stick').addEventListener('click', e => { APP.flare = 1; APP.sfx('ignite', {pan:APP.pan(e.clientX), rate:1.1}); });

  function maskOrigin(){
    const prev = maskH.style.transform; maskH.style.transform = 'none';
    const h = maskH.getBoundingClientRect(), l = maskL.getBoundingClientRect();
    origin = [l.left - h.left + l.width * .5, l.top - h.top + l.height * .58];
    maskH.style.transformOrigin = origin[0] + 'px ' + origin[1] + 'px';
    maskH.style.transform = prev;
  }
  addEventListener('resize', () => origin = null);

  (function loop(){
    requestAnimationFrame(loop);
    if(active){
      cur = lerp(cur, target, .095);
      if(Math.abs(target - cur) < .4){ cur = target; active = false; }
      scrollTo(0, cur);
    }
    const H = innerHeight;

    // heat
    const hp = APP.prog(heat), hr = heat.getBoundingClientRect();
    if(hr.bottom > 0 && hr.top < H){
      heatS = lerp(heatS, hp, .08); APP.heatLvl = heatS;
      temp.textContent = Math.round(heatS * 1600);
      const hm = Math.min(3, Math.floor(heatS * 4));
      if(hm !== hModeI){ if(hm > hModeI) APP.sfx('ignite', {vol:.5 + hm * .15, rate:.85 + hm * .1}); hModeI = hm; }
      hMode.textContent = modes[hm];
      APP.flare = (APP.flare || 0) * .95;
      hFlux.textContent = (heatS * 9.81).toFixed(2);
      hEmb.textContent = Math.round(heatS * heatS * 4200).toLocaleString();
      hBar.style.width = (heatS * 100) + '%';
      const si = Math.min(3, Math.floor(hp * 4.2));
      says.forEach((s, i) => { s.classList.toggle('on', i === si); s.classList.toggle('past', i < si); });
    }

    // kinetic rows
    const kr = kin.getBoundingClientRect();
    if(kr.bottom > 0 && kr.top < H){
      const p = clamp((H - kr.top) / (H + kr.height), 0, 1);
      krows.forEach(r => {
        const base = -(r.scrollWidth - innerWidth) / 2, d = +r.dataset.dir;
        r.style.transform = `translate3d(${base + d * (p - .5) * innerWidth * 1.1}px,0,0)`;
      });
    }

    // menu horizontal track
    const mp = APP.prog(menu), mr = menu.getBoundingClientRect();
    if(mr.bottom > 0 && mr.top < H){
      const maxX = track.scrollWidth - innerWidth;
      trackX = lerp(trackX, -mp * maxX, .12);
      track.style.transform = `translate3d(${trackX}px,0,0)`;
      mProg.style.width = (mp * 100) + '%';
      const mi = Math.min(nDish - 1, Math.round(mp * (nDish - 1)));
      if(mi !== mIdx){ mIdx = mi; APP.sfx('bell', {vol:.35, rate:.9 + mi * .03}); }
      mCount.textContent = String(mi + 1).padStart(2, '0') + ' / ' + String(nDish).padStart(2, '0');
    }

    // stacked cards
    cards.forEach((c, i) => {
      const nx = cards[i + 1]; if(!nx) return;
      const top = parseFloat(getComputedStyle(nx).top) || 0, k = clamp(1 - (nx.getBoundingClientRect().top - top) / (H * .8), 0, 1);
      c.style.transform = `scale(${1 - k * .07})`;
      c.style.filter = `brightness(${1 - k * .55})`;
    });

    // tunnel
    const tp = APP.prog(tun), tr = tun.getBoundingClientRect();
    if(tr.bottom > 0 && tr.top < H){
      tWords.forEach((w, i) => {
        const l = (tp - (.15 + i * .23)) / .12;
        const o = clamp(1 - Math.abs(l), 0, 1);
        w.style.opacity = o; w.style.transform = `scale(${.55 + (clamp(l, -1, 1.4) + 1) * .7})`;
        w.style.filter = `blur(${Math.max(0, l) * 10}px)`;
      });
      tVel.textContent = (.08 + tp * .91 + Math.min(.05, Math.abs(APP.vel || 0) / 600)).toFixed(2);
      tDepth.textContent = String(Math.round(tp * 9999)).padStart(4, '0');
      const ts = Math.min(4, Math.floor(tp * 4.3));
      if(ts !== tStageI){ if(ts > tStageI){ APP.sfx('whoosh', {rate:.7 + ts * .12}); APP.sfx('sub', {vol:.3 + ts * .1}); } tStageI = ts; }
      tStage.textContent = 'Stage ' + ts + ' / 4';
    }

    // mask zoom
    const kp = APP.prog(mask), kr2 = mask.getBoundingClientRect();
    if(kr2.bottom > 0 && kr2.top < H){
      if(!origin) maskOrigin();
      const z = clamp((kp - .08) / .62, 0, 1);
      maskH.style.transform = `scale(${Math.pow(110, z * z)})`;
      maskOver.style.opacity = 1 - clamp((kp - .66) / .08, 0, 1);
      maskAfter.classList.toggle('on', kp > .72);
      if((kp > .72) !== served){ served = kp > .72; if(served){ APP.sfx('bell'); APP.sfx('chime', {delay:.15, vol:.6}); } }
    }
  })();
})();
