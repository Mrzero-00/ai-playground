"""live.py 주문 경로 시험. 가짜 거래소를 붙여 돌리므로 실제 주문은 나가지 않는다.
사용법: python3 scripts/test_live.py
"""
import csv, json, tempfile
from datetime import datetime, timedelta
from pathlib import Path

import live, paper

KST = paper.KST
BTC, ETH = "KRW-BTC", "KRW-ETH"
REAL_CLOSES4H, REAL_SIGNAL4H, REAL_ATR20 = live.closes4h, live.signal4h, live.atr20  # Bot 이 가짜로 바꾸기 전의 진짜 함수


class Clock(datetime):
    t = None

    @classmethod
    def now(cls, tz=None):
        return cls.t


class Upbit:
    """시장가 주문을 그 자리에서 전부 체결하는 가짜 거래소."""

    def __init__(self, krw):
        self.bal = {"KRW": krw, "BTC": 0.0, "ETH": 0.0}
        self.px = {BTC: 100_000_000.0, ETH: 4_000_000.0}
        self.orders = {}  # identifier → 주문
        self.posts = []  # 실제로 접수된 주문 요청
        self.fault = {}  # 마켓 → "reject" | "lost"(접수 안 됨) | "timeout"(접수됐지만 응답 없음)

    def __call__(self, method, path, params=None):
        if path == "/v1/accounts":
            return [{"currency": c, "balance": str(v), "locked": "0"} for c, v in self.bal.items()]
        if path == "/v1/order":
            if params["identifier"] not in self.orders:
                raise live.Rejected("GET /v1/order 404: order_not_found", 404)
            return self.orders[params["identifier"]]
        assert method == "POST" and path == "/v1/orders", (method, path)
        m, coin = params["market"], params["market"].split("-")[1]
        fault = self.fault.pop(m, None)
        if fault == "reject":
            raise live.Rejected("POST /v1/orders 400: invalid_parameter", 400)
        if fault == "lost":
            raise RuntimeError("POST /v1/orders 응답 없음: timed out")
        assert params["identifier"] not in self.orders, "identifier 를 다시 썼다"
        if params["side"] == "bid":
            funds = float(params["price"])
            qty, fee = round(funds / self.px[m], 8), funds * 0.0005
            assert self.bal["KRW"] >= funds + fee - 1e-6, "거래소 원화 부족"
            self.bal["KRW"] -= funds + fee
            self.bal[coin] += qty
            state = "cancel"
        else:
            qty = float(params["volume"])
            assert self.bal[coin] >= qty - 1e-12, "거래소 코인 부족"
            funds, fee = qty * self.px[m], qty * self.px[m] * 0.0005
            self.bal[coin] -= qty
            self.bal["KRW"] += funds - fee
            state = "done"
        self.orders[params["identifier"]] = {"state": state, "executed_volume": str(qty), "paid_fee": str(fee), "trades_count": 1,
                                             "trades": [{"volume": str(qty), "funds": str(funds)}]}
        self.posts.append(params)
        if fault == "timeout":
            raise RuntimeError("POST /v1/orders 응답 없음: timed out")
        return {"uuid": "u"}

    def count(self, m, side=None):
        return sum(p["market"] == m and side in (None, p["side"]) for p in self.posts)


