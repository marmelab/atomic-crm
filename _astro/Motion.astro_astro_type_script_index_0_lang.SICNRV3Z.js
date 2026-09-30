const M=`
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`,P=`
  precision mediump float;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec2 uMouse;

  float blob(vec2 p, vec2 c, float r) {
    float d = length(p - c);
    return exp(-d * d / (r * r));
  }

  void main() {
    float a = uRes.x / uRes.y;
    vec2 p = gl_FragCoord.xy / uRes;
    p.x *= a;
    float t = uTime * 0.08;
    // slow domain warp for a liquid feel
    p += 0.035 * vec2(sin(p.y * 5.0 + t * 3.0), cos(p.x * 4.0 + t * 2.5));

    vec2 c1 = vec2(a * (0.22 + 0.10 * sin(t * 1.3)), 0.85 + 0.08 * cos(t * 1.7));
    vec2 c2 = vec2(a * (0.80 + 0.12 * cos(t * 1.1)), 0.30 + 0.10 * sin(t * 1.9));
    vec2 c3 = vec2(a * (0.55 + 0.20 * sin(t * 0.9)), 0.55 + 0.14 * sin(t * 1.2));
    vec2 m = vec2(uMouse.x * a, uMouse.y);

    float b1 = blob(p, c1, 0.45);
    float b2 = blob(p, c2, 0.40);
    float b3 = blob(p, c3, 0.30);
    float bm = blob(p, m, 0.22) * 0.6;

    vec3 pink = vec3(255.0, 128.0, 181.0) / 255.0;
    vec3 violet = vec3(144.0, 137.0, 252.0) / 255.0;
    float w = b1 + b2 + b3 + bm;
    vec3 col = (pink * b1 + violet * (b2 + bm) + mix(pink, violet, 0.5) * b3) / max(w, 1e-3);
    float alpha = clamp((b1 + b2 + b3) * 0.3 + bm, 0.0, 1.0) * 0.45;
    // dithering to avoid gradient banding
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    alpha = clamp(alpha + (n - 0.5) * 0.015, 0.0, 1.0);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`,T=t=>{const i=t.getExtension("WEBGL_debug_renderer_info"),o=i?t.getParameter(i.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER);return/swiftshader|llvmpipe|software|basic render/i.test(String(o))};function C(){const t=document.getElementById("hero-shader");if(!t||!matchMedia("(min-width: 64rem)").matches)return;const i=t.getContext("webgl",{antialias:!1,premultipliedAlpha:!0});if(!i||T(i))return;const o=i,c=(u,h)=>{const g=o.createShader(u);return o.shaderSource(g,h),o.compileShader(g),g},e=o.createProgram();o.attachShader(e,c(o.VERTEX_SHADER,M)),o.attachShader(e,c(o.FRAGMENT_SHADER,P)),o.linkProgram(e),o.useProgram(e),o.bindBuffer(o.ARRAY_BUFFER,o.createBuffer()),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),o.STATIC_DRAW);const n=o.getAttribLocation(e,"position");o.enableVertexAttribArray(n),o.vertexAttribPointer(n,2,o.FLOAT,!1,0,0);const r=o.getUniformLocation(e,"uRes"),a=o.getUniformLocation(e,"uTime"),s=o.getUniformLocation(e,"uMouse"),l=()=>{t.width=Math.max(1,Math.round(t.clientWidth*.5)),t.height=Math.max(1,Math.round(t.clientHeight*.5)),o.viewport(0,0,t.width,t.height),o.uniform2f(r,t.width,t.height)};l(),new ResizeObserver(l).observe(t);const m={x:.5,y:.6},d={...m};addEventListener("pointermove",u=>{const h=t.getBoundingClientRect();d.x=(u.clientX-h.left)/h.width,d.y=1-(u.clientY-h.top)/h.height});let v=!0,f=0;const p=performance.now(),x=u=>{m.x+=(d.x-m.x)*.04,m.y+=(d.y-m.y)*.04,o.uniform1f(a,(u-p)/1e3),o.uniform2f(s,m.x,m.y),o.drawArrays(o.TRIANGLES,0,3),t.style.opacity="1",t.parentElement?.classList.add("mm-shader"),f=v?requestAnimationFrame(x):0};new IntersectionObserver(([u])=>{v=!!u?.isIntersecting,v&&!f&&(f=requestAnimationFrame(x))}).observe(t)}const L=`
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = 0.5 + position * 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`,U=`
  precision highp float;
  uniform sampler2D map;
  uniform vec2 texSize, origin;
  uniform vec3 lineCol, paperCol;
  uniform float reveal, ink;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
  vec4 tap(vec2 uv, float b) { return texture2D(map, uv, b); }
  float lumA(vec4 c) { vec3 rgb = c.rgb / max(c.a, 1e-3); return mix(1.0, dot(rgb, vec3(0.299, 0.587, 0.114)), c.a); }

  void main() {
    vec2 px = 1.0 / texSize;
    vec2 o = px * 0.8;
    vec4 col = tap(vUv, 0.0);
    vec4 around = (tap(vUv + o, 0.0) + tap(vUv - o, 0.0) + tap(vUv + vec2(o.x, -o.y), 0.0) + tap(vUv + vec2(-o.x, o.y), 0.0)) / 4.0;
    // light sharpening while painting, gone at the end so the handoff to the real image is seamless
    col = clamp(col + (col - around) * 0.3 * (1.0 - reveal), 0.0, 1.0);
    vec4 paint = vec4(min(col.rgb, vec3(col.a)), col.a);

    if (reveal >= 1.0) { gl_FragColor = paint; return; }

    // Pencil: wobbly outlines + cross-hatching
    vec2 p = vUv * texSize;
    vec2 w = (vec2(noise(p * 0.05), noise(p * 0.05 + 7.0)) - 0.5) * px * 2.0;
    const float COARSE = 0.0;
    vec2 s = px;
    float tl = lumA(tap(vUv + w + vec2(-s.x, s.y), COARSE)), t = lumA(tap(vUv + w + vec2(0, s.y), COARSE)), tr = lumA(tap(vUv + w + s, COARSE));
    float l = lumA(tap(vUv + w - vec2(s.x, 0), COARSE)), r = lumA(tap(vUv + w + vec2(s.x, 0), COARSE));
    float bl = lumA(tap(vUv + w - s, COARSE)), b = lumA(tap(vUv + w - vec2(0, s.y), COARSE)), br = lumA(tap(vUv + w + vec2(s.x, -s.y), COARSE));
    float strong = smoothstep(0.08, 0.26, length(vec2(-tl - 2.0 * l - bl + tr + 2.0 * r + br, -bl - 2.0 * b - br + tl + 2.0 * t + tr)));
    // Keep only the thin dark side of each strong edge: one line instead of Sobel's double stroke
    float thin = smoothstep(0.004, 0.02, lumA(tap(vUv + w, 1.0)) - lumA(tap(vUv + w, 0.0)));
    float line = min(1.0, strong * thin * 1.8);
    float dark = (1.0 - lumA(tap(vUv, COARSE))) * col.a;
    float h1 = 1.0 - smoothstep(0.0, 0.18, abs(fract((p.x + p.y) / 7.0) - 0.5) * 2.0);
    float h2 = 1.0 - smoothstep(0.0, 0.18, abs(fract((p.x - p.y) / 7.0) - 0.5) * 2.0);
    float hatch = (h1 * smoothstep(0.5, 0.85, dark) + h2 * smoothstep(0.75, 1.0, dark)) * 0.1 * (0.3 + 0.7 * noise(p * 0.04));
    float pencil = clamp(line + hatch * 0.45, 0.0, 1.0) * ink * (0.75 + 0.25 * noise(p * 0.35));
    float fill = col.a * (1.0 - pencil);
    vec4 sketch = vec4(paperCol * fill + lineCol * pencil, fill + pencil);

    // Watercolour reveal spreading from origin, darker at the wet edge
    float n = distance(vUv, origin) * 1.2 + (fbm(vUv * 5.0) - 0.5) * 0.5;
    float rr = reveal * 1.9 - 0.3;
    float m = 1.0 - smoothstep(rr - 0.1, rr, n);
    float wet = smoothstep(rr - 0.1, rr - 0.03, n) * m;
    paint.rgb *= 1.0 - 0.2 * wet;
    gl_FragColor = mix(sketch, paint, m);
  }
`,I=t=>t<.5?4*t**3:1-(-2*t+2)**3/2,S=(t,i)=>new Promise(o=>{const c=performance.now(),e=n=>{const r=Math.min(Math.max((n-c)/t,0),1);i(I(r)),r<1?requestAnimationFrame(e):o()};requestAnimationFrame(e)}),_=(t,i,o)=>{const c=t.createShader(i);return t.shaderSource(c,o),t.compileShader(c),c},F=t=>{const i=t.getExtension("WEBGL_debug_renderer_info"),o=i?t.getParameter(i.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER);return/swiftshader|llvmpipe|software|basic render/i.test(String(o))},D=async(t,i)=>{await i.decode();const o=document.createElement("canvas");o.setAttribute("aria-hidden","true");const c=Math.min(devicePixelRatio,2);o.width=Math.round(i.clientWidth*c),o.height=Math.round(i.clientHeight*c);const e=o.getContext("webgl2",{premultipliedAlpha:!0}),n=e.createProgram();e.attachShader(n,_(e,e.VERTEX_SHADER,L)),e.attachShader(n,_(e,e.FRAGMENT_SHADER,U)),e.linkProgram(n),e.useProgram(n),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW);const r=e.getAttribLocation(n,"position");e.enableVertexAttribArray(r),e.vertexAttribPointer(r,2,e.FLOAT,!1,0,0),e.bindTexture(e.TEXTURE_2D,e.createTexture()),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!0),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,i),e.generateMipmap(e.TEXTURE_2D),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const a=l=>e.getUniformLocation(n,l);e.uniform2f(a("texSize"),i.naturalWidth,i.naturalHeight),e.uniform2f(a("origin"),.15,.85),e.uniform3f(a("lineCol"),30/255,41/255,59/255),e.uniform3f(a("paperCol"),1,1,1),e.viewport(0,0,o.width,o.height);const s=(l,m)=>{e.uniform1f(a(l),m),e.drawArrays(e.TRIANGLE_STRIP,0,4)};return s("reveal",0),t.append(o),await S(600,l=>s("ink",l)),{paint:()=>S(700,l=>s("reveal",l)),destroy:()=>{e.getExtension("WEBGL_lose_context")?.loseContext(),o.remove()}}};let R;const B=()=>{if(R===void 0){const t=document.createElement("canvas").getContext("webgl2");R=!!t&&!F(t),t?.getExtension("WEBGL_lose_context")?.loseContext()}return R};function q(){const t=new IntersectionObserver(i=>{t.disconnect();for(const o of i){const c=o.target.querySelector("img");c&&!o.isIntersecting&&k(o.target,c)}});document.querySelectorAll("[data-sketch]").forEach(i=>t.observe(i))}const k=(t,i)=>{t.classList.add("mm-sketch-pending");const o=()=>t.classList.remove("mm-sketch-pending");let c;const e=()=>(c??=B()?D(t,i):Promise.reject(),c.catch(o),c),n=new IntersectionObserver(([a])=>{a?.isIntersecting&&(n.disconnect(),e())},{rootMargin:"0px 0px 25% 0px"}),r=new IntersectionObserver(([a])=>{a?.isIntersecting&&(r.disconnect(),e().then(async s=>{await new Promise(l=>setTimeout(l,200)),await s.paint(),o(),s.destroy()}).catch(o))},{rootMargin:"0px 0px -15% 0px"});n.observe(t),r.observe(t)},A=matchMedia("(prefers-reduced-motion: reduce)").matches,O=matchMedia("(hover: hover) and (pointer: fine)").matches;if(!A){const t=new IntersectionObserver(n=>{let r=0;for(const a of n){if(!a.isIntersecting)continue;const s=a.target;e(s),s.style.setProperty("--mm-i",String(r++)),s.classList.add("mm-in"),t.unobserve(s)}},{rootMargin:"0px 0px -15% 0px"}),i=String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?`,o=new RegExp(String.raw`^[Mm][\s,]*(${i})[\s,]*(${i})[\s,]*`,"i"),c=n=>{let r=0,a=0;return(n.getAttribute("d").match(/[Mm][^Mm]*/g)??[]).map(s=>{const[,l,m]=s.match(o).map(Number),[d,v]=s[0]==="m"?[r+l,a+m]:[l,m];let f=s.replace(o,"");/^[-.\d]/.test(f)&&(f=(s[0]==="m"?"l":"L")+f);const p=n.cloneNode();return p.setAttribute("d",`M${d} ${v}${f}`),n.before(p),{x:r,y:a}=p.getPointAtLength(p.getTotalLength()),p.setAttribute("pathLength","1"),p})},e=n=>{n.querySelectorAll(".mm-draw path:not([pathLength])").forEach(r=>{c(r),r.remove()}),n.querySelectorAll(".mm-trace path:not(.mm-trace-line)").forEach(r=>{r.previousElementSibling?.classList.contains("mm-trace-line")||c(r).forEach(a=>a.classList.add("mm-trace-line"))})};document.querySelectorAll("[data-reveal], [data-reveal-stagger] > *").forEach(n=>t.observe(n)),addEventListener("pointermove",C,{once:!0,passive:!0}),q()}const y=document.querySelector("[data-kanban]"),b=y?.querySelector(".mm-kanban-deal");if(!A&&y&&b){const t=[...y.querySelectorAll("[data-kanban-slot]")],i=new Intl.NumberFormat(document.documentElement.lang,{style:"currency",currency:"USD",currencyDisplay:"narrowSymbol",maximumFractionDigits:0}),o=()=>y.querySelectorAll("[data-kanban-column]").forEach(r=>{const a=r.querySelectorAll("[data-amount]"),s=[...a].reduce((l,m)=>l+Number(m.dataset.amount),0);r.querySelector("[data-kanban-count]").textContent=String(a.length),r.querySelector("[data-kanban-total]").textContent=i.format(s)}),c=r=>{if(b.parentElement===t[r])return;const a=[...y.querySelectorAll("[data-amount]")].filter(l=>l!==b),s=a.map(l=>l.getBoundingClientRect().top);t[r].prepend(b),o(),a.forEach((l,m)=>{const d=s[m]-l.getBoundingClientRect().top;d&&l.animate([{translate:`0 ${d}px`},{translate:"0 0"}],{duration:400,easing:"cubic-bezier(0.2, 0.7, 0.2, 1)"})})},e=()=>{const r=y.getBoundingClientRect(),a=(innerHeight*.9-r.top)/(innerHeight*.8),s=Math.min(Math.max(a,0),1)*(t.length-1),l=Math.min(Math.floor(s),t.length-2),m=Math.min(Math.max((s-l-.2)/.6,0),1);return l+m*m*(3-2*m)},n=new IntersectionObserver(([r])=>{if(!r?.isIntersecting)return;n.disconnect();let a=e(),s=0;const l=()=>{const d=e();a+=(d-a)*.15,Math.abs(d-a)<.001&&(a=d),c(Math.round(a));const v=Math.floor(a),f=Math.min(v+1,t.length-1),p=a-v,x=t[v].getBoundingClientRect(),u=t[f].getBoundingClientRect(),h=t[Math.round(a)].getBoundingClientRect(),g=Math.sin(p*Math.PI);b.style.translate=`${x.left+(u.left-x.left)*p-h.left}px ${x.top+(u.top-x.top)*p-h.top-g*12}px`,b.style.rotate=`${g*3}deg`,b.style.scale=String(1+g*.04),b.classList.toggle("mm-moving",g>.05),s=a===d?0:requestAnimationFrame(l)};o(),l();const m=()=>s||=requestAnimationFrame(l);addEventListener("scroll",m,{passive:!0}),addEventListener("resize",m)},{rootMargin:"100% 0px"});n.observe(y)}const w=document.querySelector("[data-terminal]");if(!A&&w){const t=[...w.querySelectorAll("[data-term-line]")],i=t.map(n=>{const r=n.querySelector("[data-type-text]");if(!r)return;const a=r.textContent??"",s=document.createTextNode(""),l=document.createElement("span");return l.style.visibility="hidden",l.textContent=a,r.replaceChildren(s,l),{text:a,shown:s,rest:l}});t.forEach(n=>n.style.visibility="hidden");const o=document.createElement("span");o.className="mm-caret";const c=n=>new Promise(r=>setTimeout(r,n)),e=async()=>{for(const[n,r]of t.entries()){await c(Number(r.dataset.delay??120)),r.style.visibility="";const a=i[n];if(a){a.shown.after(o),await c(150);for(let s=1;s<=a.text.length;s++)a.shown.data=a.text.slice(0,s),a.rest.textContent=a.text.slice(s),await c(15+Math.random()*30);await c(150),o.remove()}}t.at(-1).append(o)};new IntersectionObserver(([n],r)=>{n?.isIntersecting&&(r.disconnect(),e())},{rootMargin:"0px 0px -30% 0px"}).observe(w)}const N=()=>document.querySelectorAll("iframe[data-src]").forEach(t=>{t.src=t.dataset.src,t.removeAttribute("data-src")});for(const t of["pointermove","pointerdown","scroll","keydown","touchstart"])addEventListener(t,N,{once:!0,passive:!0});const E=(t,i,o=()=>{})=>{let c=null;document.addEventListener("pointermove",e=>{const n=e.target.closest(t);if(c&&c!==n&&o(c),c=n,!n)return;const r=n.getBoundingClientRect();i(n,(e.clientX-r.left)/r.width-.5,(e.clientY-r.top)/r.height-.5)})};if(!A&&O){E("[data-tilt]",(n,r,a)=>{n.style.setProperty("--rx",`${-a*14}deg`),n.style.setProperty("--ry",`${r*14}deg`),n.style.setProperty("--gx",`${(r+.5)*100}%`),n.style.setProperty("--gy",`${(a+.5)*100}%`)},n=>{n.style.removeProperty("--rx"),n.style.removeProperty("--ry")}),E("[data-glow]",(n,r,a)=>{n.style.setProperty("--gx",`${(r+.5)*100}%`),n.style.setProperty("--gy",`${(a+.5)*100}%`)}),E("[data-spotlight]",(n,r,a)=>{n.style.setProperty("--sx",`${(r+.5)*n.offsetWidth}px`),n.style.setProperty("--sy",`${(a+.5)*n.offsetHeight}px`)});const t=[...document.querySelectorAll("[data-proximity] > *")];let i=null,o=0;const c=()=>{o=0;for(const n of t){const r=n.getBoundingClientRect(),a=i?Math.hypot(i.x-(r.left+r.width/2),i.y-(r.top+r.height/2)):1/0,s=Math.min(Math.max(1-a/260,0),1);n.style.setProperty("--near",(s*s*(3-2*s)).toFixed(3))}};t.length&&(document.addEventListener("pointermove",n=>{i={x:n.clientX,y:n.clientY},o||=requestAnimationFrame(c)}),document.documentElement.addEventListener("pointerleave",()=>{i=null,o||=requestAnimationFrame(c)}));const e=(n,r)=>n.animate({translate:r},{duration:600,easing:"cubic-bezier(0.2, 0.7, 0.2, 1)",fill:"forwards"});E("[data-magnetic]",(n,r,a)=>e(n,`${r*Math.min(n.offsetWidth,160)*.15}px ${a*n.offsetHeight*.3}px`),n=>e(n,"0px 0px"))}
