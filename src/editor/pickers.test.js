import test from 'node:test';
import assert from 'node:assert/strict';
import {attributesOf, entityChoices, entityNote, hexHs, hsHex, labelPreview, searchIcons} from './pickers.js';

const at = (state, attributes = {}) => ({state, attributes});
const STATES = {
  'switch.fan': at('off', {friendly_name: 'Fan'}),
  'light.lamp': at('on', {friendly_name: 'Lamp', brightness: 200}),
  'sensor.temp': at('21.46', {friendly_name: 'Temperature', unit_of_measurement: '°C'}),
  'media_player.tv': at('playing', {friendly_name: 'TV', source: 'Netflix'}),
};

test("entities: a field's domains first, with their names and states", () => {
  assert.deepEqual(entityChoices(STATES, ['light', 'media_player']).map(c => [c.id, c.fits]),
    [['light.lamp', true], ['media_player.tv', true], ['sensor.temp', false], ['switch.fan', false]]);
  assert.deepEqual(entityChoices(STATES, 'sensor')[0], {id: 'sensor.temp', name: 'Temperature', state: '21.46', fits: true});
  assert.equal(entityNote(STATES, 'light.lamp'), 'Lamp · on');
  assert.equal(entityNote(STATES, 'light.nope'), 'not in the states in use');
  assert.equal(entityNote({}, 'light.nope'), '');
});

test("a label's attributes and the text it shows now", () => {
  assert.deepEqual(attributesOf(STATES['media_player.tv']), ['source', 'friendly_name']);
  assert.deepEqual(labelPreview({entity: 'sensor.temp', label: {round: 1, unit: '°'}}, STATES), {text: '21.5°', why: ''});
  assert.deepEqual(labelPreview({entity: 'media_player.tv', label: {attribute: 'source'}}, STATES), {text: 'Netflix', why: ''});
  assert.match(labelPreview({entity: 'media_player.tv', label: {attribute: 'source', when: ['on']}}, STATES).why, /only while media_player\.tv is on \(it's playing\)/);
  assert.match(labelPreview({entity: 'light.lamp', label: {attribute: 'brightness', entity: 'sensor.nope'}}, STATES).why, /sensor\.nope isn't in the states/);
  assert.match(labelPreview({entity: 'sensor.nope', label: {}}, STATES).why, /isn't in the states/);
  assert.match(labelPreview({entity: 'media_player.tv', label: {attribute: 'source', round: 0}}, STATES).why, /not a number/);
});

test('icons by name, then alias and tag', () => {
  const list = [{name: 'lamp'}, {name: 'floor-lamp', aliases: ['standing-lamp']}, {name: 'lightbulb', aliases: ['lamp-bulb']},
    {name: 'sofa', tags: ['Home Automation']}, {name: 'lamps'}];
  assert.deepEqual(searchIcons(list, 'lamp'), ['lamp', 'lamps', 'floor-lamp', 'lightbulb']);
  assert.deepEqual(searchIcons(list, 'mdi:sof'), ['sofa']);
  assert.deepEqual(searchIcons(list, 'automation'), ['sofa']);
  assert.deepEqual(searchIcons(list, ''), []);
});

test("an effect step's colour and back", () => {
  assert.equal(hsHex(0, 100), '#ff0000');
  assert.equal(hsHex(120, 0), '#ffffff');
  assert.deepEqual(hexHs('#ff0000'), [0, 100]);
  for (const [h, s] of [[25, 90], [215, 25], [300, 60]]) {
    const [h2, s2] = hexHs(hsHex(h, s));
    assert.ok(Math.abs(h2 - h) <= 2 && Math.abs(s2 - s) <= 1, `${h},${s} → ${h2},${s2}`);
  }
  // A darker colour picked: its hue and saturation, the brightness stays the step's.
  assert.deepEqual(hexHs('#800000'), [0, 100]);
});
