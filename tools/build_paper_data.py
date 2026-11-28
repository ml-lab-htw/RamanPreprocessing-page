"""Collect the main paper's numbers for the page: Tables 2, 4, 5 and 6 parsed from the paper's own .tex
files (so the page shows exactly the published values), Figs. 1 and 4 from the analysis CSVs that drew
them, Table 1 transcribed with its citations spelled out.

    python tools/build_paper_data.py --paper <paper repo> --native <analysis dir .../study1_GSB/native>

Output: data/paper.json
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ACR = {"svm": "SVM", "tfm": "TFM", "cv": "CV", "rmse": "RMSE", "ba": "BA", "snv": "SNV", "nir": "NIR",
       "mir": "MIR", "ftir": "FTIR", "pls": "PLS",
       "sg": "SG", "asls": "AsLS", "airpls": "airPLS", "arpls": "arPLS", "msc": "MSC", "emsc": "EMSC", "gcu": "GCU",
       "lvse": "LVSE"}
SHORT = {"TABPFN-V3.5": "TabPFN-3.5", "TABICLV2": "TabICLv2", "KUMO-TABULAR": "Kumo", "RAMANPFN": "RamanPFN",
         "DEEPCNN": "DeepCNN", "REZERONET": "ReZeroNet", "RIDGE": "Ridge", "KNN": "kNN", "PCALDA": "PCA-LDA"}
FAMILIES = ["Chemometric", "Kernel methods", "Tree ensembles", "Deep learning", "Tabular foundation"]


def tex_rows(path: Path) -> list[list[dict]]:
    """Body rows of the first tabular in a .tex file, each cell as {text, gray, bold}."""
    src = path.read_text()
    body = src.split(r"\midrule", 1)[1].split(r"\bottomrule", 1)[0]
    rows = []
    for line in body.splitlines():
        line = line.strip()
        if "&" not in line or line.startswith("%"):
            continue
        line = line.replace(r"\rowcolor{stagefill}", "").split(r"\\")[0]
        rows.append([cell(c) for c in line.split("&")])
    return rows


def cell(s: str) -> dict:
    gray = r"\textcolor{gray}" in s
    bold = r"\mathbf" in s or r"\textbf" in s
    s = s.split(r"\newline")[0]
    s = re.sub(r"\\multirow\{\d+\}\{\*\}\{", "{", s)
    s = re.sub(r"\\acrshortpl\{(\w+)\}", lambda m: ACR[m.group(1)] + "s", s)
    s = re.sub(r"\\acrshort\{(\w+)\}", lambda m: ACR[m.group(1)], s)
    s = re.sub(r"\\(textcolor\{gray\}|mathbf|textbf|texttt|emph)", "", s)
    s = s.replace(r"\textbullet", "\u2022").replace(r"\stage", "").replace(r"\_", "_").replace(r"\,", " ").replace(r"\ldots", "…").replace(r"\quad", "")
    s = s.replace("{", "").replace("}", "").replace("$", "").strip()
    s = s.lstrip("_").strip()
    return {"text": s, "gray": gray, "bold": bold}


def num(a: dict, b: dict) -> str:
    """Join the integer and decimal cells of a split median ('-10', '.7' -> '-10.7')."""
    return a["text"] + b["text"]


def interval(c: dict) -> list[float]:
    lo, hi = c["text"].strip("[]").replace("…", ",").split(",")
    return [float(lo), float(hi)]


def table2(paper: Path):
    rows = tex_rows(paper / "tables" / "benchmark_funnel.tex")
    out = []
    for r in rows:
        t = [c["text"] for c in r]
        out.append({"step": t[0], "criterion": t[1], "removed": [_int(t[2]), _int(t[3])],
                    "datasets": int(t[4]), "targets": int(t[5]), "classification": int(t[6]),
                    "regression": int(t[7])})
    assert out[0]["targets"] == 162 and out[-1]["targets"] == 103, out
    return out


def _int(s):
    return None if s in ("--", "") else int(s)


def table4(paper: Path):
    rows = tex_rows(paper / "tables" / "study1_recipe_ranks.tex")
    out = []
    for r in rows:
        out.append({"recipe": r[0]["text"],
                    "reg": {"median": float(num(r[1], r[2])), "text": num(r[1], r[2]), "iqr": interval(r[3]),
                            "worse": int(r[4]["text"]), "significant": not r[1]["gray"]},
                    "cls": {"median": float(num(r[5], r[6])), "text": num(r[5], r[6]), "iqr": interval(r[7]),
                            "worse": int(r[8]["text"]), "significant": not r[5]["gray"]}})
    assert len(out) == 25, len(out)
    return out


def table5(paper: Path):
    rows = tex_rows(paper / "tables" / "family_recipes.tex")
    out = []
    for r in rows:
        def med(i):
            return {"median": num(r[i], r[i + 1]), "ci": interval(r[i + 2]), "gray": r[i]["gray"],
                    "bold": r[i]["bold"]}
        out.append({"family": r[0]["text"],
                    "global": {**med(1), "worse": int(r[4]["text"])},
                    "family_recipe": {"recipe": r[5]["text"], **med(6), "worse": int(r[9]["text"])},
                    "per_task_cv": {**med(10), "worse": int(r[13]["text"])},
                    "oracle": med(14)})
    assert len(out) == 6, len(out)
    return out


def table6(paper: Path):
    rows = tex_rows(paper / "tables" / "selection_rules.tex")
    out, last = [], None
    for r in rows:
        rule = r[0]["text"] or last
        last = rule
        out.append({"rule": rule, "chosen_on": r[1]["text"],
                    "rmse": {"median": num(r[2], r[3]), "ci": interval(r[4]), "worse": int(r[5]["text"]),
                             "gray": r[2]["gray"], "bold": r[2]["bold"]},
                    "ba": {"median": num(r[6], r[7]), "ci": interval(r[8]), "worse": int(r[9]["text"]),
                           "gray": r[6]["gray"], "bold": r[6]["bold"]}})
    assert len(out) == 5, len(out)  # per-model recipe dropped 2026-11-27
    return out


def table1():
    cols = ["Study", "Datasets (targets)", "Recipes", "Chemo.", "Kernel", "Trees", "Deep", "Found.",
            "Recipe effects", "Tasks", "Modality", "Open?"]
    rows = [
        ["Poth et al. 2022", "2 (19)", "248", "9", "2", "4", "1", "–", "Yes", "Regression", "Raman", "No"],
        ["Sutliff et al. 2024", "1 (1)", "1152", "5", "2", "2", "1", "–", "Yes", "Classification", "NIR", "Yes"],
        ["Gariso et al. 2025", "2 (2)", "18", "4", "–", "–", "1", "–", "Yes", "Both", "NIR, MIR", "Yes"],
        ["Sineesh and Kamsali 2026", "3 (3)", "1", "–", "–", "–", "–", "–", "No", "Classification", "Raman", "Yes"],
        ["Innocente et al. 2026", "3 (3)", "12", "–", "1", "–", "–", "–", "Yes", "Classification", "Raman", "Yes"],
        ["Khanam et al. 2026", "1 (1)", "1", "–", "–", "–", "–", "–", "No", "Classification", "FTIR", "Yes"],
        ["Lange et al. 2026", "1 (8)", "1", "1", "–", "2", "–", "–", "No", "Regression", "Raman", "Yes"],
        ["Reiter et al. 2026", "66 (66)", "30–60", "2", "–", "1", "1", "1", "Yes", "Both", "NIR", "–"],
        ["Deng et al. 2026", "6 (6)", "12", "1", "1", "1", "2", "–", "Yes", "Regression", "NIR", "Data only"],
        ["Koddenbrock et al. 2026 (RamanBench)", "60 (140)", "11", "3", "–", "–", "7", "–", "Yes", "Both", "Raman", "Yes"],
    ]
    ours = [["This work", "38 (103)", "26", "5", "1", "3", "2", "4", "Yes", "Both", "Raman", "Yes"],
            ["small-data ablation", "10 (15)", "", "", "", "", "", "", "", "", "", ""]]
    return {"columns": cols, "rows": rows, "ours": ours}


def check_table1(paper: Path, t1: dict):
    """Every non-citation cell of the transcription must match the .tex row in order."""
    src = (paper / "sections" / "01_intro.tex").read_text()
    body = src.split(r"\midrule", 1)[1].split(r"\midrule", 1)[0]
    lines = [ln for ln in body.splitlines() if "&" in ln]
    assert len(lines) == len(t1["rows"])
    for ln, row in zip(lines, t1["rows"]):
        cells = [cell(c)["text"].replace("--", "–") for c in ln.split(r"\\")[0].split("&")[1:]]
        assert cells == row[1:], (cells, row)


def fig1(native: Path):
    fam = pd.read_csv(native / "family_recipe_effects.csv")
    eff = pd.read_csv(native / "recipe_effects.csv")
    allm = fam[fam.family == "All models"]
    order = allm[allm.task_type == "regression"].sort_values("median_pct").recipe.tolist()
    assert len(order) == 25 and "none" not in order
    cells, summary = [], []
    for _, r in fam.iterrows():
        rec = {"task": r.task_type, "recipe": r.recipe, "median": round(r.median_pct, 2),
               "lo": round(r.median_lo_pct, 2), "hi": round(r.median_hi_pct, 2),
               "worse": round(100 * r.share_worse_than_none, 1), "pairs": int(r.n_pairs)}
        (summary if r.family == "All models" else cells).append(rec if r.family == "All models" else
                                                                 {**rec, "family": r.family})
    time = eff[eff.task_type == "regression"].set_index("recipe").time_multiplier
    return {"order": order, "families": FAMILIES, "cells": cells, "all_models": summary,
            "time": {k: round(float(v), 2) for k, v in time.items() if k in order}}


def fig4(native: Path):
    gap = pd.read_csv(native / "model_gap.csv")
    t = gap[gap.task_type == "regression"].sort_values("gap_none_median_pct")
    glob = pd.read_csv(native / "global_recipe.csv").set_index("task_type").loc["regression", "recipe"]
    rows = [{"model": SHORT.get(r.model, r.model), "family": r.family,
             "none": round(r.gap_none_median_pct, 1), "global": round(r.gap_global_median_pct, 1),
             "cv": round(r.gap_nested_median_pct, 1), "oracle": round(r.gap_oracle_median_pct, 1),
             "targets": int(r.n_targets)} for _, r in t.iterrows()]
    assert len(rows) == 14
    return {"global_recipe": glob, "rows": rows}


def cd_cliques(vals: list[float], cd: float) -> list[list[int]]:
    """Maximal runs of rank-ordered recipes spanning <= CD (as analyze_prep_effects._cd_cliques)."""
    bars = []
    for i in range(len(vals)):
        j = i
        while j + 1 < len(vals) and vals[j + 1] - vals[i] <= cd:
            j += 1
        if j > i:
            bars.append((i, j))
    return [list(b) for b in bars if not any(o[0] <= b[0] and b[1] <= o[1] and o != b for o in bars)]


def fig2(analysis: Path):
    """Critical-difference diagrams, (model, target) blocks (plot_prep_effects_kfold.plot_cd_diagrams)."""
    ranks = pd.read_csv(analysis / "cd_average_ranks.csv")
    summ = pd.read_csv(analysis / "cd_friedman_nemenyi.csv")
    out = {}
    for task in ("regression", "classification"):
        s = summ[(summ.task_type == task) & (summ.blocking == "model_family")].iloc[0]
        r = ranks[(ranks.task_type == task) & (ranks.blocking == "model_family")].sort_values("avg_rank")
        vals = r.avg_rank.tolist()
        out[task] = {"cd": round(float(s.cd), 4), "n_blocks": int(s.n_blocks),
                     "ranks": [{"recipe": x.recipe, "rank": round(float(x.avg_rank), 4), "vs_none": x.vs_none}
                               for x in r.itertuples()],
                     "cliques": cd_cliques(vals, float(s.cd))}
    n_better = {t: sum(x["vs_none"] == "better" for x in out[t]["ranks"]) for t in out}
    assert n_better == {"regression": 10, "classification": 7}, n_better  # Fig. 2 caption
    return out


def fig3(native: Path):
    var = pd.read_csv(native / "variance_summary.csv")
    rows = []
    for task, sub, lab, n in [("regression", "all", "Regression, all models", 14), ("regression", "foundation", "Regression, TFMs", 4),
                              ("classification", "all", "Classification, all models", 15),
                              ("classification", "foundation", "Classification, TFMs", 4)]:
        v = var[(var.task_type == task) & (var.subset == sub)].iloc[0]
        rows.append({"label": lab, "task": task, "n_models": n, "n_targets": int(v.n_targets),
                     "shares": {"model": round(100 * v.median_share_model, 2), "recipe": round(100 * v.median_share_recipe, 2),
                                "interaction": round(100 * v.median_share_interaction_net, 2),
                                "noise": round(100 * v.median_share_noise, 2)}})
    assert round(rows[0]["shares"]["model"]) == 69 and round(rows[0]["shares"]["recipe"]) == 10  # Conclusions
    return rows


def fig5(analysis: Path, native: Path):
    """In-sample against held-out gain of each model's best recipe (plot_study1_native.sensitivity_vs_heldout)."""
    ho = pd.read_csv(analysis / "heldout_fixed_best_family.csv")
    hb = pd.read_csv(analysis / "heldout_bootstrap.csv")
    ho = ho.merge(hb[["task_type", "model", "heldout_median", "ci_lo", "ci_hi"]], on=["task_type", "model"])
    gains = pd.read_csv(native / "model_gains.csv")
    fam = {m: f for m, f in zip(gains.model, gains.family) if not m.startswith("[")}
    conv = {"regression": lambda v: 100 * (np.exp(v) - 1), "classification": lambda v: -100 * np.asarray(v)}
    out = {}
    for task in ("regression", "classification"):
        t = ho[(ho.task_type == task) & ho.model.isin(list(fam))].copy()
        f = conv[task]
        t["ins"], t["held"] = f(t.full_insample_native_median), f(t.heldout_native_median_med)
        lo, hi = f(t.ci_lo), f(t.ci_hi)
        t["lo"], t["hi"] = np.minimum(lo, hi), np.maximum(lo, hi)
        t["stable"] = t.hi < 0 if task == "regression" else t.lo > 0
        t = t.sort_values("ins", ascending=task != "regression")
        out[task] = [{"model": SHORT.get(r.model, r.model), "family": fam[r.model], "recipe": r.full_fixed_best,
                      "ins": round(float(r.ins), 2), "held": round(float(r.held), 2), "lo": round(float(r.lo), 2),
                      "hi": round(float(r.hi), 2), "stable": bool(r.stable)} for r in t.itertuples()]
    assert len(out["regression"]) == 14 and len(out["classification"]) == 15
    return out


