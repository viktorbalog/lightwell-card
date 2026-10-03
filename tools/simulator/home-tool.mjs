// A home file (YAML or JSON) for the tools: `node home-tool.mjs entities <file>` prints the entities it shows
// (comma-separated, for snapshot.sh); `node home-tool.mjs json <file> [out]` writes it as JSON (for the card's
// home_url); `node home-tool.mjs js <file> [out]` as a script that sets window.FLOORPLAN_HOME, which the pages here
// load with ?home=<that file> (pages opened from file:// can't fetch).
import fs from 'node:fs';
import YAML from 'yaml';
import {defineHome, entitiesOf} from '../../src/home.js';

const [command, file, out] = process.argv.slice(2);
if (!['entities', 'json', 'js'].includes(command) || !file) {
  console.error('usage: home-tool.mjs entities|json|js <home.yaml|home.json> [out]');
  process.exit(2);
}
const text = fs.readFileSync(file, 'utf8');
const data = /\.json$/i.test(file) ? JSON.parse(text) : YAML.parse(text);
const home = defineHome(data);
if (command === 'entities') console.log(entitiesOf(home).join(','));
else {
  const text = command === 'json' ? `${JSON.stringify(data, null, 1)}\n` : `window.FLOORPLAN_HOME = ${JSON.stringify(data)};\n`;
  if (out) fs.writeFileSync(out, text); else process.stdout.write(text);
}
