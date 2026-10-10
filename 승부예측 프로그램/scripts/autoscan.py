#!/usr/bin/env python3
"""
자동 수집 루프: 사람이 안 돌려도 모든 선택지의 배당·공정확률 이력이 쌓이고, 끝난 경기는 자동 채점된다.

매 주기(기본 30분)
  1. odds_scan.py --log --min-ev 1.0  → 판매 중 전체 선택지를 data/스캔기록.csv(최신값)·data/배당이력.csv(누적)에 기록,
     기대값 1.0 이상만 화면(로그)에 출력 = 알림
  2. 6주기(3시간)마다 tracker.py results → 끝난 경기 자동 채점, tracker.py report / clv → 보고서 갱신

사용법
  nohup python3 scripts/autoscan.py > data/autoscan.log 2>&1 &     # 백그라운드 시작
  python3 scripts/autoscan.py --interval 15                         # 15분 간격
  tail -f data/autoscan.log                                         # 알림 확인
  pkill -f autoscan.py                                              # 중지

메모
- 베트맨 배당은 보통 하루 전 뜨고 킥오프까지 몇 번 바뀐다.
- **킥오프 75분 이내 경기가 있으면 5분 간격**으로 수집한다(2026-10-10: 120회 정관장 배당이 16:01 마지막 수집 뒤
  킥오프 30분 안에 1.36→1.59로 바뀐 걸 30분 간격이 놓쳤다 — 라인업 발표 직후 변동).
- **추천 다리 배당 변동 경고**: 추천기록.csv 의 추천 다리(아직 시작 전)의 현재 베트맨 배당이 추천 당시보다 0.08 이상
  오르면(= 그 선택지가 불리해졌다는 신호) '⚠ 추천 다리 배당 상승'을 로그와 data/배당변동알림.log 에 남긴다.
- **구매 점검**: 구매일정.csv 의 점검시각(판매 마감 30분 전)이 되면 final_check.py --due --notify 를 돌려
  최종 점검 결과를 회차별분석/최종점검_*.md 에 쓰고 macOS 알림을 띄운다. 점검시각에 맞춰 깨어나도록 대기 시간을 줄인다.
  (휴대폰 알림·뉴스 확인은 Claude 세션의 예약 작업이 맡는다 — 세션이 꺼져 있어도 이 숫자 점검은 돈다)
- 네트워크 오류는 그 주기만 건너뛴다.
"""
import argparse, csv, datetime as dt, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
KST = dt.timezone(dt.timedelta(hours=9))
ROOT = os.path.dirname(HERE)
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")
PICKS = os.path.join(ROOT, "추천기록.csv")
ALERT = os.path.join(ROOT, "data", "배당변동알림.log")
FAST_WINDOW, FAST_INTERVAL, ODDS_JUMP = 75, 5, 0.08
SCHED = os.path.join(ROOT, "구매일정.csv")


def next_check_minutes(now):
    """대기 상태 조합 중 다음 점검시각까지 남은 분 (지났으면 0)"""
    if not os.path.exists(SCHED):
        return None
    best = None
    for r in csv.DictReader(open(SCHED, encoding="utf-8")):
        if r.get("상태") != "대기":
            continue
        try:
            t = dt.datetime.strptime(r["점검시각"], "%Y-%m-%d %H:%M").replace(tzinfo=KST)
            c = dt.datetime.strptime(r["마감"], "%Y-%m-%d %H:%M").replace(tzinfo=KST)
        except (ValueError, KeyError):
            continue
        if c <= now:
            continue
        m = max(0.0, (t - now).total_seconds() / 60)
        best = m if best is None else min(best, m)
    return best


def latest_scan():
    """(회차, 번호, 선택) → 스캔기록 최신 행"""
    out = {}
    if os.path.exists(SCAN):
        for r in csv.DictReader(open(SCAN, encoding="utf-8")):
            out[(r["회차"], r["번호"], r["선택"])] = r
    return out


def next_kickoff_minutes(scan, now):
    best = None
    for r in scan.values():
        try:
            k = dt.datetime.strptime(r["시각"], "%Y-%m-%d %H:%M").replace(tzinfo=KST)
        except (ValueError, KeyError):
            continue
        m = (k - now).total_seconds() / 60
        if m > 0 and (best is None or m < best):
            best = m
    return best


def pick_alerts(scan, now):
    if not os.path.exists(PICKS):
        return []
    msgs = []
    for p in csv.DictReader(open(PICKS, encoding="utf-8")):
        if p.get("구분") != "추천":
            continue
        r = scan.get((str(p["회차"]), p["번호"], p["선택"]))
        if not r:
            continue
        try:
            k = dt.datetime.strptime(r["시각"], "%Y-%m-%d %H:%M").replace(tzinfo=KST)
            o0, o1 = float(p["배당"]), float(r["베트맨"])
        except (ValueError, KeyError):
            continue
        if k > now and o1 - o0 >= ODDS_JUMP:
            msgs.append(f"⚠ 추천 다리 배당 상승 {p['경기']} {p['게임']} {p['선택']}: {o0:.2f}→{o1:.2f} "
                        f"(시장 {p['확률']}→{r['공정확률']}%) 킥오프 {r['시각'][5:]} — 라인업·뉴스 확인")
    return msgs


def run(args):
    r = subprocess.run([PY, os.path.join(HERE, args[0])] + args[1:], capture_output=True, text=True)
    return (r.stdout or "") + (r.stderr or "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=int, default=30, help="분")
    ap.add_argument("--results-every", type=int, default=6, help="몇 주기마다 채점·보고를 돌릴지")
    a = ap.parse_args()
    n = 0
    while True:
        n += 1
        now = dt.datetime.now(KST)
        print(f"\n===== [{now:%m-%d %H:%M}] 스캔 #{n} =====", flush=True)
        out = run(["odds_scan.py", "--log", "--min-ev", "1.0"])
        keep = [ln for ln in out.splitlines() if ("★" in ln or "전체 추적" in ln or "판매 중 회차" in ln or "오류" in ln or "JSON 아님" in ln)]
        print("\n".join(keep) if keep else "(+EV 없음)", flush=True)
        scan = latest_scan()
        for m in pick_alerts(scan, now):
            print(m, flush=True)
            with open(ALERT, "a", encoding="utf-8") as f:
                f.write(f"[{now:%m-%d %H:%M}] {m}\n")
        nk = next_kickoff_minutes(scan, now)
        nc = next_check_minutes(now)
        if nc == 0:
            print("--- 구매 점검", flush=True)
            print(run(["final_check.py", "--due", "--notify", "--no-scan"]).strip()[-1500:], flush=True)
            nc = next_check_minutes(dt.datetime.now(KST))
        if n % a.results_every == 1:
            print("--- 채점/보고", flush=True)
            print(run(["tracker.py", "results"]).strip()[-800:], flush=True)
            run(["tracker.py", "report"])
            run(["tracker.py", "clv"])
        wait = FAST_INTERVAL if (nk is not None and nk <= FAST_WINDOW) else a.interval
        if nc is not None and 0 < nc < wait:
            wait = max(1, nc)  # 점검시각에 맞춰 깨어난다
        if wait != a.interval:
            print(f"(다음 킥오프 {nk:.0f}분 전 → {wait}분 간격)", flush=True)
        time.sleep(wait * 60)


if __name__ == "__main__":
    main()
