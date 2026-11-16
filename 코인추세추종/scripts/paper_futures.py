"""바이낸스 USDT 무기한 선물 모의 매매 (사전 등록: FUTURES.md). 실제 주문은 내지 않는다.
F0~F3 4개 방식을 동시에, 방식마다 10,000 USDT(BTC·ETH 각 5,000). 매일 09:15 KST.
  1) 지난 실행 이후 1시간봉 저가·고가로 청산 확인
  2) 지난 실행 이후 실제 펀딩 이벤트 정산 (펀딩 시점 마크가격 × 수량 × 펀딩비)
  3) 지금 호가 중간가로 평가 → 목표 명목 = 방식(e) × 평가액, 차이만큼 호가창을 먹어 체결
장부: paper_futures/state.json · trades.csv · equity.csv
사용법: python3 scripts/paper_futures.py [--report]
"""
import csv, json, sys
from datetime import datetime, timezone
from pathlib import Path

from paper import KST, SMAS, append, get

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "paper_futures"
STATE, TRADES, EQUITY = DIR / "state.json", DIR / "trades.csv", DIR / "equity.csv"
API = "https://fapi.binance.com/fapi/v1"
SYMBOLS = ["BTC", "ETH"]
CAPITAL = 5_000.0  # 방식·마켓마다 USDT
FEE = 0.0005  # 테이커
MMR = 0.005  # 유지 증거금 근사
MIN_TRADE = 10.0  # USDT
VARIANTS = {
    "F0": lambda e: e,
    "F1": lambda e: 2 * e - 1,
    "F2": lambda e: e if e > 0 else -1.0,
    "F3": lambda e: 2 * e,
}


