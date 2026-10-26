// 404 page: search box, closest matches for the missing address, a note for old acagamic.com addresses,
// and event hooks for whichever analytics provider the site turns on (none is enabled by default).
(() => {
  const root = document.querySelector(".nf");
  if (!root) return;

  const STOP = new Set("a an the and or of to in for on with how why what is are blog html index php page amp newsletter talks event tag category guides publication".split(" "));
  const tokens = (text, { numbers = true } = {}) =>
    text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOP.has(t) && (numbers || !/^\d+$/.test(t)));

  // Analytics: no-ops unless a provider is on the page.
  const track = (name, props) => {
    try {
      if (window.gtag) window.gtag("event", name, props);
      else if (window.plausible) window.plausible(name, { props });
      else if (window.sa_event) window.sa_event(name, props);
      else if (window.umami?.track) window.umami.track(name, props);
    } catch (e) { /* analytics must never break the page */ }
  };
  track("page_not_found", { path: location.pathname + location.search, referrer: document.referrer || "(direct)" });
  root.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    track("recovery_click", { group: link.closest("[data-group]")?.dataset.group || "other", href: link.getAttribute("href"), from: location.pathname });
  });

  const decode = (path) => {
    try { return decodeURIComponent(path); } catch (e) { return path; }
  };

  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  // Score by word-prefix matches; title hits count three times a text hit.
  const rank = (index, words, requireAll) =>
    index
      .map((item) => {
        const title = tokens(item.title), text = tokens(item.text);
        let hits = 0, score = 0;
        for (const word of words) {
          const inTitle = title.some((t) => t.startsWith(word)), inText = text.some((t) => t.startsWith(word));
          if (inTitle || inText) hits += 1;
          score += (inTitle ? 3 : 0) + (inText ? 1 : 0);
        }
        return { item, hits, score };
      })
      .filter((r) => r.hits > 0 && (!requireAll || r.hits === words.length))
      .sort((a, b) => b.score - a.score);

  const resultItem = ({ item }) => {
    const li = el("li");
    const link = el("a", item.title);
    link.href = item.url;
    const meta = [item.kind, item.source, item.year].filter(Boolean).join(" · ");
    li.append(link, el("span", meta));
    return li;
  };

  const showLegacy = () => {
    const sections = {
      "/newsletter": ["/blog/tag/acagamic-tip-tuesday/", "Browse the Tip Tuesday articles"],
      "/guides": ["/blog/", "Browse the articles"],
      "/tag": ["/blog/", "Browse the articles"],
      "/category": ["/blog/", "Browse the articles"],
      "/talks": ["/teaching/chi2023-course/", "See the CHI 2023 course page"],
      "/event": ["/teaching/chi2023-course/", "See the CHI 2023 course page"],
      "/publication": ["/publications/", "Browse the publications"],
    };
    const key = Object.keys(sections).find((s) => location.pathname === s || location.pathname.startsWith(`${s}/`));
    if (!key) return;
    const link = document.getElementById("nf-legacy-link");
    link.href = sections[key][0];
    link.textContent = sections[key][1];
    document.getElementById("nf-legacy").hidden = false;
  };
  showLegacy();

  fetch(root.dataset.index)
    .then((r) => r.json())
    .then((index) => {
      // Only suggest pages whose title matches a word in the address; a text-only hit is usually noise.
      const guess = rank(index, tokens(decode(location.pathname), { numbers: false }), false).filter((r) => r.score >= 3).slice(0, 5);
      if (guess.length) {
        const box = document.getElementById("nf-guess");
        box.querySelector("ul").replaceChildren(...guess.map(resultItem));
        box.hidden = false;
      }

      const results = document.getElementById("nf-results");
      root.querySelector(".nf-search").addEventListener("submit", (event) => {
        event.preventDefault();
        const query = document.getElementById("nf-q").value.trim();
        const words = tokens(query);
        if (!words.length) return;
        let found = rank(index, words, true);
        if (!found.length) found = rank(index, words, false);
        track("recovery_search", { query, results: found.length });
        results.replaceChildren();
        if (!found.length) {
          const none = el("p", `No matches for “${query}”. Try fewer words, or `);
          const all = el("a", "browse all articles");
          all.href = root.querySelector('nav a[href$="/blog/"]').href;
          none.append(all, ".");
          results.append(none);
          return;
        }
        const list = el("ul", "", "nf-list");
        list.append(...found.slice(0, 8).map(resultItem));
        results.append(el("h2", `Results for “${query}”`), list);
      });
    })
    .catch((error) => console.warn("404 search is unavailable; the static links still work.", error));
})();
