#!/usr/bin/env python3
"""회고로 스킬을 고칠 때마다 그 내역을 저장소에 남긴다.

사용자 지시 2026-11-02: "회고를 통해 스킬을 수정하면 해당 내용도 저장소에 저장하고
계속 갱신할 수 있도록 해줘."

왜 — 스킬을 고쳐도 왜 고쳤는지가 남지 않으면, 몇 주 뒤에 같은 걸 되돌리거나 반대로 고치게 된다.
그래서 **바꾼 내용 · 근거 숫자 · 되돌릴 조건**을 한 항목으로 묶어 쌓는다.

  SKILL.md         현재 규칙 (사람이 읽는 본문)
  CHANGELOG.md     언제 무엇을 왜 바꿨는가 (쌓이기만 한다, 지우지 않는다)
  data/스킬변경.csv  같은 내용을 기계가 읽을 수 있게

    python3 scripts/skill_log.py add --what "갈림 경기만 따로 집계" \
        --why "일치 구간 적중률만 높으면 시장을 베낀 것이라 구분이 필요" \
        --evidence "승무패63 일치 58% / 갈림 0%" --revert "갈림 적중이 일치보다 낮은 상태가 3회차 지속되면"
    python3 scripts/skill_log.py list
"""
import argparse, csv, datetime as dt, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REPO = os.path.join(ROOT, "..")
SKILL_DIR = os.path.join(REPO, ".claude", "skills", "betman-match-analysis")
CHANGELOG = os.path.join(SKILL_DIR, "CHANGELOG.md")
CSV = os.path.join(ROOT, "data", "스킬변경.csv")
COLS = ["날짜", "바꾼 것", "이유", "근거 숫자", "되돌릴 조건", "회차"]


def rows():
    return list(csv.DictReader(open(CSV, encoding="utf-8-sig"))) if os.path.exists(CSV) else []


def cmd_add(a):
    if not os.path.isdir(SKILL_DIR):
        print(f"스킬 폴더가 없다: {SKILL_DIR}", file=sys.stderr); return 1
    today = dt.date.today().isoformat()
    rs = rows()
    rs.append({"날짜": today, "바꾼 것": a.what, "이유": a.why,
               "근거 숫자": a.evidence or "", "되돌릴 조건": a.revert or "", "회차": a.round or ""})
    os.makedirs(os.path.dirname(CSV), exist_ok=True)
    w = csv.DictWriter(open(CSV, "w", encoding="utf-8", newline=""), fieldnames=COLS)
    w.writeheader()
    for r in rs:
        w.writerow({c: r.get(c, "") for c in COLS})

    head = ("# 스킬 변경 이력\n\n"
            "회고로 규칙을 고칠 때마다 한 항목씩 쌓는다. **지우지 않는다** — 어느 방향이 막혔는지가\n"
            "증거로 남아야 같은 실수를 되풀이하지 않는다. 되돌릴 조건을 미리 적어 두는 것이 핵심이다.\n")
    body = ""
    if os.path.exists(CHANGELOG):
        cur = open(CHANGELOG, encoding="utf-8").read()
        body = cur.split("\n## ", 1)[1] if "\n## " in cur else ""
        body = ("\n## " + body) if body else ""
    item = [f"\n## {today}" + (f" · {a.round}회" if a.round else ""), "",
            f"**바꾼 것** {a.what}", "", f"**이유** {a.why}", ""]
    if a.evidence:
        item += [f"**근거 숫자** {a.evidence}", ""]
    if a.revert:
        item += [f"**되돌릴 조건** {a.revert}", ""]
    open(CHANGELOG, "w", encoding="utf-8").write(head + "\n".join(item) + body)
    print(f"기록: {today} — {a.what}")
    print(f"  → {CHANGELOG}")
    print(f"  → {CSV} ({len(rs)}건)")
    print("\n※ SKILL.md 본문도 함께 고쳤는지 확인하고, 둘 다 커밋한다.")
    return 0


def cmd_list(a):
    rs = rows()
    if not rs:
        print("기록 없음"); return 0
    print(f"스킬 변경 {len(rs)}건\n")
    for r in rs[-(a.n):]:
        print(f"  {r['날짜']}{(' · ' + r['회차'] + '회') if r.get('회차') else ''}")
        print(f"    바꾼 것   {r['바꾼 것']}")
        print(f"    이유      {r['이유']}")
        if r.get("근거 숫자"):
            print(f"    근거      {r['근거 숫자']}")
        if r.get("되돌릴 조건"):
            print(f"    되돌릴 때 {r['되돌릴 조건']}")
        print()
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("add")
    p.add_argument("--what", required=True); p.add_argument("--why", required=True)
    p.add_argument("--evidence"); p.add_argument("--revert"); p.add_argument("--round")
    p.set_defaults(f=cmd_add)
    p = s.add_parser("list"); p.add_argument("-n", type=int, default=10); p.set_defaults(f=cmd_list)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
