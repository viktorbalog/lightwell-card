// The editor's panels: the list of a home's items and the property form of the selected one, generated from the
// schema (src/schema.js). They only read the home and call back: `ctx.commit(path, value)` (undefined removes it),
// `ctx.select(path)`, `ctx.toggle(path)` (Shift+click: in or out of the selection), `ctx.add(group)`,
// `ctx.remove(path)`, `ctx.duplicate()` (the selection), `ctx.rename(path, name)`, `ctx.move(path, from, to)`.
import YAML from 'yaml';
import {SCHEMA, SHAPE_KINDS, fieldAt} from '../schema.js';
import {SLOTS} from '../home.js';
import {PRESETS} from '../effects.js';
import {attributesOf, datalist, effectsEditor, el, entityInput, entityList, iconInput, labelLine} from './pickers.js';
const flow = v => (v === undefined ? '' : YAML.stringify(v, {collectionStyle: 'flow', lineWidth: 0, flowCollectionPadding: false}).trim());
const samePath = (a, b) => !!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]);
export const pathKey = path => JSON.stringify(path);

const SLOT_NAMES = {floors: 'Floors', walls: 'Walls', glazing: 'Glazing', fittings: 'Fittings',
  under_furniture: 'Under the furniture', on_furniture: 'On the furniture', labels: 'Labels'};

// A shape's kind and a few words about it: "rect · wall", "text: Living room".
export function shapeLabel(s) {
  if (typeof s !== 'object' || !s) return 'raw SVG';
  const kind = SHAPE_KINDS.find(k => s[k] !== undefined) || '?';
  const what = kind === 'text' ? `text: ${s.text}` : kind;
  return [what, s.class, s.repeat && `×${s.repeat.count}`].filter(Boolean).join(' · ');
}

// The groups of the list, in the order they're drawn: [{title, path, add, reorder, items: [{path, label, title}]}].
export function itemGroups(data) {
  const d = data && typeof data === 'object' ? data : {};
  const groups = [];
  groups.push({title: 'Rooms', path: ['rooms'], add: 'room',
    items: Object.keys(d.rooms || {}).map(name => ({path: ['rooms', name], label: name}))});
  for (const slot of SLOTS) {
    const list = Array.isArray(d.drawing?.[slot]) ? d.drawing[slot] : [];
    groups.push({title: SLOT_NAMES[slot], path: ['drawing', slot], add: 'shape', reorder: true,
      items: list.map((s, i) => ({path: ['drawing', slot, i], label: shapeLabel(s)}))});
  }
  groups.push({title: 'Openings', path: ['openings'], add: 'opening',
    items: (d.openings || []).map((o, i) => ({path: ['openings', i], label: `${o.wall} wall${o.room ? `, ${o.room}` : ''}`,
      title: o.shutter}))});
  groups.push({title: 'Furniture', path: ['furniture'], add: 'piece', reorder: true,
    items: Object.entries(d.furniture || {}).map(([name, p]) => ({path: ['furniture', name], label: name,
      title: p?.height ? `${p.height} m` : 'no height: casts no shadows'}))});
  groups.push({title: 'Lights', path: ['lights'], add: 'light',
    items: (d.lights || []).map((g, i) => ({path: ['lights', i], label: g.entities?.[0] || `light ${i + 1}`}))});
  groups.push({title: 'Markers', path: ['markers'], add: 'marker',
    items: (d.markers || []).map((m, i) => ({path: ['markers', i], label: m.entity || `marker ${i + 1}`}))});
  return groups;
}

