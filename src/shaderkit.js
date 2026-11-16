/* ===== shader kit: every fullscreen section shader runs in ONE shared WebGL context and is blitted into
   that section's 2D canvas, so the page can have as many shader scenes as it likes without hitting the
   browser's context limit ===== */
(function(){
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  APP.prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); };

  const PRE = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;
const vec3 ACC=vec3(1.,.36,.14);
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
`;
  APP.GLSL_PRE = PRE;

  /* --- fire: domain-warped flame, three ember layers, heat haze, click flares --- */
  const HEAT = `uniform float uHeat;uniform float uFlare;
vec3 pal(float x){
  vec3 c=mix(vec3(0.),vec3(.32,.02,.01),smoothstep(.1,.38,x));
  c=mix(c,vec3(1.,.3,.05),smoothstep(.33,.62,x));
  c=mix(c,vec3(1.,.72,.28),smoothstep(.58,.88,x));
  return mix(c,vec3(1.,.97,.9),smoothstep(.88,1.25,x));}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 q=vec2(uv.x*asp,uv.y);
  float H=uHeat+uFlare*.35;
  float t=uTime*(.55+H*.9);
  q+=(vec2(noise(q*6.+vec2(0.,-t*3.)),noise(q*6.+vec2(5.,-t*3.)))-.5)*.022*(.3+H);
  vec2 w=vec2(fbm(q*vec2(1.7,1.2)+vec2(0.,-t*.75)),fbm(q*vec2(1.7,1.2)+vec2(4.1,-t*.95)));
  float f=fbm(q*vec2(2.5,1.7)+w*1.9+vec2(0.,-t*1.5));
  float rg=1.-abs(2.*fbm(q*vec2(3.3,1.2)+w+vec2(7.,-t*2.3))-1.);
  f=f*.78+rg*rg*.34;
  float g=smoothstep(1.15,-.15,uv.y-H*.42);
  vec2 m=vec2(uMouse.x*asp,uMouse.y);float md=length((q-m)*vec2(1.,.8));
  float heat=f*g*(.22+1.32*H)+exp(-md*md*11.)*(.28+.4*H)*(f*1.25+.2)+uFlare*exp(-md*md*2.6)*.7;
  vec3 col=pal(heat);
  for(int i=0;i<3;i++){float fi=float(i);float sc=10.+fi*7.;
    vec2 eg=vec2(q.x*sc+sin(q.y*(3.+fi)+uTime*(.8+fi*.3))*.7,q.y*sc*.6-uTime*(1.2+fi*.5+H*3.));
    vec2 id=floor(eg),fr=fract(eg)-.5;float h=hash(id+fi*17.);
    vec2 off=vec2(hash(id+3.1)-.5,hash(id+7.7)-.5)*.7;
    float tw=.6+.4*sin(uTime*(6.+h*9.)+h*40.);
    float em=smoothstep(.09-fi*.02,0.,length((fr-off)*vec2(1.,.55)))*step(.92-H*.3,h)*tw;
    col+=mix(vec3(1.,.5,.15),vec3(1.,.85,.5),h)*em*(.2+H*1.3)*smoothstep(-.2,.7,g+.2);}
  col+=vec3(.025,.02,.022)*fbm(q*3.+uTime*.1)*(1.-H);
  col+=vec3(1.,.42,.1)*.14*H*smoothstep(.55,0.,uv.y);
  col*=1.-.7*dot(uv-.5,uv-.5);
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.03;
  gl_FragColor=vec4(col,1.);}`;

  /* --- hyperdrive tunnel: panels, pulses, warp streaks, velocity-driven aberration and shake --- */
  const TUNNEL = `uniform float uP;uniform float uV;
