#!/usr/bin/env python3
"""경기 결과를 해부해 '원인'과 '경기 전에 알 수 있었는가'를 쌓는 장부.

사용자 지시(2026-10-22):
  "승 40 / 무 30 / 패 30 이라도 내 1순위가 승이면 승 100%라고 보고 승이 아니면 의미가 없다.
   승이 아니었다면 어떤 요소 때문인지, 그 이유를 경기 시작 전에 분석으로 알 수 있었는지,
   알 수 있었다면 다음 분석부터 그걸 고려하고 다시 테스트한다."
  "경기 중 부상·퇴장은 사전에 알 수 없으니 원인으로 삼지 않는다. **다만 같은 부상이라도
   피로 누적이나 직전 몸 상태가 안 좋다는 신호가 있었다면 고려할 만한 사항이 된다.**"
  "내가 모든 사항을 세세히 알 수 없으니, **어떤 포인트 때문에 예상과 달랐는지, 그게 경기 전에
   충분히 확인할 수 있는 것이었는지는 네가 판단해서 분석에 넣을지 자유롭게 결정해라.**"
  "**예상대로 끝났을 때도** 내 분석 내용 때문에 그 결과가 나온 건지, 퇴장 같은 알 수 없는 일
   때문인지 회고하면 분석 자료의 퀄리티가 좋아진다."

그래서 적중·실패를 **둘 다** 기록한다. 축은 결과가 아니라 **원인이 어디서 왔는가**다.

  실패했을 때 `판정`:
    가능 — 경기 전에 확인할 수 있었다. 점검 항목으로 올린다.
    부분 — 경기 중 사건이지만 **사전 신호가 있었다**(피로 누적, 직전 컨디션 난조, 과밀 일정).
           신호를 점검 항목으로 올린다. 사건 자체가 아니라 신호가 항목이다.
    불가 — 순수한 경기 중 사건(돌발 부상·퇴장·오심)이거나 결정력 분산. 점검표에 올리지 않는다.
  적중했을 때 `판정`:
    근거대로 — 내가 쓴 근거가 실제 경기에 나타나서 맞았다. 그 근거를 팀노트·규칙에 보강한다.
    운      — 근거는 빗나갔는데 퇴장·오심 등으로 맞았다. **좋은 분석으로 남기지 않는다.**
              이때도 '무엇을 못 봤는지'를 점검 항목으로 올릴 수 있다.

판정은 Claude가 증거(xG·슈팅·실제 선발·경기 후 기록)를 보고 **스스로 정한다**. 사용자 승인을 기다리지 않는다.

    python3 scripts/result_log.py pending --round 125            # 아직 해부 안 한 경기(적중+실패)
    python3 scripts/result_log.py pending --round 125 --only 실패
    python3 scripts/result_log.py add --round 125 --no 8771 --요인 "원정 3일 휴식" \
        --판정 가능 --점검 "휴식일 3일 이하 원정팀은 승 확률 -5%p"
    python3 scripts/result_log.py report                         # 근거대로 비율·되풀이 항목
    python3 scripts/result_log.py checklist                      # 분석전_점검표.md 갱신
"""
import argparse, collections, csv, datetime as dt, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LOG = os.path.join(ROOT, "data", "결과해부.csv")
CHECK = os.path.join(ROOT, "분석전_점검표.md")
SIDES = ("승", "무", "패")
COLS = ["회차", "번호", "경기", "종목", "리그", "내1순위", "내확률", "실제", "결과구분", "4분면",
        "요인", "판정", "점검항목", "기록일"]
MISS_V = ("가능", "부분", "불가")      # 실패했을 때
HIT_V = ("근거대로", "운")             # 적중했을 때
ON_LIST = ("가능", "부분", "운")       # 점검표로 올라가는 판정


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


