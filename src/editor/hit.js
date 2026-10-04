// Which of a home's items is under a point, worked out from the home's own geometry (the card's SVG is generated and
// blurred, so its DOM can't tell), and their outlines for the editor's overlay. An item is named by its path in the
// home: ['furniture', 'sofa'], ['lights', 2], ['drawing', 'walls', 3], ['rooms', 'living'].
//
// Front to back: markers, the centres of lights, furniture, openings, the lights' glows, the drawing's shapes (top
// slot first, and the last drawn first within a slot), rooms. The centres of lights come before the furniture and
// their glows after it, so that a lamp's glow over a sofa doesn't hide the sofa.
import {box} from '../geometry.js';
import {shutterRect} from '../openings.js';
import {SLOTS} from '../home.js';

// A marker's reach, as a share of the view's width (its icon is 4.6 % of the card's width, plus padding).
const MARKER = 0.03;
// Text sizes by class, in the units of a view 1145 wide (card.js: .room, .lbl).
const TEXT = {room: 40, lbl: 24};

export const inPoly = (poly, [x, y]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const nearSegment = ([ax, ay], [bx, by], [x, y], tol) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= tol;
};
const nearPoly = (poly, p, tol, closed = true) => poly.some((a, i) => (closed || i < poly.length - 1) && nearSegment(a, poly[(i + 1) % poly.length], p, tol));
const inRect = ([x, y, w, h], [px, py], tol = 0) => px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h + tol;

// An SVG path's points, as polylines (curves by their end points): {lines: [[[x, y], ...]], closed: [bool]}.
export function pathLines(d) {
  const lines = [], closed = [];
  let line = null, x = 0, y = 0, sx = 0, sy = 0;
  const tokens = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
  let cmd = null;
  const num = () => +tokens.shift();
  const takes = {M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0};
  while (tokens.length) {
    if (/[a-zA-Z]/.test(tokens[0])) cmd = tokens.shift();
    if (!cmd) break;
    const C = cmd.toUpperCase(), rel = cmd !== C;
    if (C === 'Z') {
      if (line) { line.push([sx, sy]); closed[lines.length - 1] = true; }
      [x, y] = [sx, sy];
      line = null;
      cmd = null;
      continue;
    }
    if (!(C in takes) || tokens.length < takes[C] || /[a-zA-Z]/.test(tokens[0])) break;
    const v = Array.from({length: takes[C]}, num);
    if (C === 'H') x = rel ? x + v[0] : v[0];
    else if (C === 'V') y = rel ? y + v[0] : v[0];
    else [x, y] = rel ? [x + v.at(-2), y + v.at(-1)] : [v.at(-2), v.at(-1)];
    if (C === 'M') {
      line = [[x, y]];
      lines.push(line);
      closed.push(false);
      [sx, sy] = [x, y];
      cmd = rel ? 'l' : 'L';
    } else {
      if (!line) { line = [[sx, sy]]; lines.push(line); closed.push(false); }
      line.push([x, y]);
    }
  }
  return {lines, closed};
}

