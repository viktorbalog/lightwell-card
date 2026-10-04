#!/bin/bash
# Builds the GitHub Pages site (the Pages workflow publishes it): the editor and the simulator with the example homes,
# in the repository's own layout so that their relative paths (../../dist/, the background example's picture) hold,
# and short addresses forwarding to them: editor/ and simulator/ (with any ?query), and the site's root to the
# editor. Never a snapshot of real states (tools/simulator/states.js stays out).
#   scripts/site.sh <out dir>
set -euo pipefail
OUT="${1:?usage: site.sh <out dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$OUT"
mkdir -p "$OUT/docs" "$OUT/dist" "$OUT/example/background" "$OUT/tools/editor" "$OUT/tools/simulator" "$OUT/editor" "$OUT/simulator"
cp "$ROOT/dist/lightwell-card.js" "$ROOT/dist/lightwell-editor.js" "$OUT/dist/"
cp "$ROOT/example/home.yaml" "$ROOT/example/home.js" "$ROOT/example/states.js" "$OUT/example/"
cp "$ROOT/example/background/home.yaml" "$ROOT/example/background/home.js" "$ROOT/example/background/plan.png" "$OUT/example/background/"
cp "$ROOT/tools/editor/index.html" "$OUT/tools/editor/"
cp "$ROOT/tools/simulator/index.html" "$ROOT/tools/simulator/tool.js" "$ROOT/tools/simulator/controls.js" "$OUT/tools/simulator/"
cp "$ROOT/docs/logo.svg" "$OUT/docs/"
# A page that forwards to `to`, keeping the query and the fragment.
forward() {
  cat > "$1" <<HTML
<!doctype html><meta charset="utf-8"><title>Lightwell</title><link rel="icon" href="$3docs/logo.svg">
<meta http-equiv="refresh" content="0; url=$2">
<script>location.replace('$2' + location.search + location.hash);</script>
<p><a href="$2">Lightwell's $4</a></p>
HTML
}
forward "$OUT/index.html" tools/editor/ '' editor
forward "$OUT/editor/index.html" ../tools/editor/ ../ editor
forward "$OUT/simulator/index.html" ../tools/simulator/ ../ simulator
touch "$OUT/.nojekyll"
find "$OUT" -type f | sort