def results(rnd=None, only=None):
    """방향을 적은 채점 경기 전부. only='적중'|'실패' 로 거른다. 보정이 없으면 순수로 본다."""
    quad = {(x["회차"], x["번호"]): x.get("4분면", "") for x in rows("data/과정채점.csv")}
    post = {(x.get("회차"), x.get("번호")): x for x in rows("data/경기후.csv")}
    out = []
    for r in rows("전체경기기록.csv"):
        if r.get("결과") not in SIDES:
            continue
        if rnd and r.get("회차") != str(rnd):
            continue
        t, p = top(r, "보정")
        if not t:
            t, p = top(r, "순수")
        if not t:
            continue
        kind = "적중" if t == r["결과"] else "실패"
        if only and kind != only:
            continue
        pm = post.get((r["회차"], r["번호"]), {})
        ev = " ".join(f"{k} {v}" for k, v in pm.items()
                      if k in ("홈xG", "원정xG", "홈슈팅", "원정슈팅", "홈유효", "원정유효", "홈퇴장", "원정퇴장") and v)
        out.append({"회차": r["회차"], "번호": r["번호"], "경기": f"{r['홈']} vs {r['원정']}",
                    "종목": r.get("종목", ""), "리그": r.get("리그", ""),
                    "내1순위": t, "내확률": f"{p:.0f}", "실제": r["결과"], "결과구분": kind,
                    "4분면": quad.get((r["회차"], r["번호"]), ""),
                    "점수": r.get("점수", ""), "예상점수": r.get("예상점수", ""),
                    "근거": (r.get("핵심근거") or "")[:200], "경기후": ev[:200]})
    return out


def cmd_pending(a):
    done = {(x["회차"], x["번호"]) for x in logs()}
    xs = [m for m in results(a.round, a.only) if (m["회차"], m["번호"]) not in done]
    if not xs:
        print("해부할 경기가 없다.")
        return 0
    nm = sum(1 for m in xs if m["결과구분"] == "실패")
    print(f"해부 미기록 {len(xs)}건 (실패 {nm} · 적중 {len(xs) - nm})")
    print("실패 → 판정 가능/부분/불가 · 적중 → 판정 근거대로/운. 증거를 보고 직접 정한다.\n")
    for m in xs:
        tag = "✗ 실패" if m["결과구분"] == "실패" else "✓ 적중"
        print(f"[{m['회차']}회 {m['번호']}] {tag}  {m['경기']} ({m['종목']}·{m['리그']})")
        print(f"   내 1순위 {m['내1순위']} {m['내확률']}% → 실제 {m['실제']} {m['점수']}"
              + (f" · 예상점수 {m['예상점수']}" if m["예상점수"] else "")
              + (f" · 4분면 {m['4분면']}" if m["4분면"] else ""))
        if m["경기후"]:
            print(f"   경기 후: {m['경기후']}")
        if m["근거"]:
            print(f"   당시 근거: {m['근거']}")
        print()
    return 0


def cmd_add(a):
    src = {(m["회차"], m["번호"]): m for m in results()}
    key = (str(a.round), str(a.no))
    if key not in src:
        print(f"{a.round}회 {a.no} 는 채점된 경기 목록에 없다", file=sys.stderr)
        return 1
    m = src[key]
    ok = MISS_V if m["결과구분"] == "실패" else HIT_V
    if a.판정 not in ok:
        print(f"{m['결과구분']} 경기의 --판정 은 {' / '.join(ok)} 중 하나", file=sys.stderr)
        return 1
    if a.판정 in ("가능", "부분") and not a.점검:
        print("판정 '가능'·'부분' 이면 --점검(다음 분석에서 무엇을 확인할지)을 반드시 적는다", file=sys.stderr)
        return 1
    rs = [x for x in logs() if (x["회차"], x["번호"]) != key]
    rs.append({**{c: m.get(c, "") for c in COLS}, "요인": a.요인, "판정": a.판정,
               "점검항목": a.점검 or "", "기록일": dt.date.today().isoformat()})
    rs.sort(key=lambda x: (int(x["회차"]) if x["회차"].isdigit() else 0, x["번호"]))
    save(rs)
    print(f"기록: {a.round}회 {a.no} {m['경기']} — [{m['결과구분']}/{a.판정}] {a.요인}")
    return 0


