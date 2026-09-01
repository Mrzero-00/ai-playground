# 묻어두지 Product Requirements Document

| 항목 | 내용 |
|---|---|
| 문서 상태 | MVP 기준선 v1.0 |
| 기준일 | 2026-09-02 |
| 입력 문서 | `묻어두지 서비스 기획서` Concept 1.0 (2026-09-01) |
| 대상 출시 | 대한민국 18세 이상 대상 비공개 파일럿 |
| 제품 오너 | 프로젝트 오너 |
| 구현 기준 문서 | 이 문서 |
| 기술 설계 | [architecture.md](architecture.md) |
| 실행 순서 | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |

> 지금 묻고, 그때 만나서 열자.

## 0. 이 문서를 사용하는 방법

이 문서는 콘셉트 소개서가 아니라 제품·디자인·개발·QA가 같은 결과를 만들기 위한 실행 기준이다.

- `MUST` 요구사항은 MVP 출시 전에 충족해야 한다.
- `SHOULD` 요구사항은 일정 위험이 생기면 제품 오너 승인 후 다음 버전으로 미룰 수 있다.
- `LATER` 요구사항은 MVP 코드 경로에 미리 넣지 않는다.
- 구현 작업과 PR에는 관련 요구사항 ID를 적는다.
- 요구사항과 코드가 충돌하면 임의로 코드를 맞추지 않고 이 문서의 결정 기록을 먼저 갱신한다.
- 수치가 없는 “빠르게”, “안전하게”, “편리하게” 같은 표현은 완료 기준으로 사용하지 않는다.

## 1. 제품 요약

### 1.1 한 줄 정의

친구·연인·가족이 메시지와 사진을 미래에 묻고, 약속한 날짜와 장소에 필요한 인원이 함께 모여야 열 수 있는 비공개 소셜 캡슐 앱이다.

### 1.2 문제

사람들은 “다음에 보자”고 말하지만 구체적인 다음 만남으로 이어지지 않는 경우가 많다. 단체 대화방에 쌓인 사진과 메시지는 빠르게 밀려나고, 다시 만날 이유를 만들지는 못한다.

기존 타임캡슐은 장기 보관과 회상에 집중하고, 메신저는 즉시성에 집중한다. 묻어두지는 짧은 콘텐츠를 일부러 기다리게 하고 현장 공개 조건을 붙여, 현재의 장난을 미래의 오프라인 약속으로 바꾼다.

### 1.3 가치 제안

- 저장공간이 아니라 기다리는 재미를 제공한다.
- 과거 기록보다 다음 만남을 만든다.
- 공개 피드가 아니라 초대한 관계 안에서만 동작한다.
- 감정적으로는 조금 귀찮게 하되 기술적인 실패로 사용자를 막지 않는다.

### 1.4 북극성 지표

**최근 28일간 성사된 유효 현장 공개 수(Rolling 28-day Qualified Meetup Opens)**

다음 조건을 모두 만족한 고유 구덩이 수로 계산한다.

1. 서버 기준 공개 시각 이후다.
2. 설정한 필요 인원 이상이 15분 이내에 체크인을 완료했다.
3. 서로 다른 2명 이상이 같은 15분 세션에 참여했고, 최소 1명은 GPS로 현장 조건을 확인했다.
4. 공동 카운트다운 이후 콘텐츠가 한 번 이상 공개됐다.

앱 체류시간은 북극성 지표로 사용하지 않는다.

이 지표는 같은 시간·장소의 공개를 관찰할 뿐 앱이 만남의 원인이었음을 직접 증명하지 않는다. 인과성은 공개 후 24시간 안에 “묻어두지가 없었어도 이번에 만났을 것인가”를 묻는 선택 설문으로 보조 측정하고 응답률을 함께 보고한다.

## 2. 목표와 비목표

### 2.1 MVP가 검증할 가설

| ID | 가설 | 판단 지표 |
|---|---|---|
| H-01 | 구체적인 미래 날짜와 장소가 있으면 초대가 실제 약속으로 인식된다. | 초대 수락률 60% 이상 |
| H-02 | 서로의 내용을 볼 수 없는 짧은 기여 방식이 참여 부담을 낮춘다. | 가입 참여자의 기여 제출률 70% 이상 |
| H-03 | 30일의 기다림 후에도 그룹이 현장 공개를 완료한다. | 공개 예정 구덩이의 현장 공개 성공률 90% 이상 |
| H-04 | 공개 경험이 다음 약속으로 이어진다. | 공개 후 7일 내 다음 구덩이 발행률 20% 이상 |

위 수치는 50개 팀 규모의 방향성 판단 기준이다. 통계적 확정값이나 대외 마케팅 주장으로 사용하지 않는다.

### 2.2 MVP 목표

- 2~8명의 비공개 그룹이 `한 달 뒤 우리 예언` 구덩이를 만들 수 있다.
- 초대받은 사용자가 앱 설치 전에도 내용을 확인하고 참여할 수 있다.
- 각 참여자가 텍스트와 사진 한 장을 비공개로 제출할 수 있다.
- 서버가 기여 마감, 봉인, 공개 가능 시각과 참석 조건을 최종 판정한다.
- 공개일에 foreground 위치와 보조 수단으로 현장 공개를 완료할 수 있다.
- 실패한 위치 확인, 인원 부족, 권한 거부 상황에서 복구 경로를 제공한다.
- 초대, 기여, 봉인, 현장 공개, 재생성 퍼널을 개인정보 침해 없이 측정할 수 있다.

### 2.3 MVP 비목표

- 공개 피드, 공개 프로필, 팔로우, 공개 지도
- 음성·영상 콘텐츠
- 여러 캡슐 놀이와 점수·순위
- 결제, 구독, 장기 보관 상품
- AI 편지 작성 또는 얼굴·인물 분석
- 상시 백그라운드 위치 수집
- NFC, 블루투스 근거리 인증, 위치 위조 탐지 시스템
- 18세 미만 사용자와 기업·대규모 행사
- 영구 보관 또는 10년 이상 보존 약속

## 3. 대상 사용자와 핵심 과업

### 3.1 초기 사용자

- 대한민국에 거주하는 18~34세 사용자
- 2~8명의 친한 친구, 커플, 성인 가족
- 30~180일 안에 다시 만날 이유가 있는 관계
- 카카오톡 등 메신저로 초대 링크를 주고받는 모바일 중심 사용자

파일럿에서는 만 18세 이상만 가입할 수 있다. 미성년자 지원은 보호자 동의, 신고, 보존 정책이 별도로 준비된 이후 검토한다.

### 3.2 역할

| 역할 | 설명 | 핵심 권한 |
|---|---|---|
| 방장 | 구덩이를 생성한 사용자 | 설정 확정, 초대, 마감 전 취소와 재생성 |
| 참여자 | 유효한 초대로 가입한 사용자 | 본인 기여 작성·수정, 체크인, 다음 현장 시도 공유 |
| 운영자 | 신고와 장애를 처리하는 최소 권한 담당자 | 메타데이터 조회, 신고 콘텐츠 격리, 감사 로그 확인 |

방장도 다른 참여자의 봉인 전·후 콘텐츠를 볼 수 없다.

### 3.3 Jobs to be Done

1. 친구들과 헤어지기 전에 다음에 다시 만날 구체적인 약속을 만들고 싶다.
2. 지금의 장난이나 예측을 다른 사람에게 들키지 않고 남기고 싶다.
3. 공개일까지 약속을 잊지 않되 내용을 미리 보고 싶지는 않다.
4. 공개일에는 기술 문제로 분위기를 망치지 않고 함께 열고 싶다.
5. 공개가 끝난 직후 다음 만남을 자연스럽게 정하고 싶다.

## 4. 출시 단계와 범위

| 단계 | 목적 | 포함 범위 | 종료 조건 |
|---|---|---|---|
| V0 클릭형 프로토타입 | 핵심 흐름과 말투 검증 | 로컬 생성, 카메라, 위치 미리 확인, 대기 화면 | 5팀 사용성 테스트 완료 |
| V1 비공개 MVP | 실제 30일 약속 검증 | 인증, 초대 웹, 텍스트+사진 1장, 서버 봉인, 알림, 위치+QR 현장 공개, 기본 신고·삭제 | 출시 게이트 충족 |
| V1.1 반복 개선 | 공개 재미와 복구 강화 | 반응, 결과 카드, 캘린더, 재예약 투표 | 반복률 개선 확인 |
| V2 수익 검증 | 결제 의향 검증 | 큰 구덩이, 음성·영상, 특별 규칙 | 가격 실험 별도 승인 |

