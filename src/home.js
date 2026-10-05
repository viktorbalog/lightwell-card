// A home: everything the card draws and which entities it shows, as one plain object (it could come from YAML).
// `defineHome` fills the defaults and checks that every name refers to something that exists, so a mistake fails
// with a message instead of a blank card.
//
// - `view` {x, y, w, h}: the part of the drawing the card shows, in the drawing's own units.
// - `units_per_metre`: the drawing's scale, for the lengths of shadows.
// - `rooms`: {name: region}, a region being [x, y, w, h] rectangles or one polygon [[[x, y], ...]]. Each becomes a
//   clip path, which keeps light inside the room.
// - `drawing`: the static drawing, as shape lists (shapes.js) by slot. The card's own layers go between the slots:
//   `background` (an image: {image, rect}); `floors`; daylight and sun on the floor; lights on the floor; `walls`;
//   `glazing`; shutters; `fittings`; lights over the fittings (`top`); the lamps' furniture shadows;
//   `under_furniture`; the furniture; `on_furniture`; daylight on the furniture tops; lights over the furniture
//   (`over`); `labels`.
// - `openings`: windows and doors (openings.js), where the sun and daylight come in.
// - `furniture`: {name: piece} (furniture.js).
// - `lights`: lights drawn as glows. The first of `entities` whose state is in `states` (default [on]) lights it, in
//   that entity's colour, or `color` ([r, g, b]). A light without entities (a lamp that isn't smart) has `lit`
//   instead: `always`, `dark` (while the sun is down) or `never`, in its `color` or warm white. `shape`: shapes, blurred; `top` draws it over the fittings,
//   `over` over the furniture too (otherwise it's on the floor); `clip`: the room it stays in; `pool`: {x, y, r,
//   height, shadows}, a soft pool of light around a point light `height` metres up, with the furniture named in
//   `shadows` casting shadows from it; `outdoor`: fades out in daylight; `effect`: an effect it always plays while
//   lit; `multi`: keeps the shapes' own colours (an on/off string of coloured bulbs).
// - `effects`: flows by name (effects.js); `markers`: the markers over the plan (markers.js).
// - `sun`: the surroundings for the sun and daylight (sun.js).
// - `palette`: {light: {class: colour}, dark: {…}, tinted: [class]}, added to the card's own (card.js); `tinted`
//   classes take on the time of day's tint.
// - `simulator`: for the simulator's time presets: {scenes: {Preset: {lights, media, shutters} or another preset's
//   name}}, lights and media players 'on' or 'off', shutters {entity: position}. The card itself ignores it.
// - `description`: a note, on the home and on any item that is a map (an opening, a piece, a light, a marker, a shape,
//   a spill, a blocker). The card ignores it; it's there for the people (and editors) reading the home, and unlike a
//   YAML comment it survives a dashboard, which keeps its cards as JSON.
// - `part`: on a shape, an opening, a light or a marker, the id of the object the editor's Build view made it as (a
//   room's walls, floor and label carry the room's name; a window's glass and opening `window_1`), so that they're
//   selected, moved and deleted together there. The card ignores it.
import {openingErrors} from './openings.js';
import {shapeErrors} from './shapes.js';
import {LABEL_KEYS} from './markers.js';

export const SLOTS = ['floors', 'walls', 'glazing', 'fittings', 'under_furniture', 'on_furniture', 'labels'];
// When a light without entities is lit: always, while the sun is down, or never.
export const LIT = ['always', 'dark', 'never'];

