# 스포르팅CP

<!-- INPUTS:START -->
## 입력(자동 수집 2026-10-21) — xG·휴식일·라인업·환경(이동거리·고도·날씨)은 이 숫자를 쓴다
- 10-22 04:00 vs LASK: 휴식 8.1일 · 직전 10-14 원정 vs Lens 2-0 승 [uefa.champions] · xG - · 직전 선발 4-3-3 Kaique, Gonçalo Inácio, Eduardo Quaresma, Maxi Araújo, Iván Fresneda, Sergi Altimira, Issa Doumbia, João Simões, Luis Suárez, Nestory Irankunda, Geny Catamo · 구장 ? · 이동 ?(구장 미확인) · 고도 ?m · 날씨 -
<!-- INPUTS:END -->


## 2026-10-22 회고 (125회 9702, UCL 2:3 LASK 패) — **125회 최대 오차 (정합성 C)**
- 예측 승 78.3% → 2:3 패. 슈팅 16:11이지만 **유효 4:7** — LASK가 효율로 이겼다.
- 원인: **기준선 과신.** 근거 JSON에 "LASK가 리버풀 상대로 3골, 10/17 리그 4-0 대승 — 완전히 무너진 팀 아님"을
  정확히 적어 놓고 **−1.0%p만 반영**하고 euro_baseline 기준선 80.8%를 사실상 그대로 썼다.
  λ원정 0.91은 최근 득점(7골/2경기)과 2배 이상 어긋난다.
- **정합성 C가 제 역할을 했다** — 추천 금지·학습 제외가 걸렸고 실제로 추천하지 않았다.
- 교훈: **기준선 λ와 최근 득점 기록이 크게 어긋나면 글로 적지 말고 λ를 다시 계산한다.**