vec3 tun(vec2 p,float z){
  float r=length(p);float a=atan(p.y,p.x)/6.2831853;
  float d=.32/max(r,.001)+z;
  vec2 tc=vec2((a+d*.03*sin(uTime*.2))*24.,d*1.6);
  float dl=.5-abs(fract(tc.x)-.5),dr=.5-abs(fract(tc.y)-.5);
  float lon=smoothstep(.06,.0,dl),ring=smoothstep(.05,.0,dr);
  float sp=hash(vec2(floor(tc.x+.5),1.));
  float pk=pow(max(0.,sin(d*1.1+uTime*(2.+sp*6.)+sp*30.)),16.)*step(.45,sp);
  float pan=hash(floor(tc));
  vec3 c=mix(vec3(.35,.42,.6),vec3(.62,.3,.22),uP)*lon*.5+vec3(.75,.78,.9)*ring*.18;
  c+=mix(ACC,vec3(1.,.8,.6),sp)*pk*lon*5.;
  c+=ACC*step(.965-uP*.05,pan)*(.5+.5*sin(uTime*5.+pan*60.))*.35;
  c+=vec3(.25,.35,1.)*step(.985,hash(floor(tc)+3.))*.25;
  c+=mix(vec3(.2,.3,.6),ACC,uP)*step(.78,pan)*pow(max(0.,sin(d*.35-uTime*3.)),24.)*.55;
  c*=smoothstep(.0,.55,r);
  return c;}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  p+=(uMouse-.5)*vec2(-.15,-.1);
  p+=(vec2(hash(vec2(floor(uTime*60.),1.)),hash(vec2(floor(uTime*60.),2.)))-.5)*.007*(uV*2.+uP*uP);
  p*=1.-uV*.12;
  p*=rot(uP*4.+uTime*.04);
  float z=uP*70.+uTime*.35;
  float ca=.006+uV*.035+uP*.006;
  vec3 col=vec3(tun(p*(1.+ca),z).r,tun(p,z).g,tun(p*(1.-ca),z).b);
  float r=length(p);vec2 dir=p/max(r,.001);
  float ang=noise(dir*19.+7.);float trav=noise(vec2(ang*40.,.5/(r+.04)+z*.7));
  col+=mix(vec3(.7,.82,1.),vec3(1.,.8,.6),uP)*pow(ang,5.)*smoothstep(.5,.95,trav)*smoothstep(.04,.5,r)*(.5+uV*3.+uP*1.5);
  col+=mix(ACC,vec3(1.),.4+.4*uP)*(.03+uP*.05)/(r+.025)*(.5+uP);
  col=1.-exp(-col*(1.7+uP*.6));
  col*=1.-.45*pow(r,2.);
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.025;
  gl_FragColor=vec4(col,1.);}`;

  const MASK = `uniform float uP;
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;float t=uTime*.11;
  p+=(uMouse-.5)*.15;
  vec2 q=vec2(fbm(p*1.5+t),fbm(p*1.5-t+3.));
  vec2 r=vec2(fbm(p*1.5+q*2.+vec2(1.7,9.2)+t*1.3),fbm(p*1.5+q*2.+vec2(8.3,2.8)-t));
  float f=fbm(p*1.2+r*2.2);
  vec3 c=mix(vec3(.05,.01,.02),ACC,smoothstep(.22,.62,f));
  c=mix(c,vec3(.95,.18,.42),smoothstep(.45,.9,length(q))*.6);
  c=mix(c,vec3(.22,.1,.85),smoothstep(.55,.95,r.x)*.55);
  c=mix(c,vec3(1.,.93,.82),smoothstep(.7,.95,f));
  float sp=pow(max(0.,fbm(p*3.+r*3.+t*2.)-.45),3.)*6.;
  c+=sp*vec3(1.,.9,.8);
  c+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.04;
  gl_FragColor=vec4(c,1.);}`;

  /* --- reduction: a black hole. Lensed starfield, photon ring, tilted accretion disk with doppler beaming --- */
  const BH = `uniform float uP;
vec3 hc(float x){x=clamp(x,0.,1.5);return mix(mix(vec3(.45,.05,.01),vec3(1.,.42,.1),clamp(x*1.6,0.,1.)),vec3(1.,.96,.88),clamp(x*1.5-.75,0.,1.));}
vec3 stars(vec2 p){vec3 c=vec3(0.);
  for(int i=0;i<3;i++){float fi=float(i);vec2 g=p*(9.+fi*9.)+fi*31.;vec2 id=floor(g),f=fract(g)-.5;float h=hash(id+fi);
    vec2 o=(vec2(hash(id+1.3),hash(id+2.7))-.5)*.7;
    c+=mix(vec3(.7,.8,1.),vec3(1.,.8,.6),hash(id+5.))*smoothstep(.05,0.,length(f-o))*step(.72,h)*(.5+.5*sin(uTime*(1.+h*3.)+h*30.));}
  return c;}
