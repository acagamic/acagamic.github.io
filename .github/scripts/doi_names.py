"""One-off: print Crossref author names for bib entries whose authors have initials only.
Entries without a DOI are matched by title, and the match is printed for manual checking."""
import json, sys, time, urllib.parse, urllib.request

HEAD = {"User-Agent": "acagamic.github.io bib cleanup (mailto:contact@lennartnacke.com)"}

def get(url):
    req = urllib.request.Request(url, headers=HEAD)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["message"]

for entry in json.load(open(sys.argv[1])):
    try:
        if entry["doi"]:
            msg = get("https://api.crossref.org/works/" + urllib.parse.quote(entry["doi"]))
        else:
            q = urllib.parse.urlencode({"query.bibliographic": entry["title"], "rows": 1})
            msg = get("https://api.crossref.org/works?" + q)["items"][0]
        out = {"key": entry["key"], "doi": msg.get("DOI"), "title": (msg.get("title") or [""])[0],
               "authors": [[a.get("family", ""), a.get("given", "")] for a in msg.get("author", [])]}
    except Exception as e:
        out = {"key": entry["key"], "error": str(e)}
    print("DOINAMES " + json.dumps(out, ensure_ascii=False), flush=True)
    time.sleep(0.2)
