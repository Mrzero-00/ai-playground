"""live_binance.py 주문 · 이체 경로 시험. 가짜 바이낸스를 붙여 돌리므로 실제 주문 · 이체는 나가지 않는다.
사용법: python3 scripts/test_live_binance.py
"""
import csv, json, math, tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

import live_binance as lb
import paper

KST = paper.KST
COINS = lb.COINS
REAL = {"signals": lb.signals, "pub": lb.pub, "private": lb.private}


def no_network(*a, **k):
    raise AssertionError("시험 중에 진짜 바이낸스로 요청이 나가려 했다")


lb.http = no_network


class Clock(datetime):
    t = None

    @classmethod
    def now(cls, tz=None):
        return cls.t if tz is None else cls.t.astimezone(tz)


class Binance:
    """시장가 주문 · 이체를 그 자리에서 처리하는 가짜 바이낸스. 현물 수수료 0.1%(살 때 코인, 팔 때 USDT), 선물 0.05%.
    선물 지갑은 단순하게: 옮길 수 있는 돈 = 지갑 잔고 − 숏 수량 × 진입가(1배 격리 증거금)."""

    def __init__(self, usdt, extra=100.0):
        self.extra = extra  # 사용자의 다른 돈 — 봇이 건드리면 안 된다
        self.spot = {"USDT": usdt + extra, "BTC": 0.0, "ETH": 0.0}
        self.px = {"BTC": 60_000.0, "ETH": 2_000.0}
        self.W = 0.0
        self.pos = {c: [0.0, 0.0] for c in COINS}  # [수량(숏은 −), 진입가]
        self.mtype = {c: "cross" for c in COINS}
        self.lev = {c: 20 for c in COINS}
        self.dual = False
        self.orders, self.fills, self.posts, self.xfers = {}, {}, [], []
        self.income = {c: [] for c in COINS}
        self.fault = {}  # ("spot" | "fut" | "xfer", 코인 또는 종류) → "reject" | "lost"(접수 안 됨, 응답 없음) | "timeout"(처리됐지만 응답 없음)

    def locked(self):
        return sum(-a * e for a, e in self.pos.values())

    def pub(self, url):
        path, _, q = url.partition("?")
        args = dict(x.split("=", 1) for x in q.split("&")) if q else {}
        coin = args.get("symbol", "XUSDT")[:-4]
        if path.endswith("/bookTicker"):
            return {"bidPrice": str(self.px[coin]), "askPrice": str(self.px[coin])}
        if path.endswith("/premiumIndex"):
            return {"markPrice": str(self.px[coin])}
        if path.endswith("/api/v3/ticker/price"):
            return {"price": "600"}
        if path.endswith("/fundingRate"):
            return []
        if path.endswith("/api/v3/exchangeInfo"):
            return {"symbols": [{"baseAsset": c, "filters": [{"filterType": "LOT_SIZE", "stepSize": s},
                                                            {"filterType": "NOTIONAL", "minNotional": "5.00000000"}]}
                                for c, s in (("BTC", "0.00001000"), ("ETH", "0.00010000"))]}
        if path.endswith("/fapi/v1/exchangeInfo"):
            return {"symbols": [{"symbol": f"{c}USDT", "baseAsset": c, "contractType": "PERPETUAL",
                                 "filters": [{"filterType": "MARKET_LOT_SIZE", "stepSize": "0.001", "minQty": "0.001"},
                                             {"filterType": "MIN_NOTIONAL", "notional": n}]} for c, n in (("BTC", "50"), ("ETH", "20"))]}
        raise AssertionError(f"모르는 공개 요청 {url}")

    def _fault(self, key):
        f = self.fault.pop(key, None)
        if f == "reject":
            raise lb.Rejected(f"{key} 400 거절 (가정)", 400, -2010)
        if f == "lost":
            raise RuntimeError(f"{key} 응답 없음 (가정, 접수 안 됨)")
        return f

    def __call__(self, method, base, path, params=None):
        p = params or {}
        coin = p.get("symbol", "XUSDT")[:-4]
        ms = int(Clock.t.timestamp() * 1000)
        if path == "/api/v3/account":
            return {"balances": [{"asset": a, "free": str(v), "locked": "0"} for a, v in self.spot.items()]}
        if path == "/fapi/v2/balance":
            return [{"asset": "USDT", "balance": str(self.W), "maxWithdrawAmount": str(self.W - self.locked())}]
        if path == "/fapi/v2/positionRisk":
            return [{"symbol": p["symbol"], "positionAmt": str(self.pos[coin][0]), "marginType": self.mtype[coin], "leverage": str(self.lev[coin])}]
        if path == "/fapi/v1/positionSide/dual":
            return {"dualSidePosition": self.dual}
        if path == "/fapi/v1/marginType":
            if self.mtype[coin] == "isolated":
                raise lb.Rejected("No need to change margin type.", 400, -4046)
            assert self.pos[coin][0] == 0, "포지션이 있으면 마진 방식을 바꿀 수 없다"
            self.mtype[coin] = p["marginType"].lower()
            return {"code": 200}
        if path == "/fapi/v1/leverage":
            self.lev[coin] = int(p["leverage"])
            return {"leverage": self.lev[coin]}
        if path == "/fapi/v1/income":
            return [r for r in self.income[coin] if r["time"] >= p["startTime"]]
        if path in ("/api/v3/order", "/fapi/v1/order") and method == "GET":
            if p["origClientOrderId"] not in self.orders:
                raise lb.Rejected("Order does not exist.", 400, -2013)
            return self.orders[p["origClientOrderId"]]
        if path in ("/api/v3/myTrades", "/fapi/v1/userTrades"):
            return self.fills[p["orderId"]]
        if path == "/sapi/v1/asset/transfer" and method == "GET":
            rows = [r for r in self.xfers if r["type"] == p["type"] and r["timestamp"] >= p["startTime"]]
            return {"total": len(rows), "rows": rows} if rows else {"total": 0}
        if path == "/sapi/v1/asset/transfer":
            f = self._fault(("xfer", p["type"]))
            amt = float(p["amount"])
            assert round(amt, 2) == amt, "이체 금액은 0.01 단위"
            if p["type"] == "MAIN_UMFUTURE":
                assert self.spot["USDT"] >= amt - 1e-9, "현물 지갑 USDT 부족"
                self.spot["USDT"] -= amt
                self.W += amt
            else:
                assert self.W - self.locked() >= amt - 1e-9, "선물 지갑에서 옮길 수 있는 돈 부족"
                self.W -= amt
                self.spot["USDT"] += amt
            tid = 9000 + len(self.xfers)
            self.xfers.append({"asset": "USDT", "amount": p["amount"], "type": p["type"], "status": "CONFIRMED", "tranId": tid, "timestamp": ms})
            if f == "timeout":
                raise RuntimeError("이체 응답 없음 (가정, 처리됨)")
            return {"tranId": tid}
        assert method == "POST" and path in ("/api/v3/order", "/fapi/v1/order"), (method, path)
        kind = "spot" if path == "/api/v3/order" else "fut"
        f = self._fault((kind, coin))
        cid = p["newClientOrderId"]
        assert cid not in self.orders, "주문 번호를 다시 썼다"
        assert len(cid) <= 36
        px, side = self.px[coin], p["side"]
        if kind == "spot":
            if side == "BUY":
                usdt = float(p["quoteOrderQty"])
                assert self.spot["USDT"] >= usdt - 1e-9, "현물 USDT 부족"
                qty, fee = usdt / px, usdt / px * 0.001
                self.spot["USDT"] -= usdt
                self.spot[coin] += qty - fee
                fill = {"qty": str(qty), "commission": str(fee), "commissionAsset": coin}
            else:
                qty = float(p["quantity"])
                step = {"BTC": 1e-5, "ETH": 1e-4}[coin]
                assert abs(qty / step - round(qty / step)) < 1e-6, "현물 수량 단위"
                assert self.spot[coin] >= qty - 1e-12, "현물 코인 부족"
                usdt, fee = qty * px, qty * px * 0.001
                self.spot[coin] -= qty
                self.spot["USDT"] += usdt - fee
                fill = {"qty": str(qty), "commission": str(fee), "commissionAsset": "USDT"}
        else:
            qty = float(p["quantity"])
            assert abs(qty / 0.001 - round(qty / 0.001)) < 1e-6 and qty >= 0.001, "선물 수량 단위"
            usdt, fee = qty * px, qty * px * 0.0005
            amt, entry = self.pos[coin]
            if side == "SELL":
                assert "reduceOnly" not in p
                assert self.mtype[coin] == "isolated" and self.lev[coin] == 1, "격리 · 1배가 아닌데 숏을 잡았다"
                assert not self.dual
                assert usdt >= {"BTC": 50, "ETH": 20}[coin], "최소 명목 미만"
                assert self.W - self.locked() >= usdt + fee - 1e-9, "증거금 부족"
                self.W -= fee
                self.pos[coin] = [amt - qty, (entry * -amt + usdt) / (-amt + qty)]
            else:
                assert p.get("reduceOnly") == "true", "숏을 갚는 주문은 reduceOnly"
                assert qty <= -amt + 1e-12, "가진 숏보다 많이 갚는다"
                self.W += qty * (entry - px) - fee
                left = round(amt + qty, 10)
                self.pos[coin] = [left, entry if left else 0.0]
            fill = {"qty": str(qty), "commission": str(fee), "commissionAsset": "USDT"}
        oid = 100 + len(self.orders)
        self.orders[cid] = {"status": "FILLED", "executedQty": str(qty), "cummulativeQuoteQty": str(usdt), "cumQuote": str(usdt), "orderId": oid}
        self.fills[oid] = [fill]
        self.posts.append((kind, coin, side, p))
        if f == "timeout":
            raise RuntimeError("주문 응답 없음 (가정, 처리됨)")
        return {"orderId": oid}

    def count(self, kind=None, coin=None, side=None):
        return sum((kind in (None, k)) and (coin in (None, c)) and (side in (None, s)) for k, c, s, _ in self.posts)


