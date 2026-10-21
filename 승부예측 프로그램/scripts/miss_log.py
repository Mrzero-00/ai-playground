#!/usr/bin/env python3
"""방향이 빗나간 경기의 '원인'과 '경기 전에 알 수 있었는가'를 쌓는 장부.

사용자 지시(2026-10-22):
  "승 40 / 무 30 / 패 30 이라도 내 1순위가 승이면 승 100%라고 보고 승이 아니면 의미가 없다.
   승이 아니었다면 어떤 요소 때문인지, 그 이유를 경기 시작 전에 분석으로 알 수 있었는지,
   알 수 있었다면 다음 분석부터 그걸 고려하고 다시 테스트한다. 이걸 반복해 성공률을 올린다."

그래서 확률의 정합(= calib_report.py)과 별개로, **방향 적중 하나**만 놓고 실패를 해부한다.
핵심 열은 `사전인지`다. 경기 중 사건(퇴장·부상·오심)이면 쌓아도 다음 분석에 쓸 수 없다.
경기 전에 알 수 있었던 것만 점검표로 올라가고, 그 점검표가 다음 분석의 입력이 된다.

    python3 scripts/miss_log.py pending --round 124   # 아직 원인을 안 적은 실패 경기
    python3 scripts/miss_log.py add --round 124 --no 8771 --요인 "원정 3일 휴식" \
        --사전 가능 --점검 "휴식일 3일 이하 원정팀은 승 확률 -5%p"
    python3 scripts/miss_log.py report                # 반복되는 원인·사전인지 비율
    python3 scripts/miss_log.py checklist             # 분석전_점검표.md 갱신
"""
import argparse, collections, csv, datetime as dt, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LOG = os.path.join(ROOT, "data", "실패요인.csv")
CHECK = os.path.join(ROOT, "분석전_점검표.md")
SIDES = ("승", "무", "패")
COLS = ["회차", "번호", "경기", "종목", "리그", "내1순위", "내확률", "실제", "4분면",
        "요인", "사전인지", "점검항목", "기록일"]


def rows(path):
    p = os.path.join(ROOT, path)
    if not os.path.exists(p):
        return []
    return list(csv.DictReader(open(p, encoding="utf-8-sig")))


def logs():
    if not os.path.exists(LOG):
        return []
    return list(csv.DictReader(open(LOG, encoding="utf-8-sig")))


def save(rs):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    w = csv.DictWriter(open(LOG, "w", encoding="utf-8", newline=""), fieldnames=COLS)
    w.writeheader()
    for r in rs:
        w.writerow({c: r.get(c, "") for c in COLS})


def top(r, pre="보정"):
    v = {}
    for k in SIDES:
        x = r.get(f"{pre}_{k}")
        if x in (None, ""):
            return None, None
        try:
            v[k] = float(x)
        except ValueError:
            return None, None
    t = max(v, key=v.get)
    return t, v[t]


def misses(rnd=None):
    """내 1순위가 실제와 다른 경기. 보정이 없으면 순수로 본다."""
    quad = {(x["회차"], x["번호"]): x.get("4분면", "") for x in rows("data/과정채점.csv")}
    out = []
    for r in rows("전체경기기록.csv"):
        if r.get("결과") not in SIDES:
            continue
        if rnd and r.get("회차") != str(rnd):
            continue
        t, p = top(r, "보정")
        if not t:
            t, p = top(r, "순수")
        if not t or t == r["결과"]:
            continue
        out.append({"회차": r["회차"], "번호": r["번호"], "경기": f"{r['홈']} vs {r['원정']}",
                    "종목": r.get("종목", ""), "리그": r.get("리그", ""),
                    "내1순위": t, "내확률": f"{p:.0f}", "실제": r["결과"],
                    "4분면": quad.get((r["회차"], r["번호"]), ""),
                    "점수": r.get("점수", ""), "근거": (r.get("핵심근거") or "")[:160]})
    return out


def cmd_pending(a):
    done = {(x["회차"], x["번호"]) for x in logs()}
    xs = [m for m in misses(a.round) if (m["회차"], m["번호"]) not in done]
    if not xs:
        print("원인을 적을 실패 경기가 없다.")
        return 0
    print(f"원인 미기록 실패 경기 {len(xs)}건 — 각각 요인·사전인지·점검항목을 적는다.\n")
    for m in xs:
        print(f"[{m['회차']}회 {m['번호']}] {m['경기']} ({m['종목']}·{m['리그']})")
        print(f"   내 1순위 {m['내1순위']} {m['내확률']}% → 실제 {m['실제']} {m['점수']}"
              + (f" · 4분면 {m['4분면']}" if m["4분면"] else ""))
        if m["근거"]:
            print(f"   당시 근거: {m['근거']}")
        print()
    return 0


