# 21일 Shadow Mode 운영

Shadow Runner는 토스증권의 실제 시세를 읽지만 주문 API를 호출하지 않는다. 환경변수의 주문 모드가 `live`여도 Runner 내부에서 강제로 `read_only`로 덮어쓴다.

## 시작

```bash
pnpm build
pnpm shadow
```

기본 설정:

- 대상: `AAPL`
- 조회 간격: 30초
- 기간: 21일
- 로그: `var/shadow/snapshots.jsonl`
- 주문 제출: 항상 false

대상 종목은 `.env`의 `SHADOW_SYMBOLS=AAPL,MSFT`처럼 지정한다. 토스증권 현재가 API는 WebSocket이 아니므로 지나치게 짧게 폴링하지 않는다.

## 최초 계좌 확인

시작 로그의 `accountSeqs`에서 사용할 종합매매 계좌 순번을 확인하고 `.env`의 `TOSS_INVEST_ACCOUNT_SEQ`에 입력한다. 계좌번호와 Client Secret은 로그에 기록하지 않는다.

## 매일 확인할 항목

- 프로세스가 살아 있는가
- OAuth 또는 허용 IP 오류가 반복되는가
- `staleSymbols`가 반복되는가
- API 응답 지연이 평소보다 증가했는가
- JSONL 로그가 계속 증가하는가
- 토스 시세와 별도 화면 시세가 일치하는가

## 주간 합격 기준

- 주문 API 호출 0건
- 인증 성공률 99% 이상
- 정상 장중 최신 시세 비율 99% 이상
- 중복 스냅샷이나 장시간 공백 없음
- 재시작 후 정상 복구
- 429와 일시적 5xx 발생 시 제한된 재시도 후 회복

이 Runner는 API 연결 안정성 검증용이다. 뉴스·공시 → Thesis → 진입 판단까지 평가하려면 OpenAI 키와 검증된 뉴스 공급원이 추가로 필요하다.
