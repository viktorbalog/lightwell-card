// Drawing new items, and starting new homes: pure functions from what the pointer drew (points in the drawing's
// units) and the home's plain data to the new item, with defaults that work before it's edited.
import {SLOTS} from '../home.js';
import {inPoly, regionPolys} from './hit.js';
import {tidy} from './manipulate.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// A new home's YAML: an empty one `w` × `h` metres at `unitsPerMetre`, with a margin of 20 cm around it.
export function emptyHome(w, h, unitsPerMetre = 100) {
  const u = v => tidy(v * unitsPerMetre), m = u(0.2);
  return `# A home for Lightwell, started in its editor: ${w} × ${h} m at ${unitsPerMetre} units per metre. Every field is
# described in the README.

view: {x: ${-m}, y: ${-m}, w: ${u(w) + 2 * m}, h: ${u(h) + 2 * m}}
units_per_metre: ${unitsPerMetre}

# Light stays inside its room: rectangles [x, y, w, h], or one polygon.
rooms: {}

drawing:
  floors: []
  walls: []
  glazing: []
  labels: []

# Windows and doors: where the sun and daylight come in.
openings: []

furniture: {}

lights: []

markers: []

sun:
  # The compass bearing the top of the plan faces (0: north).
  north: 0
`;
}

// A new home over a picture of its plan, `w` × `h` pixels, drawn in its pixels: the scale is set once a known length
// has been measured on it (scaleFrom).
export function pictureHome(image, w, h) {
  return emptyHome(1, 1).replace(/view: .*\nunits_per_metre: .*/, `view: {x: 0, y: 0, w: ${w}, h: ${h}}
# Units are the picture's pixels: this many make a metre.
units_per_metre: 100`)
    .replace(/^# A home for Lightwell.*\n# described.*\n/, `# A home for Lightwell, drawn over a picture of its plan (${image}): in Home Assistant, put the picture
# under /config/www/. Every field is described in the README.\n`)
    .replace('drawing:\n', `drawing:\n  background: {image: ${/^[\w/.-]+$/.test(image) ? image : JSON.stringify(image)}, rect: [0, 0, ${w}, ${h}]}\n`);
}

// The scale from a line from `a` to `b` that is `metres` long: units per metre, to a hundredth.
export const scaleFrom = (a, b, metres) => Math.round(dist(a, b) / metres * 100) / 100;

// The room a point is in (the last listed wins, as the topmost), or undefined.
export function roomAt(data, p) {
  const rooms = Object.entries(data?.rooms || {});
  return rooms.reverse().find(([, region]) => regionPolys(region).some(poly => inPoly(poly, p)))?.[0];
}

// The rectangles that are outer walls: those in the walls slot (but interior ones, class iwall), and any of class
// wall elsewhere.
export function wallRects(data) {
  return SLOTS.flatMap(slot => (Array.isArray(data?.drawing?.[slot]) ? data.drawing[slot] : [])
    .filter(s => Array.isArray(s?.rect) && (s.class === 'wall' || (slot === 'walls' && s.class !== 'iwall')))
    .map(s => s.rect));
}

// The outer wall an opening dragged from `a` to `b` is in: {wall, at, depth, room, from, to} (from and to: its span
// along the wall), or null. The wall is the outer-wall rectangle running the drag's way whose thickness the drag runs
// in (within `tol`), nearest along it: a door is usually a gap between two wall rectangles. Its outside is the side
// with no room; failing that, the side away from the middle of the rooms (or of the view).
export function inferWall(data, a, b, tol = 0) {
  const along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1, across = 1 - along;
  const mid = (a[across] + b[across]) / 2, from = Math.min(a[along], b[along]), to = Math.max(a[along], b[along]);
  let best = null;
  for (const r of wallRects(data)) {
    const lo = [r[0], r[1]], size = [r[2], r[3]];
    if (size[along] < size[across]) continue;
    if (mid < lo[across] - tol || mid > lo[across] + size[across] + tol) continue;
    const gap = Math.max(0, lo[along] - to, from - (lo[along] + size[along]));
    if (!best || gap < best.gap) best = {gap, lo: lo[across], hi: lo[across] + size[across]};
  }
  if (!best) return null;
  const probe = v => { const p = [0, 0]; p[along] = (from + to) / 2; p[across] = v; return roomAt(data, p); };
  const eps = Math.max(tol, 1) + 1, before = probe(best.lo - eps), after = probe(best.hi + eps);
  let outsideBefore;
  if (after && !before) outsideBefore = true;
  else if (before && !after) outsideBefore = false;
  else {
    const polys = Object.values(data?.rooms || {}).flatMap(regionPolys).flat();
    const v = data?.view, centre = polys.length ? polys.reduce((s, p) => s + p[across], 0) / polys.length
      : v ? (across ? v.y + v.h / 2 : v.x + v.w / 2) : 0;
    outsideBefore = centre > (best.lo + best.hi) / 2;
  }
  const wall = along === 0 ? (outsideBefore ? 'top' : 'bottom') : (outsideBefore ? 'left' : 'right');
  return {wall, at: tidy(outsideBefore ? best.lo : best.hi), depth: tidy(best.hi - best.lo), room: outsideBefore ? after : before,
    from: tidy(from), to: tidy(to)};
}

// Glass heights by kind of opening, in metres above the floor.
export const OPENING_KINDS = {window: {lo: 0.9, hi: 2.2}, door: {lo: 0, hi: 2.1}};

// An opening dragged from `a` to `b` along an outer wall, and its glass for the glazing slot: {opening, glass}, or
// null when there's no outer wall there. The glass is a pane 40 % of the wall's thickness, in its middle.
export function openingFrom(data, a, b, {tol = 0, kind = 'window'} = {}) {
  const w = inferWall(data, a, b, tol);
  if (!w || w.to - w.from < 1) return null;
  const horizontal = w.wall === 'top' || w.wall === 'bottom', inner = w.wall === 'top' || w.wall === 'left' ? w.at : w.at - w.depth;
  const pane = tidy(w.depth * 0.4), offset = tidy(inner + (w.depth - pane) / 2), len = tidy(w.to - w.from);
  const opening = {wall: w.wall, at: w.at, depth: w.depth, ...(horizontal ? {x: w.from, w: len} : {y: w.from, h: len}),
    ...OPENING_KINDS[kind], ...(w.room ? {room: w.room} : {})};
  const glass = {rect: horizontal ? [w.from, offset, len, pane] : [offset, w.from, pane, len], class: 'glass'};
  return {opening, glass};
}

// A wall dragged from `a` to `b`: the box between them, or, when that's thinner than half of `thickness`, a wall
// `thickness` thick along the longer way, centred on the line. Interior walls (iwall) are those drawn inside a room.
export function wallFrom(data, a, b, {thickness, inner} = {}) {
  const [x0, y0, x1, y1] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  const inside = inner ?? !!(roomAt(data, a) && roomAt(data, b) && roomAt(data, [(x0 + x1) / 2, (y0 + y1) / 2]));
  const t = thickness ?? (data?.units_per_metre || 100) * (inside ? 0.15 : 0.25);
  let rect;
  if (x1 - x0 >= t / 2 && y1 - y0 >= t / 2) rect = [x0, y0, x1 - x0, y1 - y0];
  else if (x1 - x0 >= y1 - y0) rect = [x0, (y0 + y1) / 2 - t / 2, x1 - x0, t];
  else rect = [(x0 + x1) / 2 - t / 2, y0, t, y1 - y0];
  return {rect: rect.map(tidy), class: inside ? 'iwall' : 'wall'};
}

// A piece's height (m) and class by the words in its name: a bed is low, a wardrobe tall, a chair small.
const PIECES = [
  [/wardrobe|closet|cupboard|shel(f|v)|bookcase|cabinet|fridge|dresser/i, 2, 'furn'],
  [/bedside|night/i, 0.5, 'furn2'],
  [/sofa|couch|armchair/i, 0.8, 'furn'],
  [/chair|stool|pouf|ottoman/i, 0.9, 'furn2'],
  [/bed/i, 0.55, 'furn'],
  [/coffee|side/i, 0.45, 'furn'],
  [/tv|media|sideboard|bench/i, 0.5, 'furn'],
  [/lamp|plant|rug|carpet|mat\b/i, null, 'furn2'],
  [/table|desk|counter|island/i, 0.75, 'furn'],
];
export function pieceDefaults(name) {
  const [, height, cls] = PIECES.find(([re]) => re.test(name)) || [null, 0.75, 'furn'];
  return {...(height ? {height} : {}), ...(cls !== 'furn' ? {class: cls} : {})};
}

// A new piece called `name` with `shape` ({rect}, {circle} or {poly}): its height and class from its name, and the
// room it's in as the one its shadow stays in.
export function pieceFrom(data, name, shape) {
  const c = shape.rect ? [shape.rect[0] + shape.rect[2] / 2, shape.rect[1] + shape.rect[3] / 2] : shape.circle
    ? shape.circle.slice(0, 2) : shape.poly[0];
  const d = pieceDefaults(name), room = roomAt(data, c);
  return {shape, ...d, ...(d.height && room ? {shadow_room: room} : {})};
}

// A new lamp at `c` with a glow of radius `r`: lit by a light entity to be chosen, over the furniture, kept in its
// room, with a pool 3.5 m wide 1.5 m up in which the room's pieces with a height cast shadows.
export function lightFrom(data, c, r) {
  const m = data?.units_per_metre || 100, room = roomAt(data, c), [x, y] = c.map(tidy);
  const shadows = Object.entries(data?.furniture || {}).filter(([, p]) => p?.height && (!room || p.shadow_room === room)).map(([n]) => n);
  return {entities: ['light.new_light'], shape: [{circle: [x, y, tidy(r || 0.5 * m)]}], over: true, ...(room ? {clip: room} : {}),
    pool: {x, y, r: tidy(3.5 * m), height: 1.5, shadows}};
}
