---
layout: page
permalink: /publications/
title: publications
description: Papers, chapters, and edited volumes, newest first, followed by workshop papers.
nav: true
nav_order: 2
chart:
  chartjs: true
---

<!-- _pages/publications.md -->

Cited 51,863 times, with an h-index of 75 and an i10-index of 213, according to [Google Scholar](https://scholar.google.com/citations?user=i-y5S2AAAAAJ) on October 23, 2026. Since 2021: 30,394 citations, h-index 61.

```chartjs
{
  "type": "bar",
  "data": {
    "labels": [
      "2010",
      "2011",
      "2012",
      "2013",
      "2014",
      "2015",
      "2016",
      "2017",
      "2018",
      "2019",
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
      "2026 (to Oct)"
    ],
    "datasets": [
      {
        "label": "Citations",
        "data": [
          139,
          246,
          525,
          981,
          1576,
          1832,
          2187,
          2608,
          3081,
          3495,
          3621,
          3992,
          3930,
          4392,
          5389,
          6816,
          5844
        ],
        "backgroundColor": [
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "#1e4fc2",
          "transparent"
        ],
        "borderWidth": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          2
        ],
        "borderColor": "#1e4fc2"
      }
    ]
  },
  "options": {
    "plugins": {
      "legend": {
        "display": false
      },
      "title": {
        "display": true,
        "text": "Google Scholar citations per year",
        "color": "#1b3b5a"
      }
    },
    "scales": {
      "x": {
        "grid": {
          "display": false
        },
        "ticks": {
          "color": "#1b3b5a"
        }
      },
      "y": {
        "beginAtZero": true,
        "grid": {
          "color": "rgba(27, 59, 90, 0.15)"
        },
        "ticks": {
          "color": "#1b3b5a"
        }
      }
    }
  }
}
```

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
<script src="{{ '/assets/js/chart-theme.js' | relative_url }}" defer></script>
