"""수집 데이터(data/collect)를 비공개 저장소 Mrzero-00/autocoin 에 쌓는다.
data/collect 자체가 별도 git 저장소다(바깥 ai-playground 는 data/ 를 무시한다).
하루가 끝난 파일(KST 날짜 < 오늘)만 커밋한다 — 진행 중인 오늘 파일을 매일 다시 올리지 않으려고.
launchd com.coin-trend.push-data 가 09:30 실행 (13:30·21:30 은 푸시 실패 재시도).
사용법: python3 scripts/push_data.py
"""
import subprocess
from datetime import datetime
from pathlib import Path

from paper import KST

REPO = Path(__file__).resolve().parent.parent / "data" / "collect"
REMOTE = "https://github.com/Mrzero-00/autocoin.git"
KINDS = ["orderbook", "ticks", "derivs", "premium", "tickers"]
README = """# autocoin 수집 데이터

> 코인추세추종 봇(ai-playground `autoCoin` 브랜치 `코인추세추종/scripts/collect.py`)이 10분마다 쌓는 원자료. 나중에 과거분을 받을 수 없는 것만 모은다.

`<항목>/<YYYY-MM-DD>.csv.gz` (KST 날짜, 하루가 끝난 파일만 올라온다). 맥이 잠든 동안은 비고, 체결은 7일 안이면 이어 받는다.

| 항목 | 내용 | 주기 | 열 |
|---|---|---|---|
| orderbook | 업비트 BTC·ETH 호가 15단계 | 10분 | ts, market, total_ask, total_bid, ask_p0, ask_q0, bid_p0, bid_q0, … 14 |
| ticks | 업비트 BTC·ETH 체결 전부 | 이어 받기 | timestamp(ms), market, price, volume, ask_bid, sequential_id |
| derivs | 바이낸스·바이비트 펀딩비·마크가·미결제약정 | 10분 | ts, exchange, symbol, funding_rate, mark, index, open_interest |
| premium | 해외 현물가·환율·업비트 USDT·김치프리미엄 | 10분 | ts, symbol, upbit_krw, binance_usdt, coinbase_usd, upbit_usdt_krw, usdkrw, kimchi_premium |
| tickers | 업비트 원화마켓 전 종목 24시간 시세 | 1시간 | ts, market, price, high, low, change_rate, value_24h, volume_24h |
"""


def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=check)


def setup():
    if (REPO / ".git").exists():
        return
    git("init", "-b", "main")
    git("remote", "add", "origin", REMOTE)
    (REPO / ".gitignore").write_text("logs/\nticks_cursor.json\n")
    (REPO / "README.md").write_text(README)
    git("add", ".gitignore", "README.md")
    git("commit", "-m", "수집 데이터 저장소 시작")


def run():
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    setup()
    done = [str(p.relative_to(REPO)) for k in KINDS for p in sorted((REPO / k).glob("*.csv.gz")) if p.stem.split(".")[0] < today]
    if done:
        git("add", "--", *done)
    staged = git("diff", "--cached", "--name-only").stdout.split()
    if staged:
        days = sorted({Path(f).stem.split(".")[0] for f in staged})
        git("commit", "-m", f"수집 {days[0]}" + (f" ~ {days[-1]}" if len(days) > 1 else "") + f" ({len(staged)}개 파일)")
    r = git("push", "-u", "origin", "main", check=False)
    print(f"--- {now.isoformat(timespec='seconds')} 새 파일 {len(staged)}개, 푸시 {'완료' if r.returncode == 0 else '실패: ' + r.stderr.strip()[-300:]}")


if __name__ == "__main__":
    run()
