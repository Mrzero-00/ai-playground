# Trigger

KST 일정과 로컬 실행·재시도·resume 로직은 `apps/worker`에 구현되어 있습니다. Trigger.dev Cloud 등록은 `TRIGGER_SECRET_KEY`와 `TRIGGER_PROJECT_ID`가 준비된 후 수행하며 자동 게시는 승인 없이 활성화하지 않습니다.