현재 저장소의 앱은 V0이며 V1의 서버 동작을 모사하지 않는다.

## 5. 대표 사용자 흐름

### 5.1 방장: 만들고 초대하기

1. 로그인한다.
2. `한 달 뒤 우리 예언`을 선택한다.
3. 제목, 공개일, 장소, 필요 인원, 기여 마감을 정한다.
4. 개인정보·위치 노출 범위를 확인하고 구덩이를 만든다.
5. 본인 기여를 작성한다.
6. 초대 링크를 시스템 공유창으로 보낸다.
7. 기여 현황만 확인하고 마감 또는 자동 봉인을 기다린다.

### 5.2 참여자: 초대받고 기여하기

1. 메신저에서 초대 링크를 연다.
2. 로그인 전에는 방장 닉네임, 구덩이 제목, 공개일, 대략적인 지역, 참여 인원만 본다.
3. 이메일 OTP로 인증하고 닉네임을 정한다.
4. 참여에 동의한 뒤 텍스트와 사진 한 장을 제출한다.
5. 마감 전까지 본인 기여만 수정하거나 삭제한다.
6. 봉인 후에는 본인 내용도 다시 볼 수 없다.

### 5.3 그룹: 기다리고 현장에서 열기

1. 참여자는 봉인 직후와 공개 7일·1일 전·당일 알림을 받는다.
2. 공개일 이후 앱을 연 상태에서 위치 권한을 허용하고 체크인한다.
3. 서버가 날짜, 위치, 체크인 유효시간, 필요 인원을 판정한다.
4. 조건이 모호하거나 실패하면 재측정·QR·설정 변경 없는 다음 현장 시도 공유 경로를 사용한다.
5. 조건 충족 후 모든 체크인 사용자에게 같은 10초 카운트다운을 보여준다.
6. 콘텐츠를 한 장씩 공개하고 다음 구덩이 만들기를 제안한다.

## 6. 핵심 정책

| 정책 | MVP 결정 |
|---|---|
| 그룹 크기 | 방장 포함 2~8명 |
| 놀이 | `한 달 뒤 우리 예언` 한 가지 |
| 공개 시점 | 생성 시점으로부터 30~180일, 08:00~23:00 KST의 30분 단위 시각 선택, 서버에는 UTC와 `Asia/Seoul` 저장 |
| 장소 | 지도 핀 또는 현재 위치, 멤버 가입 후에만 정확한 위치 표시 |
| 공개 반경 | 사용자가 바꿀 수 없는 고정 150m |
| 위치 정확도 | 오차가 없거나 80m를 초과하면 판정 보류 |
| 기여 | 사용자당 텍스트 1개와 사진 0~1장, 둘 중 텍스트는 필수 |
| 텍스트 제한 | 공백 제외 1~180자 |
| 사진 제한 | JPEG/HEIC/PNG, 10MB 이하 입력, 서버 정규화 후 4MB 이하 |
| 기여 마감 | 생성 후 1·3·7·14일 중 선택, 공개 시점보다 먼저 종료 |
| 봉인 | 마감 시 서버가 자동 봉인, 마감 전에는 본인 기여 수정·삭제 가능 |
| 공개 조건 | 2명 이상·과반수·전원 중 선택, 어떤 경우에도 최소 2명 |
| 체크인 유효시간 | 첫 유효 GPS가 연 공개 세션 시작부터 15분; 세션 안의 모든 체크인은 같은 만료 시각 사용 |
| 공개 후 접근 | 30일간 열람·다운로드 후 자동 삭제 예정 고지 |
| 미공개 보존 | 공개 예정 시각 후 90일까지 재시도 가능, 이후 콘텐츠와 장소 삭제 |
| 공개 후 위치 | 한 번 정상 공개된 뒤에는 활성 멤버가 장소 밖에서도 열람 가능 |
| 봉인 후 멤버 | 봉인 시점의 수락 멤버를 스냅샷으로 고정하고 이후 신규 참여 금지 |
| 서비스 언어·지역 | 한국어, 대한민국 파일럿 |
| 연령 | 만 18세 이상 |

공개 후 30일 보존은 비용과 개인정보를 함께 줄이기 위한 MVP 기본값이다. 사용자 조사 결과에 따라 출시 전 조정할 수 있으나 UI, 정책, 서버 TTL은 반드시 같은 값이어야 한다.

## 7. 상태 모델

### 7.1 구덩이 상태

```text
draft
  └─ publish ─> collecting
                    ├─ cancel / insufficient at deadline ─> canceled
                    └─ contribution deadline ─> sealed
                                                   ├─ countdown finalized ─> opened ─> archived
                                                   └─ reveal time + 90 days ─> expired

canceled | expired ─> purge_pending ─> deleted
```

| 상태 | 사용자에게 보이는 의미 | 서버 규칙 |
|---|---|---|
| `draft` | 아직 초대하지 않은 작성 중 구덩이 | 방장만 접근, 서버 잠금 없음 |
| `collecting` | 친구가 참여하고 내용을 넣는 중 | 본인 기여만 읽기·수정·삭제 가능 |
| `sealed` | 두지가 묻었고 기다리는 중 | 어떤 멤버도 콘텐츠 본문·미디어 URL 조회 불가 |
| `opened` | 카운트다운까지 끝난 공동 공개 | 멤버만 콘텐츠와 짧은 수명 미디어 URL 접근 |
| `archived` | 열람 기간 종료 | 콘텐츠 삭제, 비식별 집계만 보존 |
| `canceled` | 봉인 전 취소 또는 최소 조건 미달 | 업로드 콘텐츠와 초대 토큰 삭제 대기 |
| `expired` | 공개 예정 시각 후 90일 동안 열지 못함 | 콘텐츠와 정확한 장소 삭제 대기 |
| `purge_pending` | 삭제 작업 진행 중 | 사용자 접근 거부, 재실행 가능한 삭제 작업만 허용 |
| `deleted` | 삭제 완료 | 법정·비식별 최소 기록만 보존 |

`unlockable`은 DB에 저장하는 상태가 아니다. `state=sealed AND server_now>=reveal_at` 조건으로 요청마다 계산해 예약 작업 누락이나 클라이언트 시계 조작의 영향을 받지 않게 한다.

마감 시 활동 멤버 또는 제출된 기여가 2개 미만이면 `canceled`로 전환하고 24시간 안에 콘텐츠를 삭제한다. 방장에게 같은 설정으로 새 구덩이를 만드는 CTA를 제공한다. 이미 봉인된 구덩이는 결제 여부 때문에 막거나 취소하지 않으며, 공개 예정 시각 후 90일 동안 현장 공개를 재시도할 수 있다.

### 7.2 기여 상태

```text
editing -> submitted -> sealed -> revealed
    └──────── delete request ────────> deleted
submitted | sealed | revealed -> quarantined -> restored | deleted
```

- `editing`: 작성자만 접근하며 제출 전 임시 업로드는 24시간 후 삭제한다.
- `submitted`: 마감 전 작성자가 수정·삭제할 수 있다.
- `sealed`: 메타데이터만 보이고 본문과 미디어는 누구에게도 반환하지 않는다.
- `revealed`: 구덩이 멤버에게만 반환한다.
- `quarantined`: 신고 검토를 위해 멤버 접근만 임시 차단한 복구 가능 상태다. 이전 상태를 별도 필드에 보존한다.
- `restored`: 신고가 기각된 전이 이벤트이며 최종 영속 상태로 저장하지 않는다. 현재 pit이 collecting이면 `submitted`, sealed이면 `sealed`, opened이고 보존기한 안이면 `revealed`로 돌아간다. 그 밖에는 복구하지 않고 삭제한다.
- `deleted`: 작성자·계정 삭제 또는 위반 확정으로 콘텐츠를 물리 삭제하고 대체 카드만 표시한다.

### 7.3 서버 권위

클라이언트 시간, 클라이언트 상태, 로컬 거리 계산은 화면 안내용이다. 다음 항목은 하나의 서버 트랜잭션 또는 권한 검증 함수가 최종 결정한다.

- 기여 마감과 봉인 가능 여부
- 공개 가능 시각
- 멤버십과 초대 유효성
- 위치 반경과 GPS 정확도
- 체크인 유효시간과 참석 정족수
- private GCS 접근 URL 발급

### 7.4 정족수와 공개 세션

