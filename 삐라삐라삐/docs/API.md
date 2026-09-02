# API 요약

기본 로컬 주소: http://localhost:4200

| Method | Path | 설명 |
|---|---|---|
| GET | /health | 상태 확인 |
| POST | /v1/session | 익명 세션 생성 |
| GET | /v1/regions | 시·구별 활성 삐라 수 |
| GET | /v1/wallet | 무료·유료 이용권 조회 |
| POST | /v1/purchases/grant | 검증된 주문 이용권 지급 |
| POST | /v1/flyers | 이용권 소진 및 삐라 발송 |
| GET | /v1/me/flyers | 내가 날린 삐라 |
| GET | /v1/found-flyers | 내가 주운 삐라 |
| POST | /v1/hunts | 지역 탐색 시작 |
| POST | /v1/hunts/:id/scan | 위치 기반 주변 확인 |
| POST | /v1/claims | 선착순 획득 |
| POST | /v1/found-flyers/:id/reports | 신고 |

인증 API는 X-User-Key 헤더를 사용합니다.

## 주요 오류

- NO_FLYER_CREDIT: 무료와 유료 이용권 없음
- CONTENT_REJECTED: 운영정책 위반 문구
- INVALID_REGION: 지원하지 않는 지역
- IAP_ORDER_NOT_VERIFIED: 결제 주문 검증 실패
- ORDER_ALREADY_USED: 다른 사용자에게 지급된 주문
- LOCATION_ACCURACY_LOW: 위치 정확도 부족
- FLYER_ALREADY_CLAIMED: 다른 사용자가 먼저 획득

정확한 낙하 좌표, 암호화 본문, 원본 사용자 키는 공개 응답에 포함하지 않습니다.
