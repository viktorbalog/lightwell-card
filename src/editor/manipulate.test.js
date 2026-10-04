import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXAMPLE} from '../../scripts/example.mjs';
import {HomeModel} from './model.js';
import {anchors, boundsOf, dragHandle, handles, moveItem, movePath, moveShape, moveTransform, removeCorner, rulerText, snapMove, snapPoint, snapTargets,
  snapsHandle, startHandle} from './manipulate.js';

const near = (a, b, eps = 0.051) => assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= eps), `${JSON.stringify(a)} ≉ ${JSON.stringify(b)}`);

test('moving each kind of item', () => {
  const sofa = moveItem(['furniture', 'sofa'], EXAMPLE.furniture.sofa, 10, -5);
  assert.deepEqual(sofa.shape.rect, [50, 375, 90, 200]);
  assert.deepEqual(sofa.extra[0].rect, [50, 375, 25, 200]);
  const light = moveItem(['lights', 0], EXAMPLE.lights[0], 5, 5);
  assert.deepEqual([light.pool.x, light.pool.y], [75, 345]);
  assert.deepEqual(light.shape[0].circle.slice(0, 2), [EXAMPLE.lights[0].shape[0].circle[0] + 5, EXAMPLE.lights[0].shape[0].circle[1] + 5]);
  // An opening only along its wall.
  const door = moveItem(['openings', 0], EXAMPLE.openings[0], 20, 30);
  assert.deepEqual([door.x, door.at, door.w], [160, 650, 220]);
  assert.deepEqual(moveItem(['rooms', 'living'], [[0, 0, 10, 10]], 1, 2), [[1, 2, 10, 10]]);
  assert.deepEqual(moveItem(['rooms', 'hall'], [[[0, 0], [10, 0], [0, 10]]], 1, 2), [[[1, 2], [11, 2], [1, 12]]]);
  assert.deepEqual(moveItem(['drawing', 'labels', 0], {text: 'Hall', at: [5, 5], class: 'room'}, 1, 1), {text: 'Hall', at: [6, 6], class: 'room'});
  assert.deepEqual(moveItem(['markers', 0], {entity: 'light.a', x: 1, y: 2, icon: 'mdi:lamp'}, 0.15, 0).x, 1.2);
});

test('paths move their absolute coordinates only', () => {
  assert.equal(movePath('M25,790 H825', 10, 5), 'M35,795 H835');
  assert.equal(movePath('m10 10 l5 5 V20 a5,5 0 0,1 30,40 A5,5 0 0,1 30,40 z', 1, 2), 'm11 12 l5 5 V22 a5,5 0 0,1 30,40 A5,5 0 0,1 31,42 z');
  assert.equal(movePath('M530,120 h60', -30, 0), 'M500,120 h60');
});

test('resizing a rectangle from a corner and a side, turned or not', () => {
  const desk = {shape: {rect: [0, 0, 100, 50]}};
  assert.deepEqual(dragHandle(['furniture', 'desk'], desk, 'rect:1,1', [120, 60]).item.shape.rect, [0, 0, 120, 60]);
  // From the top side: the bottom stays.
  assert.deepEqual(dragHandle(['furniture', 'desk'], desk, 'rect:0,-1', [999, -10]).item.shape.rect, [0, -10, 100, 60]);
  // Past the opposite corner: it flips instead of going negative.
  assert.deepEqual(dragHandle(['furniture', 'desk'], desk, 'rect:1,0', [-20, 0]).item.shape.rect, [-20, 0, 20, 50]);
  // Turned 90°: its right side faces down, so dragging it down makes it longer, and its left side stays.
  const turned = {shape: {rect: [0, 0, 100, 50], turn: 90}};
  const fixed = handles(['furniture', 'desk'], turned).find(h => h.id === 'rect:-1,0').at;
  near(fixed, [50, -25]);
  const {item, ruler} = dragHandle(['furniture', 'desk'], turned, 'rect:1,0', [50, 95]);
  near(item.shape.rect, [-10, 10, 120, 50]);
  near(handles(['furniture', 'desk'], item).find(h => h.id === 'rect:-1,0').at, fixed);
  assert.equal(rulerText(ruler, 100), '1.20 × 0.50 m');
  assert.equal(snapsHandle(['furniture', 'desk'], turned, 'rect:1,0'), false);
  assert.equal(snapsHandle(['furniture', 'desk'], desk, 'rect:1,0'), true);
});

