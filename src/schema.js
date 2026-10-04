// Every field of a home, described once: its type, whether it's required, its default, its unit and a line of help.
// The editor's property panel is generated from it, and a test (schema.test.js) checks that it agrees with
// defineHome: every field in the example homes is described, and the fields marked `check` (defineHome checks them)
// or `required` are the ones it fails on.
//
// A field: {type, help, required, check, default, unit, ...}. Types:
// - number (`unit`: u for the drawing's units, m, °, %, ms; `min`), string, bool, enum (`values`), color (CSS);
// - entity (`domain`: the domain, or domains, that fit), room (a room's name), effect (an effect's name), icon (mdi:…),
//   attribute (an attribute of the entity a marker's label reads);
// - numbers: a fixed list of numbers with `labels` ([x, y, w, h]); rgb: [r, g, b]; points: a polygon [[x, y], ...];
// - list (`of`: the items' field), map (`of`: the values' field, by name), object (`fields`);
// - shape: a shape (shapes.js), with any SVG attributes besides its own fields;
// - yaml: anything, edited as YAML text (shape lists, regions, label lists).

const n = (help, extra) => ({type: 'number', unit: 'u', help, ...extra});
const m = (help, extra) => ({type: 'number', unit: 'm', help, ...extra});
const RECT = ['x', 'y', 'w', 'h'];

export const SHAPE_KINDS = ['rect', 'circle', 'ellipse', 'poly', 'path', 'text', 'svg'];

// A shape in a drawing slot (shapes.js): its geometry fields; anything else is an SVG attribute.
export const SHAPE = {type: 'shape', check: true, help: 'A shape: one of rect, circle, ellipse, poly, path, text or svg, plus SVG attributes', fields: {
  rect: {type: 'numbers', labels: RECT, unit: 'u', help: 'A rectangle [x, y, w, h]'},
  circle: {type: 'numbers', labels: ['cx', 'cy', 'r'], unit: 'u', help: 'A circle [cx, cy, r]'},
  ellipse: {type: 'numbers', labels: ['cx', 'cy', 'rx', 'ry'], unit: 'u', help: 'An ellipse [cx, cy, rx, ry]'},
  poly: {type: 'points', unit: 'u', help: 'A polygon [[x, y], ...]'},
  path: {type: 'string', help: "An SVG path ('M0,0 H10')"},
  text: {type: 'string', help: 'A text, at `at`'},
  at: {type: 'numbers', labels: ['x', 'y'], unit: 'u', check: true, help: 'Where a text is: [x, y]'},
  svg: {type: 'string', help: 'Raw SVG, for anything else'},
  class: {type: 'string', help: 'Its colour, from the theme: floor, wall, iwall, fix, fix2, glass, dev, line, room, lbl, or a palette class'},
  rx: n('Round corners (a rect)'),
  repeat: {type: 'object', help: 'Draws the shape count times, each copy moved on by step', fields: {
    count: {type: 'number', help: 'How many copies', min: 1}, step: {type: 'numbers', labels: ['dx', 'dy'], unit: 'u', help: 'How far each copy moves on'}}},
}};
const SHAPES = help => ({type: 'list', of: SHAPE, help, check: true});

const OPENING = {type: 'object', check: true, help: 'A window or door, where the sun and daylight come in', fields: {
  wall: {type: 'enum', values: ['top', 'bottom', 'left', 'right'], required: true, help: 'The side of the drawing its wall faces out to'},
  at: n("The wall's outer face: a y on a top or bottom wall, an x on a left or right one", {required: true}),
  depth: n("The wall's thickness", {required: true}),
  x: n('Where it starts along a top or bottom wall', {when: {wall: ['top', 'bottom']}, required: true}),
  w: n('How wide it is, along a top or bottom wall', {when: {wall: ['top', 'bottom']}, required: true}),
  y: n('Where it starts along a left or right wall', {when: {wall: ['left', 'right']}, required: true}),
  h: n('How long it is, along a left or right wall', {when: {wall: ['left', 'right']}, required: true}),
  lo: m('The glass from this high above the floor', {required: true}),
  hi: m('The glass up to this high above the floor', {required: true}),
  shutter: {type: 'entity', domain: 'cover', check: true, help: "A cover: its position darkens the opening and shortens the sun's patch"},
  room: {type: 'room', required: true, help: "The room the sun's patch falls in"},
  sky: {type: 'room', check: true, help: 'The room the daylight spreads over (default: room)'},
}};

