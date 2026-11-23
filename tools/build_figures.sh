#!/usr/bin/env bash
# Convert the main paper's figure PDFs to SVG for the page (pdftocairo from poppler).
#   bash tools/build_figures.sh <paper repo>
set -euo pipefail
PAPER="$1"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/figures"
mkdir -p "$OUT"
for f in effect_map cd_diagram_regression cd_diagram_classification variance_shares model_gap \
         sensitivity_vs_heldout selection_by_size; do
    pdftocairo -svg "$PAPER/figures/$f.pdf" "$OUT/$f.svg"
    echo "$f.svg $(wc -c < "$OUT/$f.svg") bytes"
done
