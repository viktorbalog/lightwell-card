// Shapes and shadows in a home's drawing, in its own units (see home.js).

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// A rectangle's corners, turned by `deg` around its centre.
export const box = (x, y, w, h, deg = 0) => {
  const cx = x + w / 2, cy = y + h / 2, a = deg * Math.PI / 180;
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) =>
    [cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a), cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a)]);
};

// A circle as a 12-sided polygon.
export const round = (cx, cy, r) =>
  Array.from({length: 12}, (_, k) => [cx + r * Math.cos(k * Math.PI / 6), cy + r * Math.sin(k * Math.PI / 6)]);

// A polygon as an SVG points attribute.
export const points = ps => ps.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');

// A clip region ([x, y, w, h] rectangles, or one polygon [[x, y], ...]) as SVG shapes.
export const clipShapes = region => (Array.isArray(region[0][0])
  ? `<polygon points="${region[0].map(p => p.join(',')).join(' ')}"/>`
  : region.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join(''));

// The polygons covering what each edge of `poly` sweeps when moved by `move(point)`: together, the shadow behind it.
const sweep = (poly, move) => poly.map((a, k) => {
  const b = poly[(k + 1) % poly.length];
  return `<polygon points="${points([a, b, move(b), move(a)])}"/>`;
}).join('');

// The shadow a polygon casts from a point light at (x, y): each point pushed away from the light by `k` times its
// distance.
export const shadowOf = (poly, x, y, k) => sweep(poly, ([px, py]) => [px + (px - x) * k, py + (py - y) * k]);

// The shadow a polygon casts in parallel light (the sun): each point moved by (dx, dy).
export const castAlong = (poly, dx, dy) => sweep(poly, ([px, py]) => [px + dx, py + dy]);
