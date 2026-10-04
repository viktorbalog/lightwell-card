import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXAMPLE} from '../../scripts/example.mjs';
import {HomeModel} from './model.js';
import {anchors, boundsOf, dragHandle, handles, insideTargets, moveItem, movePath, moveShape, moveTransform, removeCorner, rulerText, scaleShape, movePathPoint,
  snapMove, snapPoint, snapTargets, snapsHandle, startHandle} from './manipulate.js';

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

// The example's sofa, turned a quarter: its cushion (local x 40 to 65, y 380 to 580) lies across y 435 to 460 in the
// drawing, x -15 to 185.
const turnedSofa = {...EXAMPLE.furniture.sofa, shape: {...EXAMPLE.furniture.sofa.shape, turn: 90}};
const cushion = ['furniture', 'sofa', 'extra', 0];

test("a turned piece's extra shape: hit where it's drawn, its outline and anchors", async () => {
  const {hitInside, hitTest, outlineSvg} = await import('./hit.js');
  const home = {...EXAMPLE, furniture: {...EXAMPLE.furniture, sofa: turnedSofa}};
  assert.deepEqual(hitInside(home, 'sofa', [150, 447]), [cushion]);
  // Inside the cushion as written, but not where it's drawn.
  assert.deepEqual(hitInside(home, 'sofa', [50, 400]), []);
  assert.deepEqual(hitInside(EXAMPLE, 'sofa', [50, 400]), [cushion]);
  // Outside a piece, a click still finds the piece, not its insides.
  assert.deepEqual(hitTest(EXAMPLE, [50, 400])[0], ['furniture', 'sofa']);
  assert.ok(!hitTest(EXAMPLE, [50, 400]).some(h => h[0] === 'furniture' && h.length > 2));
  const [x0, y0, x1, y1] = boundsOf(anchors(cushion, turnedSofa.extra[0], 1, {piece: turnedSofa}));
  near([x0, y0, x1, y1], [-15, 435, 185, 460]);
  assert.match(outlineSvg(home, cushion), /^<polygon points="185,435 185,460 -15,460 -15,435"\/>$/);
  // Without the piece: in its frame.
  assert.deepEqual(boundsOf(anchors(cushion, turnedSofa.extra[0])), [40, 380, 65, 580]);
});

test("moving and reshaping an extra shape of a turned piece, in the piece's frame", () => {
  const s = turnedSofa.extra[0], piece = turnedSofa;
  // Down the drawing is along the sofa's x when it's turned a quarter.
  assert.deepEqual(moveItem(cushion, s, 0, 10, {piece}).rect, [50, 380, 25, 200]);
  assert.deepEqual(moveItem(cushion, s, 0, 10, {piece: EXAMPLE.furniture.sofa}).rect, [40, 390, 25, 200]);
  // Its handles where the card draws it.
  near(handles(cushion, s, {piece}).find(h => h.id === 'rect:1,1').at, [-15, 460]);
  near(handles(cushion, s, {piece}).find(h => h.id === 'rect:1,0').at, [85, 460]);
  // Its right side (in its frame) dragged 15 further down the drawing: 15 wider.
  const {item, ruler} = dragHandle(cushion, s, 'rect:1,0', [85, 475], {piece});
  assert.deepEqual(item, {...s, rect: [40, 380, 40, 200]});
  assert.equal(rulerText(ruler, 100), '0.40 × 2.00 m');
  assert.equal(snapsHandle(cushion, s, 'rect:1,0', {piece}), true);
  // Its own transform stays its own.
  const turned = {...s, transform: 'rotate(10 50 400)'};
  assert.equal(dragHandle(cushion, turned, 'rect:1,1', [0, 470], {piece}).item.transform, 'rotate(10 50 400)');
  assert.equal(moveItem(cushion, turned, 0, 10, {piece}).transform, 'rotate(10 60 400)');
  // A polygon's corner added in the middle of a side, and taken out again.
  const tri = {poly: [[40, 380], [65, 380], [40, 420]]}, added = startHandle(cushion, tri, 'mid:0', {piece});
  assert.deepEqual(added, {item: {poly: [[40, 380], [52.5, 380], [65, 380], [40, 420]]}, id: 'v:1'});
  assert.deepEqual(removeCorner(cushion, added.item, 'v:1', {piece}), tri);
});

