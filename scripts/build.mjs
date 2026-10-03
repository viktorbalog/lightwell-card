// Builds dist/lightwell-card.js from src/, and each example's home.js (the home as a script for the tools) from its
// home.yaml, after checking it. `--watch` rebuilds the card on every change.
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

const options = {
  absWorkingDir: root, entryPoints: ['src/index.js'], bundle: true, format: 'iife', target: 'es2020',
  outfile: 'dist/lightwell-card.js', logLevel: 'info', legalComments: 'none',
  banner: {js: `// Lightwell ${version}: a living floor plan for Home Assistant (MIT licence).\n// Built from src/ by npm run build.`},
};
if (process.argv.includes('--watch')) await (await esbuild.context(options)).watch();
else await esbuild.build(options).catch(() => process.exit(1));
