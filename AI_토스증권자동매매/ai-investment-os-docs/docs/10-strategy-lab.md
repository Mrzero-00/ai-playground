# Strategy Lab

운영 시스템과 실험 시스템을 완전히 분리한다.

## Champion / Challenger

- Champion: 현재 운영 전략
- Challenger: 평가 중인 후보 전략

## 승격 단계

```text
과거 데이터 백테스트
→ 시간 순서 워크포워드
→ Paper Trading
→ Shadow Mode
→ 소액 실거래
→ Champion 승격
```

## 승격 조건

- 최소 표본 수
- 비용 반영 후 기대값 개선
- 최대 낙폭 악화 없음
- 특정 종목 또는 특정 국면 편중 없음
- 리스크 위반 없음
- Out-of-sample 성과 확인

LLM은 변경안을 제안할 수 있지만 승격 조건을 우회할 수 없다.