test("a resized piece's insides scale with it, unless they're left", () => {
  const sofa = EXAMPLE.furniture.sofa, path = ['furniture', 'sofa'];
  const wider = dragHandle(path, sofa, 'rect:1,0', [220, 480]).item;
  assert.deepEqual(wider.shape.rect, [40, 380, 180, 200]);
  assert.deepEqual(wider.extra, [{rect: [40, 380, 50, 200], class: 'furn2', rx: 6}]);
  assert.deepEqual(dragHandle(path, sofa, 'rect:1,0', [220, 480], {insides: false}).item.extra, sofa.extra);
  // Turned, they keep their place in its frame.
  const turned = dragHandle(path, turnedSofa, 'rect:-1,1', [0, 520]).item, [x, y, w, h] = turned.shape.rect;
  near(turned.extra[0].rect, [x, y, 25 * w / 90, h]);
  // Turning moves nothing in its frame.
  assert.deepEqual(dragHandle(path, sofa, 'turn', [200, 480]).item.extra, sofa.extra);
  // A circle by the smaller factor, a line's lengths, a text's place but not its size.
  assert.deepEqual(scaleShape({circle: [50, 50, 10]}, [0, 0, 100, 100], [0, 0, 300, 200]), {circle: [150, 100, 20]});
  assert.equal(scaleShape({path: 'M530,120 h60', class: 'line'}, [530, 40, 60, 160], [530, 40, 120, 80]).path, 'M530,80 h120');
  assert.deepEqual(scaleShape({text: 'TV', at: [10, 10], class: 'lbl'}, [0, 0, 20, 20], [0, 0, 40, 20]), {text: 'TV', at: [20, 10], class: 'lbl'});
  // A circular piece: around its centre.
  const lamp = {shape: {circle: [100, 100, 10]}, extra: [{circle: [100, 100, 4]}, {rect: [95, 95, 5, 5]}]};
  assert.deepEqual(dragHandle(['furniture', 'lamp'], lamp, 'r', [120, 100]).item.extra, [{circle: [100, 100, 8]}, {rect: [90, 90, 10, 10]}]);
});

test("snapping inside a piece: its outline's corners and centre, and its other shapes", () => {
  assert.deepEqual(insideTargets(EXAMPLE.furniture.bed, [0]), {xs: [600, 700, 705, 785, 800], ys: [420, 510, 560, 590, 600]});
  assert.deepEqual(insideTargets({shape: {circle: [0, 0, 10]}}), {xs: [-10, 0, 10], ys: [-10, 0, 10]});
});

test("a moved extra shape changes only its numbers in the file", () => {
  const text = fs.readFileSync(new URL('../../example/home.yaml', import.meta.url), 'utf8');
  const m = new HomeModel(text), path = ['furniture', 'bed', 'extra', 1];
  m.set(path, dragHandle(path, m.get(path), 'rect:1,0', [795, 575], {piece: m.get(['furniture', 'bed'])}).item);
  const changed = m.text.split('\n').filter((line, i) => line !== text.split('\n')[i]);
  assert.deepEqual(changed.map(l => l.trim()), ['- {rect: [705, 560, 90, 30], class: furn2, rx: 10}']);
});

test("the sun's spills and blockers: hit behind the drawing, moved and reshaped", async () => {
  const {hitTest, outlineSvg} = await import('./hit.js');
  const spill = {cx: 100, cy: 100, rx: 50, ry: 20, clip: 'hall', from: [0], k: 0.5}, blocker = {rect: [300, 0, 20, 40], height: 3};
  const home = {view: {x: 0, y: 0, w: 1145, h: 500}, rooms: {hall: [[0, 0, 400, 400]]}, drawing: {floors: [{rect: [0, 0, 400, 400]}]},
    sun: {spill: [spill], blockers: [blocker]}};
  assert.deepEqual(hitTest(home, [140, 100]), [['drawing', 'floors', 0], ['sun', 'spill', 0], ['rooms', 'hall']]);
  assert.deepEqual(hitTest(home, [100, 125]).map(h => h[0]), ['drawing', 'rooms']);
  assert.deepEqual(hitTest(home, [310, 20])[1], ['sun', 'blockers', 0]);
  assert.equal(outlineSvg(home, ['sun', 'spill', 0]), '<ellipse cx="100" cy="100" rx="50" ry="20"/>');
  assert.deepEqual(moveItem(['sun', 'spill', 0], spill, 5, -5), {...spill, cx: 105, cy: 95});
  assert.deepEqual(handles(['sun', 'spill', 0], spill).map(h => h.id), ['rx', 'ry']);
  assert.deepEqual(dragHandle(['sun', 'spill', 0], spill, 'ry', [0, 140]).item, {...spill, ry: 40});
  assert.deepEqual(moveItem(['sun', 'blockers', 0], blocker, 10, 0), {rect: [310, 0, 20, 40], height: 3});
  assert.deepEqual(dragHandle(['sun', 'blockers', 0], blocker, 'rect:1,1', [330, 50]).item, {rect: [300, 0, 30, 50], height: 3});
});