export function defineHome(home) {
  const h = {...home};
  for (const [k, v] of Object.entries({rooms: {}, openings: [], furniture: {}, lights: [], effects: {}, markers: []})) h[k] ??= v;
  const sun = h.sun = {...home.sun}, drawing = h.drawing = {...home.drawing};
  for (const [k, v] of Object.entries({entity: 'sun.sun', weather: 'weather.home', blockers: [], spill: [], trees: null, outdoor: []})) sun[k] ??= v;
  h.palette = {light: {}, dark: {}, tinted: [], ...home.palette};

  const errors = [];
  const fail = (where, msg) => errors.push(`${where}: ${msg}`);
  const room = (where, name) => { if (name !== undefined && !h.rooms[name]) fail(where, `no room called "${name}"`); };
  const entity = (where, id) => { if (id !== undefined && !/^[a-z_]+\.[a-z0-9_]+$/.test(id)) fail(where, `"${id}" isn't an entity id`); };
  const shapesFail = (where, list) => shapeErrors(list).forEach(e => errors.push(e.startsWith('[') ? `${where}${e}` : `${where}: ${e}`));
  const described = (where, item) => {
    if (item?.description !== undefined && typeof item.description !== 'string') fail(where ? `${where}.description` : 'description', 'needs a text');
    if (where && item?.part !== undefined && typeof item.part !== 'string') fail(`${where}.part`, 'needs a text');
  };

  described('', h);
  if (!['x', 'y', 'w', 'h'].every(k => typeof h.view?.[k] === 'number')) fail('view', 'needs numbers x, y, w and h');
  if (!(h.units_per_metre > 0)) fail('units_per_metre', 'needs a number above 0');
  for (const k of Object.keys(drawing)) if (!SLOTS.includes(k) && k !== 'background') fail(`drawing.${k}`, `isn't a slot (${SLOTS.join(', ')}, background)`);
  for (const k of SLOTS) shapesFail(`drawing.${k}`, drawing[k]);
  if (drawing.background && typeof drawing.background.image !== 'string') fail('drawing.background', 'needs an image URL');
  for (const [name, p] of Object.entries(h.furniture)) {
    const {rect, circle, poly} = p.shape || {};
    if (!rect && !circle && !poly) fail(`furniture.${name}`, 'needs a shape: rect, circle or poly');
    room(`furniture.${name}.shadow_room`, p.shadow_room);
    if (p.height !== undefined && !(p.height > 0)) fail(`furniture.${name}.height`, 'needs a number of metres above 0');
    shapesFail(`furniture.${name}.extra`, p.extra);
    described(`furniture.${name}`, p);
  }
  h.openings = h.openings.map(o => ({...o, sky: o.sky ?? o.room}));
  h.openings.forEach((o, i) => {
    const where = `openings[${i}]`;
    if (o.room === undefined) fail(where, 'needs the room its sun falls in');
    openingErrors(o).forEach(e => fail(where, e));
    room(`${where}.room`, o.room);
    room(`${where}.sky`, o.sky);
    entity(`${where}.shutter`, o.shutter);
    described(where, o);
  });
  h.lights.forEach((g, i) => {
    const where = `lights[${i}]`;
    if (!g.entities?.length && !g.lit) fail(where, 'needs entities, or lit: always, dark or never');
    if (g.lit !== undefined && !LIT.includes(g.lit)) fail(`${where}.lit`, `needs ${LIT.join(', ')}`);
    g.entities?.forEach(e => entity(`${where}.entities`, e));
    if (!g.shape?.length) fail(where, 'needs a shape');
    shapesFail(`${where}.shape`, g.shape);
    room(`${where}.clip`, g.clip);
    if (g.pool) for (const k of ['x', 'y', 'r', 'height']) if (typeof g.pool[k] !== 'number') fail(`${where}.pool`, `needs a number ${k}`);
    for (const name of g.pool?.shadows || []) if (!h.furniture[name]?.height) fail(`${where}.pool.shadows`, `no furniture with a height called "${name}"`);
    described(where, g);
  });
  h.markers.forEach((m, i) => {
    const where = `markers[${i}]`;
    entity(`${where}.entity`, m.entity);
    if (!m.entity) fail(where, 'needs an entity');
    for (const k of ['x', 'y']) if (typeof m[k] !== 'number') fail(where, `needs a number ${k}`);
    if (!m.icon) fail(where, 'needs an icon');
    for (const k of ['power', 'wake']) entity(`${where}.${k}`, m[k]);
    if (m.label !== undefined) {
      if (typeof m.label !== 'object') fail(`${where}.label`, 'needs settings ({attribute, unit, …}), not a function or text');
      else {
        for (const k of Object.keys(m.label)) if (!LABEL_KEYS.includes(k)) fail(`${where}.label`, `unknown setting "${k}" (${LABEL_KEYS.join(', ')})`);
        entity(`${where}.label.entity`, m.label.entity);
        for (const k of ['when', 'hide']) if (m.label[k] !== undefined && !Array.isArray(m.label[k])) fail(`${where}.label.${k}`, 'needs a list');
      }
    }
    if (m.active !== undefined && !Array.isArray(m.active)) fail(`${where}.active`, 'needs a list of states');
    if (m.icons !== undefined && typeof m.icons !== 'object') fail(`${where}.icons`, 'needs {state: icon}');
    described(where, m);
  });
  if (typeof sun.north !== 'number') fail('sun.north', 'needs the compass bearing of the top of the drawing');
  entity('sun.entity', sun.entity);
  entity('sun.weather', sun.weather);
  sun.spill.forEach((p, i) => {
    room(`sun.spill[${i}].clip`, p.clip);
    for (const k of p.from || []) if (!h.openings[k]) fail(`sun.spill[${i}].from`, `no opening ${k}`);
    described(`sun.spill[${i}]`, p);
  });
  shapesFail('sun.outdoor', sun.outdoor);
  sun.blockers.forEach((b, i) => {
    if (!b.rect && !b.poly) fail(`sun.blockers[${i}]`, 'needs a rect or a poly');
    if (!(b.height > 0)) fail(`sun.blockers[${i}]`, 'needs a height in metres');
    described(`sun.blockers[${i}]`, b);
  });
  for (const mode of ['light', 'dark']) {
    for (const [k, v] of Object.entries(h.palette[mode])) if (typeof v !== 'string') fail(`palette.${mode}.${k}`, 'needs a colour');
  }
  for (const k of h.palette.tinted) {
    if (!/^#[0-9a-f]{6}$/i.test(h.palette.light[k] ?? '#000000') || !/^#[0-9a-f]{6}$/i.test(h.palette.dark[k] ?? '#000000')) {
      fail(`palette.tinted`, `"${k}" needs #rrggbb colours to be tinted`);
    }
  }
  for (const [name, sc] of Object.entries(h.simulator?.scenes || {})) {
    if (typeof sc === 'string') { if (!h.simulator.scenes[sc]) fail(`simulator.scenes.${name}`, `no scene called "${sc}"`); continue; }
    for (const k of ['lights', 'media']) if (sc[k] !== undefined && !['on', 'off'].includes(sc[k])) fail(`simulator.scenes.${name}.${k}`, "needs 'on' or 'off'");
    for (const id of Object.keys(sc.shutters || {})) entity(`simulator.scenes.${name}.shutters`, id);
  }
  if (errors.length) throw new Error(`Invalid home:\n${errors.join('\n')}`);
  return h;
}

// Every entity a home shows: the card renders again only when one of these changes, and the simulator's snapshot.sh
// saves their states.
export const entitiesOf = home => [...new Set([
  ...home.lights.flatMap(g => g.entities || []),
  ...home.markers.flatMap(m => [m.entity, m.power, m.wake, m.label?.entity]).filter(Boolean),
  ...home.openings.map(o => o.shutter).filter(Boolean), home.sun.entity, home.sun.weather,
])];
