// The Build view's furniture catalogue: pieces of real sizes, with their heights and their details (cushions,
// pillows, the sink, a TV), placed by a click. Pure: `placePrefab` turns one into the model's changes.
//
// A prefab is drawn in metres, from its top left corner, facing down the plan (a sofa's back at the top); it's
// placed by its middle, turned by a quarter turn or more (so its shapes stay rectangles), and scaled to the home's
// units. Its details are its `extra` shapes. A table with chairs is several pieces. What one makes is one object, tagged
// (`part`) after the prefab (`dining_4_1`): the Build view picks, moves and turns it as one, and knows what it was.
import {roomAt} from './create.js';
import {partKey} from './build.js';
import {tidy} from './manipulate.js';

// Shapes, in metres from the piece's top left: rect [x, y, w, h] (rx), circle [cx, cy, r], ellipse [cx, cy, rx, ry],
// line [[x, y], [x, y]].
const R = (x, y, w, h, cls = 'furn2', rx) => ({rect: [x, y, w, h], class: cls, ...(rx ? {rx} : {})});
const C = (cx, cy, r, cls = 'dev') => ({circle: [cx, cy, r], class: cls});
const E = (cx, cy, rx, ry, cls = 'furn2') => ({ellipse: [cx, cy, rx, ry], class: cls});
const L = (x1, y1, x2, y2) => ({line: [[x1, y1], [x2, y2]]});

// A sofa or armchair `w` wide: its back along the top, its arms, the seat split into `seats` cushions.
const seating = (w, d, seats) => {
  const arm = 0.18, back = 0.2, inner = w - 2 * arm, out = [R(0, 0, w, back, 'furn2', 0.05), R(0, 0, arm, d, 'furn2', 0.05), R(w - arm, 0, arm, d, 'furn2', 0.05)];
  for (let i = 1; i < seats; i++) out.push(L(arm + inner * i / seats, back, arm + inner * i / seats, d - 0.04));
  return out;
};
// A bed `w` wide: a pillow (or two) at the head, the duvet's fold.
const bed = (w, pillows) => {
  const pw = (w - 0.1 * (pillows + 1)) / pillows;
  return [...Array.from({length: pillows}, (_, i) => R(0.1 + i * (pw + 0.1), 0.1, pw, 0.4, 'furn2', 0.06)), L(0.02, 0.65, w - 0.02, 0.65)];
};
const chair = {w: 0.45, d: 0.45, height: 0.9, cls: 'furn2', rx: 0.05, extra: [R(0.02, 0, 0.41, 0.08, 'furn', 0.03)]};

