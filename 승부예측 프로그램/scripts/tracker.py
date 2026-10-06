#!/usr/bin/env python3
"""
전체 추적: 구매·추천 여부와 상관없이 스캔한 모든 선택지의 공정 확률을 기록하고, 베트맨 공식 결과로 자동 채점한다.

왜
- 회차마다 25~50경기 × 여러 유형의 확률을 계산해 놓고 추천한 3~6경기만 결과를 대조하면 검증 표본이 너무 느리게 쌓인다.
- 전부 기록하면 한 회차에 200~300개 선택지가 쌓여 "70%대가 실제 70% 맞는지", "야구 핸디캡이 축구보다 잘 맞는지",
  "역산 모델(*)이 직접 비교보다 얼마나 덜 맞는지"를 몇 회차 안에 확인할 수 있다.

파일: data/스캔기록.csv  (한 행 = 한 선택지. 키 = 회차+번호+선택. 같은 키는 가장 늦은 스캔으로 덮어쓴다 = 킥오프에 가까운 배당)
      data/배당이력.csv  (스캔할 때마다 누적. 시간에 따른 베트맨 배당·공정확률 변화 → 뉴스 반영 지연·CLV 분석용)
열: scan_time, 회차, 번호, 시각, 종목, 리그, 경기, 유형, 구분, 선택, 베트맨, 공정확률, 기대값, 근거, result, hit, 비고

사용법
  python3 scripts/odds_scan.py --log                 # 스캔하면서 전체 선택지를 스캔기록에 기록 (다른 옵션과 같이 써도 됨)
  python3 scripts/tracker.py results                 # 결과 없는 행의 회차를 베트맨에서 조회해 result/hit 채움
  python3 scripts/tracker.py results --round 117,118
  python3 scripts/tracker.py report                  # 확률 구간·종목·구분·근거별 예상 vs 실제, 회차별분석/전체추적_YYYY-MM-DD.md 저장
  python3 scripts/tracker.py clv                     # 배당이력으로 CLV(마감 대비 가치)·베트맨 지연 보고 → 회차별분석/CLV_YYYY-MM-DD.md
  python3 scripts/tracker.py import 회차별분석/배당스캔_*.csv   # 예전 스캔 CSV를 스캔기록으로 가져오기

베트맨 결과 코드 (gameInfoInq compSchedules.gameResult)
  '0' = 홈/승/언더 쪽 적중, '1' = 무(핸디무·1점차 포함), '2' = 원정/패/오버 쪽 적중, '4' = 적중특례(취소·무효, 배당 1.0 환불)
  번호(matchSeq)는 베팅 유형별로 다르므로 (회차, 번호)만으로 어떤 선택지인지 정해진다.
"""
import argparse, csv, datetime as dt, glob, json, os, subprocess, sys

sys.path.insert(0, os.path.dirname(__file__))
import odds_scan as o  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
LOG_PATH = os.path.join(ROOT, "data", "스캔기록.csv")
COLS = ["scan_time", "회차", "번호", "시각", "종목", "리그", "경기", "유형", "구분", "선택", "베트맨", "공정확률", "기대값", "근거", "result", "hit", "비고"]
KST = o.KST


def infer_sport(league, name=""):
    t = f"{league} {name}"
    if any(k in t for k in ("KBO", "NPB", "MLB", "야구", "베이스볼")):
        return "야구"
    if "배구" in t:
        return "배구"
    if any(k in t for k in ("KBL", "WKBL", "농구", "NBA", "박신자컵")):
        return "농구"
    if "하키" in t:
        return "하키"
    return "축구"


def load():
    if not os.path.exists(LOG_PATH):
        return []
    with open(LOG_PATH, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def save(rows):
    rows.sort(key=lambda r: (int(r["회차"]), int(r["번호"]), r["선택"]))
    with open(LOG_PATH, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in COLS})


def key(r):
    return (str(r["회차"]), str(r["번호"]), r["선택"])


def upsert(new_rows):
    """같은 (회차, 번호, 선택)은 덮어쓴다. 결과가 이미 채워진 행은 결과를 유지한다."""
    rows = load()
    idx = {key(r): i for i, r in enumerate(rows)}
    added = replaced = 0
    for n in new_rows:
        k = key(n)
        if k in idx:
            old = rows[idx[k]]
            if old.get("result"):
                n["result"], n["hit"] = old["result"], old["hit"]
            rows[idx[k]] = {**old, **n}
            replaced += 1
        else:
            rows.append(n)
            idx[k] = len(rows) - 1
            added += 1
    save(rows)
    return added, replaced


