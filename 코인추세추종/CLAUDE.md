# 코인추세추종 — 프로젝트 가이드

## 목표
업비트 현물(레버리지 없음)로 BTC·ETH 추세추종 자동매매. 성공 기준은 BTC 보유 대비 샤프가 높고 MDD 절반 수준.
- 2026-11-26 사용자 결정: 업비트 실전 봇을 멈추고(`live/STOP`, launchd 해제) 바이낸스 한 곳에서 '현물 봇 + 하락장일 때 쉬는 돈으로 선물 1배 숏'(RESEARCH.md '현물 봇 + 하락장 선물 숏 조합' 의 B1)을 실전으로 돌린다(`scripts/live_binance.py`). B1 은 등록한 판정을 통과하지 못했고(2,507만 대 업비트 봇 3,609만원, MDD −48%) 모의를 거치지 않았다 — 사용자가 알고 고른 것이다.

## 스택
Python 3.9 + pandas. 데이터는 업비트 공개 API(키 불필요) 일봉, `data/` 에 CSV.

## 규칙
- 전략 목록은 결과를 보기 전에 고정한다. 결과 보고 파라미터를 고르지 않는다. 대표값은 앙상블(SMA 20·50·100·200 평균 비중).
- 신호는 t일 종가(09:00 KST), 수익은 t+1일부터. 비용은 편도 0.10%(수수료 0.05%+슬리피지 0.05%) 기본, 0.25%와 1일 지연으로 견고성 확인.
- 2022년까지 표본 내, 2023년~ 표본 외. 판단은 표본 외 숫자로 한다.
- ML 은 ML.md 에 피처·모델·채택 기준을 먼저 적고 돌린다. 판정 뒤 진단은 판정을 바꾸지 않는다.
- 실전 순서: 백테스트 → 모의 매매 3개월 → 소액 실전. 레버리지는 현물 전략이 실전 검증된 뒤에만 검토.
  - 예외(2026-11-24 사용자 결정): '살 때만 4시간마다' 는 모의를 거치지 않고 실전 봇에 바로 넣었다(예산 199,000원). 근거와 한계는 RESEARCH.md '4시간마다 확인'·'살 때만 빠르게'.
  - 예외(2026-11-26 사용자 결정): 터틀식 손절(평균 매수가 − 2 × ATR(20일), 손절 뒤 새 매수 신호까지 쉼)도 모의를 거치지 않고 실전 봇에 바로 넣었다. 근거와 한계는 RESEARCH.md '손절 규칙 — 여러 형태'·'터틀식 손절 — 값 바꿔 보기'.