void main(){
  vec2 sv=gl_FragCoord.xy/uRes-.5;
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;p+=(uMouse-.5)*vec2(-.1,-.07);
  float e=uP*uP*(3.-2.*uP);
  p*=mix(2.5,.42,e);
  p*=rot(.25-e*.5);
  float rs=.2,r=length(p);vec2 n=p/max(r,1e-4);
  float bend=rs*rs*1.9/(r*r+.004);
  vec2 bp=rot(bend*.9)*(p-n*bend);
  vec3 col=stars(bp*.9+vec2(uTime*.008,0.));
  float nb=fbm(bp*1.3+3.);col+=mix(vec3(.04,.02,.09),ACC*.22,nb)*nb*nb*.7;
  col*=smoothstep(rs,rs*1.05,r);
  float as=fbm(rot(uTime*.35)*n*2.6+vec2(r*30.,0.));
  float ar=smoothstep(rs*1.08,rs*1.3,r)*smoothstep(rs*2.15,rs*1.4,r);
  col+=hc(1.15-(r-rs)/(rs*1.1))*ar*(.25+as*1.1)*(1.-.45*n.x);
  col+=vec3(1.,.9,.78)*.0035/(abs(r-rs*1.07)+.003)*smoothstep(rs*.99,rs*1.08,r);
  float tl=.2+.06*sin(uTime*.13);vec2 dp=vec2(p.x,p.y/tl);float dr=length(dp);
  vec2 q=rot(-uTime*.22/(dr+.12)-dr*3.)*dp;
  float sw=fbm(vec2(dr*26.,0.)+q*3.4)*.75+.25*fbm(q*11.);
  float band=smoothstep(rs*1.35,rs*1.9,dr)*smoothstep(rs*6.5,rs*2.4,dr);
  vec3 dc=hc(1.25-dr/(rs*4.2))*band*(.2+sw*sw*2.4)*(1.-.6*dp.x/max(dr,1e-3));
  col+=dc*mix(smoothstep(rs,rs*1.05,r),1.,step(p.y,0.));
  col+=ACC*.05/(r*r*6.+.25);
  col*=1.-smoothstep(.9,1.,uP);
  col=1.-exp(-col*1.5);
  col*=1.-.6*dot(sv,sv);
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.03;
  gl_FragColor=vec4(col,1.);}`;

  /* --- simmer: a stock pot. Metaball bubbles rise and merge with a boiling surface under drifting steam --- */
  const SIMMER = `uniform float uP;uniform vec3 uPop;
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 p=vec2((uv.x-.5)*asp,uv.y-.5);
  vec2 m=vec2((uMouse.x-.5)*asp,uMouse.y-.5);
  float lvl=mix(-.3,.02,uP);
  float pd=abs(p.x-uPop.x);float rip=sin(pd*38.-uPop.z*14.)*exp(-pd*5.)*exp(-uPop.z*2.2)*.03;
  float surf=lvl+.014*sin(p.x*8.+uTime*1.7)*(.4+uP)+.008*sin(p.x*21.-uTime*2.9)+(fbm(vec2(p.x*4.,uTime*.9))-.5)*.07*uP+rip;
  float f=0.;
  for(int i=0;i<16;i++){float fi=float(i);float h=hash(vec2(fi,1.7));float sp=(.08+.22*hash(vec2(fi,9.1)))*(.35+uP*1.5);
    float cyc=uTime*sp+h;float ph=fract(cyc);
    vec2 c=vec2((hash(vec2(fi,4.2)+floor(cyc))-.5)*asp*.96+sin(uTime*1.3+fi*2.)*.012,mix(-.62,surf+.035,ph));
    float rad=(.022+.05*hash(vec2(fi,2.3)))*(.45+ph*.75)*smoothstep(1.,.93,ph)*(.5+uP*.7);
    vec2 d=p-c;f+=rad*rad/(dot(d,d)+1e-4);}
  f+=.0028/(dot(p-m,p-m)+.002);
  float below=surf-p.y;
  float liquid=smoothstep(-.004,.004,below+max(0.,f-.75)*.05);
  float depth=clamp(below*1.6,0.,1.);
  vec3 lc=mix(vec3(1.,.6,.16),vec3(.22,.04,.01),pow(depth,.6));
  lc+=vec3(1.,.8,.4)*smoothstep(.03,0.,below)*.6;
  float bub=smoothstep(.9,1.02,f);float rim=smoothstep(.9,1.05,f)-smoothstep(1.05,1.9,f);
  lc=mix(lc,lc*1.5+vec3(.25,.12,.03),bub*.55);lc+=vec3(1.,.9,.7)*rim*.45;
  float st=fbm(vec2(p.x*2.6,p.y*1.8-uTime*.35)+2.*fbm(p*1.7+vec2(0.,-uTime*.2)));
  vec3 air=vec3(.012,.01,.012)+vec3(.8,.78,.75)*pow(st,3.)*smoothstep(0.,.5,-below)*(.1+uP*.9)*.8;
  air+=vec3(1.,.45,.12)*.25*exp(below*9.)*(.3+uP);
  vec3 col=mix(air,lc,liquid);
  col*=1.-.5*dot(uv-.5,uv-.5);
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.03;
  gl_FragColor=vec4(col,1.);}`;

  /* --- flash freeze: frost creeps in from the edges over a warm bokeh scene; uTex is the cursor's wipe mask --- */
  const FROST = `uniform float uP;uniform sampler2D uTex;