- 봉인 시점의 `accepted` 멤버를 공개 자격 스냅샷으로 고정한다. 미수락 초대는 분모에서 제외한다.
- 방장도 스냅샷 멤버 한 명으로 계산한다.
- 과반수는 `floor(N/2)+1`로 계산한다.
- 한 멤버는 한 공개 세션에서 체크인 하나만 정족수에 기여한다.
- 첫 유효 GPS 체크인이 15분짜리 `active` 공개 세션을 생성하거나 기존 세션에 합류한다. 모든 체크인의 만료 시각은 공개 세션 만료 시각과 같다.
- 체크인 RPC는 구덩이 행을 잠근 뒤 `active.expires_at<=server_now`인 세션을 먼저 `expired`로 바꾸고 새 세션을 찾거나 만든다. 만료된 행은 활성 세션 유일 제약의 대상이 아니다.
- 정족수는 활성 세션 만료 전에만 충족할 수 있다. 충족 트랜잭션은 참석 멤버와 확인 방식을 고정하고 공개 세션만 `countdown`으로 바꾼 뒤 `countdown_ends_at=server_now+10 seconds`를 기록한다. 구덩이는 계속 `sealed`다.
- `countdown`이 시작되면 새 체크인을 받지 않고 활성 세션의 15분 만료를 적용하지 않는다. `expires_at`은 최소한 `countdown_ends_at`까지 연장하며, 작업 지연과 재접속이 있어도 고정된 참석 집합으로 완료한다.
- `server_now >= countdown_ends_at`인 멱등 `finalize_open`만 공개 세션과 구덩이를 함께 `opened`로 바꾼다.
- 공개 자격 멤버 수 `N`은 봉인 스냅샷에서 탈퇴·삭제된 멤버를 제외해 계산한다. `2명 이상=2`, `과반수=floor(N/2)+1`, `전원=N`이며 `N>=2`일 때 최소값은 2다.
- `N=1`이면 공개일 이후 남은 멤버가 GPS 조건을 통과한 뒤 같은 카운트다운으로 본인 콘텐츠를 복구할 수 있다. 공개 사유를 `solo_recovery`로 기록하고 북극성 지표에서 제외한다.
- GPS 확인 멤버가 발급한 QR 체크인은 정족수에는 포함되지만 GPS 체크인으로 집계하지 않는다.

## 8. 기능 요구사항

### 8.1 계정과 멤버십

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| ACC-01 | MUST | 사용자는 이메일 OTP로 가입·로그인한다. | 유효 OTP는 10분 안에 1회만 사용할 수 있고, 만료·재사용·오입력 오류가 구분된다. |
| ACC-02 | MUST | 최초 로그인 시 닉네임과 만 18세 이상 자기 확인을 받는다. | 닉네임은 2~20자이며 금칙어·공백만 입력을 거부한다. 미동의 사용자는 서버가 프로필·멤버십 생성을 거부하고 임시 인증 데이터를 24시간 안에 삭제한다. |
| ACC-03 | MUST | 사용자는 모든 세션에서 로그아웃할 수 있다. | 로그아웃 후 새 private API와 signed URL 발급은 즉시 거부된다. 이미 발급된 URL은 최대 5분 안에 만료된다. |
| ACC-04 | MUST | 사용자는 앱 설정과 공개 웹 페이지에서 계정 삭제를 요청할 수 있다. | 재인증 후 로그인 토큰과 새 접근 권한은 즉시 폐기되고 활성 시스템 데이터는 7일 안에 삭제·익명화된다. 백업 잔존분은 30일 안에 만료된다. collecting 소유 구덩이는 취소한다. sealed/opened는 남은 활성 멤버가 있으면 가장 먼저 가입한 멤버에게 이전하고, 없으면 즉시 `purge_pending`으로 보내 모든 기여를 삭제한다. |
| ACC-05 | MUST | 멤버십은 구덩이 단위로 권한을 제한한다. | 비멤버가 ID를 추측해도 구덩이·기여·정확한 장소를 조회할 수 없다. |
| ACC-06 | MUST | 사용자는 참여 중인 구덩이에서 탈퇴할 수 있다. | collecting 참여자는 본인 기여를 즉시 삭제하고 탈퇴한다. collecting 방장은 취소 전에는 탈퇴할 수 없다. sealed/opened에서는 본인 기여와 접근 권한을 삭제하고 7.4의 정족수 복구를 적용한다. 방장이면 남은 활성 멤버에게 이전하고, 남은 멤버가 없으면 pit을 `purge_pending`으로 보낸다. |

### 8.2 구덩이 생성

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| PIT-01 | MUST | 방장은 제목, 공개 시점, 장소, 필요 인원, 기여 마감을 입력한다. 공개 반경은 서버가 150m로 고정한다. | 필수값이 없거나 정책 범위를 벗어나거나 반경을 임의 전송하면 발행 API가 거부한다. |
| PIT-02 | MUST | 공개 시점은 생성 후 30~180일이며 KST 08:00~23:00의 30분 단위로 고른다. | 경계값 30일 미만·180일 초과와 허용 시간 밖 입력은 서버가 거부하며 UTC 변환 왕복 후 같은 KST를 표시한다. |
| PIT-03 | MUST | 장소 입력은 현재 위치 또는 지도 핀을 지원한다. | 저장 전 지도와 지역 라벨로 사용자가 핀을 확인할 수 있다. |
| PIT-04 | MUST | 가입 완료 멤버는 전용 장소 화면에서 정확한 지도 핀을 볼 수 있다. | 비멤버 API, 초대 미리보기, 푸시 본문, 분석 이벤트, 로그에는 핀과 위·경도가 없다. UI에는 원시 숫자 좌표를 표시하지 않는다. |
| PIT-05 | MUST | 방장은 봉인 전까지만 구덩이를 취소할 수 있다. | 취소 확인 후 초대 토큰이 폐기되고 임시·제출 콘텐츠가 삭제된다. |
| PIT-06 | LATER | 발행 후 날짜·장소·필요 인원 변경은 후속 버전에서 참여자 재동의와 함께 지원한다. | MVP에서는 변경 API가 거부되며 방장은 봉인 전에 취소 후 새 구덩이를 만들어야 한다. |

### 8.3 초대와 참여

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| INV-01 | MUST | 방장은 시스템 공유창으로 초대 링크를 보낸다. | 최초 링크는 `/i/:token` 형식이고 토큰 원문은 DB에 저장하지 않는다. 서버는 토큰을 검증해 짧은 수명의 초대 세션으로 교환한 뒤 토큰 없는 `/i`로 303 redirect한다. |
| INV-02 | MUST | 로그인 전 초대 웹은 최소 정보만 보여준다. | 제목, 방장 닉네임 일부, 공개일, 구·동 수준 지역, 현재 인원만 보이며 정확한 좌표와 콘텐츠는 없다. |
| INV-03 | MUST | 초대 토큰은 난수성이 충분하고 취소·만료할 수 있다. | 128비트 이상 엔트로피, DB 해시 저장, 남은 좌석 수 이내의 사용 제한, 기여 마감 시 만료를 자동 검증한다. 최초 요청 뒤 브라우저 URL에서 제거하고 `HttpOnly; Secure; SameSite=Lax` 초대 세션만 사용한다. 응답은 `Referrer-Policy: no-referrer`, `Cache-Control: no-store`이며 CDN·서버·APM은 원문 경로를 `/i/:token`으로 치환해 기록한다. |
| INV-04 | MUST | 동일 사용자의 중복 참여를 막는다. | 같은 구덩이에 계정당 하나의 활성 멤버십만 생성된다. |
| INV-05 | MUST | 그룹 정원 8명을 원자적으로 적용한다. | 동시 수락에서도 9번째 참여자는 명확한 정원 초과 화면을 본다. |
| INV-06 | MUST | 모바일 웹에서 가입과 첫 기여를 완료할 수 있다. | 앱 미설치 사용자가 초대 열기부터 제출까지 앱 설치 강제 화면 없이 완료하고, 이후 앱 로그인 시 같은 멤버십과 기여를 본다. |
| INV-07 | MUST | 방장은 봉인 전 초대 링크를 회전하거나 멤버를 제거할 수 있다. | 제거 즉시 해당 멤버 세션과 접근 권한을 폐기하고 기여를 삭제한다. 봉인 후에는 제거 대신 신고·차단만 제공한다. |

공유 초대 경로 `/i/*`는 iOS Universal Links와 Android App Links의 앱 연결 대상에서 제외해 설치 여부와 관계없이 먼저 모바일 웹에서 연다. 웹에서 참여 수락을 완료한 뒤에만 60초·1회용 해시 저장 app-handoff 코드를 발급한다. `/app/h/:code`는 앱으로 열고 앱은 로그인 사용자와 멤버십을 재검증해 코드를 소비한 뒤 즉시 tokenless pit route로 교체한다. 브라우저 fallback을 포함한 `/app/h/*` 응답에도 `Referrer-Policy: no-referrer`, `Cache-Control: no-store`를 적용하고 CDN·서버·APM은 원문 코드를 `/app/h/:code`로 치환한다. raw 초대 토큰과 handoff 코드는 앱·웹 로그, 분석, 영속 저장에 넣지 않는다.