class Bot:
    """임시 폴더의 장부와 가짜 거래소로 live.run() 을 하루씩 돌린다."""

    def __init__(self, krw=1_000_000, budget=200_000):
        self.ex = Upbit(krw)
        self.target = {BTC: 0.0, ETH: 0.0}
        self.target4 = {BTC: 0.0, ETH: 0.0}  # 4시간봉으로 본 비중 (장중 확인)
        self.before = {}  # 전날의 일 단위 비중 (없으면 오늘과 같다) — 손절 뒤 다시 살지 볼 때 쓴다
        self.atr = {BTC: 5_000_000.0, ETH: 200_000.0}  # 손절선 = 평균 매수가 − 2 × ATR
        self.broken = set()  # 시세 조회가 실패하는 마켓
        self.broken4 = set()  # 4시간봉 조회가 실패하는 마켓
        self.broken_atr = set()  # ATR 용 일봉 조회가 실패하는 마켓
        d = Path(tempfile.mkdtemp())
        live.DIR, live.STATE, live.TRADES, live.EQUITY, live.STOP, live.FLOWS = d, d / "state.json", d / "trades.csv", d / "equity.csv", d / "STOP", d / "flows.csv"
        live.CFG["UPBIT_ACCESS_KEY"] = live.CFG["UPBIT_SECRET_KEY"] = "dummy"  # 혹시 새어 나가도 인증에서 막힌다
        live.LIVE, live.BUDGET, live.HALT_DD = True, float(budget), 0.45
        live.private = self.ex
        live.fill = lambda m, side, krw=None, qty=None: (self.ex.px[m], qty or krw / self.ex.px[m], krw or qty * self.ex.px[m], self.ex.px[m])
        live.closes = self.closes
        live.signal = lambda px: px[-1]
        live.atr20 = self.atr20
        live.closes4h = self.closes4h
        live.signal4h = lambda px: px[0]
        live.time.sleep = lambda s: None
        live.datetime = Clock
        Clock.t = datetime(2026, 12, 1, 9, 7, tzinfo=KST)

    def closes(self, m):
        if m in self.broken:
            raise OSError("시세 조회 실패 (가정)")
        return ["그제", "어제"], [self.before.get(m, self.target[m]), self.target[m]]

    def atr20(self, m):
        if m in self.broken_atr:
            raise OSError("일봉 조회 실패 (가정)")
        return self.atr[m]

    def closes4h(self, m):
        if m in self.broken4:
            raise OSError("4시간봉 조회 실패 (가정)")
        return ["방금"], [self.target4[m]]

    def run(self, next_day=True, hours=0):
        Clock.t += timedelta(days=1) if next_day else timedelta(hours=hours)
        try:
            live.run()
        except SystemExit:
            pass
        return self.st

    @property
    def st(self):
        return json.loads(live.STATE.read_text())

    def matches(self):
        """장부의 코인 수량과 현금 변화가 거래소와 같은가 (봇만 쓰는 계좌라고 가정)."""
        s = self.st["sleeves"]
        assert abs(s[BTC]["qty"] - self.ex.bal["BTC"]) < 1e-8 and abs(s[ETH]["qty"] - self.ex.bal["ETH"]) < 1e-8, (s, self.ex.bal)
        spent = self.start_krw - self.ex.bal["KRW"]
        assert abs((self.st["budget"] - s[BTC]["cash"] - s[ETH]["cash"]) - spent) < 1, (s, self.ex.bal)

    start_krw = 1_000_000


def test_buy_and_sell():
    b = Bot()
    b.target = {BTC: 0.5, ETH: 1.0}
    st = b.run()
    assert b.ex.count(BTC) == b.ex.count(ETH) == 1 and st["last_run"] == "2026-12-02" and st["check"]["notes"] == []
    b.matches()
    b.target = {BTC: 0.0, ETH: 0.0}
    st = b.run()
    assert st["sleeves"][BTC]["qty"] == st["sleeves"][ETH]["qty"] == 0 and b.ex.bal["BTC"] == b.ex.bal["ETH"] == 0
    b.matches()
    assert len(list(csv.DictReader(live.TRADES.open()))) == 4


def test_dry_run_sends_nothing():
    b = Bot()
    live.LIVE = False
    b.target = {BTC: 0.5, ETH: 0.0}
    st = b.run()
    assert b.ex.posts == [] and st["sleeves"][BTC]["qty"] > 0 and st["sleeves"][BTC]["target"] == 0.5
    assert [r["모드"] for r in csv.DictReader(live.TRADES.open())] == ["드라이런"]


def test_no_duplicate_after_crash():
    """BTC 를 산 뒤 ETH 시세 조회가 실패해도, 재시도에서 BTC 를 또 사지 않는다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.5}
    b.broken = {ETH}
    st = b.run()
    assert b.ex.count(BTC) == 1 and b.ex.count(ETH) == 0 and st["last_run"] != "2026-12-02" and "KRW-ETH 실패" in st["check"]["notes"][0]
    b.broken = set()
    st = b.run(next_day=False, hours=4)
    assert b.ex.count(BTC) == 1 and b.ex.count(ETH) == 1 and st["last_run"] == "2026-12-02"
    b.matches()


def test_one_market_failure_does_not_block_the_other():
    """BTC 주문이 거절돼도 ETH 매도는 나간다."""
    b = Bot()
    b.target = {BTC: 0.0, ETH: 1.0}
    b.run()
    b.target = {BTC: 1.0, ETH: 0.0}
    b.ex.fault[BTC] = "reject"
    st = b.run()
    assert b.ex.count(ETH, "ask") == 1 and b.ex.count(BTC) == 0 and "pending" not in st["sleeves"][BTC]
    st = b.run(next_day=False, hours=4)  # 재시도에서 BTC 를 산다
    assert b.ex.count(BTC, "bid") == 1 and st["last_run"] == "2026-12-03"
    b.matches()


def test_response_lost_but_order_placed():
    """주문은 접수됐는데 응답을 못 받았다 → 다음 실행이 주문 번호로 찾아 장부에 넣고, 다시 주문하지 않는다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.5}
    b.ex.fault[BTC] = "timeout"
    st = b.run()
    assert st["sleeves"][BTC]["pending"] and st["sleeves"][BTC]["qty"] == 0 and b.ex.count(ETH) == 1
    st = b.run(next_day=False, hours=4)
    assert b.ex.count(BTC) == 1 and "pending" not in st["sleeves"][BTC] and st["sleeves"][BTC]["target"] == 0.5
    b.matches()
    assert len(list(csv.DictReader(live.TRADES.open()))) == 2


