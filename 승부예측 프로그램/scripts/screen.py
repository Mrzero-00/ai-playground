#!/usr/bin/env python3
"""
1차 가벼운 선별 — 조합에 들어갈 만한 경기 목록 (사용자 제안 2026-10-15)

왜: 심층 분석(결장 등급×대체 격차·예상 XI·포메이션·2차 반론)은 경기당 시간이 많이 든다.
    먼저 배당만으로 '조합 다리가 될 수 있는 자리'를 거르고, 그 경기에만 심층 분석을 한다.

후보 (data/스캔기록.csv 의 가장 최근 값, 아직 시작 안 한 경기만)
- B 후보: 시장 공정확률 60%+ · 베트맨 1.2+ → 심층 분석에서 방향이 시장과 같고 내 확률이 시장보다 높지 않으면 B 다리(2026-10-19 교체)
- (폐지 2026-10-19) A 갈림 자리 — 백테스트 46다리 39.1%로 영구 금지. 시장 45~60% 경기는 학습용 기록만.
  (시장 45% 미만은 내 확률이 53%+여야 A가 되는데 근거 없는 큰 갈림은 120·122회에 대부분 틀렸다 → 1차에서 뺀다)
- 농구·배구도 후보에 넣는다(2026-10-19 사용자 지시, 가상 추천 모드 한정 — 실투자 전 종목별 적중률로 재판정).

사용
  python3 scripts/screen.py --round 122                    # 회차 전체
  python3 scripts/screen.py --round 122 --from "10-16 01:00" --to "10-16 05:00"   # 블록(킥오프 시각 범위)
출력: 경기 단위 후보 표 + 심층 분석 대상 번호 목록(조사 에이전트에 넘길 것). 시장 숫자는 에이전트에게 주지 않는다(가리고 분석).
"""
import argparse
import csv
import datetime as dt
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")


def load(rnd):
    last = {}
    for r in csv.DictReader(open(SCAN, encoding="utf-8")):
        if r["회차"] != str(rnd):
            continue
        k = (r["번호"], r["선택"])
        if k not in last or r["scan_time"] >= last[k]["scan_time"]:
            last[k] = r
    return list(last.values())


def main():
    ap = argparse.ArgumentParser(description="1차 가벼운 선별")
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("--from", dest="frm", default="", help='킥오프 시작 "MM-DD HH:MM"')
    ap.add_argument("--to", default="", help='킥오프 끝 "MM-DD HH:MM"')
    ap.add_argument("--started", action="store_true", help="이미 시작한 경기도 포함")
    a = ap.parse_args()
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    rows = []
    for r in load(a.round):
        t = r["시각"][5:16]
        if a.frm and t < a.frm or a.to and t > a.to:
            continue
        if not a.started and r["시각"][:16] <= now:
            continue
        if r["종목"] == "농구":
            continue
        try:
            p, o = float(r["공정확률"]), float(r["베트맨"])
        except (ValueError, TypeError):
            continue
        if o < 1.2:
            continue
        v = p * o / 100
        kind = "B" if p >= 60 else ("A자리" if 45 <= p < 60 else None)  # 2026-10-16 기대값 조건 폐지
        if kind:
            rows.append((kind, r, p, o, v))
    rows.sort(key=lambda x: (x[0] != "B", -x[4]))
    print(f"| 후보 | 번호 | 시각 | 종목 | 경기 | 선택지 | 배당 | 시장 | 시장×배당 |")
    print("|---|---|---|---|---|---|---|---|---|")
    games = {}
    for kind, r, p, o, v in rows:
        g = f"{r['구분']} {r['선택']}" if r["구분"] != "일반" else r["선택"]
        tag = " (배구·기록용)" if r["종목"] == "배구" else ""
        print(f"| {kind} | {r['번호']} | {r['시각'][5:16]} | {r['종목']} | {r['경기']}{tag} | {r['유형']} {g} | {o:.2f} | {p:.1f}% | {v:.3f} |")
        games.setdefault(r["경기"], []).append(r["번호"])
    print(f"\n심층 분석 대상 {len(games)}경기: " + ", ".join(f"{k} ({'·'.join(sorted(set(v)))})" for k, v in games.items()))
    print("→ 이 경기만 2차 심층(결장 등급×대체 격차·예상 XI·상성·2차 반론). 나머지는 기준선만 '가벼운 분석'으로 기록.")
    print("→ 뉴스 훑기로 새 주축 결장·로테이션이 확인된 경기는 후보에 추가(A 갈림 가능).")


if __name__ == "__main__":
    main()
