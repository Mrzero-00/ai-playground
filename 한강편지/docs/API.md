# MVP API 요약

모든 응답은 JSON이며 사용자별 요청은 `X-User-Key` 헤더를 사용합니다. 서버는 원본 키를 저장하지 않고 서비스 전용 SHA-256 다이제스트로 한 번 더 가명처리합니다.

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | API 상태 확인 |
| POST | `/v1/session` | 익명 사용자 세션 초기화 |
| GET | `/v1/parks` | 공원 중심점·운영 상태·미획득 편지 개수 |
| POST | `/v1/letters` | 편지 검수 및 표류 시작 |
| GET | `/v1/me/letters` | 내가 띄운 편지 상태 |
| GET | `/v1/found-letters` | 내가 획득한 편지 목록·본문 |
| POST | `/v1/hunts` | 공원 탐색 세션 시작 |
| POST | `/v1/hunts/:id/scan` | 현재 위치로 숨은 편지 판정 및 발견 증표 발급 |
| POST | `/v1/claims` | 발견 증표를 사용한 독점 획득 트랜잭션 |
| POST | `/v1/found-letters/:id/reports` | 획득 편지 신고와 즉시 숨김 |

## 공개하지 않는 데이터

`/v1/parks`는 지도 표시용 공원 중심점만 반환합니다. 편지별 목표 좌표, 목표까지의 거리·방향·경로, 다른 사용자의 위치·신원·획득 이력은 어떤 공개 API에서도 반환하지 않습니다.

`scan`은 발견 여부, 2분 유효 발견 증표, 시각 연출용 난수만 반환합니다. 발견 실패 시에도 근접 거리나 방향을 추론할 수 있는 값을 제공하지 않습니다.

## 주요 오류 코드

- `OUTSIDE_PARK`: 선택한 공원 밖에서 탐색
- `LOCATION_ACCURACY_LOW`: 위치 정확도 50m 초과
- `NO_LETTER_DETECTED`: 획득 반경 안에 편지 없음
- `CLAIM_TOKEN_EXPIRED`: 발견 증표 만료
- `LETTER_ALREADY_CLAIMED`: 다른 사용자가 먼저 획득
- `SELF_CLAIM_NOT_ALLOWED`: 발신자가 자신의 편지를 획득하려 함
- `CONTENT_REJECTED`: 연락처·링크·만남 유도 형식 검수 실패
