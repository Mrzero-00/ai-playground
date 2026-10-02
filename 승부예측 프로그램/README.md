# 승부예측 프로그램

> 매주 경기를 뉴스·기록 검색과 시장 확률로 분석해 프로토 단식 기대값(확률×배당)을 계산하고, 결과 회고로 분석 규칙을 계속 쌓아가는 AI 예측 워크플로 (승무패 조합 마킹도 지원)

## 어떻게 쓰나요

1. 매주 10경기 목록을 Claude에게 보냅니다. 경기 하루 전쯤 보내면 가장 좋습니다.
2. Claude가 `CLAUDE.md`, `분석규칙.md`, `팀노트/`를 먼저 읽고, 경기별로 검색해서 승/무/패 확률을 냅니다.
3. `scripts/combo_optimizer.py`로 최대 100조합 안에서 가장 효율적인 마킹(단일/복수/전체)을 고릅니다.
4. 분석 원문은 `회차별분석/`에, 예측값은 `예측기록.csv`에 저장합니다.
5. 경기가 끝나면 결과를 알려주세요. Claude가 예측과 비교해서 `분석규칙.md`와 `팀노트/`를 업데이트합니다.

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `CLAUDE.md` | Claude가 매번 가장 먼저 읽는 작업 지침 |
| `분석규칙.md` | 회고를 통해 쌓이는 판단 기준과 보정값 |
| `예측기록.csv` | 회차·경기별 예측 확률, 마킹, 실제 결과 |
| `팀노트/` | 팀별 누적 메모 (전술, 부상 이력, 홈 강세 등) |
| `회차별분석/` | 매주 상세 분석 원문 |
| `scripts/combo_optimizer.py` | 마킹 구성 최적화, 적중 확률 계산 |
| `scripts/calibration.py` | 누적 기록으로 확률 보정 상태 점검 |
| `scripts/devig.py` | 배당률 → 마진 제거 확률 (Shin/Power) |
| `scripts/match_model.py` | 포아송 + Dixon-Coles 모델, 시장 블렌딩 |
| `scripts/odds_scan.py` | 베트맨 프로토 배당 vs Pinnacle 공정 확률 → 기대값 1 이상 경기 탐지. `--no-draw --prob`로 야구·배구·농구를 이길 확률 순으로, `--sports`·`--round`·`--min-prob` 필터, `--best`로 경기마다 가장 확률 높은 선택지(일반·핸디캡·언더오버), `--combo N`·`--target 배당`으로 적중 확률 높은 조합 (`--no-handi`로 일반만) |
| `scripts/backtest.py` | 과거 5대 리그 자료로 기법별 정확도 순위·앙상블 검증 |
| `scripts/source_compare.py` | 확률 방식(마감·오픈·시장평균·재보정·스태킹)별 실제 적중 비교 |
| `scripts/sure_backtest.py` | 경기마다 최고 확률 선택지(일반·핸디캡·언더오버)를 고를 때 실제 적중률·선별 곡선 |
| `scripts/tune.py` | EPL 2012~2026 자료로 고확률 선택 보정·모델 상수 격자·핸디캡 역산 모델 검증 (결과 `회차별분석/상수점검_*.md`) |

> 백테스트 스크립트(`backtest.py`, `tune.py`)는 numpy·pandas·scipy·scikit-learn이 필요하다: `python3 -m venv .venv && .venv/bin/pip install numpy pandas scipy scikit-learn`.
> football-data.co.uk는 국내 통신사에서 차단되므로 `tune.py` 상단의 GitHub 미러 주소로 자료를 받는다. `odds_scan.py`는 표준 라이브러리만 쓴다.
| `분석방법론.md` | 해외·국내 전문가·연구 방법론 정리, 백테스트 결과 (출처 포함) |

## 주의

예측은 확률일 뿐이며 대부분의 회차는 전부 적중하지 못합니다. 복권형 상품은 장기 기대값이 마이너스이니 금액을 정해 두고, 공식 발매처에서 만 19세 이상만 이용하세요.
