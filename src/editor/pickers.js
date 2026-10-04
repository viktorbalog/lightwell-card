// The editor's pickers: entities from the states in use (with their names and states), a marker label's attributes
// and the text it gives now, icons searched by name from the Material Design Icons' list, and a home's effects as
// colours and holds. The helpers at the top are pure (and tested); the rest builds the panel's inputs.
import {labelOf} from '../markers.js';
import {PRESETS, hsvRgb} from '../effects.js';

export const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
};

// The entities in `states` a field can take: [{id, name, state}], those of its domain (or domains) first, then the
// others, each by id. `domain` left out: all of them.
export function entityChoices(states, domain) {
  const domains = [domain].flat().filter(Boolean);
  const fits = id => !domains.length || domains.includes(id.split('.')[0]);
  return Object.entries(states || {}).map(([id, s]) => ({id, name: s?.attributes?.friendly_name || '', state: s?.state, fits: fits(id)}))
    .sort((a, b) => (b.fits - a.fits) || a.id.localeCompare(b.id));
}

// What an entity is now, in a few words: "Living room lamp · on", or why there's nothing to say.
export function entityNote(states, id) {
  if (!id) return '';
  const s = states?.[id];
  if (!s) return Object.keys(states || {}).length ? 'not in the states in use' : '';
  return [s.attributes?.friendly_name, s.state].filter(v => v !== undefined && v !== '').join(' · ');
}

// The attributes a marker's label can show, from the entity it reads: its names, sorted, those HA keeps for itself
// (friendly_name, icon, …) last.
const OWN = ['friendly_name', 'icon', 'entity_picture', 'supported_features', 'supported_color_modes', 'attribution'];
export function attributesOf(state) {
  return Object.keys(state?.attributes || {}).sort((a, b) => (OWN.includes(a) - OWN.includes(b)) || a.localeCompare(b));
}

// The text a marker's label shows with `states`, or why it shows none: {text, why}.
export function labelPreview(marker, states) {
  const s = states?.[marker?.entity];
  if (!marker?.label) return {text: '', why: 'no label'};
  if (!s) return {text: '', why: `${marker.entity || 'its entity'} isn't in the states in use`};
  const text = labelOf(marker, s, states);
  if (text) return {text, why: ''};
  const l = marker.label;
  if (l.when && !l.when.includes(s.state)) return {text: '', why: `nothing now: only while ${marker.entity} is ${l.when.join(' or ')} (it's ${s.state})`};
  if (l.entity && !states[l.entity]) return {text: '', why: `${l.entity} isn't in the states in use`};
  return {text: '', why: 'nothing now: no value, a hidden one, or not a number to round'};
}

// The icons matching `query` in the Material Design Icons' list ([{name, aliases, tags}]), best first: names starting
// with it, names containing it, then aliases and tags. At most `n`, as names (without mdi:).
export function searchIcons(list, query, n = 60) {
  const q = String(query || '').toLowerCase().replace(/^mdi:/, '').trim();
  if (!q) return [];
  const rank = i => (i.name.startsWith(q) ? 0 : i.name.includes(q) ? 1 : (i.aliases || []).some(a => a.includes(q)) ? 2
    : (i.tags || []).some(t => t.toLowerCase().includes(q)) ? 3 : 9);
  return list.map(i => [rank(i), i.name]).filter(([r]) => r < 9).sort((a, b) => a[0] - b[0] || a[1].length - b[1].length || a[1].localeCompare(b[1]))
    .slice(0, n).map(([, name]) => name);
}

// An effect step's colour (hue 0–360, saturation 0–100) as #rrggbb, and back (the brightness is a step's own).
export const hsHex = (h, s) => `#${hsvRgb(h, s).map(v => v.toString(16).padStart(2, '0')).join('')}`;
export function hexHs(hex) {
  const [r, g, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!max || !d) return [0, 0];
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round((h * 60 + 360) % 360), Math.round(d / max * 100)];
}

// --- Inputs ---