// The catalogue, by room: {id: {name, w, d, height, cls, rx, extra, shape: 'rect' | 'circle'}} or, for several pieces,
// {name, w, d, pieces: [{of: id, at: [x, y] (its middle, in metres from the group's top left), turn}]}, or, for a
// light, {name, w, d, lamp: {glow: shapes (a line's `width`: the strip's), pool: {r, height} (metres), top, icon},
// base: a piece under it (a floor lamp's foot)}. A light is one object (`part`): its glow and pool, its marker, its base.
export const PREFABS = {
  living: {
    title: 'Living room',
    items: {
      sofa_2: {name: 'Sofa for 2', w: 1.6, d: 0.9, height: 0.8, rx: 0.08, extra: seating(1.6, 0.9, 2)},
      sofa_3: {name: 'Sofa for 3', w: 2.2, d: 0.9, height: 0.8, rx: 0.08, extra: seating(2.2, 0.9, 3)},
      corner_sofa: {name: 'Corner sofa', w: 2.5, d: 1.7, height: 0.8, poly: [[0, 0], [2.5, 0], [2.5, 0.9], [0.9, 0.9], [0.9, 1.7], [0, 1.7]],
        extra: [R(0, 0, 2.5, 0.2, 'furn2', 0.05), R(0, 0, 0.2, 1.7, 'furn2', 0.05), R(2.32, 0, 0.18, 0.9, 'furn2', 0.05), L(0.2, 0.9, 0.9, 0.9), L(1.6, 0.2, 1.6, 0.86)]},
      armchair: {name: 'Armchair', w: 0.85, d: 0.85, height: 0.8, rx: 0.08, extra: seating(0.85, 0.85, 1)},
      coffee_table: {name: 'Coffee table', w: 1.1, d: 0.6, height: 0.45, rx: 0.05},
      tv_unit: {name: 'TV unit', w: 1.6, d: 0.4, height: 0.5, extra: [R(0.25, 0.04, 1.1, 0.06, 'dev')]},
      bookcase: {name: 'Bookcase', w: 1.0, d: 0.35, height: 2.0, extra: [L(0.5, 0.02, 0.5, 0.33)]},
      rug: {name: 'Rug', w: 2.0, d: 1.4, cls: 'furn2', rx: 0.05},
    },
  },
  bedroom: {
    title: 'Bedroom',
    items: {
      double_bed: {name: 'Double bed', w: 1.6, d: 2.0, height: 0.55, rx: 0.05, extra: bed(1.6, 2)},
      single_bed: {name: 'Single bed', w: 0.9, d: 2.0, height: 0.55, rx: 0.05, extra: bed(0.9, 1)},
      bedside_table: {name: 'Bedside table', w: 0.45, d: 0.4, height: 0.5, cls: 'furn2', rx: 0.03},
      wardrobe: {name: 'Wardrobe', w: 1.2, d: 0.6, height: 2.0, extra: [L(0.6, 0.04, 0.6, 0.56)]},
      desk: {name: 'Desk', w: 1.2, d: 0.6, height: 0.75},
      chair: {name: 'Chair', ...chair},
    },
  },
  kitchen: {
    title: 'Kitchen and dining',
    items: {
      counter: {name: 'Counter with sink and hob', w: 2.4, d: 0.6, height: 0.9,
        extra: [R(0.3, 0.1, 0.6, 0.4, 'fix2', 0.05), C(1.55, 0.2, 0.08), C(1.85, 0.2, 0.08), C(1.55, 0.42, 0.07), C(1.85, 0.42, 0.07)]},
      fridge: {name: 'Fridge', w: 0.6, d: 0.65, height: 1.8, extra: [L(0.03, 0.6, 0.57, 0.6)]},
      dining_2: {name: 'Table for 2', w: 0.8, d: 1.7, pieces: [{of: 'table_s', at: [0.4, 0.85]}, {of: 'chair', at: [0.4, 0.22]}, {of: 'chair', at: [0.4, 1.48], turn: 180}]},
      dining_4: {name: 'Table for 4', w: 1.2, d: 1.7, pieces: [{of: 'table_m', at: [0.6, 0.85]},
        ...[0.32, 0.88].flatMap(x => [{of: 'chair', at: [x, 0.22]}, {of: 'chair', at: [x, 1.48], turn: 180}])]},
      dining_6: {name: 'Table for 6', w: 1.8, d: 1.8, pieces: [{of: 'table_l', at: [0.9, 0.9]},
        ...[0.4, 1.4].flatMap(x => [{of: 'chair', at: [x, 0.22]}, {of: 'chair', at: [x, 1.58], turn: 180}]),
        {of: 'chair', at: [0.22 - 0.3, 0.9], turn: 270}, {of: 'chair', at: [1.58 + 0.3, 0.9], turn: 90}]},
    },
  },
  lights: {
    title: 'Lights',
    items: {
      ceiling_lamp: {name: 'Ceiling lamp', w: 0.6, d: 0.6, lamp: {glow: [C(0.3, 0.3, 0.5)], pool: {r: 3.5, height: 2.4}, icon: 'mdi:ceiling-light'}},
      pendant: {name: 'Pendant', w: 0.4, d: 0.4, lamp: {glow: [C(0.2, 0.2, 0.4)], pool: {r: 2.5, height: 1.8}, icon: 'mdi:ceiling-light-outline'}},
      floor_lamp: {name: 'Floor lamp', w: 0.4, d: 0.4, base: {w: 0.36, d: 0.36, shape: 'circle', cls: 'furn2'},
        lamp: {glow: [C(0.2, 0.2, 0.4)], pool: {r: 3, height: 1.6}, icon: 'mdi:floor-lamp'}},
      table_lamp: {name: 'Table lamp', w: 0.3, d: 0.3, lamp: {glow: [C(0.15, 0.15, 0.25)], pool: {r: 2, height: 0.7}, icon: 'mdi:lamp'}},
      strip_1: {name: 'Light strip 1 m', w: 1, d: 0.1, lamp: {glow: [{line: [[0, 0.05], [1, 0.05]], width: 0.15}], top: true, icon: 'mdi:led-strip-variant'}},
      strip_2: {name: 'Light strip 2 m', w: 2, d: 0.1, lamp: {glow: [{line: [[0, 0.05], [2, 0.05]], width: 0.15}], top: true, icon: 'mdi:led-strip-variant'}},
    },
  },
  bathroom: {
    title: 'Bathroom',
    items: {
      bath: {name: 'Bath', w: 1.7, d: 0.75, height: 0.6, rx: 0.08, extra: [R(0.08, 0.08, 1.54, 0.59, 'fix2', 0.25), C(1.5, 0.375, 0.03)]},
      shower: {name: 'Shower', w: 0.9, d: 0.9, cls: 'furn2', extra: [L(0, 0, 0.9, 0.9), L(0.9, 0, 0, 0.9), C(0.45, 0.45, 0.04)]},
      toilet: {name: 'Toilet', w: 0.4, d: 0.65, height: 0.4, cls: 'furn2', rx: 0.05, extra: [R(0, 0, 0.4, 0.18, 'furn', 0.03), E(0.2, 0.42, 0.16, 0.2, 'furn')]},
      washbasin: {name: 'Washbasin', w: 0.6, d: 0.45, height: 0.85, rx: 0.05, extra: [E(0.3, 0.25, 0.22, 0.15, 'fix2'), C(0.3, 0.06, 0.025)]},
      washing_machine: {name: 'Washing machine', w: 0.6, d: 0.6, height: 0.85, extra: [C(0.3, 0.32, 0.2, 'furn2'), C(0.3, 0.32, 0.13)]},
    },
  },
};
// Pieces that only come as part of a group.
const PARTS = {
  table_s: {name: 'Table', w: 0.8, d: 0.8, height: 0.75, rx: 0.03},
  table_m: {name: 'Table', w: 1.2, d: 0.8, height: 0.75, rx: 0.03},
  table_l: {name: 'Table', w: 1.8, d: 0.9, height: 0.75, rx: 0.03},
  chair: PREFABS.bedroom.items.chair,
};