test('turning a piece by its handle, in steps', () => {
  const table = EXAMPLE.furniture.coffeeTable, path = ['furniture', 'coffeeTable'];
  const h = handles(path, table, {reach: 20}).find(x => x.id === 'turn');
  assert.ok(h.turn);
  // Straight right of the centre: a quarter turn clockwise.
  const [cx, cy] = [235, 460];
  assert.equal(dragHandle(path, table, 'turn', [cx + 100, cy + 3]).item.shape.turn, 90);
  assert.equal(dragHandle(path, table, 'turn', [cx + 100, cy - 3], {turnStep: 0}).item.shape.turn, 88.3);
  // Back to upright leaves turn out if it wasn't there.
  const desk = {shape: {rect: [0, 0, 100, 50]}};
  assert.equal('turn' in dragHandle(['furniture', 'desk'], desk, 'turn', [52, -90]).item.shape, false);
  assert.equal(dragHandle(path, table, 'turn', [cx - 1, cy - 90]).item.shape.turn, 0);
  assert.equal(rulerText(dragHandle(path, table, 'turn', [cx - 100, cy]).ruler, 100), '-90°');
});

test("polygon corners: dragged, added in a side's middle, removed", () => {
  const path = ['rooms', 'hall'], hall = [[[0, 0], [100, 0], [100, 100], [0, 100]]];
  assert.deepEqual(dragHandle(path, hall, 'p/v:2', [120, 130]).item, [[[0, 0], [100, 0], [120, 130], [0, 100]]]);
  const {item, id} = startHandle(path, hall, 'p/mid:1');
  assert.equal(id, 'p/v:2');
  assert.deepEqual(item, [[[0, 0], [100, 0], [100, 50], [100, 100], [0, 100]]]);
  assert.deepEqual(dragHandle(path, item, id, [150, 50]).item[0][2], [150, 50]);
  assert.deepEqual(removeCorner(path, item, 'p/v:2'), hall);
  assert.equal(removeCorner(['drawing', 'floors', 0], {poly: [[0, 0], [1, 0], [0, 1]]}, 'v:0'), null);
  const {ruler} = dragHandle(['drawing', 'floors', 0], {poly: [[0, 0], [100, 0], [0, 100]]}, 'v:1', [100, 0]);
  assert.equal(rulerText(ruler, 100), '1.00 m · 1.41 m');
});

test("circles, ellipses, a light's pool, an opening's ends, a room's rectangles", () => {
  assert.deepEqual(dragHandle(['drawing', 'fittings', 0], {circle: [0, 0, 5]}, 'r', [3, 4]).item.circle, [0, 0, 5]);
  assert.deepEqual(dragHandle(['drawing', 'fittings', 0], {ellipse: [0, 0, 5, 5]}, 'ry', [99, -8]).item.ellipse, [0, 0, 5, 8]);
  const lamp = EXAMPLE.lights[0];
  const pool = dragHandle(['lights', 0], lamp, 'pool', [80, 350]).item;
  // The pool alone moves: the glow stays.
  assert.deepEqual([pool.pool.x, pool.pool.y, pool.shape], [80, 350, lamp.shape]);
  assert.equal(dragHandle(['lights', 0], lamp, 'pool-r', [70, 640]).item.pool.r, 300);
  assert.ok(handles(['lights', 0], lamp).some(h => h.id === 's0/r'));
  assert.equal(dragHandle(['lights', 0], lamp, 's0/r', [70 + 50, 340]).item.shape[0].circle[2], 50);
  const door = EXAMPLE.openings[0];
  const wider = dragHandle(['openings', 0], door, 'end:1', [400, 0]);
  assert.deepEqual([wider.item.x, wider.item.w], [140, 260]);
  assert.equal(rulerText(wider.ruler, 100), '2.60 m');
  assert.deepEqual(dragHandle(['rooms', 'living'], [[0, 0, 10, 10], [10, 0, 10, 10]], 'q1/rect:1,1', [30, 30]).item, [[0, 0, 10, 10], [10, 0, 20, 30]]);
});

test('snapping a point: to anchors before the grid, along an axis with Shift', () => {
  const targets = {xs: [100, 203], ys: [50]};
  assert.deepEqual(snapPoint([102, 61], {...targets, tol: 3, grid: 5}), {p: [100, 60], guides: {x: 100, y: undefined}});
  assert.deepEqual(snapPoint([107, 52], {...targets, tol: 3, grid: 5}).p, [105, 50]);
  // No grid, nothing near: as it is.
  assert.deepEqual(snapPoint([150.3, 80.7], {...targets, tol: 3}).p, [150.3, 80.7]);
  // Shift: the nearer axis through where it started.
  assert.deepEqual(snapPoint([140, 13], {tol: 3, grid: 5, axis: true, from: [10, 10]}).p, [140, 10]);
  assert.deepEqual(snapPoint([12, 140], {tol: 3, grid: 5, axis: true, from: [10, 10]}).p, [10, 140]);
});

