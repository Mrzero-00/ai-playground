# AI Affiliate Operating System (AAOS)

> AI 기반 쿠팡 파트너스 자동화 및 콘텐츠 운영 플랫폼

---

# 목표

AI Agent를 활용하여

- 트렌드 분석
- 상품 발굴
- 수익성 분석
- 콘텐츠 생성
- 이미지/영상 생성
- SNS 업로드
- 성과 분석
- 자동 개선

까지 모두 자동으로 수행하는 Affiliate Marketing Operating System 구축

---

# 핵심 목표

✔ 사람이 개입하지 않아도 하루 수십~수백 개의 콘텐츠 생산

✔ 수익성이 높은 상품만 자동 선택

✔ 여러 SNS에 자동 배포

✔ 데이터를 기반으로 스스로 학습하는 Agent 구축

---

# 전체 구조

```

Trend Agent
↓

Product Scout Agent
↓

Profit Score Agent
↓

Content Planner Agent

├── Blog Agent
├── Instagram Agent
├── Shorts Agent
├── X Agent
└── Threads Agent

↓

Publish Agent

↓

Analytics Agent

↓

Learning Agent

↓

Trend Agent (Loop)

```

---

# Project Structure

```

apps/
dashboard
worker
api

packages/
agents
shared
database
prompts
workflow
analytics

```

---

# Phase 1

# Foundation

## Goal

프로젝트 기본 환경 구축

### TODO

- [ ] Next.js
- [ ] TypeScript
- [ ] Supabase
- [ ] Authentication
- [ ] Dashboard
- [ ] Agent Runner
- [ ] Queue 구축
- [ ] Scheduler 구축
- [ ] Logging 구축
- [ ] Monitoring 구축

---

# Phase 2

# Trend Agent

## Goal

현재 트렌드를 자동 분석

### 수집 대상

- [ ] Google Trends
- [ ] 네이버 데이터랩
- [ ] Reddit
- [ ] YouTube
- [ ] TikTok
- [ ] Instagram
- [ ] Threads
- [ ] X
- [ ] 쿠팡 베스트
- [ ] 오늘의 딜

### Output

```

{
keyword:"",
trendScore:0,
growthRate:0,
category:"",
reason:""
}

```

### TODO

- [ ] 키워드 수집
- [ ] 키워드 정규화
- [ ] 중복 제거
- [ ] 카테고리 분류
- [ ] 성장률 계산
- [ ] AI 요약

---

# Phase 3

# Product Scout Agent

## Goal

상품 자동 수집

### 수집 대상

- [ ] 쿠팡
- [ ] AliExpress
- [ ] Amazon
- [ ] Temu

### 수집 데이터

- 상품명
- 가격
- 할인율
- 후기
- 별점
- 리뷰 수
- 이미지
- 브랜드

### TODO

- [ ] 상품 수집
- [ ] 중복 제거
- [ ] 카테고리 분류
- [ ] 이미지 저장

---

# Phase 4

# Profit Score Agent

## Goal

수익성이 높은 상품 선별

## 평가 요소

- Trend Score
- Competition
- Search Volume
- SEO Difficulty
- Commission
- Purchase Intent
- Review Score
- Seasonality

### AI Score

```

Final Score = 0~100

```

### Rule

- 80점 이상 게시
- 60~79 검토
- 60 이하 폐기

---

# Phase 5

# Content Planner Agent

## Goal

콘텐츠 전략 생성

### 생성 대상

- Blog
- Instagram
- Threads
- X
- Pinterest
- Shorts
- Reels

### Output

```

{
title:"",
hook:"",
platforms:[],
hashtags:[],
tone:"",
target:""
}

```

---

# Phase 6

# Blog Agent

## Goal

SEO 블로그 자동 생성

### 생성

- 제목
- 메타
- Schema
- FAQ
- 이미지
- Alt
- 내부링크
- 외부링크
- Affiliate Link

### SEO

- E-E-A-T
- 검색 의도
- FAQ
- JSON-LD

---

# Phase 7

# SNS Agent

## Instagram

- 카드뉴스
- Carousel
- Caption
- Hashtag

---

## Shorts

- Hook
- Script
- Voice
- Subtitle
- BGM
- Thumbnail

---

## Threads

- 짧은 글
- CTA

---

## X

- Thread 생성
- CTA

---

# Phase 8

# Creative Agent

## Goal

이미지 / 영상 생성

### Image

- GPT Image
- Stable Diffusion
- Flux

### Video

- Veo
- Kling
- Runway
- Pika

### TODO

- [ ] 이미지 생성
- [ ] 썸네일 생성
- [ ] 영상 생성
- [ ] 자막 생성
- [ ] 음성 생성

---

# Phase 9

# Publish Agent

## Goal

자동 업로드

### Blog

- WordPress
- 자체 블로그

### SNS

- Instagram
- Threads
- X
- Pinterest
- Facebook

### TODO

- [ ] 예약 업로드
- [ ] 실패 재시도
- [ ] 업로드 로그

---

# Phase 10

# Analytics Agent

## Goal

성과 분석

### 수집

- CTR
- Impression
- Click
- Conversion
- Revenue
- RPM
- View
- Engagement

### Dashboard

- 실시간 통계
- 플랫폼별 통계
- 상품별 통계
- 카테고리별 통계

---

# Phase 11

# Learning Agent

## Goal

AI가 스스로 개선

### 분석

- 제목
- 이미지
- 업로드 시간
- 콘텐츠 길이
- CTA
- 해시태그

### Output

```

Rule

CTR가 높은 제목 패턴

이미지 특징

업로드 시간

길이

톤앤매너

```

### TODO

- [ ] A/B Test
- [ ] Best Pattern 저장
- [ ] Prompt 개선
- [ ] Score 개선

---

# Dashboard

## Overview

- 오늘 수익
- 이번 달 수익
- 게시물 수
- CTR
- Conversion
- 인기 상품

---

## Agent Monitor

- 실행 상태
- Queue
- 실패
- Retry

---

## AI Insights

오늘 추천 상품

이번 주 트렌드

예상 수익

추천 콘텐츠

---

# 기술 스택

## Frontend

- Next.js
- TypeScript
- Chakra UI

## Backend

- Next.js Route Handler
- Supabase

## Queue

- BullMQ

## Workflow

- LangGraph
- Trigger.dev

## AI

- OpenAI
- Gemini
- Claude

## Image

- GPT Image
- Flux

## Video

- Veo
- Kling
- Runway

## Database

- Supabase
- pgvector

## Storage

- Cloudflare R2

---

# MVP 목표

- 하루 10개 이상의 블로그 자동 생성
- 하루 10개 이상의 SNS 콘텐츠 자동 생성
- 자동 예약 발행
- AI 상품 추천
- 자동 성과 분석
- 자동 콘텐츠 개선

---

# 장기 목표 (Vision)

AI가 사람의 개입 없이 시장을 분석하고, 수익성 높은 상품을 발굴하여, 최적의 콘텐츠를 생성·배포하며, 성과를 학습해 지속적으로 전략을 개선하는 **AI Affiliate Operating System**을 구축한다.

궁극적으로는 쿠팡 파트너스뿐 아니라 Amazon Associates, AliExpress, Temu, 애드센스, 자체 제휴 프로그램 등 다양한 수익원을 하나의 플랫폼에서 운영할 수 있는 확장 가능한 마케팅 자동화 시스템을 목표로 한다.
