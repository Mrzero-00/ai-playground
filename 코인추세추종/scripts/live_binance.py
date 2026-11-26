"""바이낸스 실전 봇 — 현물 추세추종 + 하락장일 때 쉬는 돈으로 선물 1배 숏.
RESEARCH.md '현물 봇 + 하락장 선물 숏 조합' 의 B1 을 그대로 옮겼다(2026-11-26 사용자 결정: 업비트 봇을 멈추고 바이낸스 한 곳에서).

판단 (하루 한 번, 09:07 KST = 00:07 UTC, 막 마감한 일봉으로)
  - 현물 비중 w = 바이낸스 현물 일봉 종가가 위에 있는 이동평균(20·50·100·200일) 개수 / 4 — 업비트 봇과 같은 앙상블.
  - 장 = 바이낸스 USDT 무기한 일봉 종가의 판별기 (나): 지난 30일 z(30일 로그 수익 ÷ (일 로그 수익 30일 표준편차 × √30))에
    문턱 여유(|z| ≥ 1 이면 추세, |z| < 0.5 로 내려와야 횡보). 하락장·강한 하락장이면 숏.
  - BTC·ETH 를 반반 따로 굴린다(몫). 몫의 평가액 E 중 w × E 는 현물, 하락장이면 나머지 (1 − w) × E 를 선물 지갑으로 옮겨 1배 숏.
    하락장이 아니면 나머지는 현물 지갑에 USDT 로 둔다.
  - w 나 장이 바뀐 날에만 사고판다. 숏을 줄여야 하면(또는 현물을 살 돈이 숏 증거금에 묶여 있으면) 숏을 다 갚고
    증거금을 현물 지갑으로 되돌린 뒤 새 몫으로 다시 잡는다 — 격리 마진의 부분 정산을 짐작하지 않으려고.
  - 업비트 봇의 4시간 매수·터틀 손절은 넣지 않았다. 백테스트 B1 에 없던 규칙이다.

안전장치 (업비트 봇과 같은 원칙)
  - .env 에 BINANCE_LIVE=1 이 없으면 주문을 보내지 않고 지금 호가로 체결을 흉내 낸다(드라이런, 장부는 live_binance/dry).
  - 봇은 장부의 돈만 굴린다. 팔 때도 봇이 산 수량까지만, 숏도 봇이 잡은 수량까지만 갚는다(reduceOnly).
  - 주문·이체는 보내기 전에 장부에 먼저 적는다. 주문은 고유 번호(newClientOrderId)로, 이체는 종류·금액·시각으로 바이낸스에 물어
    장부를 맞춘다. 다시 보내는 재시도는 없다. 바이낸스가 5xx·응답 없음이면 결과를 모르는 것으로 보고 다음 실행이 확인한다.
  - 실행할 때마다 장부와 실제 계좌(현물 잔고 · 선물 지갑 · 선물 포지션)를 견줘 어긋나면 적어 둔다(리포트 상태 줄에 뜬다).
  - 선물은 격리 마진 · 레버리지 1배 · 단방향 포지션. 숏을 처음 잡기 전에 그 심볼을 격리 · 1배로 맞추고, 양방향(hedge) 모드면 숏을 잡지 않는다.
  - 펀딩비는 바이낸스 펀딩 내역을 읽어 그 몫의 선물 증거금에 더한다.
  - live_binance/STOP 파일이 있으면 아무것도 하지 않는다. 평가액이 최고점 대비 BINANCE_HALT_DD 이상 빠지면 숏을 갚고
    현물을 팔고 STOP 을 만든다(기본 0.50 — B1 백테스트의 달러 기준 최대 하락 −49% 를 넘으면 전략이 깨진 것으로 본다).
  - 이 계좌의 BTCUSDT · ETHUSDT 선물 포지션은 봇만 쓴다고 가정한다(펀딩 내역 · 포지션 대조가 심볼 단위다).

설정 (.env, 이 프로젝트 폴더)
  BINANCE_API_KEY=...
  BINANCE_SECRET_KEY=...
  BINANCE_BUDGET=150     # 처음 시작할 때 봇에 맡기는 USDT. 장부가 생긴 뒤로는 --deposit / --withdraw 로만 바꾼다
  BINANCE_LIVE=0         # 1 이어야 실제 주문
  BINANCE_HALT_DD=0.50

사용법
  python3 scripts/live_binance.py --check            # 키 권한 · 잔고 · 선물 설정 확인 (주문·이체 없음)
  python3 scripts/live_binance.py --status           # 오늘 신호와 할 일 (주문·이체 없음)
  python3 scripts/live_binance.py                    # 오늘 몫 실행 (UTC 하루 한 번, 09:00 KST 이후)
  python3 scripts/live_binance.py --report           # 누적 성과
  python3 scripts/live_binance.py --deposit 100      # 봇이 굴리는 USDT 를 늘린다 (다음 실행이 비중에 맞춘다)
  python3 scripts/live_binance.py --withdraw 50      # 줄인다
"""
import csv, hashlib, hmac, json, math, os, sys, time, traceback, urllib.error, urllib.request, uuid
from datetime import datetime, timedelta, timezone
from decimal import ROUND_DOWN, Decimal
from pathlib import Path
from urllib.parse import quote, urlencode

from paper import KST, SMAS, append, signal

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "live_binance"
SPOT, FAPI = "https://api.binance.com", "https://fapi.binance.com"
COINS = ["BTC", "ETH"]
Z_DAYS, ENTER, LEAVE = 30, 1.0, 0.5  # 판별기 (나) — 3상태 루프에서 정한 값 그대로
BUF = 0.01  # 숏 명목 = 증거금 ÷ (1 + BUF). 수수료 · 주문 사이 가격 변동으로 증거금 부족 거절이 나지 않게 남기는 여유
SPOT_FEE, FUT_FEE = 0.001, 0.0005  # 드라이런 체결 흉내에만 쓴다. 실전은 체결 내역의 수수료
TRADE_COLS = ["시각", "모드", "코인", "구분", "사유", "현물비중", "하락장", "가격", "수량", "USDT", "수수료", "상태", "번호"]
EQUITY_COLS = ["날짜", "모드", "코인", "현물비중", "장", "숏수량", "평가액", "넣은돈"]