# ---------------------------------------------------------------- 기록 (odds_scan --log 에서 호출)
def log_rows(rows, scan_time=None):
    """odds_scan.scan()이 만든 선택지 행(필터 전) → 스캔기록 행."""
    st = (scan_time or dt.datetime.now(KST)).strftime("%Y-%m-%d %H:%M")
    year = (scan_time or dt.datetime.now(KST)).year
    out = []
    for r in rows:
        if r.get("공정확률") in ("", None) or not r.get("선택"):
            continue
        sel = r["선택"]
        if r.get("OU") not in (None, "") and sel in ("승", "패"):
            sel = "언더" if sel == "승" else "오버"
        src = "역산모델" if "역산모델" in str(r.get("매칭", "")) else r.get("근거", "직접")
        out.append({
            "scan_time": st, "회차": r["회차"], "번호": r["번호"], "시각": f"{year}-{r['시각']}",
            "종목": r.get("종목") or infer_sport(r.get("리그", ""), r["경기"]), "리그": r.get("리그", ""), "경기": r["경기"], "유형": r.get("유형", ""),
            "구분": r.get("구분", "일반"), "선택": sel, "베트맨": r.get("베트맨", ""), "공정확률": r["공정확률"],
            "기대값": r.get("기대값", ""), "근거": src, "result": "", "hit": "", "비고": "",
        })
    # 배당 이력(덮어쓰지 않고 누적): 뉴스 반영 지연 가설(킥오프 직전 배당 vs 처음 배당, CLV) 검증용
    hist = os.path.join(ROOT, "data", "배당이력.csv")
    new_file = not os.path.exists(hist)
    with open(hist, "a", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["scan_time", "회차", "번호", "경기", "구분", "선택", "베트맨", "공정확률", "기대값", "근거"])
        if new_file:
            w.writeheader()
        for r in out:
            w.writerow({c: r.get(c, "") for c in ["scan_time", "회차", "번호", "경기", "구분", "선택", "베트맨", "공정확률", "기대값", "근거"]})
    return upsert(out)


# ---------------------------------------------------------------- 가져오기 (예전 CSV)
def import_csvs(paths):
    total = (0, 0)
    for path in paths:
        name = os.path.basename(path)
        d = name.split("_")[1] if "_" in name else ""
        t = name.split("_")[2].replace(".csv", "") if name.count("_") >= 2 else "0000"
        st = f"{d} {t[:2]}:{t[2:]}" if len(t) == 4 else d
        year = d[:4]
        out = []
        with open(path, encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                if not r.get("공정확률") or not r.get("선택"):
                    continue
                typ = r.get("유형", "")
                line = r.get("라인", "")
                if r.get("구분"):
                    gubun = r["구분"]
                elif "언더오버" in typ:
                    gubun = f"U/O {line}" if line else "U/O"
                elif "핸디캡" in typ:
                    gubun = f"H{float(line):+g}" if line not in ("", None) else "H"
                else:
                    gubun = "일반"
                src = r.get("근거") or ("역산모델" if "역산모델" in r.get("매칭", "") else "직접")
                out.append({
                    "scan_time": st, "회차": r["회차"], "번호": r["번호"], "시각": f"{year}-{r['시각']}",
                    "종목": r.get("종목") or infer_sport(r.get("리그", ""), r["경기"]), "리그": r.get("리그", ""), "경기": r["경기"], "유형": typ.replace("전반 ", ""),
                    "구분": ("전반 " if "전반" in typ else "") + gubun, "선택": r["선택"], "베트맨": r.get("베트맨", ""),
                    "공정확률": r["공정확률"], "기대값": r.get("기대값", ""), "근거": src, "result": "", "hit": "", "비고": f"import {name}",
                })
        a, b = upsert(out)
        total = (total[0] + a, total[1] + b)
        print(f"{name}: 추가 {a} 덮어씀 {b}")
    return total


# ---------------------------------------------------------------- 결과
def betman_results(round_no, year=None):
    """베트맨 지난 회차 조회 → {번호: (gameResult, mchScore, protoStatus, 유형)}"""
    year = year or dt.datetime.now(KST).year
    cookie = os.path.join(ROOT, "data", ".betman_cookie")
    url = "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G101"
    subprocess.run(["curl", "-sS", "-m", "30", "-A", o.UA, "-c", cookie, "-o", "/dev/null", url])
    hdr = ["Content-Type: application/json; charset=UTF-8", "Accept: application/json",
           "X-Requested-With: XMLHttpRequest", "Origin: https://www.betman.co.kr", f"Referer: {url}"]
    sbm = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}
    gm_ts = int(f"{str(year)[2:]}{int(round_no):04d}")
    d = o.curl("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", hdr,
               json.dumps({"gmId": "G101", "gmTs": gm_ts, "gameYear": year, **sbm}), cookie)
    cs = d.get("compSchedules")
    if not cs:
        return {}
    res = {}
    for row in cs["datas"]:
        g = dict(zip(cs["keys"], row))
        res[str(g["matchSeq"])] = (g.get("gameResult"), g.get("mchScore"), g.get("protoStatus"), g.get("betTypNm"))
    return res