### 8.4 기여와 봉인

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| CON-01 | MUST | 참여자는 텍스트와 선택 사진 한 장을 제출한다. | 텍스트 길이와 파일 형식·용량을 클라이언트와 서버에서 동일하게 검증한다. |
| CON-02 | MUST | 참여자는 마감 전 본인 기여만 조회·수정·삭제한다. | 다른 멤버와 방장이 API·GCS object 경로를 통해 접근할 수 없다. |
| CON-03 | MUST | 사진은 외부 검사 전에 EXIF 위치정보를 제거하고 정규화한다. | 원본을 MIME sniffing·decode·악성 파일 검사한 뒤 EXIF를 제거해 재인코딩한 임시본만 SafeSearch에 전송한다. 외부 요청과 최종 파생 이미지에서 GPS EXIF가 검출되지 않고 원본·검사용 임시 객체는 처리 직후, 실패해도 24시간 안에 삭제된다. |
| CON-04 | MUST | 업로드 실패는 재시도 가능하며 중복 기여를 만들지 않는다. | 동일 idempotency key 재시도 시 하나의 기여와 하나의 활성 미디어만 남는다. |
| CON-05 | MUST | 텍스트 제출과 사진 처리 상태를 분리한다. | 텍스트는 사진 처리 중에도 제출할 수 있다. 마감까지 처리 완료된 사진만 봉인하며 pending 사진 job은 취소·삭제하고 사진 없이 봉인됐음을 알린다. 삭제·탈퇴·취소·마감과 경쟁한 worker가 final 객체를 다시 연결하지 못한다. |
| SEAL-01 | MUST | 서버는 마감 시각에 활동 멤버와 제출 기여가 각각 2개 이상이면 자동 봉인하고, 아니면 자동 취소한다. | 예약 작업 중복 실행에도 상태 전이는 한 번만 기록되고 취소 데이터는 24시간 안에 삭제된다. |
| SEAL-02 | MUST | 봉인 후 멤버는 본인 콘텐츠도 볼 수 없다. | 본문, thumbnail, object path, signed URL 조회가 모두 거부된다. |
| SEAL-03 | MUST | 봉인 상태 변화는 감사 이벤트로 남는다. | 행위자, 이전·다음 상태, 서버 시각, 요청 ID가 기록되고 콘텐츠 본문은 기록되지 않는다. |

### 8.5 대기와 알림

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| WAIT-01 | MUST | 대기 화면은 남은 날짜, 참여·기여 여부, 장소 라벨, 공개 조건을 보여준다. | 목록·알림에는 콘텐츠 미리보기와 정확한 핀이 없고, 멤버가 전용 장소 화면을 열 때만 정확한 핀을 본다. |
| WAIT-02 | MUST | 봉인 직후와 공개 7일·1일 전·당일에 알림을 예약한다. | 사용자 시간대 기준 중복 없이 발송되며 알림 거부 사용자는 앱 내 상태로 동일 정보를 확인한다. 잠금화면 문구에는 제목·장소·멤버명이 없다. |
| WAIT-03 | MUST | 푸시 토큰 실패가 공개 상태를 바꾸지 않는다. | 알림 작업 실패 후에도 서버 상태 전이와 앱 새로고침 결과가 정확하다. |
| WAIT-04 | SHOULD | 사용자는 기기 캘린더에 약속을 추가할 수 있다. | 권한 거부 시 수동 일정 복사 경로를 제공한다. |
| WAIT-05 | MUST | 열리지 않은 구덩이의 삭제 예정 30일·7일·1일 전에 알린다. | 중복 없이 발송하고 앱 안에도 절대 삭제 시각과 남은 재시도 기간을 표시한다. |

### 8.6 체크인과 공개

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| CHK-01 | MUST | 앱을 연 상태에서만 foreground 위치를 요청한다. | iOS·Android manifest에 background/always 권한이 없고 권한 요청 전에 목적을 설명한다. |
| CHK-02 | MUST | 서버는 거리와 정확도를 함께 판정한다. | `거리+오차≤150m`는 내부, `거리-오차>150m`는 외부, 그 사이는 불확실로 반환한다. 정확도 `null` 또는 80m 초과도 불확실이다. |
| CHK-03 | MUST | 불확실 판정은 실패로 확정하지 않는다. | 사용자는 오차와 재측정 버튼을 보고 최소 3회 재시도할 수 있다. |
| CHK-04 | MUST | 첫 GPS 체크인으로 시작한 공개 세션과 그 안의 모든 체크인은 같은 15분 만료 시각을 사용한다. | 체크인 RPC가 잠금 안에서 지난 active 세션을 먼저 만료시킨다. 세션 만료 후 모든 체크인이 정족수에서 함께 제외되고 새 세션에서 다시 체크인하라는 안내가 나온다. 만료 전 정족수가 충족되면 참석 집합을 고정하고 countdown은 active TTL과 무관하게 완료된다. |
| CHK-05 | MUST | 위치 성공 멤버가 60초 유효 서버 서명 QR을 보여줄 수 있다. | 토큰은 구덩이·공개 세션·발급 멤버에 묶이고, 재사용·만료·다른 구덩이 사용은 거부되며 성공 이벤트는 감사 로그에 남는다. |
| CHK-06 | MUST | 인원 부족 시 현재 구덩이 설정을 바꾸지 않고 다음 현장 시도를 잡아 공유한다. | 서버의 공개 시각·장소·필요 인원은 변하지 않으며 멤버는 공개 예정 시각 후 90일 동안 새 세션으로 재시도할 수 있다. 조건 변경 투표는 V1.1이다. |
| REV-01 | MUST | 첫 유효 GPS 요청은 구덩이마다 하나의 활성 공개 세션을 생성하거나 재사용한다. | 동시 요청에도 `active/countdown` 세션이 하나만 존재하고 각 멤버 체크인은 하나만 정족수에 포함된다. |
| REV-02 | MUST | 정족수 충족 후 참여자에게 동일한 10초 공동 카운트다운을 보여준다. | 정족수 트랜잭션은 세션만 `countdown`으로 바꾸고 pit은 `sealed`로 유지한다. 재접속 사용자는 서버 시각 기준 남은 시간에 합류한다. |
| REV-03 | MUST | 카운트다운 종료 후 `finalize_open`이 pit과 세션을 함께 `opened`로 바꾸고 콘텐츠 접근을 연다. | 종료 전 본문·object key·signed URL 요청은 거부된다. URL은 5분 이하로 만료되고 비멤버·만료 URL 접근은 거부된다. |
| REV-04 | MUST | 마지막 화면에서 다음 구덩이 생성 흐름으로 연결한다. | 이전 멤버·장소를 복사할지 명시적으로 선택하며 콘텐츠는 복사하지 않는다. |

