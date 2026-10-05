// The Build view's geometry: rooms that come with their floor, label and walls, and windows and doors cut into the
// walls by a click. Pure functions from the home's plain data to the model's changes ({set, value}, {insert, value,
// index}, {remove}: HomeModel.batch), so that each is one step in the history and the YAML around it is kept.
//
// What Build makes is tagged with the object it's part of (`part`, home.js): a room's floor, label and walls with its
// key; a window's glass and opening, a door's threshold, a doorway's floor with `window_1`, `door_1`, `doorway_1`
// (the hole itself is the gap between two wall pieces, which the filler spans). The Build view selects, moves and
// deletes an object's parts together.
//
// Walls are only ever added or cut, never redrawn: a home whose walls were drawn by hand keeps them. A new room's
// walls go outside it, on each side not already walled (a room drawn against another's wall shares it: snapRoom
// moves it there), and a wall between two rooms indoors becomes an interior one (iwall). Rooms outdoors (a terrace,
// a balcony) get a floor of their own colour and no walls.
import {openingFrom, roomAt} from './create.js';
import {inPoly, lightCentre, regionPolys} from './hit.js';
import {pieceCentre} from '../furniture.js';
import {tidy} from './manipulate.js';

// Wall thicknesses (m): outside, and between rooms.
export const WALL = {outer: 0.25, inner: 0.15};
// The colour of a floor outdoors, added to the home's palette with the first outdoor room (as the example's).
const TERRACE = {light: '#d9cfc0', dark: '#3a352e'};
// Pieces of wall shorter than this (units) are left out.
const CRUMB = 0.5;

const upm = data => data?.units_per_metre || 100;
// The wall rectangles in the walls slot, with their index: [{i, rect, cls}].
const wallsOf = data => (Array.isArray(data?.drawing?.walls) ? data.drawing.walls : [])
  .map((s, i) => ({i, rect: s?.rect, cls: s?.class}))
  .filter(w => Array.isArray(w.rect) && w.rect.length === 4 && w.cls !== 'line');
const overlaps = (a, b, eps = 0.01) => Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) > eps
  && Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) > eps;
const inRect = (r, [x, y], tol = 0) => x >= r[0] - tol && x <= r[0] + r[2] + tol && y >= r[1] - tol && y <= r[1] + r[3] + tol;

// A room's key from its name: 'Living room' → living_room (a room's key names its clip path), unique in the home.
export function roomKey(data, name) {
  const base = String(name).trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'room';
  let key = base;
  for (let n = 2; data?.rooms?.[key] !== undefined; n++) key = `${base}_${n}`;
  return key;
}

// Room `rect` ([x, y, w, h]) with each side within `tol` of a wall moved against it, on the room's side of the wall:
// drawn next to another room, it shares that room's wall.
export function snapRoom(data, rect, tol = 0) {
  let [x0, y0] = rect, x1 = rect[0] + rect[2], y1 = rect[1] + rect[3];
  for (const {rect: [wx, wy, ww, wh]} of wallsOf(data)) {
    if (wh >= ww && Math.min(y1, wy + wh) - Math.max(y0, wy) > 0) {
      if (x0 >= wx - tol && x0 <= wx + ww + tol && x1 > wx + ww) x0 = wx + ww;
      if (x1 >= wx - tol && x1 <= wx + ww + tol && x0 < wx) x1 = wx;
    }
    if (ww >= wh && Math.min(x1, wx + ww) - Math.max(x0, wx) > 0) {
      if (y0 >= wy - tol && y0 <= wy + wh + tol && y1 > wy + wh) y0 = wy + wh;
      if (y1 >= wy - tol && y1 <= wy + wh + tol && y0 < wy) y1 = wy;
    }
  }
  return [x0, y0, x1 - x0, y1 - y0].map(tidy);
}

// The parts of strip `s` (a thin rectangle) that no wall in `walls` covers, cut along its length.
function uncovered(s, walls) {
  const a = s[2] >= s[3] ? 0 : 1;
  let parts = [[s[a], s[a] + s[a + 2]]];
  for (const r of walls) {
    if (!overlaps(s, r)) continue;
    const lo = r[a], hi = r[a] + r[a + 2];
    parts = parts.flatMap(([p, q]) => (hi <= p || lo >= q ? [[p, q]] : [[p, lo], [hi, q]].filter(([u, v]) => v - u > CRUMB)));
  }
  return parts.map(([p, q]) => (a === 0 ? [p, s[1], q - p, s[3]] : [s[0], p, s[2], q - p]));
}

// The walls a room at `rect` needs: an outer wall outside each side, its corners included, but where walls are
// already. [{rect, class: 'wall'}].
export function roomWalls(data, [x, y, w, h]) {
  const t = tidy(upm(data) * WALL.outer), walls = wallsOf(data).map(v => v.rect);
  const strips = [[x - t, y - t, w + 2 * t, t], [x - t, y + h, w + 2 * t, t], [x - t, y, t, h], [x + w, y, t, h]];
  return strips.flatMap(s => uncovered(s, walls)).map(r => ({rect: r.map(tidy), class: 'wall'}));
}

// Whether the room `name` is outdoors: its floor (a floors shape under its first rectangle's middle) isn't `floor`.
function outdoors(data, name) {
  const r = data?.rooms?.[name]?.[0];
  if (!Array.isArray(r) || Array.isArray(r[0])) return false;
  const c = [r[0] + r[2] / 2, r[1] + r[3] / 2];
  const floor = (data.drawing?.floors || []).findLast(s => Array.isArray(s?.rect) && inRect(s.rect, c));
  return !!floor && floor.class !== 'floor';
}

