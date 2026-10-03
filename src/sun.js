// Daylight and sunlight through a home's openings, worked out from the states (no DOM): the card draws the result.
//
// A home's `sun` (see home.js):
// - `north`: the compass bearing of the top of the drawing (0 when north is up).
// - `entity`, `weather`: the sun and weather entities (default `sun.sun` and `weather.home`).
// - `blockers`: things outside that shade the openings (a balcony's side walls): {rect: [x, y, w, h]} or
//   {poly: [[x, y], ...]}, with their `height` in metres.
// - `trees`: an azimuth/elevation band {from, to, top, through} where the sun is dimmed to `through`.
// - `spill`: ellipses of daylight {cx, cy, rx, ry, clip, from, k} carried on through doors, dimmed by the shutters of
//   the openings in `from` (indexes), `k` of the daylight getting through.
// - `outdoor`: shapes in the sun whenever it comes in anywhere (a balcony floor).
// Furniture with a `shadow_room` casts a shadow in the sun, kept inside that room.
import {box, castAlong, clamp, points} from './geometry.js';
import {castersIn} from './furniture.js';
import {SIDES, ends} from './openings.js';

// How much direct sun gets through, by weather condition (when there's no cloud_coverage to go by).
export const SUN_WEATHER = {sunny: 1, 'clear-night': 0, windy: 0.9, 'windy-variant': 0.6, partlycloudy: 0.6, cloudy: 0.15,
  fog: 0.1, rainy: 0.1, pouring: 0.05, snowy: 0.1, 'snowy-rainy': 0.05, hail: 0.05, lightning: 0.05,
  'lightning-rainy': 0.05, exceptional: 0.3};

// The floors' tint through the day, by the sun's elevation: [elevation, r, g, b, opacity], interpolated between.
const DAYLIGHT = [[-12, 15, 25, 70, 0.5], [-5, 70, 60, 140, 0.35], [0, 255, 130, 70, 0.22], [8, 255, 185, 110, 0.12],
  [20, 150, 140, 110, 0.14]];

// How light it is outside: 0 at night, 1 by day.
export const daylight = elevation => clamp((elevation + 4) / 14);

// The floors' tint for the time of day (DAYLIGHT), greyer under clouds in the daytime, fainter in dark mode:
// {color: [r, g, b], opacity}, to mix into the theme's colours.
export function floorTint(el, clouds, dark) {
  const k = DAYLIGHT.findIndex(st => st[0] > el);
  const [a, b] = k < 0 ? [DAYLIGHT.at(-1), DAYLIGHT.at(-1)] : k === 0 ? [DAYLIGHT[0], DAYLIGHT[0]] : [DAYLIGHT[k - 1], DAYLIGHT[k]];
  const t = b[0] === a[0] ? 0 : (el - a[0]) / (b[0] - a[0]), v = n => a[n] + (b[n] - a[n]) * t;
  const day = clamp(el / 6), grey = 0.7 * clouds * day;
  return {color: [1, 2, 3].map(n => Math.round(v(n) * (1 - grey) + 140 * grey)),
    opacity: Math.max(v(4), 0.18 * clouds * day) * (dark ? 0.6 : 1)};
}

// Label colours readable on what is under them (`under`: [r, g, b], already tinted): dark on a light floor, light on
// a dark one, with a halo of the floor's colour. The daylight pool ([r, g, b], opacity) brightens the floors by day.
export function labelColors(under, [skyColor, skyOp]) {
  const c = under.map((v, i) => Math.round(v * (1 - skyOp * 0.8) + skyColor[i] * skyOp * 0.8));
  const light = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 > 0.5;
  return {fill: light ? 'rgba(70, 62, 25, 0.7)' : 'rgba(245, 240, 220, 0.8)', halo: `rgba(${c.join(', ')}, 0.6)`};
}