def cmd_add(a):
    if a.사전 not in ("가능", "불가"):
        print("--사전 은 '가능' 또는 '불가'", file=sys.stderr)
        return 1
    if a.사전 == "가능" and not a.점검:
        print("사전인지 '가능' 이면 --점검(다음 분석에서 무엇을 확인할지)을 반드시 적는다", file=sys.stderr)
        return 1
    src = {(m["회차"], m["번호"]): m for m in misses()}
    key = (str(a.round), str(a.no))
    if key not in src:
        print(f"{a.round}회 {a.no} 는 실패 경기 목록에 없다", file=sys.stderr)
        return 1
    m = src[key]
    rs = [x for x in logs() if (x["회차"], x["번호"]) != key]
    rs.append({**{c: m.get(c, "") for c in COLS}, "요인": a.요인, "사전인지": a.사전,
               "점검항목": a.점검 or "", "기록일": dt.date.today().isoformat()})
    rs.sort(key=lambda x: (int(x["회차"]) if x["회차"].isdigit() else 0, x["번호"]))
    save(rs)
    print(f"기록: {a.round}회 {a.no} {m['경기']} — {a.요인} (사전인지 {a.사전})")
    return 0


def cmd_report(a):
    rs = logs()
    if not rs:
        print("기록 없음")
        return 0
    allm = misses()
    print(f"실패 경기 {len(allm)}건 중 원인 기록 {len(rs)}건 ({len(rs) / len(allm) * 100:.0f}%)\n")
    c = collections.Counter(x["사전인지"] for x in rs)
    pre = c.get("가능", 0)
    print(f"경기 전에 알 수 있었던 실패: {pre}/{len(rs)} ({pre / len(rs) * 100:.0f}%)")
    print(f"경기 중 사건이라 막을 수 없던 실패: {c.get('불가', 0)}/{len(rs)}\n")
    print("-- 되풀이되는 점검항목 (사전인지 가능만)")
    k = collections.Counter(x["점검항목"] for x in rs if x["사전인지"] == "가능" and x["점검항목"])
    for item, n in k.most_common():
        print(f"   {n:2d}회  {item}")
    print("\n-- 종목·리그별 실패")
    d = collections.Counter((x["종목"], x["리그"]) for x in rs)
    for (sp, lg), n in d.most_common(10):
        print(f"   {n:2d}건  {sp} {lg}")
    print("\n-- 놓친 방향 (내 1순위 → 실제)")
    for (a_, b), n in collections.Counter((x["내1순위"], x["실제"]) for x in rs).most_common():
        print(f"   {n:2d}건  {a_} → {b}")
    return 0


def cmd_checklist(a):
    rs = [x for x in logs() if x["사전인지"] == "가능" and x["점검항목"]]
    k = collections.Counter(x["점검항목"] for x in rs)
    byitem = collections.defaultdict(list)
    for x in rs:
        byitem[x["점검항목"]].append(x)
    out = [f"# 분석 전 점검표 — {dt.date.today()}", "",
           "빗나간 경기를 회고해서 **경기 전에 알 수 있었던** 원인만 모은 것이다.",
           "분석가는 방향을 정하기 전에 이 표의 항목을 하나씩 확인하고, 해당되면 확률에 반영한다.",
           "해당 없음도 근거에 남긴다(확인했다는 표시).", "",
           "| 횟수 | 점검할 것 | 나온 곳 |", "|---:|---|---|"]
    for item, n in k.most_common():
        where = ", ".join(sorted({f"{x['회차']}회 {x['경기'][:18]}" for x in byitem[item]})[:3])
        out.append(f"| {n} | {item} | {where} |")
    if not k:
        out.append("| - | (아직 없음) | |")
    out += ["", "## 막을 수 없었던 실패(참고)",
            "경기 중 퇴장·부상·오심처럼 사전 분석으로 알 수 없는 것은 점검표에 올리지 않는다. "
            "이쪽 비중이 높으면 그 경기는 분석 실패가 아니라 분산이다.", ""]
    nb = [x for x in logs() if x["사전인지"] == "불가"]
    for x in nb[-10:]:
        out.append(f"- {x['회차']}회 {x['경기']} — {x['요인']}")
    open(CHECK, "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"→ {CHECK} ({len(k)}개 항목, 사전인지 불가 {len(nb)}건)")
    return 0


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pending"); p.add_argument("--round"); p.set_defaults(f=cmd_pending)
    p = sub.add_parser("add")
    p.add_argument("--round", required=True); p.add_argument("--no", required=True)
    p.add_argument("--요인", required=True); p.add_argument("--사전", required=True)
    p.add_argument("--점검", default=""); p.set_defaults(f=cmd_add)
    p = sub.add_parser("report"); p.set_defaults(f=cmd_report)
    p = sub.add_parser("checklist"); p.set_defaults(f=cmd_checklist)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
