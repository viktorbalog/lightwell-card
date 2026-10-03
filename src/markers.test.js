import {test} from 'node:test';
import assert from 'node:assert/strict';
import {iconOf, isActive, labelOf} from './markers.js';

const st = (state, attributes = {}) => ({state, attributes});

test('labels: a rounded attribute, the state, another entity, only in some states, hidden values', () => {
  assert.equal(labelOf({label: {attribute: 'temperature', round: 0, unit: '°'}}, st('cool', {temperature: 22.6})), '23°');
  assert.equal(labelOf({label: {round: 0, unit: '°'}}, st('21.4')), '21°');
  assert.equal(labelOf({label: {round: 0, unit: '°'}}, st('unavailable')), '');
  assert.equal(labelOf({label: {entity: 'sensor.lux', round: 0, unit: ' lx'}}, st('on'), {'sensor.lux': st('8.2')}), '8 lx');
  assert.equal(labelOf({label: {entity: 'sensor.gone', unit: ' lx'}}, st('on'), {}), '');
  assert.equal(labelOf({label: {attribute: 'source', when: ['on']}}, st('on', {source: 'YouTube'})), 'YouTube');
  assert.equal(labelOf({label: {attribute: 'source', when: ['on']}}, st('off', {source: 'YouTube'})), '');
  assert.equal(labelOf({label: {hide: ['idle', 'unavailable']}}, st('idle')), '');
  assert.equal(labelOf({label: {hide: ['idle', 'unavailable']}}, st('Hades')), 'Hades');
  assert.equal(labelOf({label: {attribute: 'current_position', unit: '%'}}, st('open', {current_position: 100})), '100%');
  assert.equal(labelOf({label: {attribute: 'current_position', unit: '%'}}, st('open')), '');
  assert.equal(labelOf({label: {round: 1}}, st('-0.04')), '0.0');
  assert.equal(labelOf({}, st('on')), '');
});

test('icons: per state, weather by its condition, or the plain one', () => {
  assert.equal(iconOf({entity: 'weather.home', icon: 'mdi:x'}, st('rainy')), 'mdi:weather-rainy');
  assert.equal(iconOf({entity: 'weather.home', icon: 'mdi:x'}, st('odd')), 'mdi:help-circle-outline');
  assert.equal(iconOf({entity: 'lock.door', icon: 'mdi:lock', icons: {unlocked: 'mdi:lock-open'}}, st('unlocked')), 'mdi:lock-open');
  assert.equal(iconOf({entity: 'lock.door', icon: 'mdi:lock', icons: {unlocked: 'mdi:lock-open'}}, st('locked')), 'mdi:lock');
});

test('on: listed states, or anything but off-like states, never a sensor, not while powered off', () => {
  assert.equal(isActive({entity: 'entity_controller.x', active: ['active']}, st('active'), true), true);
  assert.equal(isActive({entity: 'entity_controller.x', active: ['active']}, st('idle'), true), false);
  assert.equal(isActive({entity: 'light.x'}, st('on'), true), true);
  assert.equal(isActive({entity: 'light.x'}, st('on'), false), false);
  assert.equal(isActive({entity: 'cover.x'}, st('closed'), true), false);
  assert.equal(isActive({entity: 'sensor.x'}, st('12'), true), false);
});
