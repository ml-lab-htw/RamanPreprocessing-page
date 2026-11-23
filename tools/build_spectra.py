"""Precompute the recipe explorer's data: every one of the paper's 26 recipes applied to 100 synthetic
spectra and to about 100 real spectra from three public benchmark datasets.

    python tools/build_spectra.py --mirror <path to the RamanBench HF mirror snapshot>

Needs raman-bench >= 1.6.0 (``raman_bench.preprocessing.recipe``). Recipes that learn from the batch
(MSC, EMSC, standard scaling, GCU, LVSE and the recipes containing them) are fitted on the whole set:
the 100 synthetic spectra, or every spectrum of a real dataset, as on the training folds of the paper.

Outputs (all under data/):
  recipes.json           the 26 recipes: group, steps in run order, stages (Table 3), output kind
  sets.json              the spectrum sets with their sources and sample counts
  <set>/axes.json        per recipe the x values shown (Raman shift, or feature index)
  <set>/NNN.json         per sample: metadata, target values and every recipe's output, quantised to
                         16 bits per value (lo, hi, base64 of little-endian uint16)
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import time
from pathlib import Path

import numpy as np
import pandas as pd
from raman_bench.preprocessing import recipe, recipe_description, recipe_names

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DISPLAY_MAX = 720  # at most this many points per drawn spectrum; longer outputs are averaged in bins

# Table 3 of the paper: the stage a recipe uses and the method named in its cell ("" = stage unused,
# "•" = a stage with a single method).
STAGES = ["Cosmic rays", "Denoising", "Baseline", "Scatter", "Derivative", "SNV", "Pooling",
          "Column scaling", "Features"]
TABLE3 = {
    "none": {},
    "sg": {"Denoising": "SG"},
    "bc": {"Baseline": "AsLS"},
    "snv": {"SNV": "•"},
    "msc": {"Scatter": "MSC"},
    "emsc": {"Scatter": "EMSC"},
    "stdscale": {"Column scaling": "•"},
    "bc_sg": {"Denoising": "SG", "Baseline": "AsLS"},
    "bc_snv": {"Baseline": "AsLS", "SNV": "•"},
    "bc_sg_snv": {"Denoising": "SG", "Baseline": "AsLS", "SNV": "•"},
    "bc_sg_msc": {"Denoising": "SG", "Baseline": "AsLS", "Scatter": "MSC"},
    "airpls_snv": {"Baseline": "airPLS", "SNV": "•"},
    "arpls_snv": {"Baseline": "arPLS", "SNV": "•"},
    "sg_rubberband_snv": {"Denoising": "SG", "Baseline": "rubberband", "SNV": "•"},
    "wavelet_bc_snv": {"Denoising": "wavelet", "Baseline": "AsLS", "SNV": "•"},
    "crr_snv": {"Cosmic rays": "•", "SNV": "•"},
    "sg_d1_snv": {"Derivative": "SG, 1st", "SNV": "•"},
    "sg_d2_snv": {"Derivative": "SG, 2nd", "SNV": "•"},
    "avgpool": {"Pooling": "mean of 5"},
    "bc_snv_avgpool": {"Baseline": "AsLS", "SNV": "•", "Pooling": "mean of 5"},
    "decimate": {"Pooling": "every 5th"},
    "all": {"Cosmic rays": "•", "Denoising": "SG", "Baseline": "AsLS", "Scatter": "MSC", "SNV": "•",
            "Column scaling": "•"},
    "gcu": {"Features": "GCU"},
    "lvse": {"Features": "LVSE"},
    "gcu_lvse": {"Features": "GCU + LVSE"},
    "prep_ensemble": {"Features": "4 blocks"},
}
GROUPS = [
    ("Reference", ["none"]),
    ("Single steps", ["sg", "bc", "snv", "msc", "emsc", "stdscale"]),
    ("Baseline correction with other steps", ["bc_sg", "bc_snv", "bc_sg_snv", "bc_sg_msc", "airpls_snv",
                                              "arpls_snv", "sg_rubberband_snv", "wavelet_bc_snv"]),
    ("Other steps followed by SNV", ["crr_snv", "sg_d1_snv", "sg_d2_snv"]),
    ("Pooling", ["avgpool", "bc_snv_avgpool", "decimate"]),
    ("Full pipeline", ["all"]),
    ("Learned representations", ["gcu", "lvse"]),
    ("Concatenated recipes", ["gcu_lvse", "prep_ensemble"]),
]
POOLED = {"avgpool", "bc_snv_avgpool", "decimate"}
FEATURES = {"gcu": [("GCU", 16)], "lvse": [("LVSE", 64)], "gcu_lvse": [("GCU", 16), ("LVSE", 64)]}
ENSEMBLE_BLOCKS = ["snv", "emsc", "airpls_snv", "none"]
BATCH_FITTED = {"msc", "emsc", "stdscale", "bc_sg_msc", "all", "gcu", "lvse", "gcu_lvse", "prep_ensemble"}

# ---------------------------------------------------------------------------------------------
# Synthetic spectra: three components with pseudo-Voigt bands (position cm-1, relative height, FWHM
# cm-1), mixed at random concentrations, then a fluorescence background, multiplicative scatter, an
# offset, Gaussian and shot noise and, in some spectra, cosmic-ray spikes.
COMPONENTS = {
    "analyte": [(425, 0.45, 14), (520, 0.55, 16), (850, 0.30, 14), (915, 0.35, 14), (1065, 0.65, 18),
                (1125, 1.00, 16), (1365, 0.40, 18), (1460, 0.50, 20)],
    "matrix": [(880, 1.00, 12), (1050, 0.45, 14), (1095, 0.35, 14), (1275, 0.25, 16), (1455, 0.55, 18),
               (1640, 0.30, 60)],
    "interferent": [(620, 0.30, 10), (1000, 1.00, 8), (1030, 0.40, 9), (1180, 0.20, 10), (1585, 0.30, 12),
                    (1605, 0.60, 14)],
}
WN = np.arange(400.0, 1802.0, 2.0)  # 701 points, 2 cm-1 spacing


def pseudo_voigt(x, x0, h, fwhm, eta=0.6):
    g = np.exp(-4 * np.log(2) * (x - x0) ** 2 / fwhm ** 2)
    lor = 1 / (1 + 4 * (x - x0) ** 2 / fwhm ** 2)
    return h * (eta * lor + (1 - eta) * g)


def component(name, shift):
    return sum(pseudo_voigt(WN, x0 + shift, h, w) for x0, h, w in COMPONENTS[name])


def synthetic_set(n=100, seed=2026):
    rng = np.random.default_rng(seed)
    X, clean, base, meta = [], [], [], []
    for i in range(n):
        shift = rng.normal(0, 1.0)
        c = {"analyte": rng.uniform(0.1, 1.0), "matrix": rng.uniform(0.8, 1.2),
             "interferent": rng.uniform(0.0, 0.6)}
        signal = 1000 * sum(c[k] * component(k, shift) for k in COMPONENTS)
        peak = signal.max()
        fluo = math.exp(rng.uniform(math.log(0.3), math.log(8)))   # background peak / Raman peak
        centre, width = rng.uniform(900, 1700), rng.uniform(350, 900)
        slope = rng.uniform(-0.4, 0.4)
        t = (WN - WN.min()) / (WN.max() - WN.min())
        shape = np.exp(-0.5 * ((WN - centre) / width) ** 2) + 0.35 * (1 + slope * (2 * t - 1))
        background = fluo * peak * shape / shape.max()
        scatter = math.exp(rng.normal(0, 0.25))
        offset = rng.uniform(0, 0.3) * peak
        measured = scatter * (signal + background) + offset
        snr_db = rng.uniform(12, 36)
        sigma = peak * scatter / 10 ** (snr_db / 20)
        noisy = measured + rng.normal(0, sigma, WN.size) + rng.normal(0, 1, WN.size) * np.sqrt(
            np.maximum(measured, 0)) * 0.15
        spikes = int(rng.choice([0, 0, 0, 1, 1, 2, 3]))
        for _ in range(spikes):
            j = int(rng.integers(5, WN.size - 5))
            hgt = rng.uniform(2, 8) * peak * scatter
            noisy[j] += hgt
            if rng.random() < 0.5:
                noisy[j + 1] += 0.4 * hgt
        X.append(noisy)
        clean.append(signal)
        base.append(scatter * background + offset)
        meta.append({"snr_db": round(snr_db, 1), "fluorescence": round(fluo, 2), "scatter": round(scatter, 2),
                     "spikes": spikes, "shift_cm": round(shift, 2),
                     "y": {"analyte": round(10 * c["analyte"], 2), "interferent": round(10 * c["interferent"], 2)}})
    return np.array(X), np.array(clean), np.array(base), meta


# ---------------------------------------------------------------------------------------------
REAL = [
    {"id": "bioprocess", "dataset": "bioprocess_analytes_kaiser", "n_show": 34,
     "label": "Bioprocess analytes (Kaiser)", "what": "Mixtures of glucose, acetate and magnesium sulfate, Kaiser Raman spectrometer",
     "targets": {"Glucose": "Glucose", "Acetate": "Acetate", "MagnesiumSulfate": "MgSO₄"},
     "source": "https://huggingface.co/datasets/chlange/RamanSpectraBioprocessAnalystesKaiser",
     "doi": "10.1016/j.saa.2025.125861", "license": "CC BY 4.0"},
    {"id": "fuel", "dataset": "fuel_handheld", "n_show": 33,
     "label": "Fuel (handheld)", "what": "Commercial gasoline, handheld Raman spectrometer",
     "targets": {"Research Octane Number": "RON", "Ethanol Content (%)": "Ethanol (%)",
                 "Aromatics Content": "Aromatics"},
     "source": "https://huggingface.co/datasets/HTW-KI-Werkstatt/FuelRamanSpectraHandheld",
     "doi": "10.1021/acs.energyfuels.9b02944", "license": "CC BY 4.0"},
    {"id": "sers", "dataset": "adenine_colloidal_gold", "n_show": 33,
     "label": "Adenine SERS (gold colloid)", "what": "Surface-enhanced Raman spectra of adenine on colloidal gold",
     "targets": {"target": "Adenine conc."},
     "source": "https://doi.org/10.5281/zenodo.3572359", "doi": "10.1021/acs.analchem.9b05658",
     "license": "CC BY 4.0"},
]


def load_real(mirror: Path, dataset: str):
    df = pd.read_parquet(mirror / dataset / "data" / "train-00000-of-00001.parquet")
    spec = [c for c in df.columns if _is_number(c)]
    wn = np.array([float(c) for c in spec])
    assert np.all(np.diff(wn) > 0), dataset
    X = df[spec].to_numpy(dtype=float)
    assert np.isfinite(X).all(), dataset
    return X, wn, df.drop(columns=spec)


def _is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False


# ---------------------------------------------------------------------------------------------
def bin_mean(a: np.ndarray, f: int) -> np.ndarray:
    """Mean over runs of f points along the last axis (a trailing partial run is averaged too)."""
    if f == 1:
        return a
    n = a.shape[-1]
    m = math.ceil(n / f)
    pad = m * f - n
    if pad:
        a = np.concatenate([a, np.repeat(a[..., -1:], pad, axis=-1)], axis=-1)
    return a.reshape(*a.shape[:-1], m, f).mean(-1)


def display_factor(n: int) -> int:
    return max(1, math.ceil(n / DISPLAY_MAX))


def quantise(v: np.ndarray) -> dict:
    v = np.asarray(v, dtype=float)
    assert np.isfinite(v).all()
    lo, hi = float(v.min()), float(v.max())
    span = hi - lo if hi > lo else 1.0
    q = np.round((v - lo) / span * 65535).astype("<u2")
    return {"lo": float(f"{lo:.6g}"), "hi": float(f"{hi:.6g}"), "b64": base64.b64encode(q.tobytes()).decode()}


def run_recipes(X: np.ndarray, wn: np.ndarray, label: str):
    """Every recipe on the batch X (rows = spectra). Returns {recipe: (display array, axis dict)}."""
    frame = pd.DataFrame(X, columns=wn)
    out, axes = {}, {}
    f_spec = display_factor(len(wn))
    x_spec = bin_mean(wn, f_spec)
    for name in recipe_names():
        t0 = time.time()
        Z = np.asarray(recipe(name).fit_transform(frame), dtype=float)
        assert np.isfinite(Z).all(), (label, name)
        if name in POOLED:
            m = Z.shape[1]
            xw = wn[: m * 5].reshape(m, 5).mean(1) if name != "decimate" else wn[: m * 5: 5]
            f = display_factor(m)
            out[name] = bin_mean(Z, f)
            axes[name] = {"kind": "spectrum", "x": _r(bin_mean(xw, f)), "points": m}
        elif name in FEATURES:
            assert Z.shape[1] == sum(k for _, k in FEATURES[name]), (name, Z.shape)
            out[name] = Z
            axes[name] = {"kind": "features", "segments": [{"name": s, "n": k} for s, k in FEATURES[name]],
                          "points": Z.shape[1]}
        elif name == "prep_ensemble":
            p = len(wn)
            assert Z.shape[1] == 4 * p
            blocks = [Z[:, b * p:(b + 1) * p] for b in range(4)]
            for b, ref in zip(blocks, ENSEMBLE_BLOCKS):
                if ref != "emsc":
                    assert np.allclose(b, np.asarray(recipe(ref).fit_transform(frame)), atol=1e-6), (label, ref)
            out[name] = np.concatenate([bin_mean(b, f_spec) for b in blocks], axis=1)
            axes[name] = {"kind": "blocks", "blocks": ENSEMBLE_BLOCKS, "x": _r(x_spec), "points": Z.shape[1]}
        else:
            assert Z.shape[1] == len(wn), (name, Z.shape)
            out[name] = bin_mean(Z, f_spec)
            axes[name] = {"kind": "spectrum", "x": _r(x_spec), "points": Z.shape[1]}
        print(f"  {label:<11} {name:<18} {Z.shape[1]:>6} features  {time.time() - t0:5.2f}s", flush=True)
    return out, axes


def _r(x):
    return [round(float(v), 2) for v in x]


def write_set(set_id: str, out: dict, axes: dict, metas: list, extra: dict | None = None):
    d = DATA / set_id
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("*.json"):
        old.unlink()
    (d / "axes.json").write_text(json.dumps(axes, separators=(",", ":")))
    for i, meta in enumerate(metas):
        rec = {"i": i, "meta": meta, "out": {k: quantise(v[i]) for k, v in out.items()}}
        if extra:
            rec.update({k: ({kk: quantise(vv[i]) for kk, vv in v.items()} if isinstance(v, dict) else quantise(v[i]))
                        for k, v in extra.items()})
        (d / f"{i:03d}.json").write_text(json.dumps(rec, separators=(",", ":")))
    print(f"wrote {len(metas)} samples to {d}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mirror", type=Path, required=True, help="RamanBench HF mirror snapshot directory")
    args = ap.parse_args()
    assert len(recipe_names()) == 26 and set(recipe_names()) == set(TABLE3)
    DATA.mkdir(exist_ok=True)

    recipes = []
    for group, keys in GROUPS:
        for k in keys:
            kind = ("pooled" if k in POOLED else "features" if k in FEATURES else
                    "blocks" if k == "prep_ensemble" else "spectrum")
            recipes.append({"key": k, "group": group, "steps": recipe_description(k), "stages": TABLE3[k],
                            "kind": kind, "batch_fitted": k in BATCH_FITTED})
    assert [r["key"] for r in recipes] == [k for _, ks in GROUPS for k in ks] and len(recipes) == 26
    (DATA / "recipes.json").write_text(json.dumps({"stages": STAGES, "recipes": recipes}, indent=1,
                                                  ensure_ascii=False))

    sets = []
    t0 = time.time()
    print("synthetic: 100 spectra", flush=True)
    X, clean, base, meta = synthetic_set()
    out, axes = run_recipes(X, WN, "synthetic")
    out_clean, _ = run_recipes(clean, WN, "clean")
    write_set("synthetic", out, axes, meta, extra={"clean": out_clean, "background": base})
    sets.append({"id": "synthetic", "label": "Synthetic", "kind": "synthetic", "n": len(meta),
                 "what": "Three components with known bands, plus fluorescence background, scatter, noise and cosmic-ray spikes",
                 "targets": {"analyte": "Analyte", "interferent": "Interferent"}})

    rng = np.random.default_rng(7)
    for r in REAL:
        print(f"{r['id']}: {r['dataset']}", flush=True)
        Xr, wn, ydf = load_real(args.mirror, r["dataset"])
        out, axes = run_recipes(Xr, wn, r["id"])
        rows = np.sort(rng.choice(len(Xr), size=r["n_show"], replace=False))
        metas = []
        for j in rows:
            y = {r["targets"][c]: (None if pd.isna(ydf.iloc[j][c]) else round(float(ydf.iloc[j][c]), 3))
                 for c in r["targets"]}
            metas.append({"row": int(j), "y": y})
        write_set(r["id"], {k: v[rows] for k, v in out.items()}, axes, metas)
        sets.append({"id": r["id"], "label": r["label"], "kind": "real", "n": len(rows), "n_fit": len(Xr),
                     "what": r["what"], "dataset": r["dataset"], "channels": len(wn),
                     "range": [float(wn.min()), float(wn.max())], "source": r["source"], "doi": r["doi"],
                     "license": r["license"], "targets": {v: v for v in r["targets"].values()}})
    (DATA / "sets.json").write_text(json.dumps(sets, indent=1, ensure_ascii=False))
    total = sum(f.stat().st_size for f in DATA.rglob("*.json"))
    print(f"done: {len(sets)} sets, {sum(s['n'] for s in sets)} samples, {total / 1e6:.1f} MB, "
          f"{time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
