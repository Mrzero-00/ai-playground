"""업비트 실전 매매 봇. 신호는 모의 매매(paper.py)와 같은 앙상블을 쓴다.

안전장치
  - .env 에 LIVE=1 이 없으면 주문을 보내지 않고 할 일만 출력한다(드라이런).
  - 봇은 장부(live/state.json)에 적힌 돈만 굴린다. 계좌의 나머지 원화와 코인은 건드리지 않는다.
    팔 때도 봇이 직접 산 수량까지만 판다.
  - 주문은 보내기 전에 고유 번호와 함께 장부에 적는다. 주문 뒤에 봇이 죽어도 다음 실행이
    그 번호로 업비트에 물어 장부를 맞춘다 — 같은 주문을 두 번 내지 않는다.
  - 마켓 하나가 실패해도 다른 마켓은 처리한다. 실패한 마켓은 다음 실행(13:07·21:07)에서 다시 한다.
  - 실행할 때마다 장부와 실제 계좌를 견줘 모자라면 적어 둔다(리포트 상태 줄에 뜬다).
  - live/STOP 파일이 있으면 아무것도 하지 않는다(긴급 정지).
  - 봇 평가액이 최고점 대비 HALT_DD 이상 빠지면 전량 매도하고 STOP 파일을 만든다.
    백테스트 최대 하락(표본 외 -26%, 전체 -41%)을 넘는 건 전략이 깨졌다는 신호로 본다.

설정 (.env, 이 프로젝트 폴더)
  UPBIT_ACCESS_KEY=...
  UPBIT_SECRET_KEY=...
  BUDGET=1000000   # 처음 시작할 때 넣는 돈. 시작한 뒤에는 --deposit / --withdraw 로만 바꾼다
  LIVE=0
  HALT_DD=0.45

사용법
  python3 scripts/live.py --check            # 키·잔고·주문 권한 확인 (실제 주문 없음)
  python3 scripts/live.py                    # 오늘 몫 실행 (하루 한 번, 09:00 KST 이후)
  python3 scripts/live.py --report           # 누적 성과
  python3 scripts/live.py --deposit 300000   # 봇이 굴리는 돈을 늘린다 (다음 실행 때 비중에 맞춰 산다)
  python3 scripts/live.py --withdraw 100000  # 줄인다 (다음 실행 때 필요한 만큼 판다)
"""
import base64, csv, hashlib, hmac, json, os, sys, time, traceback, urllib.error, urllib.request, uuid
from datetime import datetime
from decimal import ROUND_DOWN, Decimal
from pathlib import Path
from urllib.parse import unquote, urlencode

from paper import FEE, KST, MARKETS, closes, fill, signal

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "live"
STATE, TRADES, EQUITY, STOP, FLOWS = DIR / "state.json", DIR / "trades.csv", DIR / "equity.csv", DIR / "STOP", DIR / "flows.csv"
API = "https://api.upbit.com"
MIN_ORDER = 5000  # 업비트 최소 주문 금액
TRADE_COLS = ["시각", "모드", "마켓", "구분", "사유", "목표비중_전", "목표비중_후", "신호종가", "중간가", "체결가", "수량", "원화", "수수료", "상태", "주문번호"]


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


class Rejected(RuntimeError):
    """업비트가 요청을 거절했다(4xx). 주문 요청이었다면 주문은 만들어지지 않았다."""

    def __init__(self, msg, code):
        super().__init__(msg)
        self.code = code


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
    tries = 3 if method == "GET" else 1  # 조회만 다시 시도한다. 주문을 다시 보내면 두 번 나갈 수 있다
    for i in range(tries):
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Authorization": f"Bearer {token(params)}", "Content-Type": "application/json", "Accept": "application/json"})
        try:
            return json.load(urllib.request.urlopen(req, timeout=10))
        except urllib.error.HTTPError as e:
            msg = f"{method} {path} {e.code}: {e.read().decode()}"
            if e.code < 500 and not (e.code == 429 and i < tries - 1):
                raise Rejected(msg, e.code) from None
            err = RuntimeError(msg)
        except Exception as e:  # 시간 초과·연결 끊김: 요청이 닿았는지 알 수 없다
            err = RuntimeError(f"{method} {path} 응답 없음: {e}")
        if i < tries - 1:
            time.sleep(1 + i)
    raise err


def balances():
    return {a["currency"]: float(a["balance"]) for a in private("GET", "/v1/accounts")}


