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

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ACR = {"svm": "SVM", "tfm": "TFM", "cv": "CV", "rmse": "RMSE", "ba": "BA", "snv": "SNV", "nir": "NIR",
       "mir": "MIR", "ftir": "FTIR", "pls": "PLS",
       "sg": "SG", "asls": "AsLS", "airpls": "airPLS", "arpls": "arPLS", "msc": "MSC", "emsc": "EMSC", "gcu": "GCU",
       "lvse": "LVSE"}
SHORT = {"TABPFN-V3.5": "TabPFN-3.5", "TABICLV2": "TabICLv2", "KUMO-TABULAR": "Kumo", "RAMANPFN": "RamanPFN",
         "DEEPCNN": "DeepCNN", "REZERONET": "ReZeroNet", "RIDGE": "Ridge", "KNN": "kNN"}
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
    assert out[0]["targets"] == 162 and out[-1]["targets"] == 104, out
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
    assert len(out) == 7, len(out)
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
    ours = [["This work", "39 (104)", "26", "5", "1", "3", "2", "4", "Yes", "Both", "Raman", "Yes"],
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paper", type=Path, required=True)
    ap.add_argument("--native", type=Path, required=True)
    a = ap.parse_args()
    t1 = table1()
    check_table1(a.paper, t1)
    out = {"table1": t1, "table2": table2(a.paper), "table4": table4(a.paper), "table5": table5(a.paper),
           "table6": table6(a.paper), "fig1": fig1(a.native), "fig4": fig4(a.native)}
    (ROOT / "data" / "paper.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print("wrote data/paper.json:", {k: len(v) if isinstance(v, list) else len(v.get("rows", v)) for k, v in out.items()})


if __name__ == "__main__":
    main()
