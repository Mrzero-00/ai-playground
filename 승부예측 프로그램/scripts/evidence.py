#!/usr/bin/env python3
"""근거기록.csv 를 읽을 때 **경기마다 가장 늦은 분석 버전만** 남긴다.

같은 경기를 다시 분석하면(라인업 뒤 재분석, 정정) 근거기록에 기록시각만 다른 줄이 한 벌 더 쌓인다.
그대로 더하면 요인 영향이 버전 수만큼 부풀고(77경기 — 승무패61 12번 xG 가 2.0 인데 6.0 으로 합산),
요약 행도 같은 경기가 여러 번 세어진다(결과 있는 요약 266행 중 38행). 2026-11-11.
"""


def latest(rows):
    last = {}
    for r in rows:
        k = (r.get("회차"), r.get("번호"))
        t = r.get("기록시각") or ""
        if t > last.get(k, ""):
            last[k] = t
    return [r for r in rows if (r.get("기록시각") or "") == last.get((r.get("회차"), r.get("번호")), "")]
