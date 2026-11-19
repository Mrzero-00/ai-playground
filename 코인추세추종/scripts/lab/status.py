"""연구 루프 상태 (RESEARCH.md 루프 절차 1). 단계별 상태와 다음 할 일을 출력한다."""
import json, os

import common as C
from run import STAGES


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except (OSError, TypeError):
        return False


rep = C.OUT / "report.json"
reported = json.loads(rep.read_text()) if rep.exists() else {}
todo = None
for stage in STAGES:
    p = C.OUT / stage / "status.json"
    s = json.loads(p.read_text()) if p.exists() else {}
    state = s.get("state", "대기")
    if state in ("running", "analyzing") and not alive(s.get("pid")):
        state = "중단됨(프로세스 없음)"
    line = f"{stage}: {state}"
    if s.get("total"):
        line += f" {s.get('done', 0)}/{s['total']}"
    line += f" · 시작 {s.get('started', '-')} · 갱신 {s.get('updated', '-')}"
    if state == "done" and reported.get(stage) != s.get("finished"):
        line += " · 보고서에 아직 없음"
        todo = todo or f"a. 보고서 갱신 (report.py) — {stage}"
    if state in ("failed", "중단됨(프로세스 없음)"):
        todo = todo or f"a. {stage} 실패/중단 — data/lab/{stage}.log 확인 후 다시 실행"
    if state == "대기":
        todo = todo or f"b. {stage} 실행"
    if state in ("running", "analyzing") and alive(s.get("pid")):
        todo = "2. 실행 중 — 다음 시간에 확인"
    print(line)
print(f"봉인 구간: {'열림 ' + json.loads(C.SEAL.read_text())['at'] if C.SEAL.exists() else '닫힘'}")
print(f"다음 할 일: {todo or 'c. 등록된 단계 끝 — RESEARCH.md 2단계 후보의 다음 방법 등록·구현'}")