### 8.7 삭제, 신고와 운영

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| SAFE-00 | MUST | raw 임시 업로드를 받기 전에 금지 행위가 명시된 이용 규칙에 동의하고, 기여에 사진을 연결·봉인하기 전에 서버 검사를 통과한다. | 미동의 요청은 upload intent를 만들지 않는다. 금지 파일·악성 파일·승인된 차단어 규칙을 거부한다. 사진은 Google Cloud Vision SafeSearch의 `adult`, `racy`, `violence`가 `LIKELY` 이상이면 거부한다. 검사 실패 시 사진 없이 제출하거나 재시도하며 검사 로그에 원문이 없다. |
| SAFE-01 | MUST | 사용자는 어느 상태에서나 본인 기여 삭제를 요청할 수 있다. | 삭제 RPC는 새 접근을 즉시 거부하고 high-priority deletion outbox를 만든다. deletion-worker가 append-only ledger를 먼저 기록하고 media-retention-worker가 GCS 원본·파생 객체를 지운 뒤 DB 삭제를 확정한다. 이미 발급된 URL은 객체 삭제 성공 즉시 404가 되거나 늦어도 5분 내 만료되며 DB·잔여 데이터는 7일 안에 삭제된다. 공개 화면에는 대체 카드만 남는다. |
| SAFE-02 | MUST | 사용자는 멤버 또는 공개된 콘텐츠를 신고할 수 있다. | 사유, 대상, 시각만 수집하며 즉시 접수 상태가 표시된다. 긴급 안전 신고는 24시간, 일반 신고는 72시간 안에 1차 처리한다. |
| SAFE-03 | MUST | 차단한 사용자와는 새 구덩이에 함께 가입할 수 없고 직접 알림을 주고받지 않는다. | 기존 collecting/sealed 구덩이의 멤버십·정족수는 자동 변경하지 않는다. 차단한 사용자의 공개 콘텐츠는 차단자에게 기본 숨김 처리하고, 차단 사실은 상대에게 알리지 않는다. 사용자가 탈퇴하면 7.4의 정족수 재계산을 적용한다. |
| OPS-01 | MUST | 운영자는 신고 대기열과 최소 메타데이터만 본다. | 외부 HTTPS Load Balancer IAP의 ES256 서명 JWT, 회전 JWKS, `iat`·`exp`·issuer와 backend별 exact audience를 검증하고 unsigned identity header를 거부한다. 조직 관리형 Google Cloud Identity/Workspace 계정, operator group과 강제 2-Step Verification을 통과한 뒤 report ID와 사유를 입력해야만, 다른 운영 backend와 공유하지 않는 전용 review hostname의 media-review-api가 Domain 없는 host-only Secure·HttpOnly·SameSite=Strict cookie의 60초·1회용 열람 session을 발급한다. 소비 시 현재 IAP subject와 발급 대상이 일치해야 정확한 격리 객체 generation을 `no-store` proxy stream한다. GCS URL·object key는 반환하지 않고 실제 열람을 감사하며 raw/final/list 접근은 불가능하다. |
| OPS-02 | MUST | 운영자는 콘텐츠를 복구 가능한 상태로 격리하고 계정을 제한할 수 있다. | ops-api가 IAP subject를 active reviewer/admin 역할에 매핑하고 사유·report와 함께 허용된 job/제한/종결 RPC만 실행한다. 모든 변경 요청은 GET을 금지하고 exact ops-web HTTPS Origin, same-origin Fetch Metadata, IAP subject-bound 단기 CSRF header를 DB 호출 전에 검증한다. 격리 즉시 새 본문·signed URL 접근을 차단하고 이전 상태, 조치 이유, 담당자, 시각, 복구 여부가 감사 로그에 남는다. 이미 발급된 URL은 최대 5분 안에 만료된다. 기각 시 현재 pit 상태와 보존기한에 맞게 복구하고, 위반 확정 시 24시간 안에 물리 삭제한다. |
| OPS-03 | MUST | 장애 시 봉인된 콘텐츠의 공개 약속을 보호한다. | 알림 장애와 결제 상태가 열람 권한을 영구 차단하지 않는다. |

raw 임시 업로드 전 사용자는 금지 콘텐츠가 명시된 이용 규칙과 이미지 안전 검사를 위한 Google Cloud 처리에 동의한다. 서버는 원본에서 EXIF를 제거하고 재인코딩한 검사용 임시 이미지만 SafeSearch에 전송하며, 검사를 통과하기 전에는 사진을 기여에 연결하거나 봉인하지 않는다. 원본과 위치 메타데이터를 외부 분석·로그에 남기지 않는다. Google Cloud 데이터 처리 조건과 하위 처리자 고지는 외부 파일럿 전 승인한다. 신고, 사용자 차단, 공개 연락처와 운영 응답 절차도 첫 외부 업로드 전에 동작해야 한다.

텍스트 차단어는 제품 오너와 안전 검토자가 승인한 버전 파일 `content-policy/blocked-terms.ko.json`만 사용한다. Codex가 단어 목록을 임의 작성하지 않는다. 각 규칙은 ID, locale, `exact|token|substring` match type, severity와 정규화된 값을 가진다. 입력은 Unicode NFKC, 소문자화, zero-width 제거, 연속 공백 축소 순서로 정규화한다. 목록이 비어 있거나 승인 버전·체크섬이 없으면 외부 업로드 게이트가 실패한다. 테스트 fixture는 실제 유해어 대신 합성 토큰을 사용한다.

`긴급 안전 신고`는 즉각적인 신체 위해 위협, 비동의 성적 콘텐츠 또는 현재 진행 중인 중대한 불법행위로 분류한다. SLA는 서버가 신고를 수신한 시각부터 운영자가 분류하고 필요하면 임시 격리·계정 제한을 적용하거나 사유를 남겨 일반 대기열로 전환한 시각까지다. 일반 신고도 같은 시작점에서 최초 분류·조치 기록까지를 1차 처리로 본다. `Sev-1 개인정보·봉인 사고`는 비멤버의 private 콘텐츠 또는 정확한 장소 접근, 공개 전 콘텐츠 접근, 인증 우회, 삭제된 객체의 신규 접근이 production에서 한 번이라도 확인된 사건이다.

격리 원본은 일반 멤버와 분석 시스템에서 분리된 private quarantine 경로에 둔다. 30일 안에 결론을 내리고, 미결 상태를 더 보존하려면 법적 보존 사유와 최대 1년의 만료 시각을 남겨야 한다. 기각됐더라도 원래 pit의 30일·90일 보존기한이 이미 지났으면 복구하지 않고 삭제한다. 신고 메타데이터와 조치 기록은 콘텐츠와 분리해 1년 보존한다.

### 8.8 분석

| ID | 우선순위 | 요구사항 | 인수 조건 |
|---|---|---|---|
| AN-01 | MUST | 생성→초대→기여→봉인→체크인→공개→재생성 퍼널 이벤트를 기록한다. | 이벤트 스키마 버전, 익명 사용자 ID, 구덩이 ID, 서버 시각이 있고 본문·사진·좌표는 없다. |
| AN-02 | MUST | 초대 수락률의 분모는 유효 초대 페이지를 연 고유 사용자다. | 봇과 동일 세션 반복 열기를 제외하는 쿼리가 문서화된다. |
| AN-03 | MUST | 현장 공개 성공률의 분모는 공개 시각이 지난 비취소 구덩이다. | 공개 후 7일과 90일 기준을 분리하고, 미시도·GPS 실패·인원 부족·만료를 사유별로 본다. |
| AN-04 | MUST | 위치 실패율은 판정 결과별로 측정한다. | inside/outside/uncertain/permission-denied/error를 분리하고 원좌표는 전송하지 않는다. |

## 9. 오류와 복구 기준

| 상황 | 사용자 메시지에 포함할 정보 | 필수 복구 동작 |
|---|---|---|
| 위치 권한 거부 | 권한이 필요한 이유와 수집 범위 | 설정 열기, 나중에 하기 |
| GPS 불확실 | 현재 정확도와 판정 보류 사실 | 재측정, QR 보조 확인 |
| 장소 밖 | 대략적인 거리와 목표 지역 라벨 | 지도 열기, 다시 측정 |
| 인원 부족 | 현재/필요 인원과 체크인 만료까지 남은 시간 | 친구에게 알리기, 설정을 바꾸지 않는 다음 시도 일정 공유 |
| 사진 업로드 실패 | 실패 단계와 파일 보존 여부 | 같은 파일 재시도, 사진 없이 제출 |
| 초대 만료·정원 초과 | 참여할 수 없는 구체적 이유 | 방장에게 새 링크 요청 |
| 서버 상태 지연 | 마지막 동기화 시각 | 새로고침, 네트워크 확인 |
| 신고·삭제 접수 | 처리 기한과 콘텐츠 표시 방식 | 진행 상태 보기 |

두지의 농담은 위 정보와 복구 버튼을 가리거나 대신할 수 없다.

## 10. 데이터와 개인정보

### 10.1 데이터 최소화