def fig6(native: Path):
    """Selection rules by task size, one point per target = median over its models of the log RMSE
    ratio (plot_study1_native.selection_by_size), stored as % change."""
    pairs = pd.concat([pd.read_csv(native / "tiny_selection_pairs.csv").assign(n_lo=0),
                       pd.read_csv(native / "selection_by_size_pairs.csv")], ignore_index=True)
    rules = ["global", "family", "nested"]
    t = pairs.groupby(["n_lo", "dataset", "key"])[rules].median().reset_index()
    labels = dict(zip(sorted(t.n_lo.unique()), ["< 50", "50–100", "100–200", "200–500", "> 500"], strict=True))
    groups = []
    for g, lab in labels.items():
        tg = t[t.n_lo == g]
        groups.append({"n_lo": int(g), "label": lab, "n": len(tg),
                       "median": {r: round(float(100 * (np.exp(np.median(tg[r])) - 1)), 2) for r in rules},
                       "worse": {r: round(float(100 * (tg[r] > 0).mean())) for r in rules}})
    pts = [{"g": int(r["n_lo"]), "key": r["key"], "dataset": r["dataset"],
            **{k: round(float(100 * (np.exp(r[k]) - 1)), 2) for k in rules}} for _, r in t.iterrows()]
    assert [g["n"] for g in groups] == [15, 13, 28, 29, 21]  # Fig. 6 axis labels
    assert [g["worse"]["global"] for g in groups] == [27, 54, 7, 10, 19], [g["worse"] for g in groups]
    return {"groups": groups, "targets": pts, "n_models": int(pairs.model.nunique())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paper", type=Path, required=True)
    ap.add_argument("--native", type=Path, required=True)
    a = ap.parse_args()
    analysis = a.native.parent
    t1 = table1()
    check_table1(a.paper, t1)
    out = {"table1": t1, "table2": table2(a.paper), "table4": table4(a.paper), "table5": table5(a.paper),
           "table6": table6(a.paper), "fig1": fig1(a.native), "fig2": fig2(analysis), "fig3": fig3(a.native),
           "fig4": fig4(a.native), "fig5": fig5(analysis, a.native), "fig6": fig6(a.native)}
    (ROOT / "data" / "paper.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print("wrote data/paper.json:", list(out))


if __name__ == "__main__":
    main()
