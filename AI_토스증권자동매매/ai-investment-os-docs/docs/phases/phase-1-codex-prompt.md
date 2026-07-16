# Codex Phase 1 실행 프롬프트

아래 내용을 Codex에 전달한다.

---

저장소의 `AGENTS.md`와 `docs` 문서를 먼저 읽어라.

이번 작업에서는 `docs/phases/phase-1-mvp.md` 범위만 구현한다.
향후 Phase 기능을 선행 구현하지 않는다.

## 진행 순서

1. 현재 저장소 상태와 문서 요구사항의 차이를 분석한다.
2. 구현 계획과 예상 변경 파일 목록을 먼저 작성한다.
3. Phase 1을 작은 Vertical Slice 단위로 구현한다.
4. 각 단위마다 타입 검사와 테스트를 실행한다.
5. 최종적으로 Seed 데이터 기반 E2E Paper Trade를 실행한다.
6. 완료 보고서를 작성한다.

## 필수 원칙

- TypeScript strict mode
- Provider 인터페이스 분리
- LLM Structured Output + Zod 검증
- Risk Gate와 LLM 완전 분리
- 실제 증권 주문 금지
- 모든 판단 근거와 거래 결과 DB 저장
- 문서에 없는 임의 기능 추가 금지
- 테스트 실패 숨김 금지
- look-ahead bias 금지
- 실제 OpenAI 키가 없어도 Mock AI로 테스트 가능해야 함

## 완료 보고 형식

- 변경 파일
- 구현 요구사항
- 실행 명령
- 테스트 결과
- 미구현 범위
- 알려진 위험
- 문서와 달라진 점
- 다음 작업 제안