def env():
    cfg = {"BINANCE_LIVE": "0", "BINANCE_HALT_DD": "0.50"}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.split("#")[0].strip()
    return cfg


CFG = env()
LIVE = CFG["BINANCE_LIVE"] == "1"
KEYS = bool(CFG.get("BINANCE_API_KEY") and CFG.get("BINANCE_SECRET_KEY"))
BUDGET = float(CFG.get("BINANCE_BUDGET") or (0 if LIVE else 1000))  # 드라이런은 예산이 없으면 1000 USDT 로 흉내 낸다
HALT_DD = float(CFG["BINANCE_HALT_DD"])
STOP = BASE / "STOP"


def use(d):
    global DIR, STATE, TRADES, EQUITY, FLOWS
    DIR = d
    STATE, TRADES, EQUITY, FLOWS = d / "state.json", d / "trades.csv", d / "equity.csv", d / "flows.csv"


use(BASE if LIVE else BASE / "dry")


class Rejected(RuntimeError):
    """바이낸스가 요청을 거절했다(4xx). 주문·이체 요청이었다면 만들어지지 않았다."""

    def __init__(self, msg, status, code=None):
        super().__init__(msg)
        self.status, self.code = status, code


def http(method, url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        return json.load(urllib.request.urlopen(req, timeout=10))
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            code = json.loads(body).get("code")
        except Exception:
            code = None
        msg = f"{method} {url.split('?')[0]} {e.code}: {body[:200]}"
        # 5xx · 408 · -1006/-1007 은 바이낸스도 '실행 여부 모름' 이라고 한다. 거절로 보지 않는다
        if e.code < 500 and e.code != 408 and code not in (-1006, -1007):
            raise Rejected(msg, e.code, code) from None
        raise RuntimeError(msg) from None
    except Exception as e:  # 시간 초과 · 연결 끊김: 요청이 닿았는지 알 수 없다
        raise RuntimeError(f"{method} {url.split('?')[0]} 응답 없음: {e}") from None


def pub(url):
    for i in range(3):
        try:
            return http("GET", url)
        except Exception:
            if i == 2:
                raise
            time.sleep(2)


OFFSET = None  # 바이낸스 서버 시각 − 이 컴퓨터 시각 (ms)


def stamp():
    global OFFSET
    if OFFSET is None:
        t0 = time.time()
        srv = pub(f"{SPOT}/api/v3/time")["serverTime"]
        OFFSET = int(srv - (t0 + time.time()) / 2 * 1000)
    return int(time.time() * 1000) + OFFSET


def private(method, base, path, params=None):
    """서명한 요청. 조회만 다시 시도한다 — 주문 · 이체를 다시 보내면 두 번 나갈 수 있다."""
    tries = 3 if method == "GET" else 1
    head = {"X-MBX-APIKEY": CFG["BINANCE_API_KEY"]}
    for i in range(tries):
        q = urlencode({**(params or {}), "timestamp": stamp(), "recvWindow": 10000})
        q += "&signature=" + hmac.new(CFG["BINANCE_SECRET_KEY"].encode(), q.encode(), hashlib.sha256).hexdigest()
        try:
            if method == "GET":
                return http("GET", f"{base}{path}?{q}", headers=head)
            return http(method, base + path, data=q.encode(), headers={**head, "Content-Type": "application/x-www-form-urlencoded"})
        except Rejected as e:
            if e.status != 429 or i == tries - 1:
                raise
        except RuntimeError:
            if i == tries - 1:
                raise
        time.sleep(1 + i)


# ---------- 시세 · 신호 ----------

def day_closes(base, path, coin, limit):
    """마감된 일봉(00:00 UTC) 종가를 오래된 순으로. 진행 중인 봉은 빼고, 어제 봉이 없으면 예외 — 하루 늦은 종가로 매매하지 않으려고."""
    ks = pub(f"{base}{path}?symbol={coin}USDT&interval=1d&limit={limit}")
    today = datetime.now(KST).astimezone(timezone.utc).date()
    rows = [(datetime.fromtimestamp(k[0] / 1000, timezone.utc).date(), float(k[4])) for k in ks]
    rows = [r for r in rows if r[0] < today]
    want = today - timedelta(days=1)
    if not rows or rows[-1][0] != want:
        raise RuntimeError(f"{coin} {path} 일봉이 덜 올라왔다: 마지막 마감 봉 {rows[-1][0] if rows else '없음'}, 있어야 할 봉 {want}")
    return [r[0].isoformat() for r in rows], [r[1] for r in rows]


def zs(px, n=Z_DAYS):
    """지난 n일 z = (log c_t − log c_{t−n}) ÷ (일 로그 수익 n일 표준편차 × √n). lab/regime3.ztrail 과 같다."""
    lr = [math.log(p) for p in px]
    d = [float("nan")] + [lr[i] - lr[i - 1] for i in range(1, len(lr))]
    out = []
    for i in range(len(lr)):
        if i < n:
            out.append(float("nan"))
            continue
        w = d[i - n + 1:i + 1]
        m = sum(w) / n
        sd = math.sqrt(sum((x - m) ** 2 for x in w) / (n - 1))
        out.append((lr[i] - lr[i - n]) / (sd * math.sqrt(n)) if sd > 0 else float("nan"))
    return out


def regime(px):
    """판별기 (나): 지난 30일 z + 문턱 여유. 마지막 날의 장 −2(강한 하락) ~ 2(강한 상승). lab/regime3.hyst 와 같다."""
    st = g = 0
    for v in zs(px):
        if math.isnan(v):
            st = 0
        elif v >= ENTER:
            st = 1
        elif v <= -ENTER:
            st = -1
        elif (st == 1 and v < LEAVE) or (st == -1 and v > -LEAVE):
            st = 0
        g = st * (2 if abs(v) >= 2 else 1) if st else 0
    return g


REGIME_NAME = {2: "강한 상승장", 1: "상승장", 0: "횡보장", -1: "하락장", -2: "강한 하락장"}


def signals(coin):
    """(현물 비중 w, 장, 현물 종가, 선물 종가). 현물 400일 · 선물 1000일 — 문턱 여유는 과거 상태를 따라가니 넉넉히 본다."""
    _, sp = day_closes(SPOT, "/api/v3/klines", coin, 400)
    _, fp = day_closes(FAPI, "/fapi/v1/klines", coin, 1000)
    if len(sp) < max(SMAS) or len(fp) < 4 * Z_DAYS:
        raise RuntimeError(f"{coin} 일봉이 모자란다 (현물 {len(sp)} · 선물 {len(fp)})")
    return signal(sp), regime(fp), sp[-1], fp[-1]


def spot_book(coin):
    b = pub(f"{SPOT}/api/v3/ticker/bookTicker?symbol={coin}USDT")
    return float(b["bidPrice"]), float(b["askPrice"])


def fut_book(coin):
    b = pub(f"{FAPI}/fapi/v1/ticker/bookTicker?symbol={coin}USDT")
    return float(b["bidPrice"]), float(b["askPrice"])


def mark(coin):
    return float(pub(f"{FAPI}/fapi/v1/premiumIndex?symbol={coin}USDT")["markPrice"])


def usdt_price(asset):
    return 1.0 if asset == "USDT" else float(pub(f"{SPOT}/api/v3/ticker/price?symbol={asset}USDT")["price"])


RULES = {}


def rules():
    """주문 단위. 현물: 수량 단위 · 최소 금액, 선물: 수량 단위 · 최소 수량 · 최소 명목. 한 번 읽고 둔다."""
    if not RULES:
        syms = quote(json.dumps([f"{c}USDT" for c in COINS], separators=(",", ":")))
        for s in pub(f"{SPOT}/api/v3/exchangeInfo?symbols={syms}")["symbols"]:
            f = {x["filterType"]: x for x in s["filters"]}
            RULES.setdefault(s["baseAsset"], {}).update(
                s_step=f["LOT_SIZE"]["stepSize"], s_min=float(f.get("NOTIONAL", f.get("MIN_NOTIONAL", {})).get("minNotional", 5)))
        for s in pub(f"{FAPI}/fapi/v1/exchangeInfo")["symbols"]:
            if s["symbol"] in [f"{c}USDT" for c in COINS] and s.get("contractType") == "PERPETUAL":
                f = {x["filterType"]: x for x in s["filters"]}
                lot = f.get("MARKET_LOT_SIZE") or f["LOT_SIZE"]
                RULES.setdefault(s["baseAsset"], {}).update(f_step=lot["stepSize"], f_min=float(lot["minQty"]), f_notional=float(f["MIN_NOTIONAL"]["notional"]))
    return RULES


def floor(x, step):
    d = Decimal(str(step)).normalize()
    return float(((Decimal(repr(max(x, 0.0))) + Decimal("1e-12")) / d).to_integral_value(rounding=ROUND_DOWN) * d)


def fmt(x, step):
    places = max(0, -Decimal(str(step)).normalize().as_tuple().exponent)
    return f"{floor(x, step):.{places}f}"


# ---------- 장부 ----------

def now():
    return datetime.now(KST)


def iso():
    return now().isoformat(timespec="seconds")


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text())
    ms = int(now().timestamp() * 1000)
    return {"start": None, "last_run": None, "peak": BUDGET, "budget": BUDGET, "env_budget": BUDGET, "xfer_seen": [],
            "funding_ms": {c: ms for c in COINS},
            "sleeves": {c: {"cash": BUDGET / len(COINS), "qty": 0.0, "margin": 0.0, "short": 0.0, "entry": 0.0, "funding": 0.0,
                            "w": None, "bear": None} for c in COINS}}