test("a path's points: handles where they are, moved one by one with the rest staying", () => {
  const line = {path: 'M530,120 h60', class: 'line'}, path = ['drawing', 'fittings', 0];
  assert.deepEqual(handles(path, line).map(h => [h.id, h.at]), [['pt:0', [530, 120]], ['pt:1', [590, 120]]]);
  // The start moved: the relative h is made up for, so its end stays; it moves along x only.
  assert.equal(dragHandle(path, line, 'pt:0', [500, 100]).item.path, 'M500,100 h90');
  assert.equal(dragHandle(path, line, 'pt:1', [600, 140]).item.path, 'M530,120 h70');
  assert.equal(rulerText(dragHandle(path, line, 'pt:1', [600, 140]).ruler, 100), '0.70 m');
  // Absolute and relative, a curve's control points, a closed subpath with a relative move after it.
  assert.equal(movePathPoint('M0 0 L10 0 l5 5', 'pt:1', [20, 2]), 'M0 0 L20 2 l-5 3');
  assert.equal(movePathPoint('M0,0 C 0,10 10,10 10,0', 'c:1:1', [12, 15]), 'M0,0 C 0,10 12,15 10,0');
  assert.deepEqual(handles(path, {path: 'M0,0 c0,10 10,10 10,0'}).map(h => h.id), ['pt:0', 'pt:1', 'c:1:0', 'c:1:1']);
  assert.equal(movePathPoint('m0 0 l10 0 l0 10 z m5 5 l1 1', 'pt:0', [2, 0]), 'm2 0 l8 0 l0 10 z m3 5 l1 1');
  // Under a transform, and on a turned piece: where it's drawn.
  const turned = {...line, transform: 'translate(10 0)'};
  assert.equal(dragHandle(path, turned, 'pt:1', [610, 120]).item.path, 'M530,120 h70');
  const piece = {shape: {rect: [500, 100, 100, 40], turn: 90}};
  const end = handles(cushion, line, {piece}).find(h => h.id === 'pt:1').at;
  near(end, [550, 160]);
  assert.equal(dragHandle(cushion, line, 'pt:1', [550, 170], {piece}).item.path, 'M530,120 h70');
});

test("a room's rectangle on its own: outlined, moved and resized, the others staying", async () => {
  const {outlineSvg} = await import('./hit.js');
  const home = {view: {x: 0, y: 0, w: 1145, h: 500}, rooms: {hall: [[0, 0, 100, 50], [100, 0, 50, 200]]}};
  const part = ['rooms', 'hall', 1], q = home.rooms.hall[1];
  assert.equal(outlineSvg(home, part), '<polygon points="100,0 150,0 150,200 100,200"/>');
  assert.deepEqual(moveItem(part, q, 10, 5), [110, 5, 50, 200]);
  assert.deepEqual(anchors(part, q), [[100, 0], [150, 0], [150, 200], [100, 200]]);
  assert.deepEqual(dragHandle(part, q, 'rect:1,1', [170, 220]).item, [100, 0, 70, 220]);
  assert.ok(handles(part, q).some(h => h.id === 'rect:-1,-1'));
  // A polygon room's polygon as one part.
  assert.deepEqual(dragHandle(['rooms', 'x', 0], [[0, 0], [10, 0], [0, 10]], 'v:1', [20, 0]).item, [[0, 0], [20, 0], [0, 10]]);
});