// A prefab by its id.
export const prefab = id => Object.values(PREFABS).map(g => g.items[id]).find(Boolean) || PARTS[id];

// A point in metres from the piece's middle, turned by `turn` degrees (a quarter turn or more, clockwise as the plan
// is drawn, y down).
const turned = ([x, y], turn) => {
  const q = ((Math.round(turn / 90) % 4) + 4) % 4;
  return [[x, y], [-y, x], [-x, -y], [y, -x]][q];
};

// A prefab's shapes placed: each shape in metres from its top left (`w` × `d`), turned around the middle and moved to
// `at` in the drawing, at `u` units a metre.
function placeShape(s, {w, d}, at, turn, u) {
  const p = ([x, y]) => { const [a, b] = turned([x - w / 2, y - d / 2], turn); return [tidy(at[0] + a * u), tidy(at[1] + b * u)]; };
  const swap = Math.round(turn / 90) % 2 !== 0;
  const {class: cls, rx} = s, rest = {...(cls ? {class: cls} : {}), ...(rx ? {rx: tidy(rx * u)} : {})};
  if (s.rect) {
    const [x, y, rw, rh] = s.rect, [a, b] = [p([x, y]), p([x + rw, y + rh])];
    return {rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), tidy(Math.abs(b[0] - a[0])), tidy(Math.abs(b[1] - a[1]))], ...rest};
  }
  if (s.circle) return {circle: [...p(s.circle), tidy(s.circle[2] * u)], ...rest};
  if (s.ellipse) {
    const [rx2, ry2] = swap ? [s.ellipse[3], s.ellipse[2]] : [s.ellipse[2], s.ellipse[3]];
    return {ellipse: [...p(s.ellipse), tidy(rx2 * u), tidy(ry2 * u)], ...rest};
  }
  if (s.poly) return {poly: s.poly.map(p), ...rest};
  if (s.line) { const [a, b] = s.line.map(p); return {path: `M${a[0]},${a[1]} L${b[0]},${b[1]}`, class: 'line'}; }
  throw new Error(`not a prefab shape: ${JSON.stringify(s)}`);
}

