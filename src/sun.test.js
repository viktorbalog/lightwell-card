import {test} from 'node:test';
import assert from 'node:assert/strict';
import {floorTint, sunScene as sceneOf, sunShadows as shadowsOf} from './sun.js';
import {defineHome} from './home.js';
import {EXAMPLE} from '../scripts/example.mjs';

// The example home: the terrace door on the bottom (south) wall, the bedroom window on the right (east) one.
const sunScene = st => sceneOf(EXAMPLE, st), sunShadows = sc => shadowsOf(EXAMPLE, sc);
const states = (sun, extra = {}) => ({'sun.sun': {attributes: sun}, 'weather.home': {state: 'sunny', attributes: {cloud_coverage: 0}}, ...extra});

test('at night there is no sun and no daylight', () => {
  const sc = sunScene(states({elevation: -20, azimuth: 0}));
  assert.equal(sc.lit, false);
  assert.equal(sc.opacity, 0);
  assert.equal(sc.sky.opacity, 0);
});

test('the sun straight in front of the south wall shines in through its door only', () => {
  const sc = sunScene(states({elevation: 30, azimuth: 180}));
  assert.equal(sc.lit, true);
  assert.ok(Math.abs(sc.tx) < 1e-9 && Math.abs(sc.ty + 1) < 1e-9);
  assert.deepEqual(sc.facing, [1, 0]);
  assert.deepEqual(sc.patches.map(Boolean), [true, false]);
  assert.equal(sc.blur, '3.0');
});

test('a morning sun comes in through the east window', () => {
  assert.deepEqual(sunScene(states({elevation: 20, azimuth: 90})).facing, [0, 1]);
});

test('from the north, no sun gets in', () => {
  assert.equal(sunScene(states({elevation: 30, azimuth: 0})).lit, false);
});

test('a closed shutter leaves no patch, and dims the daylight through it', () => {
  const sc = sunScene(states({elevation: 30, azimuth: 180}, {'cover.living_room_blind': {attributes: {current_position: 0}}}));
  assert.equal(sc.patches[0], '');
  assert.equal(sc.skyThrough[0], 0);
  assert.equal(sc.spills[0], 0);
  assert.equal(sunScene(states({elevation: 30, azimuth: 180})).spills[0], 0.4);
});

test('the trees dim and soften the sun behind them', () => {
  const above = sunScene(states({elevation: 15, azimuth: 262})), behind = sunScene(states({elevation: 8, azimuth: 262}));
  assert.ok(behind.opacity < above.opacity);
  assert.ok(+behind.blur > +above.blur);
});

test('the floor tint interpolates the daylight table', () => {
  assert.deepEqual(floorTint(-5, 0, false), {color: [70, 60, 140], opacity: 0.35});
  assert.equal(floorTint(-5, 0, true).opacity, 0.35 * 0.6);
});

test('sun shadows: the garden wall, and the furniture by room', () => {
  const sh = sunShadows(sunScene(states({elevation: 30, azimuth: 180})));
  assert.equal(sh.walls.match(/<polygon/g).length, 4);
  assert.deepEqual(sh.rooms.map(([room]) => room), ['living', 'bedroom']);
});

// A square room with north up, a window on each wall.
const square = defineHome({view: {x: 0, y: 0, w: 1000, h: 1000}, units_per_metre: 100, rooms: {room: [[0, 0, 1000, 1000]]},
  openings: [
    {wall: 'left', at: 0, depth: 20, y: 400, h: 200, lo: 0, hi: 2, room: 'room', sky: 'room'},
    {wall: 'right', at: 1000, depth: 20, y: 400, h: 200, lo: 0, hi: 2, room: 'room', sky: 'room'},
    {wall: 'top', at: 0, depth: 20, x: 400, w: 200, lo: 0, hi: 2, room: 'room', sky: 'room'},
    {wall: 'bottom', at: 1000, depth: 20, x: 400, w: 200, lo: 0, hi: 2, room: 'room', sky: 'room'},
  ], sun: {north: 0}});
const at = (az, el = 45) => sceneOf(square, states({elevation: el, azimuth: az}));
const xs = patch => patch.split(' ').map(p => +p.split(',')[0]), ys = patch => patch.split(' ').map(p => +p.split(',')[1]);

test('the sun comes in through the wall it is on, into the room', () => {
  const west = at(270);
  assert.deepEqual(west.facing, [1, 0, 0, 0]);
  assert.ok(xs(west.patches[0]).every(x => x >= 0) && Math.max(...xs(west.patches[0])) === 200); // 2 m at 45°
  assert.deepEqual(west.patches.slice(1), ['', '', '']);
  const south = at(180);
  assert.deepEqual(south.facing, [0, 0, 0, 1]);
  assert.equal(Math.min(...ys(south.patches[3])), 800);
  assert.deepEqual(at(90).facing, [0, 1, 0, 0]);
  assert.deepEqual(at(0).facing, [0, 0, 1, 0]);
});

test('turning the drawing turns the sun with it', () => {
  // North at the right of the drawing (the top points west): a southern sun comes in through the left wall.
  const turned = sceneOf(square, states({elevation: 45, azimuth: 180}), 270);
  assert.deepEqual(turned.facing, [1, 0, 0, 0]);
});

test('a sun grazing a wall fades out instead of stopping short', () => {
  const f = az => at(az).facing[3];
  assert.equal(f(180), 1);
  assert.ok(f(260) > 0 && f(260) < 1);
  assert.equal(f(270), 0);
});
