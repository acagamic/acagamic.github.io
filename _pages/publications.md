---
layout: page
permalink: /publications/
title: publications
description: Papers, chapters, and edited volumes, newest first, followed by workshop papers.
nav: true
nav_order: 2
---

<!-- _pages/publications.md -->

<div id="scholar-chart" class="scholar-chart" data-src="{{ '/assets/json/scholar.json' | relative_url }}">
  <div class="sc-stats"></div>
  <figure class="sc-figure">
    <figcaption class="sc-title"></figcaption>
    <svg class="sc-years" width="100%" role="group" aria-label="Bar charts of Google Scholar citations received per year and papers published per year"></svg>
    <p class="sc-source"></p>
  </figure>
  <div class="sc-detail" hidden>
    <div class="sc-detail-head">
      <p class="sc-detail-title"></p>
      <button type="button" class="sc-close" aria-label="Close the year view">×</button>
    </div>
    <svg class="sc-papers" width="100%" role="group" aria-label="Dot plot of the selected year's papers by venue and citations"></svg>
  </div>
  <details class="sc-table-wrap">
    <summary>Show the numbers as a table</summary>
    <table class="sc-table">
      <thead><tr><th>Year</th><th>Citations received</th><th>Papers published</th></tr></thead>
      <tbody></tbody>
    </table>
  </details>
  <div class="sc-tip" hidden></div>
</div>
<script src="{{ '/assets/js/lib/d3-7.9.0.min.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/scholar-chart.js' | relative_url }}" defer></script>

<!-- Bibsearch Feature -->

{% include bib_search.liquid %}

<div class="publications">

{% bibliography --query @*[workshop!=true] %}

</div>

## workshop papers

<div class="publications">

{% bibliography --query @*[workshop=true] --group_by none %}

</div>

<script src="{{ '/assets/js/bibtex-copy.js' | relative_url }}" defer></script>