// The list panel in `box`: every item, the selected ones marked (`selected`, and `also` when there are several);
// groups fold, items can be dragged within groups whose order matters.
export function renderList(box, data, selected, ctx, also = []) {
  const open = box._open ??= new Set(['Furniture', 'Lights', 'Markers', 'Openings', 'Rooms']);
  box.textContent = '';
  const home = el('li', {className: `item home${selected ? '' : ' on'}`, textContent: 'The home'});
  home.onclick = () => ctx.select(null);
  box.append(el('ul', {className: 'items'}, home));
  for (const g of itemGroups(data)) {
    const has = g.items.some(it => [selected, ...also].some(sel => sel && samePath(it.path, sel.slice(0, it.path.length))));
    const details = el('details', {open: open.has(g.title) || has});
    details.ontoggle = () => (details.open ? open.add(g.title) : open.delete(g.title));
    const add = el('button', {type: 'button', className: 'add', textContent: '+', title: `Add to ${g.title.toLowerCase()}`});
    add.onclick = e => { e.preventDefault(); ctx.add(g); };
    details.append(el('summary', {}, el('span', {textContent: g.title}), el('small', {textContent: g.items.length}), add));
    const ul = el('ul', {className: 'items'});
    g.items.forEach((it, i) => {
      const on = samePath(it.path, selected) || also.some(p => samePath(it.path, p));
      const li = el('li', {className: `item${on ? ' on' : ''}`, textContent: it.label, title: it.title || ''});
      li.dataset.path = pathKey(it.path);
      li.onclick = e => (e.shiftKey && ctx.toggle ? ctx.toggle(it.path) : ctx.select(it.path));
      if (g.reorder) {
        li.draggable = true;
        li.ondragstart = e => { e.dataTransfer.setData('text/x-lightwell-item', String(i)); e.dataTransfer.effectAllowed = 'move'; };
        li.ondragover = e => { if (e.dataTransfer.types.includes('text/x-lightwell-item')) { e.preventDefault(); e.stopPropagation(); li.classList.add('drop'); } };
        li.ondragleave = () => li.classList.remove('drop');
        li.ondrop = e => {
          e.preventDefault();
          e.stopPropagation();
          li.classList.remove('drop');
          const from = +e.dataTransfer.getData('text/x-lightwell-item');
          if (from !== i) ctx.move(g.path, from, i);
        };
      }
      ul.append(li);
    });
    details.append(ul);
    box.append(details);
  }
  box.querySelector('.item.on')?.scrollIntoView({block: 'nearest'});
}

// The options a field's input offers, from the home and the states.
function choices(field, ctx) {
  const d = ctx.data || {};
  switch (field.type) {
    case 'room': return Object.keys(d.rooms || {});
    case 'furniture': return Object.keys(d.furniture || {}).filter(n => d.furniture[n]?.height);
    case 'effect': return [...new Set([...Object.keys(PRESETS), ...Object.keys(d.effects || {})])];
    default: return [];
  }
}
// The marker a path inside one belongs to (['markers', 2, 'label', 'attribute'] → the third marker), if any.
const markerOf = (path, ctx) => (path[0] === 'markers' ? ctx.data?.markers?.[path[1]] : undefined);

