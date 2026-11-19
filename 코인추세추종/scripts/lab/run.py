"""연구 단계 실행 (RESEARCH.md).
  python3 scripts/lab/run.py <단계>           # 격자를 돌리고 판정까지. 상태는 data/lab/<단계>/status.json
  python3 scripts/lab/run.py <단계> --analyze # 저장된 격자로 판정만 다시
"""
import importlib, json, os, sys, traceback
from datetime import datetime
from multiprocessing import Pool

import numpy as np
import pandas as pd

import common as C

STAGES = {"triangle": "triangle_grid"}  # 등록 순서 = 실행 순서. 단계 이름 → 모듈
WORKERS = 8


def now():
    return datetime.now().isoformat(timespec="seconds")


def status(stage, **kw):
    p = C.OUT / stage / "status.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    s = json.loads(p.read_text()) if p.exists() else {}
    s.update(kw, updated=now())
    p.write_text(json.dumps(s, ensure_ascii=False))


def compute(stage, mod):
    out, tasks = C.OUT / stage, mod.tasks()
    status(stage, state="running", pid=os.getpid(), started=now(), done=0, total=len(tasks), finished=None, error=None)
    parts = {}
    with Pool(WORKERS) as pool:
        for k, (cfgs, G, T, N) in enumerate(pool.imap_unordered(mod.task, tasks), 1):
            parts.setdefault(cfgs[0][mod.CHUNK] if mod.CHUNK else "all", []).append((cfgs, G, T, N))
            status(stage, done=k)
            print(f"{now()} {k}/{len(tasks)}", flush=True)
    for key, ps in parts.items():
        np.savez_compressed(out / f"grid_{key}.npz", **{x: np.concatenate([p[i] for p in ps]) for i, x in [(1, "G"), (2, "T"), (3, "N")]})
        (out / f"grid_{key}.json").write_text(json.dumps(sum((p[0] for p in ps), []), ensure_ascii=False))


def load(stage):
    chunks = []
    for f in sorted((C.OUT / stage).glob("grid_*.npz")):
        z = np.load(f)
        chunks.append((json.loads(f.with_suffix(".json").read_text()), z["G"], z["T"], z["N"]))
    return chunks


def chain(r):
    return float(np.prod(1 + np.asarray(r, float)) - 1)


