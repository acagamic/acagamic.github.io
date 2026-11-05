// Shared motion-graphics engine for the Hexad scale impact site (index.html) and talk deck (talk.html).
const HX = (() => {
  const css = (n, el = document.documentElement) => getComputedStyle(el).getPropertyValue(n).trim();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = d3.format(',');
  const load = () => fetch('data/hexad.json').then(r => r.json());

  function countUp(el, to, dur = 1800) {
    if (reduced) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), from = 0;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Tooltip shared by every chart on the page.
  let tip;
  function tooltip(html, ev) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'hx-tip'; document.body.appendChild(tip); }
    if (!html) { tip.style.opacity = 0; return; }
    tip.innerHTML = html; tip.style.opacity = 1;
    const x = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + 'px'; tip.style.top = (ev.clientY + 14) + 'px';
  }

  // Rounded-top bar path anchored to the baseline.
  const barPath = (x, y, w, h, r = 4) => {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  // Citations per year. series: 'd1' direct, 'd2' second ring. Animates bar by bar with a year ticker.
  function yearBars(host, data, { series = ['d1'], ticker, W = 1000, H = 460, stagger = 260, ramp = false } = {}) {
    host.innerHTML = '';
    const rows = data.years.map(([y, a, b]) => ({ y, d1: a, d2: b }));
    const m = { t: 30, r: 20, b: 44, l: 20 };
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Papers per year citing the Hexad scale paper' + (series.includes('d2') ? ' and papers citing those papers' : ''));
    const x = d3.scaleBand(rows.map(r => r.y), [m.l, W - m.r]).padding(0.22);
    const max = d3.max(rows, r => d3.max(series, s => r[s]));
    const y = d3.scaleLinear([0, max * 1.12], [H - m.b, m.t]);
    const bw = x.bandwidth() / series.length;
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).attr('class', 'hx-axis');
    svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'hx-tick')
      .attr('x', r => x(r.y) + x.bandwidth() / 2).attr('y', H - m.b + 26).attr('text-anchor', 'middle').text(r => r.y === 2026 ? '2026 so far' : r.y);
    const groups = series.map((s, si) => {
      const g = svg.append('g');
      const bars = g.selectAll('path').data(rows).join('path')
        .attr('class', r => `hx-bar hx-${s}` + (r.y === 2026 ? ' hx-partial' : ''))
        .attr('d', r => barPath(x(r.y) + si * bw + (si ? 1 : 0), H - m.b, bw - 2, 0));
      const labels = g.selectAll('text').data(rows).join('text').attr('class', 'hx-val')
        .attr('x', r => x(r.y) + si * bw + bw / 2).attr('y', r => y(r[s]) - 8).attr('text-anchor', 'middle')
        .style('opacity', 0).text(r => fmt(r[s]));
      // ramp: colour each year on the site's time scale (cyan 2016 to magenta 2026)
      if (ramp) { const c = d3.piecewise(d3.interpolateLab, ['--series-1', '--ramp-mid', '--series-2'].map(v => css(v, host)));
        bars.style('fill', (r, i) => c(i / (rows.length - 1))).style('opacity', r => r.y === 2026 ? 0.5 : 1); }  // 2026 is a partial year
      return { s, si, bars, labels };
    });
    // Hit targets wider than the marks.
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', r => x(r.y) - 4).attr('width', x.bandwidth() + 8)
      .attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev, r) => tooltip(`<b>${r.y}${r.y === 2026 ? ' (to Nov 4)' : ''}</b><br>${fmt(r.d1)} cite the Hexad scale paper` +
        (series.includes('d2') ? `<br>${fmt(r.d2)} cite those papers` : ''), ev))
      .on('pointerleave', () => tooltip(null));

    function play() {
      groups.forEach(({ s, si, bars, labels }) => {
        const base = si * rows.length * stagger * 0.55;
        bars.interrupt().attr('d', r => barPath(x(r.y) + si * bw + (si ? 1 : 0), H - m.b, bw - 2, 0))
          .transition().delay((r, i) => reduced ? 0 : base + i * stagger).duration(reduced ? 0 : 700).ease(d3.easeCubicOut)
          .attrTween('d', function (r) {
            const hEnd = H - m.b - y(r[s]);
            return t => barPath(x(r.y) + si * bw + (si ? 1 : 0), H - m.b - hEnd * t, bw - 2, hEnd * t);
          })
          .on('start', (r) => { if (ticker && si === series.length - 1) ticker.textContent = r.y; });
        labels.interrupt().style('opacity', 0).transition().delay((r, i) => reduced ? 0 : base + i * stagger + 500).duration(300).style('opacity', 1);
      });
    }
    return { play };
  }

  // Horizontal bars for countries or citation sources.
  function hbars(host, rows, { W = 900, rowH = 34, label = r => r[0], value = r => r[1], cls = 'hx-d1', stagger = 70, lw: LW = 210, fs = 17, bar = 1 } = {}) {
    host.innerHTML = '';
    const H = rows.length * rowH + 10, lw = LW, bh = (rowH - 12) * bar, by = (rowH - bh) / 2;
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const x = d3.scaleLinear([0, d3.max(rows, value)], [0, W - lw - 70]);
    const g = svg.selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${i * rowH})`);
    g.append('text').attr('class', 'hx-lab').style('font-size', fs + 'px').attr('x', lw - 16).attr('y', rowH / 2 + fs * 0.35).attr('text-anchor', 'end').text(label);
    const bars = g.append('rect').attr('class', `hx-bar ${cls}`).attr('x', lw).attr('y', by).attr('height', bh).attr('rx', Math.min(6, bh / 2)).attr('width', 0);
    const vals = g.append('text').attr('class', 'hx-val').style('font-size', Math.round(fs * 0.9) + 'px').attr('y', rowH / 2 + fs * 0.32).attr('x', lw + 8).style('opacity', 0).text(r => fmt(value(r)));
    function play() {
      bars.interrupt().attr('width', 0).transition().delay((r, i) => reduced ? 0 : i * stagger).duration(reduced ? 0 : 800).ease(d3.easeCubicOut).attr('width', r => x(value(r)));
      vals.interrupt().style('opacity', 0).attr('x', r => lw + x(value(r)) + 10).transition().delay((r, i) => reduced ? 0 : i * stagger + 750).duration(300)
        .style('opacity', 1).attr('x', r => lw + x(value(r)) + 10);
    }
    return { play };
  }

  // Descent chain: one most-cited descendant per generation.
  function chain(host, data, { W = 1200, H = 560, stagger = 700 } = {}) {
    host.innerHTML = '';
    const c = data.chain, n = c.length;
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', `A chain of ${n - 1} generations of citing papers starting from the Hexad scale paper`);
    const px = i => 70 + i * (W - 640) / (n - 1), py = i => 90 + i * (H - 200) / (n - 1);
    const r = d => 6 + Math.sqrt(d.cites) * 0.55;
    const link = svg.append('path').attr('class', 'hx-chain')
      .attr('d', d3.line().curve(d3.curveCatmullRom)(c.map((d, i) => [px(i), py(i)])));
    const len = link.node().getTotalLength();
    const g = svg.selectAll('g.n').data(c).join('g').attr('class', 'n').attr('transform', (d, i) => `translate(${px(i)},${py(i)})`).style('opacity', 0);
    g.append('circle').attr('r', r).attr('class', (d, i) => i === 0 ? 'hx-origin' : i === 1 ? 'hx-node1' : i === 2 ? 'hx-node2' : 'hx-node3');
    g.append('text').attr('class', 'hx-gen').attr('x', d => -r(d) - 10).attr('y', 5).attr('text-anchor', 'end').text((d, i) => i ? `${i}` : '');
    const t = g.append('text').attr('class', 'hx-lab').attr('x', d => r(d) + 12).attr('y', -4);
    t.append('tspan').attr('class', 'hx-strong').text(d => `${d.who} ${d.year}`);
    t.append('tspan').attr('x', d => r(d) + 12).attr('dy', 18).attr('class', 'hx-muted')
      .text(d => (d.title.length > 58 ? d.title.slice(0, 56) + '…' : d.title) + ` · ${fmt(d.cites)} citations`);
    function play() {
      link.interrupt().attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().duration(reduced ? 0 : stagger * n).ease(d3.easeLinear).attr('stroke-dashoffset', 0);
      g.interrupt().style('opacity', 0).transition().delay((d, i) => reduced ? 0 : i * stagger).duration(400).style('opacity', 1);
    }
    return { play };
  }

  // The six user types and the motivation each one scores (Tondello et al., 2016).
  const TYPES = [['Philanthropist', 'purpose'], ['Socialiser', 'belonging'], ['Free Spirit', 'freedom'],
    ['Achiever', 'mastery'], ['Player', 'rewards'], ['Disruptor', 'change']];
  function hexagon(host, { W = 900, H = 640, R: R0 = 220, profile = null, desc = null } = {}) {
    host.innerHTML = '';
    const R = R0, cx = W / 2, cy = H / 2;
    const pts = TYPES.map((t, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, a]; });
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Hexagon of six user types: ' + TYPES.map(t => `${t[0]} (${t[1]})`).join(', '));
    const poly = svg.append('polygon').attr('points', pts.map(p => p.slice(0, 2).join(',')).join(' '));
    const len = R * 6;
    const g = svg.selectAll('g').data(TYPES).join('g').attr('transform', (d, i) => `translate(${pts[i][0]},${pts[i][1]})`).style('opacity', 0);
    g.append('circle').attr('r', 9);
    const lab = g.append('text').attr('text-anchor', (d, i) => [1, 2].includes(i) ? 'start' : [4, 5].includes(i) ? 'end' : 'middle')
      .attr('transform', (d, i) => { const a = pts[i][2]; return `translate(${Math.cos(a) * 30},${Math.sin(a) * 30 + (i === 0 ? -14 : i === 3 ? 22 : 0)})`; });
    lab.append('tspan').attr('class', 'ty').text(d => d[0]);
    lab.append('tspan').attr('class', 'mo').attr('x', 0).attr('dy', 22).text(d => d[1]);
    // Optional profile: one person's six scores as a filled shape growing from the centre.
    let shape = null;
    if (profile) {
      const at = (v, i) => [cx + Math.cos(pts[i][2]) * R * v, cy + Math.sin(pts[i][2]) * R * v];
      shape = svg.insert('polygon', 'g').attr('class', 'hx-profile');
      shape.datum(profile);
      shape.at = at;
    }
    // Optional explainer: each vertex pulses while a centre card says what that type wants.
    let card = null;
    if (desc) {
      card = svg.append('g').attr('class', 'hx-card').attr('transform', `translate(${cx},${cy})`).style('opacity', 0);
      card.append('rect').attr('x', -190).attr('y', -96).attr('width', 380).attr('height', 192).attr('rx', 20);
      card.append('text').attr('class', 'hx-card-t').attr('text-anchor', 'middle').attr('y', -40);
      card.append('text').attr('class', 'hx-card-d').attr('text-anchor', 'middle').attr('y', 0);
    }
    const wrap = (t, n = 30) => t.split(' ').reduce((L, w) => { const l = L.at(-1); (l + ' ' + w).trim().length > n ? L.push(w) : (L[L.length - 1] = (l + ' ' + w).trim()); return L; }, ['']);
    // Presenter-driven steps: show(i) fades in type i's card and pulses its vertex; grow() draws the profile.
    function show(i) {
      if (!card) return;
      const [t] = TYPES[i];
      card.interrupt().transition().duration(110).style('opacity', 0).on('end', () => {
        card.select('.hx-card-t').text(t);
        const d = card.select('.hx-card-d').text(null);
        wrap(desc[t]).forEach((l, k) => d.append('tspan').attr('x', 0).attr('dy', k ? 30 : 0).text(l));
        card.attr('transform', `translate(${cx},${cy}) scale(.9)`).transition().duration(420).ease(d3.easeBackOut)
          .attr('transform', `translate(${cx},${cy}) scale(1)`).style('opacity', 1);
      });
      g.select('circle').interrupt().transition().duration(300).attr('r', (d, j) => j === i ? 22 : 9);
    }
    function grow() {
      if (card) card.interrupt().transition().duration(300).style('opacity', 0);
      if (shape && !shape.tag) {
        // Label the shape so nobody reads it as data: it is one example person.
        shape.tag = svg.append('g').attr('class', 'hx-example').style('opacity', 0).attr('transform', `translate(${cx + R * 0.5},${cy + R * 0.9})`);  // outside the shape, below the Achiever to Free Spirit edge
        shape.tag.append('text').attr('class', 'hx-halo').attr('text-anchor', 'start').attr('y', 6).text('Example: one person’s scores');
      }
      shape?.tag?.interrupt().style('opacity', 0).transition().delay(reduced ? 0 : 900).duration(500).style('opacity', 1);
      g.select('circle').interrupt().transition().duration(300).attr('r', 9);
      if (shape) shape.interrupt().transition().duration(reduced ? 0 : 1600).ease(d3.easeElasticOut.amplitude(1).period(0.5))
        .attr('points', profile.map((v, i) => shape.at(v, i).join(',')).join(' '));
    }
    function play() {
      if (card) card.interrupt().style('opacity', 0);
      if (shape) shape.interrupt().attr('points', profile.map((v, i) => shape.at(0, i).join(',')).join(' '));
      shape?.tag?.interrupt().style('opacity', 0);
      poly.interrupt().attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().duration(reduced ? 0 : 1600).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
      g.interrupt().style('opacity', 0).transition().delay((d, i) => reduced ? 0 : 250 + i * 260).duration(450).style('opacity', 1);
    }
    return { play, show, grow };
  }

  // Radial citation network on canvas. Angle is time (papers in publication order, clockwise from 12 o'clock),
  // rings are citation degrees. Live expansion fetches deeper rings from OpenAlex.
  class Net {
    constructor(canvas, data, { onSelect, onHover, onDepth, interactive = true } = {}) {
      Object.assign(this, { canvas, data, onSelect, onHover, onDepth });
      this.ctx = canvas.getContext('2d');
      this.k = d3.zoomIdentity; this.T = 2027; this.T2 = 2027; this.ring2 = true; this.focus = null; this.hover = null;
      this.rand = d3.randomLcg(42);
      this.build();
      this.resize(); new ResizeObserver(() => this.resize()).observe(canvas);
      // The deck drives zoom programmatically; the filter blocks wheel and drag there.
      this.zoom = d3.zoom().scaleExtent([0.15, 40]).filter(e => interactive && !e.button)
        .on('zoom', e => { this.k = e.transform; this.draw(); });
      d3.select(canvas).call(this.zoom).on('dblclick.zoom', null);
      if (interactive) {
        d3.select(canvas)
          .on('pointermove', e => this.pick(e, false)).on('click', e => this.pick(e, true))
          .on('pointerleave', () => { this.hover = null; this.onHover?.(null); this.draw(); });
      }
      this.fit(0);
    }
    build() {
      const { nodes, d2 } = this.data, N = nodes.length, span = Math.PI * 2 * 0.94, a0 = -Math.PI / 2 + Math.PI * 0.03;
      this.origin = { id: 'W2530695086', t: 'The Gamification User Types Hexad Scale', y: 2016, c: this.data.counts.openalex, a: 'Tondello et al.',
        v: 'CHI PLAY 2016', doi: '10.1145/2967934.2968082', deg: 0, x: 0, yy: 0, r: 16, kids: [], parents: [], ang: 0, rad: 0 };
      this.all = [this.origin]; this.byId = new Map([[this.origin.id, this.origin]]);
      this.d1 = nodes.map(([id, t, y, c, a, v, doi, k], i) => {
        const ang = a0 + (i + 0.5) / N * span, rad = 300 + ((i * 7) % 6) * 13;
        const n = { id, t, y, c, a, v, doi, deg: 1, ang, rad, x: Math.cos(ang) * rad, yy: Math.sin(ang) * rad,
          r: 1.6 + Math.sqrt(c) * 0.38, kids: [], parents: [this.origin] };
        this.origin.kids.push(n); this.all.push(n); this.byId.set(id, n); return n;
      });
      // Fractional year per paper so ring 1 sweeps in smoothly during the reveal.
      d3.groups(this.d1, n => n.y).forEach(([y, v]) => v.forEach((n, i) => { n.yf = y + i / v.length; }));
      // Year boundaries for the outer arc labels.
      this.yearArcs = d3.rollups(this.d1, v => [d3.min(v, n => n.ang), d3.max(v, n => n.ang), v.length], n => n.y);
      this.d2 = d2.map(([id, t, y, c, ps]) => {
        const par = ps.map(p => this.d1[p]);
        const ang = Math.atan2(d3.mean(par, p => Math.sin(p.ang)), d3.mean(par, p => Math.cos(p.ang))) + (this.rand() - 0.5) * 0.03;
        const rad = 540 + this.rand() * 200;
        const n = { id, t, y, c, deg: 2, ang, rad, x: Math.cos(ang) * rad, yy: Math.sin(ang) * rad, r: 0.9 + Math.min(9, Math.sqrt(c) * 0.22), kids: [], parents: par };
        par.forEach(p => p.kids.push(n)); this.all.push(n); this.byId.set(id, n); return n;
      });
      this.maxDeg = 2; this.index();
    }
    index() { this.qt = d3.quadtree(this.all.filter(n => this.visible(n)), n => n.x, n => n.yy); }
    visible(n) {
      if (n.deg === 0) return true;
      if (n.deg === 1) return n.yf <= this.T;
      if (n.deg === 2) return this.ring2 && n.y <= this.T2;
      return true;
    }
    resize() {
      const dpr = devicePixelRatio || 1, { width, height } = this.canvas.getBoundingClientRect();
      if (!width) return;
      this.w = width; this.h = height; this.canvas.width = width * dpr; this.canvas.height = height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.draw();
    }
    fit(dur = 900, extent = 800) {
      const s = Math.min(this.w, this.h) / (2 * extent);
      const t = d3.zoomIdentity.translate(this.w / 2 + this.w * (this.shiftX || 0), this.h / 2).scale(s);
      return this.go(t, dur);
    }
    zoomTo(n, scale = 3, dur = 1600) {
      const t = d3.zoomIdentity.translate(this.w / 2 + this.w * (this.shiftX || 0), this.h / 2).scale(scale).translate(-n.x, -n.yy);
      return this.go(t, dur);
    }
    go(t, dur) {
      const sel = d3.select(this.canvas);
      if (!dur || reduced) { sel.call(this.zoom.transform, t); return Promise.resolve(); }
      return sel.transition().duration(dur).ease(d3.easeCubicInOut).call(this.zoom.transform, t).end().catch(() => {});
    }
    // Animate the time reveal: ring 1 grows clockwise, then ring 2 fills in by year.
    reveal({ dur = 9000, ring2 = false, onYear, ease = d3.easeSinInOut } = {}) {
      this.ring2 = ring2; const from = 2016, to = 2027;
      return new Promise(res => {
        if (reduced) { this.T = this.T2 = to; this.index(); this.draw(); return res(); }
        const tm = d3.timer(el => {
          const p = Math.min(1, el / dur), v = from + (to - from) * ease(p);
          if (ring2) this.T2 = v; else { this.T = v; this.T2 = to; }
          onYear?.(Math.min(2026, Math.floor(v)));
          this.draw();
          if (p >= 1) { tm.stop(); this.index(); res(); }
        });
      });
    }
    setRing2(on) { if (this.ring2 === on && this.T2 === 2027) { this.draw(); return; }  // skip the index rebuild when nothing changed
      this.ring2 = on; this.T2 = 2027; this.index(); this.draw(); }
    colour(n) { return n.deg === 0 ? this.cOrigin : n.deg === 1 ? this.c1 : n.deg === 2 ? this.c2 : this.c3; }
    draw() {
      if (!this.w) return;
      const { ctx, k } = this;
      this.c1 = this.col('--series-1'); this.c2 = this.col('--series-2'); this.c3 = this.col('--series-3'); this.cOrigin = this.col('--ink');
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.save(); ctx.translate(k.x, k.y); ctx.scale(k.k, k.k);
      const lw = 1 / k.k, hl = this.focus || this.hover;
      const lit = hl ? new Set([hl, ...hl.parents, ...hl.kids]) : null;
      // Year arcs and labels
      ctx.lineWidth = 1.2 * lw; ctx.strokeStyle = this.col('--grid'); ctx.fillStyle = this.col('--muted');
      ctx.font = `600 ${13 * lw}px Montserrat, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [y, [a, b]] of this.yearArcs) {
        if (y > this.T || this.d1.filter(n => n.y === y).length < 5) continue;
        ctx.beginPath(); ctx.arc(0, 0, 395, a - 0.004, b + 0.004); ctx.stroke();
        const m = (a + b) / 2; ctx.fillText(y, Math.cos(m) * 415, Math.sin(m) * 415);
      }
      // Edges
      const edge = (a, b, alpha) => { ctx.globalAlpha = alpha; ctx.moveTo(a.x, a.yy); ctx.lineTo(b.x, b.yy); };
      for (const deg of [1, 2, 3]) {
        ctx.beginPath(); ctx.strokeStyle = deg === 1 ? this.c1 : deg === 2 ? this.c2 : this.c3; ctx.lineWidth = lw;
        if (this.stars && deg === 2) continue;  // race track: the faint second-ring links cost the most and read as haze
        ctx.globalAlpha = lit ? 0.025 : deg === 1 ? 0.16 : deg === 2 ? 0.045 : 0.35;
        for (const n of this.all) {
          if (n.deg !== deg && !(deg === 3 && n.deg > 3)) continue;
          if (!this.visible(n)) continue;
          for (const p of n.parents) { ctx.moveTo(p.x, p.yy); ctx.lineTo(n.x, n.yy); }
        }
        ctx.stroke();
      }
      if (lit) {
        ctx.beginPath(); ctx.globalAlpha = this.stars ? 0.25 : 0.9; ctx.lineWidth = 1.5 * lw; ctx.strokeStyle = this.cOrigin;
        for (const p of hl.parents) edge(p, hl, 0.9);
        for (const c of hl.kids) if (this.visible(c)) edge(hl, c, this.stars ? 0.25 : 0.9);
        ctx.stroke();
      }
      // Nodes, smallest last ring first so big hubs sit on top
      for (const n of this.all) {
        if (!this.visible(n)) continue;
        ctx.globalAlpha = lit && !lit.has(n) ? 0.12 : n.deg === 2 ? 0.75 : 0.95;
        ctx.fillStyle = this.colour(n);
        ctx.beginPath(); ctx.arc(n.x, n.yy, Math.max(n.r, 1.1 * lw), 0, Math.PI * 2); ctx.fill();
      }
      // Citation stars: the focused paper's citers flare up.
      if (hl && this.stars) {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = this.col('--brand-pink');
        // One path and one fill for every star: hub papers have hundreds of citers, and per-star fills drop frames.
        ctx.globalAlpha = 0.85; ctx.beginPath();
        for (const c of hl.kids) { if (!this.visible(c)) continue; const r = Math.max(c.r * 2.6, 4.5 * lw); ctx.moveTo(c.x + r, c.yy); ctx.arc(c.x, c.yy, r, 0, Math.PI * 2); }
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      // Arrival burst for the genealogy track.
      if (this.burst) {
        const b = this.burst, age = Math.min(1, (performance.now() - b.t0) / 1100), e = 1 - Math.pow(1 - age, 3);
        if (age < 0.09) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * (1 - age / 0.09); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, 26 * lw, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - age; ctx.strokeStyle = this.col('--brand-cyan'); ctx.lineWidth = 3 * lw * (1 - age) + lw;
        ctx.beginPath(); ctx.arc(b.x, b.y, (12 + 90 * e) * lw, 0, Math.PI * 2); ctx.stroke();
        for (const [a, sp, c] of b.sparks) {
          const e4 = 1 - Math.pow(1 - age, 4), r0 = (8 + 40 * e4 * sp) * lw, r1 = r0 + (6 + 22 * sp) * lw * (1 - age);
          ctx.globalAlpha = (1 - age) * 0.95; ctx.strokeStyle = c < 0.5 ? this.col('--brand-pink') : this.col('--brand-cyan'); ctx.lineWidth = 2 * lw;
          ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0); ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      // Highlighted papers (Hexad-12) keep their own colour and ring.
      for (const [n, v] of this.special || []) {
        if (!this.visible(n)) continue;
        ctx.globalAlpha = 1; ctx.fillStyle = css(v, this.canvas); ctx.strokeStyle = this.col('--ink'); ctx.lineWidth = 2 * lw;
        ctx.beginPath(); ctx.arc(n.x, n.yy, Math.max(n.r * 1.6, 6 * lw), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Comet trail for the genealogy track.
      if (this.comet && this.comet.length > 1) {
        const pts = this.comet; ctx.lineCap = 'round';
        for (let i = 1; i < pts.length; i++) {
          ctx.globalAlpha = i / pts.length; ctx.strokeStyle = this.col('--brand-cyan'); ctx.lineWidth = (1 + 4 * i / pts.length) * lw;
          ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
        }
        const [hx, hy] = pts.at(-1); ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(hx, hy, 5 * lw, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (hl) { ctx.lineWidth = 2 * lw; ctx.strokeStyle = this.col('--ink'); ctx.beginPath(); ctx.arc(hl.x, hl.yy, hl.r + 3 * lw, 0, Math.PI * 2); ctx.stroke(); }
      // Origin label
      ctx.fillStyle = this.col('--bg'); ctx.font = `700 5.5px Montserrat, sans-serif`; ctx.fillText('HEXAD', 0, -2.6); ctx.fillText('SCALE', 0, 3.6);
      ctx.restore();
    }
    pick(e, click) {
      const [mx, my] = d3.pointer(e, this.canvas), [x, y] = this.k.invert([mx, my]);
      const n = this.qt.find(x, y, 14 / this.k.k + 4);
      if (click) { this.focus = n || null; this.onSelect?.(n || null); }
      else { this.hover = n || null; this.onHover?.(n || null, e); this.canvas.style.cursor = n ? 'pointer' : 'grab'; }
      this.draw();
    }
    // Colours are read once per theme; reading styles inside the draw loop forces a style recalculation every frame.
    col(v) { const m = this._pal ??= new Map(); if (!m.has(v)) m.set(v, css(v, this.canvas)); return m.get(v); }
    pathTo(n) { const p = []; while (n) { p.unshift(n); n = n.parents[0]; } return p; }
    // Screen position of a paper, for HTML callouts layered over the canvas.
    screen(n) { return this.k.apply([n.x, n.yy]); }
    // Race-track genealogy: a comet runs clockwise along ring 1 from stop to stop; at each stop the paper's citers flare.
    async track(stops, { scale = 1.5, travel = 1100, hold = 1500, onStop } = {}) {
      this.stars = true; this.comet = [];
      const follow = (x, y) => {
        this.k = d3.zoomIdentity.translate(this.w / 2 + this.w * (this.shiftX || 0), this.h / 2).scale(scale).translate(-x, -y);
        d3.select(this.canvas).property('__zoom', this.k);
      };
      let prev = { ang: -Math.PI / 2, rad: 0, x: 0, yy: 0 };
      for (const s of stops) {
        const a0 = prev.ang, a1 = s.ang < a0 ? s.ang + Math.PI * 2 : s.ang, r0 = prev.rad, t0 = performance.now();
        this.focus = null;
        await new Promise(res => {
          const step = now => {
            const p = reduced ? 1 : Math.min(1, (now - t0) / travel), e = d3.easeCubicInOut(p);
            const a = a0 + (a1 - a0) * e, r = r0 + (s.rad - r0) * e, x = Math.cos(a) * r, y = Math.sin(a) * r;
            this.comet.push([x, y]); if (this.comet.length > 40) this.comet.shift();
            follow(x, y); this.draw();
            if (p < 1) requestAnimationFrame(step); else res();
          };
          requestAnimationFrame(step);
        });
        this.focus = s; onStop?.(s);
        // Arrival burst: a ring and a spray of sparks, redrawn every frame through the hold.
        const rnd = d3.randomLcg(s.x * 13 + s.yy);
        this.burst = { x: s.x, y: s.yy, t0: performance.now(), sparks: d3.range(30).map(() => [rnd() * Math.PI * 2, 0.4 + rnd() * 0.9, rnd()]) };
        await new Promise(res => {
          const end = performance.now() + (reduced ? 0 : hold);
          const loop = now => { this.draw(); if (now < end) requestAnimationFrame(loop); else res(); };
          requestAnimationFrame(loop);
        });
        this.burst = null;
        prev = s;
      }
      // stars stays on until the caller has finished its zoom-out, so the heavy links do not redraw every frame.
    }
    // Fetch the most-cited papers citing n and place them as the next ring, fanned outward around n.
    async expand(n, per = 30) {
      if (n.deg < 2 || n.expanded) return n.kids.length;
      const url = `https://api.openalex.org/works?filter=cites:${n.id}&sort=cited_by_count:desc&per-page=${per}` +
        '&select=id,display_name,publication_year,cited_by_count,doi,authorships,primary_location';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OpenAlex returned ${res.status}`);
      const js = await res.json();
      const fresh = js.results.filter(w => !this.byId.has(w.id.split('/').pop()));
      const m = fresh.length, spread = Math.min(0.9, 0.06 * m) / Math.max(1, n.deg - 1);
      fresh.forEach((w, j) => {
        const id = w.id.split('/').pop(), au = w.authorships || [];
        const ang = n.ang + (m > 1 ? (j / (m - 1) - 0.5) * spread : 0), rad = n.rad + 170;
        const c = { id, t: w.display_name, y: w.publication_year, c: w.cited_by_count, deg: n.deg + 1, ang, rad,
          a: au.length ? au[0].author.display_name.split(' ').pop() + (au.length > 1 ? ' et al.' : '') : '',
          v: w.primary_location?.source?.display_name || '', doi: (w.doi || '').replace('https://doi.org/', ''),
          x: Math.cos(ang) * rad, yy: Math.sin(ang) * rad, r: 1.6 + Math.min(10, Math.sqrt(w.cited_by_count) * 0.3), kids: [], parents: [n] };
        n.kids.push(c); this.all.push(c); this.byId.set(id, c);
      });
      // Papers already on the map gain an extra parent edge.
      js.results.forEach(w => { const o = this.byId.get(w.id.split('/').pop()); if (o && o !== n && !o.parents.includes(n) && o.deg > 0) o.parents.push(n); });
      n.expanded = true; n.total = js.meta.count;
      this.maxDeg = Math.max(this.maxDeg, n.deg + (m ? 1 : 0)); this.onDepth?.(this.maxDeg);
      this.index(); this.draw();
      return m;
    }
    // Follow the most-cited child downward, expanding live, up to maxDepth.
    async dive(start, maxDepth = 9, step = 1400) {
      let n = start;
      while (n && n.deg < maxDepth) {
        if (n.deg >= 2) await this.expand(n);
        const next = n.kids.filter(c => !c.dived && c.y >= n.y).sort((a, b) => b.c - a.c)[0];
        if (!next) break;
        next.dived = true; this.focus = next; this.onSelect?.(next);
        await this.zoomTo(next, Math.min(2.6, 1.2 + next.deg * 0.2), step);
        n = next;
      }
      return n;
    }
  }

  // ---- 2016 study charts (data/study2016.json) ----

  // Hero: one particle per citing paper drifts in and lands on a hexagon, oldest papers first.
  // Colour runs cyan (2016) to pink to magenta (2026); the pointer pushes particles aside.
  function heroField(canvas, data) {
    const ctx = canvas.getContext('2d'), rnd = d3.randomLcg(11);
    const col = d3.scaleLinear([2016, 2021, 2026], ['--brand-cyan', '--brand-pink', '--brand-magenta'].map(v => css(v))).interpolate(d3.interpolateRgb).clamp(true);
    const N = data.nodes.length;
    const P = data.nodes.map(([, , y, c], i) => {
      const t = (i / N + rnd() * 0.004) * 6, k = Math.floor(t) % 6, f = t - Math.floor(t);
      const a0 = -Math.PI / 2 + k * Math.PI / 3, a1 = a0 + Math.PI / 3, inset = 1 - Math.pow(rnd(), 2.2) * 0.32;
      return { tx: (Math.cos(a0) * (1 - f) + Math.cos(a1) * f) * inset, ty: (Math.sin(a0) * (1 - f) + Math.sin(a1) * f) * inset,
        sx: rnd() * 2 - 1, sy: rnd() * 2 - 1, r: 1.8 + Math.min(5.5, Math.sqrt(c) * 0.26), col: col(y), d: i / N, ph: rnd() * 6.28, x: 0, y: 0, vx: 0, vy: 0 };
    });
    let w, h, cx, cy, R, sc = 1, mx = -1e4, my = -1e4, t0 = performance.now(), on = true, raf;
    const size = () => {
      const dpr = devicePixelRatio || 1, b = canvas.getBoundingClientRect(); w = b.width; h = b.height;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const wide = w > 900; cx = wide ? w * 0.74 : w / 2; cy = wide ? h * 0.5 : h * 0.17; R = wide ? Math.min(h * 0.36, w * 0.2) : Math.min(w * 0.22, h * 0.1); sc = wide ? 1 : 0.5;  // phones: smaller hexagon above the headline, clear of the text
    };
    const ease = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
    function frame(now) {
      const el = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        const e = reduced ? 1 : ease(Math.max(0, (el - p.d * 1.6) / 1.8));
        const bx = cx + R * (p.sx * 1.6 * (1 - e) + p.tx * e) + Math.sin(el * 0.6 + p.ph) * 3 * e;
        const by = cy + R * (p.sy * 1.2 * (1 - e) + p.ty * e) + Math.cos(el * 0.5 + p.ph) * 3 * e;
        const dx = bx + p.vx - mx, dy = by + p.vy - my, d2 = dx * dx + dy * dy;
        if (d2 < 9000) { const f = (9000 - d2) / 9000 * 2.2, d = Math.sqrt(d2) || 1; p.vx += dx / d * f; p.vy += dy / d * f; }
        p.vx *= 0.9; p.vy *= 0.9; p.x = bx + p.vx; p.y = by + p.vy;
        ctx.globalAlpha = 0.35 + 0.65 * e; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * sc, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (on && !reduced) raf = requestAnimationFrame(frame);
    }
    size(); new ResizeObserver(() => { size(); if (reduced) frame(performance.now()); }).observe(canvas);
    canvas.parentElement.addEventListener('pointermove', e => { const b = canvas.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; });
    canvas.parentElement.addEventListener('pointerleave', () => { mx = my = -1e4; });
    // Pause off screen to save the laptop battery.
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } }).observe(canvas);
    return { replay: () => { t0 = performance.now(); } };
  }

  // Horizontal bars split into one segment per citing year, coloured on the site's time ramp (cyan 2016 → magenta 2026).
  // A year cursor sweeps left to right so every bar fills in the order its citations arrived.
  function timeBars(host, rows, { W = 1000, rowH = 46, label = r => r[0], total = r => r[1], years = r => r[2], sub = null, y0 = 2016, stagger = 0, legend = true, lw = 230 } = {}) {
    host.innerHTML = '';
    const top = legend ? 46 : 6, H = rows.length * rowH + top + 6, n = years(rows[0]).length;
    const by = sub ? rowH * 0.1 : rowH * 0.2, bh = sub ? rowH * 0.42 : rowH * 0.6;  // with a sub line, the bar shares the row with its citation
    const ramp = d3.piecewise(d3.interpolateLab, ['--series-1', '--ramp-mid', '--series-2'].map(v => css(v, host)));
    const colour = i => ramp(i / (n - 1));
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', rows.map(r => `${label(r)}: ${total(r)} citations`).join('; '));
    const x = d3.scaleLinear([0, d3.max(rows, total)], [0, W - lw - 70]);
    if (legend) {
      const lg = svg.append('g').attr('transform', `translate(${lw},8)`), gw = 240;
      const gid = 'tb' + Math.random().toString(36).slice(2, 7);
      const grad = svg.append('defs').append('linearGradient').attr('id', gid);
      d3.range(n).forEach(i => grad.append('stop').attr('offset', i / (n - 1)).attr('stop-color', colour(i)));
      lg.append('rect').attr('width', gw).attr('height', 10).attr('rx', 5).attr('fill', `url(#${gid})`);
      lg.append('text').attr('class', 'hx-tick').attr('y', 30).text('Cited in ' + y0);
      lg.append('text').attr('class', 'hx-tick').attr('x', gw).attr('y', 30).attr('text-anchor', 'end').text(y0 + n - 1);
    }
    const g = svg.selectAll('g.b').data(rows).join('g').attr('class', 'b').attr('transform', (r, i) => `translate(0,${top + i * rowH})`);
    g.append('text').attr('class', 'hx-lab hx-strong').attr('x', lw - 14).attr('y', by + bh / 2 + 6).attr('text-anchor', 'end').text(label);
    if (sub) g.append('text').attr('class', 'hx-muted').attr('x', lw).attr('y', by + bh + 24).style('font-size', '19px').text(sub);
    const segs = g.selectAll('rect').data(r => { let acc = 0; return years(r).map((v, i) => ({ r, i, v, x0: (acc += v) - v })); }).join('rect')
      .attr('y', by).attr('height', bh).attr('fill', d => colour(d.i)).attr('stroke', 'var(--bg)').attr('stroke-width', 1.5)
      .attr('x', d => lw + x(d.x0)).attr('width', 0)
      .on('pointermove', (ev, d) => tooltip(`<b>${label(d.r)}</b><br>${y0 + d.i}: ${fmt(d.v)} citation${d.v === 1 ? '' : 's'}`, ev))
      .on('pointerleave', () => tooltip(null));
    const vals = g.append('text').attr('class', 'hx-val').attr('y', by + bh / 2 + 6).attr('x', r => lw + x(total(r)) + 10).style('opacity', 0).text(r => fmt(total(r)));
    function play() {
      const step = reduced ? 0 : 260;
      segs.interrupt().attr('width', 0).transition().delay((d) => d.i * step + d.r.__i * stagger).duration(reduced ? 0 : step * 1.6).ease(d3.easeCubicOut).attr('width', d => Math.max(0, x(d.v)));
      vals.interrupt().style('opacity', 0).transition().delay(n * step).duration(400).style('opacity', 1);
    }
    rows.forEach((r, i) => { r.__i = i; });
    return { play };
  }

  // Who rebuilt the instrument. Authors and citation counts from OpenAlex, November 4, 2026.
  const LINEAGE = {
    papers: [
      { y: 2016, name: 'Hexad scale', note: '24 items, 133 people', cites: 594, doi: '10.1145/2967934.2968082',
        au: ['Tondello', 'Wehbe', 'Diamond', 'Busch', 'Marczewski', 'Nacke'] },
      { y: 2019, name: 'English and Spanish', note: 'Three items replaced', cites: 188, doi: '10.1016/j.ijhcs.2018.10.002',
        au: ['Tondello', 'Mora', 'Marczewski', 'Nacke'] },
      { y: 2021, name: 'Player types', note: 'Compared with player types', cites: 58, doi: '10.1007/978-3-030-77277-2_18',
        au: ['Krath', 'von Korflesch'] },
      { y: 2021, name: 'Theory review', note: 'Review of theories', cites: 956, doi: '10.1016/j.chb.2021.106963',
        au: ['Krath', 'Schürmann', 'von Korflesch'] },
      { y: 2023, name: 'Hexad-12', note: '12 items, steadier scores', cites: 42, doi: '10.1145/3544548.3580968',
        au: ['Krath', 'Altmeyer', 'Tondello', 'Nacke'] },
    ],
    people: [['Nacke', 'Lennart Nacke', 1], ['Tondello', 'Gustavo Tondello', 1], ['Krath', 'Jeanine Krath', 2],
      ['Marczewski', 'Andrzej Marczewski', 0], ['von Korflesch', 'Harald von Korflesch', 0], ['Altmeyer', 'Maximilian Altmeyer', 0]],
  };
  // Threads: one row per person, one column per paper; a thread links the papers that person co-wrote.
  function lineage(host, { W = 1400, rowH = 62 } = {}) {
    host.innerHTML = '';
    const { papers, people } = LINEAGE, lw = 250, top = 110, H = top + people.length * rowH + 120;
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', papers.map(p => `${p.y} ${p.name}: ${p.au.join(', ')}`).join('; '));
    const x = d3.scalePoint(papers.map((p, i) => i), [lw + 60, W - 140]), y = i => top + i * rowH + rowH / 2;
    const cls = k => ['hx-thread0', 'hx-thread1', 'hx-thread2'][k];
    const head = svg.selectAll('g.h').data(papers).join('g').attr('class', 'h').attr('transform', (p, i) => `translate(${x(i)},0)`);
    head.append('text').attr('class', 'hx-lab hx-strong').attr('text-anchor', 'middle').attr('y', 34).style('font-size', '24px').text(p => p.y);
    head.append('text').attr('class', 'hx-muted').attr('text-anchor', 'middle').attr('y', 62).style('font-size', '20px').text(p => p.name);
    head.append('line').attr('class', 'hx-axis').attr('y1', top - 14).attr('y2', top + people.length * rowH);
    const foot = svg.selectAll('g.f').data(papers).join('g').attr('class', 'f').attr('transform', (p, i) => `translate(${x(i)},${top + people.length * rowH + 34})`);
    foot.append('text').attr('class', 'hx-val').attr('text-anchor', 'middle').style('font-size', '20px').text(p => `${fmt(p.cites)} citations`);
    foot.append('text').attr('class', 'hx-muted').attr('text-anchor', 'middle').attr('y', 26).text(p => p.note);
    const rows = svg.selectAll('g.p').data(people).join('g').attr('class', 'p');
    rows.append('text').attr('class', d => 'hx-lab' + (d[2] ? ' hx-strong' : '')).attr('x', lw).attr('y', (d, i) => y(i) + 6).attr('text-anchor', 'end').text(d => d[1]);
    const threads = rows.append('path').attr('class', d => 'hx-thread ' + cls(d[2]))
      .attr('d', (d, i) => d3.line()(papers.map((p, j) => p.au.includes(d[0]) ? [x(j), y(i)] : null).filter(Boolean)));
    const dots = rows.selectAll('circle').data((d, i) => papers.map((p, j) => ({ d, i, j, on: p.au.includes(d[0]) })).filter(e => e.on)).join('circle')
      .attr('class', e => cls(e.d[2])).attr('cx', e => x(e.j)).attr('cy', e => y(e.i)).attr('r', e => e.d[2] ? 11 : 8);
    function play() {
      threads.each(function () { const L = this.getTotalLength() || 1; d3.select(this).interrupt().attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L)
        .transition().delay(reduced ? 0 : 400).duration(reduced ? 0 : 2200).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0); });
      dots.interrupt().attr('r', 0).transition().delay(e => reduced ? 0 : 300 + e.j * 420).duration(500).ease(d3.easeBackOut).attr('r', e => e.d[2] ? 11 : 8);
    }
    return { play };
  }

  // Two series across ordered bands, direct-labelled, with the crossover marked.
  function lines(host, bands, series, { W = 1400, H = 520, domain, unit = '%', note = r => '', minimal = false, yTicks = !minimal, mr = 270 } = {}) {
    host.innerHTML = '';
    const m = { t: 30, r: mr, b: 60, l: 60 }, keys = Object.keys(series);
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', keys.map(k => `${k}: ${series[k].join(', ')}`).join('; '));
    const x = d3.scalePoint(bands, [m.l, W - m.r]).padding(0.2), y = d3.scaleLinear(domain || d3.extent(keys.flatMap(k => series[k])), [H - m.b, m.t]).nice();
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('class', 'hx-axis').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).style('opacity', .6);
    if (yTicks) svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('class', 'hx-tick').attr('x', m.l - 12).attr('y', d => y(d) + 5).attr('text-anchor', 'end').text(d => d + unit);
    svg.append('g').selectAll('text').data(minimal ? [bands[0], bands.at(-1)] : bands).join('text').attr('class', 'hx-tick').style('font-size', minimal ? '22px' : null).attr('x', x).attr('y', H - m.b + 32).attr('text-anchor', 'middle').text(d => d);
    const gs = svg.selectAll('g.s').data(keys).join('g').attr('class', 's');
    const path = gs.append('path').attr('fill', 'none').attr('stroke-width', 3).attr('stroke', (k, i) => `var(--series-${i + 1})`)
      .attr('d', k => d3.line().curve(d3.curveMonotoneX)(bands.map((b, j) => [x(b), y(series[k][j])])));
    const dots = gs.selectAll('circle').data(k => bands.map((b, j) => ({ k, b, j, v: series[k][j] }))).join('circle')
      .attr('cx', d => x(d.b)).attr('cy', d => y(d.v)).attr('r', 6).attr('fill', d => `var(--series-${keys.indexOf(d.k) + 1})`).attr('stroke', 'var(--bg)').attr('stroke-width', 2)
      .on('pointermove', (ev, d) => tooltip(`<b>${d.k}, age ${d.b}</b><br>${d.v}${unit} mean score${note(d.j)}`, ev)).on('pointerleave', () => tooltip(null));
    const lab = gs.append('text').attr('class', 'hx-lab hx-strong').style('font-size', '20px').attr('x', W - m.r + 16)
      .attr('y', k => y(series[k].at(-1)) + 6).style('fill', (k, i) => i ? 'var(--text-2)' : 'var(--series-1)').text(k => k);
    function play() {
      path.each(function () { const L = this.getTotalLength(); d3.select(this).interrupt().attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L)
        .transition().duration(reduced ? 0 : 2000).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0); });
      dots.interrupt().style('opacity', 0).transition().delay(d => reduced ? 0 : d.j * 270).duration(300).style('opacity', 1);
      lab.interrupt().style('opacity', 0).transition().delay(reduced ? 0 : 1900).duration(400).style('opacity', 1);
    }
    return { play };
  }

  // Process timeline: month-level steps on one axis, labels stacked so close steps never collide.
  function timeline(host, events, { W = 1680, H = 640, stagger = 300, rowStep = 96 } = {}) {
    host.innerHTML = '';
    const ev = events.map(([d, t, s]) => ({ d: new Date(d + '-15T12:00'), t, s }));
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', events.map(e => `${e[0]}: ${e[1]}`).join('; '));
    const x = d3.scaleTime([d3.timeMonth.offset(ev[0].d, -1), d3.timeMonth.offset(ev.at(-1).d, 1)], [40, W - 330]), base = H - 70;
    svg.append('line').attr('class', 'hx-axis').attr('x1', 40).attr('x2', W - 40).attr('y1', base).attr('y2', base);
    const ends = [];
    ev.forEach(e => { let r = 0; while (ends[r] > x(e.d) - 10) r++; ends[r] = x(e.d) + 440; e.row = r; });
    const stemLayer = svg.append('g');
    const g = svg.selectAll('g.e').data(ev).join('g').attr('class', 'e').style('opacity', 0);
    stemLayer.selectAll('line').data(ev).join('line').attr('class', 'hx-chain').attr('x1', e => x(e.d)).attr('x2', e => x(e.d)).attr('y1', base).attr('y2', e => base - 54 - e.row * rowStep);
    g.append('circle').attr('class', e => e.s ? 'hx-node2' : 'hx-node1').attr('cx', e => x(e.d)).attr('cy', base).attr('r', 10);
    const t = g.append('text').attr('class', 'hx-lab hx-halo').style('font-size', '24px').style('stroke-width', '18px').attr('x', e => x(e.d) + 10).attr('y', e => base - 62 - e.row * rowStep);
    t.append('tspan').attr('class', 'hx-strong').text(e => d3.timeFormat('%B %Y')(e.d));
    t.append('tspan').attr('x', e => x(e.d) + 10).attr('dy', 28).attr('class', 'hx-muted').style('font-size', '21px').text(e => e.t);
    const stems = stemLayer.selectAll('line'), labels = g.select('text');
    function play() {
      g.interrupt().style('opacity', 1);
      stems.interrupt().attr('y2', base).transition().delay((d, i) => reduced ? 0 : 300 + i * stagger).duration(reduced ? 0 : 380).ease(d3.easeCubicOut).attr('y2', e => base - 54 - e.row * rowStep);
      g.select('circle').interrupt().attr('r', 0).transition().delay((e, i) => reduced ? 0 : 300 + i * stagger).duration(reduced ? 0 : 420).ease(d3.easeBackOut).attr('r', 10);
      labels.interrupt().style('opacity', 0).transition().delay((e, i) => reduced ? 0 : 450 + i * stagger).duration(350).style('opacity', 1);
    }
    return { play };
  }

  // Disruptor story: 2016 respondents (outlined dots) beside Hexad-12 test shares rescaled to 133 people (filled dots).
  function crowdCompare(host, a, b, { W = 1600, H = 560, highlight = 'Disruptor', n = 133 } = {}) {
    host.innerHTML = '';
    const types = a.map(r => r[0]), s = 32, cols = 3, base = H - 96;
    const x = d3.scaleBand(types, [40, W - 40]).padding(0.12);
    const bN = Object.fromEntries(b.map(([t, p]) => [t, Math.round(p / 100 * n)]));
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', types.map((t, i) => `${t}: ${a[i][1]} of ${n} in 2016, ${b[i][1]}% in Hexad-12`).join('; '));
    const dots = [];
    types.forEach((t, ti) => {
      const cx0 = x(t) + x.bandwidth() * 0.27, cx1 = x(t) + x.bandwidth() * 0.73;
      d3.range(a[ti][1]).forEach(i => dots.push({ t, set: 0, i, x: cx0 + ((i % cols) - 1) * s, y: base - 12 - Math.floor(i / cols) * s }));
      d3.range(bN[t]).forEach(i => dots.push({ t, set: 1, i, x: cx1 + ((i % cols) - 1) * s, y: base - 12 - Math.floor(i / cols) * s }));
    });
    const hot = d => d.t === highlight;
    const c = svg.selectAll('circle').data(dots).join('circle').attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 13)
      .attr('fill', d => d.set ? (hot(d) ? 'var(--series-2)' : 'var(--series-1)') : 'none')
      .attr('stroke', d => d.set ? 'none' : (hot(d) ? 'var(--series-2)' : 'var(--muted)')).attr('stroke-width', 2);
    const lab = svg.selectAll('g.l').data(types).join('g').attr('class', 'l').attr('transform', t => `translate(${x(t) + x.bandwidth() / 2},${base + 34})`);
    lab.append('text').attr('class', t => 'hx-lab hx-strong' + (t === highlight ? ' hx-moved' : '')).attr('text-anchor', 'middle').style('font-size', '25px').text(t => t);
    lab.append('text').attr('class', 'hx-muted').attr('text-anchor', 'middle').attr('y', 36).style('font-size', '25px')
      .text((t, i) => `${(a[i][1] / n * 100).toFixed(1)}% → ${b[i][1]}%`);
    function play() {
      c.interrupt().attr('r', 0).transition().delay(d => reduced ? 0 : d.set * 1500 + d.i * 22).duration(350).ease(d3.easeBackOut).attr('r', 13);
    }
    return { play };
  }

  // Before/after per type: the coloured dot travels from the old value to the new one.
  function dumbbell(host, rows, { W = 1400, rowH = 64, domain = [0, 1], missing = 'no match', fmtV = null } = {}) {
    host.innerHTML = '';
    const lw = 220, H = rows.length * rowH + 40, f = fmtV || (v => d3.format('.3f')(v).replace(/^(-?)0\./, '$1.'));  // APA: no leading zero for r, tau, alpha
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', rows.map(r => `${r[0]}: ${r[1]} to ${r[2] ?? missing}`).join('; '));
    const x = d3.scaleLinear(domain, [lw, W - 120]);
    svg.append('g').selectAll('text').data(x.ticks(5)).join('text').attr('class', 'hx-tick').attr('x', x).attr('y', H - 6).attr('text-anchor', 'middle').text(fmtV ? (t => d3.format('~r')(t) + '%') : f);
    const g = svg.selectAll('g.r').data(rows).join('g').attr('class', 'r').attr('transform', (r, i) => `translate(0,${i * rowH + rowH / 2})`);
    g.append('text').attr('class', 'hx-lab').style('font-size', '22px').attr('x', lw - 24).attr('y', 7).attr('text-anchor', 'end').text(r => r[0]);
    g.append('line').attr('class', 'hx-axis').attr('x1', lw).attr('x2', W - 120);
    const link = g.append('line').attr('class', 'hx-chain').attr('x1', r => x(r[1])).attr('x2', r => x(r[1]));
    g.append('circle').attr('r', 9).attr('cx', r => x(r[1])).attr('fill', 'var(--muted)');
    const dot = g.filter(r => r[2] != null).append('circle').attr('class', r => r[2] < r[1] ? 'hx-node2' : 'hx-node1').attr('r', 11).attr('cx', r => x(r[1]));
    const val = g.append('text').attr('class', 'hx-val').style('font-size', '20px').attr('y', 7).attr('x', r => x(Math.max(r[1], r[2] ?? 0)) + 22).style('opacity', 0)
      .text(r => r[2] == null ? `${f(r[1])} · ${missing}` : `${f(r[1])} → ${f(r[2])}`);
    function play() {
      dot.interrupt().attr('cx', r => x(r[1])).transition().delay((r, i) => reduced ? 0 : 400 + i * 250).duration(reduced ? 0 : 1100).ease(d3.easeCubicInOut).attr('cx', r => x(r[2]));
      link.interrupt().attr('x2', r => x(r[1])).transition().delay((r, i) => reduced ? 0 : 400 + i * 250).duration(reduced ? 0 : 1100).ease(d3.easeCubicInOut).attr('x2', r => x(r[2] ?? r[1]));
      val.interrupt().style('opacity', 0).transition().delay((r, i) => reduced ? 0 : 1300 + i * 250).duration(400).style('opacity', 1);
    }
    return { play };
  }

  // 133 respondents as dots: they start scattered, then settle into a column for their highest-scoring type.
  function crowd(host, counts, { W = 1600, H = 640, highlight = 'Disruptor' } = {}) {
    host.innerHTML = '';
    const people = counts.flatMap(([t, n]) => d3.range(n).map(i => ({ t, i })));
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Main user type of 133 people: ' + counts.map(c => `${c[0]} ${c[1]}`).join(', '));
    const x = d3.scaleBand(counts.map(c => c[0]), [40, W - 40]).padding(0.18), cols = 4, s = 26, base = H - 80;
    const rnd = d3.randomLcg(7);
    people.forEach(p => { p.sx = 60 + rnd() * (W - 120); p.sy = 40 + rnd() * (base - 80);
      const k = Math.min(cols, counts.find(c => c[0] === p.t)[1]); p.x = x(p.t) + x.bandwidth() / 2 + ((p.i % cols) - (k - 1) / 2) * s; p.y = base - 14 - Math.floor(p.i / cols) * s; });
    const dots = svg.selectAll('circle').data(people).join('circle').attr('r', 10).attr('class', p => p.t === highlight ? 'hx-node2' : 'hx-node1');
    const lab = svg.selectAll('g.l').data(counts).join('g').attr('class', 'l').style('opacity', 0)
      .attr('transform', c => `translate(${x(c[0]) + x.bandwidth() / 2},${base + 40})`);
    lab.append('text').attr('class', 'hx-lab hx-strong').style('font-size', '24px').attr('text-anchor', 'middle').text(c => c[0]);
    lab.append('text').attr('class', 'hx-val').style('font-size', '26px').attr('text-anchor', 'middle').attr('y', c => -(base + 40) + base - 14 - Math.ceil(c[1] / cols) * s - 6).text(c => c[1]);
    function play() {
      dots.interrupt().attr('cx', p => p.sx).attr('cy', p => p.sy).style('opacity', 0)
        .transition().delay((p, i) => reduced ? 0 : i * 6).duration(300).style('opacity', 1)
        .transition().delay((p, i) => reduced ? 0 : 900 + (p.t === highlight ? 900 : 0)).duration(reduced ? 0 : 1400).ease(d3.easeCubicInOut)
        .attr('cx', p => p.x).attr('cy', p => p.y);
      lab.interrupt().style('opacity', 0).transition().delay(reduced ? 0 : 2600).duration(500).style('opacity', 1);
    }
    return { play };
  }

  // Game elements x user types. Rows start in the framework's grouping; regroup() slides them into the data's grouping.
  function heatmap(host, E, types, { W = 1500, rowH = 24, fs = 18 } = {}) {
    host.innerHTML = '';
    const els = Object.keys(E.groupA), lw = 230, gw = 330, cw = (W - lw - gw) / types.length, H = els.length * rowH + 100;
    const order = g => [...types, 'General'].indexOf(g);
    const layout = key => {
      const sorted = [...els].sort((a, b) => order(E[key][a]) - order(E[key][b]) || a.localeCompare(b));
      const y = {}; let gap = 0, prev;
      sorted.forEach((e, i) => { if (prev !== undefined && E[key][e] !== prev) gap += 8; prev = E[key][e]; y[e] = 56 + i * rowH + gap; });
      const groups = d3.groups(sorted, e => E[key][e]).map(([g, v]) => [g, y[v[0]], y[v.at(-1)] + rowH]);
      return { y, groups };
    };
    const A = layout('groupA'), B = layout('groupB');
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Links between 31 game elements and six user types; Philanthropist has almost none');
    const col = d3.scaleSequential([0.1, 0.42], t => d3.interpolateRgb(css('--bg'), css('--series-1'))(0.3 + 0.7 * t)).clamp(true);
    svg.append('g').selectAll('text').data(types).join('text').attr('class', 'hx-lab hx-strong').style('font-size', '20px')
      .attr('x', (t, i) => lw + gw + i * cw + cw / 2).attr('y', 44).attr('text-anchor', 'middle').text(t => t);
    const rows = svg.selectAll('g.hm-row').data(els).join('g').attr('class', 'hm-row').attr('transform', e => `translate(0,${A.y[e]})`);
    rows.append('text').attr('class', 'hx-lab').attr('x', lw + gw - 14).attr('y', rowH / 2 + 6).attr('text-anchor', 'end').style('font-size', fs + 'px').text(e => e);
    const byKey = new Map(E.cells.map(c => [c[0] + '|' + c[1], c]));
    const cells = rows.selectAll('rect').data(e => types.map((t, i) => ({ e, t, i, c: byKey.get(e + '|' + t) }))).join('rect')
      .attr('x', d => lw + gw + d.i * cw + 1).attr('y', 1).attr('width', cw - 2).attr('height', rowH - 2).attr('rx', 3)
      .attr('fill', d => d.c ? col(d.c[2]) : 'var(--grid)').attr('fill-opacity', d => d.c ? 1 : 0.25).style('opacity', 0)
      .on('pointermove', (ev, d) => tooltip(`<b>${d.e} × ${d.t}</b><br>${d.c ? `r = ${d.c[2].toFixed(3)} (${d.c[3]})` : 'not significant'}`, ev))
      .on('pointerleave', () => tooltip(null));
    const gl = svg.append('g');
    const drawGroups = (L, dur) => {
      const sel = gl.selectAll('g.grp').data(L.groups, d => d[0]);
      sel.exit().transition().duration(dur / 2).style('opacity', 0).remove();
      const en = sel.enter().append('g').attr('class', 'grp').style('opacity', 0);
      en.append('line').attr('class', 'hx-chain'); en.append('text').attr('class', 'hx-lab hx-strong').style('font-size', '20px').attr('text-anchor', 'end');
      const all = en.merge(sel);
      all.transition().duration(dur).style('opacity', 1);
      all.select('line').transition().duration(dur).attr('x1', lw - 4).attr('x2', lw - 4).attr('y1', d => d[1] + 2).attr('y2', d => d[2] - 2);
      all.select('text').text(d => d[0] === 'General' ? 'No clear type' : d[0]).transition().duration(dur).attr('x', lw - 16).attr('y', d => (d[1] + d[2]) / 2 + 6);
    };
    function play() {
      rows.interrupt().attr('transform', e => `translate(0,${A.y[e]})`); rows.select('text').classed('hx-moved', false);
      drawGroups(A, 0);
      cells.interrupt().style('opacity', 0).transition().delay(d => reduced ? 0 : d.i * 300 + A.y[d.e] * 1.2).duration(400).style('opacity', 1);
    }
    function regroup() {
      // Labels fade out, rows travel together, labels return in their new places, so no text crosses while moving.
      const lab = rows.select('text');
      lab.interrupt().transition().duration(reduced ? 0 : 150).style('opacity', 0);
      gl.interrupt().transition().duration(reduced ? 0 : 150).style('opacity', 0).on('end', () => drawGroups(B, 0));
      gl.transition().delay(reduced ? 0 : 1050).duration(reduced ? 0 : 250).style('opacity', 1);
      rows.interrupt().transition().delay(reduced ? 0 : 150).duration(reduced ? 0 : 900).ease(d3.easeCubicInOut).attr('transform', e => `translate(0,${B.y[e]})`);
      lab.classed('hx-moved', e => E.groupA[e] !== E.groupB[e]).transition().delay(reduced ? 0 : 1050).duration(reduced ? 0 : 250).style('opacity', 1);
    }
    return { play, regroup };
  }