def wait_done(ident):
    """주문이 끝날 때까지 기다렸다가 (체결 수량, 체결 원화, 수수료, 상태)를 돌려준다. 10초 안에 안 끝나면 예외."""
    for _ in range(20):
        o = private("GET", "/v1/order", {"identifier": ident})
        trades = o.get("trades", [])
        # 금액 지정 시장가 매수는 잔돈이 남으면 체결 후 cancel 로 끝난다
        if o["state"] in ("done", "cancel") and len(trades) >= int(o.get("trades_count") or 0):
            break
        time.sleep(0.5)
    if o["state"] not in ("done", "cancel"):
        raise RuntimeError(f"주문 {ident} 이 끝나지 않았다 (상태 {o['state']})")
    qty = float(o["executed_volume"])
    got = sum(float(t["volume"]) for t in trades)
    krw = sum(float(t["funds"]) for t in trades)
    if qty and not got:
        raise RuntimeError(f"주문 {ident} 의 체결 내역이 아직 없다")
    if got and abs(got - qty) > 1e-8:  # 체결 목록이 일부만 왔으면 평균가로 채운다
        krw *= qty / got
    return qty, krw, float(o["paid_fee"]), o["state"]


def load_state():
    if STATE.exists():
        st = json.loads(STATE.read_text())
    else:
        st = {"start": None, "last_run": None, "peak": BUDGET,
              "sleeves": {m: {"cash": BUDGET / len(MARKETS), "qty": 0.0, "target": 0.0} for m in MARKETS}}
    st.setdefault("budget", BUDGET)  # 넣은 돈 합계. --deposit / --withdraw 만 바꾼다
    st.setdefault("env_budget", BUDGET)  # 장부를 만들 때의 .env BUDGET. 손으로 바꿨는지 보려고 둔다
    return st


def save_state(st):
    """임시 파일에 쓰고 바꿔치기한다. 쓰는 중에 꺼져도 장부가 깨지지 않는다."""
    tmp = STATE.with_suffix(".tmp")
    with tmp.open("w") as f:
        f.write(json.dumps(st, ensure_ascii=False, indent=2))
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, STATE)