## 운영
- 실행 위치는 워크트리 `/Users/sonsang-il/autoCoin/코인추세추종` (브랜치 `autoCoin`). launchd plist 가 이 경로를 가리키니 옮기면 plist 도 고친다.
- launchd: `com.coin-trend.live-binance`(09:07 바이낸스 실전 하루 몫, 실패한 코인은 13:07·17:07·21:07 에 다시) · `com.coin-trend.paper`(09:05 모의) · `com.coin-trend.live`(업비트 실전, 2026-11-26 해제 — 다시 켜려면 `live/STOP` 을 지우고 plist 를 `~/Library/LaunchAgents` 에 복사해 `launchctl bootstrap`) · `com.coin-trend.collect`(10분 수집) · `com.coin-trend.paper-ml`(09:12 ML 거르기 모의, ML.md) · `com.coin-trend.paper-futures`(09:15 선물 모의, FUTURES.md) · `com.coin-trend.paper-cand`(09:16 연구 후보 선물 모의, RESEARCH.md 후보 모의 등록) · `com.coin-trend.push-data`(09:30 수집 데이터 → 비공개 Mrzero-00/autocoin, `data/collect` 가 그 저장소) · `com.coin-trend.report`(09:20 리포트 → https://coin-report-green.vercel.app).
- `.env`(키·예산·LIVE), `live/`·`live_binance/`·`paper/`·`paper_ml/`·`paper_futures/`·`paper_cand/`(장부), `data/`, `report/` 는 커밋하지 않는다.
- Vercel `coin-report` 는 Git 연결 없이 CLI 로만 배포한다. `vercel link` 가 저장소를 자동 연결하면 `vercel git disconnect` 로 끊는다(푸시마다 저장소 전체 Preview 가 생긴다).
- 긴급 정지: `touch live_binance/STOP` (업비트는 `live/STOP`).
- 바이낸스 실전 봇의 판단(`live_binance.py`): 09:07 에 막 닫힌 일봉(00:00 UTC)으로 코인마다 현물 비중 w(바이낸스 현물 종가의 SMA 20·50·100·200 앙상블)와 장(USDT 무기한 종가의 판별기 (나): 지난 30일 z, |z| ≥ 1 로 들어가 |z| < 0.5 로 나온다)을 본다. 몫의 w 는 현물, 하락장이면 나머지 (1 − w) 를 선물 지갑으로 옮겨 격리 · 1배 숏, 아니면 현물 지갑 USDT. w 나 장이 바뀐 날에만 사고판다. 숏을 줄일 때는 다 갚고 다시 잡는다. 4시간 매수 · 터틀 손절은 B1 백테스트에 없어 넣지 않았다. 판별 값(30일 · 1 · 0.5)과 BUF(1%)는 결과를 보고 바꾸지 않는다.
  - `.env`: `BINANCE_API_KEY` · `BINANCE_SECRET_KEY` · `BINANCE_BUDGET`(USDT) · `BINANCE_LIVE`(1 이어야 주문) · `BINANCE_HALT_DD`(기본 0.50 — B1 의 달러 기준 MDD −49%). 키가 없거나 LIVE 가 아니면 드라이런(장부 `live_binance/dry`). 키는 사용자가 만들어 넣는다(출금 권한 끔 · IP 제한 · 현물 · 선물 · 지갑 간 이체 권한). `python3 scripts/live_binance.py --check` 는 권한 · 잔고 · 선물 설정만 읽는다(주문 · 테스트 주문 · 이체 없음).
  - 이 계좌의 BTCUSDT · ETHUSDT 선물 포지션은 봇만 쓴다(펀딩 내역 · 포지션 대조가 심볼 단위). BTC 선물은 0.001 BTC 단위 · 최소 50 USDT 라 몫이 작으면 숏을 못 잡거나 크게 덜 잡는다.
- `scripts/live_binance.py` 를 고치면 `python3 scripts/test_live_binance.py`(가짜 바이낸스, 실제 주문 · 이체 없음)를 통과시킨 뒤에 올린다. 주문 · 이체의 재시도 원칙은 업비트 봇과 같다(번호 · 기록을 먼저 적고 조회로 맞춘다). 증액 · 감액은 `live_binance.py --deposit / --withdraw`(USDT)로만.
- 업비트 실전 봇의 판단(2026-11-26 부터 정지): 09:07 에 마감 일봉으로 사고판다. 그 사이 4시간마다(13·17·21·01·05시 7분) 마감 4시간봉으로 본 비중이 더 높으면 사기만 하고, 줄이는 일은 다음 09:07 이 한다. 장중 확인만 끄려면 `touch live/NO_INTRADAY`. 손절: 30분마다(09:07 실행은 빼고) 가진 코인의 가격이 평균 매수가 − 2 × ATR(20일) 아래면 그 코인을 전부 팔고, 일 단위 비중이 전날보다 높아지는 날까지 그 마켓은 사지 않는다(장부의 `avg`·`stopped`). 손절만 끄려면 `touch live/NO_STOPLOSS`. 손절 값(2배·20일)은 출처 값이니 백테스트 결과를 보고 바꾸지 않는다. 모의(`paper.py`)는 하루 한 번 그대로 둔다 — 실전과 견주는 기준.
- `scripts/live.py` 를 고치면 `python3 scripts/test_live.py`(가짜 거래소, 실제 주문 없음)를 통과시킨 뒤에 올린다. 주문을 다시 보내는 재시도는 넣지 않는다 — 주문은 고유 번호를 장부에 먼저 적고, 결과는 그 번호로 조회해서 맞춘다.
- 실전 증액·감액은 `live.py --deposit / --withdraw` 로만 한다. `.env` 의 `BUDGET` 이나 `live/state.json` 을 손으로 고치지 않는다(손실 한도 최고점·수익률 지수가 어긋난다).
- 봇(launchd 작업)은 알림을 보내지 않는다(텔레그램 등 외부 채널 없음). 이상 여부는 리포트 맨 위 상태 줄로 드러낸다. 새 launchd 작업을 만들면 `report.py` 의 `health()` 에도 넣는다.
- 매일 브리핑은 Claude 세션 루프가 보낸다(2026-11-18 사용자 요청). 업비트 봇이 사용자 결정으로 멈춰 있으면 `brief.py` 는 바이낸스 봇을 브리핑한다. "브리핑 루프 켜줘" 를 받으면 CronCreate `51 8 * * *`(매일 작업은 30분 늦게 돌아 실제 09:21 — 결과의 다음 실행 시각으로 확인)로 이 일을 예약한다: `python3 scripts/brief.py --new` 실행 → 출력이 없으면 조용히 끝 → 있으면 첫 줄을 PushNotification 으로 보내고 나머지를 채팅에 표시 → `다음 확인: HH:MM` 줄이 있으면 그 시각에 한 번만 다시 하도록 예약. 세션 전용이고 7일 뒤 만료된다. `brief.py` 는 장부를 읽기만 하게 둔다.
