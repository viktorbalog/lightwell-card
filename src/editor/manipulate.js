// Moving, resizing and turning a home's items: pure functions from an item (plain data, at its path in the home, as
// in hit.js) to its new value, and the snapping that places them. The editor previews each new value while the
// pointer moves and writes the last one to the model when it's let go.
//
// Handles are the points of a selected item that change its shape, by id: a rectangle's corners and edges
// ('rect:1,-1': its right side and top, in its own turned frame) and its turn ('turn', furniture only), a circle's
// radius ('r'), an ellipse's ('rx', 'ry'), a polygon's corners ('v:2') and the middles of its sides ('mid:2', which
// adds a corner there). A light's are its pool's centre and radius ('pool', 'pool-r') and its glow shapes' ('s0/r');
// a room's, its rectangles' ('q1/rect:1,1') or its polygon's ('p/v:0'); an opening's, its two ends ('end:0').
import {box} from '../geometry.js';
import {isHorizontal, shutterRect} from '../openings.js';
import {applyTransform, invertTransform, parseTransform, pieceOutline, regionPolys, shapeGeometry} from './hit.js';

// Values written to the file: to a tenth of a unit (never -0).
export const tidy = v => Math.round(v * 10) / 10 || 0;
const rad = deg => deg * Math.PI / 180;
const turnBy = ([x, y], deg) => [x * Math.cos(rad(deg)) - y * Math.sin(rad(deg)), x * Math.sin(rad(deg)) + y * Math.cos(rad(deg))];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const isNum = v => typeof v === 'number';

// The kind of item a path names.
export const kindOf = path => ({drawing: 'shape', furniture: 'piece', lights: 'light', markers: 'marker', openings: 'opening', rooms: 'room'})[path[0]];

// An SVG path moved by (dx, dy): its absolute coordinates change, everything else (relative moves, arcs' radii, the
// spacing) stays as written.
const ROLES = {M: 'xy', L: 'xy', T: 'xy', H: 'x', V: 'y', C: 'xyxyxy', S: 'xyxy', Q: 'xyxy', A: '-----xy'};
export function movePath(d, dx, dy) {
  let cmd = null, k = 0, start = true;
  return String(d).replace(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g, tok => {
    if (/^[a-zA-Z]$/.test(tok)) { cmd = tok; k = 0; return tok; }
    const C = cmd?.toUpperCase(), roles = ROLES[C];
    if (!roles) return tok;
    const role = roles[k % roles.length];
    // A path's first move is absolute even when written m.
    const abs = cmd === C || (start && k < 2);
    if (++k >= 2) start = false;
    return abs && role !== '-' ? String(tidy(+tok + (role === 'x' ? dx : dy))) : tok;
  });
}

// A shape's SVG `transform` for the shape moved by (dx, dy), so that it does the same to it where it is now: a
// rotation's centre moves with it, a translation stays, a matrix's translation is made up for (and a scale or skew is
// written as such a matrix). One that doesn't parse stays as it is.
export function moveTransform(t, dx, dy) {
  const f = v => String(+v.toFixed(4) || 0);
  return String(t).replace(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g, (all, fn, args) => {
    const v = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === 'translate' || v.some(Number.isNaN)) return all;
    if (fn === 'rotate') return `rotate(${f(v[0])} ${f((v[1] || 0) + dx)} ${f((v[2] || 0) + dy)})`;
    const [a, b, c, d, e, g] = parseTransform(all) || [];
    if (a === undefined) return all;
    return `matrix(${[a, b, c, d, e + dx - (a * dx + c * dy), g + dy - (b * dx + d * dy)].map(f).join(' ')})`;
  });
}

// A shape (shapes.js) moved by (dx, dy). Raw SVG stays where it is.
export function moveShape(s, dx, dy) {
  if (!s || typeof s !== 'object') return s;
  if (s.transform !== undefined && s.svg === undefined) return {...moveShape({...s, transform: undefined}, dx, dy), transform: moveTransform(s.transform, dx, dy)};
  const at = ([x, y, ...rest]) => [tidy(x + dx), tidy(y + dy), ...rest];
  if (s.rect) return {...s, rect: at(s.rect)};
  if (s.circle) return {...s, circle: at(s.circle)};
  if (s.ellipse) return {...s, ellipse: at(s.ellipse)};
  if (s.poly) return {...s, poly: s.poly.map(at)};
  if (s.path !== undefined) return {...s, path: movePath(s.path, dx, dy)};
  if (s.text !== undefined && s.at) return {...s, at: at(s.at)};
  return s;
}