def append(path, header, row):
    new = not path.exists()
    with path.open("a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(header)
        w.writerow(row)


def mid(m):
    return fill(m, "buy", krw=1)[3]


def apply(st, m, p, qty, funds, fee, state):
    """체결 결과를 장부에 반영하고 거래 기록을 남긴다. p = 주문 기록."""
    s = st["sleeves"][m]
    sign = 1 if p["side"] == "매수" else -1
    s["qty"] = max(round(s["qty"] + sign * qty, 8), 0.0)
    s["cash"] -= sign * funds + fee
    avg = funds / qty if qty else 0
    if not (TRADES.exists() and p["id"] in TRADES.read_text()):  # 기록 직후 죽었다가 다시 반영해도 두 번 적지 않는다
        append(TRADES, TRADE_COLS, [p["at"], "실전" if LIVE else "드라이런", m, p["side"], p["reason"], p["prev"], p["target"], p["px_close"],
                                    p["mid"], round(avg, 1), round(qty, 8), round(funds), round(fee, 1), state, p["id"]])
    print(f"{'[실전]' if LIVE else '[드라이런]'} {m} {p['side']} {p['prev']:.2f}→{p['target']:.2f} {funds:,.0f}원 @ {avg:,.0f} ({state})")
    s["target"] = p["target"]
    s.pop("pending", None)
    save_state(st)


def settle(st, m, fresh=False):
    """sleeve 에 적어 둔 주문을 업비트에서 확인해 장부에 반영한다. 접수된 적 없는 주문이면 기록만 지운다."""
    s = st["sleeves"][m]
    p = s["pending"]
    try:
        qty, funds, fee, state = wait_done(p["id"])
    except Rejected as e:
        age = (datetime.now(KST) - datetime.fromisoformat(p["at"])).total_seconds()
        if e.code != 404 or fresh or age < 60:  # 방금 보낸 주문은 아직 조회가 안 될 수 있다
            raise
        print(f"{m} {p['at']} {p['side']} 주문은 업비트에 접수되지 않았다. 기록을 지우고 다시 판단한다.")
        del s["pending"]
        save_state(st)
        return
    if qty == 0:
        del s["pending"]
        save_state(st)
        raise RuntimeError(f"{m} {p['side']} 주문이 체결 없이 끝났다 ({state})")
    apply(st, m, p, qty, funds, fee, state)


def trade(st, m, target, px_close, now, reason):
    """sleeve 하나를 목표 비중으로 맞춘다. 실제 체결값으로 장부를 고친다."""
    s = st["sleeves"][m]
    s.pop("rebalance", None)
    price = mid(m)
    equity = s["cash"] + s["qty"] * price
    diff = equity * target - s["qty"] * price
    if abs(diff) < MIN_ORDER and target not in (0.0, 1.0):
        print(f"{m} 비중 {s['target']:.2f}→{target:.2f} 차이 {diff:,.0f}원, 최소 주문 미만이라 건너뜀")
        s["target"] = target
        return
    if diff > 0:
        krw = min(diff, s["cash"]) / (1 + FEE)
        if LIVE:
            have = balances().get("KRW", 0.0) / (1 + FEE)
            if have < krw:
                print(f"{m} 계좌 원화가 모자라 {krw:,.0f}원 중 {have:,.0f}원만 살 수 있다. 채워지면 다음 실행에서 마저 산다.")
                krw, s["rebalance"] = have, True
        if krw < MIN_ORDER:
            s["target"] = target
            return
        side, body = "매수", {"market": m, "side": "bid", "ord_type": "price", "price": str(int(krw))}
    else:
        qty = s["qty"] if target == 0 else min(s["qty"], -diff / price)
        if LIVE:
            qty = min(qty, balances().get(m.split("-")[1], 0.0))  # 사용자가 따로 옮긴 경우 대비
        qty = float(Decimal(str(qty)).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN))  # 올림되면 잔고를 넘는다
        if qty * price < MIN_ORDER:
            s["target"] = target
            return
        side, body = "매도", {"market": m, "side": "ask", "ord_type": "market", "volume": f"{qty:.8f}"}
    p = {"id": f"ct-{uuid.uuid4().hex}", "side": side, "reason": reason, "prev": s["target"], "target": target,
         "px_close": px_close, "mid": round(price), "at": datetime.now(KST).isoformat(timespec="seconds")}
    if not LIVE:
        _, got, funds, _ = fill(m, "buy", krw=krw) if side == "매수" else fill(m, "sell", qty=qty)
        apply(st, m, p, got, funds, funds * FEE, "dry-run")
        return
    s["pending"] = p
    save_state(st)  # 주문보다 먼저 적는다
    try:
        private("POST", "/v1/orders", {**body, "identifier": p["id"]})
    except Rejected:
        del s["pending"]  # 업비트가 거절했다 = 주문은 없다
        save_state(st)
        raise
    # 그 밖의 예외(응답 없음)는 주문이 들어갔는지 알 수 없다. 기록을 남긴 채 올려 보내고 다음 실행의 settle 이 확인한다
    settle(st, m, fresh=True)


def reconcile(st):
    """장부와 실제 계좌를 견준다. 계좌에는 사용자의 다른 돈도 있으니 장부보다 모자란지만 본다."""
    try:
        acc = {a["currency"]: float(a["balance"]) + float(a["locked"]) for a in private("GET", "/v1/accounts")}
    except Exception as e:
        notes = [f"계좌 조회 실패: {str(e)[:120]}"]
    else:
        notes = []
        cash = sum(s["cash"] for s in st["sleeves"].values())
        if acc.get("KRW", 0.0) + 100 < cash:
            notes.append(f"계좌 원화 {acc.get('KRW', 0.0):,.0f}원이 장부 현금 {cash:,.0f}원보다 적다")
        for m, s in st["sleeves"].items():
            have = acc.get(m.split("-")[1], 0.0)
            if have + 1e-8 < s["qty"]:
                notes.append(f"{m} 계좌 수량 {have:.8f} 이 장부 {s['qty']:.8f} 보다 적다")
    for n in notes:
        print("주의:", n)
    return notes


