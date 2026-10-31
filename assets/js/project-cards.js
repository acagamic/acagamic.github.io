// Feeds the cursor position to the project card hover effect as --mx/--my (percent of the card).
document.querySelectorAll(".projects .card").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
    card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
  });
});