class Bot:
    """임시 폴더의 장부와 가짜 바이낸스로 live_binance.run() 을 하루씩 돌린다."""

    def __init__(self, budget=1000.0, extra=100.0):
        self.ex = Binance(budget, extra)
        self.w = {"BTC": 0.0, "ETH": 0.0}
        self.g = {"BTC": 0, "ETH": 0}
        self.broken = set()
        d = Path(tempfile.mkdtemp())
        lb.use(d)
        lb.STOP = d / "STOP"
        lb.CFG["BINANCE_API_KEY"] = lb.CFG["BINANCE_SECRET_KEY"] = "dummy"
        lb.LIVE, lb.KEYS, lb.BUDGET, lb.HALT_DD = True, True, float(budget), 0.5
        lb.pub, lb.private = self.ex.pub, self.ex
        lb.signals = self.signals
        lb.RULES.clear()
        lb.time.sleep = lambda s: None
        lb.datetime = Clock
        Clock.t = datetime(2026, 12, 1, 9, 7, tzinfo=KST)

    def signals(self, c):
        if c in self.broken:
            raise OSError("시세 조회 실패 (가정)")
        return self.w[c], self.g[c], 0.0, 0.0

    def run(self, days=1, hours=0):
        Clock.t += timedelta(days=days, hours=hours)
        try:
            lb.run()
        except SystemExit:
            pass
        return self.st

    @property
    def st(self):
        return json.loads(lb.STATE.read_text())

    def matches(self):
        """장부와 가짜 거래소가 같은가: 코인 수량, 현물 지갑 USDT(사용자 돈 빼고), 선물 지갑, 숏 수량."""
        s = self.st["sleeves"]
        for c in COINS:
            assert abs(s[c]["qty"] - self.ex.spot[c]) < 1e-9, (c, s[c], self.ex.spot)
            assert abs(s[c]["short"] + self.ex.pos[c][0]) < 1e-12, (c, s[c], self.ex.pos)
            if s[c]["short"]:
                assert abs(s[c]["entry"] - self.ex.pos[c][1]) < 1e-6
        assert abs(sum(x["cash"] for x in s.values()) + self.ex.extra - self.ex.spot["USDT"]) < 1e-6, (s, self.ex.spot)
        assert abs(sum(x["margin"] for x in s.values()) - self.ex.W) < 1e-6, (s, self.ex.W)

    def worth(self):
        s = self.st["sleeves"]
        return {c: lb.value(s[c], self.ex.px[c], self.ex.px[c]) for c in COINS}


