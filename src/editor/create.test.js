import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import {defineHome} from '../home.js';
import {emptyHome, inferWall, lightFrom, openingFrom, pictureHome, pieceDefaults, pieceFrom, roomAt, scaleFrom, wallFrom} from './create.js';

const EXAMPLE = YAML.parse(fs.readFileSync(new URL('../../example/home.yaml', import.meta.url), 'utf8'));

test('new homes pass the check', () => {
  const empty = YAML.parse(emptyHome(8.5, 6.5));
  assert.deepEqual(empty.view, {x: -20, y: -20, w: 890, h: 690});
  defineHome(empty);
  const picture = YAML.parse(pictureHome('/local/plan.png', 600, 500));
  assert.deepEqual([picture.view, picture.drawing.background], [{x: 0, y: 0, w: 600, h: 500}, {image: '/local/plan.png', rect: [0, 0, 600, 500]}]);
  defineHome(picture);
  assert.match(pictureHome('/local/plan.png', 600, 500), /^# A home for Lightwell, drawn over a picture of its plan \(\/local\/plan\.png\)/);
});

test('the scale from a measured line', () => {
  // The background example: walls 6 m apart, 600 px.
  assert.equal(scaleFrom([20, 250], [580, 250], 5.6), 100);
  assert.equal(scaleFrom([0, 0], [300, 400], 3), 166.67);
});

test("an opening's wall from the walls drawn: all four sides, a gap between two rectangles", () => {
  // The terrace door: dragged along the gap (x 140–360) in the bottom wall, 25 thick.
  assert.deepEqual(inferWall(EXAMPLE, [140, 637], [360, 640]), {wall: 'bottom', at: 650, depth: 25, room: 'living', from: 140, to: 360});
  // The bedroom window, in the right wall (y 230–410): dragged upwards.
  assert.deepEqual(inferWall(EXAMPLE, [838, 410], [836, 230]), {wall: 'right', at: 850, depth: 25, room: 'bedroom', from: 230, to: 410});
  // The top and left walls.
  assert.deepEqual(inferWall(EXAMPLE, [100, 12], [200, 12]), {wall: 'top', at: 0, depth: 25, room: 'living', from: 100, to: 200});
  assert.deepEqual(inferWall(EXAMPLE, [12, 100], [12, 300]), {wall: 'left', at: 0, depth: 25, room: 'living', from: 100, to: 300});
  // Walls of different thickness: the right one 40 thick, the top 10.
  const home = {view: {x: 0, y: 0, w: 500, h: 500}, rooms: {a: [[10, 10, 450, 480]]},
    drawing: {walls: [{rect: [0, 0, 500, 10], class: 'wall'}, {rect: [460, 0, 40, 500], class: 'wall'}]}};
  assert.deepEqual(inferWall(home, [480, 100], [480, 200]), {wall: 'right', at: 500, depth: 40, room: 'a', from: 100, to: 200});
  assert.deepEqual(inferWall(home, [100, 5], [200, 5]), {wall: 'top', at: 0, depth: 10, room: 'a', from: 100, to: 200});
  // Within the tolerance of a wall's face, but not further.
  assert.equal(inferWall(home, [100, 13], [200, 13], 4).wall, 'top');
  assert.equal(inferWall(home, [100, 30], [200, 30], 4), null);
  // Interior walls aren't outer walls.
  assert.equal(inferWall(EXAMPLE, [507, 100], [507, 200]), null);
  // No rooms: the outside is away from the view's middle.
  const bare = {view: {x: 0, y: 0, w: 500, h: 500}, drawing: {walls: [{rect: [0, 480, 500, 20]}]}};
  assert.equal(inferWall(bare, [100, 490], [200, 490]).wall, 'bottom');
});

test('an opening and its glass from a drag', () => {
  const {opening, glass} = openingFrom(EXAMPLE, [140, 637], [360, 640], {kind: 'door'});
  assert.deepEqual(opening, {wall: 'bottom', at: 650, depth: 25, x: 140, w: 220, lo: 0, hi: 2.1, room: 'living'});
  assert.deepEqual(glass, {rect: [140, 632.5, 220, 10], class: 'glass'});
  defineHome({...EXAMPLE, openings: [opening]});
  const side = openingFrom(EXAMPLE, [838, 230], [836, 410]);
  assert.deepEqual([side.opening.y, side.opening.h, side.opening.lo, side.glass.rect], [230, 180, 0.9, [832.5, 230, 10, 180]]);
  assert.equal(openingFrom(EXAMPLE, [300, 300], [400, 300]), null);
});

test('walls: a box, or a line given a thickness; inside a room an interior wall', () => {
  assert.deepEqual(wallFrom(EXAMPLE, [0, 0], [850, 25]), {rect: [0, 0, 850, 25], class: 'wall'});
  assert.deepEqual(wallFrom({units_per_metre: 100}, [0, 100], [400, 102]), {rect: [0, 88.5, 400, 25], class: 'wall'});
  assert.deepEqual(wallFrom(EXAMPLE, [300, 100], [300, 400]), {rect: [292.5, 100, 15, 300], class: 'iwall'});
});

test('new pieces and lights work before they are edited', () => {
  assert.deepEqual(pieceDefaults('wardrobe2'), {height: 2});
  assert.deepEqual(pieceDefaults('bedsideTable'), {height: 0.5, class: 'furn2'});
  assert.deepEqual(pieceDefaults('bed'), {height: 0.55});
  assert.deepEqual(pieceDefaults('floorLamp'), {class: 'furn2'});
  assert.deepEqual(pieceDefaults('thing'), {height: 0.75});
  assert.deepEqual(pieceFrom(EXAMPLE, 'armchair', {circle: [600, 300, 30]}), {shape: {circle: [600, 300, 30]}, height: 0.8, shadow_room: 'bedroom'});
  assert.equal(roomAt(EXAMPLE, [900, 900]), undefined);
  const lamp = lightFrom(EXAMPLE, [700, 200], 40);
  assert.deepEqual(lamp.pool, {x: 700, y: 200, r: 350, height: 1.5, shadows: ['wardrobe', 'desk', 'deskChair', 'bed', 'bedsideTable']});
  assert.equal(lamp.clip, 'bedroom');
  defineHome({...EXAMPLE, lights: [lamp]});
});

test('items added to a new home go on lines of their own', async () => {
  const {HomeModel} = await import('./model.js');
  const m = new HomeModel(emptyHome(6, 5));
  m.batch([{insert: ['drawing', 'walls'], value: {rect: [0, 0, 600, 25], class: 'wall'}}, {set: ['furniture', 'bed'], value: {shape: {rect: [0, 0, 1, 1]}}},
    {set: ['rooms', 'studio'], value: [[0, 0, 10, 10]]}]);
  assert.match(m.text, /\n {2}walls:\n {4}- \{rect: \[0, 0, 600, 25\], class: wall\}\n/);
  assert.match(m.text, /\nfurniture:\n {2}bed: \{shape: \{rect: \[0, 0, 1, 1\]\}\}\n/);
  assert.match(m.text, /\nrooms:\n {2}studio: \[\[0, 0, 10, 10\]\]\n/);
  // The comments stay.
  assert.match(m.text, /# Light stays inside its room/);
  assert.match(pictureHome('/local/plan.png', 6, 5), /background: \{image: \/local\/plan\.png, rect/);
  assert.deepEqual(pieceDefaults('rug'), {class: 'furn2'});
});
