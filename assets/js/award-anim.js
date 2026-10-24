// Replaces the static award icons (publication list and CV) with Lottie animations whose
// colours follow the site theme. Re-renders when the theme toggle changes html[data-theme].
(() => {
  const slots = [];
  document.querySelectorAll('img[src*="publication_preview/best-paper"], img[src*="publication_preview/honourable-mention"]').forEach((img) => {
    const name = img.src.includes("best-paper") ? "best-paper" : "honourable-mention";
    const inline = img.classList.contains("award-icon"); // CV titles; publications wrap the img in a <figure>
    const box = document.createElement("span");
    box.className = inline ? "award-icon award-anim" : "award-anim";
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", name === "best-paper" ? "Best paper" : "Honourable mention");
    (inline ? img : img.closest("figure") || img).replaceWith(box);
    slots.push({ box, name, anim: null });
  });
  if (!slots.length || !window.lottie) return;

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cache = {};
  const fetchText = (file) => (cache[file] ??= fetch(`/assets/json/awards/${file}.json`).then((r) => r.text()));
  const theme = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

  const render = async () => {
    const t = theme();
    for (const slot of slots) {
      const data = JSON.parse(await fetchText(`${slot.name}-${t}`)); // fresh copy: lottie mutates its input
      slot.anim?.destroy();
      slot.anim = window.lottie.loadAnimation({ container: slot.box, renderer: "svg", loop: !still, autoplay: !still, animationData: data });
    }
  };

  render();
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
