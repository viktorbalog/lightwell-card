import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ends, openingErrors, shutterRect, skyEllipse} from './openings.js';

const bottom = {wall: 'bottom', at: 650, depth: 25, x: 140, w: 220, lo: 0, hi: 2};

test('an opening on the bottom wall', () => {
  assert.deepEqual(ends(bottom), [[140, 650], [360, 650]]);
  assert.deepEqual(shutterRect(bottom), [140, 625, 220, 25]);
  // At the scale the sizes were tuned on (175 units per metre): 28 inside, 1000 along, 1450 into the room.
  assert.deepEqual(skyEllipse(bottom, 175), [250, 622, 1000, 1450]);
});

test('openings on the other walls: the shutter inside the wall, the daylight reaching into the room', () => {
  assert.deepEqual(shutterRect({wall: 'top', at: 100, depth: 40, x: 10, w: 50}), [10, 100, 50, 40]);
  assert.deepEqual(shutterRect({wall: 'left', at: 100, depth: 40, y: 10, h: 50}), [100, 10, 40, 50]);
  assert.deepEqual(shutterRect({wall: 'right', at: 900, depth: 40, y: 10, h: 50}), [860, 10, 40, 50]);
  assert.deepEqual(skyEllipse({wall: 'left', at: 100, y: 0, h: 100}, 175), [128, 50, 1450, 1000]);
  assert.deepEqual(skyEllipse({wall: 'top', at: 100, x: 0, w: 100}, 35), [50, 105.6, 200, 290]);
});

test('an opening needs its wall and span', () => {
  assert.deepEqual(openingErrors({wall: 'front'}), ['needs wall: top, bottom, left or right']);
  assert.deepEqual(openingErrors({wall: 'left', at: 1, depth: 1, lo: 0, hi: 2, x: 5, w: 5}), ['needs a number y', 'needs a number h']);
});
