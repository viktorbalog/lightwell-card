import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defineHome, entitiesOf} from './home.js';

// The smallest valid home: one room, one opening, one piece of furniture, one light and one marker.
const base = () => ({
  view: {x: 0, y: 0, w: 100, h: 100}, units_per_metre: 10,
  rooms: {room: [[0, 0, 100, 90]]},
  drawing: {walls: [{rect: [0, 90, 100, 10], class: 'wall'}]},
  openings: [{wall: 'bottom', x: 10, w: 20, at: 100, depth: 10, lo: 0, hi: 2, shutter: 'cover.blind', room: 'room', sky: 'room'}],
  furniture: {table: {shape: {rect: [40, 40, 10, 10]}, height: 0.7, shadow_room: 'room'}},
  lights: [{entities: ['light.lamp'], shape: [{circle: [5, 5, 5]}], clip: 'room',
    pool: {x: 5, y: 5, r: 50, height: 1.5, shadows: ['table']}}],
  markers: [{entity: 'light.lamp', x: 5, y: 5, icon: 'mdi:lamp', label: {entity: 'sensor.lux', unit: ' lx'}}],
  sun: {north: 0, spill: [{cx: 0, cy: 0, rx: 1, ry: 1, clip: 'room', from: [0], k: 1}]},
});
const invalid = (change, message) => {
  const h = base();
  change(h);
  assert.throws(() => defineHome(h), e => e.message.includes(message), message);
};

test('a valid home gets its defaults', () => {
  const h = defineHome({...base(), effects: undefined});
  assert.deepEqual(h.effects, {});
  assert.deepEqual(h.sun.blockers, []);
  assert.equal(h.sun.trees, null);
  assert.equal(h.sun.entity, 'sun.sun');
  assert.deepEqual(h.palette, {light: {}, dark: {}, tinted: []});
  const noSky = base();
  delete noSky.openings[0].sky;
  assert.equal(defineHome(noSky).openings[0].sky, 'room');
});

test('every name must refer to something that exists', () => {
  invalid(h => { h.view = {x: 0}; }, 'view: needs numbers x, y, w and h');
  invalid(h => { h.units_per_metre = 0; }, 'units_per_metre: needs a number above 0');
  invalid(h => { h.drawing.roof = []; }, 'drawing.roof: isn\'t a slot');
  invalid(h => { h.drawing.walls = [{class: 'wall'}]; }, 'drawing.walls[0]: needs exactly one of');
  invalid(h => { h.drawing.background = {}; }, 'drawing.background: needs an image URL');
  invalid(h => { h.furniture.table.shape = {}; }, 'furniture.table: needs a shape');
  invalid(h => { h.furniture.table.shadow_room = 'attic'; }, 'furniture.table.shadow_room: no room called "attic"');
  invalid(h => { h.furniture.table.extra = [{}]; }, 'furniture.table.extra[0]: needs exactly one of');
  invalid(h => { h.openings[0].wall = 'front'; }, 'openings[0]: needs wall: top, bottom, left or right');
  invalid(h => { h.openings[0].wall = 'left'; }, 'openings[0]: needs a number y');
  invalid(h => { delete h.openings[0].at; }, 'openings[0]: needs a number at');
  invalid(h => { h.openings[0].sky = 'attic'; }, 'openings[0].sky: no room called "attic"');
  invalid(h => { delete h.openings[0].room; delete h.openings[0].sky; }, 'openings[0]: needs the room its sun falls in');
  invalid(h => { h.openings[0].shutter = 'Blind'; }, 'openings[0].shutter: "Blind" isn\'t an entity id');
  invalid(h => { h.lights[0].entities = []; }, 'lights[0]: needs entities, or lit');
  invalid(h => { h.lights[0].lit = 'sometimes'; }, 'lights[0].lit: needs always, dark, never');
  invalid(h => { h.lights[0].shape = undefined; }, 'lights[0]: needs a shape');
  invalid(h => { h.lights[0].shape = [{}]; }, 'lights[0].shape[0]: needs exactly one of');
  invalid(h => { delete h.lights[0].pool.height; }, 'lights[0].pool: needs a number height');
  invalid(h => { h.furniture.table.height = -1; }, 'furniture.table.height: needs a number of metres above 0');
  invalid(h => { h.lights[0].clip = 'attic'; }, 'lights[0].clip: no room called "attic"');
  invalid(h => { h.lights[0].pool.shadows = ['sofa']; }, 'lights[0].pool.shadows: no furniture with a height called "sofa"');
  invalid(h => { delete h.markers[0].icon; }, 'markers[0]: needs an icon');
  invalid(h => { h.markers[0].x = '5'; }, 'markers[0]: needs a number x');
  invalid(h => { h.markers[0].power = 'on'; }, 'markers[0].power: "on" isn\'t an entity id');
  invalid(h => { h.markers[0].label = s => s.state; }, 'markers[0].label: needs settings');
  invalid(h => { h.markers[0].label = {units: '°'}; }, 'markers[0].label: unknown setting "units"');
  invalid(h => { h.markers[0].label = {entity: 'lux'}; }, 'markers[0].label.entity: "lux" isn\'t an entity id');
  invalid(h => { h.markers[0].label = {when: 'on'}; }, 'markers[0].label.when: needs a list');
  invalid(h => { h.markers[0].active = 'on'; }, 'markers[0].active: needs a list of states');
  invalid(h => { h.sun.blockers = [{rect: [0, 0, 1, 1]}]; }, 'sun.blockers[0]: needs a height in metres');
  invalid(h => { delete h.sun.north; }, 'sun.north: needs the compass bearing of the top of the drawing');
  invalid(h => { h.sun.weather = 'Home'; }, 'sun.weather: "Home" isn\'t an entity id');
  invalid(h => { h.sun.outdoor = [{}]; }, 'sun.outdoor[0]: needs exactly one of');
  invalid(h => { h.palette = {light: {tiles: 4}}; }, 'palette.light.tiles: needs a colour');
  invalid(h => { h.simulator = {scenes: {Dusk: 'Evening'}}; }, 'simulator.scenes.Dusk: no scene called "Evening"');
  invalid(h => { h.simulator = {scenes: {Night: {lights: true}}}; }, "simulator.scenes.Night.lights: needs 'on' or 'off'");
  invalid(h => { h.palette = {light: {tiles: 'red'}, tinted: ['tiles']}; }, 'palette.tinted: "tiles" needs #rrggbb colours');
  invalid(h => { h.sun.spill[0].from = [3]; }, 'sun.spill[0].from: no opening 3');
});

