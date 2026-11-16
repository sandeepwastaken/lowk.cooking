/* ===== shader kit: fullscreen section shaders (heat, tunnel, mask, footer fire) ===== */
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

  const HEAT = `uniform float uHeat;
vec3 pal(float x){
  vec3 c=mix(vec3(0.),vec3(.32,.02,.01),smoothstep(.1,.38,x));
  c=mix(c,vec3(1.,.3,.05),smoothstep(.33,.62,x));
  c=mix(c,vec3(1.,.72,.28),smoothstep(.58,.88,x));
  return mix(c,vec3(1.,.97,.9),smoothstep(.88,1.25,x));}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 q=vec2(uv.x*asp,uv.y);
  float t=uTime*(.55+uHeat*.9);
  vec2 w=vec2(fbm(q*1.8+vec2(0.,-t*.7)),fbm(q*1.8+vec2(4.1,-t*.9)));
  float f=fbm(q*2.6+w*1.8+vec2(0.,-t*1.4));
  float g=smoothstep(1.15,-.15,uv.y-uHeat*.4);
  vec2 m=vec2(uMouse.x*asp,uMouse.y);float md=length(q-m);
  float heat=f*g*(.22+1.3*uHeat)+exp(-md*md*12.)*(.25+.35*uHeat)*f*1.4;
  vec3 col=pal(heat);
  vec2 eg=vec2(q.x*16.+sin(q.y*4.+uTime)*.6,q.y*10.-uTime*(1.4+uHeat*3.2));
  vec2 id=floor(eg),fr=fract(eg)-.5;float h=hash(id);
  vec2 off=vec2(hash(id+3.1)-.5,hash(id+7.7)-.5)*.6;
  float em=smoothstep(.1,0.,length(fr-off))*step(.9-uHeat*.28,h);
  col+=vec3(1.,.55,.2)*em*(.15+uHeat*1.2)*smoothstep(-.3,.6,g);
  col+=vec3(.025,.02,.022)*fbm(q*3.+uTime*.1)*(1.-uHeat);
  col*=1.-.4*length(uv-.5);
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.03;
  gl_FragColor=vec4(col,1.);}`;

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
  vec3 c=vec3(.35,.42,.6)*lon*.5+vec3(.75,.78,.9)*ring*.18;
  c+=mix(ACC,vec3(1.,.8,.6),sp)*pk*lon*5.;
  c+=ACC*step(.965,pan)*(.5+.5*sin(uTime*5.+pan*60.))*.35;
  c+=vec3(.25,.35,1.)*step(.985,hash(floor(tc)+3.))*.25;
  c*=smoothstep(.0,.55,r);
  c+=mix(ACC,vec3(1.),.4)*.03/(r+.025)*(.5+uP);
  return c;}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  p+=(uMouse-.5)*vec2(-.15,-.1);
  p*=rot(uP*4.+uTime*.04);
  float z=uP*70.+uTime*.35;
  float ca=.006+uV*.03;
  vec3 col=vec3(tun(p*(1.+ca),z).r,tun(p,z).g,tun(p*(1.-ca),z).b);
  col=1.-exp(-col*1.7);
  col*=1.-.45*pow(length(p),2.);
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

  const list = [];
  function ShaderCanvas(cv, frag, u, opts = {}){
    const gl = cv.getContext('webgl', {antialias:false, alpha:false});
    if(!gl) return;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, PRE + frag)); gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const loc = {}, L = n => loc[n] !== undefined ? loc[n] : (loc[n] = gl.getUniformLocation(pr, n));
    const o = {cv, gl, u, vis:false, scale:opts.scale || .75, max:opts.max || 1, sm:[.5,.5]};
    o.resize = () => { const r = cv.getBoundingClientRect(); cv.width = Math.max(2, r.width * o.scale); cv.height = Math.max(2, r.height * o.scale); gl.viewport(0, 0, cv.width, cv.height); };
    new ResizeObserver(o.resize).observe(cv);
    new IntersectionObserver(es => es.forEach(e => o.vis = e.isIntersecting)).observe(cv);
    o.draw = t => {
      const r = cv.getBoundingClientRect();
      const mx = clamp((APP.px - r.left) / r.width, -.5, 1.5), my = clamp(1 - (APP.py - r.top) / r.height, -.5, 1.5);
      o.sm[0] += (mx - o.sm[0]) * .06; o.sm[1] += (my - o.sm[1]) * .06;
      gl.uniform2f(L('uRes'), cv.width, cv.height); gl.uniform1f(L('uTime'), t); gl.uniform2f(L('uMouse'), o.sm[0], o.sm[1]);
      const x = u ? u() : {}; for(const k in x) gl.uniform1f(L(k), x[k]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    list.push(o); return o;
  }
  APP.ShaderCanvas = ShaderCanvas;

  const $ = s => document.querySelector(s);
  const heatSec = $('#heat'), tunSec = $('#tunnel'), maskSec = $('#served');
  ShaderCanvas($('#heat-c'), HEAT, () => ({uHeat: APP.heatLvl || 0}), {scale:.6});
  ShaderCanvas($('#tun-c'), TUNNEL, () => ({uP: APP.prog(tunSec), uV: Math.min(1, Math.abs(APP.vel || 0) / 60)}), {scale:.7});
  ShaderCanvas($('#mask-c'), MASK, () => ({uP: APP.prog(maskSec)}), {scale:.6});
  ShaderCanvas($('#fire-c'), HEAT, () => ({uHeat: .42}), {scale:.5});

  const t0 = performance.now(); let ft = 16, last = t0, n = 0;
  (function loop(now){
    requestAnimationFrame(loop);
    const dt = now - last; last = now; ft += (dt - ft) * .05;
    if(++n % 30 === 0) list.forEach(o => {
      if(ft > 24 && o.scale > .3){ o.scale *= .85; o.resize(); }
      else if(ft < 15 && o.scale < o.max){ o.scale = Math.min(o.max, o.scale * 1.05); o.resize(); }
    });
    const t = (now - t0) / 1000;
    for(const o of list) if(o.vis) o.draw(t);
  })(t0);
})();
