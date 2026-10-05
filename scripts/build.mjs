// Builds dist/lightwell-card.js from src/, and each example's home.js (the home as a script for the tools) from its
// home.yaml, after checking it. Also the editor, which has bundles of its own so that the card's stays as small:
// dist/lightwell-editor.js (src/editor/, the standalone page's) and dist/lightwell-card-editor.js (src/editor/ha.js,
// the card's editor in Home Assistant, which the card loads when it's opened), and the simulator's controls for the
// simulator page (tools/simulator/controls.js). `--watch` rebuilds them all on every change.
import fs from 'node:fs';
import * as esbuild from 'esbuild';
import YAML from 'yaml';
import {defineHome} from '../src/home.js';

const root = new URL('../', import.meta.url).pathname;
const {version} = JSON.parse(fs.readFileSync(`${root}package.json`, 'utf8'));

// The example homes as scripts for the tools, each checked first.
for (const dir of ['example', 'example/background']) {
  const home = YAML.parse(fs.readFileSync(`${root}${dir}/home.yaml`, 'utf8'));
  defineHome(home);
  fs.writeFileSync(`${root}${dir}/home.js`, `// Built from home.yaml by npm run build, for the tools (?home=).\nwindow.FLOORPLAN_HOME = ${JSON.stringify(home)};\n`);
}

const common = {absWorkingDir: root, bundle: true, format: 'iife', target: 'es2020', logLevel: 'info', legalComments: 'none',
  define: {LIGHTWELL_VERSION: JSON.stringify(version)}};
const builds = [
  {...common, entryPoints: ['src/index.js'], outfile: 'dist/lightwell-card.js',
    banner: {js: `// Lightwell ${version}: a living floor plan for Home Assistant (MIT licence).\n// Built from src/ by npm run build.`}},
  {...common, entryPoints: ['src/editor/index.js'], outfile: 'dist/lightwell-editor.js', loader: {'.yaml': 'text'},
    banner: {js: `// Lightwell ${version}'s editor for homes (MIT licence; includes the yaml library, ISC licence).\n// Built from src/editor/ by npm run build.`}},
  {...common, entryPoints: ['src/editor/ha.js'], outfile: 'dist/lightwell-card-editor.js',
    banner: {js: `// Lightwell ${version}'s card editor for Home Assistant (MIT licence; includes the yaml library, ISC licence).\n// Built from src/editor/ by npm run build; the card loads it when its editor is opened.`}},
  {...common, entryPoints: ['src/editor/controls.js'], outfile: 'tools/simulator/controls.js', globalName: 'LightwellControls',
    banner: {js: '// The simulator\'s controls, built from src/editor/controls.js by npm run build.'}},
];
if (process.argv.includes('--watch')) for (const b of builds) await (await esbuild.context(b)).watch();
else {
  await Promise.all(builds.map(b => esbuild.build(b))).catch(() => process.exit(1));
  // The bundles are loaded by <script> tags, which read them in the page's charset: they must be ASCII. (esbuild
  // escapes non-ASCII characters in strings, but not in regular expressions: write those as \u escapes.)
  for (const {outfile} of builds) {
    const i = fs.readFileSync(`${root}${outfile}`).findIndex(b => b > 0x7f);
    if (i >= 0) {
      console.error(`${outfile}: a character that isn't ASCII at byte ${i} (in a regular expression? write it as a \\u escape)`);
      process.exit(1);
    }
  }
}
