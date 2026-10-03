import {test} from 'node:test';
import assert from 'node:assert/strict';
import {box, castAlong, clipShapes, points, shadowOf} from './geometry.js';

const near = (a, b) => a.flat().forEach((v, i) => assert.ok(Math.abs(v - b.flat()[i]) < 1e-9, `${a} ≠ ${b}`));

test('box turns a rectangle around its centre', () => {
  near(box(0, 0, 10, 4), [[0, 0], [10, 0], [10, 4], [0, 4]]);
  near(box(0, 0, 10, 4, 90), [[7, -3], [7, 7], [3, 7], [3, -3]]);
});

test('shadows sweep each edge', () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.equal(shadowOf(sq, -1, 0, 1).match(/<polygon/g).length, 4);
  assert.match(castAlong(sq, 2, 0), /points="0\.0,0\.0 1\.0,0\.0 3\.0,0\.0 2\.0,0\.0"/);
});

test('clip regions: rectangles or one polygon', () => {
  assert.equal(clipShapes([[1, 2, 3, 4]]), '<rect x="1" y="2" width="3" height="4"/>');
  assert.equal(clipShapes([[[0, 0], [1, 0], [1, 1]]]), '<polygon points="0,0 1,0 1,1"/>');
  assert.equal(points([[1, 2.25]]), '1.0,2.3');
});