// The outer walls against room `rect` with an indoor room on their other side: [index in the walls slot].
function sharedWalls(data, [x, y, w, h]) {
  return wallsOf(data).filter(({rect: r, cls}) => {
    if (cls !== 'wall') return false;
    const vertical = r[3] > r[2], [a, b] = vertical ? [y, y + h] : [x, x + w];
    if (Math.min(b, vertical ? r[1] + r[3] : r[0] + r[2]) - Math.max(a, vertical ? r[1] : r[0]) <= CRUMB) return false;
    const mid = (Math.max(a, vertical ? r[1] : r[0]) + Math.min(b, vertical ? r[1] + r[3] : r[0] + r[2])) / 2;
    // The wall's faces, and the room's edge against one of them; the probe goes just beyond the other.
    const [lo, hi] = vertical ? [r[0], r[0] + r[2]] : [r[1], r[1] + r[3]], [e0, e1] = vertical ? [x, x + w] : [y, y + h];
    const beyond = Math.abs(e1 - lo) < 0.01 ? hi + 1 : Math.abs(e0 - hi) < 0.01 ? lo - 1 : null;
    if (beyond === null) return false;
    const other = roomAt(data, vertical ? [beyond, mid] : [mid, beyond]);
    return other && !outdoors(data, other);
  }).map(v => v.i);
}

// A new room called `name` at `rect` (snapped first, if wanted): its key and the changes that make it, with its floor,
// its label (none for a room without a name: its key is then room, room_2…) and (indoors) its walls; the outer walls
// it shares with rooms indoors become interior ones.
export function roomOps(data, name, rect, {outdoor = false} = {}) {
  rect = rect.map(tidy);
  const text = String(name ?? '').trim(), key = roomKey(data, text || 'room'), [x, y, w, h] = rect;
  const ops = [
    {set: ['rooms', key], value: [rect]},
    {insert: ['drawing', 'floors'], value: {rect, class: outdoor ? 'terrace' : 'floor', part: key}},
  ];
  if (text) ops.push({insert: ['drawing', 'labels'], value: {text, at: [tidy(x + w / 2), tidy(y + h / 2)], class: 'room', part: key}});
  if (outdoor) {
    if (!data?.palette?.light?.terrace) ops.push({set: ['palette', 'light', 'terrace'], value: TERRACE.light});
    if (!data?.palette?.dark?.terrace) ops.push({set: ['palette', 'dark', 'terrace'], value: TERRACE.dark});
    if (!(data?.palette?.tinted || []).includes('terrace')) ops.push({insert: ['palette', 'tinted'], value: 'terrace'});
  } else {
    for (const i of sharedWalls(data, rect)) ops.push({set: ['drawing', 'walls', i, 'class'], value: 'iwall'});
    for (const wall of roomWalls(data, rect)) ops.push({insert: ['drawing', 'walls'], value: {...wall, part: key}});
  }
  return {key, ops};
}

// What can be cut into a wall: a window (glass, and an opening for the sun), a glass door (the same down to the
// floor) and a door (a gap: in an interior wall, every kind is a door).
export const CUTS = {window: 'Window', glass_door: 'Glass door', door: 'Door'};

// The wall under `p`, in reach `tol`: {i, rect, cls}, or undefined.
export function wallAt(data, p, tol = 0) {
  return wallsOf(data).filter(w => inRect(w.rect, p, tol))
    .sort((a, b) => Math.min(a.rect[2], a.rect[3]) - Math.min(b.rect[2], b.rect[3]))[0];
}

// The span along the wall (`rect`) that a cut `width` units wide centred near `c` takes, kept inside the wall:
// [from, to], or null when the wall is shorter.
export function cutSpan(rect, c, width) {
  const a = rect[2] >= rect[3] ? 0 : 1, start = rect[a], end = rect[a] + rect[a + 2];
  if (end - start < width) return null;
  const from = Math.min(Math.max(c - width / 2, start), end - width);
  return [tidy(from), tidy(from + width)];
}

// The gaps in the walls (windows, doors, doorways): two wall pieces in line, across the same band (the same side and
// thickness), with nothing between them: [{a, b, axis, from, to, band}] (a, b: the pieces' indexes in the walls slot;
// axis: 0 along x, 1 along y; from, to: the gap along it; band: [lo, hi] across). Gaps wider than `widest` units
// aren't openings but parts of the plan apart.
export function gapsOf(data, widest = 4 * upm(data)) {
  const lines = new Map();
  for (const w of wallsOf(data)) {
    const r = w.rect, axis = r[2] >= r[3] ? 0 : 1, key = `${axis}:${r[1 - axis]}:${r[3 - axis]}`;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(w);
  }
  const gaps = [];
  for (const [key, list] of lines) {
    const [axis, lo, size] = key.split(':').map(Number);
    list.sort((p, q) => p.rect[axis] - q.rect[axis]);
    for (let k = 1; k < list.length; k++) {
      const from = list[k - 1].rect[axis] + list[k - 1].rect[axis + 2], to = list[k].rect[axis];
      if (to - from > CRUMB && to - from <= widest) gaps.push({a: list[k - 1].i, b: list[k].i, axis, from, to, band: [lo, lo + size]});
    }
  }
  return gaps;
}

// The end of a gap under `p` (within `tol` of it, inside its band): {gap, end: 'from' | 'to'}, or undefined.
export function gapEndAt(data, p, tol = 0) {
  let best;
  for (const gap of gapsOf(data)) {
    const across = p[1 - gap.axis];
    if (across < gap.band[0] - tol || across > gap.band[1] + tol) continue;
    for (const end of ['from', 'to']) {
      const d = Math.abs(p[gap.axis] - gap[end]);
      if (d <= tol && (!best || d < best.d)) best = {gap, end, d};
    }
  }
  return best && {gap: best.gap, end: best.end};
}

// How far a gap's end can go: [lo, hi] for `end`, keeping the wall piece beside it and the gap at least 30 cm.
export function gapRange(data, gap, end) {
  const walls = data.drawing.walls, min = 0.3 * upm(data);
  if (end === 'from') return [walls[gap.a].rect[gap.axis] + CRUMB, gap.to - min];
  const b = walls[gap.b].rect;
  return [gap.from + min, b[gap.axis] + b[gap.axis + 2] - CRUMB];
}