def save_state(st):
    """임시 파일에 쓰고 바꿔치기한다. 쓰는 중에 꺼져도 장부가 깨지지 않는다."""
    tmp = STATE.with_suffix(".tmp")
    with tmp.open("w") as f:
        f.write(json.dumps(st, ensure_ascii=False, indent=2))
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, STATE)


def value(s, mid, mk):
    """몫의 평가액 = 현물 지갑 USDT + 코인 × 현물 중간가 + 선물 증거금 + 숏 평가 손익(마크 가격)."""
    return s["cash"] + s["qty"] * mid + s["margin"] + s["short"] * (s["entry"] - mk)


def record(st, c, p, kind, px, qty, usdt, fee, state):
    if not (TRADES.exists() and p["id"] in TRADES.read_text()):  # 기록 직후 죽었다가 다시 반영해도 두 번 적지 않는다
        append(TRADES, TRADE_COLS, [p["at"], "실전" if LIVE else "드라이런", c, kind, p["reason"], p.get("w"), p.get("bear"),
                                    round(px, 4), round(qty, 8), round(usdt, 4), round(fee, 6), state, p["id"]])
    print(f"{'[실전]' if LIVE else '[드라이런]'} {c} {kind} {qty:.8g} @ {px:,.2f} = {usdt:,.2f} USDT (수수료 {fee:.4f}, {state})")


def apply_order(st, c, p, qty, quote_usdt, fee_base, fee_usdt, state):
    """체결을 장부에 반영한다. 현물: 코인 수수료는 받은 코인에서, USDT 수수료는 현금에서. 선물: 수수료는 증거금에서."""
    s = st["sleeves"][c]
    px = quote_usdt / qty
    if p["kind"] == "spot":
        sign = 1 if p["side"] == "BUY" else -1
        s["qty"] = max(round(s["qty"] + sign * qty - fee_base, 10), 0.0)
        s["cash"] -= sign * quote_usdt + fee_usdt
        record(st, c, p, "현물 매수" if sign > 0 else "현물 매도", px, qty, quote_usdt, fee_usdt + fee_base * px, state)
    elif p["side"] == "SELL":  # 숏을 잡거나 늘린다
        s["entry"] = (s["entry"] * s["short"] + quote_usdt) / (s["short"] + qty)
        s["short"] = round(s["short"] + qty, 10)
        s["margin"] -= fee_usdt
        record(st, c, p, "숏 잡기", px, qty, quote_usdt, fee_usdt, state)
    else:  # 숏을 갚는다
        pnl = qty * s["entry"] - quote_usdt
        s["margin"] += pnl - fee_usdt
        s["short"] = max(round(s["short"] - qty, 10), 0.0)
        if s["short"] == 0:
            s["entry"] = 0.0
        record(st, c, p, f"숏 갚기 (손익 {pnl:+,.2f})", px, qty, quote_usdt, fee_usdt, state)
    s.pop("pending", None)
    save_state(st)