// One prefab piece (not a group) at `at` (its middle), turned: the furniture value, with its shadow room.
export function pieceOf(data, item, at, turn = 0) {
  const u = data?.units_per_metre || 100;
  const outline = placeShape(item.poly ? {poly: item.poly} : item.shape === 'circle' ? {circle: [item.w / 2, item.d / 2, item.w / 2]}
    : {rect: [0, 0, item.w, item.d], rx: item.rx}, item, at, turn, u);
  const room = item.height ? roomAt(data, at) : undefined;
  return {
    shape: outline.poly ? {poly: outline.poly} : outline.circle ? {circle: outline.circle} : {rect: outline.rect, ...(outline.rx ? {rx: outline.rx} : {})},
    ...(item.height ? {height: item.height} : {}),
    ...(room ? {shadow_room: room} : {}),
    ...(item.cls === 'furn2' ? {class: 'furn2'} : {}),
    ...(item.extra?.length ? {extra: item.extra.map(s => placeShape(s, item, at, turn, u))} : {}),
  };
}

// A key for a new piece, from `base`, unique among the home's furniture and `taken`.
function pieceKey(data, base, taken) {
  let key = base;
  for (let n = 2; data?.furniture?.[key] !== undefined || taken.has(key); n++) key = `${base}_${n}`;
  taken.add(key);
  return key;
}

// The prefab `id` placed with its middle at `at` (in the drawing), turned by `turn` degrees: {ops, keys, part} (the
// new pieces' keys, in order; the object they're part of), or null for an unknown id.
export function placePrefab(data, id, at, turn = 0, {entity = 'light.new_light'} = {}) {
  const item = prefab(id), u = data?.units_per_metre || 100;
  if (!item) return null;
  if (item.lamp) return placeLamp(data, item, id, at, turn, entity);
  const taken = new Set(), ops = [], keys = [], group = partKey(data, id);
  const parts = item.pieces || [{of: id, at: [item.w / 2, item.d / 2]}];
  for (const part of parts) {
    const piece = prefab(part.of), [a, b] = turned([part.at[0] - item.w / 2, part.at[1] - item.d / 2], turn);
    const key = pieceKey(data, part.of.replace(/^table_[sml]$/, 'table'), taken);
    ops.push({set: ['furniture', key], value: {...pieceOf(data, piece, [tidy(at[0] + a * u), tidy(at[1] + b * u)], turn + (part.turn || 0)), part: group}});
    keys.push(key);
  }
  return {ops, keys, part: group};
}

// A light from the catalogue at `at`, lit by `entity`: its glow (and pool, in which the room's pieces with a height cast
// shadows), its marker (switching it), and its base: {ops, keys, part}, all of it part `lamp_1`….
function placeLamp(data, item, id, at, turn, entity) {
  const u = data?.units_per_metre || 100, part = partKey(data, 'lamp'), [x, y] = at.map(tidy), room = roomAt(data, at);
  const shape = item.lamp.glow.map(s => {
    const placed = placeShape({...s, class: undefined}, item, at, turn, u);
    return s.line ? {path: placed.path, stroke_width: tidy(s.width * u), fill: 'none'} : placed;
  });
  const shadows = Object.entries(data?.furniture || {}).filter(([, p]) => p?.height && (!room || p.shadow_room === room)).map(([n]) => n);
  const light = {entities: [entity], shape, ...(item.lamp.top ? {top: true} : {over: true}), ...(room ? {clip: room} : {}),
    ...(item.lamp.pool ? {pool: {x, y, r: tidy(item.lamp.pool.r * u), height: item.lamp.pool.height, shadows}} : {}), part};
  const ops = [{insert: ['lights'], value: light},
    {insert: ['markers'], value: {entity, x, y, icon: item.lamp.icon, tap: 'toggle', small: true, part}}];
  const keys = [];
  if (item.base) {
    const key = pieceKey(data, id, new Set());
    ops.push({set: ['furniture', key], value: {...pieceOf(data, item.base, at, turn), part}});
    keys.push(key);
  }
  return {ops, keys, part};
}