def test_response_lost_and_order_not_placed():
    """주문이 접수되지 않았다 → 조금 뒤 기록을 지우고 새 번호로 다시 주문한다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.0}
    b.ex.fault[BTC] = "lost"
    st = b.run()
    first = st["sleeves"][BTC]["pending"]["id"]
    st = b.run(next_day=False, hours=0)  # 곧바로 다시 돌면 아직 판단하지 않는다
    assert st["sleeves"][BTC]["pending"]["id"] == first and b.ex.count(BTC) == 0
    st = b.run(next_day=False, hours=4)
    assert b.ex.count(BTC) == 1 and "pending" not in st["sleeves"][BTC]
    b.matches()


def test_krw_shortage_buys_what_it_can_then_tops_up():
    b = Bot(krw=30_000)
    b.start_krw = 30_000
    b.target = {BTC: 1.0, ETH: 0.0}
    st = b.run()
    assert b.ex.count(BTC) == 1 and st["sleeves"][BTC]["rebalance"] and "계좌 원화" in st["check"]["notes"][0]
    assert 29_000 < st["sleeves"][BTC]["qty"] * b.ex.px[BTC] < 30_000
    b.ex.bal["KRW"] += 200_000
    b.start_krw += 200_000
    st = b.run()
    assert b.ex.count(BTC) == 2 and "rebalance" not in st["sleeves"][BTC] and st["sleeves"][BTC]["cash"] < 100
    b.matches()
    assert [r["사유"] for r in csv.DictReader(live.TRADES.open())] == ["신호", "비중 맞춤"]


def test_sell_only_what_the_account_has():
    b = Bot()
    b.target = {BTC: 1.0, ETH: 0.0}
    b.run()
    b.ex.bal["BTC"] /= 2  # 사용자가 절반을 따로 팔았다
    b.target = {BTC: 0.0, ETH: 0.0}
    st = b.run()
    assert b.ex.bal["BTC"] < 1e-8 and b.ex.count(BTC, "ask") == 1 and any("계좌 수량" in n for n in st["check"]["notes"])


def test_deposit_and_withdraw():
    b = Bot()
    b.target = {BTC: 0.5, ETH: 1.0}
    b.run()
    before = live.history()[-1]
    live.flow(300_000)
    st = b.st
    assert st["budget"] == 500_000 and st["last_run"] is None and abs(st["peak"] / 500_000 - 1) < 0.01
    st = b.run(next_day=False, hours=4)  # 같은 날 재실행이 비중을 맞춘다
    eq = {m: s["cash"] + s["qty"] * b.ex.px[m] for m, s in st["sleeves"].items()}
    assert abs(st["sleeves"][BTC]["qty"] * b.ex.px[BTC] / eq[BTC] - 0.5) < 0.01 and st["sleeves"][ETH]["cash"] < 100
    b.matches()
    after = live.history()[-1]
    assert after[2] == 500_000 and abs(after[3] / before[3] - 1) < 0.002, (before, after)  # 입금은 수익이 아니다

    live.flow(-200_000)
    st = b.st
    assert st["budget"] == 300_000 and st["sleeves"][ETH]["cash"] < 0
    st = b.run()
    assert st["sleeves"][ETH]["cash"] > -100 and not live.STOP.exists()  # 팔아서 채웠고, 출금을 폭락으로 보지 않는다
    b.matches()
    assert abs(live.history()[-1][3] / after[3] - 1) < 0.002
    assert len(list(csv.DictReader(live.FLOWS.open()))) == 2


def test_halt_on_drawdown():
    b = Bot()
    b.target = {BTC: 1.0, ETH: 1.0}
    b.run()
    b.ex.px = {m: p * 0.5 for m, p in b.ex.px.items()}
    b.ex.fault[ETH] = "reject"
    st = b.run()
    assert b.ex.count(BTC, "ask") == 1 and not live.STOP.exists()  # 다 팔기 전에는 정지 표시를 하지 않는다
    st = b.run(next_day=False, hours=4)
    assert b.ex.count(ETH, "ask") == 1 and live.STOP.exists() and st["sleeves"][ETH]["qty"] == 0
    b.matches()


def test_intraday_buys_but_never_sells():
    """하루 몫 뒤 4시간 확인: 4시간봉 비중이 더 높으면 사고, 낮으면 그대로 둔다. 같은 칸에서는 한 번만. 다음 09:07 이 다시 맞춘다."""
    b = Bot()
    b.target = {BTC: 0.25, ETH: 0.5}
    b.run()  # 12-02 09:07 하루 몫
    b.target4 = {BTC: 0.75, ETH: 0.0}
    st = b.run(next_day=False, hours=4)  # 13:07
    assert b.ex.count(BTC, "bid") == 2 and b.ex.count(ETH) == 1 and b.ex.count(ETH, "ask") == 0
    assert st["sleeves"][BTC]["target"] == 0.75 and st["sleeves"][ETH]["target"] == 0.5 and st["intraday"] == "2026-12-02 13"
    b.matches()
    assert [r["사유"] for r in csv.DictReader(live.TRADES.open())] == ["신호", "신호", "장중 매수"]
    b.target4 = {BTC: 1.0, ETH: 1.0}
    b.run(next_day=False, hours=0)  # 같은 칸에서 또 돌아도 주문 없음
    assert b.ex.count(BTC) == 2 and b.ex.count(ETH) == 1
    st = b.run(next_day=False, hours=12)  # 01:07 — 날짜는 넘어갔지만 같은 매매일
    assert st["intraday"] == "2026-12-03 01" and st["sleeves"][BTC]["target"] == st["sleeves"][ETH]["target"] == 1.0
    b.matches()
    st = b.run(next_day=False, hours=8)  # 12-03 09:07 하루 몫: 일봉 신호대로 다시 줄인다
    assert st["last_run"] == "2026-12-03" and st["sleeves"][BTC]["target"] == 0.25 and st["sleeves"][ETH]["target"] == 0.5
    assert b.ex.count(BTC, "ask") == 1 and b.ex.count(ETH, "ask") == 1
    b.matches()
    b.run(next_day=False, hours=1)  # 10:07 은 09시 칸 — 장중 확인을 하지 않는다
    assert b.ex.count(BTC, "bid") == 3 and b.ex.count(ETH, "bid") == 2


def test_intraday_waits_for_the_daily_run():
    """하루 몫이 끝나지 않았으면 장중 확인을 하지 않는다. 09:00 뒤의 실행은 하루 몫을 다시 한다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.5}
    b.target4 = {BTC: 1.0, ETH: 1.0}
    b.broken = {ETH}
    st = b.run()  # 12-02 09:07: ETH 실패
    assert st["last_run"] != "2026-12-02"
    st = b.run(next_day=False, hours=16)  # 12-03 01:07: 전날 몫이 안 끝났다
    assert b.ex.count(BTC) == 1 and b.ex.count(ETH) == 0 and "intraday" not in st
    b.broken = set()
    st = b.run(next_day=False, hours=12)  # 12-03 13:07: 장중 확인이 아니라 하루 몫
    assert st["last_run"] == "2026-12-03" and st["sleeves"][ETH]["target"] == 0.5 and "intraday" not in st
    assert b.ex.count(BTC) == 1 and b.ex.count(ETH) == 1
    st = b.run(next_day=False, hours=4)  # 17:07: 이제 장중 확인
    assert st["intraday"] == "2026-12-03 17" and st["sleeves"][BTC]["target"] == 1.0
    b.matches()


