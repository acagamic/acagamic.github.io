# acagamic.github.io

Personal site for Lennart Nacke, hosted on GitHub Pages and built with Jekyll.

## How to edit the site

You don't touch any HTML. The landing page is plain Markdown:

1. Edit **`index.md`** — write Markdown (headings, paragraphs, lists, links, images).
2. To change the name/tagline or the footer links, edit **`_config.yml`**.
3. Commit and push to **`master`**.
4. GitHub Pages rebuilds automatically — your changes are live in about a minute
   at <https://acagamic.github.io>.

That's the whole workflow: edit Markdown → push → it appears in the styled layout.

## Project layout

| Path | What it is |
| --- | --- |
| `index.md` | The landing page content (**edit this**) |
| `_config.yml` | Site title, tagline, and footer links (**edit this**) |
| `_layouts/default.html` | The HTML template the Markdown is poured into |
| `assets/css/site.css` | Custom landing-page styling |
| `assets/css/app.css` | Foundation framework CSS (don't edit) |
| `dei626/` | DEI 626 course site (standalone, unchanged) |

## Optional: preview locally

You don't need this to publish, but if you want to see changes before pushing:

```sh
bundle install
bundle exec jekyll serve
```

Then open <http://localhost:4000>.