test('descriptions are notes: any text, on the home and its items, and nothing else', () => {
  const h = base();
  h.description = 'A test flat';
  for (const item of [h.openings[0], h.furniture.table, h.lights[0], h.markers[0], h.sun.spill[0], h.drawing.walls[0]]) item.description = 'A note';
  assert.doesNotThrow(() => defineHome(h));
  invalid(h => { h.description = 42; }, 'description: needs a text');
  invalid(h => { h.openings[0].description = ['a']; }, 'openings[0].description: needs a text');
  invalid(h => { h.furniture.table.description = 1; }, 'furniture.table.description: needs a text');
  invalid(h => { h.lights[0].description = true; }, 'lights[0].description: needs a text');
  invalid(h => { h.markers[0].description = {}; }, 'markers[0].description: needs a text');
  invalid(h => { h.sun.spill[0].description = 0; }, 'sun.spill[0].description: needs a text');
  invalid(h => { h.sun.blockers = [{rect: [0, 0, 1, 1], height: 2, description: 2}]; }, 'sun.blockers[0].description: needs a text');
  invalid(h => { h.drawing.walls[0].description = 3; }, 'drawing.walls[0].description: needs a text');
});

test('parts name the Build object an item was made as: any text', () => {
  const h = base();
  for (const item of [h.openings[0], h.furniture.table, h.lights[0], h.markers[0], h.drawing.walls[0]]) item.part = 'window_1';
  assert.doesNotThrow(() => defineHome(h));
  invalid(h => { h.openings[0].part = 1; }, 'openings[0].part: needs a text');
  invalid(h => { h.drawing.walls[0].part = ['a']; }, 'drawing.walls[0].part: needs a text');
});

test('all the errors are listed at once', () => {
  const h = base();
  h.lights[0].clip = 'attic';
  h.markers[0].icon = '';
  assert.throws(() => defineHome(h), e => e.message.split('\n').length === 3);
});

test('the entities: lights, markers with what they read, shutters, the sun and weather', () => {
  assert.deepEqual(entitiesOf(defineHome(base())), ['light.lamp', 'sensor.lux', 'cover.blind', 'sun.sun', 'weather.home']);
  const h = base();
  h.sun.weather = 'weather.forecast_home';
  assert.equal(entitiesOf(defineHome(h)).at(-1), 'weather.forecast_home');
});

test('a light without entities is lit always, while the sun is down, or never', () => {
  const h = base();
  h.lights.push({lit: 'dark', shape: [{circle: [50, 50, 5]}], color: [255, 200, 120]});
  const home = defineHome(h);
  assert.equal(home.lights[1].lit, 'dark');
  assert.ok(!entitiesOf(home).includes(undefined));
});
