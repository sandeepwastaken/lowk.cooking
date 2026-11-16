/* ===== sauce: a real-time Navier–Stokes fluid (stable fluids — advection, vorticity confinement,
   Jacobi pressure solve) running entirely in fragment shaders. The cursor is the spoon. ===== */
(function(){
  const cv = document.getElementById('fluid'); if(!cv) return;
  const sec = cv.parentNode, nameEl = document.getElementById('sauce-nm');
  const gl = cv.getContext('webgl', {alpha:false, depth:false, stencil:false, antialias:false});
  const fail = () => { sec.classList.add('nofluid'); };
  if(!gl) return fail();
  const hf = gl.getExtension('OES_texture_half_float'), hfl = gl.getExtension('OES_texture_half_float_linear');
  gl.getExtension('EXT_color_buffer_half_float');
  if(!hf) return fail();
  const TYPE = hf.HALF_FLOAT_OES, FILT = hfl ? gl.LINEAR : gl.NEAREST;

  const VS = `attribute vec2 p;varying vec2 uv,L,R,T,B;uniform vec2 px;
void main(){uv=p*.5+.5;L=uv-vec2(px.x,0.);R=uv+vec2(px.x,0.);T=uv+vec2(0.,px.y);B=uv-vec2(0.,px.y);gl_Position=vec4(p,0.,1.);}`;
  const H = 'precision highp float;precision highp sampler2D;varying vec2 uv,L,R,T,B;';
  const prog = fs => { const pr = gl.createProgram();
    [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, H + fs]].forEach(([t, s]) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); gl.attachShader(pr, o); });
    gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    const u = {}, n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for(let i = 0; i < n; i++){ const nm = gl.getActiveUniform(pr, i).name; u[nm] = gl.getUniformLocation(pr, nm); }
    return {pr, u}; };
  const P = {
    splat: prog('uniform sampler2D uT;uniform float asp,radius;uniform vec3 color;uniform vec2 point;void main(){vec2 d=uv-point;d.x*=asp;gl_FragColor=vec4(texture2D(uT,uv).xyz+exp(-dot(d,d)/radius)*color,1.);}'),
    advect: prog('uniform sampler2D uV,uS;uniform vec2 tx;uniform float dt,diss;void main(){vec2 c=uv-dt*texture2D(uV,uv).xy*tx;gl_FragColor=vec4(texture2D(uS,c).xyz/(1.+diss*dt),1.);}'),
    div: prog('uniform sampler2D uV;void main(){float l=texture2D(uV,L).x,r=texture2D(uV,R).x,t=texture2D(uV,T).y,b=texture2D(uV,B).y;vec2 c=texture2D(uV,uv).xy;if(L.x<0.)l=-c.x;if(R.x>1.)r=-c.x;if(T.y>1.)t=-c.y;if(B.y<0.)b=-c.y;gl_FragColor=vec4(.5*(r-l+t-b),0.,0.,1.);}'),
    curl: prog('uniform sampler2D uV;void main(){gl_FragColor=vec4(.5*(texture2D(uV,R).y-texture2D(uV,L).y-texture2D(uV,T).x+texture2D(uV,B).x),0.,0.,1.);}'),
    vort: prog('uniform sampler2D uV,uC;uniform float curl,dt;void main(){float l=texture2D(uC,L).x,r=texture2D(uC,R).x,t=texture2D(uC,T).x,b=texture2D(uC,B).x,c=texture2D(uC,uv).x;vec2 f=.5*vec2(abs(t)-abs(b),abs(r)-abs(l));f/=length(f)+.0001;f*=curl*c;f.y*=-1.;vec2 v=texture2D(uV,uv).xy+f*dt;gl_FragColor=vec4(clamp(v,-1000.,1000.),0.,1.);}'),
    pres: prog('uniform sampler2D uP,uD;void main(){gl_FragColor=vec4((texture2D(uP,L).x+texture2D(uP,R).x+texture2D(uP,T).x+texture2D(uP,B).x-texture2D(uD,uv).x)*.25,0.,0.,1.);}'),
    grad: prog('uniform sampler2D uP,uV;void main(){vec2 v=texture2D(uV,uv).xy-vec2(texture2D(uP,R).x-texture2D(uP,L).x,texture2D(uP,T).x-texture2D(uP,B).x);gl_FragColor=vec4(v,0.,1.);}'),
    clear: prog('uniform sampler2D uT;uniform float k;void main(){gl_FragColor=k*texture2D(uT,uv);}'),
    show: prog(`uniform sampler2D uT;
float lum(vec2 c){vec3 d=texture2D(uT,c).rgb;return dot(d,vec3(.35,.45,.2));}
void main(){vec3 c=texture2D(uT,uv).rgb;
  vec3 n=normalize(vec3(lum(L)-lum(R),lum(B)-lum(T),.045));
  float df=clamp(dot(n,normalize(vec3(-.4,.5,.75))),0.,1.);
  float sp=pow(max(0.,dot(reflect(vec3(0.,0.,-1.),n),normalize(vec3(.3,.5,.8)))),28.);
  float a=clamp(max(c.r,max(c.g,c.b))*1.4,0.,1.);
  c=c*(.55+.75*df)+vec3(1.,.95,.9)*sp*.5*a;
  c=1.-exp(-c*1.25);
  vec2 q=uv-.5;c*=1.-.55*dot(q,q);
  gl_FragColor=vec4(c+vec3(.012,.011,.013),1.);}`)
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let unit = 0;
  function fbo(w, h, filt){
    const tex = gl.createTexture(), id = unit++;
    gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, TYPE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return {fb, id, w, h, ok};
  }
  const dbl = (w, h, f) => { const o = {r:fbo(w, h, f), w:fbo(w, h, f), swap(){ const t = o.r; o.r = o.w; o.w = t; }}; return o; };
  let vel, dye, dv, cu, pr, SW, SH, DW, DH, ready = false;
  function setup(){
    const r = cv.getBoundingClientRect(); if(r.width < 2) return;
    const asp = r.width / r.height;
    cv.width = Math.round(r.width * Math.min(devicePixelRatio || 1, 1.5)); cv.height = Math.round(r.height * Math.min(devicePixelRatio || 1, 1.5));
    SH = 144; SW = Math.round(SH * asp); DH = 560; DW = Math.round(DH * asp);
    unit = 0;
    vel = dbl(SW, SH, FILT); dye = dbl(DW, DH, FILT); dv = fbo(SW, SH, gl.NEAREST); cu = fbo(SW, SH, gl.NEAREST); pr = dbl(SW, SH, gl.NEAREST);
    ready = vel.r.ok && dye.r.ok;
    if(!ready) fail();
  }
  function run(p, target, set){
    gl.useProgram(p.pr);
    if(target){ gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); if(p.u.px) gl.uniform2f(p.u.px, 1 / target.w, 1 / target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); if(p.u.px) gl.uniform2f(p.u.px, 1 / DW, 1 / DH); }
    set && set(p.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function splat(x, y, dx, dy, col, rad){
    const asp = cv.width / cv.height;
    run(P.splat, vel.w, u => { gl.uniform1i(u.uT, vel.r.id); gl.uniform1f(u.asp, asp); gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, dx, dy, 0); gl.uniform1f(u.radius, rad); }); vel.swap();
    run(P.splat, dye.w, u => { gl.uniform1i(u.uT, dye.r.id); gl.uniform1f(u.asp, asp); gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, col[0], col[1], col[2]); gl.uniform1f(u.radius, rad); }); dye.swap();
  }
  function step(dt){
    run(P.curl, cu, u => gl.uniform1i(u.uV, vel.r.id));
    run(P.vort, vel.w, u => { gl.uniform1i(u.uV, vel.r.id); gl.uniform1i(u.uC, cu.id); gl.uniform1f(u.curl, 26); gl.uniform1f(u.dt, dt); }); vel.swap();
    run(P.div, dv, u => gl.uniform1i(u.uV, vel.r.id));
    run(P.clear, pr.w, u => { gl.uniform1i(u.uT, pr.r.id); gl.uniform1f(u.k, .8); }); pr.swap();
    for(let i = 0; i < 18; i++){ run(P.pres, pr.w, u => { gl.uniform1i(u.uP, pr.r.id); gl.uniform1i(u.uD, dv.id); }); pr.swap(); }
    run(P.grad, vel.w, u => { gl.uniform1i(u.uP, pr.r.id); gl.uniform1i(u.uV, vel.r.id); }); vel.swap();
    run(P.advect, vel.w, u => { gl.uniform1i(u.uV, vel.r.id); gl.uniform1i(u.uS, vel.r.id); gl.uniform2f(u.tx, 1 / SW, 1 / SH); gl.uniform1f(u.dt, dt); gl.uniform1f(u.diss, .25); }); vel.swap();
    run(P.advect, dye.w, u => { gl.uniform1i(u.uV, vel.r.id); gl.uniform1i(u.uS, dye.r.id); gl.uniform2f(u.tx, 1 / SW, 1 / SH); gl.uniform1f(u.dt, dt); gl.uniform1f(u.diss, .32); }); dye.swap();
  }

  /* the sauces */
  const SAUCES = [['Saffron', [1.1,.62,.06]], ['Paprika', [1.15,.2,.04]], ['Beurre blanc', [.95,.88,.7]], ['Squid ink', [.12,.2,.75]], ['Chili oil', [1.2,.3,.02]], ['Beetroot', [.9,.06,.4]], ['Pesto', [.25,.8,.2]]];
  let si = 0, col = SAUCES[0][1], lastSw = 0;
  const ptr = {x:.5, y:.5, on:false, moved:false, dx:0, dy:0};
  let stir = 0;
  sec.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    if(ptr.on){ ptr.dx += (x - ptr.x) * r.width; ptr.dy += (y - ptr.y) * r.height; ptr.moved = true; }
    ptr.x = x; ptr.y = y; ptr.on = true;
  });
  sec.addEventListener('pointerleave', () => { ptr.on = false; });
  sec.addEventListener('click', () => {
    if(!ready) return;
    next();
    for(let i = 0; i < 9; i++){ const a = i / 9 * 6.2832; splat(ptr.x, ptr.y, Math.cos(a) * 900, Math.sin(a) * 900, col.map(c => c * .5), .0012); }
    APP.sfx('splash', {pan:APP.pan(APP.px)}); APP.sfx('drop', {vol:.6});
  });
  function next(){ si = (si + 1) % SAUCES.length; col = SAUCES[si][1]; if(nameEl) nameEl.textContent = SAUCES[si][0]; lastSw = performance.now(); }

  let vis = false, last = performance.now(), seeded = false;
  new IntersectionObserver(es => es.forEach(e => vis = e.isIntersecting)).observe(cv);
  new ResizeObserver(() => setup()).observe(cv);
  (function loop(now){
    requestAnimationFrame(loop);
    const dt = Math.min(.033, (now - last) / 1000); last = now;
    stir *= .93;
    if(!vis || !ready){ APP.stir = 0; return; }
    if(!seeded){ seeded = true; lastSw = now;
      for(let i = 0; i < 8; i++){ const a = Math.random() * 6.2832; splat(.15 + Math.random() * .7, .2 + Math.random() * .6, Math.cos(a) * 700, Math.sin(a) * 700, SAUCES[i % SAUCES.length][1].map(c => c * .55), .003); } }
    if(now - lastSw > 6500) next();
    const t = now * .001;
    if(ptr.moved){
      const sp = Math.hypot(ptr.dx, ptr.dy);
      splat(ptr.x, ptr.y, ptr.dx * 9, ptr.dy * 9, col.map(c => c * Math.min(.5, .1 + sp * .012)), .0009);
      stir = Math.min(1, stir + sp * .006); ptr.dx = ptr.dy = 0; ptr.moved = false;
    }
    if(!ptr.on || stir < .05){   // an invisible spoon keeps things moving when nobody is stirring
      const x = .5 + .32 * Math.sin(t * .7) * Math.cos(t * .23), y = .5 + .28 * Math.sin(t * .9 + 1.3);
      const vx = Math.cos(t * .7) * 260, vy = Math.cos(t * .9 + 1.3) * 260;
      splat(x, y, vx, vy, col.map(c => c * .2), .0018);
      splat(1 - x, 1 - y, -vx, -vy, SAUCES[(si + 3) % SAUCES.length][1].map(c => c * .12), .0014);
    }
    APP.stir = stir;
    step(dt);
    run(P.show, null, u => gl.uniform1i(u.uT, dye.r.id));
  })(last);
})();
