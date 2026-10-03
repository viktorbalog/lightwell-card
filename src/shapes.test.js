import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shapeErrors, shapesSvg} from './shapes.js';

test('shapes become SVG, with their attributes', () => {
  assert.equal(shapesSvg([{rect: [1, 2, 3, 4], class: 'wall', rx: 2}]), '<rect class="wall" rx="2" x="1" y="2" width="3" height="4"/>');
  assert.equal(shapesSvg([{circle: [1, 2, 3]}, {ellipse: [1, 2, 3, 4]}]),
    '<circle cx="1" cy="2" r="3"/><ellipse cx="1" cy="2" rx="3" ry="4"/>');
  assert.equal(shapesSvg([{poly: [[0, 0], [1, 2]], fill: '#fff'}]), '<polygon fill="#fff" points="0,0 1,2"/>');
  assert.equal(shapesSvg([{path: 'M0,0 h5', stroke_width: 6}]), '<path stroke-width="6" d="M0,0 h5"/>');
  assert.equal(shapesSvg([{text: 'A & <B>', at: [5, 6], class: 'room'}]), '<text class="room" x="5" y="6">A &amp; &lt;B&gt;</text>');
  assert.equal(shapesSvg([{svg: '<g/>'}]), '<g/>');
  assert.equal(shapesSvg('<g/>'), '<g/>');
  assert.equal(shapesSvg(undefined), '');
});

test('a shape needs exactly one kind', () => {
  assert.deepEqual(shapeErrors([{rect: [0, 0, 1, 1]}, {class: 'x'}, {rect: [0, 0, 1, 1], circle: [0, 0, 1]}, {text: 'a'}]), [
    '[1]: needs exactly one of rect, circle, ellipse, poly, path, text or svg',
    '[2]: needs exactly one of rect, circle, ellipse, poly, path, text or svg',
    '[3]: a text needs at: [x, y]',
  ]);
  assert.deepEqual(shapeErrors({}), ['needs a list of shapes']);
});

test('a repeated shape: copies along a step, list attributes in turn', () => {
  assert.equal(shapesSvg([{circle: [0, 10, 2], repeat: {count: 3, step: [5, -1]}, fill: ['#a', '#b']}]),
    '<circle fill="#a" cx="0" cy="10" r="2"/><circle fill="#b" cx="5" cy="9" r="2"/><circle fill="#a" cx="10" cy="8" r="2"/>');
  assert.equal(shapesSvg([{path: 'M0,0 h1', repeat: {count: 2, step: [3, 0]}}]),
    '<path transform="translate(0 0)" d="M0,0 h1"/><path transform="translate(3 0)" d="M0,0 h1"/>');
  assert.deepEqual(shapeErrors([{circle: [0, 0, 1], repeat: {count: 2}}]), ['[0]: repeat needs a count and step: [dx, dy]']);
});