// The item at `path` moved by (dx, dy): a piece with its extra shapes, a light with its glow and its pool, an
// opening along its wall only.
export function moveItem(path, item, dx, dy) {
  switch (kindOf(path)) {
    case 'shape': return moveShape(item, dx, dy);
    case 'piece': return {...item, shape: moveShape(item.shape, dx, dy), ...(Array.isArray(item.extra) ? {extra: item.extra.map(s => moveShape(s, dx, dy))} : {})};
    case 'light': return {...item, ...(Array.isArray(item.shape) ? {shape: item.shape.map(s => moveShape(s, dx, dy))} : {}),
      ...(item.pool ? {pool: {...item.pool, x: tidy(item.pool.x + dx), y: tidy(item.pool.y + dy)}} : {})};
    case 'marker': return {...item, x: tidy(item.x + dx), y: tidy(item.y + dy)};
    case 'opening': return isHorizontal(item) ? {...item, x: tidy(item.x + dx)} : {...item, y: tidy(item.y + dy)};
    case 'room': return item.map(q => (Array.isArray(q[0]) ? q.map(([x, y]) => [tidy(x + dx), tidy(y + dy)]) : moveShape({rect: q}, dx, dy).rect));
    default: return item;
  }
}

// How far an item moves along each axis: an opening only along its wall.
export const axesOf = (path, item) => (kindOf(path) === 'opening' ? (isHorizontal(item) ? [1, 0] : [0, 1]) : [1, 1]);

// The points an item is snapped by, and snapped to: corners, ends, centres, a circle's extremes. `k`: the view's
// width / 1145 (for texts).
export function anchors(path, item, k = 1) {
  const fromGeometry = g => [...g.polys.flat(), ...g.lines.flat(),
    ...g.circles.flatMap(([cx, cy, rx, ry]) => [[cx, cy], [cx - rx, cy], [cx + rx, cy], [cx, cy - ry], [cx, cy + ry]])];
  const circle = ([cx, cy, r]) => fromGeometry({polys: [], lines: [], circles: [[cx, cy, r, r]]});
  if (!item) return [];
  switch (kindOf(path)) {
    case 'shape': {
      if (item.text !== undefined && item.at) return [applyTransform(parseTransform(item.transform), item.at.slice(0, 2))];
      return fromGeometry(shapeGeometry(item, k));
    }
    case 'piece': {
      const o = pieceOutline(item);
      return o.poly || circle(o.circle);
    }
    case 'light': return (Array.isArray(item.shape) ? item.shape : []).flatMap(s => fromGeometry(shapeGeometry(s, k)))
      .concat(item.pool ? [[item.pool.x, item.pool.y]] : []);
    case 'marker': return [[item.x, item.y]];
    case 'opening': {
      const [x, y, w, h] = shutterRect(item);
      return box(x, y, w, h);
    }
    case 'room': return regionPolys(item).flat();
    default: return [];
  }
}

// The box around points: [x0, y0, x1, y1].
export const boundsOf = pts => pts.reduce(([a, b, c, d], [x, y]) => [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)],
  [Infinity, Infinity, -Infinity, -Infinity]);

// A shape-like object's handles (rect, turned by `turn`; circle; ellipse; poly). `reach`: how far the turn handle
// stands out from a turnable rectangle.
function shapeHandles(s, {turnable, reach = 20} = {}) {
  if (!s || typeof s !== 'object') return [];
  // Under an SVG transform: the handles where it puts them.
  const m = !turnable && parseTransform(s.transform);
  if (m) return shapeHandles({...s, transform: undefined}).map(h => ({...h, at: applyTransform(m, h.at)}));
  if (s.rect) {
    const [x, y, w, h] = s.rect, t = s.turn || 0, c = [x + w / 2, y + h / 2];
    const at = (ax, ay) => { const [u, v] = turnBy([ax * w / 2, ay * h / 2], t); return [c[0] + u, c[1] + v]; };
    const out = [];
    for (const ay of [-1, 0, 1]) for (const ax of [-1, 0, 1]) if (ax || ay) out.push({id: `rect:${ax},${ay}`, at: at(ax, ay)});
    if (turnable) {
      const [u, v] = turnBy([0, -h / 2 - reach], t);
      out.push({id: 'turn', at: [c[0] + u, c[1] + v], turn: true});
    }
    return out;
  }
  if (s.circle) return [{id: 'r', at: [s.circle[0] + s.circle[2], s.circle[1]]}];
  if (s.ellipse) return [{id: 'rx', at: [s.ellipse[0] + s.ellipse[2], s.ellipse[1]]}, {id: 'ry', at: [s.ellipse[0], s.ellipse[1] + s.ellipse[3]]}];
  if (Array.isArray(s.poly)) {
    const p = s.poly;
    return [...p.map((q, i) => ({id: `v:${i}`, at: q})),
      ...p.map((q, i) => ({id: `mid:${i}`, at: [(q[0] + p[(i + 1) % p.length][0]) / 2, (q[1] + p[(i + 1) % p.length][1]) / 2], mid: true}))];
  }
  return [];
}

