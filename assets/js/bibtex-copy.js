// Turns each publication's "Bib" button into a one-click "Copy BibTeX" label.
// Runs in the capture phase so the theme's own handler (which only toggles the panel) never fires.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("a.bibtex").forEach((link) => {
    link.textContent = "Copy BibTeX";
    link.setAttribute("title", "Copy this citation as BibTeX");
  });
});

document.addEventListener(
  "click",
  async (event) => {
    const link = event.target.closest("a.bibtex");
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();

    const scope = link.closest(".links")?.parentElement || link.closest("li");
    const text = scope?.querySelector(".bibtex.hidden")?.textContent.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ponytail: execCommand fallback for non-secure contexts (local previews over http).
      const area = Object.assign(document.createElement("textarea"), { value: text });
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }

    link.textContent = "Copied";
    setTimeout(() => (link.textContent = "Copy BibTeX"), 1500);
  },
  true,
);
