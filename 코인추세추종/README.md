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
3. `python3 scripts/live.py --check` 로 잔고·주문 권한 확인(업비트의 주문 테스트 API 를 써서 실제 주문은 나가지 않는다).
4. `.env` 의 `LIVE=1` 로 바꾸면 다음 09:07 부터 실제 주문.

안전장치
- 장부(`live/state.json`)에 적힌 돈만 굴리고 봇이 산 수량만 판다. 계좌의 나머지는 건드리지 않는다.
- 주문은 보내기 전에 고유 번호와 함께 장부에 적는다. 주문 뒤에 봇이 죽거나 응답이 끊겨도 다음 실행이 그 번호로 업비트에 물어 장부를 맞춘다(같은 주문이 두 번 나가지 않는다).
- 마켓 하나가 실패해도 다른 마켓은 처리하고, 실패한 마켓은 13:07·21:07 에 다시 한다.
- 실행할 때마다 장부와 실제 계좌를 견줘 모자라면 리포트 상태 줄에 띄운다. 원화가 모자라면 있는 만큼만 사고 채워지면 마저 산다.
- 방금 닫힌 일봉이 응답에 없으면 그날은 신호를 내지 않고 다시 시도한다.
- `live/STOP` 파일이 있으면 정지 · 최고점 대비 `HALT_DD`(기본 45%) 하락 시 전량 매도 후 정지.

증액·감액은 `.env` 의 `BUDGET` 이 아니라 명령으로 한다(`BUDGET` 은 처음 시작할 때만 쓰인다).

```bash
python3 scripts/live.py --deposit 300000    # 업비트에 원화를 넣은 뒤 실행. 두 마켓에 반씩 더하고 다음 실행 때 목표 비중에 맞춰 산다
python3 scripts/live.py --withdraw 100000   # 다음 실행 때 필요한 만큼 판다. 안내가 나오면 그 실행 뒤에 꺼낸다
python3 scripts/test_live.py                # 가짜 거래소로 주문 경로 시험 (live.py 를 고치면 반드시)
```

입출금은 `live/flows.csv` 에 남고, 수익률·최대 하락은 입출금을 뺀 지수로 계산한다. 손실 한도의 최고점도 같은 비율로 옮겨서 출금을 폭락으로 보지 않는다.
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
봇은 알림을 보내지 않는다. 대신 맨 위 상태 줄이 작업 6개(실전·모의·ML 모의·선물 모의·수집·데이터 푸시)가 제때 돌았는지와 실전 장부·계좌가 맞는지를 보여 주고, 페이지가 15시간 넘게 갱신되지 않으면 빨간 띠가 뜬다(맥이 꺼진 경우).
https://coin-report-green.vercel.app · launchd `com.coin-trend.report` 가 09:20·13:20·21:20 갱신. `report/` 는 커밋하지 않는다(잔고가 들어 있음).

```bash
python3 scripts/report.py --no-deploy   # 로컬에서 report/index.html 만 생성
```

## 매일 브리핑 (Claude 알림)

`scripts/brief.py` — 실전 봇이 오늘 왜 샀는지·왜 안 샀는지(종가와 이동평균 4개 비교, 다음에 매매가 일어날 가격)와 주문 내역(금액·체결가·수량·수수료·신호 종가 대비)을 글로 낸다. 첫 줄은 알림용 한 줄(200자 이내). 장부를 읽기만 한다.

```bash
python3 scripts/brief.py         # 지금 상태
python3 scripts/brief.py --new   # 지난번에 내보낸 뒤로 달라진 게 없으면 아무것도 출력하지 않는다 (루프용)
```

보내는 것은 Claude Code 세션 루프가 맡는다. 매일 09:21 에 세션이 `brief.py --new` 를 돌려 첫 줄을 Claude 알림으로 보내고 나머지를 채팅에 남긴다. 실패한 마켓이 있으면 출력의 `다음 확인: 13:22` 줄을 보고 재시도 뒤에 한 번 더 브리핑한다.
세션 루프는 세션을 닫으면 사라지고 7일 뒤 만료된다. Claude 세션에서 "브리핑 루프 켜줘" 라고 하면 다시 만든다. 폰 알림은 그 세션에 Remote Control 이 연결돼 있을 때만 간다. 루프가 꺼져 있던 동안의 주문은 다음 브리핑에 함께 나온다.

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
