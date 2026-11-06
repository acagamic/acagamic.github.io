/* hx3d.js: three.js scenes for the website: hero particles, the scroll-driven citation network, and the country globe.
   Loads three.js through chain3d.js so the page fetches it once. Each factory returns a Promise of a controller and
   rejects when WebGL or three.js is missing, so the page can fall back to its 2D charts. */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D2R = Math.PI / 180;

  const three = () => new Promise((res, rej) => {
    let ok = false;
    try { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { ok = false; }
    if (!ok || !window.HXChain3D || !window.d3) return rej(new Error('WebGL or three.js unavailable'));
    HXChain3D.withThree(() => res(window.THREE), () => rej(new Error('three.js failed to load')));
  });
  const cssRGB = (el, v) => { const c = d3.rgb(getComputedStyle(el).getPropertyValue(v).trim()); return [c.r / 255, c.g / 255, c.b / 255]; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const easeInOut = x => (x = clamp(x, 0, 1)) < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeBack = x => { x = clamp(x, 0, 1) - 1; return 1 + 2.70158 * x * x * x + 1.70158 * x * x; };

  function makeRenderer(T, canvas, maxDpr) {
    const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setClearColor(0x000000, 0); r.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
    return r;
  }
  // Runs tick(time, dt) every frame while the element is on screen. tick returns false to sleep until kick().
  function animator(el, tick) {
    let vis = false, raf = 0, last = 0;
    const f = now => { raf = 0; const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (tick(now / 1000, dt) !== false && vis) raf = requestAnimationFrame(f); else last = 0; };
    const kick = () => { if (vis && !raf) raf = requestAnimationFrame(f); };
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) kick(); else { cancelAnimationFrame(raf); raf = 0; last = 0; } }).observe(el);
    return kick;
  }
  function points(T, geo, uniforms, vert) {
    const m = new T.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: GLOW, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const p = new T.Points(geo, m); p.frustumCulled = false; return p;
  }
  // Soft glowing disc with a white-hot core, drawn with additive blending.
  const GLOW = `varying vec3 vC; varying float vA;
    void main() { vec2 q = gl_PointCoord * 2. - 1.; float r2 = dot(q, q); if (r2 > 1.) discard;
      float core = smoothstep(.2, 0., r2), glow = exp(-r2 * 5.) * (1. - r2);
      gl_FragColor = vec4(mix(vC, vec3(1.), core * .45), (glow * .8 + core) * vA); }`;
  const LINE_FRAG = `varying vec3 vC; varying float vA; void main() { gl_FragColor = vec4(vC, vA); }`;

  // ---------- Hero: one particle per citing paper spirals in and lands on a hexagonal Möbius band, Escher-style. Face-on it
  // reads as the Hexad; then the ring tilts and spins in 3D while its three half-twists roll around the band.
  // Shared GLSL: band(s, w) maps a spot along the ring (s in 0..1) and across it (w in -1..1) to 3D.
  const BAND = `uniform float uRoll, uWave;
    vec2 hv(float k) { float a = 1.5707963 + k * 1.0471976; return vec2(cos(a), sin(a)); }
    vec3 band(float s, float w) {
      float f = fract(s) * 6., k = floor(f); vec2 c = mix(hv(k), hv(k + 1.), f - k);  // point on the hexagon
      float ph = uRoll + 4.712389 * s + uWave * sin(12.566371 * s - uRoll * 2.);  // three half-twists, plus a travelling ripple
      vec3 r = vec3(normalize(c), 0.);
      return vec3(c, 0.) + (r * cos(ph) + vec3(0., 0., 1.) * sin(ph)) * w * .24;
    }`;
  async function hero(canvas, data) {
    const T = await three(), host = canvas.parentElement;
    const R = makeRenderer(T, canvas, 2), scene = new T.Scene(), cam = new T.PerspectiveCamera(35, 1, 0.1, 100), DIST = 6;
    cam.position.set(0, 0, DIST);
    const ramp = d3.scaleLinear([2016, 2021, 2026], ['--brand-cyan', '--brand-pink', '--brand-magenta'].map(v => getComputedStyle(host).getPropertyValue(v).trim()))
      .interpolate(d3.interpolateRgb).clamp(true);
    const rnd = d3.randomLcg(11), N = data.nodes.length, ROWS = 4;
    const pos = new Float32Array(N * 3), st = new Float32Array(N * 3), col = new Float32Array(N * 3), misc = new Float32Array(N * 4);
    data.nodes.forEach(([, , y, c], i) => {
      // papers run around the ring in date order, in three rows across the band
      pos.set([(Math.floor(i / ROWS) + rnd() * 0.6) / Math.ceil(N / ROWS), (i % ROWS) / (ROWS - 1) * 2 - 1 + (rnd() - 0.5) * 0.15, 0], i * 3);
      const th = rnd() * Math.PI * 2, rr = 1.6 + rnd() * 2.4;  // start: a wide disc facing the camera, spun in by the vortex
      st.set([Math.cos(th) * rr, Math.sin(th) * rr, (rnd() - 0.5) * 0.8], i * 3);
      const cc = d3.rgb(ramp(y)); col.set([cc.r / 255, cc.g / 255, cc.b / 255], i * 3);
      misc.set([i / N, (1.8 + Math.min(5.5, Math.sqrt(c) * 0.26)) * 4.4, rnd() * 6.283, 0.6 + rnd() * 0.8], i * 4);
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aStart', new T.BufferAttribute(st, 3));
    geo.setAttribute('aCol', new T.BufferAttribute(col, 3)); geo.setAttribute('aMisc', new T.BufferAttribute(misc, 4));
    const U = { uT: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uDist: { value: DIST }, uScatter: { value: 0 }, uMouse: { value: new T.Vector3(9, 9, 0) }, uMouseOn: { value: 0 },
      uRoll: { value: 0 }, uWave: { value: 0 } };
    const pts = points(T, geo, U, `attribute vec3 aStart; attribute vec3 aCol; attribute vec4 aMisc;
      uniform float uT, uTime, uPx, uDist, uScatter, uMouseOn; uniform vec3 uMouse; varying vec3 vC; varying float vA; ${BAND}
      vec3 spin(vec3 v, float a) { return vec3(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a), v.z); }
      void main() {
        float e = clamp((uT - aMisc.x * 1.3) / (1.6 * aMisc.w + .6), 0., 1.); e = 1. - pow(1. - e, 3.);
        e *= 1. - uScatter * (.55 + .45 * fract(aMisc.z * 7.13));  // scrolling down flings each dot back out at its own pace
        vec3 p = spin(mix(aStart, band(position.x, position.y), e), (1. - e) * (1. - e) * 7.5);  // the vortex: dots swirl as they fall in
        p += vec3(sin(uTime * .6 + aMisc.z), cos(uTime * .5 + aMisc.z * 1.3), sin(uTime * .4 + aMisc.z * .7)) * .012 * e;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vec2 d = mv.xy - uMouse.xy; float dd = dot(d, d);
        mv.xy += normalize(d + 1e-5) * uMouseOn * .2 * exp(-dd * 9.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aMisc.y * uPx * uDist / -mv.z;
        vC = aCol; vA = (.35 + .65 * e) * (1. - .45 * uScatter);
      }`);
    // faint rims sharpen the band once the dots have landed. With an odd number of half-twists the band has a single edge
    // that runs round twice, so one loop over s in 0..2 draws it.
    const EN = 360, ep = new Float32Array(EN * 3); for (let i = 0; i < EN; i++) ep.set([i / EN * 2, 1, 0], i * 3);
    const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(ep, 3));
    const EU = { uEdge: { value: 0 }, uC: { value: new T.Vector3(...cssRGB(host, '--brand-pink')) }, uRoll: U.uRoll, uWave: U.uWave };
    const edges = new T.LineLoop(eg, new T.ShaderMaterial({ uniforms: EU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fragmentShader: LINE_FRAG,
      vertexShader: `uniform float uEdge; uniform vec3 uC; varying vec3 vC; varying float vA; ${BAND}
        void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(band(position.x, position.y), 1.); vC = uC; vA = uEdge; }` }));
    const g = new T.Group(); g.add(edges, pts); scene.add(g);

    // Aurora: slow fbm noise in cyan and magenta behind the particles, strongest around the ring and faint behind the text.
    const AU = { uTime: U.uTime, uScatter: U.uScatter, uC: { value: new T.Vector2(0.74, 0.5) }, uAsp: { value: 1 },
      uA: { value: new T.Vector3(...cssRGB(host, '--brand-cyan')) }, uB: { value: new T.Vector3(...cssRGB(host, '--brand-magenta')) } };
    const bgScene = new T.Scene(), bgCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bgScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: AU, transparent: true, depthWrite: false, depthTest: false,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `uniform float uTime, uScatter, uAsp; uniform vec2 uC; uniform vec3 uA, uB; varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.03 + 7.1; a *= .5; } return v; }
        void main() {
          vec2 p = vec2(vUv.x * uAsp, vUv.y), c = vec2(uC.x * uAsp, uC.y);
          float t = uTime * .045, q = fbm(p * 2.2 + vec2(t, -t * .7)), r = fbm(p * 3.1 + q * 1.8 - vec2(t * .6, t));
          float d = length(p - c), fall = exp(-d * d * 3.2) * (1. - .7 * uScatter);
          vec3 col = mix(uA, uB, smoothstep(.3, .75, r));
          gl_FragColor = vec4(col, smoothstep(.35, .85, r) * fall * .22);
        }` })));
    R.autoClear = false;

    let W = 1, H = 1;
    function size() {
      const b = canvas.getBoundingClientRect(); W = b.width || 1; H = b.height || 1;
      R.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
      const perPx = 2 * Math.tan(cam.fov * D2R / 2) * DIST / H, wide = W > 900;
      const cx = wide ? W * 0.74 : W / 2, cy = wide ? H * 0.5 : 150, Rp = wide ? Math.min(H * 0.29, W * 0.16) : Math.min(W * 0.22, 88);  // phones: the ring gets its own band above the text
      g.position.set((cx - W / 2) * perPx, -(cy - H / 2) * perPx, 0); g.scale.setScalar(Rp * perPx);
      AU.uAsp.value = W / H; AU.uC.value.set(cx / W, 1 - cy / H);
      U.uPx.value = R.getPixelRatio() * (wide ? 1 : 0.5);
      kick();
    }
    let mOnT = 0, px = 0, py = 0, rx = 0, ry = 0, t0 = -1, scatter = 0;
    const mTarget = new T.Vector3(9, 9, 0);
    host.addEventListener('pointermove', e => { const b = canvas.getBoundingClientRect(); px = (e.clientX - b.left) / b.width * 2 - 1; py = -(e.clientY - b.top) / b.height * 2 + 1;
      // pointer in view space at the ring's depth, for the push-aside effect
      const hh = Math.tan(cam.fov * D2R / 2) * DIST; mTarget.set(px * hh * cam.aspect, py * hh, 0); mOnT = 1; kick(); });
    host.addEventListener('pointerleave', () => { mOnT = 0; px = py = 0; kick(); });
    const kick = animator(canvas, (time, dt) => {
      if (t0 < 0) t0 = time;
      const el = time - t0, k = reduced ? 1 : 1 - Math.exp(-dt * 4);
      U.uT.value = reduced ? 100 : el; U.uTime.value = reduced ? 0 : time; U.uScatter.value = scatter;
      // hold the face-on hexagon until the dots land, then tilt and spin the ring while the twists roll round the band
      const u = reduced ? 0 : Math.max(0, el - 3.4), on = u > 0 ? Math.min(1, u / 2.5) : 0, ease = on * on * (3 - 2 * on);
      ry += (px * 0.25 - ry) * k; rx += (-py * 0.18 - rx) * k;
      U.uRoll.value = ease * u * 0.55; U.uWave.value = ease * 0.45;
      g.rotation.set(-ease * (0.62 + 0.22 * Math.sin(u * 0.29)) + rx + scatter * 0.6, ease * 0.5 * Math.sin(u * 0.23) + ry, ease * u * 0.16, 'XYZ');
      EU.uEdge.value = 0.22 * Math.min(1, Math.max(0, (el - 2.6) / 1.2)) * (1 - scatter) + (reduced ? 0.22 : 0);
      U.uMouse.value.lerp(mTarget, reduced ? 1 : 1 - Math.exp(-dt * 12));  // the camera has no rotation, so view xy equals world xy
      U.uMouseOn.value += (mOnT - U.uMouseOn.value) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
      R.clear(); R.render(bgScene, bgCam); R.render(scene, cam);
      return !reduced;
    });
    size(); new ResizeObserver(size).observe(canvas);
    return {
      replay() { t0 = -1; kick(); },
      scatter(v) { v = clamp(v, 0, 1); if (v !== scatter) { scatter = v; kick(); } },
    };
  }

  // ---------- Network: the 2D radial map in depth. The Hexad scale paper floats on top, the 594 direct citers form the
  // middle ring, and the 6,870 papers citing those sit on a lower layer, joined to their parents by faint threads.
  async function network(canvas, data, { shift = () => 0 } = {}) {
    const T = await three(), host = canvas.parentElement;
    const R = makeRenderer(T, canvas, 1.75), scene = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.1, 200);
    const C1 = cssRGB(host, '--series-1'), C2 = cssRGB(host, '--series-2'), C0 = cssRGB(host, '--ink'), CG = cssRGB(host, '--muted');
    const rand = d3.randomLcg(42), Z0 = 1.4, Z2 = -2.4;
    const { nodes, d2 } = data, N = nodes.length, span = Math.PI * 2 * 0.94, a0 = -Math.PI / 2 + Math.PI * 0.03;
    // Same layout as the 2D map (viz.js Net.build), in units of 100 px, mirrored so time still runs clockwise with y up.
    const d1 = nodes.map(([, , y, c], i) => { const ang = a0 + (i + 0.5) / N * span, rad = (300 + ((i * 7) % 6) * 13) / 100;
      return { y, c, ang, x: Math.cos(ang) * rad, yy: -Math.sin(ang) * rad, z: (rand() - 0.5) * 0.25, r: 1.6 + Math.sqrt(c) * 0.38 }; });
    d3.groups(d1, n => n.y).forEach(([y, v]) => v.forEach((n, i) => { n.yf = y + i / v.length; }));
    const r2 = d2.map(([, , y, c, ps]) => { const par = ps.map(p => d1[p]);
      const ang = Math.atan2(d3.mean(par, p => Math.sin(p.ang)), d3.mean(par, p => Math.cos(p.ang))) + (rand() - 0.5) * 0.03, rad = (540 + rand() * 200) / 100;
      return { y, c, par, x: Math.cos(ang) * rad, yy: -Math.sin(ang) * rad, z: Z2 + (rand() - 0.5) * 0.6, r: 0.9 + Math.min(9, Math.sqrt(c) * 0.22), yf: y + rand() }; });

    const STAR = [1, 0.9, 0.97];
    const all = [{ x: 0, yy: 0, z: Z0, r: 16, deg: 0, yf: 0, col: C0 }].concat(d1.map(n => Object.assign(n, { deg: 1, col: C1 })),
      r2.map(n => { const k = rand() * 0.4; return Object.assign(n, { deg: 2, col: C2.map((c, i) => c + (STAR[i] - c) * k) }); }));  // ring 2 varies a little toward white, like a star field
    const M = all.length, pos = new Float32Array(M * 3), col = new Float32Array(M * 3), info = new Float32Array(M * 4);
    all.forEach((n, i) => { pos.set([n.x, n.yy, n.z], i * 3); col.set(n.col, i * 3); info.set([n.deg, n.yf, n.r * 0.044, rand() * 6.283], i * 4); });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new T.BufferAttribute(col, 3)); geo.setAttribute('aInfo', new T.BufferAttribute(info, 4));
    const U = { uT: { value: 2016 }, uT2: { value: 2016 }, uRing2: { value: 0 }, uScale: { value: 1 }, uTime: { value: 0 }, uTwist: { value: 0 }, uSizeK: { value: 1 } };
    // show(): when a paper has appeared. tw(): the galaxy twist; outer papers turn further, so the rings wind into spiral arms
    // while each paper keeps its place in time within its ring.
    const SHOW = `uniform float uTwist;
      float show(float deg, float yf) { return deg < .5 ? 1. : deg < 1.5 ? clamp((uT - yf) / .3, 0., 1.) : clamp((uT2 - yf) / .3, 0., 1.) * uRing2; }
      vec3 tw(vec3 p) { float a = uTwist * max(0., length(p.xy) - 3.) * .45, c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }`;
    const pts = points(T, geo, U, `attribute vec3 aCol; attribute vec4 aInfo; uniform float uT, uT2, uRing2, uScale, uTime, uSizeK; varying vec3 vC; varying float vA; ${SHOW}
      void main() {
        float s = show(aInfo.x, aInfo.y);
        if (s <= 0.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
        float x = s - 1., pop = 1. + 2.70158 * x * x * x + 1.70158 * x * x;  // ease-out-back: each dot overshoots, then settles
        vec4 mv = modelViewMatrix * vec4(tw(position), 1.);
        gl_Position = projectionMatrix * mv;
        float pulse = aInfo.x < .5 ? 1. + .08 * sin(uTime * 2.2) : 1.;
        gl_PointSize = clamp(aInfo.z * pop * pulse * uSizeK * uScale / -mv.z, 1.5, 90.);
        vC = aCol * (1. + 1.6 * (1. - s));
        vA = (.85 + .15 * sin(uTime * 1.7 + aInfo.w)) * (aInfo.x > 1.5 ? .75 : 1.);
      }`);

    // Threads: spokes from the centre to ring 1, and from each ring-2 paper to the papers it cites. They grow outward as dots appear.
    const segs = [];
    d1.forEach(n => segs.push([all[0], n, 1, n.yf]));
    r2.forEach(n => n.par.forEach(p => segs.push([p, n, 2, n.yf])));
    const S = segs.length, lp = new Float32Array(S * 6), lf = new Float32Array(S * 6), lc = new Float32Array(S * 6), le = new Float32Array(S * 4);
    segs.forEach(([a, b, deg, yf], i) => {
      lp.set([a.x, a.yy, a.z, b.x, b.yy, b.z], i * 6); lf.set([a.x, a.yy, a.z, a.x, a.yy, a.z], i * 6);
      lc.set(a.col.concat(b.col), i * 6); le.set([deg, yf, deg, yf], i * 4);
    });
    const lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.BufferAttribute(lp, 3)); lg.setAttribute('aFrom', new T.BufferAttribute(lf, 3));
    lg.setAttribute('aCol', new T.BufferAttribute(lc, 3)); lg.setAttribute('aE', new T.BufferAttribute(le, 2));
    const lines = new T.LineSegments(lg, new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fragmentShader: LINE_FRAG,
      vertexShader: `attribute vec3 aFrom; attribute vec3 aCol; attribute vec2 aE; uniform float uT, uT2, uRing2; varying vec3 vC; varying float vA; ${SHOW}
        void main() { float s = show(aE.x, aE.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(tw(mix(aFrom, position, s)), 1.);
          vC = aCol; vA = s * (aE.x < 1.5 ? .12 : .035); }` }));
    lines.frustumCulled = false;

    // The clock: a faint arc just outside ring 1 that grows with time, with a bright head at the current date.
    const AR = 3.95, AN = 360, ap = new Float32Array(AN * 6), ae = new Float32Array(AN * 4), ac = new Float32Array(AN * 6);
    const yfAt = u => { const i = clamp(u * N - 0.5, 0, N - 1), j = Math.floor(i), f = i - j; return d1[j].yf + (j + 1 < N ? (d1[j + 1].yf - d1[j].yf) * f : 0); };
    const arcPt = u => { const a = a0 + u * span; return [Math.cos(a) * AR, -Math.sin(a) * AR, 0]; };
    for (let i = 0; i < AN; i++) { const u0 = i / AN, u1 = (i + 1) / AN;
      ap.set(arcPt(u0).concat(arcPt(u1)), i * 6); ae.set([1, yfAt(u0), 1, yfAt(u1)], i * 4); ac.set(CG.concat(CG), i * 6); }
    const agm = new T.BufferGeometry();
    agm.setAttribute('position', new T.BufferAttribute(ap, 3)); agm.setAttribute('aFrom', new T.BufferAttribute(ap, 3));
    agm.setAttribute('aCol', new T.BufferAttribute(ac, 3)); agm.setAttribute('aE', new T.BufferAttribute(ae, 2));
    const clock = new T.LineSegments(agm, new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fragmentShader: LINE_FRAG,
      vertexShader: `attribute vec3 aFrom; attribute vec3 aCol; attribute vec2 aE; uniform float uT, uT2, uRing2; varying vec3 vC; varying float vA; ${SHOW}
        void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(tw(position), 1.); vC = aCol; vA = .45 * step(aE.y, uT); }` }));
    clock.frustumCulled = false;
    const hg = new T.BufferGeometry();
    hg.setAttribute('position', new T.BufferAttribute(new Float32Array(3), 3)); hg.setAttribute('aCol', new T.BufferAttribute(new Float32Array([1, 1, 1]), 3));
    const HU = { uScale: U.uScale, uOn: { value: 0 } };
    const head = points(T, hg, HU, `attribute vec3 aCol; uniform float uScale, uOn; varying vec3 vC; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = .5 * uScale / -mv.z; vC = aCol; vA = uOn; }`);

    // Galaxy dressing, all decorative: a warm core glow, faint dust along two spiral arms, and distant stars.
    const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, 0.6]), 3));
    cg.setAttribute('aCol', new T.BufferAttribute(new Float32Array([1, 0.86, 0.62]), 3));
    const CU = { uScale: U.uScale, uRing2: U.uRing2 };
    const core = points(T, cg, CU, `attribute vec3 aCol; uniform float uScale, uRing2; varying vec3 vC; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = min(520., 3.2 * uScale / -mv.z); vC = aCol; vA = .3 * uRing2; }`);
    const DN = 5000, dp = new Float32Array(DN * 3), dc = new Float32Array(DN * 3), dr = d3.randomLcg(5), dn = d3.randomNormal.source(dr)(0, 1);
    for (let i = 0; i < DN; i++) { const arm = i % 2, r = 1.2 + Math.pow(dr(), 0.7) * 8.2, a = arm * Math.PI + Math.log(r) * 2.1 + dn() * 0.32;
      dp.set([Math.cos(a) * r, Math.sin(a) * r, Z2 * 0.55 + dn() * 0.22 * (1.4 - r / 10)], i * 3);
      const w = dr(); dc.set([0.55 + 0.4 * w, 0.45 + 0.25 * w, 0.85], i * 3); }
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3)); dg.setAttribute('aCol', new T.BufferAttribute(dc, 3));
    const dust = points(T, dg, U, `attribute vec3 aCol; uniform float uScale, uRing2; varying vec3 vC; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(.05 * uScale / -mv.z, 1., 24.); vC = aCol; vA = .16 * uRing2; }`);
    const SN = 2600, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 4);
    for (let i = 0; i < SN; i++) { const u = dr() * 2 - 1, th = dr() * 6.283, r = 40 + dr() * 40, q = Math.sqrt(1 - u * u);
      sp.set([q * Math.cos(th) * r, q * Math.sin(th) * r, u * r], i * 3); sc.set([0.75 + 0.25 * dr(), 0.8, 0.95, dr() * 6.283], i * 4); }
    const sgeo = new T.BufferGeometry(); sgeo.setAttribute('position', new T.BufferAttribute(sp, 3)); sgeo.setAttribute('aCol', new T.BufferAttribute(sc, 4));
    const stars = points(T, sgeo, U, `attribute vec4 aCol; uniform float uTime, uRing2; varying vec3 vC; varying float vA;
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = 2.2 + 1.2 * aCol.x; vC = aCol.xyz; vA = (.25 + .2 * sin(uTime * 1.3 + aCol.w)) * (.35 + .65 * uRing2); }`);
    scene.add(stars);
    const g = new T.Group(); g.add(dust, lines, clock, core, pts, head); scene.add(g);

    // Year labels around ring 1, projected each frame.
    const yrs = d3.rollups(d1, v => [d3.mean(v, n => n.ang), v.length], n => n.y).filter(([, [, k]]) => k >= 5)
      .map(([y, [ang]]) => { const el = document.createElement('span'); el.className = 'n3-yr'; el.textContent = y; host.appendChild(el);
        return { y, el, v: new T.Vector3(Math.cos(ang) * 4.35, -Math.sin(ang) * 4.35, 0), on: -1 }; });
    const pv = new T.Vector3();

    let W = 1, H = 1, ta = 0, tb = 0, tc = 0, ca = 0, cb = 0, cc = 0, mx = 0, my = 0, cmx = 0, cmy = 0;
    const P0 = new T.Vector3(), L0 = new T.Vector3(), P1 = new T.Vector3(0, -2.4, Z2 + 0.42), L1 = new T.Vector3(0, 7.5, Z2 - 0.25);
    function size() {
      const b = canvas.getBoundingClientRect(); W = b.width || 1; H = b.height || 1;
      R.setSize(W, H, false); cam.aspect = W / H;
      cam.setViewOffset(W, H, -shift() * W, 0, W, H); cam.updateProjectionMatrix();
      U.uScale.value = R.getPixelRatio() * H / (2 * Math.tan(cam.fov * D2R / 2));
      kick();
    }
    host.addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; kick(); });
    const kick = animator(canvas, (time, dt) => {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
      ca += (ta - ca) * k; cb += (tb - cb) * k; cc += (tc - cc) * k; cmx += (mx - cmx) * k * 0.4; cmy += (my - cmy) * k * 0.4;
      U.uT.value = 2016 + ca * 11; U.uT2.value = 2016 + cb * 11; U.uRing2.value = clamp(cb * 20, 0, 1); U.uTime.value = reduced ? 0 : time;
      const e = easeInOut(cb), ext = 4.7 + 3.3 * cb, el = (90 - 54 * e) * D2R;
      const dist = ext / (Math.tan(cam.fov * D2R / 2) * Math.min(1, cam.aspect)) * 1.04;
      const tz = 0.2 - 1.1 * e;
      const f = easeInOut(cc);
      cam.up.set(0, 1, 0);
      P0.set(cmx * 0.8, -dist * Math.cos(el) + cmy * 0.5, tz + dist * Math.sin(el)); L0.set(0, 0, tz);
      cam.position.copy(P0).lerp(P1, f); cam.position.x += cmx * 0.3 * f;
      cam.lookAt(L0.lerp(L1, f));
      cam.setViewOffset(W, H, -shift() * W * (1 - f), 0, W, H); cam.updateProjectionMatrix();  // the fly-through centres the view
      g.rotation.z = -0.5 * e - 1.1 * f + (reduced ? 0 : Math.sin(time * 0.07) * 0.03);
      U.uTwist.value = 1.6 * e + 0.6 * f; U.uSizeK.value = 1 - 0.45 * f;
      // clock head
      const T1 = U.uT.value, hu = (() => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (d1[m].yf <= T1) lo = m; else hi = m - 1; } return (lo + 0.5) / N; })();
      const hp = arcPt(hu), ha = U.uTwist.value * (AR - 3) * 0.45, hc = Math.cos(ha), hs = Math.sin(ha);
      hg.attributes.position.array.set([hc * hp[0] - hs * hp[1], hs * hp[0] + hc * hp[1], hp[2]]); hg.attributes.position.needsUpdate = true;
      HU.uOn.value = ca > 0.002 && ca < 0.998 ? 1 : 0;
      g.updateMatrixWorld(); cam.updateMatrixWorld();
      for (const Y of yrs) {
        const op = clamp((T1 - Y.y - 0.2) / 0.5, 0, 1) * (1 - 0.6 * e) * (1 - f);
        const ya = U.uTwist.value * 1.35 * 0.45; pv.set(Y.v.x * Math.cos(ya) - Y.v.y * Math.sin(ya), Y.v.x * Math.sin(ya) + Y.v.y * Math.cos(ya), 0).applyMatrix4(g.matrixWorld).project(cam);
        const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H;
        Y.el.style.opacity = op.toFixed(3);
        Y.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
      }
      R.render(scene, cam);
      return !reduced;
    });
    size(); new ResizeObserver(size).observe(canvas); addEventListener('resize', size);
    return { scrub(a, b, c = 0) { ta = clamp(a, 0, 1); tb = clamp(b, 0, 1); tc = clamp(c, 0, 1); kick(); } };
  }

  // ---------- Globe: one spike per country, height = citing papers; arcs run from Waterloo, home of the HCI Games Group.
  const CENTROIDS = { DE: [51.2, 10.4], CA: [56, -100], BR: [-10.8, -52.9], ES: [40.2, -3.6], US: [39.8, -98.6], FI: [62, 25.7], GB: [53, -1.5], IT: [42.8, 12.5],
    TR: [39, 35], CN: [35, 104], NL: [52.2, 5.5], FR: [46.6, 2.4], CH: [46.8, 8.2], PT: [39.6, -8], BE: [50.6, 4.6], AT: [47.6, 14.1], HK: [22.3, 114.2],
    GR: [39.1, 22], MY: [4, 102], MX: [23.6, -102.5], JP: [36.5, 138.5], AU: [-25.3, 134], ID: [-2.5, 118], EG: [26.8, 30.8], NZ: [-41.5, 172.5], PL: [52, 19.4],
    SA: [24, 45], IN: [22, 79], CO: [4.6, -74.1], PH: [12.9, 121.8], IR: [32.4, 53.7], TW: [23.7, 121], MA: [31.8, -7.1], KR: [36.3, 127.8], CL: [-35.7, -71.5],
    PK: [30.4, 69.3], TN: [34, 9.5], ZA: [-30.6, 22.9], HU: [47.2, 19.5], SE: [60.1, 18.6], DK: [56, 9.5], SK: [48.7, 19.7], AR: [-38.4, -63.6], EC: [-1.8, -78.2],
    NG: [9.1, 8.7], TH: [15.9, 101], LT: [55.2, 23.9], IE: [53.4, -8.2], IQ: [33.2, 43.7], CY: [35.1, 33.4], DZ: [28, 1.7], LU: [49.8, 6.1], NO: [60.5, 8.5],
    MT: [35.9, 14.4], EE: [58.6, 25], IL: [31, 34.9], LV: [56.9, 24.6], CZ: [49.8, 15.5], PE: [-9.2, -75], LK: [7.9, 80.8], SI: [46.15, 14.99], ET: [9.1, 40.5],
    RO: [45.9, 25], AE: [23.4, 53.8], JO: [30.6, 36.2] };
  const HOME = [43.47, -80.54];

  async function globe(host, countries, land, { name = c => c, tip = () => {}, labels = 8, onPick = null } = {}) {
    const T = await three();
    const canvas = document.createElement('canvas'); canvas.className = 'g3-cv'; host.appendChild(canvas);
    const R = makeRenderer(T, canvas, 2), scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 0, 5.4);
    const C1 = cssRGB(host, '--series-1'), CP = cssRGB(host, '--brand-pink'), CM = cssRGB(host, '--muted'), CA = cssRGB(host, '--series-3');
    const v3 = (lat, lon, r = 1) => new T.Vector3(Math.cos(lat * D2R) * Math.sin(lon * D2R) * r, Math.sin(lat * D2R) * r, Math.cos(lat * D2R) * Math.cos(lon * D2R) * r);
    const g = new T.Group(); scene.add(g);

    // body with a cyan rim, then a soft atmosphere behind it
    const body = new T.Mesh(new T.SphereGeometry(1, 64, 48), new T.ShaderMaterial({
      uniforms: { uBase: { value: new T.Vector3(...cssRGB(host, '--panel')) }, uRim: { value: new T.Vector3(...C1) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uBase, uRim; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1. - max(dot(vN, vV), 0.), 3.); gl_FragColor = vec4(uBase + uRim * f * .55, 1.); }` }));
    const atmo = new T.Mesh(new T.SphereGeometry(1.14, 48, 32), new T.ShaderMaterial({ side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uRim: { value: new T.Vector3(...C1) } },
      vertexShader: `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform vec3 uRim; varying vec3 vN; void main() { float i = pow(clamp(-vN.z / .48, 0., 1.), 2.2); gl_FragColor = vec4(uRim, i * .5); }` }));  // brightest at the limb, fading to nothing at the outer edge
    scene.add(atmo); g.add(body);

    const lpos = new Float32Array(land.length * 3), lcol = new Float32Array(land.length * 3);
    land.forEach(([la, lo], i) => { const v = v3(la, lo, 1.004); lpos.set([v.x, v.y, v.z], i * 3); lcol.set(CM, i * 3); });
    const lgeo = new T.BufferGeometry(); lgeo.setAttribute('position', new T.BufferAttribute(lpos, 3)); lgeo.setAttribute('aCol', new T.BufferAttribute(lcol, 3));
    const U = { uScale: { value: 1 }, uP: { value: 0 }, uTime: { value: 0 } };
    const landPts = new T.Points(lgeo, new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, fragmentShader: GLOW,
      vertexShader: `attribute vec3 aCol; uniform float uScale; varying vec3 vC; varying float vA;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = .022 * uScale / -mv.z; vC = aCol; vA = .55; }` }));
    g.add(landPts);

    // Timeline in seconds: arc i draws from d_i to d_i + 1; spike i grows from d_i + .8 to d_i + 1.3. Rewinding runs it backwards.
    const rows = countries.filter(([c]) => CENTROIDS[c]), max = d3.max(rows, r => r[1]), home = v3(...HOME);
    const C = rows.map(([c, n], i) => ({ c, n, d: i * 0.035, v: v3(...CENTROIDS[c]), h: 0.03 + 0.5 * n / max, grow: -1 }));
    const END = d3.max(C, k => k.d) + 1.35;

    const AS = 64, arcs = C.filter(k => k.c !== 'CA');
    const ap = new Float32Array(arcs.length * AS * 6), au = new Float32Array(arcs.length * AS * 4);
    arcs.forEach((k, j) => {
      const w = home.angleTo(k.v), sw = Math.sin(w), lift = 0.04 + 0.3 * w / Math.PI;
      const pt = u => { const a = Math.sin((1 - u) * w) / sw, b = Math.sin(u * w) / sw, s = 1 + lift * Math.sin(Math.PI * u);
        return [(home.x * a + k.v.x * b) * s, (home.y * a + k.v.y * b) * s, (home.z * a + k.v.z * b) * s]; };
      for (let i = 0; i < AS; i++) { const o = (j * AS + i); ap.set(pt(i / AS).concat(pt((i + 1) / AS)), o * 6); au.set([i / AS, k.d, (i + 1) / AS, k.d], o * 4); }
    });
    const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.BufferAttribute(ap, 3)); ag.setAttribute('aU', new T.BufferAttribute(au, 2));
    const arcLines = new T.LineSegments(ag, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: Object.assign({ uA: { value: new T.Vector3(...C1) }, uB: { value: new T.Vector3(...CP) } }, U),
      vertexShader: `attribute vec2 aU; uniform float uP, uTime; uniform vec3 uA, uB; varying vec3 vC; varying float vA;
        void main() { float t = clamp(uP - aU.y, 0., 1.), drawn = step(aU.x, t);
          float d = (fract(uTime * .3 + aU.y * 3.7) - aU.x) * 12., pulse = exp(-d * d) * step(.999, t);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          vC = mix(uA, uB, aU.x); vA = drawn * (.22 + .9 * pulse); }`, fragmentShader: LINE_FRAG }));
    arcLines.frustumCulled = false; g.add(arcLines);

    const box = new T.BoxGeometry(1, 1, 1); box.translate(0, 0, 0.5);
    const spikes = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: new T.Color().setRGB(...C1, T.SRGBColorSpace) }), C.length);
    spikes.frustumCulled = false; g.add(spikes);
    const tpos = new Float32Array(C.length * 3 + 3), tcol = new Float32Array(C.length * 3 + 3), tsz = new Float32Array(C.length + 1);
    C.forEach((k, i) => { tcol.set(C1.map(x => Math.min(1, x * 1.3)), i * 3); tsz[i] = 0.05 + 0.1 * Math.sqrt(k.n / max); });
    tpos.set([home.x * 1.01, home.y * 1.01, home.z * 1.01], C.length * 3); tcol.set(CA, C.length * 3); tsz[C.length] = 0.2;
    const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(tpos, 3)); tg.setAttribute('aCol', new T.BufferAttribute(tcol, 3)); tg.setAttribute('aS', new T.BufferAttribute(tsz, 1));
    const tips = new T.Points(tg, new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fragmentShader: GLOW,
      vertexShader: `attribute vec3 aCol; attribute float aS; uniform float uScale; varying vec3 vC; varying float vA;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aS * uScale / -mv.z; vC = aCol; vA = aS > 0. ? 1. : 0.; }` }));
    tips.frustumCulled = false; g.add(tips);

    const mk = (cls, txt) => { const el = document.createElement('span'); el.className = cls; el.textContent = txt; host.appendChild(el); return el; };
    const homeLab = mk('g3-lab g3-home', 'Waterloo');
    C.slice(0, labels).forEach(k => { k.el = mk('g3-lab', ''); k.el.innerHTML = `${name(k.c)} <b>${k.n}</b>`; });

    const q = new T.Quaternion(), zAxis = new T.Vector3(0, 0, 1), mtx = new T.Matrix4(), sv = new T.Vector3(), tv = new T.Vector3(), nv = new T.Vector3(), camDir = new T.Vector3();
    let W = 1, H = 1, p = reduced ? END : 0, dir = 0, rotY = 30 * D2R, rotX = 0.55, vy = 0, drag = null, idle = 0, hoverAt = null;
    function size() {
      const b = canvas.getBoundingClientRect(); W = b.width || 1; H = b.height || 1;
      R.setSize(W, H, false); cam.aspect = W / H;
      cam.position.z = 5.4 / Math.min(1, cam.aspect * 1.05); cam.updateProjectionMatrix();
      U.uScale.value = R.getPixelRatio() * H / (2 * Math.tan(cam.fov * D2R / 2));
      kick();
    }
    const screen = (v, out) => { tv.copy(v).applyMatrix4(g.matrixWorld); nv.copy(tv).normalize(); const face = nv.dot(camDir.copy(cam.position).sub(tv).normalize());
      tv.project(cam); out.x = (tv.x * 0.5 + 0.5) * W; out.y = (-tv.y * 0.5 + 0.5) * H; out.face = face; return out; };
    const nearest = (cx, cy) => { const b = canvas.getBoundingClientRect(), hx = cx - b.left, hy = cy - b.top; let best = null, bd = 22 * 22;
      C.forEach(k => { if (!(k.gr > 0.3)) return; screen(k.top, o); const d = (o.x - hx) ** 2 + (o.y - hy) ** 2; if (o.face > 0.1 && d < bd) { bd = d; best = k; } }); return best; };
    let down = null;
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; down = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); tip(null); });
    canvas.addEventListener('pointerup', e => { drag = null;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && onPick) { const k = nearest(e.clientX, e.clientY); if (k) onPick(k.c, k.n); }  // a click, not a drag
      down = null; });
    canvas.addEventListener('pointermove', e => {
      if (drag) { vy = (e.clientX - drag.x) * 0.008; rotY += vy; rotX = clamp(rotX + (e.clientY - drag.y) * 0.006, -1.1, 1.1); drag = { x: e.clientX, y: e.clientY }; idle = 0; kick(); return; }
      hoverAt = e; kick();
    });
    canvas.addEventListener('pointerleave', () => { hoverAt = null; tip(null); });
    const o = { x: 0, y: 0, face: 0 };
    const kick = animator(canvas, (time, dt) => {
      if (dir) { p = clamp(p + dt * dir, 0, END); if ((dir > 0 && p === END) || (dir < 0 && p === 0)) dir = 0; }
      idle += dt;
      if (!drag) { vy *= Math.pow(0.04, dt); rotY += vy; if (!reduced && idle > 2.5) rotY += dt * 0.1; }
      g.rotation.set(rotX, rotY, 0, 'XYZ'); g.updateMatrixWorld(); cam.updateMatrixWorld();
      U.uP.value = p; U.uTime.value = reduced ? 0 : time;
      C.forEach((k, i) => {
        const gr = easeBack((p - k.d - 0.8) / 0.5), h = Math.max(0, k.h * gr);
        q.setFromUnitVectors(zAxis, k.v); mtx.compose(k.v, q, sv.set(0.016, 0.016, Math.max(1e-4, h)));
        spikes.setMatrixAt(i, mtx);
        tpos.set([k.v.x * (1 + h), k.v.y * (1 + h), k.v.z * (1 + h)], i * 3); tsz[i] = gr > 0 ? (0.05 + 0.1 * Math.sqrt(k.n / max)) * Math.min(1, gr * 1.4) : 0;
        k.gr = gr; k.top = (k.top || new T.Vector3()).copy(k.v).multiplyScalar(1 + h);
      });
      spikes.instanceMatrix.needsUpdate = true; tg.attributes.position.needsUpdate = true; tg.attributes.aS.needsUpdate = true;
      // labels: top countries that face the camera, skipping any that would collide with one already placed
      const placed = [];
      screen(home, o); homeLab.style.opacity = o.face > 0.2 ? 1 : 0; homeLab.style.transform = `translate(${(o.x + 10).toFixed(1)}px,${(o.y - 8).toFixed(1)}px)`;
      if (o.face > 0.2) placed.push({ x: o.x + 10, y: o.y - 8, w: 80, h: 20 });
      C.forEach(k => { if (!k.el) return; screen(k.top, o);
        const w = k.el.offsetWidth || 90, r = { x: clamp(o.x + 8, 4, W - w - 6), y: clamp(o.y - 22, 4, H - 26), w, h: 22 };
        const ok = o.face > 0.25 && k.gr > 0.6 && !placed.some(b => r.x < b.x + b.w + 6 && b.x < r.x + r.w + 6 && r.y < b.y + b.h && b.y < r.y + r.h);
        if (ok) placed.push(r);
        k.el.style.opacity = ok ? 1 : 0; k.el.style.transform = `translate(${r.x.toFixed(1)}px,${r.y.toFixed(1)}px)`; });
      if (hoverAt && !drag) { const best = nearest(hoverAt.clientX, hoverAt.clientY); canvas.style.cursor = best ? 'pointer' : '';
        tip(best ? `<b>${name(best.c)}</b><br>${best.n} citing paper${best.n === 1 ? '' : 's'} with an author there<br><i>Click to list the papers</i>` : null, hoverAt); }
      R.render(scene, cam);
      return !reduced || !!dir || !!drag;
    });
    size(); new ResizeObserver(size).observe(canvas);
    return {
      play() { if (reduced) { p = END; kick(); return; } dir = 1; kick(); },
      rewind() { if (reduced) { p = 0; kick(); return; } dir = -2.5; kick(); },
    };
  }

  // ---------- Photos: hovering sends a ripple out from the pointer, with a slight colour split. It fades out when the pointer leaves.
  async function ripple(img) {
    if (reduced) return null;
    const T = await three();
    if (!img.complete || !img.naturalWidth) await new Promise((res, rej) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', rej, { once: true }); });
    const fig = img.parentElement; fig.style.position = 'relative';
    const canvas = document.createElement('canvas'); canvas.className = 'rp-cv'; canvas.setAttribute('aria-hidden', 'true'); img.after(canvas);
    const R = makeRenderer(T, canvas, 2), scene = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const src = document.createElement('canvas'); src.width = img.naturalWidth; src.height = img.naturalHeight; src.getContext('2d').drawImage(img, 0, 0);  // a canvas copy uploads reliably where the <img> did not
    const tex = new T.CanvasTexture(src); tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
    const U = { uTex: { value: tex }, uM: { value: new T.Vector2(0.5, 0.5) }, uS: { value: 0 }, uT: { value: 0 }, uBox: { value: 1 }, uImg: { value: img.naturalWidth / (img.naturalHeight || 1) } };
    scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: U,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec2 uM; uniform float uS, uT, uBox, uImg; varying vec2 vUv;
        vec2 cover(vec2 uv) { vec2 s = uBox > uImg ? vec2(1., uImg / uBox) : vec2(uBox / uImg, 1.); return (uv - .5) * s + .5; }  // matches object-fit: cover
        void main() {
          vec2 d = vUv - uM; d.x *= uBox; float r = length(d);
          vec2 dir = r > 0. ? d / r : vec2(0.); dir.x /= uBox;
          vec2 o = dir * sin(r * 38. - uT * 7.) * exp(-r * 5.) * uS * .014;
          gl_FragColor = vec4(texture2D(uTex, cover(vUv + o)).r, texture2D(uTex, cover(vUv + o * 1.3)).g, texture2D(uTex, cover(vUv + o * 1.6)).b, 1.);
        }` })));
    let on = 0, W = 1, H = 1;
    const size = () => { W = img.offsetWidth || 1; H = img.offsetHeight || 1; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; R.setSize(W, H, false); U.uBox.value = W / H; };
    const kick = animator(canvas, (time, dt) => {
      U.uS.value += (on - U.uS.value) * (1 - Math.exp(-dt * 5)); U.uT.value = time;
      const live = on > 0 || U.uS.value > 0.003;
      canvas.style.opacity = live ? 1 : 0;
      if (live) R.render(scene, cam);
      return live;
    });
    fig.addEventListener('pointermove', e => { const b = img.getBoundingClientRect(); U.uM.value.set((e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height); on = 1; kick(); });
    fig.addEventListener('pointerleave', () => { on = 0; kick(); });
    size(); new ResizeObserver(size).observe(img);
    return { kick };
  }

  // ---------- Hexad-12 universe: the 12 items float in from deep space and join a node graph. Each item ties to its type's hub,
  // the two items of a type tie to each other, and the six hubs ring a Hexad-12 core. Labels are HTML for crisp, high-contrast text.
  const TYPE_COL = { Philanthropist: '#e090c0', Socialiser: '#00b3eb', 'Free Spirit': '#5fd4a8', Achiever: '#f2c25a', Player: '#b98ad0', Disruptor: '#ff7a6b' };
  async function universe(host, items, order) {
    const T = await three();
    const canvas = document.createElement('canvas'); canvas.className = 'u3-cv'; canvas.setAttribute('aria-hidden', 'true'); host.appendChild(canvas);
    const R = makeRenderer(T, canvas, 2), scene = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.1, 200);
    cam.position.set(0, 0, 10);
    const col = t => { const c = d3.rgb(TYPE_COL[t] || '#ffffff'); return [c.r / 255, c.g / 255, c.b / 255]; };
    const rnd = d3.randomLcg(12);
    const nodes = [{ kind: 'core', label: 'Hexad-12', p: new T.Vector3(0, 0, 0), c: [1, 1, 1], s: 0.6, d: 0 }];
    order.forEach((t, i) => { const a = Math.PI / 2 - i * Math.PI / 3;
      nodes.push({ kind: 'hub', type: t, label: t, a, p: new T.Vector3(Math.cos(a) * 2.6, Math.sin(a) * 2.6, Math.sin(i * 1.7) * 0.6), c: col(t), s: 0.46, d: 0.15 + i * 0.09 }); });
    items.forEach(([t, text], j) => {
      const hub = nodes.find(n => n.type === t && n.kind === 'hub'), side = items.filter(x => x[0] === t)[0][1] === text ? -1 : 1;
      const out = new T.Vector3(Math.cos(hub.a), Math.sin(hub.a), 0), perp = new T.Vector3(-out.y, out.x, 0);
      const p = hub.p.clone().addScaledVector(out, 1.55).addScaledVector(perp, side * 0.8).add(new T.Vector3(0, 0, side * 0.8));
      nodes.push({ kind: 'item', type: t, label: text, p, c: col(t), s: 0.3, d: 0.8 + j * 0.13 }); });
    const hubOf = t => nodes.findIndex(n => n.kind === 'hub' && n.type === t);
    const E = [];
    order.forEach((t, i) => { E.push([0, hubOf(t)], [hubOf(t), hubOf(order[(i + 1) % order.length])]); });
    nodes.forEach((n, i) => { if (n.kind === 'item') E.push([hubOf(n.type), i]); });
    order.forEach(t => { const its = nodes.map((n, i) => n.kind === 'item' && n.type === t ? i : -1).filter(i => i >= 0); if (its.length === 2) E.push(its); });
    nodes.forEach(n => { const dir = new T.Vector3(rnd() - 0.5, rnd() - 0.5, 0).normalize(); n.from = n.p.clone().addScaledVector(dir, 3 + rnd() * 3).add(new T.Vector3(0, 0, -22 - rnd() * 10));
      n.ph = rnd() * 6.283; n.cur = n.from.clone(); n.arr = 0; });
    const END = d3.max(nodes, n => n.d) + 1.5;

    const M = nodes.length, np = new Float32Array(M * 3), nc = new Float32Array(M * 3), ns = new Float32Array(M * 2);
    nodes.forEach((n, i) => nc.set(n.c, i * 3));
    const ng = new T.BufferGeometry(); ng.setAttribute('position', new T.BufferAttribute(np, 3)); ng.setAttribute('aCol', new T.BufferAttribute(nc, 3)); ng.setAttribute('aS', new T.BufferAttribute(ns, 2));
    const U = { uScale: { value: 1 }, uTime: { value: 0 } };
    const npts = points(T, ng, U, `attribute vec3 aCol; attribute vec2 aS; uniform float uScale, uTime; varying vec3 vC; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aS.x * uScale / -mv.z; vC = aCol; vA = aS.y; }`);
    const ep = new Float32Array(E.length * 6), ec = new Float32Array(E.length * 6), ea = new Float32Array(E.length * 2);
    E.forEach(([a, b], i) => ec.set(nodes[a].c.concat(nodes[b].c), i * 6));
    const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(ep, 3)); eg.setAttribute('aCol', new T.BufferAttribute(ec, 3)); eg.setAttribute('aA', new T.BufferAttribute(ea, 1));
    const elines = new T.LineSegments(eg, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fragmentShader: LINE_FRAG,
      vertexShader: `attribute vec3 aCol; attribute float aA; varying vec3 vC; varying float vA; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); vC = aCol; vA = aA; }` }));
    elines.frustumCulled = false;
    const SN = 1400, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 4);
    for (let i = 0; i < SN; i++) { sp.set([(rnd() - 0.5) * 60, (rnd() - 0.5) * 40, -10 - rnd() * 40], i * 3); sc.set([0.7 + 0.3 * rnd(), 0.8, 0.95, rnd() * 6.283], i * 4); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('aCol', new T.BufferAttribute(sc, 4));
    scene.add(points(T, sg, U, `attribute vec4 aCol; uniform float uTime; varying vec3 vC; varying float vA;
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = 1.8 + aCol.x; vC = aCol.xyz; vA = .28 + .18 * sin(uTime * 1.1 + aCol.w); }`));
    const g = new T.Group(); g.add(elines, npts); scene.add(g);

    const labs = nodes.map(n => { const el = document.createElement('span'); el.className = 'u3-lab u3-' + n.kind; el.textContent = n.kind === 'item' ? `“${n.label}”` : n.label;
      if (n.kind !== 'core') el.style.setProperty('--c', TYPE_COL[n.type]); host.appendChild(el); return el; });
    const pv = new T.Vector3();
    let W = 1, H = 1, p = 0, dir = 0, mx = 0, my = 0, cmx = 0, cmy = 0, wide = true;
    function size() {
      const b = canvas.getBoundingClientRect(); W = b.width || 1; H = b.height || 1; wide = W > 900;
      R.setSize(W, H, false); cam.aspect = W / H;
      cam.setViewOffset(W, H, wide ? -0.13 * W : 0, 0, W, H); cam.position.z = wide ? 18 : 19; cam.updateProjectionMatrix();
      U.uScale.value = R.getPixelRatio() * H / (2 * Math.tan(cam.fov * D2R / 2));
      kick();
    }
    host.addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; kick(); });
    const kick = animator(canvas, (time, dt) => {
      if (dir) { p = clamp(p + dt * dir, 0, END); if ((dir > 0 && p === END) || (dir < 0 && p === 0)) dir = 0; }
      const k = reduced ? 1 : 1 - Math.exp(-dt * 3); cmx += (mx - cmx) * k; cmy += (my - cmy) * k;
      g.rotation.set((reduced ? 0 : Math.sin(time * 0.09) * 0.16) + cmy * 0.15, (reduced ? 0 : Math.sin(time * 0.12) * 0.38) + cmx * 0.3, 0);
      U.uTime.value = reduced ? 0 : time;
      nodes.forEach((n, i) => {
        const a = clamp((p - n.d) / 1.1, 0, 1), e = 1 - Math.pow(1 - a, 4); n.arr = a;
        const bob = reduced ? 0 : 0.09;
        n.cur.copy(n.from).lerp(n.p, e); n.cur.x += Math.sin(time * 0.6 + n.ph) * bob * e; n.cur.y += Math.cos(time * 0.5 + n.ph) * bob * e;
        np.set([n.cur.x, n.cur.y, n.cur.z], i * 3);
        const pop = a > 0 && a < 1 ? 1 + 0.6 * Math.sin(a * Math.PI) : 1;
        ns.set([n.s * pop * (a > 0 ? 1 : 0), Math.min(1, a * 2)], i * 2);
      });
      E.forEach(([a, b], i) => { const A = nodes[a].cur, B = nodes[b].cur; ep.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6);
        const v = Math.min(nodes[a].arr, nodes[b].arr); ea[i * 2] = ea[i * 2 + 1] = v * v * (nodes[a].kind === 'core' ? 0.35 : 0.6); });
      ng.attributes.position.needsUpdate = ng.attributes.aS.needsUpdate = true; eg.attributes.position.needsUpdate = eg.attributes.aA.needsUpdate = true;
      g.updateMatrixWorld(); cam.updateMatrixWorld();
      nodes.forEach((n, i) => {
        pv.copy(n.cur).applyMatrix4(g.matrixWorld); const depth = pv.z; pv.project(cam);
        const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H, op = clamp((n.arr - 0.55) / 0.45, 0, 1) * (depth < -1.2 ? 0.75 : 1);
        const el = labs[i]; el.style.opacity = op.toFixed(3);
        if (op > 0 && !n.w) n.w = el.offsetWidth;
        const left = n.kind === 'item' && (n.cur.x < 0 || x + (n.w || 200) + 24 > W);  // flip a label inward when it would run off the edge
        el.style.transform = n.kind === 'item' ? `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(${left ? 'calc(-100% - 14px)' : '14px'},-50%)`
          : `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,${n.kind === 'core' ? '-50%' : 'calc(-100% - 14px)'})`;
      });
      R.render(scene, cam);
      return !reduced || !!dir;
    });
    size(); new ResizeObserver(size).observe(canvas);
    return { play() { if (reduced) { p = END; kick(); return; } dir = 1; kick(); }, rewind() { if (reduced) { p = 0; kick(); return; } dir = -2.2; kick(); } };
  }

  window.HX3D = { hero, network, globe, ripple, universe, reduced };
})();
