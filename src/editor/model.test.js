import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HomeModel, renameIn, yamlOf} from './model.js';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const EXAMPLE = read('example/home.yaml');
// The lines of `b` that aren't in `a` at the same place (both the same length).
const changedLines = (a, b) => {
  const [x, y] = [a.split('\n'), b.split('\n')];
  assert.equal(x.length, y.length);
  return y.filter((line, i) => line !== x[i]);
};

test('the example homes come back byte for byte', () => {
  for (const path of ['example/home.yaml', 'example/background/home.yaml']) {
    const m = new HomeModel(read(path));
    assert.deepEqual(m.errors, []);
    // An edit that changes nothing gives the same text.
    m.edit(() => {});
    assert.equal(m.text, read(path));
    m.set(['units_per_metre'], m.get(['units_per_metre']) + 1);
    m.set(['units_per_metre'], m.get(['units_per_metre']) - 1);
    assert.equal(m.text, read(path));
  }
});

test('the home is derived from the document', () => {
  const m = new HomeModel(EXAMPLE);
  assert.equal(m.home.furniture.sofa.height, 0.8);
  assert.equal(m.home.sun.entity, 'sun.sun');
});

test('moving a piece changes only its numbers, and its comments stay', () => {
  const m = new HomeModel(EXAMPLE);
  m.set(['furniture', 'coffeeTable', 'shape', 'rect'], [200, 440, 90, 60]);
  assert.deepEqual(changedLines(EXAMPLE, m.text),
    ['  coffeeTable: {shape: {rect: [200, 440, 90, 60], rx: 6, turn: 20}, height: 0.45, shadow_room: living}']);
  m.set(['drawing', 'walls', 3, 'rect'], [360, 625, 150, 25]);
  assert.match(m.text, /# The bottom wall, with the terrace door \(x 140–360\)\.\n {4}- \{rect: \[0, 625, 140, 25\], class: wall, part: living\}\n {4}- \{rect: \[360, 625, 150, 25\], class: wall, part: living\}/);
  assert.equal(m.home.furniture.coffeeTable.shape.rect[0], 200);
});

test('new values: flow inside flow, lists of numbers as flow, maps on the way created', () => {
  const m = new HomeModel(EXAMPLE);
  m.set(['furniture', 'coffeeTable', 'shape', 'circle'], [1, 2, 3]);
  assert.match(m.text, /coffeeTable: \{shape: \{rect: \[190, 430, 90, 60\], rx: 6, turn: 20, circle: \[1, 2, 3\]\}/);
  m.set(['furniture', 'stool'], {shape: {circle: [100, 100, 20]}, height: 0.5});
  assert.match(m.text, /\n {2}stool: \{shape: \{circle: \[100, 100, 20\]\}, height: 0.5\}\n/);
  // Too long for a line: block, with the lists of numbers in flow.
  m.set(['furniture', 'shelf'], {shape: {poly: [[0, 0], [100, 0], [100, 30], [0, 30]]}, height: 2, shadow_room: 'living', class: 'furn2'});
  assert.match(m.text, /\n {2}shelf:\n {4}shape: \{poly: \[\[0, 0\], \[100, 0\], \[100, 30\], \[0, 30\]\]\}\n {4}height: 2\n/);
  m.set(['sun', 'trees'], null);
  assert.equal(m.home.sun.trees, null);
  // A scalar replaced by a list.
  m.set(['furniture', 'sofa', 'height'], [1]);
  assert.match(m.text, /\n {4}height: \[1\]\n/);
});

test('insert, remove and move', () => {
  const m = new HomeModel(EXAMPLE);
  const labels = () => m.get(['drawing', 'labels']).map(l => l.text);
  m.insert(['drawing', 'labels'], {text: 'Hall', at: [10, 10], class: 'room'}, 1);
  assert.deepEqual(labels(), ['Living room', 'Hall', 'Bedroom', 'Terrace']);
  assert.match(m.text, /\n {4}- \{text: Hall, at: \[10, 10\], class: room\}\n/);
  m.move(['drawing', 'labels'], 1, 3);
  assert.deepEqual(labels(), ['Living room', 'Bedroom', 'Terrace', 'Hall']);
  m.remove(['drawing', 'labels', 3]);
  assert.equal(m.text, EXAMPLE);
  // A map's keys move with their values and comments.
  m.move(['furniture'], 'coffeeTable', 'sofa');
  assert.deepEqual(Object.keys(m.data.furniture).slice(0, 2), ['coffeeTable', 'sofa']);
  m.remove(['furniture', 'coffeeTable']);
  assert.equal(m.data.furniture.coffeeTable, undefined);
  // The light that had it in its shadows now names a piece that isn't there.
  assert.match(m.errors.join(), /no furniture with a height called "coffeeTable"/);
  assert.throws(() => m.remove(['furniture', 'nothing']), /Nothing at furniture.nothing/);
  // A new list.
  m.insert(['drawing', 'under_furniture'], {rect: [0, 0, 10, 10], class: 'rug'});
  assert.deepEqual(m.get(['drawing', 'under_furniture']), [{rect: [0, 0, 10, 10], class: 'rug'}]);
});

test('undo and redo', () => {
  const m = new HomeModel(EXAMPLE);
  assert.equal(m.canUndo, false);
  m.set(['units_per_metre'], 120);
  m.set(['view', 'w'], 900);
  assert.equal(m.undo(), true);
  assert.equal(m.get(['view', 'w']), 890);
  assert.equal(m.get(['units_per_metre']), 120);
  m.undo();
  assert.equal(m.text, EXAMPLE);
  assert.equal(m.undo(), false);
  m.redo();
  m.redo();
  assert.equal(m.get(['view', 'w']), 900);
  assert.equal(m.redo(), false);
  // A new edit forgets what could be redone.
  m.undo();
  m.set(['view', 'h'], 800);
  assert.equal(m.canRedo, false);
});

test('mistakes: in the YAML, and in the home', () => {
  const m = new HomeModel(EXAMPLE);
  m.setText(EXAMPLE.replace('view: {x: -20', 'view: {x: -20,,'));
  assert.equal(m.home, null);
  assert.ok(m.errors.length);
  assert.throws(() => m.set(['view', 'x'], 0), /doesn't parse/);
  m.undo();
  m.setText(EXAMPLE.replace('shadow_room: living}', 'shadow_room: lounge}'));
  assert.equal(m.home, null);
  assert.deepEqual(m.errors, ['furniture.coffeeTable.shadow_room: no room called "lounge"']);
  // A failed edit leaves the document as it was.
  m.undo();
  assert.throws(() => m.insert(['view'], 1), /isn't a list/);
  assert.equal(m.doc.toString({lineWidth: 0, flowCollectionPadding: false}), EXAMPLE);
  assert.match(new HomeModel('- 1').errors[0], /needs to be a home/);
});

test('JSON', () => {
  const m = new HomeModel(read('example/background/home.yaml'));
  const json = JSON.parse(m.toJSON());
  assert.equal(json.units_per_metre, 100);
  // A JSON file opens too, and stays JSON in style.
  const j = new HomeModel(m.toJSON());
  assert.deepEqual(j.errors, []);
  j.set(['units_per_metre'], 50);
  assert.equal(JSON.parse(j.text).units_per_metre, 50);
});

test('a home from JSON as YAML', () => {
  const m = new HomeModel(EXAMPLE);
  const text = yamlOf(JSON.parse(m.toJSON()));
  assert.deepEqual(new HomeModel(text).data, m.data);
  assert.match(text, /^view: \{x: -20, y: -20, w: 890, h: 840\}\nunits_per_metre: 100\nrooms:\n {2}living: \[\[25, 25, 475, 600\]\]\n/);
});

test('renaming a key where it is', () => {
  const m = new HomeModel(EXAMPLE);
  m.edit(doc => renameIn(doc, ['furniture', 'tvStand'], 'sideboard'));
  assert.deepEqual(changedLines(EXAMPLE, m.text), ['  sideboard:']);
  assert.throws(() => m.edit(doc => renameIn(doc, ['furniture', 'sofa'], 'bed')), /already a bed/);
});

test('a home as data comes back as the same data (the HA shell\'s value in and out)', () => {
  for (const file of ['example/home.yaml', 'example/background/home.yaml']) {
    const data = new HomeModel(fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')).data;
    data.description = 'A note: with a colon, "quotes", 08 and\na second line';
    assert.deepEqual(new HomeModel(yamlOf(data)).data, data, file);
  }
});