def apply_xfer(st, c, p, state):
    s = st["sleeves"][c]
    amt = float(p["amount"])
    to_fut = p["type"] == "MAIN_UMFUTURE"
    s["cash"] += -amt if to_fut else amt
    s["margin"] += amt if to_fut else -amt
    record(st, c, p, "선물 지갑으로" if to_fut else "현물 지갑으로", 1.0, amt, amt, 0.0, state)
    s.pop("pending", None)
    save_state(st)


def order_result(p):
    """주문을 번호로 조회해 (체결 수량, 체결 USDT, 코인 수수료, USDT 수수료, 상태). 10초 안에 안 끝나면 예외."""
    spot = p["kind"] == "spot"
    base, path = (SPOT, "/api/v3") if spot else (FAPI, "/fapi/v1")
    sym = f"{p['coin']}USDT"
    for _ in range(20):
        o = private("GET", base, f"{path}/order", {"symbol": sym, "origClientOrderId": p["id"]})
        if o["status"] not in ("NEW", "PARTIALLY_FILLED", "PENDING_NEW"):
            break
        time.sleep(0.5)
    else:
        raise RuntimeError(f"주문 {p['id']} 이 끝나지 않았다 (상태 {o['status']})")
    qty = float(o["executedQty"])
    usdt = float(o["cummulativeQuoteQty"] if spot else o["cumQuote"])
    fee_base = fee_usdt = 0.0
    if qty:
        fills = private("GET", base, f"{path}/myTrades" if spot else f"{path}/userTrades", {"symbol": sym, "orderId": o["orderId"]})
        if abs(sum(float(f["qty"]) for f in fills) - qty) > 1e-9:
            raise RuntimeError(f"주문 {p['id']} 의 체결 내역이 아직 다 오지 않았다")
        for f in fills:
            amt, asset = float(f["commission"]), f["commissionAsset"]
            if asset == p["coin"]:
                fee_base += amt
            else:  # USDT, 또는 BNB 로 낸 수수료는 USDT 로 바꿔 적는다
                fee_usdt += amt * usdt_price(asset)
    return qty, usdt, fee_base, fee_usdt, o["status"]


def xfer_result(st, p):
    """이체를 내역에서 찾는다: 같은 종류 · 같은 금액 · 기록한 시각 1분 전 이후 · 아직 쓰지 않은 번호. (찾음, 상태)"""
    r = private("GET", SPOT, "/sapi/v1/asset/transfer", {"type": p["type"], "startTime": p["ms"] - 60_000, "size": 100})
    for row in r.get("rows", []):
        if (row.get("asset") == "USDT" and abs(float(row["amount"]) - float(p["amount"])) < 1e-9 and int(row["timestamp"]) >= p["ms"] - 60_000
                and str(row["tranId"]) not in st["xfer_seen"]):
            return row
    return None


def settle(st, c, fresh=False):
    """몫에 적어 둔 주문 · 이체를 바이낸스에서 확인해 장부에 반영한다. 접수된 적 없으면 기록만 지운다."""
    s = st["sleeves"][c]
    p = s["pending"]
    age = (now() - datetime.fromisoformat(p["at"])).total_seconds()
    if p["kind"] == "xfer":
        row = xfer_result(st, p)
        if row is None or row.get("status") == "FAILED":
            if row is None and (fresh or age < 300):  # 방금 보낸 이체는 내역에 늦게 뜰 수 있다
                raise RuntimeError(f"{c} 이체 {p['amount']} USDT 를 내역에서 아직 못 찾았다. 다음 실행이 다시 확인한다")
            print(f"{c} {p['at']} 이체 {p['amount']} USDT 는 이루어지지 않았다. 기록을 지운다.")
            del s["pending"]
            save_state(st)
            return
        if row.get("status") != "CONFIRMED":
            raise RuntimeError(f"{c} 이체 {p['amount']} USDT 상태 {row.get('status')} — 다음 실행이 다시 확인한다")
        st["xfer_seen"] = (st["xfer_seen"] + [str(row["tranId"])])[-50:]
        apply_xfer(st, c, p, "CONFIRMED")
        return
    try:
        qty, usdt, fee_base, fee_usdt, state = order_result(p)
    except Rejected as e:
        if e.code != -2013 or fresh or age < 60:  # -2013 = 그런 주문 없음. 방금 보낸 주문은 아직 조회가 안 될 수 있다
            raise
        print(f"{c} {p['at']} {p['side']} 주문은 바이낸스에 접수되지 않았다. 기록을 지우고 다시 판단한다.")
        del s["pending"]
        save_state(st)
        return
    if qty == 0:
        del s["pending"]
        save_state(st)
        raise RuntimeError(f"{c} {p['kind']} {p['side']} 주문이 체결 없이 끝났다 ({state})")
    apply_order(st, c, p, qty, usdt, fee_base, fee_usdt, state)


def plan(c, reason, w, bear, **kw):
    return {"id": f"ct-{uuid.uuid4().hex}", "coin": c, "reason": reason, "w": w, "bear": bear, "at": iso(), **kw}


def spot_order(st, c, side, p, usdt=None, qty=None):
    s = st["sleeves"][c]
    p.update(kind="spot", side=side)
    if not LIVE:
        bid, ask = spot_book(c)
        if side == "BUY":
            got = usdt / ask
            apply_order(st, c, p, got, usdt, got * SPOT_FEE, 0.0, "dry-run")
        else:
            apply_order(st, c, p, qty, qty * bid, 0.0, qty * bid * SPOT_FEE, "dry-run")
        return
    params = {"symbol": f"{c}USDT", "side": side, "type": "MARKET", "newClientOrderId": p["id"], "newOrderRespType": "ACK"}
    if side == "BUY":
        params["quoteOrderQty"] = f"{usdt:.2f}"  # USDT 금액으로 산다. 수수료는 받은 코인에서 빠진다
    else:
        params["quantity"] = fmt(qty, rules()[c]["s_step"])
    send(st, c, p, SPOT, "/api/v3/order", params)


