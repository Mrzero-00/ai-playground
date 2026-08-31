# App in Toss 등록 문구

공식 [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame), [UI/UX 가이드](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide), [미니앱 등록](https://developers-apps-in-toss.toss.im/guide/operation/console-workspace), [주요 기능 등록](https://developers-apps-in-toss.toss.im/guide/operation/function)을 기준으로 작성한 제출용 문구예요.

## 앱 정보

- 앱 이름: `고양이 MBTI`
- 부제: `고양이 성향과 집사·고양이 궁합 보기`
- 짧은 소개: `30개 생활 행동으로 고양이 성향을 알아보고, 집사 또는 다른 고양이와의 생활 궁합을 살펴보는 엔터테인먼트 서비스`

### 상세 소개

고양이 프로필을 만들고 최근 4주의 평소 행동에 관한 30개 질문에 답해 주세요. 여섯 가지 행동 성향과 16가지 고양이 MBTI 캐릭터를 확인하고 성향에 맞는 놀이·환경·관계 팁을 볼 수 있어요. 집사 MBTI를 선택하면 고양이와 집사의 생활 궁합을, 다른 고양이 검사를 추가하면 고양이끼리의 생활 궁합과 각 고양이별 주의사항을 확인할 수 있어요. 여러 고양이 등록은 선택 사항이에요. 결과 공유 링크를 받은 친구는 공유된 고양이의 성향을 보고 자기 고양이와 생활 궁합을 이어서 확인할 수 있어요. 결과는 재미로 참고하는 행동 성향 콘텐츠이며 수의학적 진단이나 합사 성공 여부 판단을 대신하지 않아요.

## 주요 기능 등록안

공식 가이드의 최대 3개 제한과 한국어 10자 이내 기준에 맞춘 문구예요. 콘솔에서 각 기능의 실제 `intoss://cat-mbti-00/...` 진입 경로를 연결하고 실기기에서 뒤로가기를 확인해야 해요.

| 기능명 | 설명 | 진입 경로 |
| --- | --- | --- |
| `고양이 성향 보기` | 프로필 작성부터 30문항과 결과까지 | `intoss://cat-mbti-00` |
| `집사 궁합 보기` | 완료된 고양이 결과의 집사 생활 궁합 | `intoss://cat-mbti-00/result` |
| `고양이 궁합 보기` | 완료된 고양이 또는 공유 결과의 생활 궁합 | `intoss://cat-mbti-00/harmony` |

## 공유 기능 설명

- 결과 페이지에서 네이티브 공유창을 열고, 링크 수신자에게 공유 결과와 포함 정보를 안내해요.
- `getTossShareLink()`로 `intoss://` 딥링크를 변환하고 `share()`로 네이티브 공유창을 열어요.
- 정식 공유에는 `intoss://`를 사용하고 `intoss-private://`는 출시 전 QR 테스트에만 사용해요.
- 관련 공식 문서: [미니앱 공유 링크](https://developers-apps-in-toss.toss.im/documentation/common/growth/share/miniapp-share-link), [메시지 공유](https://developers-apps-in-toss.toss.im/documentation/common/growth/share/share-message)

## 제출 전 직접 확인할 항목

- 콘솔 앱 이름과 AIT 표시 이름이 모두 `고양이 MBTI`인지 확인
- 주요 기능 3개와 각 스킴의 실제 진입·뒤로가기 확인
- iOS·Android 토스 QR 환경에서 공유 전용 화면 → 네이티브 공유창 → 수신 링크 → 궁합 화면 왕복 확인
- 앱 소개에 없는 기능을 등록하지 않고, 등록한 기능은 앱에서 동일하게 제공하는지 확인
