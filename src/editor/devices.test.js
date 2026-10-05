import test from 'node:test';
import assert from 'node:assert/strict';
import {defineHome} from '../home.js';
import {HomeModel, yamlOf} from './model.js';
import {devicesIn, iconOf, placeDevice, placedIn} from './devices.js';

const STATES = {
  'light.sofa': {state: 'on', attributes: {friendly_name: 'Sofa lamp'}},
  'cover.blind': {state: 'open', attributes: {friendly_name: 'Blind', device_class: 'blind'}},
  'sensor.temp': {state: '21.4', attributes: {friendly_name: 'Temperature', device_class: 'temperature', unit_of_measurement: '°C'}},
  'switch.fan': {state: 'off', attributes: {friendly_name: 'Fan plug', icon: 'mdi:fan'}},
  'automation.x': {state: 'on', attributes: {}},
};
const HOME = {view: {x: 0, y: 0, w: 600, h: 500}, units_per_metre: 100, rooms: {living: [[0, 0, 500, 400]]},
  furniture: {sofa: {shape: {rect: [100, 300, 200, 80]}, height: 0.8, shadow_room: 'living'}},
  openings: [{wall: 'bottom', at: 425, depth: 25, x: 190, w: 120, lo: 0.9, hi: 2.2, room: 'living'}], sun: {north: 0}};
const place = (data, id, p, tol) => {
  const model = new HomeModel(yamlOf(data));
  const made = placeDevice(model.data, id, STATES[id], p, tol);
  model.batch(made.ops);
  assert.deepEqual(model.errors, []);
  defineHome(model.data);
  return {data: model.data, made};
};

test('the palette lists devices by domain, searchable, with their icons', () => {
  assert.deepEqual(devicesIn(STATES).map(d => d.id), ['light.sofa', 'switch.fan', 'cover.blind', 'sensor.temp']);
  assert.deepEqual(devicesIn(STATES, 'lamp').map(d => d.id), ['light.sofa']);
  assert.equal(iconOf('sensor.temp', STATES['sensor.temp']), 'mdi:thermometer');
  assert.equal(iconOf('switch.fan', STATES['switch.fan']), 'mdi:fan');
  assert.equal(iconOf('sensor.t', {state: '20', attributes: {unit_of_measurement: '°C'}}), 'mdi:thermometer');
});

test('a light becomes a lamp with its marker, one object; a sensor shows its value', () => {
  const {data, made} = place(HOME, 'light.sofa', [200, 200]);
  assert.equal(made.what, 'lamp');
  assert.deepEqual(data.lights[0].entities, ['light.sofa']);
  assert.deepEqual(data.lights[0].pool.shadows, ['sofa']);
  assert.equal(data.lights[0].part, data.markers[0].part);
  assert.equal(data.markers[0].tap, 'toggle');
  assert.deepEqual([...placedIn(data)], ['light.sofa']);
  const sensor = place(data, 'sensor.temp', [400, 100]).data.markers[1];
  assert.deepEqual(sensor.label, {round: 1, unit: '°'});
});

test('a cover dropped on a window is its shutter; elsewhere, a marker', () => {
  assert.equal(place(HOME, 'cover.blind', [250, 410], 20).data.openings[0].shutter, 'cover.blind');
  const away = place(HOME, 'cover.blind', [250, 100], 20);
  assert.equal(away.made.what, 'marker');
  assert.equal(away.data.openings[0].shutter, undefined);
});
