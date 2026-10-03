import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS, TICK, frameAt, hsvRgb, timeline} from './effects.js';
import {EXAMPLE} from '../scripts/example.mjs';

test('hsv to rgb', () => {
  assert.deepEqual(hsvRgb(0, 100), [255, 0, 0]);
  assert.deepEqual(hsvRgb(120, 100), [0, 255, 0]);
  assert.deepEqual(hsvRgb(0, 0), [255, 255, 255]);
});

test("a home's flow fades into each step and holds it, then repeats", () => {
  const tl = timeline('Sunset glow', undefined, EXAMPLE.effects);
  assert.equal(tl.total, 3 * (666 + 5000));
  const hold = frameAt(tl, 666 + 1000);
  assert.deepEqual(hold.color, hsvRgb(25, 90));
  assert.equal(hold.opacity, 0.9);
  assert.equal(hold.next, 4000); // nothing to redraw until the hold ends
  const fading = frameAt(tl, 333);
  assert.equal(fading.next, TICK);
  assert.equal(frameAt(tl, tl.total + 333).opacity, fading.opacity);
});

test('the flicker preset, with quick fades, is there for every home', () => {
  const tl = timeline('flicker');
  assert.equal(tl.total, PRESETS.flicker.steps.reduce((t, s) => t + 250 + s[3], 0));
  assert.equal(frameAt(tl, 200).next, 50);
});

test('an unknown effect pulses in the light colour', () => {
  const tl = timeline('Rainbow', [10, 20, 30]);
  assert.deepEqual(frameAt(tl, 1500).color, [10, 20, 30]);
  assert.equal(frameAt(tl, 1500).opacity, 0.35);
  assert.equal(frameAt(tl, 0).opacity, 1);
  assert.equal(frameAt(tl, 750).opacity, 0.675);
});