vec3 scene(vec2 p){vec3 c=mix(vec3(.05,.015,.02),vec3(.012,.008,.02),clamp(p.y+.5,0.,1.));
  for(int i=0;i<14;i++){float fi=float(i);vec2 o=vec2((hash(vec2(fi,1.))-.5)*2.6,(hash(vec2(fi,2.))-.5)*.9);o+=.05*vec2(sin(uTime*.4+fi),cos(uTime*.3+fi*2.));
    float r=.05+.11*hash(vec2(fi,3.));
    c+=mix(ACC,vec3(1.,.75,.35),hash(vec2(fi,4.)))*smoothstep(r,r*.8,length(p-o))*(.16+.2*hash(vec2(fi,5.)))*(.7+.3*sin(uTime+fi));}
  return c;}
float cry(vec2 p){float v=0.;for(int i=0;i<3;i++){vec2 q=rot(float(i)*1.0472+.3)*p;
  v=max(v,pow(1.-abs(sin(q.x*16.+fbm(q*2.5)*6.)),10.)*smoothstep(.3,.7,fbm(q*vec2(1.5,7.)+float(i)*5.)));}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float wipe=texture2D(uTex,vec2(uv.x,1.-uv.y)).r;
  float n=fbm(p*3.)+.5*fbm(p*9.);
  float edge=max(abs(uv.x-.5),abs(uv.y-.5))*2.;
  float cover=smoothstep(0.,.3,uP*1.9-(1.-edge)*1.2-(n-.75)*.7+.05);
  cover*=1.-smoothstep(.15,.6,wipe);
  vec2 off=(vec2(fbm(p*16.),fbm(p*16.+5.))-.5)*.3*cover;
  vec3 sc=scene(p+off);
  float c1=cry(p*1.2),c2=cry(p*2.6+3.);
  float rime=fbm(p*26.)*.6+fbm(p*70.)*.4;
  vec3 ice=mix(vec3(.4,.55,.72),vec3(.96,.99,1.),clamp(c1+rime*rime*.9,0.,1.))*(.6+.5*c2)+vec3(.9,.97,1.)*pow(c1*c2,2.)*1.5;
  ice+=vec3(1.)*step(.985,hash(floor(gl_FragCoord.xy*.5)+floor(uTime*3.)))*rime*.5;
  vec3 col=mix(sc,sc*.22+ice*.85,cover);
  float me=smoothstep(.1,.35,wipe)*(1.-smoothstep(.35,.7,wipe));
  col+=vec3(.7,.85,1.)*me*.18*smoothstep(0.,.1,uP);
  col*=1.-.45*dot(uv-.5,uv-.5);
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.03;
  gl_FragColor=vec4(col,1.);}`;

  /* --- closing time: rain sliding down fogged glass, refracting city bokeh and the neon sign --- */
  const RAIN = `uniform float uOn;