const PIECE = {type: 'object', check: true, help: 'A piece of furniture: drawn, casting shadows, with daylight on its top', fields: {
  shape: {type: 'object', required: true, help: 'Its outline: a rect (turned by turn degrees), a circle or a poly', fields: {
    rect: {type: 'numbers', labels: RECT, unit: 'u', help: 'A rectangle [x, y, w, h]'},
    rx: n('Round corners'),
    turn: {type: 'number', unit: '°', help: 'Turned by this many degrees around its centre (clockwise)'},
    circle: {type: 'numbers', labels: ['cx', 'cy', 'r'], unit: 'u', help: 'A circle [cx, cy, r]'},
    poly: {type: 'points', unit: 'u', help: 'A polygon [[x, y], ...]'},
  }},
  height: m('Its height; only pieces with one cast shadows', {check: true, min: 0}),
  shadow_room: {type: 'room', check: true, help: 'The room its shadow in the sun stays in; without one it casts none in the sun'},
  class: {type: 'enum', values: ['furn', 'furn2'], default: 'furn', help: 'furn, or furn2 for smaller, darker pieces'},
  extra: {...SHAPES('Shapes drawn with it, in its own frame and turned with it: cushions, devices on it, lines')},
}};

const LIGHT = {type: 'object', check: true, help: 'A light drawn as a glow, in its entity\'s colour and brightness', fields: {
  entities: {type: 'list', of: {type: 'entity', domain: ['light', 'switch', 'media_player', 'fan', 'input_boolean'], check: true, help: 'An entity'}, required: true, help: 'The first of them that is on lights it, in its colour'},
  states: {type: 'list', of: {type: 'string', help: 'A state'}, default: ['on'], help: 'What counts as on'},
  color: {type: 'rgb', help: '[r, g, b], for entities without a colour of their own'},
  shape: {...SHAPES('Shapes, blurred into a glow'), required: true},
  top: {type: 'bool', help: 'Drawn over the fittings (otherwise on the floor)'},
  over: {type: 'bool', help: 'Drawn over the furniture too'},
  clip: {type: 'room', check: true, help: 'The room it stays in'},
  pool: {type: 'object', check: true, help: 'A soft pool of light around a point light, with furniture casting shadows away from it', fields: {
    x: n('Its centre', {required: true}), y: n('Its centre', {required: true}), r: n('Its radius', {required: true}),
    height: m('How high the light is', {required: true}),
    shadows: {type: 'list', of: {type: 'furniture', check: true, help: 'A piece with a height'}, help: 'The furniture casting shadows from it'},
  }},
  outdoor: {type: 'bool', help: 'Fades out by day'},
  effect: {type: 'effect', help: 'An effect it plays all the time it is lit'},
  multi: {type: 'bool', help: "Keeps the shapes' own colours (a string of coloured bulbs)"},
}};

const MARKER = {type: 'object', check: true, help: 'A marker over the plan: tap toggles a light or switch, or opens the details', fields: {
  entity: {type: 'entity', required: true, help: 'What it shows'},
  x: n('Where it is', {required: true}), y: n('Where it is', {required: true}),
  icon: {type: 'icon', required: true, help: "Its icon (mdi:…)"},
  icons: {type: 'map', of: {type: 'icon', help: 'The icon in this state'}, check: true, help: 'Icons by state; weather entities follow their condition on their own'},
  tap: {type: 'enum', values: ['toggle'], help: 'toggle, or (left out) open the details'},
  small: {type: 'bool', help: 'A smaller marker'},
  side: {type: 'bool', help: 'The label to its right instead of below'},
  label: {type: 'object', check: true, help: 'The small text under the icon', fields: {
    entity: {type: 'entity', check: true, help: "Read this entity instead of the marker's"},
    attribute: {type: 'attribute', help: 'Show this attribute (otherwise the state)'},
    round: {type: 'number', help: 'Round to this many decimals', min: 0},
    unit: {type: 'string', help: "Appended, as in '°' or ' lx'"},
    when: {type: 'list', of: {type: 'string', help: 'A state'}, check: true, help: "Only while the marker's entity is in one of these states"},
    hide: {type: 'list', of: {type: 'string', help: 'A value'}, check: true, help: 'Values never shown'},
  }},
  active: {type: 'list', of: {type: 'string', help: 'A state'}, check: true, help: 'The states in which it shows as on'},
  power: {type: 'entity', check: true, help: "An entity that greys it out while it's off"},
  wake: {type: 'entity', domain: 'button', check: true, help: 'A button pressed on tap while power is off'},
}};

