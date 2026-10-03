// The example home (example/home.yaml), checked, for the tests.
import fs from 'node:fs';
import YAML from 'yaml';
import {defineHome} from '../src/home.js';

export const EXAMPLE = defineHome(YAML.parse(fs.readFileSync(new URL('../example/home.yaml', import.meta.url), 'utf8')));