// Test-retest, explained in motion: 133 dots answer, 40 of them walk over to answer again, then their scores are compared.
function retest(host) {
  const W = 1680, H = 560, svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
    .attr('aria-label', '133 people; 40 answered again two weeks later; how closely answers matched, by type');
  const s = 26, L = { x: 90, y: 120, cols: 12 }, R = { x: 640, y: 120, cols: 8 };
  const pick = new Set(d3.range(133).filter(i => (i * 37) % 133 < 40));
  const dots = d3.range(133).map(i => ({ i, re: pick.has(i), x: L.x + (i % L.cols) * s, y: L.y + Math.floor(i / L.cols) * s }));
  let k = 0; dots.filter(d => d.re).forEach(d => { d.rx = R.x + (k % R.cols) * s; d.ry = R.y + Math.floor(k / R.cols) * s; k++; });
  const head = (x, a, b) => { const g = svg.append('g').attr('transform', `translate(${x},60)`);
    g.append('text').attr('class', 'hx-lab hx-strong').style('font-size', '26px').text(a); g.append('text').attr('class', 'hx-muted').attr('y', 30).style('font-size', '20px').text(b); return g; };
  head(L.x, 'March 2016', '133 people, 24 items'); const h2 = head(R.x, 'Two weeks later', 'The same 40 people, again').style('opacity', 0);
  const c = svg.selectAll('circle.p').data(dots).join('circle').attr('class', 'p').attr('r', 9).attr('cx', d => d.x).attr('cy', d => d.y).attr('fill', 'var(--series-1)');
  const T2 = [['Philanthropist', .852], ['Socialiser', .853], ['Free Spirit', .631], ['Achiever', .798], ['Disruptor', .782], ['Player', .357]];
  const bx = 1040, bw = 520, bars = svg.append('g').style('opacity', 0);
  bars.append('text').attr('class', 'hx-lab hx-strong').attr('x', bx).attr('y', 60).style('font-size', '26px').text('Do the two answers match?');
  bars.append('text').attr('class', 'hx-muted').attr('x', bx).attr('y', 90).style('font-size', '20px').text('How closely answers match, 1 = identical');
  const row = bars.selectAll('g').data(T2).join('g').attr('transform', (d, i) => `translate(${bx},${130 + i * 62})`);
  row.append('text').attr('class', 'hx-lab').attr('y', 22).style('font-size', '21px').text(d => d[0]);
  const bar = row.append('rect').attr('x', 170).attr('y', 4).attr('height', 26).attr('rx', 4).attr('width', 0).attr('fill', d => d[1] < .5 ? 'var(--series-2)' : 'var(--series-1)');
  const val = row.append('text').attr('class', 'hx-val').attr('x', d => 180 + d[1] * (bw - 200)).attr('y', 24).style('font-size', '20px').text(d => d[1].toFixed(2).replace(/^0/, ''));
  return () => {
    c.interrupt().attr('cx', d => d.x).attr('cy', d => d.y).attr('fill-opacity', 1).attr('r', 0)
      .transition().delay(d => d.i * 6).duration(300).attr('r', 9)
      .transition().delay(d => 900 + (d.re ? 0 : 0)).duration(d => d.re ? 1200 : 600).ease(d3.easeCubicInOut)
      .attr('cx', d => d.re ? d.rx : d.x).attr('cy', d => d.re ? d.ry : d.y).attr('fill-opacity', d => d.re ? 1 : 0.22);
    h2.interrupt().style('opacity', 0).transition().delay(2300).duration(500).style('opacity', 1);
    bars.interrupt().style('opacity', 0).transition().delay(3200).duration(500).style('opacity', 1);
    bar.interrupt().attr('width', 0).transition().delay((d, i) => 3400 + i * 180).duration(700).ease(d3.easeCubicOut).attr('width', d => d[1] * (bw - 200));
    val.interrupt().style('opacity', 0).transition().delay((d, i) => 3950 + i * 180).duration(300).style('opacity', 1);
  };
}


