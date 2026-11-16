#!/usr/bin/env python3
"""국가대표 회차 분석의 앞뒤 손작업을 도구로 고정한다 (2026-11-17).

왜: 135·136회 A매치 분석에서 기준선 카드 생성·근거 JSON 적용 스크립트를 세션 임시 폴더에 매번 새로 썼다.
    다른 PC·새 세션에는 그 도구가 없어 같은 일을 다시 만들어야 했다.

  python3 scripts/intl_round.py cards 136            # 남은 국가대표 경기의 기준선 카드 → data/카드/136_<번호>.md · data/카드/136.json
  python3 scripts/intl_round.py apply 136 [번호 …]   # data/근거/136_<번호>_*.json → 전체경기기록(순수·깊이=심층) + 정합성 등급
                                                     # 같은 경기가 진행 중인 승무패 회차에 있으면 그쪽에도 복사해 적용한다
순서: intl_baseline.py --update && --sync → cards → 수집가(브리프/수집가_국가대표.md) → 분석가(브리프/분석가_국가대표.md) → apply
카드에는 자국 개최 기준선과 중립 기준선이 둘 다 있다. 분석가는 개최지를 보고 하나를 고르고 `최종` 은 그 기준선 그대로다.
"""
import argparse, csv, glob, json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import intl_baseline as ib
import matchkey

LOG = os.path.join(ROOT, "전체경기기록.csv")
CARD = os.path.join(ROOT, "data", "카드")
COLS = ["번호", "홈", "원정", "순수_승", "순수_무", "순수_패", "확신도", "핵심근거", "뉴스위험", "깊이", "예상점수"]


def _rows():
    return list(csv.DictReader(open(LOG, encoding="utf-8-sig")))


def cmd_cards(a):
    R = _rows()
    toto = {matchkey.key(r): r for r in R if r["회차"].startswith("승무패") and not r.get("결과")}
    os.makedirs(CARD, exist_ok=True)
    path = os.path.join(CARD, f"{a.round}.json")
    cards = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    f = lambda b: [round(b[k] * 100, 1) for k in "승무패"]
    for r in R:
        if r["회차"] != str(a.round) or r.get("결과") or not ib.is_intl(r):
            continue
        no = r["번호"]
        b, n = ib.baseline(r["홈"], r["원정"]), ib.baseline(r["홈"], r["원정"], neutral=True)
        if not b:
            print(f"{no} {r['홈']}-{r['원정']}: 기준선 없음 — data/intl/names.json 에 팀명을 추가한다"); continue
        t = toto.get(matchkey.key(r))
        cards[no] = {"홈": r["홈"], "원정": r["원정"], "h": f(b), "n": f(n), "시각": r["시각"], "리그": r["리그"],
                     "toto": [t["회차"], t["번호"]] if t else None}
        h, aw = b["en"]
        txt = [f"## {no} {r['시각']} {r['리그']} — {r['홈']}({h}) vs {r['원정']}({aw})",
               f"Elo {b['elo_h']:.0f} vs {b['elo_a']:.0f} (경기 수 {b['n_h']}·{b['n_a']})",
               "기준선(홈팀 자국 개최): 승 %s / 무 %s / 패 %s" % tuple(f(b)),
               "기준선(중립 구장일 때): 승 %s / 무 %s / 패 %s" % tuple(f(n))]
        for team in (h, aw):
            txt.append(f"{team} 최근 8경기(Elo 에 반영된 것, 날짜는 한국 시각일 수 있음):")
            txt += ["  " + x for x in ib.recent(team)]
        open(os.path.join(CARD, f"{a.round}_{no}.md"), "w", encoding="utf-8").write("\n".join(txt) + "\n")
        print(f"{no} {r['시각'][-11:]} {r['홈']}-{r['원정']}: 자국 {f(b)} · 중립 {f(n)}" + (f" · {t['회차']} {t['번호']}번" if t else ""))
    json.dump(cards, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"→ data/카드/{a.round}.json · data/카드/{a.round}_<번호>.md ({len(cards)}경기)")
    return 0


