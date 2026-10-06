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
- 베트맨 배당은 보통 하루 전 뜨고 킥오프까지 몇 번 바뀐다. 30분 간격이면 변화를 거의 다 잡는다.
- 네트워크 오류는 그 주기만 건너뛴다.
"""
import argparse, datetime as dt, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
KST = dt.timezone(dt.timedelta(hours=9))


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
        if n % a.results_every == 1:
            print("--- 채점/보고", flush=True)
            print(run(["tracker.py", "results"]).strip()[-800:], flush=True)
            run(["tracker.py", "report"])
            run(["tracker.py", "clv"])
        time.sleep(a.interval * 60)


if __name__ == "__main__":
    main()
