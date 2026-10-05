import test from 'node:test';
import assert from 'node:assert/strict';
import {HomeModel, yamlOf} from './model.js';
import {adoptOps, applyOps, cutOps, lampEntityOps, moveRoomOps, regroupOps, deleteOps, gapEndAt, gapOf, gapRange, gapsOf, partOf, partsOf, resizeGapOps, roomKey, roomOps, roomWalls, slideOps, snapRoom} from './build.js';

// An empty home at 100 units a metre, and a model to apply the changes to.
const EMPTY = {view: {x: -50, y: -50, w: 1200, h: 900}, units_per_metre: 100, rooms: {}, drawing: {floors: [], walls: [], glazing: [], labels: []},
  openings: [], furniture: {}, lights: [], markers: [], sun: {north: 0}};
const build = (steps, start = EMPTY) => {
  const model = new HomeModel(yamlOf(start));
  for (const step of steps) assert.ok(model.batch(step(model.data)), 'a change');
  assert.deepEqual(model.errors, []);
  return model.data;
};
const room = (name, rect, opts) => data => roomOps(data, name, rect, opts).ops;
const area = rects => rects.reduce((s, r) => s + r[2] * r[3], 0);
const walls = data => data.drawing.walls.map(w => w.rect);

test('a room comes with its floor, its label and walls all round', () => {
  const data = build([room('Living room', [0, 0, 500, 400])]);
  assert.deepEqual(data.rooms, {living_room: [[0, 0, 500, 400]]});
  assert.deepEqual(data.drawing.floors, [{rect: [0, 0, 500, 400], class: 'floor', part: 'living_room'}]);
  assert.deepEqual(data.drawing.labels, [{text: 'Living room', at: [250, 200], class: 'room', part: 'living_room'}]);
  // 25 cm outside each side, corners included, and nothing twice.
  assert.equal(area(walls(data)), 550 * 450 - 500 * 400);
  assert.ok(data.drawing.walls.every(w => w.class === 'wall'));
});

test('a room drawn against another shares its wall, which becomes an interior one', () => {
  const a = build([room('Living', [0, 0, 500, 400])]);
  // Drawn a little into the living room's right wall: moved to its far side.
  assert.deepEqual(snapRoom(a, [510, 0, 300, 400], 20), [525, 0, 285, 400]);
  const data = build([room('Living', [0, 0, 500, 400]), room('Bedroom', [525, 0, 285, 400])]);
  const inner = data.drawing.walls.filter(w => w.class === 'iwall');
  assert.deepEqual(inner.map(w => w.rect), [[500, 0, 25, 400]]);
  // The outline of both, walled once: the outer box less the rooms and the shared wall.
  assert.equal(area(walls(data)), (835 - -25) * 450 - 500 * 400 - 285 * 400);
});

test('an L of three rooms, and a room outdoors without walls of its own', () => {
  const data = build([room('Living', [0, 0, 500, 400]), room('Bedroom', [525, 0, 285, 400]),
    room('Hall', [0, 425, 300, 200]), room('Terrace', [-25, 650, 860, 150], {outdoor: true})]);
  const ends = rs => rs.map(r => [r[0], r[1], r[0] + r[2], r[1] + r[3]]);
  // No two walls overlap.
  const all = ends(walls(data));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const [a, b] = [all[i], all[j]];
    assert.ok(Math.min(a[2], b[2]) - Math.max(a[0], b[0]) <= 0.01 || Math.min(a[3], b[3]) - Math.max(a[1], b[1]) <= 0.01, `${a} and ${b} overlap`);
  }
  // The hall's top is the living room's bottom wall, now between them.
  assert.ok(data.drawing.walls.some(w => w.class === 'iwall' && w.rect[1] === 400 && w.rect[3] === 25));
  // The terrace: its floor in its own colour, in the palette, and the walls next to it stay outer.
  assert.equal(data.drawing.floors.at(-1).class, 'terrace');
  assert.deepEqual(data.palette, {light: {terrace: '#d9cfc0'}, dark: {terrace: '#3a352e'}, tinted: ['terrace']});
  assert.equal(data.drawing.walls.filter(w => w.rect[1] === 625).every(w => w.class === 'wall'), true);
});

