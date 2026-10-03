// A home's openings: windows and doors on any axis-aligned outer wall, where the sun and daylight come in.
//
// An opening: `wall` (top, bottom, left or right: the side of the drawing its wall faces out to), `at` (the wall's
// outer face: a y for top and bottom, an x for left and right), `depth` (the wall's thickness), and its span along
// the wall: `x` and `w` on a top or bottom wall, `y` and `h` on a left or right one. `lo`/`hi`: the glass from and
// to that many metres above the floor; `shutter`: a cover entity; `room`: the room whose floor its sun patch falls
// on; `sky`: the room its daylight spreads over (default: `room`).

// Each wall side's outward direction in the drawing (+y is down).
export const SIDES = {top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0]};
export const isHorizontal = o => o.wall === 'top' || o.wall === 'bottom';

// The opening's two ends on the wall's outer face.
export const ends = o => (isHorizontal(o) ? [[o.x, o.at], [o.x + o.w, o.at]] : [[o.at, o.y], [o.at, o.y + o.h]]);

// The shutter, as a rectangle [x, y, w, h] filling the wall's thickness.
export function shutterRect(o) {
  const [dx, dy] = SIDES[o.wall], inner = o.at - o.depth * (dx || dy);
  const lo = Math.min(o.at, inner);
  return isHorizontal(o) ? [o.x, lo, o.w, o.depth] : [lo, o.y, o.depth, o.h];
}

// The daylight through it: an ellipse [cx, cy, rx, ry] centred just inside the wall's outer face, reaching about
// 8.3 m into the room and 5.7 m along the wall either way (clipped to its `sky` room), in the drawing's units.
const SKY = {inset: 28, along: 1000, inward: 1450}; // at 175 units per metre
export function skyEllipse(o, unitsPerMetre) {
  const k = v => Math.round(v * unitsPerMetre / 175 * 10) / 10, [dx, dy] = SIDES[o.wall];
  const [[x0, y0], [x1, y1]] = ends(o), cx = (x0 + x1) / 2 - dx * k(SKY.inset), cy = (y0 + y1) / 2 - dy * k(SKY.inset);
  return isHorizontal(o) ? [cx, cy, k(SKY.along), k(SKY.inward)] : [cx, cy, k(SKY.inward), k(SKY.along)];
}

// What's wrong with an opening's geometry, if anything (for defineHome).
export function openingErrors(o) {
  if (!SIDES[o.wall]) return ['needs wall: top, bottom, left or right'];
  const keys = ['at', 'depth', 'lo', 'hi', ...(isHorizontal(o) ? ['x', 'w'] : ['y', 'h'])];
  return keys.filter(k => typeof o[k] !== 'number').map(k => `needs a number ${k}`);
}