// Second ring per year (magenta) with the part that arrives through the four big reviews (pink), beside the direct citers (cyan).
function reviewBars(host, rows, { W = 1680, H = 560, names = '' } = {}) {
  host.innerHTML = '';
  const m = { t: 40, r: 20, b: 46, l: 20 }, svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
    .attr('aria-label', 'Per year: papers citing the Hexad scale, papers citing those, and the part arriving through four review papers');
  const x = d3.scaleBand(rows.map(r => r[0]), [m.l, W - m.r]).padding(0.2), bw = x.bandwidth();
  const y = d3.scaleLinear([0, d3.max(rows, r => r[2]) * 1.12], [H - m.b, m.t]), bp = (bx, top, h) => barPathR(bx, top, bw * 0.62, h);
  svg.append('line').attr('class', 'hx-axis').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b);
  svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'hx-tick').attr('x', r => x(r[0]) + bw / 2).attr('y', H - m.b + 28)
    .attr('text-anchor', 'middle').text(r => r[0] === 2026 ? '2026 so far' : r[0]);
  const g = svg.selectAll('g.y').data(rows).join('g').attr('class', 'y');
  const d1 = g.append('rect').attr('x', r => x(r[0])).attr('width', bw * 0.3).attr('rx', 3).attr('fill', 'var(--series-1)');
  const d2 = g.append('rect').attr('x', r => x(r[0]) + bw * 0.34).attr('width', bw * 0.66).attr('rx', 3).attr('fill', 'var(--series-2)').attr('fill-opacity', .55);
  const via = g.append('rect').attr('x', r => x(r[0]) + bw * 0.34).attr('width', bw * 0.66).attr('rx', 3).attr('fill', 'var(--brand-pink)');
  const pct = g.append('text').attr('class', 'hx-val').attr('text-anchor', 'middle').attr('x', r => x(r[0]) + bw * 0.67).style('font-size', '20px')
    .text(r => r[2] < 50 ? '' : Math.round(r[3] / r[2] * 100) + '%');  // no share on a base under 50 papers
  // Totals on the first year and the peak give the bars a scale without a y-axis.
  const peak = d3.max(rows, r => r[2]), tot = g.filter((r, i) => i === 0 || i === rows.length - 1 || r[2] === peak).append('text').attr('class', 'hx-val hx-strong')
    .attr('text-anchor', 'middle').attr('x', r => x(r[0]) + bw * 0.67).attr('y', r => y(r[2]) - 10).style('font-size', '22px').text(r => fmt(r[2]));
  g.on('pointermove', (ev, r) => tooltip(`<b>${r[0]}</b><br>${fmt(r[1])} cite the Hexad scale<br>${fmt(r[2])} cite those papers<br>${fmt(r[3])} of them through the four reviews`, ev))
    .on('pointerleave', () => tooltip(null));
  function play() {
    const grow = (sel, v, x0, delay) => sel.interrupt().attr('y', H - m.b).attr('height', 0).transition().delay((r, i) => (reduced ? 0 : delay + i * 110)).duration(reduced ? 0 : 700)
      .ease(d3.easeCubicOut).attr('y', r => y(v(r))).attr('height', r => H - m.b - y(v(r)));
    grow(d1, r => r[1], 0, 0); grow(d2, r => r[2], 0, 200); grow(via, r => r[3], 0, 1900);
    tot.interrupt().style('opacity', 0).transition().delay(r => reduced ? 0 : 900 + rows.indexOf(r) * 110).duration(400).style('opacity', 1);
    pct.interrupt().style('opacity', 0).attr('y', r => y(r[3]) - 8).transition().delay((r, i) => reduced ? 0 : 2300 + i * 110).duration(400).style('opacity', 1);
  }
  return { play };
}
const barPathR = (x, y, w, h) => `M${x},${y}h${w}v${h}h${-w}Z`;