SEL_CODE = {"승": "0", "언더": "0", "무": "1", "1점차": "1", "패": "2", "오버": "2"}


def fill_results(rounds=None):
    rows = load()
    todo = [r for r in rows if not r.get("result")]
    rnds = sorted({r["회차"] for r in todo}) if not rounds else [str(x) for x in rounds]
    filled = void = 0
    for rnd in rnds:
        f0, v0 = filled, void
        res = betman_results(rnd)
        if not res:
            print(f"{rnd}회: 베트맨 결과 없음")
            continue
        for r in rows:
            if r["회차"] != rnd or r.get("result"):
                continue
            hit = res.get(str(r["번호"]))
            if not hit or hit[2] != "4" or hit[0] in (None, ""):
                continue  # 아직 종료 안 됨
            code, score = hit[0], hit[1]
            if code == "4" or (code or "").startswith("0") and len(code) > 1:
                r["result"], r["hit"], r["비고"] = "적특", "", (r.get("비고") or "") + f" 적특/취소 {score}".strip()
                void += 1
                continue
            r["result"] = {"0": "승", "1": "무", "2": "패"}.get(code, code)
            r["hit"] = "1" if SEL_CODE.get(r["선택"]) == code else "0"
            if score:
                r["비고"] = (r.get("비고") + " " if r.get("비고") else "") + f"스코어 {score}"
            filled += 1
        print(f"{rnd}회: {filled - f0}건 채움, 적특 {void - v0}")
    save(rows)
    return filled