test('room keys from names, unique', () => {
  assert.equal(roomKey({rooms: {}}, 'Living room'), 'living_room');
  assert.equal(roomKey({rooms: {living_room: []}}, 'Living Room'), 'living_room_2');
  assert.equal(roomKey({}, 'Hálószoba!'), 'haloszoba');
  assert.equal(roomKey({}, '  '), 'room');
});

test('walls are added only where there are none', () => {
  const data = build([room('Living', [0, 0, 500, 400])]);
  assert.deepEqual(roomWalls(data, [0, 0, 500, 400]), []);
});

test('a window, a glass door and a door cut into the walls', () => {
  let data = build([room('Living', [0, 0, 500, 400]), room('Bedroom', [525, 0, 285, 400])]);
  const before = area(walls(data));
  // A 1.2 m window in the living room's bottom wall, around x 250.
  const win = cutOps(data, [250, 410], {kind: 'window', metres: 1.2});
  assert.equal(win.opening, true);
  data = build([() => win.ops], data);
  assert.equal(area(walls(data)), before - 120 * 25);
  assert.deepEqual(data.openings, [{wall: 'bottom', at: 425, depth: 25, x: 190, w: 120, lo: 0.9, hi: 2.2, room: 'living', part: 'window_1'}]);
  assert.deepEqual(data.drawing.glazing, [{rect: [190, 407.5, 120, 10], class: 'glass', part: 'window_1'}]);
  // A glass door in the bedroom's right wall: down to the floor.
  data = build([d => cutOps(d, [820, 200], {kind: 'glass_door', metres: 1}).ops], data);
  assert.equal(data.openings[1].wall, 'right');
  assert.equal(data.openings[1].lo, 0);
  // A door between them: a gap only, whatever kind was chosen.
  const n = data.openings.length;
  data = build([d => cutOps(d, [512, 300], {kind: 'window', metres: 0.9}).ops], data);
  assert.equal(data.openings.length, n);
  assert.equal(data.drawing.walls.filter(w => w.class === 'iwall').length, 2);
  assert.deepEqual(data.drawing.floors.at(-1), {rect: [500, 255, 25, 90], class: 'floor', part: 'doorway_1'});
  // Near a wall's end, the cut stays inside it; nowhere near a wall, nothing.
  assert.deepEqual(cutOps(data, [-10, 395], {metres: 1}) && true, true);
  assert.equal(cutOps(data, [250, 200], {metres: 1}), null);
});

test('a cut dragged along a wall takes that span; gaps are found, and resized with what is in them', () => {
  let data = build([room('Living', [0, 0, 500, 400]), room('Bedroom', [525, 0, 285, 400])]);
  data = build([d => cutOps(d, [100, 412], {until: [260, 410]}).ops, d => cutOps(d, [512, 300], {metres: 0.9}).ops], data);
  assert.deepEqual(data.openings[0].x, 100);
  assert.deepEqual(data.openings[0].w, 160);
  const gaps = gapsOf(data);
  assert.deepEqual(gaps.map(g => [g.axis, g.from, g.to]).sort(), [[0, 100, 260], [1, 255, 345]]);
  // The window's right end, grabbed and dragged to x 320: the wall, glass and opening follow.
  const {gap, end} = gapEndAt(data, [262, 415], 5);
  assert.equal(end, 'to');
  assert.deepEqual(gapRange(data, gap, 'to'), [130, 524.5]);
  data = build([d => resizeGapOps(d, gap, 100, 320)], data);
  assert.equal(data.openings[0].w, 220);
  assert.deepEqual(data.drawing.glazing[0].rect, [100, 407.5, 220, 10]);
  assert.ok(data.drawing.walls.some(w => w.rect[0] === 320 && w.rect[1] === 400));
  // The doorway: its floor follows.
  const door = gapsOf(data).find(g => g.axis === 1);
  data = build([d => resizeGapOps(d, door, 200, 345)], data);
  assert.deepEqual(data.drawing.floors.at(-1).rect, [500, 200, 25, 145]);
});

