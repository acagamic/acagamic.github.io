---
layout: page
permalink: /publications/
title: publications
description: Peer-reviewed papers, chapters and edited volumes, newest first.
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
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.85)",
          "rgba(30,79,194,0.35)"
        ],
        "borderWidth": 0
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
        "text": "Google Scholar citations per year"
      }
    },
    "scales": {
      "x": {
        "grid": {
          "display": false
        }
      },
      "y": {
        "beginAtZero": true,
        "grid": {
          "color": "rgba(128,128,128,0.15)"
        }
      }
    }
  }
}
```

<!-- Bibsearch Feature -->

{% include bib_search.liquid %}

<div class="publications">

{% bibliography %}

</div>