def test_intraday_failure_is_noted_and_orders_nothing():
    """4시간봉을 못 받은 마켓은 사지 않고 상태 줄에 남긴다. 다른 마켓은 처리하고, 다음 칸에서 다시 본다."""
    b = Bot()
    b.target = {BTC: 0.25, ETH: 0.25}
    b.run()
    b.target4 = {BTC: 1.0, ETH: 1.0}
    b.broken4 = {BTC}
    st = b.run(next_day=False, hours=4)
    assert b.ex.count(BTC) == 1 and b.ex.count(ETH) == 2 and any("KRW-BTC 실패(장중)" in n for n in st["check"]["notes"])
    b.broken4 = set()
    st = b.run(next_day=False, hours=4)  # 17:07
    assert b.ex.count(BTC) == 2 and st["check"]["notes"] == []
    b.matches()


def test_intraday_off_switch_and_stop():
    b = Bot()
    b.target = {BTC: 0.25, ETH: 0.25}
    b.run()
    b.target4 = {BTC: 1.0, ETH: 1.0}
    (live.DIR / "NO_INTRADAY").write_text("")
    st = b.run(next_day=False, hours=4)
    assert b.ex.count(BTC) == 1 and "intraday" not in st
    (live.DIR / "NO_INTRADAY").unlink()
    live.STOP.write_text("정지")
    b.run(next_day=False, hours=4)
    assert b.ex.count(BTC) == 1 and b.ex.count(ETH) == 1