// An input for one value (not an object): it commits on change, and empty means left out.
function input(field, value, path, ctx) {
  const commit = v => ctx.commit(path, v);
  const t = field.type;
  if (t === 'bool') {
    const c = el('input', {type: 'checkbox', checked: !!value});
    c.onchange = () => commit(c.checked ? true : undefined);
    return [c];
  }
  if (t === 'number') {
    const i = el('input', {type: 'number', step: 'any', value: value ?? '', placeholder: field.default ?? ''});
    i.onchange = () => commit(i.value === '' ? undefined : +i.value);
    return [i, field.unit && el('span', {className: 'unit', textContent: field.unit === 'u' ? '' : field.unit})];
  }
  if (t === 'enum' || t === 'room') {
    const values = t === 'enum' ? field.values : choices(field, ctx);
    const s = el('select', {}, el('option', {value: '', textContent: field.default ? `(${field.default})` : '—'}),
      [...values, ...(value !== undefined && !values.includes(value) ? [value] : [])].map(v => el('option', {value: v, textContent: v, selected: v === value})));
    s.onchange = () => commit(s.value === '' ? undefined : s.value);
    return [s];
  }
  if (t === 'numbers') {
    const labels = field.labels, v = Array.isArray(value) ? value : [];
    const inputs = labels.map((l, k) => el('input', {type: 'number', step: 'any', value: v[k] ?? '', title: l, placeholder: l}));
    inputs.forEach(i => { i.onchange = () => commit(inputs.every(x => x.value === '') ? undefined : inputs.map(x => +x.value)); });
    return [el('span', {className: 'numbers'}, inputs.map((i, k) => el('label', {}, el('small', {textContent: labels[k]}), i)))];
  }
  if (t === 'rgb') {
    const hex = Array.isArray(value) ? `#${value.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}` : '#ffffff';
    const c = el('input', {type: 'color', value: hex});
    const clear = el('button', {type: 'button', className: 'clear', textContent: '×', title: 'Leave it out', hidden: value === undefined});
    c.onchange = () => commit([1, 3, 5].map(k => parseInt(c.value.slice(k, k + 2), 16)));
    clear.onclick = () => commit(undefined);
    return [c, el('code', {textContent: value ? flow(value) : '—'}), clear];
  }
  if (t === 'color') {
    const i = el('input', {type: 'text', value: value ?? ''});
    const swatch = el('span', {className: 'swatch'});
    swatch.style.background = value || 'transparent';
    i.onchange = () => commit(i.value === '' ? undefined : i.value);
    return [swatch, i];
  }
  if (t === 'entity') return entityInput(field, value, commit, ctx.states);
  if (t === 'icon') return iconInput(field, value, commit);
  if (t === 'list' && field.of?.type === 'entity') return entityList(field, value, commit, ctx.states);
  if (t === 'attribute') {
    // The attributes of the entity the label reads, as they are now.
    const m = markerOf(path, ctx), id = m?.label?.entity || m?.entity, names = attributesOf(ctx.states?.[id]);
    const s = el('select', {}, el('option', {value: '', textContent: '(its state)'}),
      [...names, ...(value !== undefined && !names.includes(value) ? [value] : [])].map(n => el('option', {value: n, selected: n === value,
        textContent: `${n}: ${JSON.stringify(ctx.states?.[id]?.attributes?.[n] ?? '?')}`.slice(0, 60)})));
    s.onchange = () => commit(s.value === '' ? undefined : s.value);
    return [s];
  }
  if (['string', 'effect'].includes(t)) {
    const i = el('input', {type: 'text', value: value ?? '', placeholder: field.default ?? '', spellcheck: false});
    i.onchange = () => commit(i.value === '' ? undefined : i.value);
    return [i, ...datalist(i, choices(field, ctx).map(v => ({value: v})))];
  }
  if (t === 'list' && field.of?.type === 'furniture') {
    const names = choices(field.of, ctx), v = Array.isArray(value) ? value : [];
    return [el('span', {className: 'checks'}, names.map(name => {
      const c = el('input', {type: 'checkbox', checked: v.includes(name)});
      c.onchange = () => commit(names.filter(n => (n === name ? c.checked : v.includes(n))));
      return el('label', {}, c, name);
    }))];
  }
  // Anything else (lists, maps, polygons, regions, shape lists) as YAML in flow style.
  const a = el('textarea', {value: flow(value), rows: 1, spellcheck: false, placeholder: 'YAML'});
  a.rows = Math.min(6, Math.max(1, Math.ceil(a.value.length / 38)));
  a.onchange = () => {
    if (a.value.trim() === '') return commit(undefined);
    try {
      commit(YAML.parse(a.value));
      a.classList.remove('bad');
    } catch (e) {
      a.classList.add('bad');
      a.title = e.message;
    }
  };
  return [a];
}

// A row (or a fieldset, for an object) for the field `key` at `path`.
function row(key, field, value, path, ctx) {
  const label = el('span', {className: 'key', textContent: key, title: field.help + (field.required ? ' (required)' : '')});
  if (field.required) label.classList.add('required');
  if (field.type === 'object') {
    if (value === undefined) {
      const add = el('button', {type: 'button', className: 'add-field', textContent: `+ ${key}`, title: field.help});
      add.onclick = () => ctx.commit(path, ctx.template?.(path) ?? {});
      return el('div', {className: 'row absent'}, add);
    }
    const remove = !field.required && el('button', {type: 'button', className: 'clear', textContent: '×', title: `Leave ${key} out`});
    if (remove) remove.onclick = () => ctx.commit(path, undefined);
    const preview = path[0] === 'markers' && path.length === 3 && key === 'label' && labelLine(markerOf(path, ctx), ctx.states);
    return el('fieldset', {}, el('legend', {}, label, remove), fields(field, value, path, ctx), preview);
  }
  const r = el('label', {className: 'row'}, label, el('span', {className: 'value'}, input(field, value, path, ctx)));
  r.dataset.path = pathKey(path);
  return r;
}

// The rows for an object field's fields (those that apply: `when`).
function fields(field, value, path, ctx) {
  const v = value && typeof value === 'object' ? value : {};
  const out = [];
  for (const [key, f] of Object.entries(field.fields)) {
    if (f.when && !Object.entries(f.when).every(([k, vals]) => vals.includes(v[k]))) continue;
    out.push(row(key, f, v[key], [...path, key], ctx));
  }
  return out;
}