| 데이터 | 수집 목적 | 보존 | 접근 |
|---|---|---|---|
| 이메일 | 인증, 필수 알림 | 계정 삭제 후 7일 이내 삭제 | 본인, 인증 시스템 |
| 닉네임 | 그룹 내 식별 | 계정 수명, 삭제 후 익명화 | 같은 구덩이 멤버 |
| 약속 장소 좌표 | 현장 판정 | 공개 후 30일 또는 미공개 만료 후 즉시 삭제 | 가입 멤버, 판정 서버 |
| 현재 위치 좌표 | 순간 거리 판정 | 원문 저장하지 않음 | 판정 함수의 요청 메모리 |
| 체크인 결과·거리·정확도 | 정족수와 장애 분석 | 공개 후 30일 또는 미공개 만료 시 즉시 삭제 | 멤버 상태, 제한된 운영자 |
| 위치 이용 확인 기록 | 동의·이용 사실 확인 | 최소 6개월, 법률 검토로 최종 확정 | 위치정보 관리자 |
| 텍스트·사진 | 공동 공개 | 공개 후 30일 또는 공개 예정 시각 후 최대 90일 | 작성자(봉인 전), 멤버(공개 후) |
| 초대 토큰 해시 | 초대 검증 | 기여 마감 7일 후 삭제 | 서버 |
| 초대 세션 | tokenless 초대 미리보기·수락 | 최대 24시간, 링크 폐기·마감·수락 완료 시 즉시 만료 | 초대 웹의 HttpOnly 쿠키, 서버 |
| app handoff 해시 | 수락 뒤 앱 연결 | 60초 사용 가능, 사용·만료 기록은 24시간 안에 삭제 | 앱 연결 RPC |
| upload intent | 인증된 raw 업로드 | 10분 사용 가능, 소비·실패 metadata는 24시간 안에 삭제 | media-api |
| media 처리·운영 job | 이미지 처리, 격리·복구 재시도 | 완료·terminal metadata 30일, raw·검사용·고아 객체는 최대 24시간 | 전용 worker, 제한 운영자 상태 DTO |
| 알림 전달 기록 | 재시도·장애 분석 | delivery metadata 30일 | 알림 worker, 제한 운영자 |
| 삭제 요청 | 계정·기여·멤버십·pit 삭제 상태 | 처리 중 보존, 완료 metadata 30일; 외부 scope+HMAC ledger는 45일 | 요청자 상태 DTO, deletion worker, 복원 담당자 |
| 운영자 프로필·열람 session | 신고 처리 권한과 사유 기반 열람 | 권한 해제 즉시 비활성화; 열람 secret은 60초·1회, 감사 metadata는 1년 | IAP ops/media-review API, 제한 권한 관리자 |
| 이용 규칙 동의 기록 | UGC 업로드 근거 | 계정 수명과 삭제 후 30일 | 본인, 제한된 운영자 |
| 콘텐츠 안전 검사 결과 | 업로드 판정과 오탐 조사 | 검사 후 90일, 신고 전환 시 신고 기록 보존 적용 | 작성자 상태 DTO, 제한 운영자 |
| 사용자 차단 | 향후 상호작용 제한 | 차단 해제 또는 계정 삭제까지 | 당사자 API, 서버 |
| 신고·조치 기록 | 안전 대응과 분쟁 처리 | 해결 후 1년 | 신고자, 제한된 운영자 |
| 격리 콘텐츠 | 신고 검토와 증거 보존 | 기본 30일, 명시적 법적 보존은 만료 시각을 두고 최대 1년 | 사유를 기록한 제한 운영자 |
| 디바이스 푸시 토큰 | 알림 전달 | 로그아웃·미등록 오류 즉시 삭제, 미사용 90일 만료 | 알림 서버 |
| 감사 이벤트 | 보안·운영 조사 | 1년 | 제한된 운영자 |
| 분석 이벤트 | 제품 가설 검증 | 13개월 | 제품 분석자 |
| Sentry 오류·세션 메타데이터 | crash와 안정성 측정 | 30일 | 개발 운영자 |

### 10.2 금지 사항

- 현재 위치의 연속 수집과 이동 경로 생성
- 콘텐츠 본문·사진·정확한 좌표를 로그 또는 분석 도구에 전송
- 공개 전 thumbnail, object path, signed URL 반환
- 사적인 콘텐츠를 광고 타기팅 또는 모델 학습에 사용
- 초대 미리보기의 전체 이름과 정확한 장소 노출
- 사용자 동의 없는 연락처 업로드
- Sentry Session Replay 사용 또는 breadcrumb·tag에 제목, 본문, 장소, 초대·handoff 코드를 기록

### 10.3 삭제와 법적 문서

비공개 파일럿 시작 전에 개인정보 처리방침, 이용약관, Google Maps·Cloud Run·Cloud Storage·Cloud Vision과 Sentry의 DPA·처리 리전·하위 처리자 고지, 위치기반서비스 신고 대상 여부와 이용 확인 기록 범위, 신고 처리 기준, 데이터 삭제 절차가 담당 전문가에게 승인되어야 한다. 위치 취급대장 최소 보존은 6개월을 기본값으로 구현하되 법률 검토 결과가 더 엄격하면 그 값을 따른다. 이 PRD는 법률 자문을 대신하지 않는다.

## 11. 비기능 요구사항

| ID | 영역 | 기준 |
|---|---|---|
| NFR-01 | 가용성 | 초대 교환·수락, pit 발행, 기여 제출, 체크인, finalize, media access의 상태상 허용된 유효 요청을 분모로 최근 28일 계약상 성공 응답(2xx와 초대 교환 303) 비율 99.5% 이상. 입력/권한/상태 4xx와 의도한 rate limit은 별도 집계하며 1,000요청 미만이면 비율과 원시 건수를 함께 보고 |
| NFR-02 | 성능 | Seoul staging 또는 80ms RTT·down 10Mbps·up 5Mbps·packet loss 1% traffic shaping에서 동시 사용자 20명으로 10분 측정 시 핵심 API p95 800ms 이하, 미디어 제외 화면 첫 데이터 p95 2초 이하 |
| NFR-03 | 안정성 | Sentry Release Health 기준 production 최근 28일 지원 OS crash-free session 99.5% 이상; 1,000세션 미만이면 원시 건수를 함께 보고 |
| NFR-04 | 접근성 | 핵심 흐름 터치 대상 44pt 이상, 스크린리더 레이블, 글자 확대 200%에서 작업 완료 가능 |
| NFR-05 | 보안 | 모든 private 테이블 RLS, GCS public access prevention·uniform access·CDN 미사용, 세 media bucket의 soft delete 0초·Object Versioning off·Retention Lock/hold 미사용, 서비스 키 클라이언트 번들 금지, signed URL 5분·`no-store` |
| NFR-06 | 멱등성 | 초대 수락·기여 제출·봉인·공개 요청 재시도 시 중복 레코드 없음 |
| NFR-07 | 관측성 | 요청 ID로 API 오류, 상태 전이, 알림 작업을 연결하며 콘텐츠·좌표는 로그하지 않음 |
| NFR-08 | 호환성 | Expo SDK 57 기준 Android 7 이상, iOS 16.4 이상, 모바일 Safari·Chrome 최신 2개 버전 |
| NFR-09 | 백업 | DB 일일 백업과 복구 리허설, generation 조건부 private GCS 고아 객체 일일 정리. DB 백업에는 미디어 byte를 넣지 않고 물리 삭제된 미디어의 운영 실수 복구는 제공하지 않음. 별도 private GCS deletion-ledger에 account/contribution/membership/pit scope와 stable subject ID의 versioned HMAC만 잠긴 45일 보존으로 둠. deletion-worker는 current HMAC key만, restore-controller는 승인된 break-glass 시간창에 만료 전 key versions만 읽고 다른 caller는 거부함. `begin_restore`가 복원 mode/run ID와 global session epoch를 원자적으로 설정해 새 session을 포함한 user/anon/direct PostgREST/RPC와 일반 worker를 닫고, 동일 run ID의 전용 state/deletion/media-retention lane만 ledger·overdue TTL/media 삭제를 수행함. 부정 조회 검증 뒤 `finish_restore`가 epoch를 재전진하고 gate를 열기 전에는 일반 traffic을 허용하지 않음 |
| NFR-10 | 시간 | DB에는 UTC 저장, UI에는 명시적 KST 표시, DST 지역 확장 전 별도 설계 |
| NFR-11 | 공개 신뢰성 | 서로 다른 pit의 공개 세션 100개가 동시에 countdown을 끝내는 자동화 부하에서 100개 모두 예정 시각 후 30초 안에 정확히 한 번 `opened`로 전환되고 조기 공개·중복 전이 0건; production은 최근 28일 99% 이상을 운영 목표로 추적 |

## 12. 분석 이벤트와 성공 기준

### 12.1 이벤트 명명

| 이벤트 | 발생 시점 | 필수 속성 |
|---|---|---|
| `pit_publish_succeeded` | 구덩이 발행 완료 | pit_id, reveal_days, quorum_type |
| `invite_preview_opened` | 유효 초대 미리보기 로드 | invite_id_hash, channel |
| `invite_accepted` | 멤버십 생성 완료 | pit_id, source |
| `contribution_submitted` | 기여 제출 완료 | pit_id, has_photo |
| `pit_sealed` | 서버 자동 봉인 완료 | pit_id, member_count, contribution_count |
| `checkin_evaluated` | 서버 위치 판정 완료 | pit_id, result, accuracy_bucket |
| `pit_opened` | 공동 공개 상태 전이 | pit_id, attendee_count, gps_count, qr_count, open_reason |
| `pit_expired_unopened` | 공개 예정 시각 후 90일 만료 | pit_id, attempted_session_count |
| `next_pit_started` | 공개 후 다음 생성 시작 | source_pit_id |
| `next_pit_published` | 다음 구덩이 발행 | source_pit_id, new_pit_id |