vec3 city(vec2 p,float b){vec3 c=mix(vec3(.012,.012,.03),vec3(.05,.02,.05),clamp(p.y+.5,0.,1.));
  for(int i=0;i<16;i++){float fi=float(i);vec2 o=vec2((hash(vec2(fi,1.))-.5)*2.6,(hash(vec2(fi,2.))-.62)*.9);float r=(.025+.05*hash(vec2(fi,3.)))*(1.+b*2.2);
    vec3 k=hash(vec2(fi,6.))>.55?ACC:mix(vec3(.3,.5,1.),vec3(1.,.8,.4),hash(vec2(fi,4.)));
    c+=k*smoothstep(r,r*(.7-b*.45),length(p-o))*(.5/(1.+b*5.))*(.6+.4*sin(uTime*(.5+hash(vec2(fi,7.)))+fi));}
  vec2 s=p*vec2(.55,1.5);c+=ACC*uOn*(.4+b*.2)*exp(-dot(s,s)*2.2);
  return c;}
vec3 drops(vec2 uv,float t){
  vec2 g=uv*vec2(7.,3.5);float cs=hash(vec2(floor(g.x),7.));g.y+=t*(.25+cs*.5)+cs*10.;
  vec2 id=floor(g),f=fract(g)-.5;float h=hash(id);
  float x=(h-.5)*.6,y=-sin(t*1.7+h*6.28+sin(t*1.7+h*6.28)*.5)*.32;
  vec2 d=(f-vec2(x,y))*vec2(1.,2.);
  float on=step(.4,h);
  float drop=smoothstep(.16,.09,length(d))*on;
  float tr=smoothstep(.05,.02,abs(f.x-x))*smoothstep(-.02,.12,f.y-y)*smoothstep(.5,.25,f.y)*on;
  return vec3(d*drop*4.+vec2((f.x-x)*6.,0.)*tr,max(drop,tr*.55));}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;vec2 uv=gl_FragCoord.xy/uRes.y;
  vec3 d1=drops(uv,uTime*.55),d2=drops(uv*1.9+vec2(3.3,1.7),uTime*.8);
  vec2 off=d1.xy*.05+d2.xy*.03;float m=clamp(d1.z+d2.z,0.,1.);
  float fog=.75+.25*fbm(p*3.+uTime*.02);
  vec3 col=city(p-off,mix(fog,0.,m));
  col+=vec3(.6,.7,.9)*m*.05+pow(m,3.)*.06;
  col*=1.-.24*dot(p,p);
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.03;
  gl_FragColor=vec4(col,1.);}`;

  /* --- the shared context --- */
  const glc = document.createElement('canvas'); glc.width = glc.height = 16;
  const gl = glc.getContext('webgl', {antialias:false, alpha:false, depth:false, powerPreference:'high-performance'});
  const list = [], progs = new Map();
  if(gl){
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  function program(frag){
    if(progs.has(frag)) return progs.get(frag);
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, PRE + frag)); gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(pr));
    const P = {pr, loc:{}}; progs.set(frag, P); return P;
  }
  function ShaderCanvas(cv, frag, u, opts = {}){
    if(!gl || !cv) return;
    const ctx = cv.getContext('2d');
    const o = {cv, frag, u, vis:false, scale:opts.scale || .75, max:opts.max || 1, sm:[.5,.5], P:null, tex:opts.tex, glTex:null};
    o.resize = () => { const r = cv.getBoundingClientRect(); cv.width = Math.max(2, Math.round(r.width * o.scale)); cv.height = Math.max(2, Math.round(r.height * o.scale)); };
    new ResizeObserver(o.resize).observe(cv);
    new IntersectionObserver(es => es.forEach(e => o.vis = e.isIntersecting)).observe(cv);
    o.draw = t => {
      const w = cv.width, h = cv.height;
      if(glc.width < w || glc.height < h){ glc.width = Math.max(glc.width, w); glc.height = Math.max(glc.height, h); }
      const P = o.P || (o.P = program(frag)), L = n => P.loc[n] !== undefined ? P.loc[n] : (P.loc[n] = gl.getUniformLocation(P.pr, n));
      gl.useProgram(P.pr); gl.viewport(0, 0, w, h);
      const r = cv.getBoundingClientRect();
      const mx = clamp((APP.px - r.left) / r.width, -.5, 1.5), my = clamp(1 - (APP.py - r.top) / r.height, -.5, 1.5);
      o.sm[0] += (mx - o.sm[0]) * .06; o.sm[1] += (my - o.sm[1]) * .06;
      gl.uniform2f(L('uRes'), w, h); gl.uniform1f(L('uTime'), t); gl.uniform2f(L('uMouse'), o.sm[0], o.sm[1]);
      const x = u ? u() : {};
      for(const k in x){ const v = x[k]; if(v.length === 3) gl.uniform3f(L(k), v[0], v[1], v[2]); else if(v.length === 2) gl.uniform2f(L(k), v[0], v[1]); else gl.uniform1f(L(k), v); }
      if(o.tex){
        const src = o.tex(); if(!src) return;
        gl.activeTexture(gl.TEXTURE0);
        if(!o.glTex){ o.glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, o.glTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
        gl.bindTexture(gl.TEXTURE_2D, o.glTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.uniform1i(L('uTex'), 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      ctx.drawImage(glc, 0, glc.height - h, w, h, 0, 0, w, h);
    };
    list.push(o); return o;
  }
  APP.ShaderCanvas = ShaderCanvas;

  const $ = s => document.querySelector(s);
  const tunSec = $('#tunnel'), maskSec = $('#served');
  ShaderCanvas($('#heat-c'), HEAT, () => ({uHeat: APP.heatLvl || 0, uFlare: APP.flare || 0}), {scale:.6});
  ShaderCanvas($('#tun-c'), TUNNEL, () => ({uP: APP.prog(tunSec), uV: Math.min(1, Math.abs(APP.vel || 0) / 60)}), {scale:.7});
  ShaderCanvas($('#mask-c'), MASK, () => ({uP: APP.prog(maskSec)}), {scale:.6});
  ShaderCanvas($('#fire-c'), HEAT, () => ({uHeat: .42, uFlare: 0}), {scale:.5});
  ShaderCanvas($('#bh-c'), BH, () => ({uP: APP.bh || 0}), {scale:.65});
  ShaderCanvas($('#sim-c'), SIMMER, () => ({uP: APP.boil || 0, uPop: [APP.popX || 0, 0, APP.popAge == null ? 99 : APP.popAge]}), {scale:.6});
  ShaderCanvas($('#frost-c'), FROST, () => ({uP: APP.frost || 0}), {scale:.55, tex: () => APP.wipe});
  ShaderCanvas($('#rain-c'), RAIN, () => ({uOn: APP.neon == null ? 1 : APP.neon}), {scale:.6});

  // compile everything while the loader is up, one program per tick, so nothing hitches on first scroll
  list.forEach((o, i) => setTimeout(() => { if(!o.P) o.P = program(o.frag); }, 250 + i * 90));

  const t0 = performance.now(); let ft = 16, last = t0, n = 0;
  (function loop(now){
    requestAnimationFrame(loop);
    const dt = now - last; last = now; ft += (dt - ft) * .05;
    if(++n % 30 === 0) list.forEach(o => {
      if(!o.vis) return;
      if(ft > 24 && o.scale > .3){ o.scale *= .85; o.resize(); }
      else if(ft < 15 && o.scale < o.max){ o.scale = Math.min(o.max, o.scale * 1.05); o.resize(); }
    });
    const t = (now - t0) / 1000;
    for(const o of list) if(o.vis) o.draw(t);
  })(t0);
})();
