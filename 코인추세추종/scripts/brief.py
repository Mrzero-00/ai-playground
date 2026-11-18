"""실전 매매 브리핑. Claude 세션 루프가 이 출력을 읽어 알림으로 보낸다. 주문을 내지 않고 장부도 고치지 않는다.
첫 줄은 알림용 한 줄(200자 이내), 그 아래는 마켓별 근거·주문 내역·평가액·작업 상태.
사용법:
  python3 scripts/brief.py         # 지금 상태
  python3 scripts/brief.py --new   # 지난번에 내보낸 뒤로 달라진 게 없으면 아무것도 출력하지 않는다 (루프용)
"""
import csv, json, sys
from datetime import datetime

from live import DIR, EQUITY, LIVE, MIN_ORDER, STOP, TRADES, history, load_state
from paper import KST, MARKETS, SMAS, closes, signal
from report import collector, health

MARK = DIR / "brief.json"  # 마지막으로 내보낸 브리핑의 시각과 그때 상태
RETRY = [(13, 7), (21, 7)]  # 실전 봇이 실패한 마켓을 다시 하는 시각 (launchd)


def why(m):
    """신호 근거: 마감 종가가 이동평균 몇 개 위에 있는지, 전날과 무엇이 달라졌는지."""
    dates, px = closes(m)
    sma = {n: sum(px[-n:]) / n for n in SMAS}
    return {"date": dates[-1], "close": px[-1], "sma": sma, "target": signal(px),
            "above": [n for n in SMAS if px[-1] > sma[n]],
            "before": [n for n in SMAS if px[-2] > sum(px[-n - 1:-1]) / n]}


def where(above):
    if len(above) in (0, len(SMAS)):
        return f"이동평균 {len(SMAS)}개 모두 {'위' if above else '아래'}"
    return "·".join(map(str, above)) + "일선 위"


def moved(w):
    """전날 봉과 견줘 넘어서거나 내려간 선."""
    up = [n for n in w["above"] if n not in w["before"]]
    down = [n for n in w["before"] if n not in w["above"]]
    return ", ".join(x for x in ["·".join(map(str, up)) + "일선 넘음" if up else "", "·".join(map(str, down)) + "일선 밑으로" if down else ""] if x)


def coin(m):
    return m.split("-")[1]


def mmdd(iso):
    return f"{int(iso[5:7])}/{int(iso[8:10])}"


