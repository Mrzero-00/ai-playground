# 무인 자동 실행 (PC 켜 두면 알아서 회차 감시 → 추천·기록 → 푸시 → Vercel 자동 배포)

Claude Code 세션 안의 크론은 세션이 끝나면 사라진다. 세션과 무관하게 돌리려면 macOS launchd 가 `auto_runner.sh` 를 호출하고, 그 안에서 헤드리스 Claude(`claude -p`)가 절차를 수행한다. 결과는 git push → GitHub → Vercel(Root Directory `betman-dashboard`) 자동 배포로 https://betman-dashboard.vercel.app 에 반영된다.

## 1. 설치 (사용자가 직접 — 무인 에이전트 생성은 Claude 가 대신 하지 않는다)
```sh
cp "/Users/sonsang-il/orca/workspaces/ai/pacu/승부예측 프로그램/automation/com.pacu.betman.daily.plist" ~/Library/LaunchAgents/
cp "/Users/sonsang-il/orca/workspaces/ai/pacu/승부예측 프로그램/automation/com.pacu.betman.blocks.plist" ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pacu.betman.daily.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pacu.betman.blocks.plist
launchctl list | grep com.pacu.betman        # 두 줄 보이면 설치됨
```
- daily: 매일 08:03 — 새 회차 등록·팩트시트·입력·teamdb·학습 갱신·대시보드 배포.
- blocks: 20분마다 `round_watch.py due` 를 보고 분석 시각이 된 블록(승무패 포함)만 처리. 없으면 바로 종료(비용 0).
- 실행 저장소: `~/orca/workspaces/ai/pacu-auto`(별도 클론 — Desktop 아래 .git 은 launchd 가 접근 못 함). 로그: `pacu-auto/승부예측 프로그램/logs/auto_YYYYMMDD.log`, `launchd_*.log`.
- 해제: `launchctl bootout gui/$(id -u)/com.pacu.betman.daily` (blocks 도 동일).

## 2. 권한 모드 (결정 필요)
plist 두 개에 `PACU_PERM=bypassPermissions` 가 이미 들어 있어(2026-10-19 사용자 요청) 설치하면 완전 무인(모든 권한 검사 생략)으로 돈다. 승인 모드로 바꾸려면 그 줄을 지우면 `acceptEdits` 가 기본값이 된다. `auto_runner.sh` 는 기본 `--permission-mode acceptEdits` 로 실행한다. 이 모드는 파일 편집만 자동 승인하고 Bash 는 `.claude/settings.json` 의 허용 목록을 따른다. 무인 실행에서 승인 프롬프트가 뜨면 그 턴은 실패하므로 둘 중 하나를 고른다.
- (권장) 프로젝트 `.claude/settings.json` 에 쓰는 명령을 허용 목록으로 등록: `python3 scripts/*`, `git *`, `sh ../betman-dashboard/deploy.sh`, `vercel *`, `curl *`.
- 또는 plist 의 `ProgramArguments` 앞에 환경변수 `PACU_PERM=bypassPermissions` 를 넣어 모든 권한 검사 생략(완전 무인, 위험 감수).

## 3. Mac 잠자기 방지 (지금 `pmset` 이 전원 연결 시 1분 잠자기 — 10/18 밤 블록 2개를 이것 때문에 놓쳤다)
```sh
sudo pmset -c sleep 0 disksleep 0 displaysleep 10     # 전원 연결 시 시스템 잠자기 끔, 디스플레이만 10분
pmset -g custom | grep -E " sleep|displaysleep"
```
또는 시스템 설정 → 디스플레이 → 고급 → "디스플레이가 꺼져 있을 때 자동으로 잠자기 방지" 켜기. 실행 중에는 `caffeinate` 가 추가로 잠자기를 막는다.

## 4. 확인
- 수동 테스트: `zsh automation/auto_runner.sh blocks` (due 없으면 "due 블록 없음"만 기록), `zsh automation/auto_runner.sh daily`.
- 대시보드: 푸시 뒤 1분 안에 https://betman-dashboard.vercel.app 갱신(Vercel Git 연동, main 브랜치).
- 다른 PC 세션과 동시에 돌 수 있다: 두 쪽 다 분석일정 상태를 먼저 보고 '완료'면 건너뛴다.