test("snapping a move: an anchor to another item's, or the box to the grid", () => {
  const pts = [[10, 10], [30, 10], [30, 20], [10, 20]];
  // The right side lands on x 100 (moved 70, asked 68).
  assert.deepEqual(snapMove(pts, 68, 3, {xs: [100], ys: [], tol: 3, grid: 5}), {dx: 70, dy: 5, guides: {x: 100, y: undefined}});
  // The box's corner on the grid: 10 + 7 → 15.
  assert.equal(snapMove([[11, 0]], 7, 0, {grid: 5}).dx, 9);
  // Along one axis only: Shift, or an opening's wall.
  assert.deepEqual(snapMove(pts, 40, 12, {axis: true}), {dx: 40, dy: 0, guides: {x: undefined, y: undefined}});
  assert.equal(snapMove(pts, 40, 12, {axes: [1, 0]}).dy, 0);
});

test('snap targets leave out what moves', () => {
  const items = [[['markers', 0], {x: 1, y: 2}], [['markers', 1], {x: 5, y: 6}], [['furniture', 'a'], {shape: {circle: [10, 10, 2]}}]];
  assert.deepEqual(snapTargets(items, [['markers', 1]]), {xs: [1, 8, 10, 12], ys: [2, 8, 10, 12]});
  assert.deepEqual(anchors(['openings', 0], EXAMPLE.openings[0]), [[140, 625], [360, 625], [360, 650], [140, 650]]);
});

test('a moved piece changes only its numbers in the file', () => {
  const text = fs.readFileSync(new URL('../../example/home.yaml', import.meta.url), 'utf8');
  const m = new HomeModel(text), path = ['furniture', 'sofa'];
  m.batch([{set: path, value: moveItem(path, m.get(path), 20, 0)}, {set: ['markers', 0], value: moveItem(['markers', 0], m.get(['markers', 0]), 5, 5)}]);
  const changed = m.text.split('\n').filter((line, i) => line !== text.split('\n')[i]);
  assert.deepEqual(changed.map(l => l.trim()), ['shape: {rect: [60, 380, 90, 200], rx: 8}', '- {rect: [60, 380, 25, 200], class: furn2, rx: 6}',
    changed[2].trim()]);
  assert.match(changed[2], /^ {2}- \{entity: [\w.]+, x: \d+, y: \d+/);
  // One step to undo.
  m.undo();
  assert.equal(m.text, text);
});

test('a shape under an SVG transform: its outline, hits, moves and handles', async () => {
  const {hitTest, shapeGeometry} = await import('./hit.js');
  // A label turned upright, as in a narrow hallway: its box is tall, not wide.
  const label = {text: 'Hallway', at: [680, 420], class: 'room', transform: 'rotate(-90 680 420)'};
  const [x0, y0, x1, y1] = boundsOf(shapeGeometry(label).polys[0]);
  assert.ok(x1 - x0 < 50 && y1 - y0 > 100, `${[x0, y0, x1, y1]}`);
  const home = {view: {x: 0, y: 0, w: 1145, h: 1000}, drawing: {labels: [label]}};
  assert.deepEqual(hitTest(home, [670, 460])[0], ['drawing', 'labels', 0]);
  assert.equal(hitTest(home, [740, 410]).length, 0);
  // Moved: the rotation's centre goes with it.
  assert.deepEqual(moveShape(label, 10, -20), {...label, at: [690, 400], transform: 'rotate(-90 690 400)'});
  assert.equal(moveTransform('translate(5 5) scale(2)', 10, 0), 'translate(5 5) matrix(2 0 0 2 -10 0)');
  assert.equal(moveTransform('rotate(30)', 1, 2), 'rotate(30 1 2)');
  // A rect turned by a transform: its corner handle is where the transform puts it, and dragging it works in the
  // rect's own units.
  const wall = {rect: [0, 0, 100, 20], transform: 'rotate(90 0 0)'};
  near(handles(['drawing', 'walls', 0], wall).find(h => h.id === 'rect:1,1').at, [-20, 100]);
  assert.deepEqual(dragHandle(['drawing', 'walls', 0], wall, 'rect:1,1', [-20, 150]).item.rect, [0, 0, 150, 20]);
});