let lists = 0;
// A datalist for `input` with `options` ([{value, label}]).
export function datalist(input, options) {
  if (!options.length) return [];
  const id = `lw-list-${++lists}`;
  input.setAttribute('list', id);
  return [el('datalist', {id}, options.map(o => el('option', {value: o.value, label: o.label || ''})))];
}

// An entity's input: suggestions from the states (of its domain first, with their names), and below it what the
// entity is now. `commit(value)`: undefined when emptied.
export function entityInput(field, value, commit, states) {
  const i = el('input', {type: 'text', value: value ?? '', placeholder: field.default ?? (field.domain ? `${[field.domain].flat()[0]}.…` : 'domain.name'), spellcheck: false});
  const note = el('small', {className: 'note', textContent: entityNote(states, value)});
  i.onchange = () => commit(i.value.trim() === '' ? undefined : i.value.trim());
  i.oninput = () => { note.textContent = entityNote(states, i.value.trim()); };
  const options = entityChoices(states, field.domain).map(c => ({value: c.id, label: [c.name, c.state].filter(Boolean).join(' · ')}));
  return [el('span', {className: 'stack'}, i, note), ...datalist(i, options)];
}

// A list of entities: one input each, removed with ×, and an empty one to add another.
export function entityList(field, value, commit, states) {
  const v = Array.isArray(value) ? value : [];
  const rows = v.map((id, k) => {
    const remove = el('button', {type: 'button', className: 'clear', textContent: '×', title: 'Take it out'});
    remove.onclick = () => commit(v.filter((_, j) => j !== k));
    return el('span', {className: 'value'}, entityInput(field.of, id, x => commit(x === undefined ? v.filter((_, j) => j !== k) : v.map((y, j) => (j === k ? x : y))), states), remove);
  });
  const add = entityInput({...field.of, default: 'another…'}, undefined, x => x !== undefined && commit([...v, x]), states);
  return [el('span', {className: 'entities'}, rows, el('span', {className: 'value'}, add))];
}

// The icons' list, loaded once from the CDN the editor already draws icons from (null offline).
const ICONS_URL = 'https://cdn.jsdelivr.net/npm/@mdi/svg/meta.json';
let icons;
export const loadIcons = () => (icons ??= fetch(ICONS_URL).then(r => (r.ok ? r.json() : null))
  .then(list => list && list.map(({name, aliases, tags}) => ({name, aliases, tags}))).catch(() => null));
const iconSwatch = name => {
  const s = el('span', {className: 'icon'});
  if (/^mdi:[\w-]+$/.test(name || '')) s.style.setProperty('--icon', `url(https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${name.slice(4)}.svg)`);
  return s;
};

// An icon's input: what it looks like, and while typing the icons whose names (or aliases, tags) match, to click.
export function iconInput(field, value, commit) {
  const i = el('input', {type: 'text', value: value ?? '', placeholder: 'mdi:… (type to search)', spellcheck: false});
  const swatch = iconSwatch(value), found = el('div', {className: 'found', hidden: true});
  const pick = name => { i.value = name; found.hidden = true; commit(name); };
  let typed = 0;
  i.onchange = () => commit(i.value.trim() === '' ? undefined : i.value.trim());
  i.oninput = async () => {
    const mine = ++typed, list = await loadIcons();
    if (mine !== typed) return;
    const names = list ? searchIcons(list, i.value) : [];
    found.textContent = '';
    found.hidden = !names.length;
    for (const name of names) {
      const b = el('button', {type: 'button', title: `mdi:${name}`}, iconSwatch(`mdi:${name}`), el('span', {textContent: name}));
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => pick(`mdi:${name}`);
      found.append(b);
    }
  };
  i.onblur = () => setTimeout(() => { found.hidden = true; }, 150);
  return [swatch, el('span', {className: 'stack search'}, i, found)];
}

// A marker's label: what it shows now, under its settings.
export function labelLine(marker, states) {
  const {text, why} = labelPreview(marker, states);
  return el('p', {className: `label-now${text ? '' : ' none'}`}, text ? ['Shows now: ', el('b', {textContent: text})] : why);
}