def fut_order(st, c, side, qty, p):
    p.update(kind="fut", side=side)
    if not LIVE:
        bid, ask = fut_book(c)
        px = bid if side == "SELL" else ask
        apply_order(st, c, p, qty, qty * px, 0.0, qty * px * FUT_FEE, "dry-run")
        return
    params = {"symbol": f"{c}USDT", "side": side, "type": "MARKET", "quantity": fmt(qty, rules()[c]["f_step"]),
              "newClientOrderId": p["id"], "newOrderRespType": "ACK"}
    if side == "BUY":
        params["reduceOnly"] = "true"  # 갚기만 한다 — 장부가 틀려도 롱이 생기지 않는다
    send(st, c, p, FAPI, "/fapi/v1/order", params)


def send(st, c, p, base, path, params):
    s = st["sleeves"][c]
    s["pending"] = p
    save_state(st)  # 주문보다 먼저 적는다
    try:
        private("POST", base, path, params)
    except Rejected:
        del s["pending"]  # 바이낸스가 거절했다 = 주문은 없다
        save_state(st)
        raise
    # 그 밖의 예외(응답 없음 · 5xx)는 주문이 들어갔는지 알 수 없다. 기록을 남긴 채 올려 보내고 다음 실행의 settle 이 확인한다
    settle(st, c, fresh=True)


def transfer(st, c, amount, to_fut, p):
    """현물 지갑 ↔ 선물 지갑 USDT 이체(바이낸스 계정 안, 수수료 없음). 0.01 USDT 단위로 내림."""
    amount = floor(amount, "0.01")
    if amount < 0.01:
        return
    p.update(kind="xfer", type="MAIN_UMFUTURE" if to_fut else "UMFUTURE_MAIN", amount=f"{amount:.2f}", ms=int(now().timestamp() * 1000))
    if not LIVE:
        apply_xfer(st, c, p, "dry-run")
        return
    s = st["sleeves"][c]
    s["pending"] = p
    save_state(st)
    try:
        r = private("POST", SPOT, "/sapi/v1/asset/transfer", {"type": p["type"], "asset": "USDT", "amount": p["amount"]})
    except Rejected:
        del s["pending"]
        save_state(st)
        raise
    # 그 밖의 예외(응답 없음)는 됐는지 모른다. 기록을 남긴 채 올려 보내고 다음 실행이 내역에서 찾는다
    st["xfer_seen"] = (st["xfer_seen"] + [str(r.get("tranId"))])[-50:]
    apply_xfer(st, c, p, "CONFIRMED")


# ---------- 실제 계좌 ----------

def spot_balances():
    acc = private("GET", SPOT, "/api/v3/account", {"omitZeroBalances": "true"})
    return {b["asset"]: (float(b["free"]), float(b["locked"])) for b in acc["balances"]}


def fut_wallet():
    """선물 지갑 USDT (지갑 잔고, 옮길 수 있는 돈)."""
    for b in private("GET", FAPI, "/fapi/v2/balance"):
        if b["asset"] == "USDT":
            return float(b["balance"]), float(b["maxWithdrawAmount"])
    return 0.0, 0.0


def position(c):
    rows = private("GET", FAPI, "/fapi/v2/positionRisk", {"symbol": f"{c}USDT"})
    return rows[0] if rows else {}


def prepare_futures(c):
    """숏을 처음 잡기 전에: 단방향 모드인지 보고, 그 심볼을 격리 마진 · 1배로 맞춘다(포지션이 없을 때만 바꿀 수 있다)."""
    if not LIVE:
        return
    if private("GET", FAPI, "/fapi/v1/positionSide/dual").get("dualSidePosition"):
        raise RuntimeError("선물 계정이 양방향(hedge) 모드라 숏을 잡지 않는다. 바이낸스 선물 설정에서 단방향(One-way)으로 바꾼다")
    pos = position(c)
    if pos.get("marginType", "").lower() != "isolated":
        try:
            private("POST", FAPI, "/fapi/v1/marginType", {"symbol": f"{c}USDT", "marginType": "ISOLATED"})
        except Rejected as e:
            if e.code != -4046:  # -4046 = 이미 그렇다
                raise
    if int(float(pos.get("leverage", 0))) != 1:
        private("POST", FAPI, "/fapi/v1/leverage", {"symbol": f"{c}USDT", "leverage": 1})


def reconcile(st):
    """장부와 실제 계좌를 견준다. 현물 지갑에는 사용자의 다른 돈도 있을 수 있으니 장부보다 모자란지만 본다. 선물 포지션은 같아야 한다."""
    notes = []
    try:
        bal = spot_balances()
        cash = sum(s["cash"] for s in st["sleeves"].values())
        usdt = sum(bal.get("USDT", (0, 0)))
        if usdt + 0.5 < cash:
            notes.append(f"현물 지갑 USDT {usdt:,.2f} 가 장부 현금 {cash:,.2f} 보다 적다")
        for c, s in st["sleeves"].items():
            have = sum(bal.get(c, (0, 0)))
            if have + 1e-8 < s["qty"]:
                notes.append(f"{c} 현물 {have:.8f} 이 장부 {s['qty']:.8f} 보다 적다")
        wallet, _ = fut_wallet()
        margin = sum(s["margin"] for s in st["sleeves"].values())
        if wallet + 0.5 < margin:
            notes.append(f"선물 지갑 USDT {wallet:,.2f} 가 장부 증거금 {margin:,.2f} 보다 적다")
        for c, s in st["sleeves"].items():
            amt = float(position(c).get("positionAmt", 0))
            if abs(-amt - s["short"]) > 1e-9:
                notes.append(f"{c} 선물 포지션 {amt:+.4f} 이 장부 숏 {-s['short']:+.4f} 와 다르다")
    except Exception as e:
        notes.append(f"계좌 조회 실패: {str(e)[:120]}")
    for n in notes:
        print("주의:", n)
    return notes