// A small drawing of a prefab for the catalogue: SVG in metres, its view a little larger than it.
export function prefabSvg(id) {
  const item = prefab(id);
  if (item.lamp) {
    const glow = item.lamp.glow.map(s => (s.line ? `<path class="glow-line" d="M${s.line[0].join(',')} L${s.line[1].join(',')}" stroke-width="${s.width}"/>`
      : `<circle class="glow" cx="${s.circle[0]}" cy="${s.circle[1]}" r="${s.circle[2]}"/>`)).join('');
    const base = item.base ? `<circle class="furn2" cx="${item.w / 2}" cy="${item.d / 2}" r="${item.base.w / 2}"/>` : '';
    const r = Math.max(...item.lamp.glow.map(s => (s.circle ? s.circle[2] : 0)), item.w / 2, 0.3), c = [item.w / 2, item.d / 2];
    return `<svg viewBox="${tidy(c[0] - r - 0.05)} ${tidy(c[1] - r - 0.05)} ${tidy(2 * r + 0.1)} ${tidy(2 * r + 0.1)}">${glow}${base}</svg>`;
  }
  const parts = item.pieces || [{of: id, at: [item.w / 2, item.d / 2]}];
  const xs = [], ys = [];
  const body = parts.map(part => {
    const piece = prefab(part.of), data = {units_per_metre: 1};
    const v = pieceOf(data, piece, part.at, part.turn || 0);
    const shapes = [v.shape.poly ? {poly: v.shape.poly, class: v.class || 'furn'} : {rect: v.shape.rect, rx: v.shape.rx, class: v.class || 'furn'}, ...(v.extra || [])];
    return shapes.map(s => {
      if (s.rect) { xs.push(s.rect[0], s.rect[0] + s.rect[2]); ys.push(s.rect[1], s.rect[1] + s.rect[3]); return `<rect class="${s.class}" x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}"${s.rx ? ` rx="${s.rx}"` : ''}/>`; }
      if (s.poly) { s.poly.forEach(([x, y]) => { xs.push(x); ys.push(y); }); return `<polygon class="${s.class}" points="${s.poly.map(q => q.join(',')).join(' ')}"/>`; }
      if (s.circle) return `<circle class="${s.class}" cx="${s.circle[0]}" cy="${s.circle[1]}" r="${s.circle[2]}"/>`;
      if (s.ellipse) return `<ellipse class="${s.class}" cx="${s.ellipse[0]}" cy="${s.ellipse[1]}" rx="${s.ellipse[2]}" ry="${s.ellipse[3]}"/>`;
      return `<path class="line" d="${s.path}"/>`;
    }).join('');
  }).join('');
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], pad = 0.1;
  return `<svg viewBox="${tidy(x0 - pad)} ${tidy(y0 - pad)} ${tidy(x1 - x0 + 2 * pad)} ${tidy(y1 - y0 + 2 * pad)}">${body}</svg>`;
}

// A piece of furniture turned by `deg` (a quarter turn or more) around its middle, as R does in the Build view: a
// rectangle or a polygon by its `turn` (its insides turn with it), a circle with its insides moved round. Paths
// other than straight lines (M x,y L x,y) stay as they are.
export function turnedPiece(piece, deg) {
  const s = piece?.shape;
  if (!s) return piece;
  if (s.rect || s.poly) {
    const turn = (((s.turn || 0) + deg) % 360 + 360) % 360;
    const {turn: _, ...rest} = s;
    return {...piece, shape: turn ? {...rest, turn} : rest};
  }
  const pts = s.poly || [s.circle.slice(0, 2)];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const t = ([x, y]) => { const [a, b] = turned([x - c[0], y - c[1]], deg); return [tidy(c[0] + a), tidy(c[1] + b)]; };
  const swap = Math.round(deg / 90) % 2 !== 0;
  const one = sh => {
    if (sh.rect) {
      const [a, b] = [t(sh.rect.slice(0, 2)), t([sh.rect[0] + sh.rect[2], sh.rect[1] + sh.rect[3]])];
      return {...sh, rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), tidy(Math.abs(b[0] - a[0])), tidy(Math.abs(b[1] - a[1]))]};
    }
    if (sh.circle) return {...sh, circle: [...t(sh.circle), sh.circle[2]]};
    if (sh.ellipse) return {...sh, ellipse: [...t(sh.ellipse), ...(swap ? [sh.ellipse[3], sh.ellipse[2]] : sh.ellipse.slice(2))]};
    if (sh.poly) return {...sh, poly: sh.poly.map(t)};
    const line = typeof sh.path === 'string' && sh.path.match(/^M\s*(-?[\d.]+)[ ,](-?[\d.]+)\s*L\s*(-?[\d.]+)[ ,](-?[\d.]+)$/);
    if (line) { const [a, b] = [t([+line[1], +line[2]]), t([+line[3], +line[4]])]; return {...sh, path: `M${a[0]},${a[1]} L${b[0]},${b[1]}`}; }
    return sh;
  };
  return {...piece, shape: one(s), ...(Array.isArray(piece.extra) ? {extra: piece.extra.map(one)} : {})};
}
