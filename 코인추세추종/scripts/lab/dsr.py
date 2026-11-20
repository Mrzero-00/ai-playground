"""다중 검정 보정 (RESEARCH.md '다중 검정 보정 등록'). 모든 판정 단위의 워크포워드 주간 곡선으로 디플레이티드 샤프(DSR)를 낸다.
Bailey·López de Prado (2014) The Deflated Sharpe Ratio. 새 신호는 만들지 않는다.
사용법: python3 scripts/lab/dsr.py   → data/lab/dsr.json
"""
import json
from datetime import datetime

import numpy as np
from scipy.stats import kurtosis, norm, skew

import common as C
from run import STAGES

EULER = 0.5772156649
FAMILY = {"선물": "선물 롱숏"}  # 시간대 효과·페어의 '선물' 단위는 선물 롱숏 묶음에


def weekly(curve, key):
    v = np.asarray(curve[key], float)
    return v[1:] / v[:-1] - 1


def psr(r, sr0):
    """확률적 샤프: 주간 SR 이 sr0 보다 클 확률 (치우침·첨도 감안)."""
    if r.std() == 0:  # 한 번도 들지 않은 단위는 샤프 0
        return 0.5 if sr0 == 0 else float(sr0 < 0), 0.0
    sr, t = r.mean() / r.std(ddof=1), len(r)
    den = 1 - skew(r) * sr + (kurtosis(r, fisher=False) - 1) / 4 * sr ** 2
    return float(norm.cdf((sr - sr0) * np.sqrt(t - 1) / np.sqrt(den))), float(sr)


def sr0(srs, n):
    """N 번 시험했을 때 운으로 나올 가장 큰 샤프의 기대값."""
    return float(np.sqrt(np.var(srs, ddof=1)) * ((1 - EULER) * norm.ppf(1 - 1 / n) + EULER * norm.ppf(1 - 1 / (n * np.e))))


def main():
    units = []
    for stage in STAGES:
        p = C.OUT / stage / "summary.json"
        if not p.exists():
            continue
        res = json.loads(p.read_text())
        for i, u in enumerate(res["units"]):
            units.append(dict(stage=stage, i=i, name=res["name"], unit=u["name"], family=FAMILY.get(u["name"], u["name"]), late=bool(res.get("late")),
                              passed=bool(u["passed"]), bench=u["bench"], 절대=weekly(u["curve"], "전략"),
                              초과=weekly(u["curve"], "전략") - weekly(u["curve"], "기준선")))
    fams, out = {}, []
    for fam in sorted({u["family"] for u in units}):
        us = [u for u in units if u["family"] == fam]
        fams[fam] = {"N": len(us)}
        for q in ("절대", "초과"):
            m = np.array([u[q] for u in us])
            sd = m.std(axis=1, ddof=1)
            srs = np.divide(m.mean(axis=1), sd, out=np.zeros(len(us)), where=sd > 0)  # 평평한 곡선은 샤프 0
            c = np.corrcoef(m[sd > 0])  # 상관은 움직인 곡선끼리만
            rho = float(c[np.triu_indices(len(c), 1)].mean())
            n_eff = rho + (1 - rho) * len(us)
            fams[fam][q] = {"평균상관": rho, "N_eff": n_eff, "SR0": sr0(srs, n_eff), "SR0_보수": sr0(srs, len(us)), "SR 분산": float(np.var(srs, ddof=1))}
    for u in units:
        row = {k: u[k] for k in ("stage", "i", "name", "unit", "family", "late", "passed", "bench")}
        for q in ("절대", "초과"):
            f = fams[u["family"]][q]
            p0, sr = psr(u[q], 0.0)
            row[q] = {"주간 SR": sr, "연 SR": sr * np.sqrt(52), "PSR": p0, "DSR": psr(u[q], f["SR0"])[0], "DSR_보수": psr(u[q], f["SR0_보수"])[0]}
        row["보정 통과"] = row["초과"]["DSR"] >= 0.95
        out.append(row)
    (C.OUT / "dsr.json").write_text(json.dumps({"made": datetime.now().isoformat(timespec="seconds"), "T": int(len(units[0]["절대"])), "families": fams, "units": out}, ensure_ascii=False, indent=1))
    for fam, f in fams.items():
        print(fam, f"N {f['N']}", *(f"{q}: ρ̄ {f[q]['평균상관']:.2f} N_eff {f[q]['N_eff']:.1f} SR0 연 {f[q]['SR0'] * np.sqrt(52):.2f} (보수 {f[q]['SR0_보수'] * np.sqrt(52):.2f})" for q in ("절대", "초과")))
    for r in sorted((r for r in out if r["passed"]), key=lambda r: -r["초과"]["DSR"]):
        print(f"{r['name']} · {r['unit']}{' (참고용)' if r['late'] else ''} | 절대 연 SR {r['절대']['연 SR']:.2f} PSR {r['절대']['PSR']:.2f} DSR {r['절대']['DSR']:.2f}"
              f" | 초과 연 SR {r['초과']['연 SR']:.2f} PSR {r['초과']['PSR']:.2f} DSR {r['초과']['DSR']:.2f} 보수 {r['초과']['DSR_보수']:.2f} | {'보정 통과' if r['보정 통과'] else '보정 탈락'}")


if __name__ == "__main__":
    main()