# ---------- 시험 ----------

def test_uptrend_buys_spot_only():
    b = Bot()
    b.w, b.g = {"BTC": 1.0, "ETH": 0.5}, {"BTC": 1, "ETH": 0}
    st = b.run()
    assert b.ex.count("spot", "BTC", "BUY") == b.ex.count("spot", "ETH", "BUY") == 1 and b.ex.count("fut") == 0 and not b.ex.xfers
    assert st["last_run"] == "2026-12-02" and st["check"]["notes"] == []
    b.matches()
    assert b.ex.spot["ETH"] * 2000 / b.worth()["ETH"] > 0.49
    st = b.run()  # 신호가 그대로면 아무것도 하지 않는다
    assert len(b.ex.posts) == 2


def test_downtrend_shorts_idle_cash():
    b = Bot()
    b.w, b.g = {"BTC": 0.25, "ETH": 0.0}, {"BTC": -1, "ETH": -2}
    st = b.run()
    b.matches()
    s = st["sleeves"]
    assert b.ex.count("fut", side="SELL") == 2 and b.ex.mtype == {"BTC": "isolated", "ETH": "isolated"} and b.ex.lev == {"BTC": 1, "ETH": 1}
    # BTC: 500 의 25% 현물, 75% 를 증거금으로 보내 0.006 BTC(= 360 USDT) 숏 — 0.001 단위로 내림
    assert abs(s["BTC"]["qty"] * 60_000 - 125 * 0.999) < 0.01 and s["BTC"]["short"] == 0.006
    # ETH: 현물 0, 몫 전부로 0.247 ETH 숏
    assert s["ETH"]["qty"] == 0 and s["ETH"]["short"] == 0.247
    assert st["check"]["notes"] == []
    st = b.run()
    assert st["check"]["notes"] == [] and len(b.ex.posts) == 3