// An SVG transform list ('rotate(-90 680 420) translate(5)') as a matrix [a, b, c, d, e, f] (x' = a x + c y + e,
// y' = b x + d y + f), or null when there's none (or it doesn't parse).
export function parseTransform(t) {
  if (typeof t !== 'string' || !t.trim()) return null;
  const mul = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  let m = [1, 0, 0, 1, 0, 0], rest = t;
  const re = /^\s*,?\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/;
  while (rest.trim()) {
    const found = rest.match(re);
    if (!found) return null;
    rest = rest.slice(found[0].length);
    const v = found[2].split(/[\s,]+/).filter(Boolean).map(Number), rad = (v[0] || 0) * Math.PI / 180;
    if (v.some(Number.isNaN)) return null;
    const [cos, sin] = [Math.cos(rad), Math.sin(rad)];
    const step = {
      matrix: () => v.length === 6 && v,
      translate: () => [1, 0, 0, 1, v[0] || 0, v[1] || 0],
      scale: () => [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0],
      rotate: () => {
        const [cx = 0, cy = 0] = v.slice(1);
        return mul(mul([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
      },
      skewX: () => [1, 0, Math.tan(rad), 1, 0, 0],
      skewY: () => [1, Math.tan(rad), 0, 1, 0, 0],
    }[found[1]]();
    if (!step) return null;
    m = mul(m, step);
  }
  return m;
}
export const applyTransform = (m, [x, y]) => (m ? [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] : [x, y]);
// The inverse of a transform matrix.
export function invertTransform([a, b, c, d, e, f]) {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

// A shape's (shapes.js) area as polygons and lines in the drawing, for hits and outlines: {polys, lines, circles}
// (circles: [cx, cy, rx, ry]). `k`: the view's width / 1145, for texts. Raw SVG has none. A shape's `transform`
// applies (circles under one become polygons).
export function shapeGeometry(s, k = 1) {
  // width: a stroked line's (stroke_width), which widens it.
  const g = {polys: [], lines: [], circles: [], width: +s?.stroke_width || 0};
  if (!s || typeof s !== 'object' || s.svg !== undefined) return g;
  const copies = s.repeat ? s.repeat.count : 1, [dx, dy] = s.repeat?.step || [0, 0];
  for (let i = 0; i < copies; i++) {
    const ox = dx * i, oy = dy * i, at = ([x, y]) => [x + ox, y + oy];
    if (s.rect) g.polys.push(box(s.rect[0] + ox, s.rect[1] + oy, s.rect[2], s.rect[3]));
    else if (s.circle) g.circles.push([s.circle[0] + ox, s.circle[1] + oy, s.circle[2], s.circle[2]]);
    else if (s.ellipse) g.circles.push([s.ellipse[0] + ox, s.ellipse[1] + oy, s.ellipse[2], s.ellipse[3]]);
    else if (s.poly) g.polys.push(s.poly.map(at));
    else if (s.path !== undefined) {
      const {lines, closed} = pathLines(s.path);
      lines.forEach((l, j) => (closed[j] ? g.polys : g.lines).push(l.map(at)));
    } else if (s.text !== undefined && s.at) {
      // About the text's box: middle-anchored for room and lbl, which have a size of their own.
      const size = (TEXT[s.class] ?? 24) * k, w = String(s.text).length * size * 0.55;
      const [x, y] = at(s.at), x0 = TEXT[s.class] ? x - w / 2 : x;
      g.polys.push(box(x0, y - size * 0.8, w, size));
    }
  }
  const m = parseTransform(s.transform);
  if (!m) return g;
  const ellipse = ([cx, cy, rx, ry]) => Array.from({length: 24}, (_, j) => [cx + rx * Math.cos(j * Math.PI / 12), cy + ry * Math.sin(j * Math.PI / 12)]);
  const map = list => list.map(q => applyTransform(m, q));
  return {polys: [...g.polys, ...g.circles.map(ellipse)].map(map), lines: g.lines.map(map), circles: [], width: g.width};
}
const inGeometry = (g, p, tol) => g.polys.some(poly => inPoly(poly, p) || nearPoly(poly, p, tol))
  || g.lines.some(l => nearPoly(l, p, tol + g.width / 2, false))
  || g.circles.some(([cx, cy, rx, ry]) => ((p[0] - cx) / (rx + tol)) ** 2 + ((p[1] - cy) / (ry + tol)) ** 2 <= 1);

// A piece of furniture's outline: a polygon, or a circle [cx, cy, r].
export function pieceOutline({shape: {rect, turn = 0, circle, poly}}) {
  if (rect) return {poly: box(...rect, turn)};
  if (circle) return {circle};
  return {poly};
}
// A room's region as polygons.
export const regionPolys = region => (Array.isArray(region?.[0]?.[0]) ? [region[0]] : (region || []).map(r => box(...r)));
// A light's centre: its pool's, or its first shape's middle.
export function lightCentre(g) {
  if (g.pool) return [g.pool.x, g.pool.y];
  const s = g.shape?.[0];
  if (s?.circle) return s.circle.slice(0, 2);
  if (s?.ellipse) return s.ellipse.slice(0, 2);
  if (s?.rect) return [s.rect[0] + s.rect[2] / 2, s.rect[1] + s.rect[3] / 2];
  if (s?.poly) return [s.poly.reduce((a, p) => a + p[0], 0) / s.poly.length, s.poly.reduce((a, p) => a + p[1], 0) / s.poly.length];
  return null;
}

// Every item under the point `p` ([x, y] in the drawing's units), front to back, as paths. `tol`: how near counts,
// in the drawing's units (a few pixels' worth).
export function hitTest(home, p, tol = 0) {
  const k = home.view.w / 1145, hits = [];
  (home.markers || []).forEach((m, i) => { if (Math.hypot(p[0] - m.x, p[1] - m.y) <= MARKER * home.view.w + tol) hits.push(['markers', i]); });
  (home.lights || []).forEach((g, i) => {
    const c = lightCentre(g);
    if (c && Math.hypot(p[0] - c[0], p[1] - c[1]) <= 2 * tol + 4 * k) hits.push(['lights', i]);
  });
  for (const [name, piece] of Object.entries(home.furniture || {}).reverse()) {
    const o = pieceOutline(piece);
    if (o.poly ? inPoly(o.poly, p) || nearPoly(o.poly, p, tol) : Math.hypot(p[0] - o.circle[0], p[1] - o.circle[1]) <= o.circle[2] + tol) hits.push(['furniture', name]);
  }
  (home.openings || []).forEach((o, i) => { if (inRect(shutterRect(o), p, tol)) hits.push(['openings', i]); });
  (home.lights || []).forEach((g, i) => {
    if (!hits.some(h => h[0] === 'lights' && h[1] === i) && (g.shape || []).some(s => inGeometry(shapeGeometry(s, k), p, tol))) hits.push(['lights', i]);
  });
  for (const slot of [...SLOTS].reverse()) {
    const list = home.drawing?.[slot];
    if (!Array.isArray(list)) continue;
    for (let i = list.length - 1; i >= 0; i--) if (inGeometry(shapeGeometry(list[i], k), p, tol)) hits.push(['drawing', slot, i]);
  }
  for (const [name, region] of Object.entries(home.rooms || {}).reverse()) {
    if (regionPolys(region).some(poly => inPoly(poly, p))) hits.push(['rooms', name]);
  }
  return hits;
}

// The item at `path` in `home`, or undefined.
export const itemAt = (home, path) => path.reduce((o, k) => o?.[k], home);

// An item's outline for the overlay, as SVG markup: polygons, polylines and circles (styled by the overlay).
// `extra`: for a light, its pool's circle too (dashed, class "pool").
export function outlineSvg(home, path) {
  const item = itemAt(home, path), k = home.view.w / 1145, f = v => +v.toFixed(1);
  if (!item) return '';
  const pts = poly => poly.map(q => q.map(f).join(',')).join(' ');
  const geometry = g => [...g.polys.map(poly => `<polygon points="${pts(poly)}"/>`),
    ...g.lines.map(l => `<polyline points="${pts(l)}"/>`),
    ...g.circles.map(([cx, cy, rx, ry]) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"/>`)].join('');
  switch (path[0]) {
    case 'markers': return `<circle cx="${item.x}" cy="${item.y}" r="${f(MARKER * home.view.w)}"/>`;
    case 'furniture': {
      const o = pieceOutline(item);
      return o.poly ? `<polygon points="${pts(o.poly)}"/>` : `<circle cx="${o.circle[0]}" cy="${o.circle[1]}" r="${o.circle[2]}"/>`;
    }
    case 'openings': {
      const [x, y, w, h] = shutterRect(item);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    }
    case 'lights': {
      const shapes = (item.shape || []).map(s => geometry(shapeGeometry(s, k))).join('');
      const pool = item.pool ? `<circle class="pool" cx="${item.pool.x}" cy="${item.pool.y}" r="${item.pool.r}"/>` : '';
      const c = lightCentre(item);
      return shapes + pool + (c ? `<circle class="dot" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(4 * k)}"/>` : '');
    }
    case 'drawing': return path.length === 3 ? geometry(shapeGeometry(item, k)) : '';
    case 'rooms': return regionPolys(item).map(poly => `<polygon points="${pts(poly)}"/>`).join('');
    default: return '';
  }
}
