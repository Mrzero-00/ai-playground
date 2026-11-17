# 코인추세추종

> 업비트 원화마켓 일봉으로 추세추종 전략을 백테스트하고, 현물 자동매매로 이어가기 위한 프로젝트

## 실행

```bash
python3 scripts/fetch.py KRW-BTC KRW-ETH   # 일봉 전체 이력 → data/*.csv
python3 scripts/backtest.py               # 편도 비용 0.10% 기준
python3 scripts/backtest.py 0.25          # 편도 비용 0.25% 스트레스
```

결과 요약은 [BACKTEST.md](BACKTEST.md).

## 모의 매매 봇

실제 주문 없이 실시간 호가창 기준으로 체결가를 계산해 장부(`paper/`)에 적는다. 원금 100만원, BTC·ETH 각 50만원.

```bash
python3 scripts/paper.py           # 오늘 몫 실행 (하루 한 번만, 09:00 KST 이후)
python3 scripts/paper.py --report  # 누적 성과 · 슬리피지
```

launchd 로 매일 09:05 자동 실행 (13:05·21:05 는 놓쳤을 때 재시도). 사람 확인 없이 돈다.

```bash
cp scripts/com.coin-trend.paper.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.coin-trend.paper.plist
```

- `paper/state.json` 현금·보유 수량·목표 비중
- `paper/trades.csv` 거래마다 체결가, 슬리피지(중간가 대비), 신호 종가 대비 차이
- `paper/equity.csv` 날마다 평가액과 그냥 보유했을 때 평가액
- `paper/logs/` 실행 로그

## 실전 매매 봇

`scripts/live.py` — 신호는 모의 매매와 같다. 기본은 드라이런(주문 안 보냄).

1. 업비트 → 마이페이지 → Open API 관리에서 키 발급. 권한은 **자산조회·주문조회·주문하기**만(출금 권한 끄기), 허용 IP 에 이 맥의 공인 IP 등록.
2. `cp .env.example .env` 후 키 입력, `chmod 600 .env`.
3. `python3 scripts/live.py --check` 로 잔고 확인.
4. `.env` 의 `LIVE=1` 로 바꾸면 다음 09:07 부터 실제 주문.

안전장치: 예산(`BUDGET`)만 굴림 · 봇이 산 수량만 매도 · `live/STOP` 파일이 있으면 정지 · 최고점 대비 `HALT_DD`(기본 45%) 하락 시 전량 매도 후 정지.
launchd `com.coin-trend.live` 가 매일 09:07 실행 (13:07·21:07 재시도).

## ML 거르기 모의 매매

사전 등록 실험 [ML.md](ML.md): 로지스틱 회귀가 '5일 뒤 오를 확률'을 내고 0.5 이하면 앙상블 비중을 0 으로 끈다(L-A).
표본 외 샤프 1.43 → 1.77, MDD -26% → -18%. 실전 전 3개월 모의 병행.

```bash
python3 scripts/fetch_ml.py   # 바이낸스 현물·선물·펀딩, ECB 환율 백필 → data/ml/
python3 scripts/ml.py         # 워크포워드 실험 재현
python3 scripts/paper_ml.py   # 오늘 몫 모의 매매 (장부 paper_ml/), --report 로 성과
```

launchd `com.coin-trend.paper-ml` 이 09:12 실행 (13:12·21:12 재시도).

## 선물 모의 매매

사전 등록 [FUTURES.md](FUTURES.md): 바이낸스 무기한 실제 가격·펀딩으로 롱만·대칭·롱+숏·2배 롱 4개를 백테스트하고, 4개 모두 모의로 돌린다.
표본 외에서 어느 것도 롱만보다 낫지 않았고, 롱만도 업비트 현물보다 나빴다(펀딩 연 5.5%). 기록용.

```bash
python3 scripts/futures_backtest.py [편도비용%]
python3 scripts/paper_futures.py [--report]   # 장부 paper_futures/
```

launchd `com.coin-trend.paper-futures` 가 09:15 실행 (13:15·21:15 재시도).

## 운영 리포트

`scripts/report.py` — 실전·모의 장부, 오늘 신호(이평선별 거리), 슬리피지, 수집 현황을 정적 페이지로 만들어 Vercel 프로젝트 `coin-report` 에 올린다.
https://coin-report-green.vercel.app · launchd `com.coin-trend.report` 가 09:20·13:20·21:20 갱신. `report/` 는 커밋하지 않는다(잔고가 들어 있음).

```bash
python3 scripts/report.py --no-deploy   # 로컬에서 report/index.html 만 생성
```

## 데이터 수집기 (머신러닝 준비)

`scripts/collect.py` — 나중에 과거분을 받을 수 없는 데이터를 10분마다 쌓는다. launchd `com.coin-trend.collect`.

| 항목 | 내용 | 주기 |
|---|---|---|
| orderbook | 업비트 BTC·ETH 호가 15단계 | 10분 |
| ticks | 업비트 BTC·ETH 체결 전부 (이어 받기) | 10분 |
| derivs | 바이낸스·바이비트 펀딩비·미결제약정·마크가 | 10분 |
| premium | 바이낸스·코인베이스 가격, 환율, 업비트 USDT, 김치프리미엄 | 10분 |
| tickers | 업비트 원화마켓 전 종목 24시간 시세 | 1시간 |

저장 위치 `data/collect/<항목>/<날짜>.csv.gz`, 로그 `data/collect/logs/`. 맥이 잠들면 그 사이는 빈다(체결은 7일 안이면 복구).

`data/collect` 는 별도 git 저장소로, 비공개 [Mrzero-00/autocoin](https://github.com/Mrzero-00/autocoin) 에 하루가 끝난 파일만 매일 푸시한다(`scripts/push_data.py`, launchd `com.coin-trend.push-data` 09:30).