def run():
    DIR.mkdir(exist_ok=True)
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    mode = "실전" if LIVE else "드라이런"
    st = load_state()
    print(f"--- {now.isoformat(timespec='seconds')} {mode} 넣은 돈 {st['budget']:,.0f}원")
    if STOP.exists():
        print(f"STOP 파일이 있어 멈춤: {STOP.read_text().strip()}")
        return
    if LIVE and not CFG.get("UPBIT_ACCESS_KEY"):
        print(".env 에 UPBIT_ACCESS_KEY / UPBIT_SECRET_KEY 가 없다.")
        return
    if now.hour < 9 or st["last_run"] == today:
        print("09:00 이전이거나 오늘 이미 실행함. 건너뜀.")
        return
    failed = {}

    def fail(m):
        failed[m] = str(sys.exc_info()[1])[:200]
        print(f"{m} 실패: {failed[m]}")
        print(f"--- {now.isoformat(timespec='seconds')} {m}\n{traceback.format_exc()}", file=sys.stderr)

    # 지난 실행이 남긴 주문 기록부터 확인한다
    for m in MARKETS:
        if LIVE and st["sleeves"][m].get("pending"):
            try:
                settle(st, m)
            except Exception:
                fail(m)
    notes = reconcile(st) if LIVE else []

    # 손실 한도 확인
    value = sum(s["cash"] + s["qty"] * mid(m) for m, s in st["sleeves"].items())
    st["peak"] = max(st["peak"], value)
    halt = value < st["peak"] * (1 - HALT_DD)
    if halt:
        print(f"평가액 {value:,.0f}원이 최고점 {st['peak']:,.0f}원 대비 {HALT_DD*100:.0f}% 넘게 하락 → 전량 매도 후 정지")
    for m in MARKETS:
        s = st["sleeves"][m]
        if m in failed or s.get("done") == today:
            continue
        try:
            if halt:
                if s["qty"] > 0:
                    trade(st, m, 0.0, None, now, "손실 한도")
            else:
                _, px = closes(m)
                target = signal(px)
                if target != s["target"]:
                    trade(st, m, target, px[-1], now, "신호")
                elif s.get("rebalance"):
                    trade(st, m, target, px[-1], now, "비중 맞춤")
                else:
                    print(f"{m} 유지 비중 {target:.2f}")
            s["done"] = today
        except Exception:
            fail(m)
        save_state(st)
    if halt and not failed:
        STOP.write_text(f"{today} 손실 한도 {HALT_DD*100:.0f}% 도달. 원인 확인 후 이 파일을 지우면 재개.")

    total = 0.0
    for m, s in st["sleeves"].items():
        v = s["cash"] + s["qty"] * mid(m)
        append(EQUITY, ["날짜", "모드", "마켓", "비중", "평가액", "넣은돈"], [today, mode, m, s["target"], round(v), round(st["budget"])])
        total += v
    st["start"] = st["start"] or today
    if not failed:
        st["last_run"] = today
    st["peak"] = max(st["peak"], total)
    if BUDGET != st["env_budget"]:
        notes.append(f".env 의 BUDGET 을 {BUDGET:,.0f}원으로 바꿨지만 반영되지 않는다. 증액·감액은 --deposit / --withdraw 로 한다")
    st["check"] = {"at": now.isoformat(timespec="seconds"), "notes": notes + [f"{m} 실패: {e}" for m, e in failed.items()]}
    save_state(st)
    print(f"봇 평가액 {total:,.0f}원 (넣은 돈 대비 {(total/st['budget']-1)*100:+.2f}%)")
    if failed:
        print(f"실패한 마켓 {', '.join(failed)} 은 다음 실행에서 다시 한다.")
        sys.exit(1)


def flow(amount):
    """봇이 굴리는 돈을 늘리거나(+) 줄인다(-). 장부만 고치고, 매매는 다음 실행이 목표 비중에 맞춰 한다."""
    if not STATE.exists():
        print("아직 장부가 없다. 처음에는 .env 의 BUDGET 으로 시작한다.")
        return
    st = load_state()
    if any(s.get("pending") for s in st["sleeves"].values()):
        print("확인이 끝나지 않은 주문이 있다. 다음 실행이 끝난 뒤에 다시 한다.")
        return
    values = {m: s["cash"] + s["qty"] * mid(m) for m, s in st["sleeves"].items()}
    total = sum(values.values())
    if amount < 0 and total + amount < MIN_ORDER * len(MARKETS):
        print(f"봇 평가액이 {total:,.0f}원이라 {-amount:,.0f}원을 뺄 수 없다. 전부 빼려면 touch live/STOP 뒤 직접 판다.")
        return
    for m, s in st["sleeves"].items():
        # 넣을 때는 똑같이 나누고, 뺄 때는 주머니 크기에 비례해서 뺀다(한쪽이 바닥나지 않게)
        s["cash"] += amount / len(MARKETS) if amount > 0 or total <= 0 else amount * values[m] / total
        s["rebalance"] = True
        s.pop("done", None)
    st["peak"] = st["peak"] * (total + amount) / total if total > 0 else total + amount  # 최고점 대비 낙폭 비율은 그대로 둔다
    st["budget"] += amount
    st["last_run"] = None  # 다음 실행(13:07·21:07·내일 09:07 중 가장 가까운 때)이 비중을 맞춘다
    now = datetime.now(KST)
    append(FLOWS, ["시각", "금액", "넣은돈_합계", "직전_평가액"], [now.isoformat(timespec="seconds"), round(amount), round(st["budget"]), round(total)])
    save_state(st)
    cash = sum(s["cash"] for s in st["sleeves"].values())
    print(f"{'입금' if amount > 0 else '출금'} {abs(amount):,.0f}원 반영. 넣은 돈 {st['budget']:,.0f}원, 봇 평가액 {total + amount:,.0f}원, 장부 현금 {cash:,.0f}원.")
    if amount > 0:
        print("업비트 계좌에 그만큼 원화가 있어야 한다. 다음 실행 때 목표 비중에 맞춰 산다.")
        if LIVE and CFG.get("UPBIT_ACCESS_KEY"):
            reconcile(st)
    elif min(s["cash"] for s in st["sleeves"].values()) < 0:
        print("현금이 모자라 다음 실행 때 코인을 팔아 채운다. 그 실행이 끝난 뒤에 업비트에서 꺼낸다.")
    else:
        print("장부 현금에서 뺐다. 업비트에서 바로 꺼내도 된다.")


