# Discovery and Research Architecture

## 탐색 원칙

미국 상장 종목 전체를 LLM으로 분석하지 않는다.

```text
전체 종목
→ 정량 스캔
→ 이벤트 필터
→ 저비용 Quick Score
→ 상위 후보 Deep Research
→ Risk Gate
```

## Discovery 신호

- 가격 변화
- Relative Volume
- 달러 거래대금
- 프리마켓 갭
- SEC 신규 공시
- 실적 서프라이즈
- 가이던스 변경
- 옵션 이상 거래
- 공매도 변화
- 섹터 상대강도 변화

Discovery는 매수 결정을 내리지 않는다.

## Source Tier

```text
Tier 1: SEC, 거래소, 규제기관
Tier 2: 회사 IR, 공식 보도자료, 실적 자료
Tier 3: 신뢰도 높은 뉴스
Tier 4: 소셜 및 커뮤니티
```

Tier 4만 존재하는 이벤트는 자동 진입할 수 없다.

## Research Committee

### Bull Analyst
상승 논리와 미래가치 변화를 최대한 강하게 구성한다.

### Bear Analyst
희석, 부채, 고객 집중, 실행 실패, 과도한 기대를 찾는다.

### Market Analyst
현재 시장과 섹터에서 같은 재료가 실제로 작동할 환경인지 평가한다.

### Skeptic
출처, 숫자, 인과관계, 가격 반영, 누락된 증거를 공격한다.

의견 불일치가 크면 불확실성을 높이고 추가 조사를 요구한다.
