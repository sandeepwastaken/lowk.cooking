/* ===== one fixed WebGL canvas drawing many DOM-tracked shader "slots" ===== */
(function(){
  const cv = document.getElementById('multi');
  const gl = cv.getContext('webgl', {antialias:false, alpha:true, premultipliedAlpha:true});
  if(!gl) return;
  const FRAG = APP.GLSL_PRE + `
uniform vec4 uRect;uniform float uKind,uHover,uRad,uAlpha;uniform vec2 uM;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float hgt(vec2 q,float t){q+=.35*vec2(sin(q.y*2.1+t),cos(q.x*1.7-t*.8));q+=.25*vec2(sin(q.y*3.7-t*1.3),cos(q.x*3.1+t));
  return sin(q.x*2.)*cos(q.y*2.3)+.5*sin(q.x*4.1+q.y*3.3+t);}
vec3 gold(vec2 p,float t){
  vec2 q=p*2.4;float e=.004,h=hgt(q,t),hx=hgt(q+vec2(e,0.),t),hy=hgt(q+vec2(0.,e),t);
  vec3 n=normalize(vec3((h-hx)/e*.09,(h-hy)/e*.09,1.)),r=reflect(vec3(0.,0.,-1.),n);
  vec3 c=mix(vec3(.22,.1,.02),vec3(1.,.74,.32),.5+.5*r.y);
  c*=.55+.7*pow(max(0.,dot(n,normalize(vec3(.4,.6,1.)))),2.);
  c+=smoothstep(.8,.95,sin(r.x*6.+r.y*2.+t*.3))*vec3(1.,.9,.7)*.7;
  c+=pow(max(0.,dot(r,normalize(vec3(-.3,.6,.7)))),30.)*vec3(1.,.95,.85)*1.6;
  return c;}
vec3 plasma(vec2 p,float t){
  float r=length(p),a=atan(p.y,p.x);
  vec3 c=vec3(.025,0.,.05)+vec3(.45,.08,.55)*.05/(r+.08);
  for(int i=0;i<4;i++){float fi=float(i);
    float w=a*3.+fbm(vec2(r*3.2-t*1.3,fi*7.+a*.8))*4.5+t*(.25+fi*.08)+fi*1.7;
    float fil=.01/(abs(sin(w))+.01)*smoothstep(.6,.1,r)*smoothstep(.03,.1,r);
    c+=mix(vec3(.95,.25,.6),ACC,fi/3.)*fil*.5;}
  c+=vec3(1.,.85,.92)*.045/(r+.03);
  c+=vec3(.85,.3,.7)*smoothstep(.015,0.,abs(r-.62))*.7+vec3(.4,.1,.5)*smoothstep(.62,.3,r)*.12;
  return c;}
vec3 crystal(vec2 p,float t){
  p*=3.2;vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;vec2 cid=i;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(hash(i+g),hash(i+g+5.3));
    o=.5+.45*sin(t*.6+6.2831*o);float d=length(g+o-f);if(d<d1){d2=d1;d1=d;cid=i+g;}else if(d<d2)d2=d;}
  float h=hash(cid),edge=d2-d1;
  vec3 c=mix(vec3(.02,.05,.12),vec3(.35,.6,1.),h*.6+.1)*(1.-d1*.85);
  c+=vec3(.8,.9,1.)*smoothstep(.07,.0,edge)*1.3+vec3(1.)*pow(max(0.,1.-d1),8.)*.6*h;
  if(h>.9)c=c.zyx*vec3(1.,.55,.3)*1.4;return c;}
vec3 ink(vec2 p,float t){
  vec2 q=vec2(fbm(p*1.6+t*.08),fbm(p*1.6+5.2-t*.07));
  vec2 r=vec2(fbm(p*1.6+q*3.+vec2(1.7,9.2)),fbm(p*1.6+q*3.+vec2(8.3,2.8)+t*.05));
  float f=fbm(p*2.+r*3.);
  vec3 c=mix(vec3(.02),vec3(.93,.91,.88),smoothstep(-.2,.6,sin(f*28.)));
  return mix(c,ACC,smoothstep(.96,1.,abs(sin(f*14.+1.)))*.95);}
float sk(vec2 q,float t){return sin(q.x*3.+sin(q.y*2.+t*.6)*1.6+t*.4)+.5*sin(q.y*4.+q.x*1.5-t*.5);}
vec3 silk(vec2 p,float t){
  vec2 q=p*1.3;float e=.003,h=sk(q,t),hx=sk(q+vec2(e,0.),t),hy=sk(q+vec2(0.,e),t);
  vec3 n=normalize(vec3((h-hx)/e*.12,(h-hy)/e*.12,1.));
  float df=max(dot(n,normalize(vec3(-.4,.5,1.))),0.),sp=pow(max(dot(reflect(vec3(0.,0.,-1.),n),normalize(vec3(.3,.4,1.))),0.),40.);
  vec3 c=mix(vec3(.18,.01,.04),vec3(1.,.32,.18),df);c=mix(c,vec3(1.,.6,.5),pow(df,6.)*.5);
  return c+sp*vec3(1.,.93,.88)*1.2;}
vec3 rings(vec2 p,float t){
  vec2 a=vec2(sin(t*.4),cos(t*.33))*.22;
  float m=sin(length(p-a)*90.)*sin(length(p+a)*90.+t*2.);
  vec3 c=vec3(smoothstep(0.,.25,m))*.85;
  c=mix(c,ACC,smoothstep(0.,.25,-m)*smoothstep(.55,0.,length(p))*.9);
  return c*smoothstep(.75,.2,length(p));}
vec3 topo(vec2 p,float t){
  float h=fbm(p*1.7+vec2(t*.05,t*.03))+.35*fbm(p*4.-t*.04);
  float lv=h*16.,f=fract(lv),ln=smoothstep(.09,0.,min(f,1.-f));
  bool maj=mod(floor(lv+.5),5.)<.5;
  vec3 c=vec3(.03)+vec3(.05)*h;
  c+=(maj?ACC*1.2:vec3(.7))*ln*(maj?1.:.5);
  float pk=smoothstep(.02,0.,length(p-vec2(.15,-.05))-.012);
  return c+ACC*pk;}
vec3 terr(vec2 p,float t){
  float hz=.08;vec3 c;
  if(p.y>hz){
    c=mix(ACC*.9,vec3(.05,.01,.03),smoothstep(0.,.5,p.y-hz));
    vec2 s=p-vec2(0.,hz+.14);float sd=length(s)-.2;
    float cut=step(.5,fract((p.y-hz)*28.+t*.6))+step(.1,p.y-hz);
    c=mix(c,mix(vec3(1.,.85,.6),ACC,smoothstep(.2,-.1,s.y)),smoothstep(.005,0.,sd)*min(cut,1.));
  }else{
    float z=.3/(hz-p.y+.001);vec2 g=vec2(p.x*z,z+t*1.6);
    g.x+=sin(g.y*.6)*.4+sin(g.y*.23+t)*.3;
    vec2 f=abs(fract(g)-.5);float w=.02*z;
    float l=smoothstep(w+.02,w,.5-max(f.x,f.y));
    c=mix(vec3(.01),ACC*1.3,l)*exp(-z*.06);
    c+=ACC*.2*exp(-z*.15);
  }
  return c;}
vec3 halftone(vec2 p,float t){
  float r=.36,d=length(p),sh=0.;
  if(d<r){vec3 n=vec3(p/r,sqrt(max(0.,1.-d*d/(r*r))));sh=max(dot(n,normalize(vec3(cos(t*.5),.6,sin(t*.5)+.9))),0.);}
  vec2 g=rot(.6)*p*46.,f=fract(g)-.5;
  float k=smoothstep(.06,-.06,length(f)-(1.-sqrt(sh))*.55*step(d,r));
  vec2 g2=rot(1.1)*(p+.006)*46.,f2=fract(g2)-.5;
  float o=smoothstep(.06,-.06,length(f2)-(.42*(1.-sh))*step(d,r+.03));
  vec3 c=vec3(.94,.91,.85);c=mix(c,ACC,o*.9);return mix(c,vec3(.06,.05,.06),k);}
vec3 aurora(vec2 p,float t){vec3 c=vec3(0.,.01,.03);
  for(int i=0;i<4;i++){float fi=float(i);
    float y=p.y+.22-fi*.11-.16*sin(p.x*(1.5+fi*.6)+t*(.3+fi*.1)+fi*2.)-.22*(fbm(vec2(p.x*1.6+fi*4.,t*.12))-.5);
    float a=exp(-max(y,0.)*3.6)*exp(min(y,0.)*24.)*(.55+.45*sin(p.x*46.+fbm(vec2(p.x*9.,t*.5+fi))*18.));
    c+=mix(vec3(.1,1.,.6),vec3(.55,.2,1.),clamp(fi/3.+p.x*.4+.1,0.,1.))*a*.42;}
  c+=vec3(1.)*step(.996,hash(floor(p*110.)))*.5;
  return c+ACC*.12*exp(-(p.y+.5)*9.);}
float cw(vec2 p,float t){p+=.3*vec2(sin(p.y*1.7+t),cos(p.x*1.9-t*.8));vec2 i=floor(p),f=fract(p);float d=1.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=.5+.4*sin(t+6.2831*vec2(hash(i+g),hash(i+g+9.7)));d=min(d,length(g+o-f));}
  return d;}
vec3 caust(vec2 p,float t){float a=cw(p*3.,t*.8),b=cw(p*4.3+3.,t*1.1);float c=pow(a*a*.9+b*b*.6,1.6)*2.2;
  return mix(vec3(0.,.07,.12),vec3(.05,.45,.55),clamp(c,0.,1.))+vec3(.85,1.,.95)*pow(c,3.)*.4;}
vec3 crust(vec2 p,float t){
  vec2 q=p*3.2+.25*vec2(fbm(p*3.+t*.05),fbm(p*3.+7.));vec2 i=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 cid=i;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(hash(i+g),hash(i+g+5.3));
    float d=length(g+o-f);if(d<d1){d2=d1;d1=d;cid=i+g;}else if(d<d2)d2=d;}
  float e=d2-d1,glow=smoothstep(.14,0.,e),pulse=.55+.45*sin(t*1.2+hash(cid)*6.+p.x*3.);
  vec3 rock=(vec3(.05,.04,.04)+.07*fbm(p*14.))*(.5+e*1.2);
  return rock+mix(vec3(1.,.22,.02),vec3(1.,.82,.35),glow*glow)*glow*pulse*1.5;}
vec3 truchet(vec2 p,float t){vec2 q=p*7.+vec2(t*.15,0.);vec2 i=floor(q),f=fract(q);if(hash(i)>.5)f.x=1.-f.x;
  float d=min(abs(length(f)-.5),abs(length(f-1.)-.5));
  float l=smoothstep(.1,.07,d),l2=smoothstep(.03,0.,abs(d-.16));
  float fl=.5+.5*sin((i.x+i.y)*.6-t*1.5+length(f)*3.);
  vec3 c=vec3(.93,.9,.84);c=mix(c,vec3(.07,.06,.07),l);return mix(c,ACC,l2*fl);}
vec3 warp(vec2 p,float t){vec3 c=vec3(0.,0.,.015);float r=length(p),a=atan(p.y,p.x)/6.2831853+.5;
  for(int i=0;i<3;i++){float fi=float(i);float N=40.+fi*30.;float id=floor(a*N);float h=hash(vec2(id,fi+1.));
    float z=fract(h+t*(.2+h*.45));float rr=z*z*.95;
    float s=smoothstep(.02+z*.13,0.,abs(r-rr))*smoothstep(.5,.15,abs(fract(a*N)-.5))*z;
    c+=mix(vec3(.6,.75,1.),vec3(1.,.7,.5),h)*s*1.3;}
  return c+vec3(.9,.95,1.)*.012/(r+.02);}
vec3 smoke(vec2 p,float t){vec2 q=p*1.6;
  for(int i=0;i<3;i++){float n=fbm(q+vec2(0.,-t*.25)+float(i)*3.1);q+=.6*vec2(cos(n*6.28+t*.2),sin(n*6.28));}
  float l=fbm(q*1.5);float lines=smoothstep(.08,0.,abs(fract(l*9.)-.5)-.38);
  return vec3(.015)+vec3(.75,.78,.85)*lines*.55*smoothstep(.9,.1,length(p))+ACC*smoothstep(.55,.9,l)*.5;}
vec3 merc(vec2 p,float t){float f=0.;vec2 g=vec2(0.);
  for(int i=0;i<6;i++){float fi=float(i);vec2 c=.33*vec2(sin(t*(.5+fi*.11)+fi*2.1),cos(t*(.43+fi*.13)+fi*1.3));
    vec2 d=p-c;float r2=dot(d,d)+.002;float w=.012+.004*fi;f+=w/r2;g-=2.*w*d/(r2*r2);}
  float m=smoothstep(.95,1.05,f);
  vec3 n=normalize(vec3(-g*.035,1.)),r=reflect(vec3(0.,0.,-1.),n);
  vec3 c=mix(vec3(.02,.02,.03),vec3(.95,.97,1.),smoothstep(-.25,.55,sin(r.y*7.+r.x*3.+t*.2)));
  c+=ACC*pow(max(0.,-r.y),3.)*.9+pow(max(0.,dot(r,normalize(vec3(.3,.6,.7)))),40.)*1.5;
  c*=.35+.65*smoothstep(.95,1.6,f);
  vec3 bg=vec3(.02,.018,.02)+ACC*.07*smoothstep(.9,0.,length(p))+vec3(.5)*smoothstep(.6,.95,f)*.08;
  return mix(bg,c,m);}
void main(){
  vec2 lp=gl_FragCoord.xy-uRect.xy;
  vec2 p=(lp-.5*uRect.zw)/uRect.w;
  float t=uTime*(1.+uHover*.9);
  p+=(uM-.5)*.06*uHover;p*=1.-uHover*.06;
  vec3 c;
  if(uKind<.5)c=gold(p,t);else if(uKind<1.5)c=plasma(p,t);else if(uKind<2.5)c=crystal(p,t);
  else if(uKind<3.5)c=ink(p,t);else if(uKind<4.5)c=silk(p,t);else if(uKind<5.5)c=rings(p,t);
  else if(uKind<6.5)c=topo(p,t);else if(uKind<7.5)c=terr(p,t);else if(uKind<8.5)c=halftone(p,t);
  else if(uKind<9.5)c=aurora(p,t);else if(uKind<10.5)c=caust(p,t);else if(uKind<11.5)c=crust(p,t);
  else if(uKind<12.5)c=truchet(p,t);else if(uKind<13.5)c=warp(p,t);else if(uKind<14.5)c=smoke(p,t);else c=merc(p,t);
  c+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.035;
  float a=smoothstep(1.,-1.,sdRB(lp-.5*uRect.zw,.5*uRect.zw,uRad))*uAlpha;
  gl_FragColor=vec4(clamp(c,0.,1.)*a,a);}`;

  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uRes','uTime','uRect','uKind','uHover','uRad','uM','uAlpha'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
  gl.enable(gl.SCISSOR_TEST);

  let dpr = 1;
  function resize(){ dpr = Math.min(devicePixelRatio || 1, 1.5); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  resize(); addEventListener('resize', resize);

  /* el._k overrides the kind and el._a the opacity at runtime; APP.addSlot registers slots created later */
  const slots = [];
  APP.addSlot = el => {
    const s = {el, k:+el.dataset.k, h:0, hov:false, m:[.5,.5], card:el.closest('.scard'), rad:null};
    el.addEventListener('pointerenter', () => s.hov = true);
    el.addEventListener('pointerleave', () => s.hov = false);
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); s.m = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; });
    slots.push(s); return s;
  };
  document.querySelectorAll('[data-k]').forEach(APP.addSlot);
  addEventListener('resize', () => slots.forEach(s => s.rad = null));

  const t0 = performance.now();
  (function loop(now){
    requestAnimationFrame(loop);
    gl.disable(gl.SCISSOR_TEST); gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.SCISSOR_TEST);
    if(!APP.ready) return;
    const H = innerHeight, W = innerWidth, t = (now - t0) / 1000;
    gl.uniform1f(U.uTime, t);
    for(const s of slots){
      const r = s.el.getBoundingClientRect();
      if(r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || r.width < 2) continue;
      const al = s.el._a == null ? 1 : s.el._a; if(al < .01) continue;
      let bottom = r.bottom;
      if(s.card){ const nx = s.card.nextElementSibling; if(nx && nx.classList.contains('scard')) bottom = Math.min(bottom, nx.getBoundingClientRect().top); }
      const x0 = Math.max(0, r.left + 1), x1 = Math.min(W, r.right - 1), y0 = Math.max(0, r.top + 1), y1 = Math.min(H, bottom - 1);
      if(x1 <= x0 || y1 <= y0) continue;
      s.h += ((s.hov ? 1 : 0) - s.h) * .08;
      if(s.rad == null) s.rad = parseFloat(getComputedStyle(s.el).borderTopLeftRadius) || 0;
      const rad = Math.min(s.rad * (r.width / (s.el.offsetWidth || r.width)), r.height / 2, r.width / 2);
      const fx = (r.left + 1) * dpr, fy = (H - r.bottom + 1) * dpr, fw = (r.width - 2) * dpr, fh = (r.height - 2) * dpr;
      gl.viewport(fx, fy, fw, fh);
      gl.scissor(x0 * dpr, (H - y1) * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr);
      gl.uniform4f(U.uRect, fx, fy, fw, fh);
      gl.uniform1f(U.uKind, s.el._k == null ? s.k : s.el._k); gl.uniform1f(U.uAlpha, al); gl.uniform1f(U.uHover, s.h); gl.uniform1f(U.uRad, Math.max(0, rad - 1) * dpr);
      gl.uniform2f(U.uM, s.m[0], s.m[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  })(t0);
})();