def sync_funding(st):
    """지난 확인 뒤의 펀딩을 몫의 증거금에 더한다(숏은 펀딩비가 + 면 받는다). 드라이런은 공개 펀딩비 × 숏 × 그때 마크 가격."""
    for c in COINS:
        s, since = st["sleeves"][c], st["funding_ms"][c]
        if LIVE:
            rows = private("GET", FAPI, "/fapi/v1/income", {"symbol": f"{c}USDT", "incomeType": "FUNDING_FEE", "startTime": since + 1, "limit": 1000})
            amt = sum(float(r["income"]) for r in rows)
            last = max([since] + [int(r["time"]) for r in rows])
        else:
            rows = pub(f"{FAPI}/fapi/v1/fundingRate?symbol={c}USDT&startTime={since + 1}&limit=1000") if s["short"] > 0 else []
            amt = sum(float(r["fundingRate"]) * s["short"] * float(r.get("markPrice") or 0) for r in rows)
            last = max([since] + [int(r["fundingTime"]) for r in rows]) if s["short"] > 0 else int(now().timestamp() * 1000)
        if amt:
            s["margin"] += amt
            s["funding"] = s.get("funding", 0.0) + amt
            print(f"{c} 펀딩 {amt:+.4f} USDT ({len(rows)}회)")
        st["funding_ms"][c] = last
        save_state(st)


# ---------- 매매 ----------

def rebalance(st, c, w, bear, reason):
    """몫 하나를 현물 w × E, (하락장이면) 숏 (1 − w) × E 로 맞춘다. 순서: 숏 갚기 → 증거금 되돌리기 → 현물 → 증거금 보내기 → 숏 잡기."""
    s, r = st["sleeves"][c], rules()[c]
    s.pop("rebalance", None)  # 현물 지갑 USDT 가 모자라 덜 샀으면 아래에서 다시 켠다
    mid, mk = sum(spot_book(c)) / 2, mark(c)
    E = value(s, mid, mk)
    want = floor((1 - w) * E / (mk * (1 + BUF)), r["f_step"]) if bear else 0.0
    if want and (want < r["f_min"] or want * mk < r["f_notional"]):
        print(f"{c} 숏 {want} 개({want * mk:,.2f} USDT)가 바이낸스 최소({r['f_min']} 개 · {r['f_notional']:.0f} USDT) 미만이라 잡지 않는다")
        want = 0.0
    buy = w * E - s["qty"] * mid  # 현물을 더 사야 하는 금액(− 면 판다)
    mk_p = lambda: plan(c, reason, w, bear)

    # 1) 숏을 줄여야 하거나 현물을 살 돈이 증거금에 묶여 있으면 숏을 다 갚는다
    if s["short"] > 0 and (want < s["short"] - 1e-12 or buy > s["cash"] + 1):
        fut_order(st, c, "BUY", s["short"], mk_p())
    # 2) 숏이 없으면 선물 지갑의 증거금 중 새 숏에 쓰지 않을 만큼을 현물 지갑으로 되돌린다
    if s["short"] == 0 and s["margin"] - want * mk * (1 + BUF) >= 0.01:
        amt = s["margin"] - want * mk * (1 + BUF)
        if LIVE:
            amt = min(amt, fut_wallet()[1])
        transfer(st, c, amt, False, mk_p())
    # 3) 현물
    buy = w * E - s["qty"] * mid
    if buy < 0:
        q = s["qty"] if w == 0 else min(s["qty"], -buy / mid)
        if LIVE:
            q = min(q, spot_balances().get(c, (0, 0))[0])  # 사용자가 따로 옮긴 경우 대비
        q = floor(q, r["s_step"])
        if q * mid >= r["s_min"]:
            spot_order(st, c, "SELL", mk_p(), qty=q)
    elif buy > 0:
        usdt = min(buy, s["cash"])
        if LIVE:
            have = spot_balances().get("USDT", (0, 0))[0]
            if have < usdt:
                print(f"{c} 현물 지갑 USDT 가 모자라 {usdt:,.2f} 중 {have:,.2f} 만 산다. 채워지면 다음 실행에서 마저 산다.")
                usdt, s["rebalance"] = have, True
        usdt = floor(usdt, "0.01")
        if usdt >= r["s_min"]:
            spot_order(st, c, "BUY", mk_p(), usdt=usdt)
    # 4) 하락장이면 쉬는 돈을 선물 지갑으로 보내고 숏을 잡는다
    if want > s["short"]:
        prepare_futures(c)  # 양방향 모드면 여기서 멈춘다 — 증거금을 보내기 전에
        need = s["short"] * s["entry"] + (want - s["short"]) * mk * (1 + BUF) - s["margin"]
        if need > 0:
            amt = min(need + 0.01, s["cash"])
            if LIVE:
                amt = min(amt, spot_balances().get("USDT", (0, 0))[0])
            transfer(st, c, amt, True, mk_p())
        room = s["margin"] - s["short"] * s["entry"]
        add = floor(min(want - s["short"], room / (mk * (1 + BUF))), r["f_step"])
        if add >= r["f_min"] and add * mk >= r["f_notional"]:
            fut_order(st, c, "SELL", add, mk_p())
        elif add > 0:
            print(f"{c} 숏 추가 {add} 개가 최소 단위 미만이라 건너뜀")
    s["w"], s["bear"] = w, bear
    save_state(st)