def test_intraday_skips_late_wakeup():
    """칸이 시작한 지 1시간이 넘은 뒤에 돈 실행(잠자기에서 늦게 깸)은 사지 않고, 다음 칸에서 본다."""
    b = Bot()
    b.target = {BTC: 0.25, ETH: 0.25}
    b.run()
    b.target4 = {BTC: 1.0, ETH: 1.0}
    st = b.run(next_day=False, hours=5.5)  # 14:37 — 13시 칸이 시작한 지 1시간 37분
    assert b.ex.count(BTC) == 1 and "intraday" not in st
    st = b.run(next_day=False, hours=2.5)  # 17:07
    assert b.ex.count(BTC) == 2 and st["intraday"] == "2026-12-02 17"
    b.matches()


def test_intraday_no_buy_at_loss_limit():
    """손실 한도에 닿았으면 장중에는 사지 않는다(전량 매도·정지는 다음 09:07 이 한다). 손절로 파는 것은 막지 않는다."""
    b = Bot()
    b.target = {BTC: 1.0, ETH: 0.5}
    b.run()
    b.ex.px = {m: p * 0.2 for m, p in b.ex.px.items()}
    b.target4 = {BTC: 1.0, ETH: 1.0}
    (live.DIR / "NO_STOPLOSS").write_text("")
    b.run(next_day=False, hours=4)  # 13:07 손절을 꺼 두면 아무 주문도 없다
    assert b.ex.count(ETH) == 1 and b.ex.count(BTC) == 1 and not live.STOP.exists()
    (live.DIR / "NO_STOPLOSS").unlink()
    b.run(next_day=False, hours=4)  # 17:07 손절은 팔고, 사지는 않는다
    assert b.ex.count(ETH, "bid") == 1 and b.ex.count(ETH, "ask") == 1 and b.ex.count(BTC, "ask") == 1 and not live.STOP.exists()
    b.matches()


def test_intraday_response_lost_is_settled_not_repeated():
    """장중 주문의 응답을 못 받았다 → 다음 실행이 주문 번호로 찾아 장부에 넣고, 같은 주문을 다시 내지 않는다."""
    b = Bot()
    b.target = {BTC: 0.25, ETH: 0.25}
    b.run()
    b.target4 = {BTC: 0.75, ETH: 0.0}
    b.ex.fault[BTC] = "timeout"
    st = b.run(next_day=False, hours=4)
    assert st["sleeves"][BTC]["pending"] and b.ex.count(BTC) == 2
    st = b.run(next_day=False, hours=4)  # 17:07
    assert "pending" not in st["sleeves"][BTC] and st["sleeves"][BTC]["target"] == 0.75 and b.ex.count(BTC) == 2
    b.matches()