// Everything about the light outside at this moment, from the sun and weather entities and the shutters.
export function sunScene(home, states, north = home.sun.north, dark = false) {
  const {openings, sun: {trees, spill}, units_per_metre: u} = home;
  const sun = states[home.sun.entity]?.attributes || {}, weather = states[home.sun.weather];
  const el = sun.elevation ?? -90, azDeg = sun.azimuth ?? 0;
  // The sun's bearing from the top of the drawing, clockwise; the light travels away from it: (tx, ty) in the
  // drawing, +y down.
  const rel = (azDeg - north) * Math.PI / 180;
  const tx = -Math.sin(rel), ty = Math.cos(rel);
  const cc = weather?.attributes.cloud_coverage;
  const clear = typeof cc === 'number' ? 1 - 0.85 * cc / 100 : SUN_WEATHER[weather?.state] ?? 0.5;
  const tint = floorTint(el, typeof cc === 'number' ? cc / 100 : 1 - clear, dark);
  // Daylight through the glass, whether or not the sun shines in: cool white by day, warm low down.
  const m = clamp(el / 25), mix = (a, b) => Math.round(a + (b - a) * m);
  const sky = {color: [mix(255, 236), mix(185, 243), mix(130, 255)], opacity: daylight(el) * (dark ? 0.65 : 0.85)};
  const position = o => states[o.shutter]?.attributes.current_position ?? 100;
  const spills = spill.map(p => p.k * p.from.reduce((t, i) => t + position(openings[i]), 0) / p.from.length / 100);
  // How squarely the sun shines in through each opening's wall: up to 1, none at a grazing angle or from behind.
  const facing = openings.map(o => (el > 0 ? clamp(-(tx * SIDES[o.wall][0] + ty * SIDES[o.wall][1] + 0.05) / 0.2) : 0));
  const lit = facing.some(f => f > 0);
  // Behind the trees (fading in over a few degrees at their edges and top): fainter, softer sunlight.
  const behind = trees ? clamp(Math.min((azDeg - trees.from) / 4, (trees.to - azDeg) / 4, (trees.top - el) / 2)) : 0;
  const leaves = 1 - behind * (1 - (trees?.through ?? 1));
  const scene = {el, tx, ty, tint, sky, spills, lit,
    skyThrough: openings.map(o => position(o) / 100),
    opacity: lit ? clear * leaves * Math.min(1, el / 6) : 0, facing};
  if (!lit) return scene;
  // Low sun is orange, high sun pale yellow; clouds and leaves soften the edges.
  scene.fill = `rgb(255, ${mix(150, 248)}, ${mix(70, 220)})`;
  scene.blur = (3 + 20 * (1 - clear) + 12 * behind).toFixed(1);
  // The patch of sun behind each opening, cut short at the far end by its shutter.
  scene.patches = openings.map((o, k) => {
    const hi = o.lo + (o.hi - o.lo) * position(o) / 100;
    if (!facing[k] || hi - o.lo < 0.02) return '';
    const [a, b] = ends(o), at = ([x, y], h) => [x + tx * run(el, h, u), y + ty * run(el, h, u)];
    return points([at(a, o.lo), at(b, o.lo), at(b, hi), at(a, hi)]);
  });
  return scene;
}

// How far (plan units) the sun at `el` degrees throws the shadow of something `h` metres high.
const run = (el, h, unitsPerMetre) => Math.min(h / Math.tan(el * Math.PI / 180), 20) * unitsPerMetre;

// The shadows in the sun: the blockers' (`walls`), and the furniture's per room (`rooms`: [room, svg]).
export function sunShadows(home, {el, tx, ty}) {
  const u = home.units_per_metre, rooms = [...new Set(Object.values(home.furniture).map(p => p.shadow_room).filter(Boolean))];
  const cast = pieces => pieces.map(([p, h]) => castAlong(p, tx * run(el, h, u), ty * run(el, h, u))).join('');
  const blockers = home.sun.blockers.map(b => [b.rect ? box(...b.rect) : b.poly, b.height]);
  return {walls: cast(blockers), rooms: rooms.map(room => [room, cast(castersIn(home.furniture, room))])};
}
