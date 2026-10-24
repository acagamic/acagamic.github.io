// Publications page chart: citations received per year and papers published per year (shared x axis).
// Clicking a year opens a dot plot of that year's papers: citations against venue.
// Data: /assets/json/scholar.json, built by .github/scripts/scholar_stats.py. Colours come from CSS variables,
// so the theme toggle restyles the SVG without a re-render.
(() => {
  const root = document.getElementById("scholar-chart");
  if (!root || !window.d3) return;
  const fmt = d3.format(",");
  const tip = root.querySelector(".sc-tip");

  const showTip = (event, lines) => {
    tip.replaceChildren(
      ...lines.map(([strong, rest]) => {
        const row = document.createElement("div");
        const b = document.createElement("strong");
        b.textContent = strong;
        row.append(b, document.createTextNode(rest ? ` ${rest}` : ""));
        return row;
      }),
    );
    tip.hidden = false;
    const box = root.getBoundingClientRect();
    const x = (event.clientX ?? event.target.getBoundingClientRect().x) - box.left;
    const y = (event.clientY ?? event.target.getBoundingClientRect().y) - box.top;
    tip.style.left = `${Math.min(x + 12, box.width - tip.offsetWidth - 4)}px`;
    tip.style.top = `${y + 14}px`;
  };
  const hideTip = () => (tip.hidden = true);

  fetch(root.dataset.src)
    .then((r) => r.json())
    .then((data) => {
      const thisYear = new Date(data.updated).getFullYear();
      const papersByYear = d3.rollup(data.papers, (v) => v.length, (p) => p.year);
      const years = data.citations_per_year.map((d) => ({
        year: d.year,
        citations: d.citations,
        papers: papersByYear.get(d.year) || 0,
        partial: d.year === thisYear,
      }));
      let selected = null;

      // Hero numbers
      const s = data.stats;
      root.querySelector(".sc-stats").replaceChildren(
        ...[
          [fmt(s.citations), "citations"],
          [s.h, "h-index"],
          [s.i10, "i10-index"],
          [fmt(s.citations_since), `citations since ${data.since}`],
        ].map(([n, label]) => {
          const tile = document.createElement("div");
          const big = document.createElement("span");
          const small = document.createElement("span");
          big.className = "sc-num";
          small.className = "sc-label";
          big.textContent = n;
          small.textContent = label;
          tile.append(big, small);
          return tile;
        }),
      );
      const peak = d3.greatest(years.filter((d) => !d.partial), (d) => d.citations);
      root.querySelector(".sc-title").textContent =
        `Citations rose from ${fmt(years[0].citations)} in ${years[0].year} to ${fmt(peak.citations)} in ${peak.year}.`;
      const asOf = new Date(`${data.updated}T12:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
      root.querySelector(".sc-source").textContent = `Google Scholar, ${asOf}. Bars for ${thisYear} are outlined because the year is not over. Click a year to see its papers.`;

      // Table view, so every value is reachable without hovering
      const tbody = root.querySelector(".sc-table tbody");
      tbody.replaceChildren(
        ...years.map((d) => {
          const tr = document.createElement("tr");
          for (const v of [d.year + (d.partial ? " (to date)" : ""), fmt(d.citations), d.papers]) {
            const td = document.createElement("td");
            td.textContent = v;
            tr.append(td);
          }
          return tr;
        }),
      );

      const drawYears = () => {
        const svgEl = root.querySelector(".sc-years");
        const W = svgEl.clientWidth || 700;
        const m = { top: 22, right: 8, bottom: 22, left: 44 };
        const hA = 190, gap = 34, hB = 70;
        const H = m.top + hA + gap + hB + m.bottom;
        const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
        svg.selectAll("*").remove();

        const x = d3.scaleBand(years.map((d) => d.year), [m.left, W - m.right]).paddingInner(0.25).paddingOuter(0.1);
        const yA = d3.scaleLinear([0, d3.max(years, (d) => d.citations)], [m.top + hA, m.top]).nice();
        const topB = m.top + hA + gap;
        const yB = d3.scaleLinear([0, d3.max(years, (d) => d.papers)], [topB + hB, topB]).nice();
        const every = W < 520 ? 3 : 1;

        // Recessive grid and axes
        const grid = (g, y, ticks) =>
          g.call(d3.axisLeft(y).ticks(ticks).tickFormat((d) => (d ? d3.format("~s")(d) : "0")).tickSize(-(W - m.left - m.right)))
            .call((g) => g.select(".domain").remove())
            .call((g) => g.selectAll(".tick line").attr("class", "sc-grid"))
            .call((g) => g.selectAll("text").attr("class", "sc-tick"));
        svg.append("g").attr("transform", `translate(${m.left},0)`).call((g) => grid(g, yA, 4));
        svg.append("g").attr("transform", `translate(${m.left},0)`).call((g) => grid(g, yB, 2));
        svg.append("g").attr("transform", `translate(0,${topB + hB})`)
          .call(d3.axisBottom(x).tickSize(0).tickPadding(6).tickValues(x.domain().filter((y, i) => i % every === 0)))
          .call((g) => g.select(".domain").attr("class", "sc-base"))
          .call((g) => g.selectAll("text").attr("class", "sc-tick"));

        // Panel titles name the measure, so a legend is not needed
        svg.append("text").attr("class", "sc-panel").attr("x", m.left).attr("y", m.top - 9).text("Citations received per year (all work)");
        svg.append("text").attr("class", "sc-panel").attr("x", m.left).attr("y", topB - 9).text("Papers published per year");

        const bar = (y, key, base) => (sel) =>
          sel.attr("class", (d) => `sc-bar${d.partial ? " sc-partial" : ""}`)
            .attr("x", (d) => x(d.year))
            .attr("width", x.bandwidth())
            .attr("y", (d) => y(d[key]))
            .attr("height", (d) => Math.max(0, base - y(d[key])))
            .attr("rx", Math.min(4, x.bandwidth() / 4));
        svg.append("g").selectAll("rect").data(years).join("rect").call(bar(yA, "citations", m.top + hA));
        svg.append("g").selectAll("rect").data(years).join("rect").call(bar(yB, "papers", topB + hB));

        // Direct label on the peak only
        svg.append("text").attr("class", "sc-value")
          .attr("x", x(peak.year) + x.bandwidth() / 2).attr("y", yA(peak.citations) - 5)
          .attr("text-anchor", "middle").text(fmt(peak.citations));

        // One hit target per year, spanning both panels
        svg.append("g").selectAll("rect").data(years).join("rect")
          .attr("class", "sc-hit")
          .attr("x", (d) => x(d.year) - (x.step() - x.bandwidth()) / 2)
          .attr("width", x.step())
          .attr("y", m.top).attr("height", hA + gap + hB)
          .attr("tabindex", 0).attr("role", "button")
          .attr("aria-label", (d) => `${d.year}: ${fmt(d.citations)} citations received, ${d.papers} papers published. Show papers.`)
          .on("pointermove focus", (event, d) => {
            highlight(d.year);
            showTip(event, [[d.year + (d.partial ? " (to date)" : ""), ""], [fmt(d.citations), "citations received"], [d.papers, "papers published"]]);
          })
          .on("pointerleave blur", () => { highlight(selected); hideTip(); })
          .on("click", (event, d) => select(d.year))
          .on("keydown", (event, d) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(d.year); } });

        const highlight = (year) =>
          svg.selectAll(".sc-bar").classed("sc-dim", (d) => year !== null && d.year !== year);
        highlight(selected);
      };

      const select = (year) => {
        selected = year;
        drawYears();
        const panel = root.querySelector(".sc-detail");
        panel.hidden = false;
        drawPapers(year);
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };

      const drawPapers = (year) => {
        const all = data.papers.filter((p) => p.year === year);
        const papers = all.filter((p) => p.cites !== null);
        const counts = d3.rollup(papers, (v) => v.length, (p) => p.venue);
        const venues = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
        const top = d3.greatest(papers, (p) => p.cites);
        const h = root.querySelector(".sc-detail-title");
        const missing = all.length - papers.length;
        h.textContent = `${year}: ${all.length} papers` + (top ? `. The most cited, “${top.title}”, has ${fmt(top.cites)} citations.` : ".") +
          (missing ? ` ${missing} ${missing === 1 ? "paper has" : "papers have"} no Scholar count and ${missing === 1 ? "is" : "are"} not shown.` : "");

        const svgEl = root.querySelector(".sc-papers");
        const W = svgEl.clientWidth || 700;
        const m = { top: 8, right: 16, bottom: 34, left: Math.min(190, W * 0.38) };
        const row = 30;
        const H = m.top + venues.length * row + m.bottom;
        const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
        svg.selectAll("*").remove();

        const maxC = d3.max(papers, (p) => p.cites) || 1;
        const x = d3.scaleSymlog([0, maxC], [m.left, W - m.right]).constant(1).nice();
        const y = d3.scaleBand(venues, [m.top, m.top + venues.length * row]).padding(0.2);
        const ticks = [0, 1, 10, 100, 1000, 10000, 100000].filter((t) => t <= x.domain()[1]);

        svg.append("g").attr("transform", `translate(0,${m.top + venues.length * row})`)
          .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format("~s")).tickSize(-(venues.length * row)))
          .call((g) => g.select(".domain").remove())
          .call((g) => g.selectAll(".tick line").attr("class", "sc-grid"))
          .call((g) => g.selectAll("text").attr("class", "sc-tick"));
        svg.append("text").attr("class", "sc-tick").attr("x", W - m.right).attr("y", H - 4).attr("text-anchor", "end")
          .text("Citations per paper (log scale)");
        svg.append("g").selectAll("text").data(venues).join("text")
          .attr("class", "sc-venue").attr("x", m.left - 10).attr("y", (v) => y(v) + y.bandwidth() / 2)
          .attr("dy", "0.32em").attr("text-anchor", "end").text((v) => v)
          .each(function () { // ponytail: trim long venue names on narrow screens; the tooltip carries the full name
            while (this.getComputedTextLength() > m.left - 14 && this.textContent.length > 4)
              this.textContent = this.textContent.slice(0, -2) + "…";
          });

        // Spread papers with similar counts inside their venue row so dots don't stack
        const placed = papers.map((p) => ({ ...p, cx: x(p.cites) }));
        for (const v of venues) {
          const inRow = placed.filter((p) => p.venue === v).sort((a, b) => a.cx - b.cx);
          inRow.forEach((p, i) => {
            const crowded = inRow.filter((q) => Math.abs(q.cx - p.cx) < 10).length > 1;
            p.cy = y(v) + y.bandwidth() / 2 + (crowded ? ((i % 3) - 1) * 6 : 0);
          });
        }
        const dots = svg.append("g").selectAll("g").data(placed).join("g")
          .attr("class", "sc-dot-g").attr("tabindex", 0).attr("role", "link")
          .attr("aria-label", (p) => `${p.title}, ${p.venue}, ${fmt(p.cites)} citations. Jump to entry.`);
        dots.append("circle").attr("class", "sc-dot-hit").attr("cx", (p) => p.cx).attr("cy", (p) => p.cy).attr("r", 12);
        dots.append("circle").attr("class", "sc-dot").attr("cx", (p) => p.cx).attr("cy", (p) => p.cy).attr("r", 5.5);
        dots
          .on("pointermove focus", (event, p) => showTip(event, [[p.title, ""], [fmt(p.cites), `citations · ${p.venue}`]]))
          .on("pointerleave blur", hideTip)
          .on("click keydown", (event, p) => {
            if (event.type === "keydown" && event.key !== "Enter") return;
            const target = document.getElementById(p.key);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
          });
      };

      root.querySelector(".sc-close").addEventListener("click", () => {
        selected = null;
        root.querySelector(".sc-detail").hidden = true;
        drawYears();
      });
      drawYears();
      new ResizeObserver(() => { drawYears(); if (selected) drawPapers(selected); }).observe(root.querySelector(".sc-figure"));
    });
})();