// The part of an item a handle belongs to: the shape-like object it changes, `put` to make the item from a new one,
// and the handle's id within it. Null for the handles an item has of its own (a pool's, an opening's ends).
function partOf(path, item, id) {
  const [head, rest] = id.includes('/') ? [id.slice(0, id.indexOf('/')), id.slice(id.indexOf('/') + 1)] : [null, id];
  switch (kindOf(path)) {
    case 'shape': return {s: item, put: s => s, id};
    case 'piece': return {s: item.shape, put: s => ({...item, shape: s}), id, turnable: !!item.shape?.rect};
    case 'light': {
      const i = +head?.slice(1);
      if (!/^s\d+$/.test(head || '') || !item.shape?.[i]) return null;
      return {s: item.shape[i], put: s => ({...item, shape: item.shape.map((x, j) => (j === i ? s : x))}), id: rest};
    }
    case 'room': {
      if (head === 'p' && Array.isArray(item[0]?.[0])) return {s: {poly: item[0]}, put: s => [s.poly], id: rest};
      const j = +head?.slice(1);
      if (!/^q\d+$/.test(head || '') || !item[j]) return null;
      return {s: {rect: item[j]}, put: s => item.map((q, i) => (i === j ? s.rect : q)), id: rest};
    }
    default: return null;
  }
}

// The handles of the item at `path`: [{id, at, turn?, mid?}].
export function handles(path, item, {reach} = {}) {
  if (!item || typeof item !== 'object') return [];
  const prefixed = (pre, list) => list.map(h => ({...h, id: `${pre}/${h.id}`}));
  switch (kindOf(path)) {
    case 'shape': return shapeHandles(item);
    case 'piece': return shapeHandles(item.shape, {turnable: !!item.shape?.rect, reach});
    case 'light': return [
      ...(item.pool ? [{id: 'pool', at: [item.pool.x, item.pool.y]}, {id: 'pool-r', at: [item.pool.x + item.pool.r, item.pool.y]}] : []),
      ...(Array.isArray(item.shape) ? item.shape.flatMap((s, i) => prefixed(`s${i}`, shapeHandles(s))) : [])];
    case 'opening': {
      const [x, y, w, h] = shutterRect(item);
      return isHorizontal(item) ? [{id: 'end:0', at: [x, y + h / 2]}, {id: 'end:1', at: [x + w, y + h / 2]}]
        : [{id: 'end:0', at: [x + w / 2, y]}, {id: 'end:1', at: [x + w / 2, y + h]}];
    }
    case 'room': return Array.isArray(item[0]?.[0]) ? prefixed('p', shapeHandles({poly: item[0]})) : item.flatMap((q, j) => prefixed(`q${j}`, shapeHandles({rect: q})));
    default: return [];
  }
}

// Whether the pointer is snapped while a handle is dragged: not when turning, nor for the corners of a turned piece.
export function snapsHandle(path, item, id) {
  const part = partOf(path, item, id);
  return !(part && (part.id === 'turn' || (part.s?.rect && part.s.turn)));
}

// Before a drag starts from a handle: dragging the middle of a polygon's side adds a corner there, and goes on with
// that corner. Returns {item, id}.
export function startHandle(path, item, id) {
  const part = partOf(path, item, id), m = part?.id.match(/^mid:(\d+)$/);
  if (!m) return {item, id};
  const i = +m[1], p = part.s.poly, q = p[(i + 1) % p.length];
  const poly = [...p.slice(0, i + 1), [tidy((p[i][0] + q[0]) / 2), tidy((p[i][1] + q[1]) / 2)], ...p.slice(i + 1)];
  return {item: part.put({...part.s, poly}), id: id.replace(/mid:\d+$/, `v:${i + 1}`)};
}