// A gap made `from`–`to` wide: the wall pieces either side, and what's in it (its glass, its opening, the floor
// through a doorway: whatever spans it exactly, in its band) follow.
export function resizeGapOps(data, gap, from, to) {
  [from, to] = [tidy(from), tidy(to)];
  const ax = gap.axis, ops = [], same = (u, v) => Math.abs(u - v) < 0.01;
  const along = (rect, lo, hi) => { const r = [...rect]; r[ax] = tidy(lo); r[ax + 2] = tidy(hi - lo); return r; };
  const a = data.drawing.walls[gap.a].rect, b = data.drawing.walls[gap.b].rect;
  ops.push({set: ['drawing', 'walls', gap.a, 'rect'], value: along(a, a[ax], from)});
  ops.push({set: ['drawing', 'walls', gap.b, 'rect'], value: along(b, to, b[ax] + b[ax + 2])});
  // Glass and floor patches spanning the gap, inside its band.
  for (const slot of ['glazing', 'floors']) {
    (data.drawing[slot] || []).forEach((sh, i) => {
      const r = sh?.rect;
      if (!Array.isArray(r) || !same(r[ax], gap.from) || !same(r[ax] + r[ax + 2], gap.to)) return;
      if (r[1 - ax] < gap.band[0] - 0.01 || r[1 - ax] + r[3 - ax] > gap.band[1] + 0.01) return;
      ops.push({set: ['drawing', slot, i, 'rect'], value: along(r, from, to)});
    });
  }
  // The opening: along a top or bottom wall its x and w, along a left or right one its y and h.
  const [pos, len] = ax === 0 ? ['x', 'w'] : ['y', 'h'];
  (data.openings || []).forEach((o, i) => {
    const side = ax === 0 ? ['top', 'bottom'] : ['left', 'right'];
    if (!side.includes(o?.wall) || !same(o[pos], gap.from) || !same(o[pos] + o[len], gap.to)) return;
    if (o.at < gap.band[0] - 0.01 || o.at > gap.band[1] + 0.01) return;
    ops.push({set: ['openings', i, pos], value: from}, {set: ['openings', i, len], value: tidy(to - from)});
  });
  return ops;
}

// Every part id in the home.
function partIds(data) {
  const ids = new Set(Object.keys(data?.rooms || {}));
  const add = list => (Array.isArray(list) ? list : Object.values(list || {})).forEach(it => { if (typeof it?.part === 'string') ids.add(it.part); });
  for (const slot of Object.values(data?.drawing || {})) add(slot);
  for (const k of ['openings', 'lights', 'markers', 'furniture']) add(data?.[k]);
  return ids;
}