def run():
    t = now()
    day = t.astimezone(timezone.utc).strftime("%Y-%m-%d")  # 매매일 = UTC 날짜 (일봉이 00:00 UTC 에 바뀐다)
    mode = "실전" if LIVE else "드라이런"
    print(f"--- {t.isoformat(timespec='seconds')} 바이낸스 {mode}")
    if STOP.exists():
        print(f"STOP 파일이 있어 멈춤: {STOP.read_text().strip()}")
        return
    if LIVE and not KEYS:
        print(".env 에 BINANCE_API_KEY / BINANCE_SECRET_KEY 가 없다. 넣기 전에는 BINANCE_LIVE=0 (드라이런) 으로 둔다.")
        return
    if BUDGET <= 0 and not STATE.exists():
        print(".env 에 BINANCE_BUDGET(USDT)이 없다. 처음 맡길 USDT 를 적는다.")
        return
    DIR.mkdir(parents=True, exist_ok=True)
    st = load_state()
    print(f"넣은 돈 {st['budget']:,.2f} USDT")
    if st["last_run"] == day:
        print(f"{day} 몫은 이미 끝났다.")
        return
    failed = {}

    def fail(c):
        failed[c] = str(sys.exc_info()[1])[:200]
        print(f"{c} 실패: {failed[c]}")
        print(f"--- {t.isoformat(timespec='seconds')} {c}\n{traceback.format_exc()}", file=sys.stderr)

    for c in COINS:  # 지난 실행이 남긴 주문 · 이체 기록부터 확인한다
        if LIVE and st["sleeves"][c].get("pending"):
            try:
                settle(st, c)
            except Exception:
                fail(c)
    notes = []
    try:
        sync_funding(st)
    except Exception as e:
        notes.append(f"펀딩 내역 조회 실패: {str(e)[:120]}")
    if LIVE:
        notes += reconcile(st)

    px = {c: (sum(spot_book(c)) / 2, mark(c)) for c in COINS}
    total = sum(value(st["sleeves"][c], *px[c]) for c in COINS)
    st["peak"] = max(st["peak"], total)
    halt = total < st["peak"] * (1 - HALT_DD)
    if halt:
        print(f"평가액 {total:,.2f} 이 최고점 {st['peak']:,.2f} 대비 {HALT_DD * 100:.0f}% 넘게 하락 → 숏을 갚고 현물을 팔고 정지")
    for c in COINS:
        s = st["sleeves"][c]
        if c in failed:
            continue
        try:
            if halt:
                rebalance(st, c, 0.0, False, "손실 한도")
            else:
                w, g, _, _ = signals(c)
                bear = g < 0
                s["signal"] = {"day": day, "w": w, "regime": g}
                if (w, bear) != (s["w"], s["bear"]) or s.get("rebalance"):
                    print(f"{c} 현물 비중 {s['w']}→{w:.2f}, 장 {REGIME_NAME[g]} → {'숏 (1 − w)' if bear else '숏 없음'}")
                    rebalance(st, c, w, bear, "신호" if (w, bear) != (s["w"], s["bear"]) else "비중 맞춤")
                else:
                    print(f"{c} 유지: 현물 비중 {w:.2f}, 장 {REGIME_NAME[g]}")
        except Exception:
            fail(c)
        save_state(st)
    if halt and not failed:
        STOP.write_text(f"{day} 손실 한도 {HALT_DD * 100:.0f}% 도달. 원인 확인 후 이 파일을 지우면 재개.")

    total = 0.0
    for c in COINS:
        s = st["sleeves"][c]
        v = value(s, sum(spot_book(c)) / 2, mark(c))
        append(EQUITY, EQUITY_COLS, [day, mode, c, s["w"], s.get("signal", {}).get("regime"), s["short"], round(v, 4), round(st["budget"], 4)])
        total += v
    st["start"] = st["start"] or day
    if not failed:
        st["last_run"] = day
    st["peak"] = max(st["peak"], total)
    if LIVE and BUDGET and BUDGET != st["env_budget"]:  # 드라이런 장부는 예산이 달라도 상관없다
        notes.append(f".env 의 BINANCE_BUDGET 을 {BUDGET:,.2f} 로 바꿨지만 반영되지 않는다. 증액 · 감액은 --deposit / --withdraw 로 한다")
    st["check"] = {"at": t.isoformat(timespec="seconds"), "notes": notes + [f"{c} 실패: {e}" for c, e in failed.items()]}
    save_state(st)
    print(f"봇 평가액 {total:,.2f} USDT (넣은 돈 대비 {(total / st['budget'] - 1) * 100:+.2f}%)")
    if failed:
        print(f"실패한 코인 {', '.join(failed)} 은 다음 실행(13:07 · 17:07 · 21:07)에서 다시 한다.")
        sys.exit(1)


def flow(amount):
    """봇이 굴리는 USDT 를 늘리거나(+) 줄인다(-). 장부만 고치고, 매매는 다음 실행이 목표 비중에 맞춰 한다."""
    if not STATE.exists():
        print("아직 장부가 없다. 처음에는 .env 의 BINANCE_BUDGET 으로 시작한다.")
        return
    st = load_state()
    if any(s.get("pending") for s in st["sleeves"].values()):
        print("확인이 끝나지 않은 주문 · 이체가 있다. 다음 실행이 끝난 뒤에 다시 한다.")
        return
    values = {c: value(s, sum(spot_book(c)) / 2, mark(c)) for c, s in st["sleeves"].items()}
    total = sum(values.values())
    if amount < 0 and total + amount < 10 * len(COINS):
        print(f"봇 평가액이 {total:,.2f} USDT 라 {-amount:,.2f} 를 뺄 수 없다. 전부 빼려면 touch live_binance/STOP 뒤 직접 정리한다.")
        return
    for c, s in st["sleeves"].items():
        s["cash"] += amount / len(COINS) if amount > 0 or total <= 0 else amount * values[c] / total
        s["rebalance"] = True
    st["peak"] = st["peak"] * (total + amount) / total if total > 0 else total + amount  # 최고점 대비 낙폭 비율은 그대로 둔다
    st["budget"] += amount
    st["last_run"] = None  # 다음 실행(13:07 · 17:07 · 21:07 · 내일 09:07 중 가장 가까운 때)이 비중을 맞춘다
    append(FLOWS, ["시각", "금액", "넣은돈_합계", "직전_평가액"], [iso(), round(amount, 4), round(st["budget"], 4), round(total, 4)])
    save_state(st)
    print(f"{'입금' if amount > 0 else '출금'} {abs(amount):,.2f} USDT 반영. 넣은 돈 {st['budget']:,.2f}, 봇 평가액 {total + amount:,.2f} USDT.")
    if amount > 0:
        print("바이낸스 현물 지갑에 그만큼 USDT 가 있어야 한다. 다음 실행 때 목표 비중에 맞춘다.")
    elif min(s["cash"] for s in st["sleeves"].values()) < 0:
        print("현물 지갑 현금이 모자라 다음 실행 때 숏을 갚거나 코인을 팔아 채운다. 그 실행이 끝난 뒤에 꺼낸다.")
    else:
        print("장부 현금에서 뺐다. 현물 지갑에서 바로 꺼내도 된다.")