def test_regime_turns_up_closes_short_and_returns_margin():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.run()
    b.ex.px = {"BTC": 54_000.0, "ETH": 2_200.0}  # BTC 숏은 벌고 ETH 숏은 잃었다
    b.w, b.g = {"BTC": 0.5, "ETH": 0.0}, {"BTC": 0, "ETH": 1}
    st = b.run()
    b.matches()
    assert b.ex.pos["BTC"][0] == b.ex.pos["ETH"][0] == 0 and b.ex.W < 0.02
    assert st["sleeves"]["BTC"]["qty"] > 0 and st["sleeves"]["ETH"]["qty"] == 0
    assert all(p.get("reduceOnly") == "true" for k, _, s_, p in b.ex.posts if k == "fut" and s_ == "BUY")
    w = b.worth()
    assert w["BTC"] > 500 * 1.08 and w["ETH"] < 500 * 0.92  # BTC 숏 +10% 쯤, ETH 숏 −10% 쯤


def test_spot_weight_rises_in_bear_closes_and_reopens_short():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.run()
    b.w = {"BTC": 0.0, "ETH": 0.5}
    st = b.run()
    b.matches()
    assert b.ex.count("fut", "ETH", "BUY") == 1 and b.ex.count("fut", "ETH", "SELL") == 2 and b.ex.count("fut", "BTC") == 1
    s = st["sleeves"]["ETH"]
    assert abs(s["qty"] * 2000 / b.worth()["ETH"] - 0.5) < 0.01 and abs(s["short"] * 2000 / b.worth()["ETH"] - 0.5) < 0.02


def test_spot_weight_falls_in_bear_adds_short_without_closing():
    b = Bot()
    b.w, b.g = {"BTC": 0.5, "ETH": 0.5}, {"BTC": -1, "ETH": -1}
    b.run()
    b.w = {"BTC": 0.5, "ETH": 0.0}
    st = b.run()
    b.matches()
    assert b.ex.count("fut", "ETH", "BUY") == 0 and b.ex.count("fut", "ETH", "SELL") == 2 and b.ex.count("spot", "ETH", "SELL") == 1
    assert st["sleeves"]["ETH"]["qty"] < 1e-4


def test_order_response_lost_is_settled_next_run_without_resending():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.ex.fault[("fut", "ETH")] = "timeout"  # 숏은 잡혔는데 응답이 끊겼다
    st = b.run()
    assert st["sleeves"]["ETH"].get("pending") and st["last_run"] is None and "ETH 실패" in " ".join(st["check"]["notes"])
    assert b.ex.count("fut", "ETH", "SELL") == 1
    st = b.run(days=0, hours=4)
    assert not st["sleeves"]["ETH"].get("pending") and b.ex.count("fut", "ETH", "SELL") == 1 and st["sleeves"]["ETH"]["short"] > 0
    b.matches()
    assert st["last_run"] is not None and st["check"]["notes"] == []


