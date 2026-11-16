/* ===== particle text morph — CPU spring simulation, GPU point rendering with additive trails ===== */
(function(){
  const cv = document.getElementById('pt');
  const gl = cv.getContext('webgl', {antialias:false, alpha:false, preserveDrawingBuffer:true});
  const words = ['lowk', 'cooking', 'hot', 'served', 'fr'];
  const dotsEl = document.getElementById('pt-dots'), countEl = document.getElementById('pt-count');
  words.forEach(() => dotsEl.appendChild(document.createElement('i')));
  if(!gl){ countEl.textContent = 'WebGL unavailable'; return; }

  const mk = (vs, fs) => { const pr = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([t, s]) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); gl.attachShader(pr, o); });
    gl.linkProgram(pr); return pr; };
  const pp = mk(`attribute vec4 a;uniform vec2 uRes;uniform float uDpr;varying float vS,vK;
void main(){vec2 c=a.xy/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);vS=a.z;vK=a.w;gl_PointSize=(1.5+min(a.z*.16,3.2)+a.w*.7)*uDpr;}`,
    `precision mediump float;varying float vS,vK;
void main(){float m=smoothstep(.5,.08,length(gl_PointCoord-.5));
  vec3 c=mix(vec3(.93,.93,.97)*(.3+vK*.55),vec3(1.,.36,.14)*1.5,smoothstep(2.5,8.,vS));
  c=mix(c,vec3(1.,.85,.7)*1.6,smoothstep(9.,20.,vS));
  gl_FragColor=vec4(c*m,1.);}`);
  const fp = mk('attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}', 'precision mediump float;uniform float uA;void main(){gl_FragColor=vec4(0.,0.,0.,uA);}');
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const pbuf = gl.createBuffer();
  const aP = gl.getAttribLocation(pp, 'a'), aQ = gl.getAttribLocation(fp, 'p');
  const uRes = gl.getUniformLocation(pp, 'uRes'), uDpr = gl.getUniformLocation(pp, 'uDpr'), uA = gl.getUniformLocation(fp, 'uA');
  gl.enable(gl.BLEND);

  let W = 0, H = 0, dpr = 1, N = 0, wi = 0, visible = false, lastAct = 0, cache = {};
  let X, Y, VX, VY, TX, TY, K, D;   // typed-array state + interleaved draw buffer
  const m = {x:-1e4, y:-1e4, vx:0, vy:0};

  function sample(word){
    if(cache[word]) return cache[word];
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    const o = oc.getContext('2d', {willReadFrequently:true});
    let fs = Math.min(H * .4, W * 1.6 / word.length);
    const setF = () => { o.font = `700 ${fs}px Geist, system-ui, sans-serif`; if('letterSpacing' in o) o.letterSpacing = (-fs * .06) + 'px'; };
    setF(); while(o.measureText(word).width > W * .88){ fs *= .93; setF(); }
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    o.fillText(word, W / 2, H * .47);
    const d = o.getImageData(0, 0, W, H).data, pts = [], g = 2;
    for(let y = 0; y < H; y += g) for(let x = 0; x < W; x += g) if(d[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
    for(let i = pts.length / 2 - 1; i > 0; i--){
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i*2], pts[j*2]] = [pts[j*2], pts[i*2]]; [pts[i*2+1], pts[j*2+1]] = [pts[j*2+1], pts[i*2+1]];
    }
    return cache[word] = pts;
  }
  function setWord(i){
    wi = (i + words.length) % words.length;
    const pts = sample(words[wi]), L = pts.length / 2 || 1;
    for(let k = 0; k < N; k++){
      const j = k % L, jit = k >= L ? 3 : .6;
      TX[k] = pts[j*2] + (Math.random() - .5) * jit; TY[k] = pts[j*2+1] + (Math.random() - .5) * jit;
    }
    [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === wi));
  }
  function build(){
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect(); W = Math.floor(r.width); H = Math.floor(r.height);
    if(W < 2 || H < 2) return;
    cv.width = W * dpr; cv.height = H * dpr; gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    N = Math.min(36000, Math.floor(W * H / 30)); cache = {};
    X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N);
    TX = new Float32Array(N); TY = new Float32Array(N); K = new Float32Array(N); D = new Float32Array(N * 4);
    for(let i = 0; i < N; i++){ X[i] = Math.random() * W; Y[i] = Math.random() * H; K[i] = .55 + Math.random() * .9; }
    setWord(wi);
    countEl.textContent = N.toLocaleString() + ' particles';
  }
  function blast(x, y, power){
    const R = Math.max(W, H) * .9;
    for(let i = 0; i < N; i++){
      const dx = X[i] - x, dy = Y[i] - y, d = Math.sqrt(dx*dx + dy*dy) + 1, f = power * Math.max(0, 1 - d / R);
      VX[i] += dx / d * f * (.6 + Math.random()) + (Math.random() - .5) * 4;
      VY[i] += dy / d * f * (.6 + Math.random()) + (Math.random() - .5) * 4;
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
    blast(x, y, 42); setWord(wi + 1); lastAct = performance.now();
    APP.sfx('boom', {pan:APP.pan(e.clientX)}); APP.sfx('whoosh', {vol:.6, delay:.05});
  });
  new IntersectionObserver(es => es.forEach(en => { visible = en.isIntersecting; if(visible) lastAct = performance.now(); }), {threshold:.15}).observe(cv);

  const R = 130, R2 = R * R;
  function frame(now){
    requestAnimationFrame(frame);
    if(!visible || !N) return;
    if(now - lastAct > 5200){ blast(W/2, H/2, 16); setWord(wi + 1); lastAct = now; APP.sfx('whoosh', {vol:.3}); }
    const t = now * .001; m.vx *= .85; m.vy *= .85;
    for(let i = 0; i < N; i++){
      const k = K[i];
      let ax = (TX[i] + Math.sin(t * 2 + i) * .6 - X[i]) * .011 * k;
      let ay = (TY[i] + Math.cos(t * 1.7 + i) * .6 - Y[i]) * .011 * k;
      const dx = X[i] - m.x, dy = Y[i] - m.y, d2 = dx*dx + dy*dy;
      if(d2 < R2){
        const d = Math.sqrt(d2) || 1, f = 1 - d / R, nx = dx / d, ny = dy / d;
        ax += (nx * 3.6 - ny * 1.8) * f + m.vx * f * .09;
        ay += (ny * 3.6 + nx * 1.8) * f + m.vy * f * .09;
      }
      const vx = VX[i] = (VX[i] + ax) * .875, vy = VY[i] = (VY[i] + ay) * .875;
      const j = i * 4;
      D[j] = X[i] += vx; D[j+1] = Y[i] += vy; D[j+2] = Math.sqrt(vx*vx + vy*vy); D[j+3] = k - .55;
    }
    // fade the previous frame, then add this one
    gl.useProgram(fp); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(aQ); gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uA, .3); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(pp); gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf); gl.bufferData(gl.ARRAY_BUFFER, D, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 4, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uRes, W, H); gl.uniform1f(uDpr, dpr);
    gl.drawArrays(gl.POINTS, 0, N);
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