# ---------------------------------------------------------------- 보고
def report(save_md=True):
    rows = [r for r in load() if r.get("hit") in ("0", "1")]
    if not rows:
        print("결과가 채워진 행이 없습니다. 먼저 results 를 실행한다.")
        return
    for r in rows:
        r["p"] = float(r["공정확률"]) / 100
        r["h"] = int(r["hit"])
        r["o"] = float(r["베트맨"]) if r.get("베트맨") else None
    lines = []

    def section(title, groups):
        lines.append(f"\n### {title}")
        lines.append("| 구분 | 선택지 수 | 예상 적중 | 실제 적중 | 차이 | 1만원씩 ROI |")
        lines.append("|---|---|---|---|---|---|")
        for name, g in groups:
            if not g:
                continue
            exp = sum(r["p"] for r in g)
            act = sum(r["h"] for r in g)
            roi = sum((r["o"] or 0) * r["h"] for r in g if r["o"]) / max(1, sum(1 for r in g if r["o"])) * 100
            lines.append(f"| {name} | {len(g)} | {exp:.1f} ({exp/len(g)*100:.1f}%) | {act} ({act/len(g)*100:.1f}%) | {(act-exp)/len(g)*100:+.1f}%p | {roi:.0f}% |")

    bins = [(f"{lo}~{lo+9}%", [r for r in rows if lo <= r["p"] * 100 < lo + 10]) for lo in range(0, 100, 10)]
    section("확률 구간별 (모든 선택지)", bins)
    section("종목별", [(s, [r for r in rows if r["종목"] == s]) for s in sorted({r["종목"] for r in rows})])
    def gtype(r):
        g = r["구분"]
        if g.startswith("전반"):
            return "전반"
        if g.startswith("U/O"):
            return "언더오버"
        if g.startswith("H"):
            return "핸디캡"
        return "일반"
    section("유형별", [(t, [r for r in rows if gtype(r) == t]) for t in ("일반", "핸디캡", "언더오버", "전반")])
    section("근거별", [(s, [r for r in rows if r["근거"] == s]) for s in sorted({r["근거"] for r in rows})])
    # 전략: 경기당 최고 확률 선택지 (--best 와 같은 규칙, 배당 1.3 이상)
    best = {}
    for r in rows:
        if r["o"] is None or r["o"] < 1.3:
            continue
        k = (r["회차"], r["경기"], r["시각"])
        if k not in best or r["p"] > best[k]["p"]:
            best[k] = r
    bl = list(best.values())
    section("전략: 경기당 최고 확률 선택지(배당 1.3 이상) — 추천 규칙 그대로", [
        ("전체", bl), ("확률 70% 이상", [r for r in bl if r["p"] >= 0.7]), ("60~70%", [r for r in bl if 0.6 <= r["p"] < 0.7]),
        ("60% 미만", [r for r in bl if r["p"] < 0.6])])
    # 기대값 구간
    ev_rows = [r for r in rows if r.get("기대값")]
    section("기대값 구간별 (가격이 수익을 설명하는지)", [
        ("1.00 이상", [r for r in ev_rows if float(r["기대값"]) >= 1.0]),
        ("0.95~1.00", [r for r in ev_rows if 0.95 <= float(r["기대값"]) < 1.0]),
        ("0.90~0.95", [r for r in ev_rows if 0.90 <= float(r["기대값"]) < 0.95]),
        ("0.90 미만", [r for r in ev_rows if float(r["기대값"]) < 0.90])])
    n_round = len({r["회차"] for r in rows})
    head = [f"# 전체 추적 보고 ({dt.datetime.now(KST):%Y-%m-%d %H:%M})",
            f"- 결과가 나온 선택지 {len(rows)}개, {n_round}개 회차. 구매·추천 여부와 무관하게 스캔한 전부.",
            "- '예상 적중'은 Pinnacle 공정 확률의 합. 차이가 ±3%p 안이면 확률표가 맞는 것. ROI는 그 구간 선택지를 전부 1만원씩 샀을 때.",
            "- 표본이 300개 미만인 구간의 차이는 우연일 수 있다."]
    text = "\n".join(head + lines)
    print(text)
    if save_md:
        out = os.path.join(ROOT, "회차별분석", f"전체추적_{dt.datetime.now(KST):%Y-%m-%d}.md")
        open(out, "w", encoding="utf-8").write(text + "\n")
        print("\n저장:", out)