def test_order_that_never_arrived_is_cleared_and_redone():
    b = Bot()
    b.w, b.g = {"BTC": 1.0, "ETH": 1.0}, {"BTC": 1, "ETH": 1}
    b.ex.fault[("spot", "BTC")] = "lost"
    st = b.run()
    assert st["sleeves"]["BTC"].get("pending") and b.ex.count("spot", "BTC") == 0
    st = b.run(days=0, hours=4)
    assert not st["sleeves"]["BTC"].get("pending") and b.ex.count("spot", "BTC", "BUY") == 1
    b.matches()


def test_rejected_order_fails_only_that_coin():
    b = Bot()
    b.w, b.g = {"BTC": 1.0, "ETH": 1.0}, {"BTC": 1, "ETH": 1}
    b.ex.fault[("spot", "BTC")] = "reject"
    st = b.run()
    assert not st["sleeves"]["BTC"].get("pending") and st["sleeves"]["BTC"]["w"] is None and st["sleeves"]["ETH"]["w"] == 1.0
    assert st["last_run"] is None
    b.matches()
    st = b.run(days=0, hours=4)
    assert st["sleeves"]["BTC"]["w"] == 1.0 and b.ex.count("spot", "BTC", "BUY") == 1 and b.ex.count("spot", "ETH") == 1
    b.matches()


def test_transfer_response_lost_is_found_in_history():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.ex.fault[("xfer", "MAIN_UMFUTURE")] = "timeout"  # 처음 이체(BTC)는 됐는데 응답이 끊겼다
    st = b.run()
    assert st["sleeves"]["BTC"]["pending"]["kind"] == "xfer" and len(b.ex.xfers) == 2
    st = b.run(days=0, hours=4)
    assert not st["sleeves"]["BTC"].get("pending") and len(b.ex.xfers) == 2 and st["sleeves"]["BTC"]["short"] > 0
    b.matches()


def test_transfer_that_never_happened_is_cleared_after_five_minutes():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.ex.fault[("xfer", "MAIN_UMFUTURE")] = "lost"
    st = b.run()
    assert st["sleeves"]["BTC"]["pending"]["kind"] == "xfer" and len(b.ex.xfers) == 1
    st = b.run(days=0)  # 같은 시각 — 아직 내역에 늦게 뜰 수 있으니 지우지 않는다(이미 오늘 몫은 끝나지 않았다)
    assert st["sleeves"]["BTC"].get("pending")
    st = b.run(days=0, hours=4)
    assert not st["sleeves"]["BTC"].get("pending") and st["sleeves"]["BTC"]["short"] > 0 and len(b.ex.xfers) == 2
    b.matches()


def test_btc_short_below_minimum_is_skipped():
    b = Bot(budget=150.0)
    b.w, b.g = {"BTC": 0.25, "ETH": 0.25}, {"BTC": -1, "ETH": -1}
    st = b.run()
    b.matches()
    # 몫 75 USDT: BTC 숏 0.75 × 75 = 56 → 0.000 BTC (0.001 단위가 60 USDT) 라 잡지 않고, ETH 는 0.027 ETH(54 USDT)
    assert st["sleeves"]["BTC"]["short"] == 0 and b.ex.count("fut", "BTC") == 0 and st["sleeves"]["BTC"]["margin"] == 0
    assert st["sleeves"]["ETH"]["short"] == 0.027
    assert st["sleeves"]["BTC"]["w"] == 0.25  # 할 수 있는 만큼 했으면 끝난 것으로 본다


def test_funding_goes_to_margin():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.run()
    t = int((Clock.t + timedelta(hours=8)).timestamp() * 1000)
    b.ex.income["ETH"] = [{"income": "0.05", "time": t}, {"income": "-0.01", "time": t + 1}]
    b.ex.W += 0.04
    st = b.run()
    assert abs(st["sleeves"]["ETH"]["funding"] - 0.04) < 1e-12
    b.matches()
    st = b.run()  # 같은 펀딩을 두 번 더하지 않는다
    assert abs(st["sleeves"]["ETH"]["funding"] - 0.04) < 1e-12
    b.matches()


def test_hedge_mode_refuses_short_before_sending_margin():
    b = Bot()
    b.ex.dual = True
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    st = b.run()
    assert b.ex.count("fut") == 0 and not b.ex.xfers and "양방향" in " ".join(st["check"]["notes"])
    b.matches()