test('what Build makes is tagged as one object, and goes as one', () => {
  let data = build([room('Living', [0, 0, 500, 400]), room('Bedroom', [525, 0, 285, 400])]);
  data = build([d => cutOps(d, [250, 412], {metres: 1.2}).ops, d => cutOps(d, [512, 300], {metres: 0.9}).ops,
    d => cutOps(d, [100, -12], {kind: 'door', metres: 0.9}).ops], data);
  // The room: itself, its floor, its label, its walls.
  assert.deepEqual(partsOf(data, 'living').map(p => p.slice(0, 2).join('.')).filter((v, i, a) => a.indexOf(v) === i),
    ['rooms.living', 'drawing.floors', 'drawing.walls', 'drawing.labels']);
  // The window: its glass and its opening; the doorway and the door outside: a floor through them.
  assert.deepEqual(partsOf(data, 'window_1'), [['drawing', 'glazing', 0], ['openings', 0]]);
  assert.equal(partOf(data, ['openings', 0]), 'window_1');
  assert.equal(partsOf(data, 'doorway_1').length, 1);
  assert.equal(partsOf(data, 'door_1').length, 1);
  // Slid along its wall, the window keeps its width; it stops at the wall's end.
  const gap = gapOf(data, 'window_1');
  let moved = build([d => slideOps(d, gap, 100)], data);
  assert.deepEqual([moved.openings[0].x, moved.openings[0].w], [290, 120]);
  moved = build([d => slideOps(d, gapOf(d, 'window_1'), -1000)], moved);
  assert.equal(moved.openings[0].x, -24.5);
  // Deleted, the window's hole closes: one wall piece again.
  const walls = data.drawing.walls.length;
  const closed = build([d => deleteOps(d, 'window_1')], data);
  assert.equal(closed.drawing.walls.length, walls - 1);
  assert.deepEqual(closed.openings, []);
  assert.deepEqual(closed.drawing.glazing, []);
  // Deleted, the bedroom goes with its walls, but the wall the living room still needs stays, outer again, and the
  // doorway in it goes.
  const left = build([d => deleteOps(d, 'bedroom')], data);
  assert.deepEqual(Object.keys(left.rooms), ['living']);
  assert.ok(left.drawing.walls.every(w => w.class === 'wall' && w.part === 'living'));
  assert.deepEqual(partsOf(left, 'doorway_1'), []);
  assert.deepEqual(partsOf(left, 'bedroom'), []);
});

test('a room without a name has no label, and a key of its own', () => {
  const data = build([room('', [0, 0, 300, 300]), room('  ', [325, 0, 300, 300])]);
  assert.deepEqual(Object.keys(data.rooms), ['room', 'room_2']);
  assert.deepEqual(data.drawing.labels, []);
  assert.equal(data.drawing.floors.length, 2);
});

test('a home not made in Build is adopted: lamps, windows with their glass and shutters, room names and floors', () => {
  const home = {view: {x: 0, y: 0, w: 1100, h: 900}, units_per_metre: 100,
    rooms: {living: [[25, 25, 500, 600]], open: [[25, 25, 500, 600], [525, 25, 300, 600]], bath: [[525, 25, 300, 300]]},
    drawing: {floors: [{rect: [25, 25, 800, 600], class: 'floor'}, {rect: [525, 25, 300, 300], class: 'bath'}],
      walls: [{rect: [0, 0, 850, 25], class: 'wall'}, {rect: [0, 625, 140, 25], class: 'wall'}, {rect: [500, 625, 350, 25], class: 'wall'}],
      glazing: [{rect: [140, 632, 180, 10], class: 'glass'}],
      labels: [{text: 'Living room', at: [250, 300], class: 'room'}, {text: 'Bath', at: [670, 150], class: 'room'}, {text: 'a note', at: [600, 500], class: 'lbl'}]},
    openings: [{wall: 'bottom', at: 650, depth: 25, x: 140, w: 180, lo: 0.9, hi: 2, room: 'living', shutter: 'cover.window'},
      {wall: 'bottom', at: 650, depth: 25, x: 320, w: 180, lo: 0, hi: 2, room: 'living', shutter: 'cover.door'}],
    lights: [{entities: ['light.lamp'], shape: [{circle: [100, 100, 40]}]}, {lit: 'dark', shape: [{circle: [200, 100, 40]}]}],
    markers: [{entity: 'light.lamp', x: 100, y: 100, icon: 'mdi:lamp'}, {entity: 'cover.window', x: 230, y: 700, icon: 'mdi:blinds'},
      {entity: 'cover.door', x: 410, y: 700, icon: 'mdi:blinds'}, {entity: 'sensor.t', x: 300, y: 300, icon: 'mdi:thermometer'}],
    sun: {north: 0}};
  const data = build([d => adoptOps(d)], home);
  assert.deepEqual(partsOf(data, 'lamp_1'), [['lights', 0], ['markers', 0]]);
  assert.equal(data.lights[1].part, undefined);
  assert.deepEqual(partsOf(data, 'window_1'), [['drawing', 'glazing', 0], ['openings', 0], ['markers', 1]]);
  assert.deepEqual(partsOf(data, 'door_1'), [['openings', 1], ['markers', 2]]);
  // A name goes to the smallest room around it; a floor of exactly a room's shape is its.
  assert.equal(data.drawing.labels[0].part, 'living');
  assert.deepEqual(partsOf(data, 'bath'), [['rooms', 'bath'], ['drawing', 'floors', 1], ['drawing', 'labels', 1]]);
  assert.equal(data.drawing.labels[2].part, undefined);
  assert.equal(data.markers[3].part, undefined);
  assert.ok(data.drawing.walls.every(w => w.part === undefined));
  // Again: nothing more to adopt.
  assert.deepEqual(adoptOps(data), []);
});

