/* ===== shared state ===== */
window.APP = {px:innerWidth/2, py:innerHeight/2, mx:0, my:0, lastMove:0, scroll:0, vel:0, pulse:0, fps:60, ready:false};

/* ===== WebGL raymarched liquid chrome ===== */
(function(){
  const cv = document.getElementById('gl');
  const gl = cv.getContext('webgl', {antialias:false, alpha:false, powerPreference:'high-performance'});
  if(!gl){ cv.style.background='radial-gradient(circle at 60% 40%,#3a1d6e,#050507 60%)'; APP.glOK=false; return; }
  APP.glOK = true;

  const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const fs = `
precision highp float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uScroll;uniform float uPulse;uniform float uIntro;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec3 OFF(){float s=smoothstep(0.,1.1,uScroll);return vec3(1.55*s,.35*s,-.6*s);}
float map(vec3 p){
  float t=uTime*.55;
  vec3 q=p-OFF();
  float sc=mix(.25,1.,uIntro);
  float d=1e5;
  for(int i=0;i<6;i++){
    float fi=float(i);
    vec3 c=vec3(sin(t*(.41+fi*.13)+fi*1.7)*1.25,cos(t*(.53+fi*.11)+fi*2.3)*.85,sin(t*(.37+fi*.07)+fi*.9)*.7)*sc;
    float r=(.42+.14*sin(fi*3.1+t*1.3))*sc;
    d=smin(d,length(q-c)-r,.62);
  }
  vec3 m=vec3(uMouse*2.6,.35);
  d=smin(d,length(p-m)-.26*uIntro,.75);
  float L=length(q);
  d+=.028*sin(p.x*7.+uTime*2.1)*sin(p.y*6.+uTime*1.6)*sin(p.z*7.-uTime);
  d+=uPulse*.09*sin(L*11.-uTime*18.)*exp(-L*.6);
  return d;
}
vec3 nrm(vec3 p){vec2 e=vec2(.0015,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
const vec3 ACC=vec3(1.,.36,.14);
vec3 env(vec3 r){
  r.xz*=rot(uTime*.06);
  vec3 col=vec3(.004)+vec3(.03)*smoothstep(-.2,1.,r.y);
  col+=vec3(1.)*smoothstep(.5,.56,r.y)*smoothstep(.75,.5,abs(r.x))*2.6;
  col+=vec3(1.)*smoothstep(.06,.0,abs(r.x-.74))*smoothstep(.95,.25,abs(r.y))*2.4;
  col+=vec3(.92,.95,1.)*smoothstep(.04,.0,abs(r.x+.66))*smoothstep(.95,.25,abs(r.y))*1.8;
  col+=vec3(1.)*smoothstep(.025,.0,abs(r.x+.2))*smoothstep(.6,.1,abs(r.y-.1))*.9;
  col+=vec3(1.)*smoothstep(.02,.0,abs(r.y+.12))*smoothstep(.9,.4,abs(r.x))*.8;
  col+=ACC*pow(max(0.,dot(r,normalize(vec3(-1.,-.3,.3)))),6.)*1.5;
  col+=vec3(.5,.62,1.)*pow(max(0.,dot(r,normalize(vec3(.9,.45,-.6)))),7.)*.55;
  col+=vec3(.06)*smoothstep(-.2,-1.,r.y);
  return col;
}
vec3 sky(vec2 uv,vec3 rd){
  vec3 col=vec3(.01,.01,.012);
  vec2 c=uv-OFF().xy*vec2(.36,.3);
  col+=vec3(.075,.075,.085)*exp(-dot(c,c)*2.2);
  float n=fbm(uv*1.7+vec2(uTime*.018,uScroll*.25));
  col+=vec3(.028)*n*n;
  col+=ACC*.03*exp(-dot(uv-vec2(-.95,-.55),uv-vec2(-.95,-.55))*2.5);
  return col;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=vec3(0.,0.,4.2);
  vec3 rd=normalize(vec3(uv,-1.55));
  float ay=uMouse.x*.18,ax=-uMouse.y*.12;
  ro.yz*=rot(ax);rd.yz*=rot(ax);ro.xz*=rot(ay);rd.xz*=rot(ay);
  vec3 col=sky(uv,rd);
  float t=0.,d=1.,glow=0.;vec3 p;bool hit=false;
  for(int i=0;i<88;i++){
    p=ro+rd*t;d=map(p);
    glow+=exp(-d*6.)*.018;
    if(d<.0012){hit=true;break;}
    t+=d*.88;if(t>11.)break;
  }
  col+=vec3(.85,.88,.95)*glow*.1+ACC*glow*uPulse*1.6;
  if(hit){
    vec3 n=nrm(p),v=-rd,r=reflect(rd,n);
    float fres=pow(1.-max(dot(n,v),0.),3.);
    vec3 film=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.8+dot(n,vec3(.2,.5,.1))*.3+.15));
    vec3 tint=mix(vec3(.93,.95,1.),film,.12+fres*.4);
    vec3 c=env(r)*tint;
    c+=vec3(.9,.93,1.)*fres*.12;
    vec3 L=normalize(vec3(.6,.85,.55));
    c+=pow(max(dot(r,L),0.),90.)*2.2;
    float ao=clamp(map(p+n*.18)/.18,0.,1.);
    c*=.45+.55*ao;
    col=mix(col,c,uIntro);
  }
  col*=mix(1.,.42,smoothstep(.2,1.6,uScroll));
  col=1.-exp(-col*1.45);
  col=pow(col,vec3(.9));
  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.025;
  gl_FragColor=vec4(col,1.);
}`;

  function sh(type, src){
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(pr)); APP.glOK=false; return; }
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uRes','uTime','uMouse','uScroll','uPulse','uIntro'].forEach(n => U[n] = gl.getUniformLocation(pr, n));

  const dpr = Math.min(devicePixelRatio || 1, 2);
  let scale = Math.min(dpr, 1) * .85, maxScale = Math.min(dpr, 1.35), minScale = .35;
  function resize(){
    cv.width = Math.round(innerWidth * scale); cv.height = Math.round(innerHeight * scale);
    gl.viewport(0, 0, cv.width, cv.height);
  }
  resize(); addEventListener('resize', resize);

  const covers = [...document.querySelectorAll('.morph,.waves,.stick,.stack,.globe-sec,.systems')];
  let sm = {x:0, y:0}, intro = 0, t0 = performance.now(), last = t0, acc = 0, frames = 0, ft = 16;
  function frame(now){
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, 100); last = now;
    ft += (dt - ft) * .05; frames++; acc += dt;
    if(acc > 500){ APP.fps = Math.round(1000 * frames / acc); frames = 0; acc = 0; }
    // adaptive resolution
    if(frames === 0){
      if(ft > 24 && scale > minScale){ scale = Math.max(minScale, scale * .85); resize(); }
      else if(ft < 15 && scale < maxScale){ scale = Math.min(maxScale, scale * 1.06); resize(); }
    }
    // skip when an opaque section covers the screen
    const H = innerHeight;
    for(const c of covers){ const r = c.getBoundingClientRect(); if(r.top <= 0 && r.bottom >= H) return; }

    const t = (now - t0) / 1000;
    let tx = APP.mx, ty = APP.my;
    if(now - APP.lastMove > 3500){ tx = Math.sin(t * .7) * .55; ty = Math.sin(t * 1.1) * .3; }
    sm.x += (tx - sm.x) * .07; sm.y += (ty - sm.y) * .07;
    if(APP.ready) intro += (1 - intro) * .025;
    APP.pulse *= .965;

    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform1f(U.uTime, t);
    gl.uniform2f(U.uMouse, sm.x, sm.y);
    gl.uniform1f(U.uScroll, APP.scroll / H);
    gl.uniform1f(U.uPulse, APP.pulse);
    gl.uniform1f(U.uIntro, intro);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
})();
