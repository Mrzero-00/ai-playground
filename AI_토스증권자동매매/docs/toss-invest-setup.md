# 토스증권 Open API 연결

기준 문서는 토스증권 Open API `1.2.4`의 공식 OpenAPI입니다.

## 1. 토스증권에서 준비

1. 토스증권 WTS의 Open API 메뉴에서 Client ID와 Client Secret을 발급한다.
2. API를 호출할 서버의 고정 공인 IP를 허용 IP로 등록한다.
3. 처음에는 계좌·시세 조회 권한만 확인하고 주문 모드는 켜지 않는다.

Client Secret은 서버 환경변수에만 저장하고 웹 브라우저, 로그, Git에 노출하지 않는다.

## 2. 환경변수

```bash
TOSS_INVEST_CLIENT_ID=
TOSS_INVEST_CLIENT_SECRET=
TOSS_INVEST_ACCOUNT_SEQ=
TOSS_INVEST_MODE=read_only
TOSS_INVEST_LIVE_CONFIRM=
```

`accountSeq`는 `GET /api/v1/accounts` 응답의 값이다. 계좌번호가 아니다.

## 3. 읽기 전용 연결 확인

API 서버 실행 후 다음 순서로 확인한다.

```bash
curl http://localhost:4000/broker/status
curl 'http://localhost:4000/broker/prices?symbols=AAPL'
```

`read_only`는 이 프로젝트가 제공하는 안전 잠금이다. 토스증권 서버의 별도 모의투자 환경을 의미하지 않는다.

## 4. 실전 주문 잠금

실전 주문은 아래 조건을 모두 만족해야 코드상 허용된다.

- `TOSS_INVEST_MODE=live`
- `TOSS_INVEST_LIVE_CONFIRM=I_UNDERSTAND_REAL_ORDERS`
- Kill Switch 비활성
- 유효한 `clientOrderId`
- 지정가 주문
- 매수 가능 현금 또는 매도 가능 수량 사전 확인
- 주문 접수 직후 주문 상세 조회를 통한 상태 대조

현재 자동 전략의 기본 실행 엔진은 계속 PaperBroker다. 실시간 데이터 검증과 Shadow Mode가 끝날 때까지 Worker에 실전 클라이언트를 주입하지 않는다.

## 5. 장애 처리

- OAuth 토큰은 만료 60초 전 재발급하며 동시에 여러 발급 요청을 보내지 않는다.
- 401은 토큰을 한 번 폐기한 뒤 한 번만 재시도한다.
- 429는 `Retry-After`를 따르고 최대 재시도 횟수를 제한한다.
- 5xx는 제한적으로 재시도한다.
- 오류 로그에는 `requestId`와 `code`를 남기되 자격증명과 토큰은 남기지 않는다.
- 주문 생성에는 최대 36자의 `clientOrderId`를 항상 지정한다.

## 6. 실전 전 체크리스트

- 최소 100건 이상의 Paper/Shadow 거래
- 데이터 지연 Kill Switch 검증
- 중복 주문, 부분 체결, 429, 5xx, 프로세스 재시작 테스트
- 계좌 보유량과 내부 포지션 대조
- 일간·주간 손실 차단 확인
- 수동 Kill Switch 확인
- 소액 지정가 주문으로 단계적 시작