// The home's effects: each a name, a fade and steps (a colour, a brightness, a hold), with a preview on a lamp of
// the home. `commit(effects)`: the whole map, undefined when empty; `preview(name, entity)`: plays it on the card
// (null: stops); `previewing`: {name, entity} or null; `lights`: the lights' first entities.
export function effectsEditor(effects, {commit, preview, previewing, lights}) {
  const all = effects && typeof effects === 'object' ? effects : {};
  const set = (name, def) => commit(Object.keys({...all, [name]: def}).length ? {...all, [name]: def} : undefined);
  const out = [];
  for (const [name, def] of Object.entries(all)) {
    const steps = Array.isArray(def) ? def : Array.isArray(def?.steps) ? def.steps : null;
    const box = el('fieldset', {className: 'effect'});
    const remove = el('button', {type: 'button', className: 'clear', textContent: '×', title: `Delete ${name}`});
    remove.onclick = () => { const rest = {...all}; delete rest[name]; commit(Object.keys(rest).length ? rest : undefined); };
    box.append(el('legend', {}, el('span', {className: 'key', textContent: name}), remove));
    if (!steps) {
      box.append(el('p', {className: 'help', textContent: 'Not a list of steps: edit it in the YAML.'}));
      out.push(box);
      continue;
    }
    const put = list => set(name, Array.isArray(def) ? list : {...def, steps: list});
    const fade = el('input', {type: 'number', min: 0, step: 50, value: Array.isArray(def) ? '' : def.fade ?? '', placeholder: '666'});
    fade.onchange = () => set(name, fade.value === '' ? steps : {...(Array.isArray(def) ? {} : def), fade: +fade.value, steps});
    box.append(el('label', {className: 'row'}, el('span', {className: 'key', textContent: 'fade', title: 'Each step fades in over this long'}),
      el('span', {className: 'value'}, fade, el('span', {className: 'unit', textContent: 'ms'}))));
    steps.forEach((st, k) => {
      const [h, s, v, hold] = st, colour = el('input', {type: 'color', value: hsHex(h, s), title: `hue ${h}, saturation ${s}`});
      const bright = el('input', {type: 'number', min: 1, max: 100, value: v, title: 'Brightness %'});
      const holdIn = el('input', {type: 'number', min: 0, step: 100, value: hold, title: 'Held this long (ms)'});
      const change = () => put(steps.map((x, j) => (j === k ? [...hexHs(colour.value), +bright.value, +holdIn.value] : x)));
      colour.onchange = bright.onchange = holdIn.onchange = change;
      const del = el('button', {type: 'button', className: 'clear', textContent: '×', title: 'Delete this step', disabled: steps.length < 2});
      del.onclick = () => put(steps.filter((_, j) => j !== k));
      box.append(el('span', {className: 'value step'}, colour, bright, el('span', {className: 'unit', textContent: '%'}), holdIn, el('span', {className: 'unit', textContent: 'ms'}), del));
    });
    const add = el('button', {type: 'button', className: 'add-field', textContent: '+ step'});
    add.onclick = () => put([...steps, [...(steps.at(-1) || [30, 80, 100, 2000])]]);
    const on = previewing?.name === name;
    const lamp = el('select', {title: 'The lamp it plays on'}, lights.map(id => el('option', {value: id, textContent: id, selected: on && previewing.entity === id})));
    const play = el('button', {type: 'button', className: 'add-field', textContent: on ? 'Stop' : 'Preview on', disabled: !lights.length});
    play.setAttribute('aria-pressed', on);
    play.onclick = () => preview(on ? null : name, lamp.value);
    box.append(el('span', {className: 'value'}, add, play, lamp));
    out.push(box);
  }
  const name = el('input', {type: 'text', placeholder: 'a new effect’s name', spellcheck: false});
  name.onchange = () => {
    const n = name.value.trim();
    if (n && !all[n]) set(n, [[30, 80, 100, 3000], [15, 90, 70, 3000]]);
  };
  out.push(el('div', {className: 'row'}, name), el('p', {className: 'help', textContent: `Built in: ${Object.keys(PRESETS).join(', ')}.`}));
  return out;
}
