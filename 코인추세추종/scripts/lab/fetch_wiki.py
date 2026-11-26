"""위키백과 일일 조회수 (RESEARCH.md '장 직전 루프 — 6회차'). Wikimedia 공개 API, 키 불필요, 사람만(agent=user).
→ data/ml/wiki_views.csv (date · article · views)
사용법: python3 scripts/lab/fetch_wiki.py
"""
import csv
import json
import time
import urllib.parse
import urllib.request

from common import ML

ARTICLES = [("en.wikipedia", "Bitcoin"), ("en.wikipedia", "Ethereum"), ("ko.wikipedia", "비트코인"), ("ko.wikipedia", "이더리움")]
URL = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{p}/all-access/user/{a}/daily/20150701/20261125"
HEAD = {"User-Agent": "coin-trend-research/1.0 (personal research script)", "Accept": "application/json"}


def main():
    rows = []
    for proj, art in ARTICLES:
        url = URL.format(p=proj, a=urllib.parse.quote(art, safe=""))
        items = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=HEAD), timeout=30))["items"]
        rows += [(f"{i['timestamp'][:4]}-{i['timestamp'][4:6]}-{i['timestamp'][6:8]}", f"{proj[:2]}:{art}", i["views"]) for i in items]
        print(proj, art, len(items), items[0]["timestamp"][:8], "~", items[-1]["timestamp"][:8])
        time.sleep(0.5)
    with (ML / "wiki_views.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "article", "views"])
        w.writerows(rows)


if __name__ == "__main__":
    main()