def cmd_report(a):
    rs = logs()
    if not rs:
        print("기록 없음")
        return 0
    allr = results()
    nm = [x for x in rs if x["결과구분"] == "실패"]
    nh = [x for x in rs if x["결과구분"] == "적중"]
    print(f"채점 {len(allr)}경기 중 해부 {len(rs)}건 ({len(rs) / len(allr) * 100:.0f}%) — 실패 {len(nm)} · 적중 {len(nh)}\n")

    if nh:
        byr = collections.Counter(x["판정"] for x in nh)
        real = byr.get("근거대로", 0)
        print(f"-- 적중의 질: 근거대로 {real}/{len(nh)} ({real / len(nh) * 100:.0f}%) · 운 {byr.get('운', 0)}")
        print("   운으로 맞은 건 좋은 분석으로 남기지 않는다.\n")
    if nm:
        c = collections.Counter(x["판정"] for x in nm)
        pre = c.get("가능", 0) + c.get("부분", 0)
        print(f"-- 실패의 질: 사전에 손댈 수 있었던 것 {pre}/{len(nm)} ({pre / len(nm) * 100:.0f}%)")
        print(f"   가능 {c.get('가능', 0)} · 부분(사건이지만 사전 신호 있었음) {c.get('부분', 0)} · 불가 {c.get('불가', 0)}\n")

    print("-- 되풀이되는 점검항목 (점검표로 올라가는 판정만)")
    k = collections.Counter(x["점검항목"] for x in rs if x["판정"] in ON_LIST and x["점검항목"])
    for item, n in k.most_common():
        print(f"   {n:2d}회  {item}")
    print("\n-- 종목·리그별 실패")
    for (sp, lg), n in collections.Counter((x["종목"], x["리그"]) for x in nm).most_common(10):
        print(f"   {n:2d}건  {sp} {lg}")
    print("\n-- 놓친 방향 (내 1순위 → 실제)")
    for (a_, b), n in collections.Counter((x["내1순위"], x["실제"]) for x in nm).most_common():
        print(f"   {n:2d}건  {a_} → {b}")
    return 0


def cmd_checklist(a):
    rs = [x for x in logs() if x["판정"] in ON_LIST and x["점검항목"]]
    k = collections.Counter(x["점검항목"] for x in rs)
    byitem = collections.defaultdict(list)
    for x in rs:
        byitem[x["점검항목"]].append(x)
    out = [f"# 분석 전 점검표 — {dt.date.today()}", "",
           "경기 결과를 해부해서 **경기 전에 확인할 수 있었던** 것만 모은 것이다.",
           "분석가는 방향을 정하기 전에 이 표의 항목을 하나씩 확인하고, 해당되면 확률에 반영한다.",
           "해당 없음도 근거에 남긴다(확인했다는 표시). 횟수 2회 이상이면 규칙이나 스크립트로 고정한다.", "",
           "| 횟수 | 점검할 것 | 나온 곳 |", "|---:|---|---|"]
    for item, n in k.most_common():
        where = ", ".join(sorted({f"{x['회차']}회 {x['경기'][:18]}" for x in byitem[item]})[:3])
        out.append(f"| {n} | {item} | {where} |")
    if not k:
        out.append("| - | (아직 없음) | |")

    part = [x for x in logs() if x["판정"] == "부분"]
    if part:
        out += ["", "## 사건이지만 사전 신호가 있었던 것",
                "경기 중 부상·퇴장이라도 피로 누적·직전 컨디션 난조 같은 신호가 먼저 있었던 경우다. "
                "사건 자체가 아니라 **신호**를 본다.", ""]
        for x in part[-10:]:
            out.append(f"- {x['회차']}회 {x['경기']} — {x['요인']}")

    nb = [x for x in logs() if x["판정"] == "불가"]
    out += ["", "## 손댈 수 없었던 실패(참고)",
            "돌발 부상·퇴장·오심이나 결정력 분산처럼 사전 분석으로 알 수 없는 것은 점검표에 올리지 않는다. "
            "이쪽 비중이 높으면 그 경기는 분석 실패가 아니라 분산이다.", ""]
    for x in nb[-10:]:
        out.append(f"- {x['회차']}회 {x['경기']} — {x['요인']}")

    luck = [x for x in logs() if x["판정"] == "운"]
    if luck:
        out += ["", "## 운으로 맞은 경기(참고)",
                "결과는 맞았지만 근거가 빗나간 경우다. 좋은 분석으로 세지 않는다.", ""]
        for x in luck[-10:]:
            out.append(f"- {x['회차']}회 {x['경기']} — {x['요인']}")

    open(CHECK, "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"→ {CHECK} ({len(k)}개 항목, 부분 {len(part)} · 불가 {len(nb)} · 운 {len(luck)})")
    return 0


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pending"); p.add_argument("--round")
    p.add_argument("--only", choices=("적중", "실패")); p.set_defaults(f=cmd_pending)
    p = sub.add_parser("add")
    p.add_argument("--round", required=True); p.add_argument("--no", required=True)
    p.add_argument("--요인", required=True); p.add_argument("--판정", required=True)
    p.add_argument("--점검", default=""); p.set_defaults(f=cmd_add)
    p = sub.add_parser("report"); p.set_defaults(f=cmd_report)
    p = sub.add_parser("checklist"); p.set_defaults(f=cmd_checklist)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
