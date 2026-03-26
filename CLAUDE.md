# CLAUDE.md

## Project Overview

This is **acagamic.github.io**, a GitHub Pages site hosting course materials for **DEI 626 - User Experience Fundamentals & UX Research** at the University of Waterloo, taught by Professor Lennart Nacke. It serves the Master of Digital Experience Innovation program.

## Tech Stack

- **Hosting:** GitHub Pages (static HTML, no Jekyll)
- **CSS Framework:** ZURB Foundation for Sites v6.6.1
- **JavaScript:** jQuery 3.4.1 + Foundation.js (webpack-bundled)
- **Icons:** Unicons v2.1.3
- **Fonts:** Google Fonts (Lobster, Montserrat)
- **No build process** — all assets are pre-compiled; no package.json, Gemfile, or build tooling

## Repository Structure

```
/
├── index.html              # Landing page (Foundation boilerplate)
├── dei626/
│   └── index.html          # Main course page (~600 lines, all course content)
├── assets/
│   ├── css/
│   │   └── app.css         # Foundation v6.6.1 complete CSS
│   ├── js/
│   │   ├── app.js          # Webpack-bundled JS (Foundation + plugins)
│   │   ├── app.js.map      # Source map
│   │   ├── foundation.js   # Foundation JS library
│   │   └── jquery-3.4.1.min.js
│   └── img/                # Course images (PNGs, favicon)
├── README.md
└── CLAUDE.md               # This file
```

## Key Pages

- **`/index.html`** — Minimal landing/redirect page
- **`/dei626/index.html`** — Full course site with schedule, assignments, tutorials, and embedded media (Loom, YouTube, CloudApp)

## HTML Conventions

### Foundation Components Used

- **Grid:** `.grid-container`, `.grid-x`, `.grid-padding-x`, `.cell`, `.large-*`, `.medium-*`, `.small-*`
- **Tabs:** `.tabs` with `data-tabs`, `.tabs-content`, `.tabs-panel`
- **Accordions:** `.accordion` with `data-accordion`, `.accordion-item`, `.accordion-content`
- **Callouts:** `.callout`, `.callout.alert`
- **Labels:** `.label.alert`, `.label.success`, `.label.info`, `.label.secondary`
- **Buttons:** `.button`, `.button.alert`, `.button.large.expanded`
- **Modals:** `.reveal` with `data-reveal`, triggered via `data-open`

### Icon Usage

```html
<i class="uil uil-icon-name"></i>
```

Common icons: `uil-graduation-cap`, `uil-diary`, `uil-cog`, `uil-slack`, `uil-globe`, `uil-document-info`

### Embedded Media Pattern

```html
<!-- YouTube (privacy-enhanced) -->
<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" ...></iframe>

<!-- Loom -->
<iframe src="https://www.loom.com/embed/VIDEO_ID" ...></iframe>
```

## Development Workflow

1. **No build step** — edit HTML/CSS/JS files directly
2. **Preview** — open HTML files in a browser or use a local server
3. **Deploy** — push to `master` branch; GitHub Pages serves automatically
4. **Robots** — pages use `NOINDEX,NOFOLLOW` (course content is not meant to be publicly indexed)

## Coding Style

- HTML5 doctype with UTF-8 charset
- Semantic HTML with proper heading hierarchy (H1-H5)
- ARIA labels on interactive elements
- Alt text on images
- Foundation utility classes for layout (no custom CSS framework)
- Image naming: lowercase, hyphenated (e.g., `prototype-example.png`)

## Git Conventions

- **Default branch:** `master`
- **Commit messages:** Short, present-tense, action-oriented (e.g., "New lecture", "Project description updated", "fixed shapes")
- No CI/CD pipelines configured

## Important Notes

- Do NOT modify `assets/css/app.css` or `assets/js/app.js` directly — these are compiled Foundation framework files
- Course content changes go in `dei626/index.html`
- External resources (videos, tools) are linked, not hosted locally
- The site was adapted for online delivery during COVID-19 (2020)
