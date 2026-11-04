// Shared motion-graphics engine for the Hexad impact site (index.html) and talk deck (talk.html).
const HX = (() => {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
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
  function yearBars(host, data, { series = ['d1'], ticker, W = 1000, H = 460, stagger = 260 } = {}) {
    host.innerHTML = '';
    const rows = data.years.map(([y, a, b]) => ({ y, d1: a, d2: b }));
    const m = { t: 30, r: 20, b: 44, l: 20 };
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Papers per year citing the Hexad paper' + (series.includes('d2') ? ' and papers citing those papers' : ''));
    const x = d3.scaleBand(rows.map(r => r.y), [m.l, W - m.r]).padding(0.22);
    const max = d3.max(rows, r => d3.max(series, s => r[s]));
    const y = d3.scaleLinear([0, max * 1.12], [H - m.b, m.t]);
    const bw = x.bandwidth() / series.length;
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).attr('class', 'hx-axis');
    svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'hx-tick')
      .attr('x', r => x(r.y) + x.bandwidth() / 2).attr('y', H - m.b + 26).attr('text-anchor', 'middle').text(r => r.y);
    const groups = series.map((s, si) => {
      const g = svg.append('g');
      const bars = g.selectAll('path').data(rows).join('path')
        .attr('class', r => `hx-bar hx-${s}` + (r.y === 2026 ? ' hx-partial' : ''))
        .attr('d', r => barPath(x(r.y) + si * bw + (si ? 1 : 0), H - m.b, bw - 2, 0));
      const labels = g.selectAll('text').data(rows).join('text').attr('class', 'hx-val')
        .attr('x', r => x(r.y) + si * bw + bw / 2).attr('y', r => y(r[s]) - 8).attr('text-anchor', 'middle')
        .style('opacity', 0).text(r => fmt(r[s]));
      return { s, si, bars, labels };
    });
    // Hit targets wider than the marks.
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', r => x(r.y) - 4).attr('width', x.bandwidth() + 8)
      .attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev, r) => tooltip(`<b>${r.y}${r.y === 2026 ? ' (to Nov 4)' : ''}</b><br>${fmt(r.d1)} cite the Hexad paper` +
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
  function hbars(host, rows, { W = 900, rowH = 34, label = r => r[0], value = r => r[1], cls = 'hx-d1', stagger = 70 } = {}) {
    host.innerHTML = '';
    const H = rows.length * rowH + 10, lw = 210;
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const x = d3.scaleLinear([0, d3.max(rows, value)], [0, W - lw - 70]);
    const g = svg.selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${i * rowH})`);
    g.append('text').attr('class', 'hx-lab').attr('x', lw - 12).attr('y', rowH / 2 + 5).attr('text-anchor', 'end').text(label);
    const bars = g.append('rect').attr('class', `hx-bar ${cls}`).attr('x', lw).attr('y', 5).attr('height', rowH - 12).attr('rx', 4).attr('width', 0);
    const vals = g.append('text').attr('class', 'hx-val').attr('y', rowH / 2 + 5).attr('x', lw + 8).style('opacity', 0).text(r => fmt(value(r)));
    function play() {
      bars.interrupt().attr('width', 0).transition().delay((r, i) => reduced ? 0 : i * stagger).duration(reduced ? 0 : 800).ease(d3.easeCubicOut).attr('width', r => x(value(r)));
      vals.interrupt().style('opacity', 0).attr('x', lw + 8).transition().delay((r, i) => reduced ? 0 : i * stagger + 300).duration(500)
        .style('opacity', 1).attr('x', r => lw + x(value(r)) + 10);
    }
    return { play };
  }

  // Descent chain: one most-cited descendant per generation.
  function chain(host, data, { W = 1200, H = 560, stagger = 700 } = {}) {
    host.innerHTML = '';
    const c = data.chain, n = c.length;
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', `A chain of ${n - 1} generations of citing papers starting from the Hexad paper`);
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
  const TYPES = [['Philanthropist', 'purpose'], ['Socialiser', 'relatedness'], ['Free Spirit', 'autonomy'],
    ['Achiever', 'competence'], ['Player', 'rewards'], ['Disruptor', 'change']];
  function hexagon(host, { W = 900, H = 640 } = {}) {
    host.innerHTML = '';
    const R = 220, cx = W / 2, cy = H / 2;
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
    function play() {
      poly.interrupt().attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().duration(reduced ? 0 : 1600).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
      g.interrupt().style('opacity', 0).transition().delay((d, i) => reduced ? 0 : 250 + i * 260).duration(450).style('opacity', 1);
    }
    return { play };
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
    reveal({ dur = 9000, ring2 = false, onYear } = {}) {
      this.ring2 = ring2; const from = 2016, to = 2027;
      return new Promise(res => {
        if (reduced) { this.T = this.T2 = to; this.index(); this.draw(); return res(); }
        const tm = d3.timer(el => {
          const p = Math.min(1, el / dur), v = from + (to - from) * d3.easeSinInOut(p);
          if (ring2) this.T2 = v; else { this.T = v; this.T2 = to; }
          onYear?.(Math.min(2026, Math.floor(v)));
          this.draw();
          if (p >= 1) { tm.stop(); this.index(); res(); }
        });
      });
    }
    setRing2(on) { this.ring2 = on; this.T2 = 2027; this.index(); this.draw(); }
    colour(n) { return n.deg === 0 ? this.cOrigin : n.deg === 1 ? this.c1 : n.deg === 2 ? this.c2 : this.c3; }
    draw() {
      if (!this.w) return;
      const { ctx, k } = this;
      this.c1 = css('--series-1'); this.c2 = css('--series-2'); this.c3 = css('--series-3'); this.cOrigin = css('--ink');
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.save(); ctx.translate(k.x, k.y); ctx.scale(k.k, k.k);
      const lw = 1 / k.k, hl = this.focus || this.hover;
      const lit = hl ? new Set([hl, ...hl.parents, ...hl.kids]) : null;
      // Year arcs and labels
      ctx.lineWidth = 1.2 * lw; ctx.strokeStyle = css('--grid'); ctx.fillStyle = css('--muted');
      ctx.font = `${13 * lw}px 'IBM Plex Mono', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [y, [a, b]] of this.yearArcs) {
        if (y > this.T || this.d1.filter(n => n.y === y).length < 5) continue;
        ctx.beginPath(); ctx.arc(0, 0, 395, a - 0.004, b + 0.004); ctx.stroke();
        const m = (a + b) / 2; ctx.fillText(y, Math.cos(m) * 415, Math.sin(m) * 415);
      }
      // Edges
      const edge = (a, b, alpha) => { ctx.globalAlpha = alpha; ctx.moveTo(a.x, a.yy); ctx.lineTo(b.x, b.yy); };
      for (const deg of [1, 2, 3]) {
        ctx.beginPath(); ctx.strokeStyle = deg === 1 ? this.c1 : deg === 2 ? this.c2 : this.c3; ctx.lineWidth = lw;
        ctx.globalAlpha = lit ? 0.025 : deg === 1 ? 0.16 : deg === 2 ? 0.045 : 0.35;
        for (const n of this.all) {
          if (n.deg !== deg && !(deg === 3 && n.deg > 3)) continue;
          if (!this.visible(n)) continue;
          for (const p of n.parents) { ctx.moveTo(p.x, p.yy); ctx.lineTo(n.x, n.yy); }
        }
        ctx.stroke();
      }
      if (lit) {
        ctx.beginPath(); ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5 * lw; ctx.strokeStyle = this.cOrigin;
        for (const p of hl.parents) edge(p, hl, 0.9);
        for (const c of hl.kids) if (this.visible(c)) edge(hl, c, 0.9);
        ctx.stroke();
      }
      // Nodes, smallest last ring first so big hubs sit on top
      for (const n of this.all) {
        if (!this.visible(n)) continue;
        ctx.globalAlpha = lit && !lit.has(n) ? 0.12 : n.deg === 2 ? 0.75 : 0.95;
        ctx.fillStyle = this.colour(n);
        ctx.beginPath(); ctx.arc(n.x, n.yy, Math.max(n.r, 1.1 * lw), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (hl) { ctx.lineWidth = 2 * lw; ctx.strokeStyle = css('--ink'); ctx.beginPath(); ctx.arc(hl.x, hl.yy, hl.r + 3 * lw, 0, Math.PI * 2); ctx.stroke(); }
      // Origin label
      ctx.fillStyle = css('--bg'); ctx.font = `600 8px 'IBM Plex Sans', sans-serif`; ctx.fillText('HEXAD', 0, 0.5);
      ctx.restore();
    }
    pick(e, click) {
      const [mx, my] = d3.pointer(e, this.canvas), [x, y] = this.k.invert([mx, my]);
      const n = this.qt.find(x, y, 14 / this.k.k + 4);
      if (click) { this.focus = n || null; this.onSelect?.(n || null); }
      else { this.hover = n || null; this.onHover?.(n || null, e); this.canvas.style.cursor = n ? 'pointer' : 'grab'; }
      this.draw();
    }
    pathTo(n) { const p = []; while (n) { p.unshift(n); n = n.parents[0]; } return p; }
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

  const region = new Intl.DisplayNames(['en-CA'], { type: 'region' });
  const country = code => { try { return region.of(code); } catch { return code; } };
  return { load, countUp, tooltip, yearBars, hbars, chain, hexagon, Net, fmt, reduced, country, TYPES };
})();
