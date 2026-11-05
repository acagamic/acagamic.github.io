/* chain3d.js: three.js descent-chain motion graphic. API: HXChain3D.create(container, chain, newest) -> {play, stop} */
(function () {
  'use strict';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js';
  var A0 = 1.0, STEP = 1.55, TRAVEL = 0.9, O0 = 14.5, OVD = 2.4;
  var T_NEW = 17.1, T_ARC = 18.1, ARC_D = 1.1, T_IMP = T_ARC + ARC_D, TOTAL = T_IMP + 2.4;
  var N = 9, TUB = 90, RAD = 6, SX = 3.6, YEARS = 10;
  var RAMP = [[0x1a, 0x9c, 0xcb], [0xb9, 0x8a, 0xd0], [0xde, 0x4f, 0x97]];

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function eio(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function arrival(k) { return A0 + STEP * k; }

  var threeWaiters = null;
  function withThree(cb) {
    if (window.THREE) return cb();
    if (threeWaiters) return threeWaiters.push(cb);
    threeWaiters = [cb];
    var s = document.createElement('script');
    s.src = THREE_URL;
    s.onload = function () { var w = threeWaiters; threeWaiters = null; w.forEach(function (f) { f(); }); };
    s.onerror = function () { console.error('chain3d: three.js failed to load'); };
    document.head.appendChild(s);
  }

  function injectCSS() {
    if (document.getElementById('hx3-css')) return;
    var st = document.createElement('style');
    st.id = 'hx3-css';
    st.textContent =
      '.hx3-ov{position:absolute;inset:0;overflow:visible;pointer-events:none}' +
      '.hx3-l{position:absolute;left:0;top:0;opacity:0;color:#f2f5f7;white-space:nowrap;font-size:20px;' +
      'font-family:"Montserrat",system-ui,sans-serif;text-shadow:0 2px 12px #0a2530,0 0 3px #0a2530,0 0 6px #0a2530}' +
      '.hx3-l .n{display:flex;align-items:center;gap:12px;font-family:"Wix Madefor Display","Montserrat",sans-serif}' +
      '.hx3-l .g{flex:none;min-width:1.5em;height:1.5em;border-radius:1em;display:inline-flex;align-items:center;justify-content:center;' +
      'font:700 .72em/1 "Montserrat",sans-serif;color:#0a2530;background:var(--c)}' +
      '.hx3-l .t,.hx3-l .c{display:none;white-space:normal}' +
      '.hx3-l.cur{max-width:660px}.hx3-l.cur .n{font-size:32px;font-weight:700}' +
      '.hx3-l.cur .t,.hx3-l.cur .c{padding-left:44px}.hx3-l.cur .t{display:block;font-size:20px;line-height:1.35;margin-top:8px}' +
      '.hx3-l.cur .c{display:block;font-size:18px;color:#a9bec7;margin-top:6px}' +
      '.hx3-l.short .n{font-size:20px;font-weight:600;line-height:1.3;gap:8px}.hx3-l.short .g{font-size:18px}' +  // step numbers stay so the room can count the eight steps
      '.hx3-l.new .n{font-size:24px;font-weight:700;color:#f2c25a;line-height:1.3}.hx3-l.new .g{display:none}' +
      '.hx3-l.yr{color:#a9bec7;font:500 18px/1 "Montserrat",sans-serif}' +
      '.hx3-l.arc{color:#f2c25a;font:600 20px/1 "Montserrat",sans-serif}' +
      '.hx3-ld{position:absolute;left:0;top:0;width:1px;background:#a9bec7;opacity:0}';
    document.head.appendChild(st);
  }

  function ramp(t) {
    t = clamp(t, 0, 1);
    var s = t * 2, i = Math.min(1, Math.floor(s)), f = s - i, a = RAMP[i], b = RAMP[i + 1];
    return [lerp(a[0], b[0], f) / 255, lerp(a[1], b[1], f) / 255, lerp(a[2], b[2], f) / 255];
  }
  function trunc(s, n) { if (s.length <= n) return s; var c = s.slice(0, n - 1), k = c.lastIndexOf(' '); return (k > n - 14 ? c.slice(0, k) : c).trim() + '…'; }

  function build(container, chain, newest) {
    var T = window.THREE;
    injectCSS();
    var data = chain.slice(0, 9);
    var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    var cv = renderer.domElement;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(cv);
    var overlay = document.createElement('div');
    overlay.className = 'hx3-ov';
    container.appendChild(overlay);

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(36, 2.4, 0.1, 300);
    var W = 1680, H = 700;
    function resize() {
      var r = container.getBoundingClientRect();
      W = container.clientWidth || r.width || 1680; H = container.clientHeight || r.height || 700;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(Math.max(2, Math.round(r.width || W)), Math.max(2, Math.round(r.height || H)), false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      if (!playing) render(curT);
    }

    function glowTex() {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return new T.CanvasTexture(c);
    }
    var gtex = glowTex();

    // nodes on one straight line along x; x = publication year, same-year papers fan out by generation
    var seen = {};
    var pos = data.map(function (d) {
      var r = seen[d.year] = (seen[d.year] === undefined ? 0 : seen[d.year] + 1);
      return new T.Vector3((d.year - 2016 + 0.3 * r) * SX, 0, 0);
    });
    var XEND = YEARS * SX;
    var yearT = data.map(function (d) { return (d.year - 2016) / YEARS; });
    var nodeCol = data.map(function (d, i) { return ramp(yearT[i]); });
    function lite(c, k) { return [lerp(c[0], 1, k), lerp(c[1], 1, k), lerp(c[2], 1, k)]; }

    function tube(c, segs, rad, radial, colFn, op) {
      var g = new T.TubeGeometry(c, segs, rad, radial, false);
      var n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var u = Math.floor(i / (radial + 1)) / segs, c3 = colFn(u);
        col[i * 3] = c3[0]; col[i * 3 + 1] = c3[1]; col[i * 3 + 2] = c3[2];
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setDrawRange(0, 0);
      var m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
      m.frustumCulled = false; scene.add(m);
      return m;
    }
    var line = new T.LineCurve3(new T.Vector3(0, 0, 0), new T.Vector3(XEND, 0, 0));
    var pathCore = tube(line, TUB, 0.03, RAD, function (u) { return lite(ramp(u), 0.15); }, 0.9);
    var pathGlow = tube(line, TUB, 0.12, RAD, function (u) { return ramp(u); }, 0.14);
    function setDraw(m, u, segs, radial) { m.geometry.setDrawRange(0, Math.floor(clamp(u, 0, 1) * segs) * radial * 6); }

    // year axis under the line
    var AY = -4.2, ax = [0, AY, 0, XEND, AY, 0], yrs = [];
    for (var y = 0; y <= YEARS; y++) { ax.push(y * SX, AY, 0, y * SX, AY - 0.3, 0); yrs.push(new T.Vector3(y * SX, AY - 0.3, 0)); }
    var axG = new T.BufferGeometry(); axG.setAttribute('position', new T.Float32BufferAttribute(ax, 3));
    var axis = new T.LineSegments(axG, new T.LineBasicMaterial({ color: 0xa9bec7, transparent: true, opacity: 0.25 }));
    axis.frustumCulled = false; scene.add(axis);

    var maxC = Math.max.apply(null, data.map(function (d) { return d.cites; }));
    var coreGeo = new T.SphereGeometry(1, 20, 14);
    function mkNode(col, r, coreCol) {
      var core = new T.Mesh(coreGeo, new T.MeshBasicMaterial({ color: coreCol || new T.Color(col[0], col[1], col[2]).lerp(new T.Color(1, 1, 1), 0.3) }));
      var glow = new T.Sprite(new T.SpriteMaterial({ map: gtex, color: new T.Color(col[0], col[1], col[2]), blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
      core.visible = glow.visible = false;
      scene.add(core); scene.add(glow);
      return { core: core, glow: glow, r: r };
    }
    var nodes = data.map(function (d, i) {
      var r = 0.12 + 0.34 * Math.sqrt(d.cites / maxC);
      var n = mkNode(nodeCol[i], r); n.core.position.copy(pos[i]); n.glow.position.copy(pos[i]); return n;
    });
    var AMBER = [0xc2 / 255, 0x87 / 255, 0x1c / 255], AMBER_HI = [1, 0.76, 0.35];
    var nPos = new T.Vector3(XEND + 1.0, 5.2, 0);
    var nNode = mkNode(AMBER, 0.42, new T.Color(1, 0.82, 0.45)); nNode.core.position.copy(nPos); nNode.glow.position.copy(nPos);

    var head = new T.Sprite(new T.SpriteMaterial({ map: gtex, color: 0xffffff, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    head.visible = false; scene.add(head);

    // amber arc: newest node back over the line to the Hexad node
    var arc = new T.QuadraticBezierCurve3(nPos, new T.Vector3(XEND / 2 + 0.5, 16.5, 0), pos[0]);
    arc.getPointAt = arc.getPoint; arc.getTangentAt = arc.getTangent;
    var ARC_SEG = 100;
    var arcCore = tube(arc, ARC_SEG, 0.06, RAD, function () { return [1, 0.84, 0.5]; }, 1);
    var arcGlow = tube(arc, ARC_SEG, 0.22, RAD, function () { return AMBER_HI; }, 0.2);
    var arcHead = new T.Sprite(new T.SpriteMaterial({ map: gtex, color: 0xffd27a, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    arcHead.visible = false; scene.add(arcHead);

    // static starfield
    var SN = 600, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
    for (var s = 0; s < SN; s++) {
      sp[s * 3] = -30 + Math.random() * 100; sp[s * 3 + 1] = -30 + Math.random() * 60; sp[s * 3 + 2] = -70 + Math.random() * 60;
      var b = 0.25 + Math.random() * 0.45; sc[s * 3] = 0.66 * b; sc[s * 3 + 1] = 0.75 * b; sc[s * 3 + 2] = 0.78 * b;
    }
    var sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('color', new T.BufferAttribute(sc, 3));
    var stars = new T.Points(sg, new T.PointsMaterial({ size: 0.2, vertexColors: true, map: gtex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    stars.frustumCulled = false; scene.add(stars);

    function mkBurst(origin, col, count, speed, size, ringR, t0) {
      var g = new T.BufferGeometry(), p = new Float32Array(count * 3), c = new Float32Array(count * 3), dir = [];
      for (var i = 0; i < count; i++) {
        var th = Math.random() * 6.2832, ph = Math.acos(2 * Math.random() - 1), sd = speed * (0.45 + Math.random() * 0.8);
        dir.push([Math.sin(ph) * Math.cos(th) * sd, Math.sin(ph) * Math.sin(th) * sd, Math.cos(ph) * sd]);
      }
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
      var pts = new T.Points(g, new T.PointsMaterial({ size: size, vertexColors: true, map: gtex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      pts.frustumCulled = false; scene.add(pts);
      var ring = new T.Mesh(new T.RingGeometry(0.92, 1, 56), new T.MeshBasicMaterial({ color: new T.Color(col[0], col[1], col[2]), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      ring.visible = false; scene.add(ring);
      var lc = lite(col, 0.3);
      return { upd: function (t) {
        var a = t - t0, on = a >= 0 && a < 0.8;
        pts.visible = ring.visible = on;
        if (!on) return;
        var k = Math.pow(1 - a / 0.8, 1.5), e = (1 - Math.exp(-3.5 * a)) / 3.5;
        for (var i = 0; i < count; i++) {
          p[i * 3] = origin.x + dir[i][0] * e; p[i * 3 + 1] = origin.y + dir[i][1] * e; p[i * 3 + 2] = origin.z + dir[i][2] * e;
          c[i * 3] = lc[0] * k; c[i * 3 + 1] = lc[1] * k; c[i * 3 + 2] = lc[2] * k;
        }
        g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
        ring.position.copy(origin); ring.quaternion.copy(camera.quaternion);
        var rs = 0.3 + (a / 0.8) * ringR; ring.scale.set(rs, rs, rs);
        ring.material.opacity = (1 - a / 0.8) * 0.9;
      } };
    }
    var bursts = [];
    for (var bi = 0; bi < N; bi++) bursts.push(mkBurst(pos[bi], lite(nodeCol[bi], 0.2), 60, 3.2, 0.2, 2.4 + nodes[bi].r * 2, bi === 0 ? 0.5 : arrival(bi)));
    bursts.push(mkBurst(pos[0], AMBER_HI, 140, 8, 0.8, 7, T_IMP));

    // labels: odd generations above the line, even below
    var labels = [], yrLabels = [];
    function mkEl(cls) { var el = document.createElement('div'); el.className = 'hx3-l ' + cls; overlay.appendChild(el); return el; }
    function mkLeader() { var el = document.createElement('div'); el.className = 'hx3-ld'; overlay.insertBefore(el, overlay.firstChild); return el; }
    function mk(d, i, isNew) {
      var c = isNew ? AMBER_HI : nodeCol[i], css = 'rgb(' + c.map(function (v) { return Math.round(v * 255); }).join(',') + ')';
      var el = mkEl(isNew ? 'new' : 'short');
      el.style.setProperty('--c', css);
      var short = d.who + ' (' + d.year + ')';
      var L = { el: el, i: i, isNew: isNew, w: 0, h: 0, st: '', side: i % 2 ? -1 : 1, ld: isNew ? null : mkLeader(), op: 0, x: 0, y: 0 };
      if (isNew) { el.innerHTML = '<div class="n"></div>'; el.firstChild.textContent = 'Newest paper citing the Hexad, ' + (d.date || d.year) + ': ' + short; }
      else {
        el.innerHTML = '<div class="n"><span class="g"></span><b></b></div><div class="t"></div><div class="c"></div>';
        el.querySelector('.g').textContent = i === 0 ? '★' : i;
        el.querySelector('b').textContent = short; el.querySelector('.t').textContent = trunc(d.title, 70);
        el.querySelector('.c').textContent = d.cites.toLocaleString('en-CA') + (d.cites === 1 ? ' citation' : ' citations');
        L.shortCls = 'hx3-l short'; L.curCls = 'hx3-l cur';
      }
      labels.push(L); return L;
    }
    data.forEach(function (d, i) { mk(d, i, false); });
    var nLabel = mk(newest, 9, true);
    var arcLabel = mkEl('arc'); arcLabel.textContent = 'cites the Hexad paper';
    for (var yy = 0; yy <= YEARS; yy++) { var ye = mkEl('yr'); ye.textContent = 2016 + yy; yrLabels.push({ el: ye, w: 0, h: 0, st: '' }); }
    function measure(L) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
    function setState(L, st) {
      if (L.st === st) return;
      L.st = st; if (L.isNew) return;
      L.el.className = st === 'cur' ? L.curCls : L.shortCls;
      measure(L);
    }
    function remeasure() { labels.concat(yrLabels).forEach(function (L) { measure(L); }); if (!playing) render(curT); }
    labels.concat(yrLabels).forEach(measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

    // camera
    var cPos = new T.Vector3(), cLook = new T.Vector3(), v = new T.Vector3(), v2 = new T.Vector3();
    var END_C = new T.Vector3(XEND / 2 + 1.6, 2.4, 0), END_P = new T.Vector3(XEND / 2 + 1.6, 2.4, 25);  // nudged left so the last label fits past the line's end
    function camX(t) {
      var x = pos[0].x;
      for (var k = 1; k < N; k++) { var s = arrival(k) - TRAVEL; if (t >= s) x = lerp(pos[k - 1].x, pos[k].x, eio((t - s) / TRAVEL)); }
      return x;
    }
    function setCamera(t, cx) {
      var dolly = 1 + 0.45 * (1 - eio(t / A0));
      cLook.set(cx + 2.4, 0.3, 0);
      cPos.set(cx - 2.6, 1.6, 9 * dolly);
      var m = eio((t - O0) / OVD);
      if (m > 0) { cPos.lerp(END_P, m); cLook.lerp(END_C, m); }
      camera.position.copy(cPos); camera.lookAt(cLook);
      return m;
    }

    function overlap(a, b, pad) { return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad; }
    function proj(p3, out) { v2.copy(p3).project(camera); out.sx = (v2.x * 0.5 + 0.5) * W; out.sy = (-v2.y * 0.5 + 0.5) * H; out.behind = v2.z > 1; return out; }

    var curT = 0, playing = false, raf = 0, t0 = 0, pt = { sx: 0, sy: 0, behind: false };
    function render(t) {
      curT = t;
      var cx = camX(t), m = setCamera(t, cx);
      camera.updateMatrixWorld();
      var rev = t >= O0 ? 1 : (cx + 5) / XEND;
      setDraw(pathCore, rev, TUB, RAD); setDraw(pathGlow, rev, TUB, RAD);
      axis.material.opacity = 0.2 + 0.3 * m;

      for (var i = 0; i < N; i++) {
        var st = i === 0 ? 0 : arrival(i) - TRAVEL + 0.25, a = eio((t - st) / 0.6), n = nodes[i], on = a > 0.001;
        n.core.visible = n.glow.visible = on;
        if (!on) continue;
        var boost = (i === 0 && t > T_IMP) ? 1 + 1.6 * Math.pow(Math.max(0, 1 - (t - T_IMP) / 1.6), 2) : 1;
        var cur = 1 + 0.4 * Math.exp(-Math.abs(t - arrival(i)) * 2) * (t < O0 ? 1 : 0);
        n.core.scale.setScalar(n.r * a * (1 + 0.15 * (boost - 1)));
        n.glow.scale.setScalar(n.r * 6.5 * a * cur * boost);
      }
      var hv = t < O0 && cx > pos[0].x + 0.01 && cx < XEND;
      head.visible = hv;
      if (hv) { head.position.set(cx, 0, 0); var f = (t - A0 + TRAVEL) % STEP; head.scale.setScalar(0.4 + 1.1 * Math.min(1, Math.sin(Math.PI * clamp(f / TRAVEL, 0, 1)) * 3)); }

      var na = eio((t - T_NEW) / 0.7), nOn = na > 0.001;
      nNode.core.visible = nNode.glow.visible = nOn;
      if (nOn) { nNode.core.scale.setScalar(nNode.r * na); nNode.glow.scale.setScalar(4.5 * na); }
      var au = t >= T_ARC ? clamp((t - T_ARC) / ARC_D, 0, 1) : 0, aeased = au * au * (3 - 2 * au);
      setDraw(arcCore, aeased, ARC_SEG, RAD); setDraw(arcGlow, aeased, ARC_SEG, RAD);
      if (t >= T_ARC) { // the only motion after the finale: a light pulse on the arc
        var hu = au < 1 ? aeased : ((t - T_IMP) / 2.4) % 1;
        arcHead.visible = true; arcHead.position.copy(arc.getPoint(hu)); arcHead.scale.setScalar(au < 1 ? 2.6 : 0.9 * Math.sin(Math.PI * hu) + 0.2);
      } else arcHead.visible = false;
      bursts.forEach(function (b) { b.upd(t); });

      // labels. fly-through: only the active node, full title. pull-back: short labels, collision-checked in screen space.
      var shortOp = t >= O0 ? clamp((m - 0.4) / 0.6, 0, 1) : 0, placed = [], vis = [];
      yrLabels.forEach(function (Y, k) {
        proj(yrs[k], pt);
        Y.x = pt.sx - Y.w / 2; Y.y = pt.sy + 6; Y.el.style.opacity = shortOp;
        Y.el.style.transform = 'translate(' + Y.x.toFixed(1) + 'px,' + Y.y.toFixed(1) + 'px)';
        if (shortOp > 0) placed.push(Y);
      });
      var axisY = H; if (shortOp > 0) { proj(new T.Vector3(0, AY, 0), pt); axisY = pt.sy; placed.push({ x: 0, y: pt.sy - 2, w: W, h: 4 }); }  // the axis line itself
      if (aeased > 0) {  // width read once: a layout read every frame would cost smoothness
        var aw = arcLabel._w || (arcLabel._w = arcLabel.offsetWidth); proj(arc.getPoint(0.5), pt);
        arcLabel.style.transform = 'translate(' + (pt.sx - aw / 2).toFixed(1) + 'px,' + (pt.sy + 34).toFixed(1) + 'px)';  // just inside the arc
        placed.push({ x: pt.sx - aw / 2, y: pt.sy + 34, w: aw, h: 24 });
      }
      arcLabel.style.opacity = aeased;
      var nOp = clamp((t - T_NEW - 0.3) / 0.6, 0, 1);
      proj(nPos, pt);
      nLabel.x = clamp(pt.sx + 36 - nLabel.w, 8, W - nLabel.w - 8); nLabel.y = pt.sy + 34;
      nLabel.el.style.opacity = nOp; nLabel.el.style.transform = 'translate(' + nLabel.x.toFixed(1) + 'px,' + nLabel.y.toFixed(1) + 'px)';
      if (nOp > 0) { placed.push(nLabel); placed.push({ x: pt.sx - 32, y: pt.sy - 32, w: 64, h: 64 }); }  // the amber node keeps its own space
      labels.forEach(function (L) {
        if (L.isNew) return;
        var i = L.i, show = arrival(i) - 0.35, hide = arrival(i) + 0.9, state, op = 0;
        if (t < O0) { state = (t >= show && t < hide) ? 'cur' : 'hidden'; if (state === 'cur') op = clamp(Math.min(t - show, hide - t) / 0.3, 0, 1); }
        else { state = 'short'; op = shortOp; }
        setState(L, state === 'hidden' ? 'short' : state);
        L.op = op; L.state = state; L.el.style.opacity = op; L.ld.style.opacity = 0;
        if (op <= 0) return;
        proj(pos[i], pt);
        if (state === 'cur') {
          L.x = clamp(pt.sx - 16, 8, W - L.w - 8); L.y = clamp(pt.sy - L.h - 120, 8, H - L.h - 8); // above the line, clear of the beam
          L.el.style.transform = 'translate(' + L.x.toFixed(1) + 'px,' + L.y.toFixed(1) + 'px)';
        } else { L.sx = pt.sx; L.sy = pt.sy; vis.push(L); }
      });
      if (aeased > 0) for (var q = 0; q <= 32; q++) { var u = aeased * q / 32; proj(arc.getPoint(u), pt); placed.push({ x: pt.sx - 5, y: pt.sy - 5, w: 10, h: 10 }); }
      vis.sort(function (p, q) { return p.sx - q.sx; });
      vis.forEach(function (L) {
        var off = 22, done = false, hit = function () {  // stay inside the stage and above the year axis
          return L.y < 8 || L.y + L.h > axisY - 10 || placed.some(function (o) { return overlap(L, o, 14); }); };
        if (L.i === data.length - 1) { L.x = L.sx + 28; L.y = L.sy - L.h / 2; if (!hit() && L.x + L.w < W + 100) { done = true; L.cs = 0; } }  // last paper: inline past the line's end, using the slide's side padding if needed
        for (var g = 0; g < 24 && !done; g++) for (var sd = 0; sd < 2 && !done; sd++) for (var ax = 0; ax < 3 && !done; ax++) {
          var side = sd ? -L.side : L.side;
          L.x = clamp(ax === 0 ? L.sx - L.w / 2 : ax === 1 ? L.sx - 12 : L.sx - L.w + 12, 8, W - L.w - 8);
          L.y = side < 0 ? L.sy - off - L.h - g * 8 : L.sy + off + g * 8;
          if (!hit()) { done = true; L.cs = side; }
        }
        if (!done) { L.cs = L.side; L.x = clamp(L.sx - L.w / 2, 8, W - L.w - 8); L.y = L.side < 0 ? L.sy - off - L.h : L.sy + off; }
        placed.push(L);
        L.el.style.transform = 'translate(' + L.x.toFixed(1) + 'px,' + L.y.toFixed(1) + 'px)';
        var y1 = L.cs < 0 ? L.y + L.h : L.sy + 8, y2 = L.cs < 0 ? L.sy - 8 : L.cs === 0 ? 0 : L.y;  // inline labels need no leader
        if (y2 > y1) { L.ld.style.transform = 'translate(' + L.sx.toFixed(1) + 'px,' + y1.toFixed(1) + 'px)'; L.ld.style.height = (y2 - y1).toFixed(1) + 'px'; L.ld.style.opacity = 0.35 * L.op; }
      });
      renderer.render(scene, camera);
    }

    function loop(now) {
      if (!playing) return;
      render((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    }
    function play() {
      cancelAnimationFrame(raf);
      resize();
      if (rm) { playing = false; render(TOTAL); return; }
      playing = true; t0 = performance.now(); raf = requestAnimationFrame(loop);
    }
    function stop() { playing = false; cancelAnimationFrame(raf); }

    if (window.ResizeObserver) new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);
    resize(); render(rm ? TOTAL : 0.0);
    return { play: play, stop: stop, _render: render, TOTAL: TOTAL, _labels: labels, _yr: yrLabels };
  }

  window.HXChain3D = {
    create: function (container, chain, newest) {
      var inst = null, want = null;
      withThree(function () { inst = build(container, chain, newest); if (want === 'play') inst.play(); });
      return {
        play: function () { want = 'play'; if (inst) inst.play(); },
        stop: function () { want = 'stop'; if (inst) inst.stop(); },
        duration: TOTAL,
        _inst: function () { return inst; }
      };
    }
  };
})();