test('applyOps does to plain data what the model does to its document', () => {
  const steps = [room('Living', [0, 0, 500, 400]), data => cutOps(data, [250, 412], {kind: 'window', metres: 1.2}).ops];
  const model = new HomeModel(yamlOf(EMPTY));
  let plain = EMPTY;
  for (const step of steps) {
    const ops = step(model.data);
    model.batch(ops);
    plain = applyOps(plain, ops);
  }
  assert.deepEqual(plain, model.data);
});

test('a room alone moves with its walls, its floor, its label and the window in its wall', () => {
  const data = build([room('Living', [0, 0, 500, 400]), d => cutOps(d, [250, 412], {kind: 'window', metres: 1.2}).ops]);
  const moved = build([d => moveRoomOps(d, 'living', 100, 50).ops], data);
  assert.deepEqual(moved.rooms.living, [[100, 50, 500, 400]]);
  assert.deepEqual(moved.drawing.floors.find(f => f.part === 'living').rect, [100, 50, 500, 400]);
  assert.deepEqual(moved.drawing.labels[0].at, [350, 250]);
  // The same walls, moved; the window with them, in a gap of its own.
  assert.equal(area(walls(moved)), area(walls(data)));
  assert.deepEqual(walls(moved).map(r => [r[0] - 100, r[1] - 50, r[2], r[3]]).sort(), walls(data).sort());
  const glass = moved.drawing.glazing.find(g => g.part === 'window_1'), opening = moved.openings.find(o => o.part === 'window_1');
  assert.deepEqual(glass.rect.slice(0, 2), data.drawing.glazing[0].rect.slice(0, 2).map((v, i) => v + [100, 50][i]));
  assert.equal(opening.x, data.openings[0].x + 100);
  assert.equal(opening.at, data.openings[0].at + 50);
  assert.ok(gapOf(moved, 'window_1'));
});

test('a room moved away from its neighbour leaves it its wall, and gets one of its own', () => {
  const data = build([room('Living', [0, 0, 500, 400]), room('Kitchen', [525, 0, 300, 400])]);
  const moved = build([d => moveRoomOps(d, 'kitchen', 400, 0).ops], data);
  assert.deepEqual(moved.rooms.kitchen, [[925, 0, 300, 400]]);
  // The wall between them is the living room's outer wall again; the kitchen is walled all round.
  const between = moved.drawing.walls.find(w => w.rect[0] === 500 && w.rect[3] >= 400);
  assert.equal(between.class, 'wall');
  assert.equal(between.part, 'living');
  assert.equal(area(moved.drawing.walls.filter(w => w.part === 'kitchen').map(w => w.rect)), 350 * 450 - 300 * 400);
});

