"""업비트 실전 매매 봇. 신호는 모의 매매(paper.py)와 같은 앙상블을 쓴다.

안전장치
  - .env 에 LIVE=1 이 없으면 주문을 보내지 않고 할 일만 출력한다(드라이런).
  - 봇은 BUDGET 원만 굴린다. 계좌의 나머지 원화와 코인은 건드리지 않는다.
    팔 때도 봇이 직접 산 수량(live/state.json)까지만 판다.
  - live/STOP 파일이 있으면 아무것도 하지 않는다(긴급 정지).
  - 봇 평가액이 최고점 대비 HALT_DD 이상 빠지면 전량 매도하고 STOP 파일을 만든다.
    백테스트 최대 하락(표본 외 -26%, 전체 -41%)을 넘는 건 전략이 깨졌다는 신호로 본다.

설정 (.env, 이 프로젝트 폴더)
  UPBIT_ACCESS_KEY=...
  UPBIT_SECRET_KEY=...
  BUDGET=1000000
  LIVE=0
  HALT_DD=0.45

사용법
  python3 scripts/live.py --check   # 키·잔고 확인 (주문 없음)
  python3 scripts/live.py           # 오늘 몫 실행 (하루 한 번, 09:00 KST 이후)
  python3 scripts/live.py --report  # 누적 성과
"""
import base64, csv, hashlib, hmac, json, sys, time, urllib.error, urllib.request, uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlencode

from paper import FEE, KST, MARKETS, closes, fill, signal

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "live"
STATE, TRADES, EQUITY, STOP = DIR / "state.json", DIR / "trades.csv", DIR / "equity.csv", DIR / "STOP"
API = "https://api.upbit.com"
MIN_ORDER = 5000  # 업비트 최소 주문 금액


def env():
    path = ROOT / ".env"
    cfg = {"BUDGET": "1000000", "LIVE": "0", "HALT_DD": "0.45"}
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    return cfg


CFG = env()
LIVE = CFG["LIVE"] == "1"
BUDGET = float(CFG["BUDGET"])
HALT_DD = float(CFG["HALT_DD"])


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def token(params=None):
    payload = {"access_key": CFG["UPBIT_ACCESS_KEY"], "nonce": str(uuid.uuid4())}
    if params:
        payload["query_hash"] = hashlib.sha512(unquote(urlencode(params)).encode()).hexdigest()
        payload["query_hash_alg"] = "SHA512"
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps(payload).encode())
    sig = hmac.new(CFG["UPBIT_SECRET_KEY"].encode(), f"{head}.{body}".encode(), hashlib.sha256).digest()
    return f"{head}.{body}.{b64(sig)}"


def private(method, path, params=None):
    url = API + path
    data = None
    if method == "GET" and params:
        url += "?" + urlencode(params)
    if method == "POST":
        data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token(params)}", "Content-Type": "application/json", "Accept": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=10))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} {e.code}: {e.read().decode()}") from None


def balances():
    return {a["currency"]: float(a["balance"]) for a in private("GET", "/v1/accounts")}


def wait_done(order_id):
    """시장가 주문이 끝날 때까지 기다렸다가 (체결 수량, 체결 원화, 수수료)를 돌려준다."""
    for _ in range(20):
        o = private("GET", "/v1/order", {"uuid": order_id})
        # 금액 지정 시장가 매수는 잔돈이 남으면 체결 후 cancel 로 끝난다
        if o["state"] in ("done", "cancel"):
            break
        time.sleep(0.5)
    qty = float(o["executed_volume"])
    krw = sum(float(t["funds"]) for t in o.get("trades", []))
    return qty, krw, float(o["paid_fee"]), o["state"]


def buy(market, krw):
    o = private("POST", "/v1/orders", {"market": market, "side": "bid", "ord_type": "price", "price": str(int(krw))})
    return wait_done(o["uuid"])


def sell(market, qty):
    o = private("POST", "/v1/orders", {"market": market, "side": "ask", "ord_type": "market", "volume": f"{qty:.8f}"})
    return wait_done(o["uuid"])


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"start": None, "last_run": None, "peak": BUDGET,
            "sleeves": {m: {"cash": BUDGET / len(MARKETS), "qty": 0.0, "target": 0.0} for m in MARKETS}}