// A new part id from `base`: window_1, window_2…
export function partKey(data, base) {
  const ids = partIds(data);
  let n = 1;
  while (ids.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// The object the item at `path` is part of: its `part`, or a room's key; undefined for anything else.
export function partOf(data, path) {
  if (path[0] === 'rooms' && path.length >= 2) return path[1];
  return path.reduce((o, k) => o?.[k], data)?.part;
}

// The paths of everything that is part of `id`: the room itself (when it's a room's), then its tagged items.
export function partsOf(data, id) {
  const paths = data?.rooms?.[id] !== undefined ? [['rooms', id]] : [];
  for (const [slot, list] of Object.entries(data?.drawing || {})) {
    if (Array.isArray(list)) list.forEach((s, i) => { if (s?.part === id) paths.push(['drawing', slot, i]); });
  }
  for (const k of ['openings', 'lights', 'markers']) (data?.[k] || []).forEach((it, i) => { if (it?.part === id) paths.push([k, i]); });
  for (const [name, p] of Object.entries(data?.furniture || {})) if (p?.part === id) paths.push(['furniture', name]);
  return paths;
}

// A cut object's span along gap `gap`'s wall: from its glass and floors (in the gap's band) and its opening, as far
// as they're within the gap (a little beyond counts: hand-drawn homes are a unit off here and there). [from, to], or
// null when it has nothing there.
function cutSpanIn(data, id, gap) {
  const ax = gap.axis, slack = 0.02 * upm(data), ends = [];
  const across = (lo, hi) => lo >= gap.band[0] - slack && hi <= gap.band[1] + slack;
  for (const slot of ['glazing', 'floors']) {
    for (const sh of data?.drawing?.[slot] || []) {
      const r = sh?.rect;
      if (sh?.part === id && Array.isArray(r) && across(r[1 - ax], r[1 - ax] + r[3 - ax])) ends.push([r[ax], r[ax] + r[ax + 2]]);
    }
  }
  const [pos, len] = ax === 0 ? ['x', 'w'] : ['y', 'h'], sides = ax === 0 ? ['top', 'bottom'] : ['left', 'right'];
  for (const o of data?.openings || []) {
    if (o?.part === id && sides.includes(o.wall) && o.at >= gap.band[0] - slack && o.at <= gap.band[1] + slack) ends.push([o[pos], o[pos] + o[len]]);
  }
  if (!ends.length) return null;
  const span = [Math.min(...ends.map(e => e[0])), Math.max(...ends.map(e => e[1]))];
  return span[0] >= gap.from - slack && span[1] <= gap.to + slack ? span : null;
}

// The row of windows and doors in a gap: those side by side in it, with nothing between them, from one wall piece to
// the other (a two-pane window, a balcony door beside its window, or one alone). {gap, cuts: [{id, from, to}],
// bounds} (bounds: where each begins, and where the last ends: the gap's ends, and the boundaries between them).
// A gap they don't fill side by side (or with nothing tagged in it) has no cuts: it's resized as a whole.
export function runOf(data, gap, ids = partIds(data)) {
  const slack = 0.02 * upm(data), cuts = [];
  for (const id of ids) {
    if (data?.rooms?.[id] !== undefined) continue;
    const span = cutSpanIn(data, id, gap);
    if (span) cuts.push({id, from: span[0], to: span[1]});
  }
  cuts.sort((a, b) => a.from - b.from);
  const whole = {gap, cuts: [], bounds: [gap.from, gap.to]};
  if (!cuts.length) return whole;
  // One alone fills its gap; several meet each other, the first and last the wall pieces.
  if (cuts.length > 1 && (Math.abs(cuts[0].from - gap.from) > slack || Math.abs(cuts.at(-1).to - gap.to) > slack
    || cuts.some((c, k) => k && Math.abs(c.from - cuts[k - 1].to) > slack))) return whole;
  return {gap, cuts, bounds: [gap.from, ...cuts.slice(1).map(c => c.from), gap.to]};
}

// The row a cut object (window_1…) is in, and where in it: {run, index}, or undefined.
export function cutRunOf(data, id) {
  const ids = partIds(data);
  for (const gap of gapsOf(data)) {
    const run = runOf(data, gap, ids), index = run.cuts.findIndex(c => c.id === id);
    if (index >= 0) return {run, index};
  }
  return undefined;
}

// The gap a cut object (window_1…) is in (alone, or in a row with others), or undefined.
export function gapOf(data, id) {
  return cutRunOf(data, id)?.run.gap;
}

// A row with its boundaries moved to `bounds`: the wall pieces either side end and begin at its ends, and each window
// or door takes its place between two of them (its glass, its floor and its opening along the wall). A gap without a
// row is resized as a whole (what spans it exactly follows).
export function runOps(data, run, bounds) {
  bounds = bounds.map(tidy);
  if (!run.cuts.length) return resizeGapOps(data, run.gap, bounds[0], bounds.at(-1));
  const {gap} = run, ax = gap.axis, ops = [], slack = 0.02 * upm(data);
  const along = (rect, lo, hi) => { const r = [...rect]; r[ax] = tidy(lo); r[ax + 2] = tidy(hi - lo); return r; };
  const a = data.drawing.walls[gap.a].rect, b = data.drawing.walls[gap.b].rect;
  ops.push({set: ['drawing', 'walls', gap.a, 'rect'], value: along(a, a[ax], bounds[0])});
  ops.push({set: ['drawing', 'walls', gap.b, 'rect'], value: along(b, bounds.at(-1), b[ax] + b[ax + 2])});
  const [pos, len] = ax === 0 ? ['x', 'w'] : ['y', 'h'], sides = ax === 0 ? ['top', 'bottom'] : ['left', 'right'];
  run.cuts.forEach(({id}, k) => {
    const [lo, hi] = [bounds[k], bounds[k + 1]];
    for (const slot of ['glazing', 'floors']) {
      (data.drawing[slot] || []).forEach((sh, i) => {
        const r = sh?.rect;
        if (sh?.part !== id || !Array.isArray(r) || r[1 - ax] < gap.band[0] - slack || r[1 - ax] + r[3 - ax] > gap.band[1] + slack) return;
        ops.push({set: ['drawing', slot, i, 'rect'], value: along(r, lo, hi)});
      });
    }
    (data.openings || []).forEach((o, i) => {
      if (o?.part !== id || !sides.includes(o.wall)) return;
      ops.push({set: ['openings', i, pos], value: tidy(lo)}, {set: ['openings', i, len], value: tidy(hi - lo)});
    });
  });
  return ops;
}

// The boundary of a row under `p` (its ends, or where two of its windows and doors meet), within `tol`: {run, k}
// (k: which of its bounds), or undefined.
export function boundaryAt(data, p, tol = 0) {
  let best;
  const ids = partIds(data);
  for (const gap of gapsOf(data)) {
    const across = p[1 - gap.axis];
    if (across < gap.band[0] - tol || across > gap.band[1] + tol) continue;
    const run = runOf(data, gap, ids);
    run.bounds.forEach((v, k) => {
      const d = Math.abs(p[gap.axis] - v);
      if (d <= tol && (!best || d < best.d)) best = {run, k, d};
    });
  }
  return best && {run: best.run, k: best.k};
}

// How far boundary `k` of a row can go: [lo, hi], keeping the wall pieces either side and each window or door at
// least 30 cm.
export function boundaryRange(data, run, k) {
  const {gap, bounds} = run, walls = data.drawing.walls, min = 0.3 * upm(data), ax = gap.axis;
  const lo = k === 0 ? walls[gap.a].rect[ax] + CRUMB : bounds[k - 1] + min;
  const b = walls[gap.b].rect, hi = k === bounds.length - 1 ? b[ax] + b[ax + 2] - CRUMB : bounds[k + 1] - min;
  return [lo, hi];
}

// A row's boundary `k` moved to `v` (kept in its range): one end of a window or door, or where two meet (both follow).
export function moveBoundaryOps(data, run, k, v) {
  const [lo, hi] = boundaryRange(data, run, k), bounds = [...run.bounds];
  bounds[k] = Math.min(Math.max(v, lo), hi);
  return runOps(data, run, bounds);
}

// The row in `gap` slid `d` units along its wall, all of it (kept inside the wall).
export function slideOps(data, gap, d) {
  const run = runOf(data, gap), walls = data.drawing.walls, a = walls[gap.a].rect, b = walls[gap.b].rect, ax = gap.axis;
  const lo = a[ax] + CRUMB - run.bounds[0], hi = b[ax] + b[ax + 2] - CRUMB - run.bounds.at(-1);
  const move = Math.min(Math.max(d, lo), hi);
  return runOps(data, run, run.bounds.map(v => v + move));
}

// Cut object `id` made `width` units wide around its middle (its ends kept in their ranges; a neighbour in its row
// gives way, or takes the room).
export function resizeCutOps(data, id, width) {
  const found = cutRunOf(data, id);
  if (!found) return [];
  const {run, index: i} = found, bounds = [...run.bounds], mid = (bounds[i] + bounds[i + 1]) / 2;
  const [lo] = boundaryRange(data, run, i), [, hi] = boundaryRange(data, run, i + 1);
  bounds[i] = Math.max(mid - width / 2, lo);
  bounds[i + 1] = Math.min(mid + width / 2, hi);
  return runOps(data, run, bounds);
}

// Cut object `id` split in two side by side: a two-pane window, or a door beside a door. The new one (`window_2`…) is
// a copy of it, its glass, floor and opening in the second half. {ops, part}, or null when it's in no row.
export function splitCutOps(data, id) {
  const found = cutRunOf(data, id);
  if (!found) return null;
  const {run, index: i} = found, {gap} = run, ax = gap.axis, [lo, hi] = [run.bounds[i], run.bounds[i + 1]], mid = tidy((lo + hi) / 2);
  if (mid - lo < 0.3 * upm(data)) return null;
  const part = partKey(data, id.replace(/_\d+$/, '')), [pos, len] = ax === 0 ? ['x', 'w'] : ['y', 'h'];
  // It keeps the first half (its wall pieces as they are), the copy takes the second.
  const ops = runOps(data, {...run, cuts: [run.cuts[i]]}, [lo, mid]).filter(op => op.set[0] !== 'drawing' || op.set[1] !== 'walls');
  for (const p of partsOf(data, id)) {
    const item = p.reduce((o, k) => o?.[k], data);
    if (p[0] === 'drawing' && Array.isArray(item?.rect)) {
      const r = [...item.rect];
      r[ax] = mid;
      r[ax + 2] = tidy(hi - mid);
      ops.push({insert: p.slice(0, -1), value: {...item, rect: r, part}});
    } else if (p[0] === 'openings') ops.push({insert: ['openings'], value: {...item, [pos]: mid, [len]: tidy(hi - mid), part}});
  }
  return {ops, part};
}

// Removals and changes in an order that keeps the indexes right: changes first, then removals, the last first.
function ordered(sets, removals) {
  const seen = new Set(), list = removals.filter(p => !seen.has(JSON.stringify(p)) && seen.add(JSON.stringify(p)));
  list.sort((p, q) => {
    const [a, b] = [JSON.stringify(p.slice(0, -1)), JSON.stringify(q.slice(0, -1))];
    if (a !== b) return a < b ? -1 : 1;
    return typeof p.at(-1) === 'number' ? q.at(-1) - p.at(-1) : 0;
  });
  return [...sets, ...list.map(remove => ({remove}))];
}

// Deletes the object `id`. A cut object: its parts, and its hole closed (the two wall pieces become one again). A
// room: the room, its floor, its label, and its walls but those another room still needs (they become that room's,
// outer walls); the cut objects in walls that go, with them.
export function deleteOps(data, id) {
  const sets = [], removals = partsOf(data, id);
  if (data?.rooms?.[id] === undefined) {
    const found = cutRunOf(data, id);
    if (found) {
      // Its place in the wall is wall again: the hole closes, or (in a row) the wall piece beside it reaches over it,
      // or (between two others) a piece of wall goes there.
      const {run: {gap, cuts, bounds}, index: i} = found, ax = gap.axis, [lo, hi] = [bounds[i], bounds[i + 1]];
      const a = data.drawing.walls[gap.a], b = data.drawing.walls[gap.b], r = [...a.rect];
      if (cuts.length === 1) {
        r[ax + 2] = tidy(b.rect[ax] + b.rect[ax + 2] - a.rect[ax]);
        sets.push({set: ['drawing', 'walls', gap.a, 'rect'], value: r});
        removals.push(['drawing', 'walls', gap.b]);
      } else if (i === 0) {
        r[ax + 2] = tidy(hi - a.rect[ax]);
        sets.push({set: ['drawing', 'walls', gap.a, 'rect'], value: r});
      } else if (i === cuts.length - 1) {
        const q = [...b.rect];
        q[ax + 2] = tidy(b.rect[ax] + b.rect[ax + 2] - lo);
        q[ax] = tidy(lo);
        sets.push({set: ['drawing', 'walls', gap.b, 'rect'], value: q});
      } else {
        r[ax] = tidy(lo);
        r[ax + 2] = tidy(hi - lo);
        sets.push({insert: ['drawing', 'walls'], value: {...a, rect: r}});
      }
    }
    // Its pieces leave the lamps' shadows (those of lamps going with it aside).
    const pieces = removals.filter(p => p[0] === 'furniture').map(p => p[1]);
    (data?.lights || []).forEach((g, i) => {
      const list = g?.pool?.shadows;
      if (g?.part !== id && Array.isArray(list) && list.some(n => pieces.includes(n))) {
        sets.push({set: ['lights', i, 'pool', 'shadows'], value: list.filter(n => !pieces.includes(n))});
      }
    });
    return ordered(sets, removals);
  }
  const others = {...data, rooms: Object.fromEntries(Object.entries(data.rooms).filter(([k]) => k !== id))};
  // The rooms either side of a wall rectangle, in `d`.
  const sides = (d, r) => {
    const ax = r[2] >= r[3] ? 0 : 1, mid = r[ax] + r[ax + 2] / 2, probe = v => roomAt(d, ax === 0 ? [mid, v] : [v, mid]);
    return [probe(r[1 - ax] - 1), probe(r[1 - ax] + r[3 - ax] + 1)];
  };
  const gone = new Set(), opened = new Set();
  (data.drawing?.walls || []).forEach((w, i) => {
    if (!Array.isArray(w?.rect)) return;
    const [before, after] = sides(others, w.rect), other = before || after;
    if (w.part === id && other) {
      sets.push({set: ['drawing', 'walls', i, 'part'], value: other});
      if (w.class === 'iwall') sets.push({set: ['drawing', 'walls', i, 'class'], value: 'wall'});
      opened.add(i);
    } else if (w.part === id) {
      removals.push(['drawing', 'walls', i]);
      gone.add(i);
    } else if (w.class === 'iwall' && sides(data, w.rect).includes(id) && !(before && after)) {
      // Another room's wall that was between it and this one: outside now.
      sets.push({set: ['drawing', 'walls', i, 'class'], value: 'wall'});
      opened.add(i);
    }
  });
  // Doorways into it: closed (the two wall pieces become one again).
  for (const pid of partIds(data)) {
    const g = /^doorway_/.test(pid) && gapOf(data, pid);
    if (!g || !opened.has(g.a) || !opened.has(g.b)) continue;
    const a = data.drawing.walls[g.a].rect, b = data.drawing.walls[g.b].rect, r = [...a];
    r[g.axis + 2] = tidy(b[g.axis] + b[g.axis + 2] - a[g.axis]);
    sets.push({set: ['drawing', 'walls', g.a, 'rect'], value: r});
    removals.push(['drawing', 'walls', g.b], ...partsOf(data, pid));
  }
  // Cut objects between walls that go.
  for (const gap of gapsOf(data)) {
    if (!gone.has(gap.a) || !gone.has(gap.b)) continue;
    for (const pid of partIds(data)) {
      const g = pid !== id && gapOf(data, pid);
      if (g && g.a === gap.a && g.b === gap.b) removals.push(...partsOf(data, pid));
    }
  }
  return ordered(sets, removals);
}

// A home not made in the Build view adopted by it: its objects found from what's there, and tagged (`part`) where
// they aren't yet. Conservative, as hand-drawn homes vary: a light and the marker of its entity are a lamp; an opening
// is a window (or a glass door, or a door: down to the floor, with glass or without), with the glass inside its span
// and the marker of its shutter; a room is itself, its name (a room label inside it, given to the smallest room
// around it) and a floor of exactly its shape. Walls stay as they are (they often run past several rooms). Returns
// the changes ({set: [...path, 'part'], value}), none when there's nothing to adopt.
export function adoptOps(data) {
  const ops = [], taken = partIds(data), used = new Set();
  const tag = (path, id) => { used.add(JSON.stringify(path)); ops.push({set: [...path, 'part'], value: id}); };
  const fresh = base => { let n = 1; while (taken.has(`${base}_${n}`)) n++; taken.add(`${base}_${n}`); return `${base}_${n}`; };
  const markers = (data?.markers || []).map((m, i) => ({m, path: ['markers', i]}));
  const free = path => path.reduce((o, k) => o?.[k], data)?.part === undefined && !used.has(JSON.stringify(path));
  // Lamps.
  (data?.lights || []).forEach((g, i) => {
    if (g?.part !== undefined || !g?.entities?.length) return;
    const id = fresh('lamp');
    tag(['lights', i], id);
    for (const {m, path} of markers) if (m?.entity === g.entities[0] && free(path)) tag(path, id);
  });
  // Windows and doors.
  (data?.openings || []).forEach((o, i) => {
    if (o?.part !== undefined || !o?.wall) return;
    const horizontal = o.wall === 'top' || o.wall === 'bottom', [lo, len] = horizontal ? [o.x, o.w] : [o.y, o.h];
    const band = [o.at - o.depth, o.at];
    const glass = (data.drawing?.glazing || []).map((g, j) => ({g, j})).filter(({g, j}) => {
      const r = g?.rect;
      if (!Array.isArray(r) || !free(['drawing', 'glazing', j])) return false;
      const [a, l, c, t] = horizontal ? [r[0], r[2], r[1], r[3]] : [r[1], r[3], r[0], r[2]];
      return a >= lo - 1 && a + l <= lo + len + 1 && c >= band[0] - 1 && c + t <= band[1] + 1;
    });
    const id = fresh(o.lo > 0 ? 'window' : glass.length ? 'glass_door' : 'door');
    tag(['openings', i], id);
    for (const {j} of glass) tag(['drawing', 'glazing', j], id);
    for (const {m, path} of markers) if (o.shutter && m?.entity === o.shutter && free(path)) tag(path, id);
  });
  // Rooms: their names, and floors of their exact shape.
  const rooms = Object.entries(data?.rooms || {}), area = region => regionPolys(region).reduce((s, poly) => s + Math.abs(poly.reduce((a, p, k) => {
    const q = poly[(k + 1) % poly.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2, 0);
  (data?.drawing?.labels || []).forEach((l, j) => {
    if (l?.part !== undefined || l?.class !== 'room' || !Array.isArray(l.at)) return;
    const around = rooms.filter(([, region]) => regionPolys(region).some(poly => inPoly(poly, l.at))).sort((a, b) => area(a[1]) - area(b[1]));
    if (around.length) tag(['drawing', 'labels', j], around[0][0]);
  });
  (data?.drawing?.floors || []).forEach((f, j) => {
    if (f?.part !== undefined) return;
    const own = rooms.find(([, region]) => (Array.isArray(f?.rect) && region.length === 1 && Array.isArray(region[0]) && region[0].length === 4 && !Array.isArray(region[0][0])
      && region[0].every((v, k) => Math.abs(v - f.rect[k]) < 0.01))
      || (Array.isArray(f?.poly) && Array.isArray(region[0]?.[0]) && JSON.stringify(region[0]) === JSON.stringify(f.poly)));
    if (own) tag(['drawing', 'floors', j], own[0]);
  });
  return ops;
}

// A cut's span [from, to] along wall `wall` ({i, rect}) next to a window or door (a gap at that end of the wall piece):
// within 25 cm (`move`: when it was placed by a click, so it keeps its width), moved against it, side by side with no
// sliver of wall between (a two-pane window, a door beside its window). Changes `span`, and returns it.
export function snapCut(data, wall, span, move = true) {
  const r = wall.rect, a = r[2] >= r[3] ? 0 : 1, near = move ? 0.25 * upm(data) : CRUMB, gaps = gapsOf(data), end = r[a] + r[a + 2];
  if (gaps.some(g => g.b === wall.i) && span[0] - r[a] <= near) { if (move) span[1] = tidy(span[1] - (span[0] - r[a])); span[0] = r[a]; }
  if (gaps.some(g => g.a === wall.i) && end - span[1] <= near) { if (move) span[0] = tidy(span[0] + (end - span[1])); span[1] = tidy(end); }
  return span;
}

// A `kind` of cut (CUTS) `metres` wide in the wall under `p` (or from `p` to `until`, dragged along it): {ops, opening} (opening: whether one was made), or null
// when there's no wall there, or it's too short. The wall is split in two around the gap; a window or glass door in
// an outer wall gets its glass and its opening (its side, room and heights from the wall, as the opening tool), a
// doorway between rooms a floor through it.
export function cutOps(data, p, {kind = 'window', metres = 1, tol = 0, until} = {}) {
  const wall = wallAt(data, p, tol);
  if (!wall) return null;
  const r = wall.rect, a = r[2] >= r[3] ? 0 : 1;
  // Dragged along the wall (to `until`): that span, kept inside the wall; otherwise `metres` around the click.
  const span = until ? [Math.max(Math.min(p[a], until[a]), r[a]), Math.min(Math.max(p[a], until[a]), r[a] + r[a + 2])].map(tidy) : cutSpan(r, p[a], tidy(metres * upm(data)));
  if (!span || span[1] - span[0] < 0.3 * upm(data)) return null;
  snapCut(data, wall, span, !until);
  if (!span) return null;
  const [from, to] = span, mid = r[1 - a] + r[3 - a] / 2;
  const at = v => (a === 0 ? [v, mid] : [mid, v]);
  const glazed = wall.cls === 'wall' && kind !== 'door' && openingFrom(data, at(from), at(to), {kind: kind === 'glass_door' ? 'door' : 'window', tol: 1});
  const piece = (lo, hi) => {
    const rect = [...r];
    rect[a] = tidy(lo);
    rect[a + 2] = tidy(hi - lo);
    return {...data.drawing.walls[wall.i], rect};
  };
  const pieces = [[r[a], from], [to, r[a] + r[a + 2]]].filter(([lo, hi]) => hi - lo > CRUMB).map(([lo, hi]) => piece(lo, hi));
  const ops = [{remove: ['drawing', 'walls', wall.i]}, ...pieces.reverse().map(value => ({insert: ['drawing', 'walls'], value, index: wall.i}))];
  let opening = false;
  const part = partKey(data, wall.cls === 'iwall' ? 'doorway' : glazed ? kind : 'door');
  if (glazed) {
    ops.push({insert: ['drawing', 'glazing'], value: {...glazed.glass, part}});
    // An opening needs the room its sun falls in: without one inside, the glass alone.
    if (glazed.opening.room) {
      ops.push({insert: ['openings'], value: {...glazed.opening, part}});
      opening = true;
    }
  } else {
    // A doorway between rooms: the floor goes on through it (each room's floor stops at its walls); a door outside:
    // its threshold.
    ops.push({insert: ['drawing', 'floors'], value: {rect: piece(from, to).rect, class: 'floor', part}});
  }
  return {ops, opening, part};
}

// A lamp's entity set on one of its parts (`path`: a light's `entities`, or a marker's `entity`) to `value`: the same
// entity on every light and marker of the lamp, so that its glow, its pool and its marker stay one lamp (a light that
// was lit without one, `lit`, then has it instead). Null when it isn't a lamp's entity.
export function lampEntityOps(data, path, value) {
  const field = path.length === 3 && (path[0] === 'markers' ? path[2] === 'entity' : path[0] === 'lights' && path[2] === 'entities');
  const id = field && partOf(data, path.slice(0, 2)), entity = path[0] === 'markers' ? value : value?.[0];
  const parts = id ? partsOf(data, id) : [];
  if (typeof entity !== 'string' || !parts.some(p => p[0] === 'lights')) return null;
  return parts.flatMap(p => {
    const item = p.reduce((o, k) => o?.[k], data);
    if (p[0] === 'markers') return [{set: [...p, 'entity'], value: entity}];
    if (p[0] !== 'lights') return [];
    const {lit: _, ...rest} = item;
    return [{set: p, value: {...rest, entities: path[0] === 'lights' && p[1] === path[1] ? value : [entity, ...(item.entities || []).slice(1)]}}];
  });
}

// The changes applied to a copy of `data` (plain data, as HomeModel.batch applies them to its document).
export function applyOps(data, ops) {
  const out = structuredClone(data);
  const at = path => path.reduce((o, k) => o?.[k], out);
  for (const op of ops) {
    if (op.set) {
      let o = out;
      for (const [k, key] of op.set.slice(0, -1).entries()) o = o[key] ??= typeof op.set[k + 1] === 'number' ? [] : {};
      o[op.set.at(-1)] = op.value;
    } else if (op.insert) {
      let list = at(op.insert);
      if (!list) { list = []; applyOps.set(out, op.insert, list); }
      list.splice(op.index ?? list.length, 0, op.value);
    } else if (op.remove) {
      const parent = at(op.remove.slice(0, -1)), key = op.remove.at(-1);
      if (Array.isArray(parent)) parent.splice(key, 1);
      else if (parent) delete parent[key];
    }
  }
  return out;
}
applyOps.set = (o, path, v) => { for (const k of path.slice(0, -1)) o = o[k] ??= {}; o[path.at(-1)] = v; };

// The walls room `key` at `rect` needs (as roomOps makes them): the outer walls it shares with rooms indoors become
// interior ones, and new walls go where there are none.
function wallOps(data, key, rect) {
  return [
    ...sharedWalls(data, rect).map(i => ({set: ['drawing', 'walls', i, 'class'], value: 'iwall'})),
    ...roomWalls(data, rect).map(wall => ({insert: ['drawing', 'walls'], value: {...wall, part: key}})),
  ];
}

// A shape, opening or marker moved by (dx, dy), whole (an opening with its wall's line too).
function shifted(item, dx, dy) {
  const s = {...item};
  if (Array.isArray(s.rect)) s.rect = [tidy(s.rect[0] + dx), tidy(s.rect[1] + dy), s.rect[2], s.rect[3]];
  if (Array.isArray(s.poly)) s.poly = s.poly.map(([x, y]) => [tidy(x + dx), tidy(y + dy)]);
  if (Array.isArray(s.at)) s.at = [tidy(s.at[0] + dx), tidy(s.at[1] + dy), ...s.at.slice(2)];
  if (typeof s.wall === 'string') {
    const horizontal = s.wall === 'top' || s.wall === 'bottom';
    s.at = tidy(s.at + (horizontal ? dy : dx));
    if (horizontal) s.x = tidy(s.x + dx); else s.y = tidy(s.y + dy);
  } else if (typeof s.x === 'number' && typeof s.y === 'number') [s.x, s.y] = [tidy(s.x + dx), tidy(s.y + dy)];
  return s;
}

// Room `id` (one rectangle) moved by (dx, dy), snapped to the walls near it (`tol`), and with `size` ([w, h]) made that
// size (its right and bottom sides move): its floor and label move, the walls it shared stay where another room needs
// them, walls are made around it where it lands, and the windows and doors in its own walls go with it (those in its
// right and bottom walls with those sides). What stands in it (furniture, lamps) stays. {ops, rect}, or null for a
// room that isn't one rectangle.
export function moveRoomOps(data, id, dx, dy, tol = 0, size = null) {
  const region = data?.rooms?.[id], old = region?.[0];
  if (!Array.isArray(region) || region.length !== 1 || !Array.isArray(old) || Array.isArray(old[0])) return null;
  const outdoor = outdoors(data, id), kept = new Set(['floors', 'labels']);
  // The windows and doors in its own walls (both pieces either side of them its own): cut again where it lands.
  const own = new Set((data.drawing?.walls || []).flatMap((w, i) => (w?.part === id ? [i] : [])));
  const cuts = [...partIds(data)].filter(pid => pid !== id && data.rooms?.[pid] === undefined).flatMap(pid => {
    const found = cutRunOf(data, pid), gap = found?.run.gap;
    if (!gap || !own.has(gap.a) || !own.has(gap.b)) return [];
    // Its own span in its row (beside another, a pane of a pair: not the whole gap).
    const span = {...gap, from: found.run.bounds[found.index], to: found.run.bounds[found.index + 1]};
    return [{pid, gap: span, parts: partsOf(data, pid).map(p => [p, p.reduce((o, k) => o?.[k], data)])}];
  });
  // 1. Its walls go (those others need stay theirs), the room's own floor and label aside.
  const del = deleteOps(data, id).filter(op => !(op.remove && (op.remove[0] === 'rooms'
    || (op.remove[0] === 'drawing' && kept.has(op.remove[1]) && op.remove.reduce((o, k) => o?.[k], data)?.part === id))));
  const stage1 = applyOps(data, del);
  // 2. Where it lands, against the walls there.
  const placed = [old[0] + dx, old[1] + dy, size?.[0] ?? old[2], size?.[1] ?? old[3]].map(tidy);
  const rect = size ? placed : snapRoom(stage1, placed, tol);
  const [mx, my, dw, dh] = [rect[0] - old[0], rect[1] - old[1], rect[2] - old[2], rect[3] - old[3]];
  const same = (a, b) => Array.isArray(a) && a.every((v, k) => Math.abs(v - b[k]) < 0.01);
  const move = [{set: ['rooms', id], value: [rect]}, ...partsOf(stage1, id).filter(p => p[0] === 'drawing').map(p => {
    const item = p.reduce((o, k) => o?.[k], stage1);
    // Its floor takes its new shape; its label stays in its middle (as far as it was from it).
    if (same(item.rect, old)) return {set: p, value: {...item, rect}};
    return {set: p, value: shifted(item, mx + (p[1] === 'labels' ? dw / 2 : 0), my + (p[1] === 'labels' ? dh / 2 : 0))};
  })];
  const stage2 = applyOps(stage1, move);
  // 3. Its walls there.
  const walls = outdoor ? [] : wallOps(stage2, id, rect);
  let now = applyOps(stage2, walls);
  // 4. Its windows and doors, cut again in the walls where they are now: the wall split as a cut does, and the
  // window's own glass, opening and markers moved with it (kept as they were, with their part).
  const recut = [];
  for (const {gap, parts} of cuts) {
    // A wall on its right or bottom side moves with that side.
    const ax = gap.axis, far = gap.band[0] >= (ax === 0 ? old[1] + old[3] : old[0] + old[2]) - 0.01;
    const [ox, oy] = [mx + (ax === 1 && far ? dw : 0), my + (ax === 0 && far ? dh : 0)];
    const mid = (gap.band[0] + gap.band[1]) / 2 + (ax === 0 ? oy : ox), d = ax === 0 ? ox : oy;
    const at = v => (ax === 0 ? [v, mid] : [mid, v]);
    const made = cutOps(now, at(gap.from + d), {until: at(gap.to + d)});
    if (!made) continue;
    const ops = [...made.ops.filter(op => (op.remove || op.insert)?.[1] === 'walls'),
      ...parts.map(([path, item]) => ({insert: path.slice(0, -1), value: shifted(item, ox, oy)}))];
    recut.push(...ops);
    now = applyOps(now, ops);
  }
  return {ops: [...del, ...move, ...walls, ...recut], rect};
}

// After the items at `paths` moved (`data`: as they are now), what they're in follows where they are: a light's room
// (`clip`) and, with a pool, the pieces in its shadows (those with a height in its new room); a piece's room
// (`shadow_room`), and the pools of the lamps in its old and new rooms (out of one's shadows, into the other's). Only
// what changed rooms changes: shadows chosen by hand stay while a lamp stays in its room.
export function regroupOps(data, paths) {
  const ops = [], shadows = new Map();
  const lights = data?.lights || [], furniture = data?.furniture || {};
  const shadowsOf = i => shadows.get(i) ?? lights[i].pool.shadows ?? [];
  for (const path of paths) {
    const item = path.reduce((o, k) => o?.[k], data);
    if (path[0] === 'lights' && path.length === 2 && item) {
      const c = lightCentre(item), room = c && roomAt(data, c);
      if (!room || room === item.clip) continue;
      ops.push({set: [...path, 'clip'], value: room});
      if (item.pool) shadows.set(path[1], Object.entries(furniture).filter(([, p]) => p?.height && p.shadow_room === room).map(([n]) => n));
    } else if (path[0] === 'furniture' && path.length === 2 && item?.shape) {
      const c = item.shape.circle?.slice(0, 2) || pieceCentre(item.shape), room = c && roomAt(data, c), was = item.shadow_room;
      if (!room || room === was) continue;
      ops.push({set: [...path, 'shadow_room'], value: room});
      if (!item.height) continue;
      lights.forEach((g, i) => {
        if (!g?.pool || paths.some(p => p[0] === 'lights' && p[1] === i)) return;
        const list = shadowsOf(i);
        if (g.clip === was && list.includes(path[1])) shadows.set(i, list.filter(n => n !== path[1]));
        if (g.clip === room && !list.includes(path[1])) shadows.set(i, [...list, path[1]]);
      });
    }
  }
  for (const [i, list] of shadows) ops.push({set: ['lights', i, 'pool', 'shadows'], value: list});
  return ops;
}
