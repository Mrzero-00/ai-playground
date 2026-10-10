#!/usr/bin/env python3
"""빠른 학습 신호 — 경기 결과를 기다리지 않고 '마감 시장'을 정답 대용으로 채점 (2026-10-10)

왜: 경기 결과(승/무/패)는 한 경기에 한 번, 운이 크게 섞인 신호라 수백 경기가 쌓여야 실력을 판정할 수 있다.
마감 직전 시장 확률(Pinnacle 공정확률)은 결과보다 훨씬 덜 흔들리는 '부드러운 정답'이라, 같은 표본 수로 훨씬 빨리 판정된다.
- 신호 1 (정확도): 내 확률(순수)이 마감 시장에 얼마나 가까운가 vs 처음 시장(오픈)이 마감에 얼마나 가까운가.
  순수가 오픈보다 마감에 더 가까우면 = 시장이 나중에 알게 된 정보를 내가 먼저 반영했다.
- 신호 2 (방향): 순수가 오픈과 4%p 이상 갈린 경기에서, 마감 시장이 순수 쪽으로 움직였는가(방향 적중률).
  50%를 꾸준히 넘으면 그 리그·변수에서 내 분석이 정보를 갖고 있다는 뜻. 경기 시작 전에 바로 채점된다.
- 결과가 나온 경기는 기존 own_model.py(결과 RPS)와 함께 본다. 이 신호는 결과를 대신하는 게 아니라 '빨리 보는' 보조 지표.

자료: 전체경기기록.csv(순수, 번호) + data/배당이력.csv(autoscan 30분·킥오프 75분 전부터 5분 간격, 구분 '일반' = 대표 시장)
사용: python3 scripts/fast_learn.py   → 회차별분석/빠른학습_YYYY-MM-DD.md
"""
import csv
import datetime as dt
import os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "전체경기기록.csv")
HIST = os.path.join(ROOT, "data", "배당이력.csv")
DIV = 4.0  # 방향 판정 대상: 순수와 오픈의 1순위 차이 %p
PICK = {"승": 0, "무": 1, "패": 2}


def rps(p, q):
    """두 확률 분포 사이의 RPS형 거리(q를 정답 분포로)"""
    return ((p[0] - q[0]) ** 2 + (p[0] + p[1] - q[0] - q[1]) ** 2) / 2


def norm(v):
    s = sum(v)
    return [x / s for x in v] if s > 0 else None


def load_hist():
    """(회차, 번호) → [(scan_time, [승,무,패] 확률)]  — 대표 시장('일반')만"""
    snap = defaultdict(lambda: defaultdict(dict))
    for r in csv.DictReader(open(HIST, encoding="utf-8")):
        if r.get("구분") != "일반" or r.get("선택") not in PICK:
            continue
        try:
            snap[(r["회차"], r["번호"])][r["scan_time"]][r["선택"]] = float(r["공정확률"])
        except (ValueError, KeyError):
            continue
    out = {}
    for k, times in snap.items():
        seq = []
        for t, d in sorted(times.items()):
            v = norm([d.get("승", 0), d.get("무", 0), d.get("패", 0)])
            if v and ("승" in d and "패" in d):
                seq.append((t, v))
        if seq:
            out[k] = seq
    return out


def main():
    hist = load_hist()
    rows = []
    for r in csv.DictReader(open(REC, encoding="utf-8")):
        if not r.get("순수_승") or not r.get("번호") or not r["회차"].isdigit():
            continue
        try:
            own = norm([float(r[f"순수_{k}"] or 0) for k in "승무패"])
        except ValueError:
            continue
        seq = hist.get((r["회차"], r["번호"]))
        if not own or not seq or len(seq) < 2:
            continue
        kick = f"{dt.date.today().year}-{r['시각']}" if len(r["시각"]) == 11 else r["시각"]
        pre = [s for s in seq if s[0] < kick] or seq
        op, cl = pre[0][1], pre[-1][1]
        if op == cl:
            continue  # 시장이 안 움직였으면 방향 판정 불가(정확도 비교에는 포함 가능하나 정보 없음)
        i = max(range(3), key=lambda k: op[k])
        d_own = (own[i] - op[i]) * 100
        d_mkt = (cl[i] - op[i]) * 100
        rows.append({"회차": r["회차"], "종목": r["종목"], "리그": r["리그"], "경기": f"{r['홈']}-{r['원정']}",
                     "순수거리": rps(own, cl), "오픈거리": rps(op, cl), "d_own": d_own, "d_mkt": d_mkt,
                     "방향": None if abs(d_own) < DIV or abs(d_mkt) < 0.5 else int((d_own > 0) == (d_mkt > 0)),
                     "own": own[i] * 100, "open": op[i] * 100, "close": cl[i] * 100})
    seg = defaultdict(list)
    for x in rows:
        for k in ("전체", f"종목:{x['종목']}", f"리그:{x['종목']}·{x['리그']}"):
            seg[k].append(x)
    L = [f"# 빠른 학습 신호 ({dt.date.today()}) — 마감 시장을 정답 대용으로", "",
         "결과를 기다리지 않고 채점한다. '순수가 마감에 더 가까움' 비율이 높고, 갈린 경기의 방향 적중률이 50%를 넘으면 그 구간에서 내 분석이 시장보다 먼저 정보를 잡는다는 신호.", "",
         "| 구간 | 경기 | 순수→마감 거리 | 오픈→마감 거리 | 순수가 더 가까움 | 갈린 경기(≥4%p) | 방향 적중 |", "|---|---|---|---|---|---|---|"]
    for k, xs in sorted(seg.items(), key=lambda kv: (kv[0] != "전체", not kv[0].startswith("종목"), -len(kv[1]))):
        if len(xs) < 3 and k != "전체":
            continue
        closer = sum(1 for x in xs if x["순수거리"] < x["오픈거리"])
        dv = [x for x in xs if x["방향"] is not None]
        L.append(f"| {k} | {len(xs)} | {sum(x['순수거리'] for x in xs) / len(xs):.4f} | {sum(x['오픈거리'] for x in xs) / len(xs):.4f} | "
                 f"{closer}/{len(xs)} | {len(dv)} | {(f'{sum(x['방향'] for x in dv) / len(dv):.0%}' if dv else '-')} |")
    L += ["", "## 갈린 경기 상세 (시장 1순위 기준, %)", "", "| 회차 | 경기 | 순수 | 오픈 | 마감 | 시장 이동 | 순수 쪽? |", "|---|---|---|---|---|---|---|"]
    for x in sorted([x for x in rows if x["방향"] is not None], key=lambda x: -abs(x["d_own"]))[:40]:
        L.append(f"| {x['회차']} | {x['경기']} | {x['own']:.0f} | {x['open']:.0f} | {x['close']:.0f} | {x['d_mkt']:+.1f} | {'O' if x['방향'] else 'X'} |")
    out = os.path.join(ROOT, "회차별분석", f"빠른학습_{dt.date.today()}.md")
    open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L[:20]))
    print("저장:", out)


if __name__ == "__main__":
    main()
