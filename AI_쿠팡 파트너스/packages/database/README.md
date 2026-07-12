# Database

Supabase PostgreSQL client, 도메인 스키마, Repository 계약과 Migration을 제공합니다.

- `src/domain.ts`: 외부 입력에도 재사용하는 Zod 기반 도메인 스키마
- `src/repositories.ts`: 저장소 계약
- `src/in-memory-repositories.ts`: 키 없이 실행 가능한 테스트 구현체
- `supabase/migrations`: 재실행 가능한 SQL Migration
- `supabase/seed`: 재실행 가능한 기본 Provider seed

`createDatabaseClient`는 URL과 Service Role Key를 `unknown`으로 받아 Zod 검증 후 서버 전용 Supabase client를 생성합니다.