test("a lamp's entity set on one part is set on all of them", () => {
  const data = {...EMPTY, lights: [{entities: ['light.a'], shape: [{circle: [0, 0, 10]}], pool: {x: 0, y: 0, r: 100, height: 2, shadows: []}, part: 'lamp_1'},
    {lit: 'dark', shape: [{circle: [50, 0, 10]}], part: 'lamp_2'}],
  markers: [{entity: 'light.a', x: 0, y: 0, icon: 'mdi:lamp', part: 'lamp_1'}, {entity: 'light.a', x: 9, y: 9, icon: 'mdi:lamp'}]};
  const after = applyOps(data, lampEntityOps(data, ['markers', 0, 'entity'], 'light.b'));
  assert.deepEqual(after.lights[0].entities, ['light.b']);
  assert.equal(after.markers[0].entity, 'light.b');
  // Not part of the lamp: as it was.
  assert.equal(after.markers[1].entity, 'light.a');
  const lit = applyOps(data, lampEntityOps(data, ['lights', 1, 'entities'], ['light.c']));
  assert.deepEqual(lit.lights[1], {shape: [{circle: [50, 0, 10]}], part: 'lamp_2', entities: ['light.c']});
  assert.equal(lampEntityOps(data, ['markers', 1, 'entity'], 'light.b'), null);
  assert.equal(lampEntityOps(data, ['lights', 0, 'shape'], []), null);
});

test('a lamp or a piece moved into another room: what it is in follows', () => {
  const data = build([room('Living', [0, 0, 500, 400]), room('Kitchen', [525, 0, 300, 400])]);
  const home = {...data,
    furniture: {sofa: {shape: {rect: [50, 50, 200, 90]}, height: 0.8, shadow_room: 'living'}, fridge: {shape: {rect: [700, 50, 60, 60]}, height: 1.8, shadow_room: 'kitchen'}},
    lights: [{entities: ['light.a'], shape: [{circle: [600, 200, 20]}], clip: 'living', pool: {x: 600, y: 200, r: 200, height: 2, shadows: ['sofa']}},
      {entities: ['light.b'], shape: [{circle: [100, 300, 20]}], clip: 'living', pool: {x: 100, y: 300, r: 200, height: 2, shadows: ['sofa']}}]};
  // The first lamp now stands in the kitchen; the sofa too.
  home.furniture.sofa = {...home.furniture.sofa, shape: {rect: [550, 250, 200, 90]}};
  const after = applyOps(home, regroupOps(home, [['lights', 0], ['furniture', 'sofa']]));
  assert.equal(after.lights[0].clip, 'kitchen');
  assert.deepEqual(after.lights[0].pool.shadows, ['fridge']);
  assert.equal(after.furniture.sofa.shadow_room, 'kitchen');
  // Out of the living room lamp's shadows.
  assert.deepEqual(after.lights[1].pool.shadows, []);
  // Nothing moved rooms: nothing changes.
  assert.deepEqual(regroupOps(after, [['lights', 0], ['furniture', 'sofa'], ['lights', 1]]), []);
});

test('a group of pieces deleted leaves the lamps it was in the shadows of', () => {
  const data = {...EMPTY, furniture: {table: {shape: {rect: [0, 0, 100, 100]}, height: 0.75, part: 'dining_2_1'}, chair: {shape: {rect: [0, 110, 40, 40]}, height: 0.9, part: 'dining_2_1'},
    sofa: {shape: {rect: [300, 0, 200, 90]}, height: 0.8}},
  lights: [{entities: ['light.a'], shape: [{circle: [200, 200, 20]}], pool: {x: 200, y: 200, r: 300, height: 2, shadows: ['table', 'sofa', 'chair']}}]};
  const after = build([d => deleteOps(d, 'dining_2_1')], data);
  assert.deepEqual(Object.keys(after.furniture), ['sofa']);
  assert.deepEqual(after.lights[0].pool.shadows, ['sofa']);
});

test('a room made larger: its far walls and the window in its bottom wall move with its sides', () => {
  const data = build([room('Living', [0, 0, 500, 400]), d => cutOps(d, [250, 412], {kind: 'window', metres: 1.2}).ops]);
  const big = build([d => moveRoomOps(d, 'living', 0, 0, 0, [600, 500]).ops], data);
  assert.deepEqual(big.rooms.living, [[0, 0, 600, 500]]);
  assert.deepEqual(big.drawing.floors.find(f => f.part === 'living').rect, [0, 0, 600, 500]);
  assert.deepEqual(big.drawing.labels[0].at, [300, 250]);
  assert.equal(area(walls(big)) + 120 * 25, 650 * 550 - 600 * 500);
  assert.equal(big.openings[0].at, data.openings[0].at + 100);
  assert.equal(big.openings[0].x, data.openings[0].x);
  assert.ok(gapOf(big, 'window_1'));
});
