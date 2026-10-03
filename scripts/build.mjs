// Builds dist/lightwell-card.js from src/, and each example's home.js (the home as a script for the tools) from its
// home.yaml, after checking it. Also the editor, which has a bundle of its own so that the card's stays as small:
// dist/lightwell-editor.js (src/editor/), and the simulator's controls for the simulator page
// (tools/simulator/controls.js). `--watch` rebuilds them all on every change.
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

const common = {absWorkingDir: root, bundle: true, format: 'iife', target: 'es2020', logLevel: 'info', legalComments: 'none'};
const builds = [
  {...common, entryPoints: ['src/index.js'], outfile: 'dist/lightwell-card.js',
    banner: {js: `// Lightwell ${version}: a living floor plan for Home Assistant (MIT licence).\n// Built from src/ by npm run build.`}},
  {...common, entryPoints: ['src/editor/index.js'], outfile: 'dist/lightwell-editor.js', loader: {'.yaml': 'text'},
    banner: {js: `// Lightwell ${version}'s editor for homes (MIT licence; includes the yaml library, ISC licence).\n// Built from src/editor/ by npm run build.`}},
  {...common, entryPoints: ['src/editor/controls.js'], outfile: 'tools/simulator/controls.js', globalName: 'LightwellControls',
    banner: {js: '// The simulator\'s controls, built from src/editor/controls.js by npm run build.'}},
];
if (process.argv.includes('--watch')) for (const b of builds) await (await esbuild.context(b)).watch();
else await Promise.all(builds.map(b => esbuild.build(b))).catch(() => process.exit(1));
