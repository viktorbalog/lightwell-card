#!/bin/bash
# Makes the README's pictures from a full-page screenshot of tools/simulator/capture.html:
#   scripts/pictures.sh <screenshot.png> <light|dark> <rects.json> [device pixel ratio, default 2]
# rects.json is what the page's rects() returns (the tiles in CSS pixels, 06:00 to 21:00). Writes docs/day-<theme>.gif
# (the whole day, 400 px wide) and the stills docs/morning-<theme>.png (09:00) and docs/evening-<theme>.png (20:00).
# Needs ImageMagick (convert) and ffmpeg.
set -euo pipefail
SHOT="$1" THEME="$2" RECTS="$3" DPR="${4:-2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
i=0
for r in $(node -e "for (const r of JSON.parse(require('fs').readFileSync('$RECTS', 'utf8'))) console.log(r.map(v => v * $DPR).join(','))"); do
  IFS=, read -r x y w h <<< "$r"
  convert "$SHOT" -crop "${w}x${h}+${x}+${y}" +repage "$TMP/$(printf %02d $i).png"
  i=$((i + 1))
done
convert "$TMP/03.png" -resize 50% "$ROOT/docs/morning-$THEME.png"
convert "$TMP/14.png" -resize 50% "$ROOT/docs/evening-$THEME.png"
ffmpeg -loglevel error -y -framerate 1.5 -i "$TMP/%02d.png" \
  -vf "scale=400:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a" \
  -loop 0 "$ROOT/docs/day-$THEME.gif"
ls -l "$ROOT/docs/"*"-$THEME".*