// A polygon's corner removed (one with more than three). Null when it can't be.
export function removeCorner(path, item, id) {
  const part = partOf(path, item, id), m = part?.id.match(/^v:(\d+)$/);
  if (!m || part.s.poly.length <= 3) return null;
  return part.put({...part.s, poly: part.s.poly.filter((_, i) => i !== +m[1])});
}

// A rectangle [x, y, w, h], turned by `turn` around its centre, with the side or corner (ax, ay) dragged to `p` and
// the opposite one staying where it is.
function resizeRect([x, y, w, h], turn, ax, ay, p) {
  const c = [x + w / 2, y + h / 2], q = turnBy([p[0] - c[0], p[1] - c[1]], -turn);
  const span = (a, half, v) => (a ? [Math.min(-a * half, v), Math.max(-a * half, v)] : [-half, half]);
  const [x0, x1] = span(ax, w / 2, q[0]), [y0, y1] = span(ay, h / 2, q[1]);
  const nw = Math.max(x1 - x0, 1), nh = Math.max(y1 - y0, 1);
  const [u, v] = turnBy([(x0 + x1) / 2, (y0 + y1) / 2], turn), nc = [c[0] + u, c[1] + v];
  return [tidy(nc[0] - nw / 2), tidy(nc[1] - nh / 2), tidy(nw), tidy(nh)];
}

// A shape-like object with its handle `id` dragged to `p`: {s, ruler}.
function dragShape(s, id, p, {turnStep}) {
  let m;
  if ((m = id.match(/^rect:(-?\d),(-?\d)$/)) && s.rect) {
    const rect = resizeRect(s.rect, s.turn || 0, +m[1], +m[2], p);
    return {s: {...s, rect}, ruler: {size: [rect[2], rect[3]]}};
  }
  if (id === 'turn' && s.rect) {
    const [x, y, w, h] = s.rect;
    let turn = Math.atan2(p[0] - x - w / 2, -(p[1] - y - h / 2)) * 180 / Math.PI;
    turn = turnStep ? Math.round(turn / turnStep) * turnStep : tidy(turn);
    if (turn <= -180) turn += 360;
    if (turn > 180) turn -= 360;
    turn ||= 0;
    const {turn: _, ...rest} = s;
    return {s: turn || s.turn !== undefined ? {...rest, turn} : rest, ruler: {angle: turn}};
  }
  if (id === 'r' && s.circle) {
    const r = Math.max(tidy(dist(p, s.circle)), 1);
    return {s: {...s, circle: [s.circle[0], s.circle[1], r]}, ruler: {radius: r}};
  }
  if ((id === 'rx' || id === 'ry') && s.ellipse) {
    const e = [...s.ellipse], k = id === 'rx' ? 0 : 1;
    e[2 + k] = Math.max(tidy(Math.abs(p[k] - e[k])), 1);
    return {s: {...s, ellipse: e}, ruler: {size: [e[2] * 2, e[3] * 2]}};
  }
  if ((m = id.match(/^v:(\d+)$/)) && Array.isArray(s.poly)) {
    const i = +m[1], n = s.poly.length, at = [tidy(p[0]), tidy(p[1])];
    const poly = s.poly.map((q, j) => (j === i ? at : q));
    return {s: {...s, poly}, ruler: {sides: [dist(poly[(i + n - 1) % n], at), dist(at, poly[(i + 1) % n])]}};
  }
  return {s, ruler: null};
}

// The item at `path` with its handle `id` dragged to `p` (snapped already, if it snaps): {item, ruler}. `turnStep`:
// the degrees a turn snaps to (0: none).
export function dragHandle(path, item, id, p, {turnStep = 15} = {}) {
  const kind = kindOf(path);
  if (kind === 'light' && item.pool && (id === 'pool' || id === 'pool-r')) {
    if (id === 'pool') return {item: {...item, pool: {...item.pool, x: tidy(p[0]), y: tidy(p[1])}}, ruler: null};
    const r = Math.max(tidy(dist(p, [item.pool.x, item.pool.y])), 1);
    return {item: {...item, pool: {...item.pool, r}}, ruler: {radius: r}};
  }
  if (kind === 'opening' && /^end:[01]$/.test(id)) {
    const h = isHorizontal(item), [a, l] = h ? ['x', 'w'] : ['y', 'h'], v = p[h ? 0 : 1];
    const other = id === 'end:0' ? item[a] + item[l] : item[a];
    const from = Math.min(v, other), len = Math.max(Math.abs(v - other), 1);
    return {item: {...item, [a]: tidy(from), [l]: tidy(len)}, ruler: {length: tidy(len)}};
  }
  const part = partOf(path, item, id);
  if (!part) return {item, ruler: null};
  // Under an SVG transform, the pointer in the shape's own units.
  const m = !part.turnable && parseTransform(part.s.transform);
  if (m) p = applyTransform(invertTransform(m), p);
  const {s, ruler} = dragShape(part.s, part.id, p, {turnStep});
  return {item: s === part.s ? item : part.put(s), ruler};
}