// A shape's form: its kind (changing it starts a new geometry), its geometry, its class and its other attributes.
function shapeForm(value, path, ctx) {
  const v = value && typeof value === 'object' ? value : {};
  const kind = SHAPE_KINDS.find(k => v[k] !== undefined) || 'rect';
  const select = el('select', {}, SHAPE_KINDS.map(k => el('option', {value: k, textContent: k, selected: k === kind})));
  select.onchange = () => ctx.commit(path, {...ctx.shapeTemplate(select.value, v), ...Object.fromEntries(Object.entries(v)
    .filter(([k]) => !SHAPE_KINDS.includes(k) && k !== 'at'))});
  const own = SHAPE_KINDS.filter(k => k !== kind).concat(kind === 'text' ? [] : ['at']);
  const out = [el('label', {className: 'row'}, el('span', {className: 'key', textContent: 'kind'}), el('span', {className: 'value'}, select))];
  for (const [key, f] of Object.entries(fieldAt(path).fields)) {
    if (own.includes(key)) continue;
    if (['rx', 'repeat'].includes(key) && v[key] === undefined && !(key === 'rx' && kind === 'rect')) continue;
    out.push(row(key, f, v[key], [...path, key], ctx));
  }
  for (const key of Object.keys(v)) {
    if (fieldAt(path).fields[key]) continue;
    out.push(row(key, fieldAt([...path, key]), v[key], [...path, key], ctx));
  }
  const name = el('input', {type: 'text', placeholder: 'another attribute (fill, opacity…)', spellcheck: false});
  name.onchange = () => { if (name.value) ctx.commit([...path, name.value.trim().replace(/-/g, '_')], ''); };
  out.push(el('div', {className: 'row'}, name));
  return out;
}

// The property panel in `box`: the selected item's form (or the home's own fields), its name for items in maps, and
// a button to delete it.
export function renderProperties(box, data, selected, ctx) {
  const focused = box.querySelector(':focus')?.closest('[data-path]')?.dataset.path;
  box.textContent = '';
  const d = data && typeof data === 'object' ? data : {};
  if (!selected) {
    box.append(el('h2', {textContent: 'The home'}));
    for (const key of ['view', 'units_per_metre', 'sun']) box.append(row(key, SCHEMA.fields[key], d[key], [key], ctx));
    box.append(row('background', SCHEMA.fields.drawing.fields.background, d.drawing?.background, ['drawing', 'background'], ctx));
    const lights = [...new Set((d.lights || []).map(g => g?.entities?.[0]).filter(Boolean))];
    box.append(el('fieldset', {}, el('legend', {}, el('span', {className: 'key', textContent: 'effects', title: SCHEMA.fields.effects.help})),
      effectsEditor(d.effects, {commit: v => ctx.commit(['effects'], v), preview: ctx.previewEffect, previewing: ctx.previewing, lights})));
    for (const key of ['palette', 'simulator']) {
      const f = SCHEMA.fields[key];
      box.append(row(key, {type: 'yaml', help: f.help}, d[key], [key], ctx));
    }
  } else {
    const value = selected.reduce((o, k) => o?.[k], d), field = fieldAt(selected);
    const group = itemGroups(d).find(g => samePath(g.path, selected.slice(0, -1)));
    const title = el('h2', {textContent: group ? `${group.title}: ` : ''});
    if (selected[0] === 'furniture' || selected[0] === 'rooms') {
      const name = el('input', {type: 'text', value: selected.at(-1), className: 'name', spellcheck: false, title: 'Rename (its references follow)'});
      name.onchange = () => { if (name.value && name.value !== selected.at(-1)) ctx.rename(selected, name.value.trim()); };
      title.append(name);
    } else title.append(group?.items.find(it => samePath(it.path, selected))?.label ?? selected.join('.'));
    const del = el('button', {type: 'button', className: 'delete', textContent: 'Delete', title: 'Delete it (Delete)'});
    del.onclick = () => ctx.remove(selected);
    const dup = el('button', {type: 'button', textContent: 'Duplicate', title: 'A copy of it, a little down and to the right (Ctrl+D)'});
    dup.onclick = () => ctx.duplicate();
    box.append(el('div', {className: 'title'}, title, dup, del));
    if (field?.help) box.append(el('p', {className: 'help', textContent: field.help}));
    if (value === undefined) box.append(el('p', {textContent: 'Not in the home any more.'}));
    else if (field?.type === 'shape') box.append(...shapeForm(value, selected, ctx));
    else if (field?.type === 'object') box.append(...fields(field, value, selected, ctx));
    else if (field) box.append(row(String(selected.at(-1)), field, value, selected, ctx));
  }
  if (focused) box.querySelector(`[data-path='${focused}'] input, [data-path='${focused}'] select, [data-path='${focused}'] textarea`)?.focus();
}
