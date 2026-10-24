---
layout: page
title: projects
permalink: /projects/
description: Funded research projects, current and past, plus research tools and resources.
nav: true
nav_order: 3
display_categories: [current, past, resources]
horizontal: true
---

<!-- pages/projects.md -->
<div class="projects">
{% for category in page.display_categories %}
  <a id="{{ category }}" href=".#{{ category }}">
    <h2 class="category">{{ category }}</h2>
  </a>
  {% assign categorized_projects = site.projects | where: "category", category %}
  {% assign sorted_projects = categorized_projects | sort: "importance" %}
  <div class="container">
    <div class="row row-cols-1 row-cols-md-2">
    {% for project in sorted_projects %}
      {% include projects_horizontal.liquid %}
    {% endfor %}
    </div>
  </div>
{% endfor %}
</div>
