/* chain3d.js: three.js descent-chain motion graphic. API: HXChain3D.create(container, chain, newest) -> {play, stop} */
(function () {
  'use strict';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js';
  var TOTAL = 24.6, A0 = 1.2, STEP = 2.0, TRAVEL = 1.1, O0 = 18.1, OVD = 2.4;
  var T_NEW = 20.6, T_ARC = 21.9, ARC_D = 0.9, T_IMP = T_ARC + ARC_D;
  var N = 9, TUB = 8 * 20, RAD = 6;
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
      '.hx3-ov{position:absolute;inset:0;overflow:hidden;pointer-events:none}' +
      '.hx3-l{position:absolute;left:0;top:0;opacity:0;transition:opacity .4s ease;color:#f2f5f7;' +
      'font-family:"Montserrat",system-ui,sans-serif;text-shadow:0 2px 12px #0a2530,0 0 3px #0a2530;will-change:transform}' +
      '.hx3-l .n{display:flex;align-items:center;gap:12px;font-family:"Wix Madefor Display","Montserrat",sans-serif;color:#f2f5f7}' +
      '.hx3-l .g{flex:none;min-width:1.5em;height:1.5em;border-radius:1em;display:inline-flex;align-items:center;justify-content:center;' +
      'font:700 .72em/1 "Montserrat",sans-serif;color:#0a2530;background:var(--c)}' +
      '.hx3-l b{font-weight:700}' +
      '.hx3-l .t,.hx3-l .c{display:none}' +
      '.hx3-l.cur{max-width:660px}.hx3-l.cur .n{font-size:32px}' +
      '.hx3-l.cur .t,.hx3-l.cur .c{padding-left:44px}.hx3-l.cur .t{display:block;font-size:20px;line-height:1.35;margin-top:8px}' +
      '.hx3-l.cur .c{display:block;font-size:18px;color:#a9bec7;margin-top:6px}' +
      '.hx3-l.past{max-width:210px}.hx3-l.past .n{font-size:17px;line-height:1.25}' +
      '.hx3-l.new{max-width:620px}.hx3-l.new .n{justify-content:flex-end}.hx3-l.new .n{font-size:30px;color:#f2c25a}' +
      '.hx3-l.new .t{display:block;font-size:19px;line-height:1.35;margin-top:8px}' +
      '.hx3-l.new .c{display:block;font-size:18px;color:#a9bec7;margin-top:6px}' +
      '.hx3-l .who{display:block;font-weight:700;color:#f2f5f7;font-family:"Wix Madefor Display","Montserrat",sans-serif;font-size:22px;margin-top:10px}';
    document.head.appendChild(st);
  }

  function ramp(t) {
    t = clamp(t, 0, 1);
    var s = t * 2, i = Math.min(1, Math.floor(s)), f = s - i, a = RAMP[i], b = RAMP[i + 1];
    return [lerp(a[0], b[0], f) / 255, lerp(a[1], b[1], f) / 255, lerp(a[2], b[2], f) / 255];
  }
  function trunc(s, n) { if (s.length <= n) return s; var c = s.slice(0, n - 1), k = c.lastIndexOf(' '); return (k > n - 14 ? c.slice(0, k) : c).trim() + '\u2026'; }

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
    var camera = new T.PerspectiveCamera(36, 2.4, 0.1, 200);
    var W = 1680, H = 700;
    function resize() {
      var r = container.getBoundingClientRect();
      W = container.clientWidth || r.width || 1680; H = container.clientHeight || r.height || 700;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(Math.max(2, Math.round(r.width || W)), Math.max(2, Math.round(r.height || H)), false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      if (!playing) render(curT);
    }

    // textures
    function glowTex() {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return new T.CanvasTexture(c);
    }
    var gtex = glowTex();

    // node positions: descending spiral receding into depth
    var pos = data.map(function (_, i) {
      var a = i * 0.85;
      return new T.Vector3(Math.cos(a) * 3.4, -i * 0.6 + Math.sin(a) * 0.9, -i * 4.0);
    });
    var yearT = data.map(function (d) { return (d.year - 2016) / 10; });
    function colAt(f) { var i = Math.min(7, Math.floor(f)); return ramp(lerp(yearT[i], yearT[i + 1], f - i)); }
    var nodeCol = data.map(function (d, i) { return ramp(yearT[i]); });

    var curve = new T.CatmullRomCurve3(pos, false, 'catmullrom', 0.5);
    curve.getPointAt = curve.getPoint; curve.getTangentAt = curve.getTangent; // uniform in node index

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
    function lite(c, k) { return [lerp(c[0], 1, k), lerp(c[1], 1, k), lerp(c[2], 1, k)]; }
    var pathCore = tube(curve, TUB, 0.022, RAD, function (u) { return lite(colAt(u * 8), 0.15); }, 0.9);
    var pathGlow = tube(curve, TUB, 0.09, RAD, function (u) { return colAt(u * 8); }, 0.14);
    function setDraw(m, u, segs, radial) { m.geometry.setDrawRange(0, Math.floor(clamp(u, 0, 1) * segs) * radial * 6); }

    // nodes
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
    var nPos = new T.Vector3(-1, 5.5, -38);
    var nNode = mkNode(AMBER, 0.42, new T.Color(1, 0.82, 0.45)); nNode.core.position.copy(nPos); nNode.glow.position.copy(nPos);

    // head light
    var head = new T.Sprite(new T.SpriteMaterial({ map: gtex, color: 0xffffff, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    head.visible = false; scene.add(head);

    // arc
    var ctrl = pos[0].clone().add(nPos).multiplyScalar(0.5); ctrl.y += 9.5; ctrl.z += 9; ctrl.x += 2;
    var arc = new T.QuadraticBezierCurve3(nPos, ctrl, pos[0]);
    arc.getPointAt = arc.getPoint; arc.getTangentAt = arc.getTangent;
    var ARC_SEG = 100;
    var arcCore = tube(arc, ARC_SEG, 0.05, RAD, function () { return [1, 0.84, 0.5]; }, 1);
    var arcGlow = tube(arc, ARC_SEG, 0.2, RAD, function () { return AMBER_HI; }, 0.2);
    var arcHead = new T.Sprite(new T.SpriteMaterial({ map: gtex, color: 0xffd27a, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    arcHead.visible = false; scene.add(arcHead);

    // stars
    var SN = 450, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
    for (var s = 0; s < SN; s++) {
      sp[s * 3] = (Math.random() - 0.5) * 70; sp[s * 3 + 1] = -24 + Math.random() * 36; sp[s * 3 + 2] = -55 + Math.random() * 70;
      var b = 0.25 + Math.random() * 0.45; sc[s * 3] = 0.66 * b; sc[s * 3 + 1] = 0.75 * b; sc[s * 3 + 2] = 0.78 * b;
    }
    var sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('color', new T.BufferAttribute(sc, 3));
    var stars = new T.Points(sg, new T.PointsMaterial({ size: 0.12, vertexColors: true, map: gtex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    stars.frustumCulled = false; scene.add(stars);

    // bursts (particles + ring)
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
      return { t0: t0, upd: function (t) {
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
    for (var bi = 0; bi < N; bi++) bursts.push(mkBurst(pos[bi], lite(nodeCol[bi], 0.2), 60, 3.2, 0.16, 2.4 + nodes[bi].r * 2, bi === 0 ? 0.5 : arrival(bi)));
    var impact = mkBurst(pos[0], AMBER_HI, 140, 8, 0.7, 7, T_IMP);
    bursts.push(impact);

    // labels
    var labels = [];
    function mkLabel(d, i, isNew) {
      var el = document.createElement('div'); el.className = 'hx3-l';
      var c = isNew ? AMBER_HI : nodeCol[i], css = 'rgb(' + c.map(function (v) { return Math.round(v * 255); }).join(',') + ')';
      el.style.setProperty('--c', css);
      var nm = isNew ? 'Newest citer, ' + (d.date || d.year) : '<span class="g">' + (i === 0 ? '★' : i) + '</span><b></b>';
      el.innerHTML = '<div class="n">' + nm + '</div><div class="t"></div><div class="c"></div>';
      var q = function (s) { return el.querySelector(s); };
      var title = trunc(d.title, 70);
      if (isNew) {
        var who = document.createElement('span'); who.className = 'who'; who.textContent = d.who + ' (' + d.year + ')';
        q('.n').appendChild(document.createElement('span')); q('.n').lastChild.remove();
        el.insertBefore(who, q('.t')); who.style.display = 'block';
        q('.t').textContent = title; q('.c').textContent = '';
      } else {
        q('b').textContent = d.who + ' (' + d.year + ')'; q('.t').textContent = title;
        q('.c').textContent = d.cites.toLocaleString('en-CA') + (d.cites === 1 ? ' citation' : ' citations');
      }
      overlay.appendChild(el);
      return { el: el, st: '', w: 0, h: 0, i: i, isNew: isNew };
    }
    data.forEach(function (d, i) { labels.push(mkLabel(d, i, false)); });
    var nLabel = mkLabel(newest, 9, true); labels.push(nLabel);
    function setState(L, st) {
      if (L.st === st) return;
      L.st = st;
      L.el.className = 'hx3-l ' + (st === 'hidden' ? 'past' : st);
      L.el.style.opacity = st === 'hidden' ? 0 : 1;
      L.w = L.el.offsetWidth; L.h = L.el.offsetHeight;
    }

    // camera
    var cPos = new T.Vector3(), cLook = new T.Vector3(), v = new T.Vector3(), v2 = new T.Vector3();
    var OV_C = new T.Vector3(0, 0.6, -17.8);
    function focusF(t) {
      var f = 0;
      for (var k = 1; k <= 8; k++) {
        var s = arrival(k) - TRAVEL;
        if (t >= s) f = (k - 1) + eio((t - s) / TRAVEL);
      }
      return f;
    }
    function setCamera(t, f) {
      var tg = curve.getPoint(f / 8), ah = curve.getPoint(Math.min(1, (f + 0.5) / 8));
      var dolly = 1 + 0.45 * (1 - eio(t / A0));
      cLook.copy(tg).lerp(ah, 0.3); cLook.x += 1.9;
      var ang = f * 0.3;
      cPos.set(tg.x + 1.0 + Math.sin(ang) * 1.8, tg.y + 1.1, tg.z + 11.0 * dolly);
      var m = eio((t - O0) / OVD);
      if (m > 0) {
        var th = 0.5 + 0.012 * Math.max(0, t - O0);
        v.set(OV_C.x + 34 * Math.cos(th), OV_C.y + 8, OV_C.z + 34 * Math.sin(th));
        cPos.lerp(v, m); cLook.lerp(OV_C, m);
      }
      camera.position.copy(cPos); camera.lookAt(cLook);
      return m;
    }

    var curT = 0, playing = false, raf = 0, t0 = 0;
    function render(t) {
      curT = t;
      var f = focusF(t), m = setCamera(t, f);
      camera.updateMatrixWorld();
      var rev = t >= O0 ? 1 : f / 8;
      setDraw(pathCore, rev, TUB, RAD); setDraw(pathGlow, rev, TUB, RAD);

      // nodes
      for (var i = 0; i < N; i++) {
        var st = i === 0 ? 0 : arrival(i) - TRAVEL + 0.25, a = eio((t - st) / 0.6), n = nodes[i], on = a > 0.001;
        n.core.visible = n.glow.visible = on;
        if (!on) continue;
        var pulse = 1 + 0.06 * Math.sin(t * 2.2 + i);
        var boost = (i === 0 && t > T_IMP) ? 1 + 1.6 * Math.exp(-(t - T_IMP) * 2.2) : 1;
        var cur = (t - arrival(i) > -0.3 && t - arrival(i) < 1.2) ? 1 + 0.4 * Math.exp(-Math.abs(t - arrival(i)) * 2) : 1;
        var big = 1 + (i === 0 ? 0.35 : 0) * 0;
        n.core.scale.setScalar(n.r * a * big * (1 + 0.15 * (boost - 1)));
        n.glow.scale.setScalar(n.r * 6.5 * a * pulse * cur * boost);
      }
      // head light
      var hv = t < O0 && f > 0.01 && f < 8;
      head.visible = hv;
      if (hv) { head.position.copy(curve.getPoint(f / 8)); var hs = 1.1 * Math.min(1, Math.sin(Math.PI * (f % 1)) * 3 + 0.0); head.scale.setScalar(0.4 + hs); }

      // newest
      var na = eio((t - T_NEW) / 0.7), nOn = na > 0.001;
      nNode.core.visible = nNode.glow.visible = nOn;
      if (nOn) {
        var pu = 1 + 0.25 * Math.sin((t - T_NEW) * 5.5);
        nNode.core.scale.setScalar(nNode.r * na * (0.9 + 0.2 * pu)); nNode.glow.scale.setScalar(4.5 * na * pu);
      }
      var au = t >= T_ARC ? clamp((t - T_ARC) / ARC_D, 0, 1) : 0, aeased = au * au * (3 - 2 * au);
      setDraw(arcCore, aeased, ARC_SEG, RAD); setDraw(arcGlow, aeased, ARC_SEG, RAD);
      if (t >= T_ARC) {
        var hu = au < 1 ? aeased : ((t - T_IMP) / 1.6) % 1;
        arcHead.visible = true; arcHead.position.copy(arc.getPoint(hu)); arcHead.scale.setScalar(au < 1 ? 2.6 : 1.6 * Math.sin(Math.PI * hu) + 0.3);
      } else arcHead.visible = false;

      bursts.forEach(function (b) { b.upd(t); });
      stars.rotation.y = t * 0.006; stars.position.y = Math.sin(t * 0.1) * 0.6; stars.position.x = t * -0.05;

      // labels
      var pxu = H / (2 * Math.tan(camera.fov * Math.PI / 360));
      labels.forEach(function (L) {
        var i = L.i, p3, state;
        if (L.isNew) { state = t > T_NEW + 0.5 ? 'new' : 'hidden'; p3 = nPos; }
        else {
          p3 = pos[i];
          var show = i === 0 ? 0.3 : arrival(i) - 0.5, shrink = i === 8 ? O0 : arrival(i) + TRAVEL - 0.2;
          if (i === 0) shrink = arrival(1) - TRAVEL;
          state = t < show ? 'hidden' : (t < shrink ? 'cur' : 'past');
          if (state === 'cur' && t >= O0) state = 'past';
        }
        setState(L, state);
        if (state === 'hidden') return;
        v2.copy(p3).project(camera);
        var behind = v2.z > 1;
        var sx = (v2.x * 0.5 + 0.5) * W, sy = (-v2.y * 0.5 + 0.5) * H;
        var dist = camera.position.distanceTo(p3), off = (L.isNew ? 0.42 : nodes[i].r) * pxu / dist * 1.0 + 20;
        var rx = sx + off, ry = sy - L.h / 2;
        var cx = sx - L.w / 2, cy = (i % 2 ? sy - off - L.h - 6 : sy + off + 2);
        var x = lerp(rx, cx, m), y = lerp(ry, cy, m);
        if (i === 8) x += lerp(0, 46, m);
        if (i === 1) x += lerp(0, 34, m);
        if (L.isNew) { x = sx + 40 - L.w; y = sy + 50; }
        x = clamp(x, 8, W - L.w - 8); y = clamp(y, 8, H - L.h - 8);
        L.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        L.el.querySelector('.n').style.justifyContent = L.isNew ? 'flex-end' : (m > 0.5 ? 'center' : 'flex-start');
        L.el.style.textAlign = L.isNew ? 'right' : (m > 0.5 ? 'center' : 'left');
        var op = behind ? 0 : (state === 'past' ? lerp(0.55, 1, m) : 1);
        if (L.isNew) op = 1;
        L.el.style.opacity = op;
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
    return { play: play, stop: stop, _render: render, TOTAL: TOTAL };
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
