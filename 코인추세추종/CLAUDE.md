# 코인추세추종 — 프로젝트 가이드

## 목표
업비트 현물(레버리지 없음)로 BTC·ETH 추세추종 자동매매. 성공 기준은 BTC 보유 대비 샤프가 높고 MDD 절반 수준.

## 스택
Python 3.9 + pandas. 데이터는 업비트 공개 API(키 불필요) 일봉, `data/` 에 CSV.

## 규칙
- 전략 목록은 결과를 보기 전에 고정한다. 결과 보고 파라미터를 고르지 않는다. 대표값은 앙상블(SMA 20·50·100·200 평균 비중).
- 신호는 t일 종가(09:00 KST), 수익은 t+1일부터. 비용은 편도 0.10%(수수료 0.05%+슬리피지 0.05%) 기본, 0.25%와 1일 지연으로 견고성 확인.
- 2022년까지 표본 내, 2023년~ 표본 외. 판단은 표본 외 숫자로 한다.
- ML 은 ML.md 에 피처·모델·채택 기준을 먼저 적고 돌린다. 판정 뒤 진단은 판정을 바꾸지 않는다.
- 실전 순서: 백테스트 → 모의 매매 3개월 → 소액 실전. 레버리지는 현물 전략이 실전 검증된 뒤에만 검토.

## 운영
- 실행 위치는 워크트리 `/Users/sonsang-il/autoCoin/코인추세추종` (브랜치 `autoCoin`). launchd plist 가 이 경로를 가리키니 옮기면 plist 도 고친다.
- launchd: `com.coin-trend.paper`(09:05 모의) · `com.coin-trend.live`(09:07 실전) · `com.coin-trend.collect`(10분 수집) · `com.coin-trend.paper-ml`(09:12 ML 거르기 모의, ML.md) · `com.coin-trend.paper-futures`(09:15 선물 모의, FUTURES.md) · `com.coin-trend.push-data`(09:30 수집 데이터 → 비공개 Mrzero-00/autocoin, `data/collect` 가 그 저장소) · `com.coin-trend.report`(09:20 리포트 → https://coin-report-green.vercel.app).
- `.env`(키·예산·LIVE), `live/`·`paper/`·`paper_ml/`·`paper_futures/`(장부), `data/`, `report/` 는 커밋하지 않는다.
- Vercel `coin-report` 는 Git 연결 없이 CLI 로만 배포한다. `vercel link` 가 저장소를 자동 연결하면 `vercel git disconnect` 로 끊는다(푸시마다 저장소 전체 Preview 가 생긴다).
- 긴급 정지: `touch live/STOP`.