def brief(new=False):
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    st = load_state()
    mark = json.loads(MARK.read_text()) if MARK.exists() else {}
    all_tr = list(csv.DictReader(TRADES.open())) if TRADES.exists() else []
    trades = [t for t in all_tr if t["시각"][:10] == today or t["시각"] > mark.get("at", "9")]  # 지난 브리핑 뒤의 재시도 주문까지
    hl = health(now, st, collector()[0])
    bad = [(name, desc) for name, ok, desc in hl if not ok]
    undone = [m for m in MARKETS if st["sleeves"][m].get("done") != today] if now.hour >= 9 and not STOP.exists() else []

    sig = [today, [st["sleeves"][m].get("done") for m in MARKETS], st.get("check", {}).get("notes"),
           [m for m in MARKETS if st["sleeves"][m].get("pending")], STOP.exists(), len(all_tr), [name for name, _ in bad]]
    if new and sig == mark.get("sig"):
        return

    prev = {}  # 어제까지 장부에 적힌 비중
    for r in csv.DictReader(EQUITY.open()) if EQUITY.exists() else []:
        if r["날짜"] < today:
            prev[r["마켓"]] = float(r["비중"])

    body, short, whys = [], [], {}
    for m in MARKETS:
        s = st["sleeves"][m]
        mine = [t for t in trades if t["마켓"] == m]
        try:
            w = whys[m] = why(m)
        except Exception as e:
            body += [f"{m}  비중 {s['target']:.2f}", f"  신호 근거를 불러오지 못함: {str(e)[:100]}"]
            continue
        if m in undone:
            head = f"오늘 처리 안 됨 (신호 {w['target']:.2f}, 장부 {s['target']:.2f})"
        elif mine:
            head = " · ".join(("" if t["시각"][:10] == today else f"{mmdd(t['시각'])} ") + f"{t['구분']} {float(t['목표비중_전']):.2f}→{float(t['목표비중_후']):.2f}"
                              + ("" if t["사유"] == "신호" else f"({t['사유']})") for t in mine)
        elif m in prev and prev[m] != s["target"]:
            head = f"비중 {prev[m]:.2f}→{s['target']:.2f}, 차이가 최소 주문({MIN_ORDER:,}원) 미만이라 주문 없음"
        else:
            head = f"비중 {s['target']:.2f} 유지, 주문 없음"
        body.append(f"{m}  {head}")
        change = moved(w)
        body.append(f"  근거  {mmdd(w['date'])} 종가 {w['close']:,.0f}원 — {where(w['above'])} → 비중 {w['target']:.2f}" + (f" ({change})" if change else " (전날과 같음)"))
        body.append("  선 대비 종가  " + " · ".join(f"{n}일 {(w['close'] / v - 1) * 100:+.1f}%" for n, v in w["sma"].items()))
        k = len(w["above"])
        up = min((v, n) for n, v in w["sma"].items() if v >= w["close"]) if k < len(SMAS) else None
        down = max((v, n) for n, v in w["sma"].items() if v < w["close"]) if k else None
        nxt = [f"{up[1]}일선 {up[0]:,.0f}원(종가보다 {(up[0] / w['close'] - 1) * 100:.1f}% 위)을 넘어 닫히면 매수해 비중 {(k + 1) / len(SMAS):.2f}" if up else "",
               f"{down[1]}일선 {down[0]:,.0f}원({(1 - down[0] / w['close']) * 100:.1f}% 아래) 밑으로 닫히면 매도해 비중 {(k - 1) / len(SMAS):.2f}" if down else ""]
        body.append("  다음 변화  " + " / ".join(x for x in nxt if x))
        if s.get("rebalance"):
            body.append("  입출금 반영 대기 — 다음 실행에서 비중에 맞춰 사고판다")
        short.append((m, w, mine))

    if trades:
        body.append(f"주문 {len(trades)}건")
        for t in trades:
            sign = 1 if t["구분"] == "매수" else -1
            drift = (float(t["체결가"]) / float(t["신호종가"]) - 1) * sign * 100 if t["신호종가"] else None
            body.append(f"  {mmdd(t['시각'])} {t['시각'][11:16]} {t['마켓']} {t['구분']}({t['사유']}) {float(t['원화']):,.0f}원 @ {float(t['체결가']):,.0f}원 · "
                        f"{float(t['수량']):.8f}개 · 수수료 {float(t['수수료']):,.0f}원"
                        + (f" · 신호 종가 대비 {abs(drift):.2f}% {'불리' if drift > 0 else '유리'}" if drift is not None else "") + f" · 주문번호 {t['주문번호'][:11]}…")

    h = history()
    money = ""
    if h:
        d, v, b, idx = h[-1]
        day = f", 전날보다 {(idx / h[-2][3] - 1) * 100:+.2f}%" if len(h) > 1 and d == today else ""
        body.append(f"평가액 {v:,.0f}원 (넣은 돈 {b:,.0f}원 대비 {(v / b - 1) * 100:+.2f}%{day})" + ("" if d == today else f" — {d} 기준"))
        money = f"평가 {v:,.0f}원({(v / b - 1) * 100:+.2f}%)"
    if STOP.exists():
        body.append(f"정지 상태: {STOP.read_text().strip()}")
    body.append("확인 필요\n" + "\n".join(f"  {name}: {desc}" for name, desc in bad) if bad else f"작업 {len(hl)}개 모두 정상")
    after = [f"{hh}:22" for hh, mm in RETRY if (now.hour, now.minute) < (hh, mm)]
    if undone and after:
        body.append(f"다음 확인: {after[0]}")  # 루프가 이 줄을 보고 재시도 뒤에 한 번 더 브리핑한다

    # 알림용 한 줄: 손봐야 할 것 → 주문 → 근거 → 평가액
    bits = []
    if now.hour < 9:
        bits.append("오늘 몫은 09:07 실행 예정")
    if bad:
        live_note = "(정지)" if STOP.exists() else f"({'·'.join(map(coin, undone))} 미처리)" if undone else ""
        bits.append("확인 필요: " + ", ".join(name + (live_note if name == "실전" else "") for name, _ in bad))
    for t in trades:
        day, w = t["시각"][:10] == today, whys.get(t["마켓"])
        note = (f"비중 {float(t['목표비중_전']):g}→{float(t['목표비중_후']):g}" + (f", {moved(w)}" if day and w and moved(w) else "")) if t["사유"] == "신호" else t["사유"]
        bits.append(("" if day else f"{mmdd(t['시각'])} ") + f"{coin(t['마켓'])} {t['구분']} {float(t['원화']):,.0f}원 @{float(t['체결가']):,.0f} ({note})")
    idle = [(m, w) for m, w, mine in short if not mine and m not in undone]  # 오늘 처리했고 주문이 없던 마켓
    if not trades and not undone:
        bits.append("매매 없음")
    if len(idle) > 1 and len({tuple(w["above"]) for _, w in idle}) == 1:
        bits.append(f"{'·'.join(coin(m) for m, _ in idle)} 종가가 {where(idle[0][1]['above'])} → 비중 {idle[0][1]['target']:g} 유지")
    else:
        bits += [f"{coin(m)} 비중 {w['target']:g} 유지({where(w['above'])})" for m, w in idle]
    line = f"{now.month}/{now.day} {'실전' if LIVE else '드라이런'}: " + " / ".join(bits + [money] if money else bits)
    print(line if len(line) <= 200 else line[:199] + "…")
    print()
    print("\n".join(body))
    if new:
        MARK.write_text(json.dumps({"at": now.isoformat(timespec="seconds"), "sig": sig}, ensure_ascii=False))


if __name__ == "__main__":
    brief(new="--new" in sys.argv)
