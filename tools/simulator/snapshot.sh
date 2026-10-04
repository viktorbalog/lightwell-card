#!/bin/bash
# Writes states.js for the simulator (index.html next to this script; open it with ?states=states.js): a snapshot of
# the current states of the entities a home shows, and HA's location for the sun's position. Keep it out of git
# (.gitignore does). Needs HA_HOST (host:port) and HA_TOKEN (a long-lived access token). With --all it saves every
# entity in Home Assistant, not only the home's: the editor's pickers then offer them all.
#   snapshot.sh --home <home.yaml|home.json> [--all] [out]
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" != --home ] || [ -z "${2:-}" ]; then echo "usage: snapshot.sh --home <home.yaml|home.json> [--all] [out]" >&2; exit 2; fi
HOME_FILE="$2"; shift 2
ALL=""
if [ "${1:-}" = --all ]; then ALL=1; shift; fi
OUT="${1:-$DIR/states.js}"
ids=$(node "$DIR/home-tool.mjs" entities "$HOME_FILE")
curl -sf -H "Authorization: Bearer $HA_TOKEN" "http://$HA_HOST/api/states" | IDS="$ids" ALL="$ALL" node -e '
  const want = new Set(process.env.IDS.split(","));
  const o = {};
  for (const e of JSON.parse(require("fs").readFileSync(0))) if (process.env.ALL || want.has(e.entity_id)) o[e.entity_id] = e;
  const missing = [...want].filter(id => !o[id]);
  if (missing.length) console.error("not in HA:", missing.join(", "));
  console.log("window.STATES = " + JSON.stringify(o) + ";");' > "$OUT"
curl -sf -H "Authorization: Bearer $HA_TOKEN" "http://$HA_HOST/api/config" | node -e '
  const c = JSON.parse(require("fs").readFileSync(0));
  console.log("window.HOME = " + JSON.stringify({latitude: c.latitude, longitude: c.longitude}) + ";");' >> "$OUT"