def _row(d, no, home, away):
    f = d["최종"]
    return {"번호": no, "홈": home, "원정": away, "순수_승": f["승"], "순수_무": f["무"], "순수_패": f["패"],
            "확신도": d.get("확신도", ""), "핵심근거": d.get("결론", ""), "뉴스위험": d.get("뉴스위험", ""),
            "깊이": "심층", "예상점수": d.get("예상점수", "")}


def cmd_apply(a):
    path = os.path.join(CARD, f"{a.round}.json")
    if not os.path.exists(path):
        print(f"data/카드/{a.round}.json 없음 — intl_round.py cards {a.round} 를 먼저 돌린다"); return 1
    cards = json.load(open(path, encoding="utf-8"))
    R = _rows()
    os.chdir(ROOT)
    batches = {}          # 회차 → ([pure 행], [근거 파일])
    for no, c in cards.items():
        if a.nos and no not in a.nos:
            continue
        g = glob.glob(f"data/근거/{a.round}_{no}_*.json")
        if not g:
            print("근거 없음:", no, c["홈"], c["원정"]); continue
        raw = json.load(open(g[0], encoding="utf-8"))
        d = raw[0] if isinstance(raw, list) else raw
        f = d["최종"]
        dist = lambda b: sum(abs(f[k] - b[i]) for i, k in enumerate("승무패"))
        base = c["h"] if dist(c["h"]) <= dist(c["n"]) else c["n"]
        dev = max(abs(f[k] - base[i]) for i, k in enumerate("승무패"))
        tot = f["승"] + f["무"] + f["패"]
        flag = "" if abs(tot - 100) <= 0.2 and dev <= 0.15 else f"  ⚠ 합 {tot:.1f} · 기준선과 최대 {dev:.1f}p 차"
        print(f"{no} {c['홈']}-{c['원정']}: {f['승']}/{f['무']}/{f['패']} ({'중립' if base is c['n'] and c['n'] != c['h'] else '자국'}){flag}"
              f" | 기권 {d.get('기권')} | {(d.get('다리판단') or '')[:60]}")
        d["번호"] = int(no)
        for s in d.get("선택지", []):
            s["번호"] = int(no)
        json.dump([d], open(g[0], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        b = batches.setdefault(str(a.round), ([], []))
        b[0].append(_row(d, no, c["홈"], c["원정"])); b[1].append(g[0])
        if c.get("toto"):
            trnd, tno = c["toto"]
            t = next((r for r in R if r["회차"] == trnd and r["번호"] == str(tno)), None)
            if not t:
                continue
            d2 = json.loads(json.dumps(d)); d2["번호"] = int(tno); d2["홈"], d2["원정"] = t["홈"], t["원정"]
            for s in d2.get("선택지", []):
                s["번호"] = int(tno)
            tsrc = f"data/수집/{trnd}_{tno}_{t['홈']}-{t['원정']}.json"
            for fac in d2.get("요인", []):
                if f"{a.round}_" in (fac.get("출처") or ""):
                    fac["출처"] = tsrc
            out = f"data/근거/{trnd}_{tno}_{t['홈']}-{t['원정']}.json"
            json.dump([d2], open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            src = glob.glob(f"data/수집/{a.round}_{no}_*.json")
            if src:
                shutil.copy(src[0], tsrc)
            b = batches.setdefault(trnd, ([], []))
            b[0].append(_row(d2, str(tno), t["홈"], t["원정"])); b[1].append(out)
    for rnd, (rows, files) in batches.items():
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=COLS); w.writeheader(); w.writerows(rows)
        r = subprocess.run([sys.executable, "scripts/round_log.py", "pure", rnd, fh.name], capture_output=True, text=True)
        print(f"[{rnd}] pure:", (r.stdout + r.stderr).strip().splitlines()[-3:])
        os.unlink(fh.name)
        for f_ in files:
            r = subprocess.run([sys.executable, "scripts/integrity.py", "add", rnd, f_], capture_output=True, text=True)
            out = (r.stdout + r.stderr).strip().splitlines()
            print(f"[{rnd}] {os.path.basename(f_)}:", " / ".join(x.strip() for x in out[-3:])[:300])
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("cards"); p.add_argument("round"); p.set_defaults(f=cmd_cards)
    p = s.add_parser("apply"); p.add_argument("round"); p.add_argument("nos", nargs="*"); p.set_defaults(f=cmd_apply)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