`invite_id_hash`는 분석 전용 회전 해시이며 실제 초대 토큰 해시를 재사용하지 않는다.

북극성 쿼리는 `pit_opened` 중 `open_reason=NORMAL`, `attendee_count>=2`, `gps_count>=1`인 이벤트를 `opened_at` 기준 최근 28일 rolling window로 집계한다. `solo_recovery`와 내부 단축 테스트는 제외한다.

### 12.2 파일럿 성공 게이트

다음을 모두 충족해야 공개 베타 확대를 검토한다.

- 실제 30일 대기를 완료한 팀 10개 이상
- Sev-1 개인정보 또는 봉인 우회 사고 0건
- 초대 수락률 60% 이상
- 가입 멤버 기여 제출률 70% 이상
- 발행 구덩이 봉인 완료율 50% 이상
- 현장 공개 성공률 90% 이상
- 위치 때문에 현장 사용자가 최종 공개에 실패한 비율 5% 이하
- 공개 후 7일 내 다음 구덩이 발행률 20% 이상
- 지원 기기 crash-free session 99.5% 이상

정식 확대 판단은 고유 초대 열람 100건, 기여 대상 멤버 100명, 공개 예정 구덩이 30개 이상이 쌓인 뒤 수행한다. 10팀 파일럿은 기능과 실패 원인을 찾는 선행 게이트다. 첫 파일럿 시작 전에는 NFR-01·03의 계측 계약과 staging 부하·crash 수집 smoke, 원시 표본 건수까지만 검증한다. production 최근 28일 목표는 실제 파일럿 시작 뒤 측정하며, 28일 표본이 쌓이기 전에는 목표 달성을 주장하거나 첫 파일럿 자체를 차단하지 않고 공개 베타 확대 판단에 사용한다.

한 항목이 미달이면 자동 실패가 아니라 원인·표본 크기·데이터 품질을 함께 검토한다. 단, 개인정보 사고와 봉인 우회는 수치와 무관한 출시 차단 항목이다.

## 13. 출시 계획

최소 30일 대기 규칙 때문에 원문의 10주 계획으로는 완성된 MVP를 배포한 뒤 실제 공개까지 충분히 관찰하기 어렵다. WP-00~06, 병렬 WP-07A와 내부 E2E·외부 승인 게이트를 끝낸 뒤 실제 사용자를 받는 기준 일정은 16주로 잡는다.

| 기간 | 목표 | 산출물 |
|---|---|---|
| 1~2주 | 문제·초대·규칙 검증 | 15팀 인터뷰, PRD 기준선, 상표·정책 조사 |
| 3주 | V0 사용성 검증 | 5팀 테스트, 주요 흐름 수정 |
| 4~8주 | V1 E2E와 파일럿 안전 게이트 구현 | WP-00~06과 병렬 WP-07A: 인증, 초대, DB/RLS, 웹·앱 기여, 봉인·알림, 체크인·QR·2단계 공개, 삭제·신고·차단·콘텐츠 검사, 기본 관측성 |
| 8주 말 | 첫 파일럿 생성 | E2E 리허설, 안전·법률·하위 처리자 게이트 통과 후 실제 사용자 10팀이 30일 구덩이 생성 |
| 9~11주 | 공개 경로 하드닝 | 위치 경계·동시성·푸시 장애·관측성·운영 고도화, WP-07B 파일럿 대기 상태 모니터링 |
| 12주 | 공개 리허설 | 내부 단축 시간 환경에서 E2E·장애 훈련 |
| 13주 | 실제 공개 관찰 | 10팀 현장 관찰, 지원 기록 |
| 14주 | 결함 수정 | 위치·초대·공개 실패 우선 해결 |
| 15~16주 | 확대 판단 | 50팀 확대 또는 가설·범위 수정 결정 |

테스트 환경에서만 서버 제어 feature flag로 대기 시간을 단축할 수 있다. production 사용자의 공개 시각은 운영자나 클라이언트가 임의로 앞당길 수 없다.

## 14. 출시 게이트와 Definition of Done

### 14.1 기능 완료

- MUST 요구사항에 자동화 테스트 또는 명시적 수동 검증 기록이 있다.
- 요구사항 ID와 테스트 케이스가 추적 가능하다.
- iOS·Android·모바일 웹에서 생성→초대→기여→봉인→공개 E2E가 성공한다.
- 권한 거부, GPS 불확실, 인원 부족, 네트워크 재시도를 실제 기기에서 검증한다.

### 14.2 보안·개인정보 완료

- 비멤버·탈퇴 멤버·봉인 상태의 RLS 부정 테스트가 통과한다.
- 공개 전 GCS object path와 signed URL이 네트워크 응답에 없다.
- 앱 권한 선언에 background location, microphone, 불필요한 저장소 권한이 없다.
- 로그·분석 샘플에서 콘텐츠 본문과 정확한 좌표가 검출되지 않는다.
- 계정 및 기여 삭제 리허설이 문서화된다.
- raw/final/quarantine bucket의 soft delete 0초, Object Versioning off, retention policy·legal hold 없음과 삭제 전용 worker의 read/download/sign 거부가 인프라 drift test로 증명된다.
- 운영 조치는 IAP subject→활성 역할 매핑과 ops-api allowlist 밖에서는 불가능하고 운영자에게 DB·GCS 직접 권한이 없다. 변경 요청은 GET을 사용하지 않으며 exact Origin·same-origin Fetch Metadata·IAP subject-bound CSRF header가 없거나 불일치하면 DB 호출 전에 실패한다.
- 복원 mode 동안 새 session과 direct PostgREST/RPC를 포함한 user/anon 접근 및 일반 worker가 모두 거부되고, 동일 restore run ID의 state/deletion/media-retention lane만 동작한 뒤 `finish_restore`가 epoch를 재전진시키는 리허설이 통과한다.

### 14.3 운영 완료

- 알림 실패, 예약 작업 재실행, GCS streaming upload 중단, 공개 동시 요청 runbook이 있다.
- 신고 접수와 콘텐츠 격리를 운영자가 최소 권한으로 수행할 수 있다.
- 격리본 열람은 다른 운영 backend와 공유하지 않는 전용 review hostname의 host-only cookie에서만 가능하고, 현재 IAP subject가 발급 대상과 다르면 실패한다.
- 복구 연락 채널과 장애 공지 템플릿이 있다.
- 앱 심사 정보, 개인정보 처리방침, 이용약관이 승인됐다.

## 15. 위험과 완화

| 위험 | 조기 신호 | 완화 |
|---|---|---|
| novelty로 한 번만 사용 | 재생성률 20% 미만 | 공개 마지막 화면에서 다음 날짜를 먼저 정하고 이전 관계만 복사 |
| 가입 마찰로 초대 이탈 | 미리보기→인증 전환 급락 | 웹 완결 흐름, OTP 지연 측정, 소셜 로그인은 데이터 기반 후속 결정 |
| 위치 오판으로 현장 실패 | uncertain·permission-denied 비율 상승 | 정확도 포함 판정, 재측정, 짧은 수명 QR, 설정을 유지한 다음 현장 시도 |
| 친구 불참으로 공개 실패 | 공개 당일 정족수 미달 | 사전 RSVP, 조건 변경 없이 90일 안에 다음 현장 시도 공유 |
| 봉인 콘텐츠 유출 | GCS/IAM/RLS 부정 테스트 실패 | public access prevention, uniform IAM, server-only signed URL, 상태 기반 RLS, 감사 로그 |
| 삭제 뒤 미디어 잔존 | GCS soft delete·versioning drift 또는 삭제 worker 실패 | soft delete 0초·versioning/retention off를 release gate에서 검사하고 generation 조건부 전용 worker와 물리 삭제 E2E 운영 |
| 삭제권과 봉인 약속 충돌 | 봉인 후 삭제 요청 | 작성자 삭제를 우선하고 공개 시 대체 카드 표시 |
| 장기 보관 비용 증가 | 사용자당 저장량·고아 객체 증가 | 사진 1장 제한, 정규화, 공개 후 30일·미공개 90일 만료, 고아 객체 정리 |
| 30일 검증 주기 지연 | 파일럿 생성이 8주 이후로 밀림 | WP별 임계경로를 주 단위로 확인하고 내부 단축 테스트는 실제 대기와 병행하되 외부 안전 게이트를 생략하지 않음 |

