#!/usr/bin/env python3
"""Build the feeds behind the articles page.

Sources are read in priority order (lennartnacke.com, Substack, and Medium), and every post gets
the category "article". Two kinds of item are dropped: podcast episodes such as Cortex Compute
(items with an audio enclosure), and cross-posts an earlier source already covers, matched by URL
slug, by title, or by a publish date within CROSSPOST_DAYS of an article kept from an earlier source,
since cross-posts often get a new title. Each feed is fetched live; if that fails (Substack blocks CI
runners) the snapshot in .github/feeds/<name>.xml is used instead.

Writes <out>/<name>.xml plus <out>/ci.yml for `jekyll build --config _config.yml,<out>/ci.yml`,
with the feeds served from http://127.0.0.1:<port>/.

Usage: article_feeds.py <out_dir> [port]
"""
import email.utils
import pathlib
import re
import sys
import urllib.request

SOURCES = [  # (file name, label shown on the site, feed URL)
    ("lennartnacke", "lennartnacke.com", "https://lennartnacke.com/feed/"),
    ("write-insight", "The Write Insight", "https://lennartnacke.substack.com/feed"),
    ("medium", "Medium", "https://medium.com/feed/@acagamic"),
]
CROSSPOST_DAYS = 2
SNAPSHOTS = pathlib.Path(__file__).resolve().parent.parent / "feeds"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def fetch(name, url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        text = urllib.request.urlopen(req, timeout=20).read().decode("utf-8")
        if "<rss" in text:
            return text
    except Exception as err:  # network refusal, timeout, bad encoding
        print(f"fetch failed for {url}: {err}")
    snap = SNAPSHOTS / f"{name}.xml"
    if snap.exists():
        print(f"::warning::Using the snapshot for {name}; refresh {snap.relative_to(SNAPSHOTS.parent.parent)} to pick up new posts.")
        return snap.read_text()
    print(f"::warning::No feed for {name}; building without it.")
    return None


def tag(item, name):
    m = re.search(rf"<{name}[^>]*>(.*?)</{name}>", item, re.S)
    return re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1)).strip() if m else ""


def norm(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


def main(out, port):
    out.mkdir(parents=True, exist_ok=True)
    kept = []  # (slug, title, date) of articles kept from earlier sources
    config = ["external_sources:"]
    for name, label, url in SOURCES:
        text = fetch(name, url)
        if text is None:
            continue
        count, mine = 0, []
        for item in re.findall(r"<item>.*?</item>", text, re.S):
            slug = norm(tag(item, "link").rstrip("/").rsplit("/", 1)[-1].split("?")[0])
            title = norm(tag(item, "title"))
            date = email.utils.parsedate_to_datetime(tag(item, "pubDate"))
            duplicate = any(slug == s or title == t or abs((date - d).days) <= CROSSPOST_DAYS for s, t, d in kept)
            if "audio/" in item or duplicate:
                text = text.replace(item, "")
                continue
            mine.append((slug, title, date))
            count += 1
        kept += mine
        (out / f"{name}.xml").write_text(text)
        config += [f"  - name: {label}", f"    rss_url: http://127.0.0.1:{port}/{name}.xml", "    categories: [article]"]
        print(f"{label}: {count} articles")
    (out / "ci.yml").write_text("\n".join(config if len(config) > 1 else ["external_sources: []"]) + "\n")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "8765")