def analyze(stage, mod):
    """RESEARCH.md 의 판정. 개발 구간(봉인 전) 데이터만 쓴다."""
    D, chunks = C.days(), load(stage)
    dev = (D >= pd.Timestamp(C.BLOCKS[0][0])) & (D <= pd.Timestamp(C.BLOCKS[-1][1]))
    costs = (C.COST, C.COST_HARD)
    bn = {k: C.bench(k) for k in ["F0", "현물봇"]}
    net = lambda b, c: (b[0] - np.float32(c) * b[1])[dev]
    btc = C.perp("BTC", "1d").close
    bear = (btc < btc.rolling(200).mean()).shift(1).reindex(D).fillna(False).to_numpy()[dev]  # 전날 종가가 200일선 아래
    years = pd.DatetimeIndex(D[dev]).year
    res = {"stage": stage, "name": mod.NAME, "sources": mod.SOURCES, "grid": {**mod.SIG, **mod.TRADE}, "default": mod.DEFAULT,
           "cells": sum(len(c[0]) for c in chunks), "made": now(), "window": [C.BLOCKS[0][0], C.BLOCKS[-1][1]], "units": []}
    for u in mod.UNITS:
        sub = []
        for cfgs, G, T, N in chunks:
            idx = [i for i, c in enumerate(cfgs) if u["where"] is None or u["where"](c)]
            sub.append(([cfgs[i] for i in idx], G[idx], T[idx], N[idx]))
        wf = {c: C.walk_forward(sub, D, c) for c in costs}
        r, _, n_test, picks = wf[C.COST]
        b, spot = {c: net(bn[u["bench"]], c) for c in costs}, {c: net(bn["현물봇"], c) for c in costs}

        # 격자 분포 (시험 구간, 0.10%)
        shs, cfg_all, rows = [], [], []
        for ci, (cfgs, G, T, N) in enumerate(sub):
            shs.append(C.sharpe_rows(G[:, dev] - np.float32(C.COST) * T[:, dev]))
            cfg_all += cfgs
            rows += [(ci, k) for k in range(len(cfgs))]
        sh = np.concatenate(shs) if shs else np.array([])
        ok = np.nan_to_num(sh, nan=-np.inf)
        b_sh = C.stats(b[C.COST])["샤프"]
        dflt = mod.default(u)
        di = next((i for i, c in enumerate(cfg_all) if c == dflt), None)
        bi = int(np.argmax(ok))
        ci, k = rows[bi]
        best_r = sub[ci][1][k, dev] - np.float32(C.COST) * sub[ci][2][k, dev]
        marg = {key: {str(v): {"중앙값": float(np.nanmedian(sh[m])) if np.isfinite(sh[m]).any() else None, "양수": float((ok[m] > 0).mean()), "칸": int(m.sum())}
                      for v in vals for m in [np.array([c[key] == v for c in cfg_all])]}
                for key, vals in res["grid"].items()}
        seal = C.walk_forward(sub, D, C.COST, blocks=[("2025-07-01", "2025-07-01")])[3][0]  # 봉인 구간에 쓸 칸 = 개발 구간 전부로 고른 것

        s, sh_hard = C.stats(r, n_test), C.stats(wf[C.COST_HARD][0], wf[C.COST_HARD][2])
        bs, bs_hard = C.stats(b[C.COST]), C.stats(b[C.COST_HARD])
        sp, sp_hard = C.stats(spot[C.COST]), C.stats(spot[C.COST_HARD])
        mix, mix_hard = C.stats(0.5 * r + 0.5 * spot[C.COST]), C.stats(0.5 * wf[C.COST_HARD][0] + 0.5 * spot[C.COST_HARD])
        frac_pos = float((ok > 0).mean())
        d_sh = None if di is None or not np.isfinite(sh[di]) else float(sh[di])
        crit = {
            "1 샤프·MDD": s["샤프"] is not None and s["샤프"] > bs["샤프"] and s["MDD"] >= bs["MDD"] - 0.05,
            "2 0.25% 비용": sh_hard["샤프"] is not None and sh_hard["샤프"] > bs_hard["샤프"],
            "3 거래 30회": n_test >= C.MIN_TEST,
            "4 격자 절반·기본값": frac_pos >= 0.5 and d_sh is not None and d_sh > 0,
        }
        if u["bench"] == "F0":
            crit["나 현물 봇 보완"] = mix["샤프"] >= sp["샤프"] + 0.1 and mix["MDD"] >= sp["MDD"] and mix_hard["샤프"] >= sp_hard["샤프"]
        passed = all(crit[k] for k in ["1 샤프·MDD", "2 0.25% 비용", "3 거래 30회", "4 격자 절반·기본값"]) or \
            (crit.get("나 현물 봇 보완", False) and crit["3 거래 30회"] and crit["4 격자 절반·기본값"])
        bear_of = lambda x: chain(np.asarray(x)[bear])
        res["units"].append({
            "name": u["name"], "bench": u["bench"], "cells": len(cfg_all), "passed": passed, "criteria": crit,
            "wf": s, "wf_hard": sh_hard, "bench_stats": bs, "bench_hard": bs_hard, "spot": sp, "spot_hard": sp_hard, "mix": mix, "mix_hard": mix_hard,
            "picks": [{"from": a, "cfg": c, "train_sharpe": t} for a, c, t in picks],
            "seal_pick": {"cfg": seal[1], "train_sharpe": seal[2]},
            "picks_hard": [{"from": a, "cfg": c, "train_sharpe": t} for a, c, t in wf[C.COST_HARD][3]],
            "by_year": {str(y): {"전략": chain(r[years == y]), "기준선": chain(b[C.COST][years == y]), "현물봇": chain(spot[C.COST][years == y])} for y in sorted(set(years))},
            "bear": {"날수": int(bear.sum()), "전략": bear_of(r), "기준선": bear_of(b[C.COST]), "현물봇": bear_of(spot[C.COST])},
            "corr_spot": float(np.corrcoef(r, spot[C.COST])[0, 1]) if r.std() > 0 else None,
            "grid": {"칸": len(cfg_all), "양수 비율": frac_pos, "기준선 초과 비율": float((ok > b_sh).mean()),
                     "분위": dict(zip(["10%", "25%", "50%", "75%", "90%"], [float(x) for x in np.nanpercentile(sh, [10, 25, 50, 75, 90])])) if np.isfinite(sh).any() else None,
                     "기본값": {"cfg": dflt, "샤프": d_sh, "거래": None if di is None else int(sub[rows[di][0]][3][rows[di][1], dev].sum())},
                     "최고 칸": {"cfg": cfg_all[bi], "샤프": float(sh[bi]), "DSR": C.dsr(best_r, sh / np.sqrt(365))}},
            "marginal": marg,
            "curve": {"dates": [str(x.date()) for x in D[dev][::7]], "전략": np.cumprod(1 + r)[::7].round(4).tolist(),
                      "기준선": np.cumprod(1 + b[C.COST])[::7].round(4).tolist(), "현물봇": np.cumprod(1 + spot[C.COST])[::7].round(4).tolist()},
        })
    (C.OUT / stage / "summary.json").write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str))
    return res


def main(stage, only_analyze=False):
    mod = importlib.import_module(STAGES[stage])
    try:
        if not only_analyze:
            compute(stage, mod)
        status(stage, state="analyzing")
        res = analyze(stage, mod)
        status(stage, state="done", finished=now())
        for u in res["units"]:
            print(f"{res['name']} · {u['name']}: {'통과' if u['passed'] else '기각'}  워크포워드 샤프 {u['wf']['샤프']} / 기준선 {u['bench_stats']['샤프']:.2f}")
    except Exception:
        status(stage, state="failed", error=traceback.format_exc()[-2000:])
        raise


if __name__ == "__main__":
    main(sys.argv[1], "--analyze" in sys.argv)
