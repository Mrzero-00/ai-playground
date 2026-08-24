# 냥BTI 16종 캐릭터 자산 가이드

최종 생성·검수일: **2026-08-24 (Asia/Seoul)**

## 사용 원칙

- 사용자가 제공한 냥BTI 카드 이미지의 따뜻한 손그림 카툰 분위기를 시각 참고로 사용했다.
- 카드 안의 문구, 레이아웃, 로고는 복제하지 않았다.
- 캐릭터 PNG에는 결과 코드·유형명·설명 등 텍스트를 넣지 않았다.
- 모든 결과 텍스트는 접근성과 수정 가능성을 위해 HTML로 렌더링한다.
- 앱에서는 `public/characters/`의 768×768 PNG를 사용한다.

## 공통 생성 프롬프트

```text
Square 1:1 character illustration for a Korean mobile cat personality app.
Warm hand-drawn picture-book cartoon style matching the supplied visual references:
soft dark-brown ink outline, watercolor and colored-pencil texture, rounded chibi cat,
large expressive eyes, warm ivory paper background, gentle muted colors, centered subject,
generous clear margin, one cat with a few personality props, clean readable silhouette.
No words, letters, numbers, MBTI code, labels, logos, watermark, card frame, UI, or checkerboard.
```

각 타입에는 위 공통 프롬프트에 아래 모티프를 덧붙였다.

| 타입 | 캐릭터 모티프 |
| --- | --- |
| ENFP | 노란 탐험 모자, 주황 스카프, 배낭, 반짝임 |
| ENFJ | 주황·흰 고양이, 붉은 망토, 하트 메달과 하트 |
| ENTP | 회색 줄무늬 고양이, 종이 상자, 전구와 아이디어 소품 |
| ENTJ | 검은 고양이, 왕관과 붉은 망토 |
| ESFP | 주황 줄무늬 고양이, 깃털 낚싯대와 음표 |
| ESFJ | 크림색 고양이, 분홍 리본과 하트 |
| ESTP | 벵갈 고양이, 초록 공을 쫓는 역동적인 자세 |
| ESTJ | 회색 줄무늬 고양이, 체크리스트 클립보드 |
| INFP | 포근한 분홍 쿠션, 밤 창문, 작은 랜턴과 식물 |
| INFJ | 차분한 회색 장모 고양이와 화분 |
| INTP | 검정·흰 고양이, 둥근 안경과 과학책 |
| INTJ | 검은 고양이, 밤 창문과 체스 말 |
| ISFP | 삼색 고양이, 올리브색 쿠션과 화분 |
| ISFJ | 회색·흰 고양이, 파란 담요, 쿠키와 차 |
| ISTP | 갈색 줄무늬 고양이, 풀밭의 사냥 준비 자세 |
| ISTJ | 삼색 고양이, 안정적인 짚 바구니 숨숨집 |

## 코드 연결

`data/character-assets.ts`가 16개 냥BTI 코드와 이미지 경로를 일대일로 연결한다. 파일을 교체할 때는 같은 파일명을 유지하고 `pnpm test`로 누락 여부를 확인한다.