def test_reconcile_flags_position_the_bot_did_not_make():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.run()
    b.ex.pos["ETH"][0] -= 0.1  # 사용자가 손으로 숏을 더 잡았다
    st = b.run()
    assert any("ETH 선물 포지션" in n for n in st["check"]["notes"])


def test_halt_closes_everything_and_stops():
    b = Bot()
    b.w, b.g = {"BTC": 1.0, "ETH": 1.0}, {"BTC": 1, "ETH": 1}
    b.run()
    b.ex.px = {"BTC": 27_000.0, "ETH": 900.0}
    st = b.run()
    assert lb.STOP.exists() and st["sleeves"]["BTC"]["qty"] < 1e-5 and st["sleeves"]["ETH"]["qty"] < 1e-4
    b.matches()
    n = len(b.ex.posts)
    b.run()
    assert len(b.ex.posts) == n


def test_halt_also_closes_shorts():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.run()
    b.ex.px = {"BTC": 93_000.0, "ETH": 3_100.0}  # +55% — 숏이 크게 잃어 평가액이 반 아래로
    st = b.run()
    assert lb.STOP.exists() and b.ex.pos["BTC"][0] == b.ex.pos["ETH"][0] == 0 and b.ex.W < 0.02
    b.matches()


def test_stop_file_does_nothing():
    b = Bot()
    lb.STOP.write_text("시험")
    b.w, b.g = {"BTC": 1.0, "ETH": 1.0}, {"BTC": 1, "ETH": 1}
    Clock.t += timedelta(days=1)
    lb.run()
    assert not lb.STATE.exists() and not b.ex.posts


def test_signal_failure_fails_only_that_coin():
    b = Bot()
    b.w, b.g = {"BTC": 1.0, "ETH": 1.0}, {"BTC": 1, "ETH": 1}
    b.broken = {"ETH"}
    st = b.run()
    assert st["last_run"] is None and b.ex.count("spot", "BTC") == 1 and b.ex.count("spot", "ETH") == 0
    b.broken = set()
    st = b.run(days=0, hours=4)
    assert st["last_run"] == "2026-12-02" and b.ex.count("spot", "ETH") == 1 and b.ex.count("spot", "BTC") == 1


