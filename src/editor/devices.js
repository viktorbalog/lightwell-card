// The Build view's lamps and devices: an entity from the states in use placed on the plan. A light becomes a lamp
// (its glow, its pool, its room's pieces in its shadows) with its marker; a cover dropped on a window becomes its
// shutter, with a marker; anything else a marker with its icon, and for a sensor its value under it. What one entity
// makes is one object (`part`, as build.js's), so it's selected, moved and deleted as one. Pure.
import {lightFrom} from './create.js';
import {partKey} from './build.js';
import {tidy} from './manipulate.js';

// The domains the palette offers, in its order, with their icons (by device class where it matters).
export const DEVICE_DOMAINS = ['light', 'switch', 'cover', 'media_player', 'climate', 'fan', 'vacuum', 'sensor', 'binary_sensor', 'lock', 'camera', 'weather'];
const ICONS = {
  light: 'mdi:lightbulb', switch: 'mdi:power-socket-eu', cover: 'mdi:window-shutter', media_player: 'mdi:television',
  climate: 'mdi:air-conditioner', fan: 'mdi:fan', vacuum: 'mdi:robot-vacuum', sensor: 'mdi:eye', binary_sensor: 'mdi:checkbox-blank-circle-outline',
  lock: 'mdi:lock', camera: 'mdi:cctv', weather: 'mdi:weather-partly-cloudy',
};
const CLASS_ICONS = {
  temperature: 'mdi:thermometer', humidity: 'mdi:water-percent', illuminance: 'mdi:brightness-5', power: 'mdi:flash',
  energy: 'mdi:lightning-bolt', battery: 'mdi:battery', co2: 'mdi:molecule-co2', motion: 'mdi:motion-sensor',
  occupancy: 'mdi:home-account', door: 'mdi:door', window: 'mdi:window-closed-variant', speaker: 'mdi:speaker', tv: 'mdi:television',
  blind: 'mdi:blinds', shutter: 'mdi:window-shutter', curtain: 'mdi:curtains', garage: 'mdi:garage', outlet: 'mdi:power-socket-eu',
};
// Domains whose marker toggles on tap (the rest open the entity's details).
const TOGGLES = ['light', 'switch', 'fan', 'input_boolean'];

const domainOf = id => id.split('.')[0];

// The entities the palette lists, from `states` (by entity id): [{id, name, icon, domain}], by domain then name,
// matching `query` (in the name or the id) if one is given.
export function devicesIn(states, query = '') {
  const q = query.trim().toLowerCase();
  return Object.entries(states || {}).filter(([id]) => DEVICE_DOMAINS.includes(domainOf(id)))
    .map(([id, s]) => ({id, name: s?.attributes?.friendly_name || id, icon: iconOf(id, s), domain: domainOf(id)}))
    .filter(d => !q || d.name.toLowerCase().includes(q) || d.id.includes(q))
    .sort((a, b) => DEVICE_DOMAINS.indexOf(a.domain) - DEVICE_DOMAINS.indexOf(b.domain) || a.name.localeCompare(b.name));
}

// Units that tell what a sensor without a device class measures.
const UNIT_CLASSES = {'°C': 'temperature', '°F': 'temperature', '%': 'humidity', lx: 'illuminance', W: 'power', kWh: 'energy', ppm: 'co2'};

// An entity's icon: its own, or one for its device class (or, for a sensor, its unit), or its domain's.
export function iconOf(id, state) {
  const a = state?.attributes || {}, cls = a.device_class || (domainOf(id) === 'sensor' ? UNIT_CLASSES[a.unit_of_measurement] : undefined);
  return a.icon || CLASS_ICONS[cls] || ICONS[domainOf(id)] || 'mdi:help-circle-outline';
}

// The entities the home already shows on the plan (lit by its lights, or with a marker).
export function placedIn(data) {
  return new Set([...(data?.lights || []).flatMap(g => g?.entities || []), ...(data?.markers || []).map(m => m?.entity)].filter(Boolean));
}

// A sensor's label: its value, rounded where it's a number, with its unit (° for temperatures).
function labelFor(state) {
  const unit = state?.attributes?.unit_of_measurement;
  if (!Number.isFinite(Number(state?.state))) return {};
  return {label: {round: Number.isInteger(Number(state.state)) ? 0 : 1, ...(unit ? {unit: /^\u00b0[CF]$/.test(unit) ? '°' : unit === '%' ? '%' : ` ${unit}`} : {})}};
}

// The opening nearest `p` (within `tol` of its span): its index, or -1.
function openingNear(data, p, tol) {
  let best = -1, bestD = Infinity;
  (data?.openings || []).forEach((o, i) => {
    const horizontal = o.wall === 'top' || o.wall === 'bottom';
    const [x0, y0, x1, y1] = horizontal ? [o.x, o.at - o.depth, o.x + o.w, o.at] : [o.at - o.depth, o.y, o.at, o.y + o.h];
    const d = Math.hypot(Math.max(x0 - p[0], 0, p[0] - x1), Math.max(y0 - p[1], 0, p[1] - y1));
    if (d <= tol && d < bestD) [best, bestD] = [i, d];
  });
  return best;
}

// The entity `id` (its state `state`) placed at `p`: {ops, part, what} ('lamp', 'shutter' or 'marker'). `tol`: how
// near a window a cover has to be dropped to become its shutter.
export function placeDevice(data, id, state, p, tol = 0) {
  const at = p.map(tidy), domain = domainOf(id), m = data?.units_per_metre || 100;
  const part = partKey(data, domain === 'light' ? 'lamp' : id.split('.')[1]);
  const marker = {entity: id, x: at[0], y: at[1], icon: iconOf(id, state), ...(TOGGLES.includes(domain) ? {tap: 'toggle'} : {}),
    ...(domain === 'sensor' ? labelFor(state) : {}), part};
  if (domain === 'light') {
    const lamp = {...lightFrom(data, at, 0.5 * m), entities: [id], part};
    return {ops: [{insert: ['lights'], value: lamp}, {insert: ['markers'], value: marker}], part, what: 'lamp'};
  }
  if (domain === 'cover') {
    const i = openingNear(data, at, tol);
    if (i >= 0) return {ops: [{set: ['openings', i, 'shutter'], value: id}, {insert: ['markers'], value: marker}], part, what: 'shutter'};
  }
  return {ops: [{insert: ['markers'], value: marker}], part, what: 'marker'};
}
