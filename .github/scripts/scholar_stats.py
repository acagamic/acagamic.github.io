"""Build assets/json/scholar.json for the publications chart.

Fetches the Google Scholar profile (citations per year, h-index, and per-paper
citation counts) and joins it to _bibliography/papers.bib by title. Run it
locally; Scholar blocks CI runners.  python3 .github/scripts/scholar_stats.py
"""
import datetime, html, json, re, time, unicodedata, urllib.request

USER = "i-y5S2AAAAAJ"
URL = f"https://scholar.google.com/citations?user={USER}&hl=en&pagesize=100&sortby=pubdate&cstart="
HEAD = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"}


def norm(s):
    s = re.sub(r"\\.|[{}]", "", s or "")
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower())


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def venue(e):
    """Short venue label from series, booktitle, or journal."""
    s, b, j, n = (e.get(k, "") for k in ("series", "booktitle", "journal", "number"))
    src = f"{s} | {b} | {j}"
    if e["type"] in ("phdthesis", "mastersthesis") or "Dissertation" in src:
        return "Theses"
    rules = [
        (r"CHI PLAY.*(Extended Abstracts|Companion)|Companion.*Computer-Human Interaction in Play", "CHI PLAY Companion"),
        (r"Extended Abstracts.*Human Factors|CHI EA", "CHI EA"),
        (r"Proceedings of the ACM on Human-Computer Interaction", "PACM HCI (CHI PLAY)" if "CHI PLAY" in n else "PACM HCI"),
        (r"CHI PLAY|Computer-Human Interaction in Play", "CHI PLAY"),
        (r"\bCHI\b|Human Factors in Computing Systems", "CHI"),
        (r"Designing Interactive Systems|\bDIS\b", "DIS"),
        (r"CSCW|Computer.Supported Cooperative Work", "CSCW"),
        (r"International Journal of Human.Computer Studies", "IJHCS"),
        (r"International Journal of Human.+Computer Interaction", "IJHCI"),
        (r"(?i)Entertainment Computing", "Entertainment Computing"),
        (r"Interacting with Computers", "Interacting with Computers"),
        (r"Computers in Human Behavior|CyberPsychology", "Computers in Human Behavior"),
        (r"Transactions on Computer-Human Interaction", "TOCHI"),
        (r"Frontiers", "Frontiers"),
        (r"arXiv|CoRR", "Preprint"),
        (r"(?i)Future ?Play", "Future Play"),
        (r"MindTrek", "MindTrek"),
        (r"(?i)workshop|CEUR|Fun and Games|FUGA|Ludic Engagement", "Workshops"),
        (r"Human Aspects of IT|Human-Computer Interaction\. Perspectives|Immersive Learning", "Other conferences"),
        (r"DiGRA|Game Studies|Sciences du jeu|Loading\.\.\.", "Game studies"),
        (r"Gamification|GamiFIN", "Gamification venues"),
        (r"Hawaii International|HICSS|SIGHCI|AIS Transactions|Information Systems|Business, Government", "Information systems"),
    ]
    for pat, label in rules:
        if re.search(pat, src):
            return label
    if e["type"] in ("inbook", "incollection") or not re.search(r"Proc|Conference|Symposium|Workshop|'\d\d|\d{4}", b) and b:
        return "Books and chapters"
    return "Other journals" if e["type"] == "article" else "Other conferences"


def bib_entries(path="_bibliography/papers.bib"):
    out = []
    for e in re.split(r"\n(?=@)", open(path, encoding="utf-8").read()):
        k = re.match(r"\s*@(\w+)\{([^,]+),", e)
        if not k:
            continue
        f = dict(re.findall(r"\n\s*(\w+)\s*=\s*\{(.*?)\},?(?=\s*\n)", e, re.S))
        f = {a: re.sub(r"\s+", " ", v) for a, v in f.items()}
        out.append({"key": k.group(2), "type": k.group(1).lower(), **f})
    return out


def scholar():
    first = urllib.request.urlopen(urllib.request.Request(URL + "0", headers=HEAD), timeout=30).read().decode()
    stats = [int(x) for x in re.findall(r'<td class="gsc_rsb_std">(\d+)</td>', first)]
    years = re.findall(r'<span class="gsc_g_t"[^>]*>(\d{4})</span>', first)
    counts = [int(x) for x in re.findall(r'<span class="gsc_g_al">(\d+)</span>', first)]
    papers, page, start = [], first, 0
    while True:
        for tr in re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S):
            t = re.search(r'class="gsc_a_at"[^>]*>(.*?)</(?:a|span)>', tr, re.S)
            c = re.search(r'class="gsc_a_ac gs_ibl"[^>]*>(\d*)<', tr)
            if t:
                papers.append((norm(text(t.group(1))), int(c.group(1)) if c and c.group(1) else 0))
        if page.count('class="gsc_a_tr"') < 100:
            break
        start += 100
        time.sleep(3)  # ponytail: polite fixed delay; Scholar rate-limits bursts
        page = urllib.request.urlopen(urllib.request.Request(URL + str(start), headers=HEAD), timeout=30).read().decode()
    return stats, dict(zip(years, counts)), papers


def main():
    stats, per_year, sch = scholar()
    cites = {}
    for t, c in sch:  # Scholar sometimes lists a paper twice; keep the larger count
        cites[t] = max(c, cites.get(t, 0))
    papers = []
    for e in bib_entries():
        t = norm(e.get("title"))
        c = cites.get(t)
        if c is None:  # Scholar title is a prefix of ours, or the reverse (subtitles get cut)
            c = next((v for k, v in cites.items() if len(k) > 25 and (t.startswith(k) or k.startswith(t))), None)
        papers.append({"key": e["key"], "title": re.sub(r"[{}]", "", text(e.get("title", ""))), "year": int(e["year"]), "venue": venue(e),
                       "cites": c, "workshop": e.get("workshop") == "true"})
    out = {
        "updated": datetime.date.today().isoformat(),
        "stats": dict(zip(["citations", "citations_since", "h", "h_since", "i10", "i10_since"], stats)),
        "since": datetime.date.today().year - 5,
        "citations_per_year": [{"year": int(y), "citations": c} for y, c in per_year.items()],
        "papers": papers,
    }
    json.dump(out, open("assets/json/scholar.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    matched = sum(p["cites"] is not None for p in papers)
    print(f"{len(papers)} papers, {matched} matched to Scholar, {stats[0]} citations")


if __name__ == "__main__":
    main()