## 16. 결정 기록

### 확정

- MVP 놀이는 `한 달 뒤 우리 예언` 한 가지다.
- 텍스트와 사진 한 장만 지원한다.
- 그룹은 2~8명, 공개는 생성 후 30~180일이다.
- 위치는 foreground에서만 요청하고 서버가 정확도와 거리를 함께 판정한다.
- 앱, 모바일 초대 웹, Supabase 기반 서버를 사용한다.
- 결제, 음성, 영상, 여러 놀이는 MVP에서 제외한다.
- 파일럿은 만 18세 이상, 한국어, 대한민국으로 제한한다.
- `unlockable`은 영속 상태가 아니라 서버 시각으로 계산하는 조건이다.
- 정상 공개 후 활성 멤버는 30일 동안 장소와 무관하게 다시 열람할 수 있다.
- 공개하지 못한 봉인 콘텐츠는 공개 예정 시각 후 90일 동안 보존한 뒤 삭제한다.
- 지도 렌더링은 `react-native-maps`의 Google provider와 플랫폼별 제한 키를 사용한다. 장소 검색은 인증·rate limit이 있는 서버 프록시가 별도 서버 제한 키로 Google Places API를 호출한다.
- Places 검색 결과는 화면에 일시 표시하고 저장하지 않는다. 서버에는 허용된 `place_id`, 사용자가 확정한 지도 핀과 직접 확인한 장소 라벨만 저장하며 Google Maps attribution을 유지한다.
- Places 프록시는 예약 outbound IP를 가진 Google Cloud Run + VPC/Cloud NAT로 실행한다. 이미지 준비·정규화도 Cloud Tasks가 호출하는 별도 Cloud Run 컨테이너 경계에서 처리한다.
- 미디어는 public access prevention·uniform access·CDN 미사용의 private Google Cloud Storage에 둔다. 세 bucket은 soft delete 0초, Object Versioning off, Retention Lock/hold 미사용을 강제한다. 업로드는 Cloud Run media-api가 10분·1회용 DB intent로 최대 10MB를 streaming하고, 다운로드만 opened 멤버에게 300초·`no-store` V4 URL로 제공한다.
- 운영 웹과 ops/media-review API는 Cloud Run 직접 IAP의 Preview 경로가 아니라 외부 HTTPS Load Balancer IAP와 조직 관리형 Google Cloud Identity/Workspace operator group을 사용한다. 조직 정책에서 2-Step Verification을 강제하고 앱은 범용 MFA claim을 가정하지 않는다.
- 푸시는 `expo-notifications`와 Expo Push Service를 사용한다.
- 사진 안전 검사는 Google Cloud Vision SafeSearch를 사용한다.
- production crash와 crash-free session은 Sentry를 사용하되 Session Replay를 끄고 개인정보 필드를 전송 전 제거한다.
- V1에서는 발행 후 날짜·장소·정족수를 바꾸지 않는다.

### 출시 전 확인할 결정

| ID | 결정 | 기본안 | 결정 시점 |
|---|---|---|---|
| OD-01 | 이메일 OTP 외 로그인 | MVP는 이메일 OTP만 | 초대 인증 이탈이 20%를 넘을 때 |
| OD-02 | 위치기반서비스 신고·약관과 법정 기록 범위 | 위치 취급대장 최소 6개월을 구현하고 전문가 승인 전 외부 파일럿 차단 | 외부 파일럿 전 |

기본안과 다른 결정을 내리면 이 표, 관련 요구사항, 기술 설계를 한 PR에서 함께 갱신한다.

## 17. 현재 구현과의 차이

현재 V0는 제품 감각과 기기 API를 확인하는 로컬 클릭형 프로토타입이다.

### 이미 확인 가능한 것

- 홈, 생성, 사진 촬영, 대기 화면의 정보 구조와 브랜드 말투
- foreground 위치·카메라 권한 흐름
- 150m 거리와 GPS 정확도를 고려한 로컬 판정
- 구덩이별 로컬 기여 상태와 시스템 공유 UI

### V1에서 새로 구현할 것

- 인증, 멤버십, 초대 웹과 유효한 Universal/App Link
- Postgres/PostGIS 스키마, RLS, private Google Cloud Storage
- 서버 시간 기반 기여 마감·봉인·공개 상태 머신
- 알림, 공동 체크인, 정족수, 카운트다운
- 삭제·신고·운영·분석·관측성
- 실제 기기와 다중 사용자 E2E

프로토타입의 로컬 상태나 하드코딩된 장소를 서버 기능이 구현된 것으로 간주하지 않는다.

## 18. PRD 변경 규칙

PRD 변경은 다음 형식을 따른다.

1. 바꾸려는 요구사항 ID와 문제를 적는다.
2. 사용자 영향, 지표 영향, 개인정보·보안 영향을 적는다.
3. 선택지와 기각 이유를 기록한다.
4. 인수 조건, 아키텍처, 구현 계획과 테스트를 같은 변경에서 맞춘다.
5. 문서 버전과 결정 기록을 갱신한다.

기능을 추가하는 이유는 “좋아 보여서”가 아니라 어떤 가설 또는 지표를 검증하는지로 설명한다.

## 19. 공식 참고 기준

아래 문서는 구현·심사 시 다시 확인한다. 정책과 법령은 바뀔 수 있으며 이 목록은 법률 자문을 대신하지 않는다.

- [대한민국 개인정보 보호법](https://www.law.go.kr/법령/개인정보보호법)
- [대한민국 위치정보의 보호 및 이용 등에 관한 법률](https://www.law.go.kr/법령/위치정보의보호및이용등에관한법률)
- [Apple App Review Guidelines — User-Generated Content](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
- [Apple — Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [Google Play — 사용자 제작 콘텐츠 정책](https://support.google.com/googleplay/android-developer/answer/9876937?hl=ko)
- [Google Play — 앱 계정 삭제 요구사항](https://support.google.com/googleplay/android-developer/answer/13327111?hl=ko)
- [Expo SDK 57 버전·지원 OS 기준](https://docs.expo.dev/versions/latest/)
- [Expo SDK 57 — react-native-maps](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/)
- [Expo SDK 57 — Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
- [Expo Push Service](https://docs.expo.dev/push-notifications/overview/)
- [Google Places API 정책과 attribution](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Google Maps Platform API 키 보안 기준](https://developers.google.com/maps/api-security-best-practices)
- [Google Cloud Vision SafeSearch](https://docs.cloud.google.com/vision/docs/detecting-safe-search)
- [Supabase Edge Functions의 static egress IP 제한](https://supabase.com/docs/guides/troubleshooting/why-supabase-edge-functions-cannot-provide-static-egress-ips-for-whitelisting-3d78b0)
- [Supabase Postgres Roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Supabase Auth user sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase Auth sign out scopes](https://supabase.com/docs/guides/auth/signout)
- [Google Cloud Run static outbound IP 구성](https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip)
- [Google Cloud Run container runtime](https://docs.cloud.google.com/run/docs/container-contract)
- [Google Cloud Tasks HTTP target](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Scheduler HTTP target authentication](https://docs.cloud.google.com/scheduler/docs/http-target-auth)
- [Cloud Run service-to-service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)
- [Cloud Run Job 예약 실행](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule)
- [Google Cloud IAP for Cloud Run](https://docs.cloud.google.com/iap/docs/enabling-cloud-run)
- [IAP access management](https://docs.cloud.google.com/iap/docs/managing-access)
- [IAP signed header verification](https://docs.cloud.google.com/iap/docs/signed-headers-howto)
- [Google Workspace 2-Step Verification](https://support.google.com/a/answer/175197)
- [Google Secret Manager access control](https://docs.cloud.google.com/secret-manager/docs/access-control)
- [Google Cloud Storage signed URLs](https://docs.cloud.google.com/storage/docs/access-control/signed-urls)
- [Google Cloud Storage uniform bucket-level access](https://docs.cloud.google.com/storage/docs/uniform-bucket-level-access)
- [Google Cloud Storage public access prevention](https://docs.cloud.google.com/storage/docs/public-access-prevention)
- [Google Cloud Storage soft delete](https://docs.cloud.google.com/storage/docs/soft-delete)
- [Google Cloud Storage soft delete 비활성화](https://docs.cloud.google.com/storage/docs/disable-soft-delete)
- [ClamAV — Updating Signature Databases](https://docs.clamav.net/manual/Usage/SignatureManagement.html)
- [Expo — Using Sentry](https://docs.expo.dev/guides/using-sentry/)
- [위치정보의 관리적·기술적 보호조치 기준](https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000279386)