def test_deposit_and_withdraw():
    b = Bot()
    b.w, b.g = {"BTC": 0.5, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.run()
    b.ex.spot["USDT"] += 200  # 사용자가 바이낸스에 200 을 넣고 봇에 맡긴다
    lb.flow(200)
    st = b.run(days=0, hours=4)
    b.matches()
    assert abs(st["budget"] - 1200) < 1e-9 and sum(b.worth().values()) > 1190
    lb.flow(-400)
    b.ex.extra += 400  # 뺀 400 은 이제 사용자 돈이다(현물 지갑에 남아 있어도 봇이 쓰지 않는다)
    st = b.run(days=0, hours=4)
    b.matches()
    assert min(s["cash"] for s in st["sleeves"].values()) >= -1e-9 and abs(st["budget"] - 800) < 1e-9
    assert abs(sum(b.worth().values()) - 800) < 10


def test_already_ran_today_does_nothing():
    b = Bot()
    b.w, b.g = {"BTC": 1.0, "ETH": 1.0}, {"BTC": 1, "ETH": 1}
    b.run()
    b.w = {"BTC": 0.0, "ETH": 0.0}
    b.run(days=0, hours=4)
    assert len(b.ex.posts) == 2


def test_dry_run_sends_nothing():
    b = Bot()
    lb.LIVE = False
    lb.private = no_network
    b.w, b.g = {"BTC": 0.5, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    st = b.run()
    assert st["sleeves"]["BTC"]["qty"] > 0 and st["sleeves"]["BTC"]["short"] > 0 and st["sleeves"]["ETH"]["short"] > 0
    rows = list(csv.DictReader(lb.TRADES.open()))
    assert rows and all(r["모드"] == "드라이런" and r["상태"] == "dry-run" for r in rows)
    assert not b.ex.posts and not b.ex.xfers


def test_day_closes_refuses_a_stale_day():
    Clock.t = datetime(2026, 12, 1, 9, 7, tzinfo=KST)  # = 00:07 UTC, 11-30 봉이 막 닫혔다
    lb.datetime = Clock
    day = lambda d: int(datetime(2026, 11, d, tzinfo=timezone.utc).timestamp() * 1000)
    k = lambda ms, c: [ms, "0", "0", "0", str(c)]
    lb.pub = lambda url: [k(day(28), 1), k(day(29), 2), k(day(30), 3), k(int(datetime(2026, 12, 1, tzinfo=timezone.utc).timestamp() * 1000), 9)]
    dates, px = lb.day_closes(lb.SPOT, "/api/v3/klines", "BTC", 10)
    assert dates[-1] == "2026-11-30" and px == [1.0, 2.0, 3.0]
    lb.pub = lambda url: [k(day(28), 1), k(day(29), 2)]
    try:
        lb.day_closes(lb.SPOT, "/api/v3/klines", "BTC", 10)
        raise AssertionError("어제 봉이 없는데 넘어갔다")
    except RuntimeError as e:
        assert "덜 올라왔다" in str(e)


def lab_hyst(z, enter=1.0, leave=0.5):  # scripts/lab/regime3.py 의 hyst · ztrail 그대로
    z = np.asarray(z, float)
    out, st = np.zeros(len(z), int), 0
    for i, v in enumerate(z):
        if np.isnan(v):
            st = 0
        elif v >= enter:
            st = 1
        elif v <= -enter:
            st = -1
        elif (st == 1 and v < leave) or (st == -1 and v > -leave):
            st = 0
        out[i] = st * (2 if abs(v) >= 2 else 1) if st else 0
    return out


def lab_ztrail(c, n):
    lr = np.log(c)
    return (lr - lr.shift(n)) / (lr.diff().rolling(n).std() * np.sqrt(n))


def test_regime_matches_lab_classifier():
    rng = np.random.default_rng(0)
    c = pd.Series(np.exp(np.cumsum(rng.normal(0, 0.04, 1500))) * 100)
    want = lab_hyst(lab_ztrail(c, 30))
    for i in range(1100, 1500, 7):  # 봇처럼 마지막 1000일만 봐도 전체 기록으로 본 판별과 같다
        assert lb.regime(list(c[i - 999:i + 1])) == want[i], i
    path = lb.ROOT / "data/ml/perp_BTC.csv"
    if path.exists():
        d = pd.read_csv(path).close.astype(float)
        want = lab_hyst(lab_ztrail(d, 30))
        for i in range(len(d) - 200, len(d)):
            assert lb.regime(list(d[max(0, i - 999):i + 1])) == want[i], i


def test_signal_uses_four_moving_averages():
    px = [100.0] * 250 + [150.0]
    assert lb.signal(px) == 1.0 and lb.signal(px[:-1] + [50.0]) == 0.0


def test_deposit_already_in_futures_wallet_moves_nothing():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.0}, {"BTC": -1, "ETH": -1}
    b.run()
    b.ex.W += 9.24  # 예전부터 선물 지갑에 있던 돈
    n, x = len(b.ex.posts), len(b.ex.xfers)
    lb.flow(9.24, in_futures=True)
    st = b.st
    assert abs(st["budget"] - 1009.24) < 1e-9 and not lb.STATE.read_text().count('"cash": -')
    b.matches()
    lb.flow(100, in_futures=True)  # 선물 지갑에 장부 밖의 돈이 그만큼 없으면 거절
    assert abs(b.st["budget"] - 1009.24) < 1e-9
    st = b.run(days=0, hours=4)
    b.matches()
    # 몫마다 4.62 늘어 ETH 숏 목표가 0.002 개(4 USDT) 늘지만 최소 명목 20 USDT 미만이라 주문도 이체도 없다
    assert len(b.ex.posts) == n and len(b.ex.xfers) == x and st["check"]["notes"] == []


def test_small_short_increase_sends_no_margin():
    b = Bot()
    b.w, b.g = {"BTC": 0.0, "ETH": 0.5}, {"BTC": -1, "ETH": -1}
    b.run()
    x = len(b.ex.xfers)
    b.w = {"BTC": 0.0, "ETH": 0.47}  # 비중이 조금 줄어 숏을 조금 늘려야 한다(최소 명목 미만)
    st = b.run()
    b.matches()
    assert b.ex.count("fut", "ETH", "SELL") == 1 and len(b.ex.xfers) == x


if __name__ == "__main__":
    tests = [(k, v) for k, v in list(globals().items()) if k.startswith("test_")]
    for name, fn in tests:
        lb.signals, lb.pub, lb.private = REAL["signals"], REAL["pub"], REAL["private"]
        fn()
        print("ok", name)
    print(f"{len(tests)}개 통과")
