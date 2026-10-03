import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import {defineHome} from './home.js';
import {SCHEMA, fieldAt} from './schema.js';

const HOMES = ['example/home.yaml', 'example/background/home.yaml']
  .map(path => [path, YAML.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))]);

// Every path in `value`, depth first: [path, value].
function* paths(value, path = []) {
  yield [path, value];
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* paths(v, [...path, Array.isArray(value) ? +k : k]);
}
// defineHome's messages, each with its path: [['openings', 0, 'room'], 'no room called "x"'].
function errorsOf(home) {
  try {
    defineHome(home);
    return [];
  } catch (e) {
    // A value of the wrong type can make it fail on its own (42.forEach): rejected all the same, wherever.
    if (!e.message.startsWith('Invalid home:')) return [[null, e.message]];
    return e.message.split('\n').slice(1).map(line => {
      const [where, msg] = [line.slice(0, line.indexOf(': ')), line.slice(line.indexOf(': ') + 2)];
      return [where.split(/\.|(?=\[)/).map(k => (/^\[\d+\]$/.test(k) ? +k.slice(1, -1) : k)), msg];
    });
  }
}
const isPrefix = (a, b) => a.length <= b.length && a.every((k, i) => k === b[i]);
// The errors about `path`: at it or inside it, or at its parent (openings[0]: needs a number at).
const about = (errors, path) => errors.filter(([where]) => !where || isPrefix(path, where)
  || (isPrefix(where, path) && where.length === path.length - 1));
// Whether a field from the one at `from` (a length) down to the one at `path` is one defineHome checks.
const checked = (path, from) => path.slice(Math.max(from, 1) - 1).some((_, i) => {
  const f = fieldAt(path.slice(0, Math.max(from, 1) + i));
  return f?.check || f?.required;
});
// A value of the wrong type for `v`.
const wrong = v => (typeof v === 'number' ? 'x' : 42);
const set = (home, path, value) => {
  const copy = structuredClone(home);
  let o = copy;
  for (const k of path.slice(0, -1)) o = o[k];
  if (value === undefined) delete o[path.at(-1)]; else o[path.at(-1)] = value;
  return copy;
};

test('every field in the example homes is described', () => {
  for (const [file, home] of HOMES) {
    for (const [path] of paths(home)) if (path.length && !fieldAt(path)) assert.fail(`${file}: ${path.join('.')} isn't in the schema`);
  }
});

test('the fields defineHome fails on are the ones marked check or required', () => {
  const problems = [];
  for (const [file, home] of HOMES) {
    assert.deepEqual(errorsOf(home), []);
    for (const [path, value] of paths(home)) {
      if (!path.length) continue;
      const f = fieldAt(path);
      if (f.type === 'yaml' && fieldAt(path.slice(0, -1))?.type === 'yaml') continue;
      const errors = about(errorsOf(set(home, path, wrong(value))), path);
      const where = `${file}: ${path.join('.')}`;
      // Failing on its own (a crash) isn't a check, but it does reject the value.
      const checks = errors.filter(([w]) => w);
      if (checks.length && !checked(path, Math.min(path.length, ...checks.map(([w]) => w.length)))) problems.push(`${where}: defineHome checks it (${checks[0][1]}), the schema doesn't say so`);
      if (!errors.length && f.check) problems.push(`${where}: marked check, but a wrong value (${JSON.stringify(wrong(value))}) passes`);
      if (f.required && !f.when && !about(errorsOf(set(home, path, undefined)), path).length) problems.push(`${where}: required, but leaving it out passes`);
    }
  }
  assert.deepEqual(problems, []);
});

test('fieldAt', () => {
  assert.equal(fieldAt(['furniture', 'sofa', 'shape', 'rect']).labels.join(), 'x,y,w,h');
  assert.equal(fieldAt(['openings', 3, 'shutter']).domain, 'cover');
  assert.equal(fieldAt(['drawing', 'walls', 0, 'stroke_width']).type, 'yaml');
  assert.equal(fieldAt(['nothing']), undefined);
  assert.equal(fieldAt([]), SCHEMA);
});
