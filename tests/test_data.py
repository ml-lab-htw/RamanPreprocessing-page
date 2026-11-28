"""Checks of the generated page data. The paper comparisons run when PAPER_DIR points to the paper repo.

    PAPER_DIR=<paper repo> python -m pytest tests -q
"""
import base64
import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
sys.path.insert(0, str(ROOT / "tools"))
PAPER = Path(os.environ["PAPER_DIR"]) if os.environ.get("PAPER_DIR") else None
needs_paper = pytest.mark.skipif(PAPER is None, reason="PAPER_DIR not set")


def load(p):
    return json.loads((DATA / p).read_text())


def n_values(q):
    return len(base64.b64decode(q["b64"])) // 2


def test_26_recipes_in_table3_order():
    rec = load("recipes.json")["recipes"]
    assert len(rec) == 26 and len({r["key"] for r in rec}) == 26
    assert rec[0]["key"] == "none"


@pytest.mark.parametrize("s", [s["id"] for s in json.loads((DATA / "sets.json").read_text())])
def test_every_sample_has_every_recipe_with_the_axis_length(s):
    info = next(x for x in load("sets.json") if x["id"] == s)
    axes = load(f"{s}/axes.json")
    files = sorted((DATA / s).glob("[0-9][0-9][0-9].json"))
    assert len(files) == info["n"]
    for f in files:
        rec = json.loads(f.read_text())
        assert set(rec["out"]) == set(axes) and len(axes) == 26
        for k, q in rec["out"].items():
            a = axes[k]
            want = {"spectrum": len(a.get("x", [])), "features": a["points"], "blocks": 4 * len(a.get("x", []))}[a["kind"]]
            assert n_values(q) == want, (s, f.name, k)
            assert q["hi"] >= q["lo"]
        if info["kind"] == "synthetic":
            assert set(rec["clean"]) == set(axes)
            assert n_values(rec["background"]) == len(axes["none"]["x"])


def test_paper_json_shapes():
    p = load("paper.json")
    assert len(p["table4"]) == 25 and len(p["table5"]) == 6 and len(p["table6"]) == 5
    assert len(p["fig4"]["rows"]) == 14 and len(p["fig1"]["order"]) == 25
    assert {r["recipe"] for r in p["table4"]} == set(p["fig1"]["order"])
    # numbers stated in the paper's captions and text
    assert [sum(r["vs_none"] == "better" for r in p["fig2"][t]["ranks"]) for t in ("regression", "classification")] == [10, 7]
    assert round(p["fig3"][0]["shares"]["model"]) == 69 and round(p["fig3"][0]["shares"]["recipe"]) == 10
    assert [g["n"] for g in p["fig6"]["groups"]] == [15, 13, 28, 29, 21] and p["fig6"]["n_models"] == 13
    assert len(p["fig5"]["regression"]) == 14 and len(p["fig5"]["classification"]) == 15


@needs_paper
def test_tables_match_the_paper_tex():
    import build_paper_data as b
    p = load("paper.json")
    assert p["table2"] == b.table2(PAPER)
    assert p["table4"] == b.table4(PAPER)
    assert p["table5"] == b.table5(PAPER)
    assert p["table6"] == b.table6(PAPER)
    b.check_table1(PAPER, p["table1"])


@needs_paper
def test_table3_stages_match_the_paper_tex():
    from build_paper_data import cell
    src = (PAPER / "sections" / "05_experimental_setup.tex").read_text()
    body = src.split(r"\label{tab:recipes}", 1)[1].split(r"\midrule", 1)[1].split(r"\bottomrule", 1)[0]
    rec = {r["key"]: r for r in load("recipes.json")["recipes"]}
    stages = load("recipes.json")["stages"]
    seen = 0
    for line in body.splitlines():
        if not line.startswith(r"\texttt") or r"\multicolumn" in line:
            continue
        cells = [cell(c) for c in line.split(r"\\")[0].split("&")]
        key = cells[0]["text"]
        got = {s: c["text"] for s, c in zip(stages, cells[1:]) if c["text"]}
        assert got == rec[key]["stages"], key
        seen += 1
    assert seen == 24  # gcu_lvse and prep_ensemble span the stage columns