def test_stop_loss_sells_all_then_waits_for_a_new_buy_signal():
    """가격 ≤ 평균 매수가 − 2 × ATR 이면 그 코인을 전부 판다. 그 뒤로는 장중에도 하루 몫에도 사지 않다가, 일 단위 비중이 전날보다 높아지는 날 다시 산다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.5}
    st = b.run()  # 12-02 09:07 매수. BTC 평균 매수가 1억, ATR 500만 → 손절선 9,000만
    assert abs(st["sleeves"][BTC]["avg"] - 100_000_000) < 1
    b.ex.px[BTC] = 90_000_001.0
    b.run(next_day=False, hours=0.5)  # 09:37 손절선 바로 위 — 유지
    assert b.ex.count(BTC, "ask") == 0
    b.ex.px[BTC] = 89_999_999.0
    st = b.run(next_day=False, hours=0.5)  # 10:07 손절선 아래 → BTC 만 전부 판다
    s = st["sleeves"][BTC]
    assert b.ex.count(BTC, "ask") == 1 and b.ex.count(ETH, "ask") == 0 and s["qty"] == 0 and s["target"] == 0 and s["stopped"] and "avg" not in s
    assert [r["사유"] for r in csv.DictReader(live.TRADES.open())][-1] == "손절"
    b.matches()
    b.target4 = {BTC: 1.0, ETH: 0.5}
    st = b.run(next_day=False, hours=3)  # 13:07 4시간봉 비중이 높아도 쉬는 마켓은 사지 않는다
    assert b.ex.count(BTC, "bid") == 1 and st["intraday"] == "2026-12-02 13"
    st = b.run(next_day=False, hours=20)  # 12-03 09:07 일 단위 비중이 전날과 같다 → 계속 쉰다
    s = st["sleeves"][BTC]
    assert b.ex.count(BTC, "bid") == 1 and st["last_run"] == "2026-12-03" and s["stopped"] and s["target"] == 0 and s["done"] == "2026-12-03"
    b.before, b.target = {BTC: 0.5}, {BTC: 0.25, ETH: 0.5}
    st = b.run()  # 12-04 비중이 줄었다 → 계속 쉰다
    assert b.ex.count(BTC, "bid") == 1 and st["sleeves"][BTC]["stopped"]
    b.before, b.target = {BTC: 0.25}, {BTC: 0.5, ETH: 0.5}
    st = b.run()  # 12-05 비중이 전날보다 늘었다 → 다시 산다. 평균 매수가는 새로 잡는다
    s = st["sleeves"][BTC]
    assert b.ex.count(BTC, "bid") == 2 and "stopped" not in s and s["target"] == 0.5 and abs(s["avg"] / 89_999_999 - 1) < 1e-4  # 가짜 거래소가 수량을 8자리로 끊어 조금 어긋난다
    b.matches()


def test_average_entry_price_follows_buys_only():
    """평균 매수가: 살 때마다 수량 가중 평균, 일부만 팔면 그대로, 다 팔면 지운다. 09:07 하루 몫 실행은 손절을 보지 않는다."""
    b = Bot()
    b.target = {BTC: 0.25, ETH: 0.0}
    b.run()  # 1억에 산다
    b.ex.px[BTC] = 120_000_000.0
    b.target4 = {BTC: 0.75, ETH: 0.0}
    st = b.run(next_day=False, hours=4)  # 13:07 장중 매수는 1.2억에
    s = st["sleeves"][BTC]
    cost = sum(float(r["원화"]) for r in csv.DictReader(live.TRADES.open()))
    assert abs(s["avg"] / (cost / s["qty"]) - 1) < 1e-4 and 100_000_000 < s["avg"] < 120_000_000
    avg = s["avg"]
    b.ex.px[BTC] = 80_000_000.0  # 손절선(평균 매수가 − 1,000만)보다 한참 아래지만 09:07 은 하루 몫 차례다
    b.target = {BTC: 0.5, ETH: 0.0}
    st = b.run(next_day=False, hours=20)  # 12-03 09:07 일 단위 비중대로 일부만 판다 — 손절이 아니다
    s = st["sleeves"][BTC]
    assert s["avg"] == avg and "stopped" not in s and s["qty"] > 0 and [r["사유"] for r in csv.DictReader(live.TRADES.open())][-1] == "신호"
    st = b.run(next_day=False, hours=0.5)  # 09:37 이제 손절을 본다
    s = st["sleeves"][BTC]
    assert s["qty"] == 0 and "avg" not in s and s["stopped"] and [r["사유"] for r in csv.DictReader(live.TRADES.open())][-1] == "손절"
    b.matches()


def test_stop_loss_response_lost_is_settled_and_still_rests():
    """손절 주문의 응답을 못 받았다 → 다음 실행이 주문 번호로 찾아 반영한다. 다시 팔지 않고, 쉬는 표시도 남는다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.0}
    b.run()
    b.ex.px[BTC] = 80_000_000.0
    b.ex.fault[BTC] = "timeout"
    st = b.run(next_day=False, hours=0.5)
    s = st["sleeves"][BTC]
    assert s["pending"]["reason"] == "손절" and b.ex.count(BTC, "ask") == 1 and "stopped" not in s
    st = b.run(next_day=False, hours=0.5)
    s = st["sleeves"][BTC]
    assert "pending" not in s and s["qty"] == 0 and s["stopped"] and b.ex.count(BTC, "ask") == 1
    b.matches()