def status():
    """오늘 신호와 장부 — 주문 · 이체 없이 보기만 한다."""
    st = load_state() if STATE.exists() else None
    print(f"모드 {'실전' if LIVE else '드라이런'} · 키 {'있음' if KEYS else '없음'} · 손실 한도 {HALT_DD * 100:.0f}%" + (" · STOP 파일 있음" if STOP.exists() else ""))
    for c in COINS:
        w, g, sp, fp = signals(c)
        line = f"{c}: 현물 종가 {sp:,.2f} · 비중 {w:.2f} | 선물 종가 {fp:,.2f} · {REGIME_NAME[g]} → 현물 {w * 100:.0f}%" + (f" + 숏 {(1 - w) * 100:.0f}%" if g < 0 else ", 숏 없음")
        if st:
            s = st["sleeves"][c]
            line += f" | 장부: 현금 {s['cash']:,.2f} · 코인 {s['qty']:.6f} · 증거금 {s['margin']:,.2f} · 숏 {s['short']}" + (" · 확인 안 된 주문 있음" if s.get("pending") else "")
        print(line)


def check():
    st = load_state()
    print(f"모드 {'실전(BINANCE_LIVE=1)' if LIVE else '드라이런'}, 넣은 돈 {st['budget']:,.2f} USDT, 손실 한도 {HALT_DD * 100:.0f}%")
    if not KEYS:
        print(".env 에 BINANCE_API_KEY / BINANCE_SECRET_KEY 가 없다. 드라이런은 키 없이도 돈다.")
        return
    r = private("GET", SPOT, "/sapi/v1/account/apiRestrictions")
    need = {"enableReading": "읽기", "enableSpotAndMarginTrading": "현물 거래", "enableFutures": "선물", "permitsUniversalTransfer": "지갑 간 이체"}
    for k, nm in need.items():
        print(f"권한 {nm}: {'켜짐' if r.get(k) else '꺼짐 — 켜야 한다'}" + ("" if r.get(k) or k != "enableFutures" else " (선물 계정을 연 뒤에 만든 키여야 하고, 포트폴리오 마진은 꺼져 있어야 한다)"))
    print(f"권한 출금: {'켜짐 — 끄는 것이 안전하다' if r.get('enableWithdrawals') else '꺼짐 (좋다)'}")
    print(f"IP 제한: {'있음 (좋다)' if r.get('ipRestrict') else '없음 — 바이낸스는 IP 제한이 없는 키에 읽기 말고는 권한을 주지 않는다. 이 컴퓨터의 공인 IP 로 묶는다'}")
    bal = spot_balances()
    print("현물 지갑:", {k: sum(v) for k, v in bal.items() if k in ("USDT", "BNB", *COINS)})
    wallet, free = fut_wallet()
    print(f"선물 지갑 USDT: {wallet:,.2f} (옮길 수 있는 돈 {free:,.2f})")
    dual = private("GET", FAPI, "/fapi/v1/positionSide/dual").get("dualSidePosition")
    print(f"선물 포지션 모드: {'양방향(hedge) — 단방향으로 바꿔야 숏을 잡는다' if dual else '단방향 (좋다)'}")
    for c in COINS:
        p = position(c)
        print(f"{c}USDT 선물: 마진 {p.get('marginType')} · 레버리지 {p.get('leverage')} · 포지션 {p.get('positionAmt')} (숏을 처음 잡을 때 봇이 격리 · 1배로 맞춘다)")
    if STATE.exists() and not reconcile(st):
        print("장부와 계좌: 맞음")
    if STOP.exists():
        print("STOP 파일 있음:", STOP.read_text().strip())


def history():
    """날짜별 (날짜, 평가액, 넣은 돈, 지수). 지수는 입출금을 뺀 수익만 따라간다(100 에서 시작)."""
    days = {}
    for r in csv.DictReader(EQUITY.open()) if EQUITY.exists() else []:
        days.setdefault(r["날짜"], {})[r["코인"]] = r
    out, idx = [], 100.0
    for d in sorted(days):
        v = sum(float(r["평가액"]) for r in days[d].values())
        b = float(next(iter(days[d].values()))["넣은돈"])
        if not out:
            idx *= v / b
        elif out[-1][1] > 0:
            idx *= (v - (b - out[-1][2])) / out[-1][1]
        out.append((d, v, b, idx))
    return out


def report():
    h = history()
    if not h:
        print("아직 기록이 없다.")
        return
    peak = mdd = 0
    for *_, idx in h:
        peak = max(peak, idx)
        mdd = min(mdd, idx / peak - 1)
    d, v, b, idx = h[-1]
    print(f"{h[0][0]} ~ {d} ({len(h)}일)  평가액 {v:,.2f} USDT, 넣은 돈 {b:,.2f} ({(v / b - 1) * 100:+.2f}%), 입출금 뺀 수익 {idx - 100:+.2f}%, 최대 하락 {mdd * 100:.1f}%")
    if TRADES.exists():
        print(f"거래 · 이체 {sum(1 for _ in csv.DictReader(TRADES.open()))}회")


if __name__ == "__main__":
    args = sys.argv[1:]
    cmd = next((a for a in args if a.startswith("--")), "")
    if cmd in ("--deposit", "--withdraw"):
        try:
            amount = float(args[args.index(cmd) + 1].replace(",", ""))
            assert amount > 0
        except (IndexError, ValueError, AssertionError):
            sys.exit(f"사용법: python3 scripts/live_binance.py {cmd} 금액(USDT)")
        flow(amount if cmd == "--deposit" else -amount)
    else:
        {"--check": check, "--report": report, "--status": status}.get(cmd, run)()