def ensemble(sym):
    """마감된 일봉(00:00 UTC) 종가로 앙상블 비중. (신호 날짜, e)"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ks = [k for k in get(f"{API}/klines?symbol={sym}USDT&interval=1d&limit=250")
          if datetime.fromtimestamp(k[0] / 1000, timezone.utc).strftime("%Y-%m-%d") < today]
    px = [float(k[4]) for k in ks]
    day = datetime.fromtimestamp(ks[-1][0] / 1000, timezone.utc).strftime("%Y-%m-%d")
    return day, sum(px[-1] > sum(px[-n:]) / n for n in SMAS) / len(SMAS)


def book(sym):
    d = get(f"{API}/depth?symbol={sym}USDT&limit=100")
    asks = [(float(p), float(q)) for p, q in d["asks"]]
    bids = [(float(p), float(q)) for p, q in d["bids"]]
    return asks, bids, (asks[0][0] + bids[0][0]) / 2


def fill(levels, qty):
    """qty 만큼 호가를 먹은 평균가."""
    got = cost = 0.0
    for p, q in levels:
        take = min(qty - got, q)
        got += take
        cost += take * p
        if got >= qty - 1e-12:
            break
    return cost / got


def run():
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    print(f"--- {now.isoformat(timespec='seconds')}")
    st = json.loads(STATE.read_text()) if STATE.exists() else None
    if now.hour < 9 or (st and st["last_run"] == today):
        print("09:00 이전이거나 오늘 이미 실행함. 건너뜀.")
        return
    DIR.mkdir(exist_ok=True)
    now_ms = int(now.timestamp() * 1000)
    if st is None:
        st = {"start": today, "last_run": None, "last_ms": now_ms,
              "sleeves": {v: {s: {"wallet": CAPITAL, "qty": 0.0, "px": None, "liquidated": None} for s in SYMBOLS} for v in VARIANTS}}

    for s in SYMBOLS:
        day, e = ensemble(s)
        asks, bids, mid = book(s)
        since = st["last_ms"] + 1
        funds = get(f"{API}/fundingRate?symbol={s}USDT&startTime={since}&limit=100")
        hours = get(f"{API}/klines?symbol={s}USDT&interval=1h&startTime={since}&limit=100")
        low = min([float(k[3]) for k in hours] or [mid])
        high = max([float(k[2]) for k in hours] or [mid])
        print(f"{s} 신호 {day} e={e:.2f} 중간가 {mid:,.2f} 펀딩 {len(funds)}회 구간 저가 {low:,.2f} 고가 {high:,.2f}")

        for v, f in VARIANTS.items():
            sl = st["sleeves"][v][s]
            if sl["liquidated"]:
                append(EQUITY, ["날짜", "방식", "마켓", "목표", "평가액", "펀딩누적"], [today, v, s, 0, 0, round(sl.get("funding", 0), 2)])
                continue
            q, px = sl["qty"], sl["px"]
            if q and px:
                worst = low if q > 0 else high
                if sl["wallet"] + q * (worst - px) <= MMR * abs(q) * worst:
                    print(f"  {v} {s} 청산 (구간 {'저가' if q > 0 else '고가'} {worst:,.2f})")
                    append(TRADES, ["시각", "방식", "마켓", "구분", "목표_전", "목표_후", "중간가", "체결가", "수량", "명목", "수수료", "중간가대비_불리"],
                           [now.isoformat(timespec="seconds"), v, s, "청산", sl.get("target", 0), 0, round(worst, 2), round(worst, 2), round(-q, 6), round(abs(q) * worst, 2), 0, ""])
                    sl.update(wallet=0.0, qty=0.0, liquidated=today)
                    append(EQUITY, ["날짜", "방식", "마켓", "목표", "평가액", "펀딩누적"], [today, v, s, 0, 0, round(sl.get("funding", 0), 2)])
                    continue
                paid = sum(q * float(x["markPrice"] or mid) * float(x["fundingRate"]) for x in funds)
                sl["wallet"] -= paid
                sl["funding"] = sl.get("funding", 0) + paid
                sl["wallet"] += q * (mid - px)  # 중간가로 평가손익 반영
            sl["px"] = mid

            target = f(e)
            dq = target * sl["wallet"] / mid - q
            if abs(dq) * mid >= MIN_TRADE:
                avg = fill(asks if dq > 0 else bids, abs(dq))
                slip = (avg - mid) * dq  # 중간가보다 불리하게 체결된 몫 (항상 ≥ 0)
                fee = abs(dq) * avg * FEE
                sl["wallet"] -= slip + fee
                sl["qty"] = q + dq
                side = "매수" if dq > 0 else "매도"
                append(TRADES, ["시각", "방식", "마켓", "구분", "목표_전", "목표_후", "중간가", "체결가", "수량", "명목", "수수료", "중간가대비_불리"],
                       [now.isoformat(timespec="seconds"), v, s, side, sl.get("target", 0), target, round(mid, 2), round(avg, 2), round(dq, 6), round(abs(dq) * avg, 2), round(fee, 4), f"{(avg / mid - 1) * (1 if dq > 0 else -1) * 100:.4f}%"])
                print(f"  {v} {s} {side} 목표 {sl.get('target', 0):+.2f}→{target:+.2f} {abs(dq) * avg:,.2f} USDT @ {avg:,.2f}")
            sl["target"] = target
            append(EQUITY, ["날짜", "방식", "마켓", "목표", "평가액", "펀딩누적"], [today, v, s, target, round(sl["wallet"], 2), round(sl.get("funding", 0), 2)])

    st["last_run"], st["last_ms"] = today, now_ms
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))
    for v in VARIANTS:
        tot = sum(st["sleeves"][v][s]["wallet"] for s in SYMBOLS)
        print(f"{v} 평가액 {tot:,.2f} USDT ({(tot / (CAPITAL * len(SYMBOLS)) - 1) * 100:+.2f}%)")


def report():
    if not EQUITY.exists():
        print("아직 기록이 없다.")
        return
    last = {(r["날짜"], r["방식"], r["마켓"]): r for r in csv.DictReader(EQUITY.open())}
    days = sorted({k[0] for k in last})
    print(f"기간 {days[0]} ~ {days[-1]} ({len(days)}일)")
    for v in VARIANTS:
        vals = [sum(float(last[(d, v, s)]["평가액"]) for s in SYMBOLS if (d, v, s) in last) for d in days]
        peak, mdd = 0, 0
        for x in vals:
            peak = max(peak, x)
            mdd = min(mdd, x / peak - 1)
        fund = sum(float(last[(days[-1], v, s)]["펀딩누적"]) for s in SYMBOLS if (days[-1], v, s) in last)
        print(f"{v} {vals[-1]:,.2f} USDT ({(vals[-1] / (CAPITAL * len(SYMBOLS)) - 1) * 100:+.2f}%), 최대 하락 {mdd * 100:.1f}%, 펀딩 누적 {fund:+.2f}")


if __name__ == "__main__":
    report() if "--report" in sys.argv else run()