# ---------------------------------------------------------------- CLV (마감 배당 대비 가치)
def clv_report(save_md=True, top=15):
    """배당이력.csv: 같은 선택지의 첫 스캔 vs 마지막 스캔(킥오프 직전) 기대값을 비교한다.
    - CLV = 마지막 공정확률 × 처음 베트맨 배당 − 1 : 처음 봤을 때 샀다면 마감 기준으로 얼마나 유리/불리했는가.
    - 베트맨 지연 = 마지막 기대값 − 처음 기대값 : Pinnacle은 움직였는데 베트맨이 안 고친 정도.
    결과가 쌓이기 전에도(50~100건) '가치를 사고 있는지'를 판정할 수 있는 표준 지표."""
    hist = os.path.join(ROOT, "data", "배당이력.csv")
    if not os.path.exists(hist):
        print("배당이력.csv 없음. odds_scan.py --log 를 여러 번 돌리면 쌓인다.")
        return
    rows = list(csv.DictReader(open(hist, encoding="utf-8")))
    by = {}
    for r in rows:
        by.setdefault((r["회차"], r["번호"], r["선택"]), []).append(r)
    res_rows = {key(r): r for r in load()}
    items = []
    for k, g in by.items():
        g.sort(key=lambda r: r["scan_time"])
        f, l = g[0], g[-1]
        if len(g) < 2 or not f["공정확률"] or not l["공정확률"] or not f["베트맨"]:
            continue
        p0, p1 = float(f["공정확률"]) / 100, float(l["공정확률"]) / 100
        o0, o1 = float(f["베트맨"]), float(l["베트맨"])
        clv = p1 * o0 - 1
        lag = p1 * o1 - p0 * o0
        rr = res_rows.get(k, {})
        items.append({"회차": k[0], "경기": l["경기"], "구분": l["구분"], "선택": k[2], "스캔수": len(g),
                      "처음": f"{p0*100:.1f}%×{o0}", "마지막": f"{p1*100:.1f}%×{o1}", "EV처음": round(p0 * o0, 3), "EV마지막": round(p1 * o1, 3),
                      "CLV": round(clv, 3), "베트맨지연": round(lag, 3), "결과": rr.get("hit", ""), "근거": l["근거"]})
    if not items:
        print("같은 선택지가 2번 이상 스캔된 기록이 아직 없습니다.")
        return
    lines = [f"# CLV 보고 ({dt.datetime.now(KST):%Y-%m-%d %H:%M}) — 선택지 {len(items)}개 (2회 이상 스캔)",
             "- CLV = 마지막(킥오프 직전) 공정확률 × 처음 베트맨 배당 − 1. 양수면 '처음 봤을 때 산 가격이 마감 기준으로 유리했다'.",
             "- 베트맨 지연 = 마지막 기대값 − 처음 기대값. 양수면 Pinnacle이 그쪽으로 움직였는데 베트맨이 덜 따라갔다.",
             f"- 평균 CLV {sum(i['CLV'] for i in items)/len(items):+.3f}, 평균 베트맨 지연 {sum(i['베트맨지연'] for i in items)/len(items):+.3f}, "
             f"마지막 기대값 1.0 이상 {sum(1 for i in items if i['EV마지막'] >= 1.0)}개 (처음 기준 {sum(1 for i in items if i['EV처음'] >= 1.0)}개)"]
    def table(title, its):
        lines.append(f"\n### {title}")
        lines.append("| 회차 | 경기 | 구분 | 선택 | 처음 | 마지막 | EV처음 | EV마지막 | CLV | 베트맨지연 | 결과 | 근거 |")
        lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
        for i in its:
            lines.append(f"| {i['회차']} | {i['경기']} | {i['구분']} | {i['선택']} | {i['처음']} | {i['마지막']} | {i['EV처음']} | {i['EV마지막']} | {i['CLV']:+.3f} | {i['베트맨지연']:+.3f} | {i['결과']} | {i['근거']} |")
    table(f"마지막 기대값 상위 {top} (지금 사면 좋은 가격)", sorted(items, key=lambda i: -i["EV마지막"])[:top])
    table(f"베트맨 지연 상위 {top} (Pinnacle은 움직였는데 베트맨이 안 고친 것)", sorted(items, key=lambda i: -i["베트맨지연"])[:top])
    done = [i for i in items if i["결과"] in ("0", "1")]
    if done:
        pos = [i for i in done if i["CLV"] > 0]
        neg = [i for i in done if i["CLV"] <= 0]
        lines.append("\n### CLV와 실제 결과")
        lines.append(f"- CLV 양수 {len(pos)}개: 적중 {sum(int(i['결과']) for i in pos)} / CLV 음수 {len(neg)}개: 적중 {sum(int(i['결과']) for i in neg)}")
    text = "\n".join(lines)
    print(text)
    if save_md:
        out = os.path.join(ROOT, "회차별분석", f"CLV_{dt.datetime.now(KST):%Y-%m-%d}.md")
        open(out, "w", encoding="utf-8").write(text + "\n")
        print("\n저장:", out)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("results"); r.add_argument("--round", default="")
    sub.add_parser("report")
    c = sub.add_parser("clv"); c.add_argument("--top", type=int, default=15)
    i = sub.add_parser("import"); i.add_argument("paths", nargs="+")
    a = ap.parse_args()
    if a.cmd == "results":
        fill_results([x for x in a.round.split(",") if x] or None)
    elif a.cmd == "report":
        report()
    elif a.cmd == "clv":
        clv_report(top=a.top)
    elif a.cmd == "import":
        paths = [p for pat in a.paths for p in sorted(glob.glob(pat))]
        print("합계 추가/덮어씀:", import_csvs(paths))


if __name__ == "__main__":
    main()
