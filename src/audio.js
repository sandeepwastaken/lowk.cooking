/* ===== audio engine — real recordings (CC0, freesound.org) inlined as base64 by build.sh ===== */
(function(){
  const SRC = window.SND || {};
  const LOOPS = ['fire', 'sizzle', 'boil', 'wind', 'coldwind', 'drone', 'rain', 'neon', 'stir'];
  const LG = {fire:.95, sizzle:.5, boil:.7, wind:.5, coldwind:.85, drone:.5, rain:.8, neon:.45, stir:.6};
  // one-shots: gain, random pitch spread, reverb send, minimum gap between plays (ms)
  const DEF = {
    tick:{g:.14, v:.18, gap:45}, click:{g:.5, v:.06}, key:{g:.3, v:.2, gap:30}, whoosh:{g:.45, v:.1, gap:60},
    boom:{g:.85, v:.08, rv:.35, gap:90}, sub:{g:.8, rv:.2}, riser:{g:.55}, ignite:{g:.9, rv:.15}, bell:{g:.5, rv:.45, v:.02},
    chop:{g:.75, v:.1, gap:40}, sharpen:{g:.6, v:.08}, pop:{g:.4, v:.3, gap:25}, drop:{g:.5, v:.25, rv:.4, gap:40},
    splash:{g:.7, v:.1, rv:.3}, thunder:{g:1, rv:.3, v:.12}, ice:{g:.7, v:.15, rv:.3}, chime:{g:.4, v:.05, rv:.5}, zap:{g:.3, v:.25, gap:40}
  };
  const A = APP.audio = {on:false, ready:false, vol:{}, rate:{}, boost:{}, names:Object.keys(DEF), loopNames:LOOPS, level:0, bass:0, fd:null};
  LOOPS.forEach(n => { A.vol[n] = 0; A.rate[n] = 1; A.boost[n] = 0; });
  APP.pan = x => (x / innerWidth * 2 - 1) * .7;
  let AC, bus, master, verb, an, fd, loading = null;
  const bufs = {}, loops = {}, last = {};

  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  const decode = ab => new Promise((res, rej) => { const p = AC.decodeAudioData(ab, res, rej); if(p && p.catch) p.catch(rej); });

  /* bake a click-free loop: trim codec padding, then crossfade the tail into the head */
  function seamless(b){
    const sr = b.sampleRate, xf = Math.floor(sr * .6), c0 = b.getChannelData(0);
    let s = 0, e = b.length;
    while(s < e && Math.abs(c0[s]) < .0015) s++;
    while(e > s && Math.abs(c0[e - 1]) < .0015) e--;
    const n = e - s - xf; if(n < sr) return b;
    const out = AC.createBuffer(b.numberOfChannels, n, sr);
    for(let c = 0; c < b.numberOfChannels; c++){
      const i = b.getChannelData(c), o = out.getChannelData(c);
      o.set(i.subarray(s, s + n));
      for(let k = 0; k < xf; k++){ const t = k / xf * 1.5708; o[k] = i[s + k] * Math.sin(t) + i[s + n + k] * Math.cos(t); }
    }
    return out;
  }
  function impulse(sec){
    const n = AC.sampleRate * sec | 0, b = AC.createBuffer(2, n, AC.sampleRate);
    for(let c = 0; c < 2; c++){ const d = b.getChannelData(c); for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  function init(){
    AC = new (window.AudioContext || window.webkitAudioContext)();
    bus = AC.createGain(); master = AC.createGain(); master.gain.value = 0;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .25;
    an = AC.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .8; fd = new Uint8Array(an.frequencyBinCount);
    verb = AC.createConvolver(); verb.buffer = impulse(2.8);
    const vg = AC.createGain(); vg.gain.value = .55;
    verb.connect(vg); vg.connect(bus); bus.connect(comp); comp.connect(master); master.connect(an); an.connect(AC.destination);
    A.ctx = AC;
    loading = Promise.all(Object.keys(SRC).map(k => decode(bytes(SRC[k]))
      .then(b => { bufs[k] = LOOPS.includes(k) ? seamless(b) : b; })
      .catch(e => console.warn('audio: could not decode', k, e)))).then(() => { A.ready = true; });
  }

  A.play = function(name, o){
    if(!A.on || !bufs[name]) return;
    const d = DEF[name] || {g:.5}, now = performance.now(); o = o || {};
    if(d.gap && !o.delay && now - (last[name] || 0) < d.gap) return;
    last[name] = now;
    const t = AC.currentTime + (o.delay || 0), s = AC.createBufferSource(), g = AC.createGain();
    s.buffer = bufs[name];
    s.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * (d.v || 0));
    g.gain.value = d.g * (o.vol == null ? 1 : o.vol);
    let out = g;
    if(o.pan != null && AC.createStereoPanner){ const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); out = p; }
    s.connect(g); out.connect(bus);
    const rv = o.rv == null ? d.rv : o.rv;
    if(rv){ const r = AC.createGain(); r.gain.value = rv; out.connect(r); r.connect(verb); }
    s.start(t);
  };
  APP.sfx = A.play;

  /* master on/off — must be called from a user gesture the first time. Resolves once samples are decoded. */
  A.set = function(on){
    if(on && !AC) init();
    A.on = !!on;
    document.body.classList.toggle('snd-on', A.on);
    const b = document.getElementById('snd');
    if(b){ b.classList.toggle('on', A.on); document.getElementById('snd-t').textContent = A.on ? 'Sound on' : 'Sound off'; }
    if(!AC) return Promise.resolve();
    if(A.on) AC.resume();
    master.gain.cancelScheduledValues(AC.currentTime);
    master.gain.setTargetAtTime(A.on ? .9 : 0, AC.currentTime, A.on ? .35 : .1);
    return loading;
  };
  document.addEventListener('visibilitychange', () => { if(AC && A.on) document.hidden ? AC.suspend() : AC.resume(); });

  /* loops follow A.vol / A.rate / A.boost; sources start on demand and stop after ~3s of silence */
  (function tick(){
    requestAnimationFrame(tick);
    if(!AC || !A.ready) return;
    const t = AC.currentTime;
    for(const n of LOOPS){
      const v = A.on ? Math.min(1, Math.max(A.vol[n] || 0, A.boost[n] || 0)) * LG[n] : 0;
      if(v > .004 && !loops[n] && bufs[n]){
        const s = AC.createBufferSource(), g = AC.createGain();
        s.buffer = bufs[n]; s.loop = true; g.gain.value = 0;
        s.connect(g); g.connect(bus); s.start(t, Math.random() * bufs[n].duration);
        loops[n] = {s, g, idle:0};
      }
      const l = loops[n]; if(!l) continue;
      l.g.gain.setTargetAtTime(v, t, .2);
      l.s.playbackRate.setTargetAtTime(A.rate[n] || 1, t, .25);
      if(v < .004){ if(++l.idle > 200){ try{ l.s.stop(); }catch(e){} l.g.disconnect(); delete loops[n]; } } else l.idle = 0;
    }
    if(!A.on) return;
    an.getByteFrequencyData(fd);
    let b = 0, all = 0;
    for(let i = 0; i < 10; i++) b += fd[i];
    for(let i = 0; i < 160; i++) all += fd[i];
    A.bass += (b / 2550 - A.bass) * .25; A.level += (all / 40800 - A.level) * .2; A.fd = fd;
  })();
})();
