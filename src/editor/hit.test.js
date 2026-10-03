import test from 'node:test';
import assert from 'node:assert/strict';
import {EXAMPLE} from '../../scripts/example.mjs';
import {defineHome} from '../home.js';
import {hitTest, outlineSvg, pathLines} from './hit.js';

test('front to back: furniture over the floor over the room', () => {
  assert.deepEqual(hitTest(EXAMPLE, [80, 450]), [['furniture', 'sofa'], ['drawing', 'floors', 0], ['rooms', 'living']]);
});

test('turned furniture by its turned outline', () => {
  // The coffee table, turned 20°: its unturned corner is outside, its turned one inside.
  assert.ok(!hitTest(EXAMPLE, [191, 431]).some(h => h[1] === 'coffeeTable'));
  assert.deepEqual(hitTest(EXAMPLE, [203, 420])[0], ['furniture', 'coffeeTable']);
});

test('markers first, then a light by its centre before the furniture under it', () => {
  assert.deepEqual(hitTest(EXAMPLE, [400, 60])[0], ['markers', 2]);
  assert.deepEqual(hitTest(EXAMPLE, [70, 340]).slice(0, 2), [['lights', 0], ['furniture', 'floorLamp']]);
});

test('a stroked line, an opening, a text', () => {
  assert.deepEqual(hitTest(EXAMPLE, [150, 95], 3), [['markers', 1], ['lights', 2], ['drawing', 'floors', 0], ['rooms', 'living']]);
  assert.deepEqual(hitTest(EXAMPLE, [200, 637]), [['openings', 0], ['drawing', 'glazing', 0]]);
  assert.deepEqual(hitTest(EXAMPLE, [300, 590])[0], ['drawing', 'labels', 0]);
  // Near an edge counts, within the tolerance.
  assert.deepEqual(hitTest(EXAMPLE, [38, 450], 3)[0], ['furniture', 'sofa']);
  assert.notDeepEqual(hitTest(EXAMPLE, [38, 450])[0], ['furniture', 'sofa']);
});

test('polygons, and overlapping items with the last drawn on top', () => {
  const home = defineHome({view: {x: 0, y: 0, w: 1145, h: 500}, units_per_metre: 100, sun: {north: 0},
    rooms: {hall: [[[0, 0], [200, 0], [100, 200]]], all: [[0, 0, 400, 400]]},
    furniture: {a: {shape: {rect: [10, 10, 100, 100]}}, b: {shape: {poly: [[50, 50], [150, 50], [150, 150]]}}},
    drawing: {floors: [{rect: [0, 0, 400, 400]}, {poly: [[0, 0], [400, 0], [0, 400]]}]}});
  assert.deepEqual(hitTest(home, [100, 60]), [['furniture', 'b'], ['furniture', 'a'], ['drawing', 'floors', 1],
    ['drawing', 'floors', 0], ['rooms', 'all'], ['rooms', 'hall']]);
  assert.deepEqual(hitTest(home, [190, 150]), [['drawing', 'floors', 1], ['drawing', 'floors', 0], ['rooms', 'all']]);
});

test('paths as lines', () => {
  assert.deepEqual(pathLines('M0,0 h10 v10 z'), {lines: [[[0, 0], [10, 0], [10, 10], [0, 0]]], closed: [true]});
  assert.deepEqual(pathLines('M25,790 H825'), {lines: [[[25, 790], [825, 790]]], closed: [false]});
  assert.deepEqual(pathLines('M0 0 C 1 1 2 2 3 3 L4 4').lines, [[[0, 0], [3, 3], [4, 4]]]);
});

test('outlines', () => {
  assert.match(outlineSvg(EXAMPLE, ['furniture', 'coffeeTable']), /^<polygon points="[\d.,]+ [\d.,]+ [\d.,]+ [\d.,]+"\/>$/);
  assert.match(outlineSvg(EXAMPLE, ['lights', 0]), /<circle class="pool" cx="70" cy="340" r="380"\/>/);
  assert.equal(outlineSvg(EXAMPLE, ['openings', 0]), '<rect x="140" y="625" width="220" height="25"/>');
  assert.equal(outlineSvg(EXAMPLE, ['nothing', 0]), '');
});