def check():
    st = load_state()
    print(f"모드 {'실전(LIVE=1)' if LIVE else '드라이런(LIVE=0)'}, 넣은 돈 {st['budget']:,.0f}원, 손실 한도 {HALT_DD*100:.0f}%")
    if not CFG.get("UPBIT_ACCESS_KEY"):
        print(".env 에 키가 없다. 드라이런은 키 없이도 돈다.")
        return
    bal = balances()
    print("계좌 잔고:", {k: v for k, v in bal.items() if v > 0})
    if not reconcile(st):
        print("장부와 계좌: 맞음")
    for m, s in st["sleeves"].items():
        if s.get("pending"):
            print(f"확인 안 된 주문: {m} {s['pending']['at']} {s['pending']['side']} — 다음 실행이 업비트에 물어 정리한다")
    probe = f"ct-check-{uuid.uuid4().hex}"
    try:
        private("POST", "/v1/orders/test", {"market": MARKETS[0], "side": "bid", "ord_type": "price", "price": str(MIN_ORDER), "identifier": probe})
        print("주문 권한·서명: 정상 (테스트 주문이라 실제 주문은 만들어지지 않는다)")
    except Rejected as e:
        if "insufficient_funds" in str(e):
            print("주문 권한·서명: 정상 (원화가 최소 주문 금액보다 적어 금액 검증에서만 걸렸다)")
        else:
            print("주문 테스트 거절:", e)
    try:
        private("GET", "/v1/order", {"identifier": probe})
    except Rejected as e:  # 없는 번호라 404 가 정상. 권한이 없으면 다른 오류가 온다
        print("주문 조회 권한: 정상" if e.code == 404 else f"주문 조회 거절: {e}")
    if STOP.exists():
        print("STOP 파일 있음:", STOP.read_text().strip())


def history():
    """날짜별 (날짜, 평가액, 넣은 돈, 지수). 지수는 입출금을 뺀 수익만 따라간다(넣은 돈 = 100 에서 시작)."""
    days = {}
    for r in csv.DictReader(EQUITY.open()) if EQUITY.exists() else []:
        days.setdefault(r["날짜"], {})[r["마켓"]] = r  # 같은 날 여러 번 돌았으면 마지막 값
    out, idx = [], 100.0
    for d in sorted(days):
        v = sum(float(r["평가액"]) for r in days[d].values())
        b = float(next(iter(days[d].values())).get("넣은돈") or BUDGET)
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
    print(f"{h[0][0]} ~ {d} ({len(h)}일)  평가액 {v:,.0f}원, 넣은 돈 {b:,.0f}원 ({(v/b-1)*100:+.2f}%), 입출금 뺀 수익 {idx-100:+.2f}%, 최대 하락 {mdd*100:.1f}%")
    if TRADES.exists():
        print(f"거래 {sum(1 for _ in csv.DictReader(TRADES.open()))}회")


if __name__ == "__main__":
    args = sys.argv[1:]
    cmd = next((a for a in args if a.startswith("--")), "")
    if cmd in ("--deposit", "--withdraw"):
        try:
            amount = float(args[args.index(cmd) + 1].replace(",", ""))
            assert amount > 0
        except (IndexError, ValueError, AssertionError):
            sys.exit(f"사용법: python3 scripts/live.py {cmd} 금액(원)")
        flow(amount if cmd == "--deposit" else -amount)
    else:
        {"--check": check, "--report": report}.get(cmd, run)()
