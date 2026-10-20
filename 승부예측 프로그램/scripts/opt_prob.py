#!/usr/bin/env python3
"""경기별 λ(득점 기대) + 분석가 최종 1X2 → 프로토 선택지 확률.

사용자 규칙(분석규칙 2026-10-16): 핸디캡·언더오버는 경기별 λ와 점수 분포로만 계산한다
(리그 평균·수기 계산 금지).

절차
 1) 분석가가 낸 λ홈·λ원정으로 포아송 격자를 만든다.
 2) 분석가 최종 1X2(승/패)에 맞도록 λ에 스칼라 (a, b)를 찾아 보정한다
    — 요인 보정이 1X2에만 반영돼 있고 점수 분포에는 아직 없기 때문.
 3) 보정된 격자에서 정수핸디캡·언더오버·전반 선택지 확률을 읽는다.
    전반 λ = 0.45 × 전체 λ (축구 전반 득점 비중 실측 44~46%).

usage: python3 scripts/opt_prob.py --lh 2.55 --la 1.20 [--win 64.8 --lose 15.8] [--half 0.45]
"""
import argparse, math

MAXG = 12

def grid(lh, la):
    ph = [math.exp(-lh) * lh**i / math.factorial(i) for i in range(MAXG+1)]
    pa = [math.exp(-la) * la**i / math.factorial(i) for i in range(MAXG+1)]
    return [[ph[i]*pa[j] for j in range(MAXG+1)] for i in range(MAXG+1)]

def onex2(g):
    w = sum(g[i][j] for i in range(MAXG+1) for j in range(MAXG+1) if i > j)
    d = sum(g[i][i] for i in range(MAXG+1))
    l = sum(g[i][j] for i in range(MAXG+1) for j in range(MAXG+1) if i < j)
    return w*100, d*100, l*100

def fit(lh, la, win, lose, iters=400):
    """최종 1X2에 맞게 λ를 비율 보정 (a,b 좌표 하강)."""
    a, b = 1.0, 1.0
    for _ in range(iters):
        w, d, l = onex2(grid(lh*a, la*b))
        ew, el = win - w, lose - l
        if abs(ew) < 0.05 and abs(el) < 0.05:
            break
        a *= 1 + ew * 0.004
        b *= 1 + el * 0.004
        a, b = max(0.2, min(5, a)), max(0.2, min(5, b))
    return lh*a, la*b

def margin_probs(g):
    m = {}
    for i in range(MAXG+1):
        for j in range(MAXG+1):
            m[i-j] = m.get(i-j, 0) + g[i][j]
    return m

def total_probs(g):
    t = {}
    for i in range(MAXG+1):
        for j in range(MAXG+1):
            t[i+j] = t.get(i+j, 0) + g[i][j]
    return t

def report(lh, la, label=""):
    g = grid(lh, la)
    m, t = margin_probs(g), total_probs(g)
    out = {}
    w, d, l = onex2(g)
    out['1X2'] = (w, d, l)
    for h in (1, 2, 3):
        # 정수핸디캡 H-h : (홈 - h) vs 원정
        out[f'H-{h}'] = (sum(v for k, v in m.items() if k > h)*100,   # 승
                         m.get(h, 0)*100,                             # 무
                         sum(v for k, v in m.items() if k < h)*100)   # 패
        out[f'H+{h}'] = (sum(v for k, v in m.items() if k > -h)*100,
                         m.get(-h, 0)*100,
                         sum(v for k, v in m.items() if k < -h)*100)
    for line in (1.5, 2.5, 3.5, 4.5):
        under = sum(v for k, v in t.items() if k < line)*100
        out[f'U/O {line}'] = (under, 100-under)
    print(f"[{label}] λ {lh:.2f}:{la:.2f}")
    print(f"  1X2            승 {w:5.1f}  무 {d:5.1f}  패 {l:5.1f}")
    for h in (1, 2, 3):
        for s in (f'H-{h}', f'H+{h}'):
            a, b, c = out[s]
            print(f"  정수핸디캡 {s:<4}  승 {a:5.1f}  무 {b:5.1f}  패 {c:5.1f}")
    for line in (1.5, 2.5, 3.5, 4.5):
        u, o = out[f'U/O {line}']
        print(f"  U/O {line:<4}       언더 {u:5.1f}  오버 {o:5.1f}")
    return out

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--lh', type=float, required=True)
    p.add_argument('--la', type=float, required=True)
    p.add_argument('--win', type=float)
    p.add_argument('--lose', type=float)
    p.add_argument('--half', type=float, default=0.45)
    p.add_argument('--label', default='')
    a = p.parse_args()
    lh, la = a.lh, a.la
    if a.win is not None and a.lose is not None:
        lh, la = fit(lh, la, a.win, a.lose)
        print(f"λ 보정: {a.lh}:{a.la} → {lh:.3f}:{la:.3f} (최종 1X2 {a.win}/{a.lose} 정합)")
    report(lh, la, a.label or '전체')
    print()
    report(lh*a.half, la*a.half, '전반')