def append(path, header, row):
    new = not path.exists()
    with path.open("a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(header)
        w.writerow(row)


def trade(st, m, target, px_close, now, reason):
    """sleeve 하나를 목표 비중으로 맞춘다. 실제 체결값으로 장부를 고친다."""
    s = st["sleeves"][m]
    mid = fill(m, "buy", krw=1)[3]
    equity = s["cash"] + s["qty"] * mid
    diff = equity * target - s["qty"] * mid
    if abs(diff) < MIN_ORDER and target not in (0.0, 1.0):
        print(f"{m} 비중 {s['target']:.2f}→{target:.2f} 차이 {diff:,.0f}원, 최소 주문 미만이라 건너뜀")
        s["target"] = target
        return
    if diff > 0:
        krw = min(diff, s["cash"]) / (1 + FEE)
        if krw < MIN_ORDER:
            s["target"] = target
            return
        side = "매수"
        if LIVE:
            qty, funds, fee, state = buy(m, krw)
        else:
            avg, qty, funds, _ = fill(m, "buy", krw=krw)
            fee, state = funds * FEE, "dry-run"
        s["qty"] += qty
        s["cash"] -= funds + fee
    else:
        qty_want = s["qty"] if target == 0 else min(s["qty"], -diff / mid)
        if qty_want * mid < MIN_ORDER:
            s["target"] = target
            return
        side = "매도"
        if LIVE:
            qty_want = min(qty_want, balances().get(m.split("-")[1], 0.0))  # 사용자가 따로 옮긴 경우 대비
            qty, funds, fee, state = sell(m, qty_want)
        else:
            avg, qty, funds, _ = fill(m, "sell", qty=qty_want)
            fee, state = funds * FEE, "dry-run"
        s["qty"] -= qty
        s["cash"] += funds - fee
    avg = funds / qty if qty else 0
    append(TRADES, ["시각", "모드", "마켓", "구분", "사유", "목표비중_전", "목표비중_후", "신호종가", "중간가", "체결가", "수량", "원화", "수수료", "상태"],
           [now.isoformat(timespec="seconds"), "실전" if LIVE else "드라이런", m, side, reason, s["target"], target, px_close,
            round(mid), round(avg, 1), round(qty, 8), round(funds), round(fee, 1), state])
    print(f"{'[실전]' if LIVE else '[드라이런]'} {m} {side} {s['target']:.2f}→{target:.2f} {funds:,.0f}원 @ {avg:,.0f} ({state})")
    s["target"] = target


def run():
    DIR.mkdir(exist_ok=True)
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    print(f"--- {now.isoformat(timespec='seconds')} {'실전' if LIVE else '드라이런'} 예산 {BUDGET:,.0f}원")
    if STOP.exists():
        print(f"STOP 파일이 있어 멈춤: {STOP.read_text().strip()}")
        return
    if LIVE and not CFG.get("UPBIT_ACCESS_KEY"):
        print(".env 에 UPBIT_ACCESS_KEY / UPBIT_SECRET_KEY 가 없다.")
        return
    st = load_state()
    if now.hour < 9 or st["last_run"] == today:
        print("09:00 이전이거나 오늘 이미 실행함. 건너뜀.")
        return

    # 손실 한도 확인
    value = sum(s["cash"] + s["qty"] * fill(m, "buy", krw=1)[3] for m, s in st["sleeves"].items())
    st["peak"] = max(st["peak"], value)
    if value < st["peak"] * (1 - HALT_DD):
        print(f"평가액 {value:,.0f}원이 최고점 {st['peak']:,.0f}원 대비 {HALT_DD*100:.0f}% 넘게 하락 → 전량 매도 후 정지")
        for m in MARKETS:
            if st["sleeves"][m]["qty"] > 0:
                trade(st, m, 0.0, None, now, "손실 한도")
        STOP.write_text(f"{today} 손실 한도 {HALT_DD*100:.0f}% 도달. 원인 확인 후 이 파일을 지우면 재개.")
    else:
        for m in MARKETS:
            _, px = closes(m)
            target = signal(px)
            if target != st["sleeves"][m]["target"]:
                trade(st, m, target, px[-1], now, "신호")
            else:
                print(f"{m} 유지 비중 {target:.2f}")

    total = 0.0
    for m, s in st["sleeves"].items():
        v = s["cash"] + s["qty"] * fill(m, "buy", krw=1)[3]
        append(EQUITY, ["날짜", "모드", "마켓", "비중", "평가액"], [today, "실전" if LIVE else "드라이런", m, s["target"], round(v)])
        total += v
    st["start"] = st["start"] or today
    st["last_run"] = today
    st["peak"] = max(st["peak"], total)
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))
    print(f"봇 평가액 {total:,.0f}원 (예산 대비 {(total/BUDGET-1)*100:+.2f}%)")


def check():
    print(f"모드 {'실전(LIVE=1)' if LIVE else '드라이런(LIVE=0)'}, 예산 {BUDGET:,.0f}원, 손실 한도 {HALT_DD*100:.0f}%")
    if not CFG.get("UPBIT_ACCESS_KEY"):
        print(".env 에 키가 없다. 드라이런은 키 없이도 돈다.")
        return
    bal = balances()
    print("계좌 잔고:", {k: v for k, v in bal.items() if v > 0})
    if bal.get("KRW", 0) < BUDGET and not STATE.exists():
        print(f"주의: 원화 잔고 {bal.get('KRW', 0):,.0f}원이 예산보다 적다. 매수 때 부족분은 주문이 실패한다.")
    if STOP.exists():
        print("STOP 파일 있음:", STOP.read_text().strip())


def report():
    if not EQUITY.exists():
        print("아직 기록이 없다.")
        return
    last = {(r["날짜"], r["마켓"]): r for r in csv.DictReader(EQUITY.open())}
    by_day = {}
    for (d, _), r in last.items():
        by_day[d] = by_day.get(d, 0) + float(r["평가액"])
    days = sorted(by_day)
    peak = mdd = 0
    for d in days:
        peak = max(peak, by_day[d])
        mdd = min(mdd, by_day[d] / peak - 1)
    v = by_day[days[-1]]
    print(f"{days[0]} ~ {days[-1]} ({len(days)}일)  평가액 {v:,.0f}원 ({(v/BUDGET-1)*100:+.2f}%), 최대 하락 {mdd*100:.1f}%")
    if TRADES.exists():
        print(f"거래 {sum(1 for _ in csv.DictReader(TRADES.open()))}회")


if __name__ == "__main__":
    {"--check": check, "--report": report}.get(next((a for a in sys.argv[1:] if a.startswith("--")), ""), run)()
