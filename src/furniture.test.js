import {test} from 'node:test';
import assert from 'node:assert/strict';
import {caster as casterOf, castersIn as castersOf, furnitureClip, furnitureSvg} from './furniture.js';
import {EXAMPLE} from '../scripts/example.mjs';

const FURNITURE = EXAMPLE.furniture, caster = n => casterOf(FURNITURE, n), castersIn = r => castersOf(FURNITURE, r);

test('every piece is drawn and is in the furniture clip', () => {
  const n = Object.keys(FURNITURE).length;
  // + the sofa's back and the bed's two pillows
  assert.equal(furnitureSvg(FURNITURE).match(/class="furn2?"/g).length, n + 3);
  assert.equal(furnitureClip(FURNITURE).match(/<(rect|circle|path)/g).length, n);
});

test("a turned piece's caster is its drawing, turned", () => {
  const [poly, height] = caster('coffeeTable');
  assert.equal(height, 0.45);
  const cx = poly.reduce((t, p) => t + p[0], 0) / 4, cy = poly.reduce((t, p) => t + p[1], 0) / 4;
  assert.ok(Math.abs(cx - 235) < 1e-9 && Math.abs(cy - 460) < 1e-9);
  assert.match(furnitureSvg(FURNITURE), /<g transform="rotate\(20 235 460\)"><rect class="furn" x="190" y="430"/);
});

test('a piece without a height casts no shadow', () => {
  assert.throws(() => caster('floorLamp'), /no furniture casting shadows called floorLamp/);
});

test('the sun shadows: the pieces with a shadow_room, by room', () => {
  assert.equal(castersIn('living').length, 4);
  assert.equal(castersIn('bedroom').length, 5);
  assert.equal(castersIn('terrace').length, 0);
});
