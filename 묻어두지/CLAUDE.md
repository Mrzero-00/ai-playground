# 묻어두지 프로젝트 컨텍스트

@AGENTS.md

제품 행동은 `docs/PRD.md`, 기술 권한과 상태는 `docs/architecture.md`, 작업 순서는 `docs/IMPLEMENTATION_PLAN.md`를 단일 기준으로 사용한다. 구현 작업에는 관련 PRD 요구사항 ID와 검증 결과를 남긴다.

## 목표

친구·연인·가족이 텍스트와 사진을 미래에 묻고, 정해진 날짜와 장소에 필요한 인원이 모였을 때 함께 여는 소셜 앱을 만든다.

## 제품 원칙

- 추억 저장보다 실제 만남을 먼저 설계한다.
- 감정적으로는 조금 귀찮게, 기술적으로는 절대 짜증 나지 않게 한다.
- 비공개 관계를 공개 SNS로 바꾸지 않는다.
- 농담 섞인 말투를 쓰되 오류에는 실제 해결 방법을 함께 제시한다.
- 이미 묻은 콘텐츠는 결제 여부와 무관하게 반드시 열 수 있어야 한다.
- 앱 사용 중 위치만 요청하며 상시 백그라운드 위치 추적을 추가하지 않는다.

## 스택

- Expo SDK 57, React Native 0.86, React 19, TypeScript
- Expo Router
- expo-location, expo-camera
- 계획: Supabase Auth/Postgres/PostGIS, Next.js 초대·운영 웹, 역할별 Cloud Run API/worker, Cloud Scheduler/Tasks와 private Google Cloud Storage

## 개발 규칙

- SDK API를 사용하기 전 `https://docs.expo.dev/versions/v57.0.0/`의 정확한 버전 문서를 확인한다.
- 잠금 해제, 날짜, 반경, 필요 인원은 서버가 최종 판정한다. 클라이언트 계산은 UX 미리보기일 뿐이다.
- 공개 전 GCS object 경로나 signed URL을 클라이언트에 보내지 않는다.
- 사용자의 현재 좌표 원문은 불필요하게 저장하지 않는다.
- MVP 기능을 추가할 때 초대 수락률, 기여 완료율, 현장 공개 성공률 중 어느 지표를 검증하는지 명시한다.
