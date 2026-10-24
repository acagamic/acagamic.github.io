// Recolours the publications chart for the current theme and again whenever the toggle
// changes html[data-theme]. Every pairing meets WCAG contrast on the chart background:
// bars at least 3:1 (non-text), labels at least 4.5:1 (text).
(() => {
  const PALETTE = {
    light: { bar: "#1e4fc2", text: "#1b3b5a", grid: "rgba(27, 59, 90, 0.15)" }, // on #dbe5fa: 5.6:1, 9.1:1
    dark: { bar: "#8aa8f0", text: "#f3f5f9", grid: "rgba(243, 245, 249, 0.18)" }, // on #1b3b5a: 4.9:1, 10.6:1
  };

  const apply = () => {
    if (!window.Chart) return;
    const p = PALETTE[document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"];
    document.querySelectorAll(".language-chartjs canvas").forEach((canvas) => {
      const chart = window.Chart.getChart(canvas);
      if (!chart) return;
      chart.data.datasets.forEach((set) => {
        const last = set.data.length - 1; // the current, partial year is drawn as an outline
        set.backgroundColor = set.data.map((_, i) => (i === last ? "transparent" : p.bar));
        set.borderColor = p.bar;
        set.borderWidth = set.data.map((_, i) => (i === last ? 2 : 0));
      });
      const { scales, plugins } = chart.options;
      for (const axis of Object.values(scales)) {
        axis.ticks.color = p.text;
        axis.grid.color = p.grid;
      }
      plugins.title.color = p.text;
      chart.update("none");
    });
  };

  window.addEventListener("load", () => setTimeout(apply)); // the chart itself is drawn on readystatechange "complete"
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
