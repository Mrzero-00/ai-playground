#!/usr/bin/env python3
"""주간 방향 점검 — "지금 가는 방향이 맞는가"를 틀 밖에서 묻는다.

사용자 지시 2026-10-26:
  "회고 때는 특정 지표의 가중치 정도를 수정하는 것 같다. 완전 다른 방향의 분석 기법이
   필요할 수도 있으니, 일주일에 한 번은 현재 방향성이 좋은 방향인지 체크하는 루프를 돌자."

맞는 진단이다. 회고는 **틀 안에서 손잡이를 돌린다**(보정 계수·요인 가중치·문턱).
틀 자체가 한계면 회고를 아무리 돌려도 안 나온다. 2026-10-26이 그 사례였다 —
모델을 Elo→포아송으로 바꿔도 51~52%에서 멈추고(시장 53.4%), 요인 보정은 −5.0p 로 깎고 있었다.
그건 회고가 아니라 별도 구조 조사에서 나왔다.

그래서 이 점검은 **현재 틀을 후보 중 하나로 놓고 같은 자료로 겨루게 한다.**
결론은 셋 중 하나다.
  유지 — 현재 틀이 최선. 회고로 계속 다듬는다.
  조정 — 틀은 맞는데 구성요소 하나가 뒤진다(예: 기준선 모델 교체).
  전환 — 다른 틀이 유의하게 낫다. 회고로는 못 따라잡으니 방향을 바꾼다.

판정은 **방향 적중률** 하나로만 한다(사용자 지시: 회수율·RPS·Brier 는 보조 진단).

    python3 scripts/direction_review.py run            # 점검 후 보고서 저장
    python3 scripts/direction_review.py due            # 이번 주에 돌 차례인가(0=돌 차례)
"""
import argparse, datetime as dt, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
STATE = os.path.join(ROOT, "data", ".direction_review.json")
EVERY_DAYS = 7


def _run(cmd):
    try:
        p = subprocess.run([sys.executable] + cmd, cwd=ROOT, capture_output=True, text=True, timeout=900)
        return (p.stdout or "") + (p.stderr or "")
    except Exception as e:
        return f"(실행 실패: {e})"


def last_run():
    if not os.path.exists(STATE):
        return None
    try:
        return dt.date.fromisoformat(json.load(open(STATE, encoding="utf-8")).get("last", ""))
    except Exception:
        return None


def cmd_due(a):
    lr = last_run()
    due = lr is None or (dt.date.today() - lr).days >= EVERY_DAYS
    print(f"방향 점검 {'필요' if due else '아직'} — 마지막 {lr or '없음'}, 주기 {EVERY_DAYS}일")
    return 0 if due else 1


def cmd_run(a):
    today = dt.date.today()
    out = [f"# 주간 방향 점검 — {today}", "",
           "회고는 틀 안에서 가중치를 고친다. 이 점검은 **틀 자체가 맞는지**를 묻는다.",
           "판정은 방향 적중률 하나로 한다. 회수율·RPS·Brier 는 보조 진단으로만 적는다.", ""]

    out += ["## 1. 모델 계층 상한 — 지금 쓰는 기준선보다 나은 틀이 있는가", "```"]
    out.append(_run(["scripts/direction_lab.py", "run"]).strip())
    out += ["```", "",
            "> 읽는 법: 어떤 모델도 시장을 못 넘으면, **과거 결과만으로는 더 못 간다**는 뜻이다.",
            "> 그때 개선은 결과표 밖 정보(선발·부상·휴식·동기)에서만 나온다.",
            "> 반대로 어떤 모델이 현재 기준선보다 유의하게 높으면 **기준선 교체**가 답이다(조정).", ""]

    out += ["## 2. 요인이 정보인가 잡음인가 — 수집한 사실이 확률로 제대로 바뀌는가", "```"]
    out.append(_run(["scripts/factor_fit.py", "report"]).strip())
    out += ["```", "",
            "> '시장+요인'이 '시장만'보다 낮으면, 수집은 되는데 **환산이 새고 있다**는 뜻이다.",
            "> 유형별 역부호가 많으면 가중치 조정으로는 부족하고 환산 규칙 자체를 다시 세워야 한다(전환).", ""]

    out += ["## 3. 개입이 값을 하는가 — 손댄 경기가 사전확률보다 나았는가", "```"]
    out.append(_run(["scripts/prior.py", "report"]).strip())
    out += ["```", "",
            "> 개입 개선폭이 계속 음수면, 지금 틀에서 '분석해서 바꾸는 행위' 자체가 손해다.",
            "> 문턱을 올리는 건 임시 조치이고, 근본은 환산·입력을 바꾸는 것이다.", ""]

    out += ["## 4. 확률 정합 — 내가 쓴 숫자가 그대로 나오는가", "```"]
    out.append(_run(["scripts/calib_report.py"]).strip()[-3500:])
    out += ["```", ""]

    out += ["## 5. 판정", "",
            "아래 셋 중 하나를 고르고 **근거 숫자와 함께** 적는다. 고른 뒤 그 자리에서 실행한다.", "",
            "- [ ] **유지** — 현재 틀이 최선. 회고로 계속 다듬는다.",
            "- [ ] **조정** — 틀은 맞는데 구성요소 하나가 뒤진다(기준선 모델 교체 등).",
            "- [ ] **전환** — 다른 틀이 유의하게 낫다. 회고로는 못 따라잡으니 방향을 바꾼다.", "",
            "판정:", "", "근거:", "", "이번 주에 바꾼 것:", "",
            "다음 점검에서 확인할 것(무엇이 몇 %p 올라야 성공인가):", "",
            "---",
            f"다음 점검 예정: {today + dt.timedelta(days=EVERY_DAYS)}", ""]

    txt = "\n".join(out)
    p = os.path.join(ROOT, "회차별분석", f"방향점검_{today}.md")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(txt)
    json.dump({"last": today.isoformat()}, open(STATE, "w", encoding="utf-8"))
    print(txt[:1500])
    print(f"\n→ 저장 {p}")
    print("※ 5. 판정 칸은 비어 있다. 네가 위 숫자를 보고 채우고, 고른 판정을 그 자리에서 실행한다.")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    s.add_parser("run").set_defaults(f=cmd_run)
    s.add_parser("due").set_defaults(f=cmd_due)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