def test_stop_check_failure_is_noted_and_checked_again():
    """ATR 을 못 받은 마켓은 팔지 않고 상태 줄에 남긴다. 다른 마켓은 처리하고, 30분 뒤에 다시 본다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.5}
    b.run()
    b.ex.px = {BTC: 80_000_000.0, ETH: 3_000_000.0}
    b.broken_atr = {BTC}
    st = b.run(next_day=False, hours=0.5)
    assert b.ex.count(BTC, "ask") == 0 and b.ex.count(ETH, "ask") == 1 and any("KRW-BTC 실패(장중)" in n for n in st["check"]["notes"])
    b.broken_atr = set()
    st = b.run(next_day=False, hours=0.5)
    assert b.ex.count(BTC, "ask") == 1 and st["check"]["notes"] == []
    b.matches()


def test_stop_loss_off_switch():
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.0}
    b.run()
    b.ex.px[BTC] = 80_000_000.0
    (live.DIR / "NO_STOPLOSS").write_text("")
    b.run(next_day=False, hours=0.5)
    assert b.ex.count(BTC, "ask") == 0
    (live.DIR / "NO_STOPLOSS").unlink()
    live.STOP.write_text("정지")
    b.run(next_day=False, hours=0.5)
    assert b.ex.count(BTC, "ask") == 0
    live.STOP.unlink()
    b.run(next_day=False, hours=0.5)
    assert b.ex.count(BTC, "ask") == 1


def test_idle_runs_ask_for_nothing():
    """가진 코인이 없고 살 차례도 아니면 ATR·계좌를 부르지 않고 장부도 그대로 둔다."""
    b = Bot()
    b.run()  # 비중 0

    def boom(*a, **k):
        raise AssertionError("할 일이 없는 실행이 거래소를 불렀다")

    live.atr20 = live.private = live.fill = boom
    before = live.STATE.read_text()
    b.run(next_day=False, hours=0.5)  # 09:37
    b.run(next_day=False, hours=0.5)  # 10:07
    assert live.STATE.read_text() == before


def test_dry_run_stop_loss_sends_nothing():
    b = Bot()
    live.LIVE = False
    b.target = {BTC: 0.5, ETH: 0.0}
    b.run()
    b.ex.px[BTC] = 80_000_000.0
    st = b.run(next_day=False, hours=0.5)
    assert b.ex.posts == [] and st["sleeves"][BTC]["qty"] == 0 and st["sleeves"][BTC]["stopped"]
    assert [r["사유"] for r in csv.DictReader(live.TRADES.open())] == ["신호", "손절"]


def test_daily_run_is_tried_once_per_4h_slot():
    """하루 몫이 실패하면 같은 4시간 칸의 다음 실행(30분 뒤)은 다시 하지 않고, 다음 칸의 첫 실행이 다시 한다. 그 사이에도 손절은 본다."""
    b = Bot()
    b.target = {BTC: 0.5, ETH: 0.5}
    b.broken = {ETH}
    b.run()  # 12-02 09:07 BTC 는 사고 ETH 는 실패
    b.broken = set()
    st = b.run(next_day=False, hours=0.5)  # 09:37 하루 몫을 다시 하지 않는다
    assert b.ex.count(ETH) == 0 and st["last_run"] != "2026-12-02"
    b.ex.px[BTC] = 80_000_000.0
    st = b.run(next_day=False, hours=0.5)  # 10:07 하루 몫이 안 끝났어도 손절은 본다
    assert b.ex.count(BTC, "ask") == 1 and st["sleeves"][BTC]["stopped"] and b.ex.count(ETH) == 0
    st = b.run(next_day=False, hours=3)  # 13:07 다음 칸의 첫 실행이 하루 몫을 다시 한다
    assert st["last_run"] == "2026-12-02" and b.ex.count(ETH, "bid") == 1 and b.ex.count(BTC, "bid") == 1
    b.matches()


def test_atr20_is_wilder_average_of_closed_daily_bars():
    """ATR: 진행 중인 일봉은 빼고, 마감 봉의 참 범위를 와일더 방식(앞 값 + (참 범위 − 앞 값) ÷ 20)으로 평균한다."""
    real_get, real_dt = live.get, live.datetime
    live.datetime = Clock
    Clock.t = datetime(2026, 12, 2, 13, 7, tzinfo=KST)

    def candles(n):  # 새 것부터. 12-02 봉은 진행 중, 12-01 봉만 고가가 높다
        return [{"candle_date_time_kst": (datetime(2026, 12, 2) - timedelta(days=i)).strftime("%Y-%m-%dT09:00:00"),
                 "high_price": 150.0 if i == 1 else 999.0 if i == 0 else 110.0, "low_price": 100.0, "trade_price": 105.0} for i in range(n)]

    try:
        live.get = lambda url: candles(200)
        assert abs(REAL_ATR20(BTC) - 12.0) < 1e-9  # 참 범위가 줄곧 10 이다가 마지막 마감 봉만 50 → 10 + (50 − 10) ÷ 20
        live.get = lambda url: candles(50)
        try:
            REAL_ATR20(BTC)
            raise AssertionError("예외가 나야 한다")
        except RuntimeError as e:
            assert "ATR" in str(e)
    finally:
        live.get, live.datetime = real_get, real_dt


def test_slot_and_4h_signal():
    """4시간 칸(01·05·09·13·17·21시)과 4시간봉 신호(120·300·600·1200개 평균)."""
    slot = lambda h, mi: live.slot_of(datetime(2026, 12, 2, h, mi, tzinfo=KST))[0]
    assert slot(13, 7) == "2026-12-02 13" and slot(12, 59) == "2026-12-02 09" and slot(0, 30) == "2026-12-01 21" and slot(1, 0) == "2026-12-02 01"
    assert REAL_SIGNAL4H([1.0] * 1199 + [2.0]) == 1.0 and REAL_SIGNAL4H([2.0] * 1199 + [1.0]) == 0.0
    assert REAL_SIGNAL4H([100.0] * 1080 + [10.0] * 119 + [20.0]) == 0.25  # 120개 평균(10.08)만 넘는다


def test_stale_4h_candles_raise():
    """방금 닫힌 4시간봉이 응답에 없으면 신호를 내지 않고, 진행 중인 봉은 쓰지 않는다."""
    real_get, real_dt, real_sleep = live.get, live.datetime, live.time.sleep
    live.datetime, live.time.sleep = Clock, lambda s: None
    Clock.t = datetime(2026, 12, 2, 13, 7, tzinfo=KST)
    fmt = "%Y-%m-%dT%H:%M:%S"

    def feed(last):  # last = 가장 새 봉의 시작 시각. 200개씩 새 것부터 준다
        cs = [{"candle_date_time_kst": (last - timedelta(hours=4 * i)).strftime(fmt), "candle_date_time_utc": (last - timedelta(hours=4 * i + 9)).strftime(fmt),
               "trade_price": float(i)} for i in range(1400)]
        calls = iter(range(0, 1400, 200))
        return lambda url: cs[(i := next(calls)):i + 200]

    try:
        live.get = feed(datetime(2026, 12, 2, 13, 0))  # 13시 봉은 진행 중
        times, px = REAL_CLOSES4H(BTC)
        assert times[-1] == "2026-12-02T09:00:00" and px[-1] == 1.0 and len(px) == 1399
        live.get = feed(datetime(2026, 12, 2, 5, 0))  # 09시 봉이 아직 없다
        try:
            REAL_CLOSES4H(BTC)
            raise AssertionError("예외가 나야 한다")
        except RuntimeError as e:
            assert "덜 올라왔다" in str(e)
    finally:
        live.get, live.datetime, live.time.sleep = real_get, real_dt, real_sleep


def test_stale_candles_raise():
    """방금 닫힌 일봉이 응답에 없으면 신호를 내지 않는다."""
    real_get, real_dt = paper.get, paper.datetime
    Clock.t = datetime(2026, 12, 2, 9, 7, tzinfo=KST)
    paper.datetime = Clock
    candle = lambda d: {"candle_date_time_kst": f"{d}T09:00:00", "candle_date_time_utc": f"{d}T00:00:00", "trade_price": 1.0}
    try:
        paper.get = lambda url: [candle("2026-12-02"), candle("2026-12-01"), candle("2026-11-30")]
        assert paper.closes(BTC)[0][-1] == "2026-12-01"
        paper.get = lambda url: [candle("2026-11-30"), candle("2026-11-29")]  # 오늘·어제 봉이 빠진 응답
        try:
            paper.closes(BTC)
            raise AssertionError("예외가 나야 한다")
        except RuntimeError as e:
            assert "덜 올라왔다" in str(e)
    finally:
        paper.get, paper.datetime = real_get, real_dt


if __name__ == "__main__":
    import contextlib, io, traceback
    tests = [f for n, f in sorted(globals().items()) if n.startswith("test_")]
    bad = 0
    for t in tests:
        out = io.StringIO()
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                t()
            print("통과", t.__name__)
        except Exception:
            bad += 1
            print("실패", t.__name__)
            print(out.getvalue())
            traceback.print_exc()
    print(f"{len(tests) - bad}/{len(tests)} 통과")
    raise SystemExit(bad)
