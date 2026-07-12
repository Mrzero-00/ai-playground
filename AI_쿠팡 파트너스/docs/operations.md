# Operations

## 1. 일일 운영 흐름

```text
06:00 Market Context 생성
06:10 상품 수집
06:30 상품 점수 계산
07:00 콘텐츠 초안 생성
07:30 Compliance 검사
08:00 운영자 검토 가능
23:00 성과 집계
```

---

## 2. 운영자가 확인할 항목

매일 확인:

- Workflow 실패 여부
- 상품 후보 수
- 상위 상품 분포
- 중복 상품 비율
- Compliance 실패율
- 콘텐츠 승인율
- 게시 실패 여부
- 클릭 수와 CTR

매주 확인:

- 카테고리별 CTR
- 카테고리별 전환율
- 콘텐츠 포맷별 성과
- Prompt 버전별 성과
- 상품 점수와 실제 수익의 상관관계
- AI 비용 대비 수익

---

## 3. 장애 처리

### 상품 API 실패

- 3회 재시도
- 마지막 정상 Snapshot 사용 금지
- 데이터 최신성 미확인 상태로 표시
- 콘텐츠 생성 중단
- 운영자 알림

### AI 실패

- 단계별 재시도
- 대체 모델 호출
- 해당 Candidate만 실패 처리
- 전체 Workflow는 가능한 범위까지 진행

### 게시 실패

- Publication 상태를 `FAILED`로 저장
- 재시도 횟수와 오류 저장
- 같은 콘텐츠를 새 Publication으로 중복 생성하지 않음

### 분석 데이터 누락

- 원본 Event는 보존
- 집계 Job만 재실행 가능
- 날짜 범위를 지정한 Backfill 지원

---

## 4. 자동 게시 전환 기준

최소 4주간 승인형 운영 후 검토합니다.

권장 기준:

- 콘텐츠 승인율 95% 이상
- CRITICAL 정책 위반 0건
- 상품 데이터 불일치 0건
- 게시 실패율 1% 미만
- 중복 게시 0건
- 최소 100개 이상의 승인 데이터 확보

조건 충족 후에도 일부 카테고리부터 자동 게시합니다.

---

## 5. KPI

주요 KPI:

```text
Revenue
Commission
Clicks
CTR
Conversions
Conversion Rate
Revenue per Content
Revenue per Click
AI Cost per Content
Profit per Content
Approval Rate
Compliance Failure Rate
```

콘텐츠 생산량 자체는 핵심 KPI로 사용하지 않습니다.