export const SCHEMA = {type: 'object', help: 'A home', fields: {
  view: {type: 'object', required: true, help: 'The part of the drawing the card shows', fields: {
    x: n('Its left edge', {required: true}), y: n('Its top edge', {required: true}),
    w: n('Its width', {required: true}), h: n('Its height', {required: true})}},
  units_per_metre: {type: 'number', required: true, min: 0, help: "The drawing's scale: how many of its units make a metre"},
  rooms: {type: 'map', of: {type: 'yaml', help: 'Rectangles [[x, y, w, h], ...], or one polygon [[[x, y], ...]]'},
    help: 'Light stays inside its room'},
  drawing: {type: 'object', help: 'The plan itself, as lists of shapes in slots, bottom to top', fields: {
    background: {type: 'object', check: true, help: 'A picture of the plan under everything', fields: {
      image: {type: 'string', required: true, help: "The picture's URL (/local/plan.png)"},
      rect: {type: 'numbers', labels: RECT, unit: 'u', help: 'Where it goes (default: the view)'}}},
    floors: SHAPES('Floors, under the daylight and the lamps'),
    walls: SHAPES('Walls, over the lamps on the floor'),
    glazing: SHAPES('Glass, under the blinds'),
    fittings: SHAPES('Kitchen counters, bathroom fittings'),
    under_furniture: SHAPES('Under the furniture, over its shadows: rugs'),
    on_furniture: SHAPES('On the furniture, under the daylight on it'),
    labels: SHAPES('Room names and labels, over everything'),
  }},
  openings: {type: 'list', of: OPENING, help: 'Windows and doors'},
  furniture: {type: 'map', of: PIECE, help: 'The furniture, by name, drawn in its order'},
  lights: {type: 'list', of: LIGHT, help: 'Lights drawn as glows'},
  effects: {type: 'map', of: {type: 'yaml', help: 'Steps [hue, saturation, brightness %, hold ms], or {fade, steps}'},
    help: 'Effects by name, adding to flicker'},
  markers: {type: 'list', of: MARKER, help: 'Markers over the plan'},
  sun: {type: 'object', required: true, help: 'The surroundings for the sun and daylight', fields: {
    north: {type: 'number', unit: '°', required: true, help: 'The compass bearing the top of the plan faces (0: north is up)'},
    entity: {type: 'entity', domain: 'sun', default: 'sun.sun', check: true, help: 'The sun'},
    weather: {type: 'entity', domain: 'weather', default: 'weather.home', check: true, help: 'The weather'},
    blockers: {type: 'list', check: true, help: 'Things outside that shade the openings', of: {type: 'object', check: true, help: 'A blocker', fields: {
      rect: {type: 'numbers', labels: RECT, unit: 'u', help: 'A rectangle [x, y, w, h]'},
      poly: {type: 'points', unit: 'u', help: 'A polygon [[x, y], ...]'},
      height: m('Its height', {required: true})}}},
    trees: {type: 'object', help: 'A band of sky where the sun is dimmed', fields: {
      from: {type: 'number', unit: '°', help: 'From this azimuth'}, to: {type: 'number', unit: '°', help: 'To this azimuth'},
      top: {type: 'number', unit: '°', help: 'Up to this elevation'}, through: {type: 'number', help: 'How much of the sun gets through (0–1)'}}},
    spill: {type: 'list', help: 'Daylight carried on through doors into rooms without windows', of: {type: 'object', help: 'A spill', fields: {
      cx: n('Its centre'), cy: n('Its centre'), rx: n('Its radius across'), ry: n('Its radius down'),
      clip: {type: 'room', check: true, help: 'The room it stays in'},
      from: {type: 'list', of: {type: 'number', check: true, help: "An opening's position in the list"}, help: 'The openings whose shutters dim it'},
      k: {type: 'number', help: 'How much of the daylight gets through (0–1)'}}}},
    outdoor: {...SHAPES('Shapes in the sun whenever it comes in (a terrace)')},
  }},
  palette: {type: 'object', help: "Colours for the drawing's classes, in light and dark", fields: {
    light: {type: 'map', of: {type: 'color', check: true, help: 'A colour'}, help: 'In the light theme'},
    dark: {type: 'map', of: {type: 'color', check: true, help: 'A colour'}, help: 'In the dark theme'},
    tinted: {type: 'list', of: {type: 'string', help: 'A class'}, check: true, help: "Classes taking the time of day's tint (#rrggbb colours)"}}},
  simulator: {type: 'object', help: "For the simulator's time presets", fields: {
    scenes: {type: 'map', help: 'What each time preset switches', of: {type: 'yaml',
      help: "{lights: on/off, media: on/off, shutters: {entity: position}}, or another preset's name"}}}},
}};

// The field at `path` (['furniture', 'sofa', 'shape', 'rect']), or undefined. Map keys and list indexes take the
// field of their values.
export function fieldAt(path, schema = SCHEMA) {
  let f = schema;
  for (const k of path) {
    if (!f) return undefined;
    if (f.type === 'list' || f.type === 'map') f = f.of;
    else if (f.type === 'object' || f.type === 'shape') f = f.fields[k] ?? (f.type === 'shape' ? {type: 'yaml', help: 'An SVG attribute (a list: its values in turn, copy by copy)'} : undefined);
    else if (f.type === 'numbers' || f.type === 'rgb') f = {type: 'number', unit: f.unit, help: f.labels?.[k] ?? 'A number'};
    else if (f.type === 'points') f = {type: 'numbers', labels: ['x', 'y'], unit: f.unit, help: 'A point [x, y]'};
    else return f.type === 'yaml' ? f : undefined;
  }
  return f;
}