// A soft bell for the race-track arrivals, synthesised so no audio file is needed; it rises one step per stop.
let audio;
function chime(i = 0) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    if (i < 0) return;  // warm-up call: create the engine without a sound
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98], f = scale[i % scale.length], t = audio.currentTime;
    [[1, 0.22], [2.76, 0.06], [5.4, 0.025]].forEach(([k, v]) => {
      const o = audio.createOscillator(), gn = audio.createGain();
      o.type = 'sine'; o.frequency.value = f * k; gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(v, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / Math.sqrt(k));
      o.connect(gn).connect(audio.destination); o.start(t); o.stop(t + 1.7);
    });
  } catch (e) { /* audio is optional */ }
}

  const region = new Intl.DisplayNames(['en-CA'], { type: 'region' });
  const country = code => { try { return region.of(code); } catch { return code; } };
  const loadStudy = () => fetch('data/study2016.json').then(r => r.json());
  const loadLive = () => fetch('data/hexad12live.json').then(r => r.json());
  return { load, loadStudy, loadLive, lines, countUp, tooltip, yearBars, hbars, chain, hexagon, dumbbell, heroField, timeBars, lineage, crowdCompare, timeline, retest, reviewBars, chime, crowd, heatmap, Net, fmt, reduced, country, TYPES };
})();