// The ruler's text, in metres (or degrees).
export function rulerText(ruler, unitsPerMetre) {
  if (!ruler) return '';
  const m = v => (Math.abs(v) / unitsPerMetre).toFixed(2);
  if (ruler.size) return `${m(ruler.size[0])} × ${m(ruler.size[1])} m`;
  if (ruler.radius !== undefined) return `r ${m(ruler.radius)} m`;
  if (ruler.length !== undefined) return `${m(ruler.length)} m`;
  if (ruler.sides) return ruler.sides.map(v => `${m(v)} m`).join(' · ');
  if (ruler.angle !== undefined) return `${ruler.angle}°`;
  if (ruler.move) return `${ruler.move[0] < 0 ? '←' : '→'} ${m(ruler.move[0])} m  ${ruler.move[1] < 0 ? '↑' : '↓'} ${m(ruler.move[1])} m`;
  return '';
}

// What can be snapped to: every anchor's x and y in the home but those of the items in `except` (paths), sorted.
export function snapTargets(items, except = [], k = 1) {
  const skip = new Set(except.map(p => JSON.stringify(p)));
  const xs = [], ys = [];
  for (const [path, item] of items) {
    if (skip.has(JSON.stringify(path))) continue;
    for (const [x, y] of anchors(path, item, k)) if (isNum(x) && isNum(y)) { xs.push(x); ys.push(y); }
  }
  const sorted = a => [...new Set(a)].sort((p, q) => p - q);
  return {xs: sorted(xs), ys: sorted(ys)};
}

// The target nearest `v`, if one is within `tol`.
function nearest(sorted, v, tol) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
  const best = [sorted[lo - 1], sorted[lo]].filter(isNum).sort((a, b) => Math.abs(a - v) - Math.abs(b - v))[0];
  return isNum(best) && Math.abs(best - v) <= tol ? best : undefined;
}

// A point snapped: to the other items' anchors within `tol` (shown as guides), or else to the grid (`grid`: its
// step; 0 for none). With `axis`, it stays on the horizontal or vertical through `from`, whichever is nearer.
// Returns {p, guides: {x, y}}.
export function snapPoint(p, {xs = [], ys = [], tol = 0, grid = 0, axis = false, from = null} = {}) {
  const lock = axis && from ? (Math.abs(p[0] - from[0]) < Math.abs(p[1] - from[1]) ? 0 : 1) : -1;
  const one = (v, targets, k) => {
    if (lock === k) return {v: from[k]};
    const t = nearest(targets, v, tol);
    if (t !== undefined) return {v: t, guide: t};
    return {v: grid ? Math.round(v / grid) * grid : v};
  };
  const x = one(p[0], xs, 0), y = one(p[1], ys, 1);
  return {p: [x.v, y.v], guides: {x: x.guide, y: y.guide}};
}

// A move by (dx, dy) of items whose anchors are `pts`, snapped: so that one of the anchors lands on another item's
// within `tol` (shown as a guide), or else so that the box around them starts on the grid. `axes`: [1, 0] for moves
// along x only; `axis`: only along the longer of dx and dy. Returns {dx, dy, guides: {x, y}}.
export function snapMove(pts, dx, dy, {xs = [], ys = [], tol = 0, grid = 0, axis = false, axes = [1, 1]} = {}) {
  let [mx, my] = axes;
  if (axis) Math.abs(dx) >= Math.abs(dy) ? (my = 0) : (mx = 0);
  const [x0, y0] = boundsOf(pts);
  const one = (d, targets, k, on) => {
    if (!on) return {d: 0};
    let best;
    for (const q of pts) {
      const t = nearest(targets, q[k] + d, tol);
      if (t !== undefined && (!best || Math.abs(t - q[k] - d) < Math.abs(best.d - d))) best = {d: t - q[k], guide: t};
    }
    if (best) return best;
    const start = k ? y0 : x0;
    return {d: grid && isFinite(start) ? Math.round((start + d) / grid) * grid - start : d};
  };
  const x = one(dx, xs, 0, mx), y = one(dy, ys, 1, my);
  return {dx: x.d, dy: y.d, guides: {x: x.guide, y: y.guide}};
}
