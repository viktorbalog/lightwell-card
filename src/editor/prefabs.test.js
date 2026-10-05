import test from 'node:test';
import assert from 'node:assert/strict';
import {defineHome} from '../home.js';
import {PREFABS, placePrefab, prefabOf, prefabSvg, turnedPiece} from './prefabs.js';

const home = upm => ({view: {x: 0, y: 0, w: 20 * upm, h: 20 * upm}, units_per_metre: upm, rooms: {room: [[0, 0, 20 * upm, 20 * upm]]},
  furniture: {sofa_3: {shape: {rect: [0, 0, 10, 10]}}}, sun: {north: 0}});
const ids = Object.values(PREFABS).flatMap(g => Object.keys(g.items));

test('every prefab, placed and turned, at any scale, makes a valid home', () => {
  for (const upm of [100, 37.5]) for (const id of ids) for (const turn of [0, 90, 180, 270]) {
    const data = home(upm), made = placePrefab(data, id, [10 * upm, 10 * upm], turn);
    for (const op of made.ops) {
      if (op.set) op.set.slice(0, -1).reduce((o, k) => (o[k] ??= {}), data)[op.set.at(-1)] = op.value;
      else (data[op.insert[0]] ??= []).push(op.value);
    }
    assert.doesNotThrow(() => defineHome(data), `${id} at ${upm} turned ${turn}`);
  }
});

test('a prefab is placed by its middle, its size turned with it, in its room, named without clashes', () => {
  const data = home(100);
  const {ops, keys} = placePrefab(data, 'sofa_3', [500, 500], 90);
  assert.deepEqual(keys, ['sofa_3_2']);
  assert.deepEqual(ops[0].value.shape.rect, [455, 390, 90, 220]);
  assert.equal(ops[0].value.shadow_room, 'room');
  assert.equal(ops[0].value.height, 0.8);
  // A table with its chairs: several pieces, each chair facing the table.
  const dining = placePrefab(data, 'dining_4', [500, 500]);
  assert.deepEqual(dining.keys, ['table', 'chair', 'chair_2', 'chair_3', 'chair_4']);
  // One object, named after the prefab.
  assert.equal(dining.part, 'dining_4_1');
  assert.ok(dining.ops.every(op => op.value.part === 'dining_4_1'));
  assert.ok(prefabSvg('dining_6').startsWith('<svg viewBox='));
});

test('a piece turned a quarter: a rectangle or a polygon by its turn', () => {
  assert.deepEqual(turnedPiece({shape: {rect: [0, 0, 100, 50], turn: 270}}, 90).shape, {rect: [0, 0, 100, 50]});
  assert.deepEqual(turnedPiece({shape: {rect: [0, 0, 100, 50]}}, -90).shape, {rect: [0, 0, 100, 50], turn: 270});
  const corner = placePrefab(home(100), 'corner_sofa', [500, 500]).ops[0].value, round = turnedPiece(turnedPiece(turnedPiece(turnedPiece(corner, 90), 90), 90), 90);
  assert.deepEqual(round, corner);
  const once = turnedPiece(corner, 90);
  assert.deepEqual(once.shape, {...corner.shape, turn: 90});
  assert.deepEqual(once.extra, corner.extra);
});

test('a light from the catalogue: one object, its glow, pool and marker (and a floor lamp\'s base); a strip a line', () => {
  const data = home(100);
  const lamp = placePrefab(data, 'floor_lamp', [300, 300], 0, {entity: 'light.reading'});
  assert.equal(lamp.part, 'lamp_1');
  const light = lamp.ops.find(o => o.insert?.[0] === 'lights').value, marker = lamp.ops.find(o => o.insert?.[0] === 'markers').value;
  assert.deepEqual(light.entities, ['light.reading']);
  assert.deepEqual([light.pool.x, light.pool.y, light.pool.r, light.pool.height], [300, 300, 300, 1.6]);
  assert.deepEqual(light.pool.shadows, ['sofa_3'].filter(n => data.furniture[n].height));
  assert.equal(marker.entity, 'light.reading');
  assert.equal(lamp.ops.find(o => o.set?.[0] === 'furniture').value.part, 'lamp_1');
  const strip = placePrefab(data, 'strip_2', [300, 100], 90).ops[0].value;
  assert.deepEqual(strip.shape, [{path: 'M300,0 L300,200', stroke_width: 15, fill: 'none'}]);
  assert.equal(strip.top, true);
  assert.equal(strip.pool, undefined);
});

test("a group's prefab, middle and turn are found from its pieces", () => {
  for (const turn of [0, 90, 180, 270]) {
    const data = home(100), made = placePrefab(data, 'dining_4', [500, 400], turn);
    for (const op of made.ops) data.furniture[op.set[1]] = op.value;
    assert.deepEqual(prefabOf(data, made.part), {id: 'dining_4', at: [500, 400], turn});
  }
});
