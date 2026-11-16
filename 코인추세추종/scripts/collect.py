"""머신러닝용 데이터 수집기. 나중에 과거분을 받을 수 없는 데이터를 지금부터 쌓는다.
launchd 로 10분마다 돈다. 항목마다 따로 실패해도 나머지는 계속 저장한다.

  orderbook  업비트 BTC·ETH 호가 15단계 스냅샷 (10분)
  ticks      업비트 BTC·ETH 체결 전부, 지난 실행 이후분만 이어 받기 (10분)
  derivs     바이낸스·바이비트 선물 펀딩비·미결제약정·마크가 (10분)
  premium    해외 현물가·환율·업비트 USDT → 김치프리미엄 (10분)
  tickers    업비트 원화마켓 전 종목 24시간 시세 (매시 정각대 1번)

저장: data/collect/<항목>/<YYYY-MM-DD>.csv.gz (KST 기준, 하루 파일에 이어 붙임)
사용법: python3 scripts/collect.py [--only orderbook,ticks]
"""
import csv, gzip, io, json, sys, time, traceback, urllib.request
from datetime import datetime
from pathlib import Path

from paper import KST

OUT = Path(__file__).resolve().parent.parent / "data" / "collect"
CURSOR = OUT / "ticks_cursor.json"
MARKETS = ["KRW-BTC", "KRW-ETH"]
SYMBOLS = {"KRW-BTC": "BTC", "KRW-ETH": "ETH"}


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "coin-trend-collector"})
    for i in range(3):
        try:
            return json.load(urllib.request.urlopen(req, timeout=10))
        except Exception:
            if i == 2:
                raise
            time.sleep(1 + i)


def save(kind, header, rows, now):
    if not rows:
        return
    path = OUT / kind / f"{now:%Y-%m-%d}.csv.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists()
    buf = io.StringIO()
    w = csv.writer(buf)
    if new:
        w.writerow(header)
    w.writerows(rows)
    # gzip 조각을 이어 붙여도 하나의 파일로 읽힌다
    with gzip.open(path, "at", newline="") as f:
        f.write(buf.getvalue())


def orderbook(now):
    ts = now.isoformat(timespec="seconds")
    header = ["ts", "market", "total_ask", "total_bid"] + [f"{s}{k}{i}" for i in range(15) for s in ("ask", "bid") for k in ("_p", "_q")]
    rows = []
    for o in get("https://api.upbit.com/v1/orderbook?markets=" + ",".join(MARKETS)):
        row = [ts, o["market"], o["total_ask_size"], o["total_bid_size"]]
        for u in o["orderbook_units"][:15]:
            row += [u["ask_price"], u["ask_size"], u["bid_price"], u["bid_size"]]
        rows.append(row)
    save("orderbook", header, rows, now)


def ticks(now):
    cur = json.loads(CURSOR.read_text()) if CURSOR.exists() else {}
    header = ["timestamp", "market", "price", "volume", "ask_bid", "sequential_id"]
    for m in MARKETS:
        last = cur.get(m, 0)
        got, cursor = [], ""
        # 최신부터 거슬러 올라가며 지난번 마지막 체결까지. 처음 실행이면 최근 20쪽(약 1만 건)만.
        for _ in range(200 if last else 20):
            batch = get(f"https://api.upbit.com/v1/trades/ticks?market={m}&count=500{cursor}")
            if not batch:
                break
            fresh = [t for t in batch if t["sequential_id"] > last]
            got += fresh
            if len(fresh) < len(batch) or len(batch) < 500:
                break
            cursor = f"&cursor={batch[-1]['sequential_id']}"
            time.sleep(0.12)
        got.sort(key=lambda t: t["sequential_id"])
        save("ticks", header, [[t["timestamp"], m, t["trade_price"], t["trade_volume"], t["ask_bid"], t["sequential_id"]] for t in got], now)
        if got:
            cur[m] = got[-1]["sequential_id"]
    CURSOR.write_text(json.dumps(cur))


def derivs(now):
    ts = now.isoformat(timespec="seconds")
    rows = []
    for sym in SYMBOLS.values():
        p = get(f"https://fapi.binance.com/fapi/v1/premiumIndex?symbol={sym}USDT")
        oi = get(f"https://fapi.binance.com/fapi/v1/openInterest?symbol={sym}USDT")
        rows.append([ts, "binance", sym, p["lastFundingRate"], p["markPrice"], p["indexPrice"], oi["openInterest"]])
        b = get(f"https://api.bybit.com/v5/market/tickers?category=linear&symbol={sym}USDT")["result"]["list"][0]
        rows.append([ts, "bybit", sym, b["fundingRate"], b["markPrice"], b["indexPrice"], b["openInterest"]])
    save("derivs", ["ts", "exchange", "symbol", "funding_rate", "mark", "index", "open_interest"], rows, now)


def premium(now):
    ts = now.isoformat(timespec="seconds")
    usdkrw = get("https://open.er-api.com/v6/latest/USD")["rates"]["KRW"]
    up = {t["market"]: t["trade_price"] for t in get("https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-ETH,KRW-USDT")}
    rows = []
    for m, sym in SYMBOLS.items():
        bn = float(get(f"https://api.binance.com/api/v3/ticker/price?symbol={sym}USDT")["price"])
        cb = float(get(f"https://api.coinbase.com/v2/prices/{sym}-USD/spot")["data"]["amount"])
        kimp = up[m] / (cb * usdkrw) - 1
        rows.append([ts, sym, up[m], bn, cb, up["KRW-USDT"], usdkrw, round(kimp, 6)])
    save("premium", ["ts", "symbol", "upbit_krw", "binance_usdt", "coinbase_usd", "upbit_usdt_krw", "usdkrw", "kimchi_premium"], rows, now)


def tickers(now):
    if now.minute >= 10:  # 10분 간격 실행 중 매시 첫 회만
        return
    ts = now.isoformat(timespec="seconds")
    markets = [m["market"] for m in get("https://api.upbit.com/v1/market/all") if m["market"].startswith("KRW-")]
    rows = [[ts, t["market"], t["trade_price"], t["high_price"], t["low_price"], t["signed_change_rate"], t["acc_trade_price_24h"], t["acc_trade_volume_24h"]]
            for t in get("https://api.upbit.com/v1/ticker?markets=" + ",".join(markets))]
    save("tickers", ["ts", "market", "price", "high", "low", "change_rate", "value_24h", "volume_24h"], rows, now)


JOBS = {"orderbook": orderbook, "ticks": ticks, "derivs": derivs, "premium": premium, "tickers": tickers}

if __name__ == "__main__":
    only = next((a.split("=", 1)[1] if "=" in a else sys.argv[sys.argv.index(a) + 1] for a in sys.argv[1:] if a.startswith("--only")), None)
    now = datetime.now(KST)
    failed = []
    for name, job in JOBS.items():
        if only and name not in only.split(","):
            continue
        try:
            job(now)
        except Exception:
            failed.append(name)
            print(f"{now:%Y-%m-%d %H:%M} {name} 실패\n{traceback.format_exc()}", file=sys.stderr)
    print(f"{now:%Y-%m-%d %H:%M} 수집 {'완료' if not failed else '일부 실패: ' + ','.join(failed)}")
