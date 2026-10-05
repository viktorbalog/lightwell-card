// The editor's panels: the list of a home's items and the property form of the selected one, generated from the
// schema (src/schema.js). They only read the home and call back: `ctx.commit(path, value)` (undefined removes it),
// `ctx.select(path)`, `ctx.toggle(path)` (Shift+click: in or out of the selection), `ctx.add(group)`,
// `ctx.remove(path)`, `ctx.duplicate()` (the selection), `ctx.rename(path, name)`, `ctx.move(path, from, to)`,
// `ctx.enter(name)` (edit a piece's insides; `ctx.inside`: the piece being edited). In the Build view the list leads
// with its objects (`ctx.objects`: [{id, kind, name, parts}]; `ctx.group`: the one being edited part by part), picked
// whole (`ctx.selectObject(id)`, `ctx.toggleObject(id)`) or by a part (`ctx.enterObject(id, path)`).
import YAML from 'yaml';
import {SCHEMA, SHAPE_KINDS, fieldAt} from '../schema.js';
import {SLOTS} from '../home.js';
import {PRESETS} from '../effects.js';
import {attributesOf, datalist, effectsEditor, el, entityInput, entityList, iconInput, labelLine} from './pickers.js';
const flow = v => (v === undefined ? '' : YAML.stringify(v, {collectionStyle: 'flow', lineWidth: 0, flowCollectionPadding: false}).trim());
const samePath = (a, b) => !!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]);
export const pathKey = path => JSON.stringify(path);

// The Build view's objects in the list, by kind (the last: those of no other).
const OBJECT_KINDS = [{title: 'Rooms', kinds: ['Room']}, {title: 'Windows and doors', kinds: ['Window', 'Glass door', 'Door', 'Doorway', 'Window or door']},
  {title: 'Furniture', kinds: ['Furniture']}, {title: 'Lamps', kinds: ['Lamp']}, {title: 'Other things'}];

const SLOT_NAMES = {floors: 'Floors', walls: 'Walls', glazing: 'Glazing', fittings: 'Fittings',
  under_furniture: 'Under the furniture', on_furniture: 'On the furniture', labels: 'Labels'};

// A shape's kind and a few words about it: "rect · wall", "text: Living room".
export function shapeLabel(s) {
  if (typeof s !== 'object' || !s) return 'raw SVG';
  const kind = SHAPE_KINDS.find(k => s[k] !== undefined) || '?';
  const what = kind === 'text' ? `text: ${s.text}` : kind;
  return [what, s.class, s.repeat && `×${s.repeat.count}`].filter(Boolean).join(' · ');
}

// A room's rectangle in a few words: "rect 300 × 200 at 10, 20".
const rectLabel = q => (Array.isArray(q) && q.length === 4 ? `rect ${q[2]} × ${q[3]} at ${q[0]}, ${q[1]}` : 'rect ?');

// The groups of the list, in the order they're drawn: [{title, path, add, reorder, items: [{path, label, title,
// children, addChild}]}]. A piece's children are its extra shapes, in the order they're drawn, and a room's its
// rectangles: [{path, label}]; `addChild` ({path, add, title}) adds one (a group for ctx.add).
export function itemGroups(data) {
  const d = data && typeof data === 'object' ? data : {};
  const groups = [];
  groups.push({title: 'Rooms', path: ['rooms'], add: 'room',
    items: Object.entries(d.rooms || {}).map(([name, region]) => ({path: ['rooms', name], label: name,
      // A room of rectangles: each of them (one polygon is the room itself).
      children: Array.isArray(region) && !Array.isArray(region[0]?.[0]) ? region.map((q, i) => ({path: ['rooms', name, i], label: rectLabel(q)})) : [],
      childList: ['rooms', name],
      addChild: Array.isArray(region) && !Array.isArray(region[0]?.[0]) ? {path: ['rooms', name], add: 'rect', title: 'Add a rectangle to it'} : null}))});
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
      title: p?.height ? `${p.height} m` : 'no height: casts no shadows',
      children: (Array.isArray(p?.extra) ? p.extra : []).map((s, i) => ({path: ['furniture', name, 'extra', i], label: shapeLabel(s)})),
      childList: ['furniture', name, 'extra'],
      addChild: typeof p?.extra === 'string' ? null : {path: ['furniture', name, 'extra'], add: 'extra', title: 'Add a shape on it (a cushion, a device…)'}}))});
  groups.push({title: 'Lights', path: ['lights'], add: 'light',
    items: (d.lights || []).map((g, i) => ({path: ['lights', i], label: g.entities?.[0] || `light ${i + 1}`}))});
  groups.push({title: 'Markers', path: ['markers'], add: 'marker',
    items: (d.markers || []).map((m, i) => ({path: ['markers', i], label: m.entity || `marker ${i + 1}`}))});
  groups.push({title: 'Daylight spills', path: ['sun', 'spill'], add: 'spill',
    items: (Array.isArray(d.sun?.spill) ? d.sun.spill : []).map((s, i) => ({path: ['sun', 'spill', i], label: s?.clip ? `into ${s.clip}` : `spill ${i + 1}`,
      title: `from openings ${(s?.from || []).join(', ') || 'none'}, ${s?.k ?? '?'} through`}))});
  groups.push({title: 'Sun blockers', path: ['sun', 'blockers'], add: 'blocker',
    items: (Array.isArray(d.sun?.blockers) ? d.sun.blockers : []).map((b, i) => ({path: ['sun', 'blockers', i], label: `${b?.rect ? 'rect' : 'poly'}, ${b?.height ?? '?'} m`}))});
  // An item's description leads its tooltip.
  const described = it => {
    const note = it.path.reduce((o, k) => o?.[k], d)?.description;
    return typeof note === 'string' && note ? {...it, title: [note, it.title].filter(Boolean).join('\n')} : it;
  };
  for (const g of groups) g.items = g.items.map(it => ({...described(it), children: it.children?.map(described)}));
  return groups;
}

// The list panel in `box`: every item, the selected ones marked (`selected`, and `also` when there are several);
// groups fold, items can be dragged within groups whose order matters. A piece unfolds to show its insides (by
// itself while one of them is selected), which can be dragged into another order.
export function renderList(box, data, selected, ctx, also = []) {
  const open = box._open ??= new Set(['Furniture', 'Lights', 'Markers', 'Openings', 'Rooms', 'Daylight spills']);
  const unfolded = box._unfolded ??= new Set();
  const isOn = path => samePath(path, selected) || also.some(p => samePath(path, p));
  box.textContent = '';
  const home = el('li', {className: `item home${selected ? '' : ' on'}`, textContent: 'The home'});
  home.onclick = () => ctx.select(null);
  box.append(el('ul', {className: 'items'}, home));
  const all = itemGroups(data), inObject = new Set();
  if (ctx.objects) for (const section of OBJECT_KINDS) {
    const objects = ctx.objects.filter(o => (section.kinds ? section.kinds.includes(o.kind) : !OBJECT_KINDS.some(k => k.kinds?.includes(o.kind))));
    for (const o of objects) for (const p of o.parts) inObject.add(pathKey(p));
    if (!objects.length) continue;
    const key = `object:${section.title}`, details = el('details', {open: !box._shut?.has(key)});
    details.ontoggle = () => { box._shut ??= new Set(); details.open ? box._shut.delete(key) : box._shut.add(key); };
    details.append(el('summary', {}, el('span', {textContent: section.title}), el('small', {textContent: objects.length})));
    const ul = el('ul', {className: 'items'});
    for (const o of objects) ul.append(...objectLines(o));
    details.append(ul);
    box.append(details);
  }
  let loose = false;
  for (const g0 of all) {
    // In the Build view, what's in an object is listed with it; the rest after, under a heading of its own.
    const g = ctx.objects ? {...g0, items: g0.items.filter(it => !inObject.has(pathKey(it.path)))} : g0;
    if (ctx.objects && !g.items.length) continue;
    if (ctx.objects && !loose && (loose = true)) box.append(el('p', {className: 'loose', textContent: 'Not in a group'}));
    const has = g.items.some(it => [selected, ...also].some(sel => sel && samePath(it.path, sel.slice(0, it.path.length))));
    const details = el('details', {open: open.has(g.title) || has});
    details.ontoggle = () => (details.open ? open.add(g.title) : open.delete(g.title));
    const add = el('button', {type: 'button', className: 'add', textContent: '+', title: `Add to ${g.title.toLowerCase()}`});
    add.onclick = e => { e.preventDefault(); ctx.add(g); };
    details.append(el('summary', {}, el('span', {textContent: g.title}), el('small', {textContent: g.items.length}), add));
    const ul = el('ul', {className: 'items'});
    g.items.forEach((it, i) => {
      const on = isOn(it.path);
      const li = el('li', {className: `item${on ? ' on' : ''}${ctx.inside != null && it.path[0] === 'furniture' && it.path[1] === ctx.inside ? ' in' : ''}`, textContent: it.label, title: it.title || ''});
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
      if (it.addChild) {
        const plus = el('button', {type: 'button', className: 'add-child', textContent: '+', title: it.addChild.title});
        plus.onclick = e => { e.stopPropagation(); ctx.add(it.addChild); };
        li.append(plus);
      }
      ul.append(li);
      if (it.children?.length) ul.append(...insides(it, li));
    });
    details.append(ul);
    box.append(details);
  }
  // The selected item in view, scrolling the list alone (scrollIntoView would scroll the page, or HA's dialog, too).
  const on = box.querySelector('.item.on');
  if (on) {
    const b = box.getBoundingClientRect(), r = on.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop += r.top - b.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }

  // An object's line, and (unfolded) its parts': the object whole is selected by a click, a part by going inside it.
  function objectLines(o) {
    const whole = o.parts.length && o.parts.every(isOn), inside = ctx.group === o.id, key = `object:${o.id}`;
    const li = el('li', {className: `item${whole ? ' on' : ''}${inside ? ' in' : ''}`, textContent: o.name, title: o.kind});
    li.onclick = e => (e.shiftKey ? ctx.toggleObject(o.id) : ctx.selectObject(o.id));
    const shown = unfolded.has(key) || inside;
    const fold = el('span', {className: 'fold', textContent: shown ? '▾' : '▸', title: shown ? 'Hide its parts' : `Show its parts (${o.parts.length})`});
    fold.onclick = e => {
      e.stopPropagation();
      if (!unfolded.delete(key)) unfolded.add(key);
      renderList(box, data, selected, ctx, also);
    };
    li.prepend(fold);
    if (!shown) return [li];
    return [li, ...o.parts.map(p => {
      const g = all.find(x => samePath(x.path, p.slice(0, -1))), label = g?.items.find(it => samePath(it.path, p))?.label ?? p.join('.');
      const cli = el('li', {className: `item extra${inside && isOn(p) ? ' on' : ''}`, textContent: `${g ? `${g.title}: ` : ''}${label}`});
      cli.dataset.path = pathKey(p);
      cli.onclick = () => ctx.enterObject(o.id, p);
      return cli;
    })];
  }

  // A piece's insides or a room's rectangles, under its line `li` (with the fold that shows them): selecting one of a
  // piece's enters it. They unfold by themselves while one of them is selected.
  function insides(it, li) {
    const key = pathKey(it.path), within = selected?.length > it.path.length && samePath(selected.slice(0, it.path.length), it.path);
    const shown = unfolded.has(key) || within || (it.path[0] === 'furniture' && it.path[1] === ctx.inside);
    const what = it.path[0] === 'rooms' ? 'rectangles' : 'insides';
    const fold = el('span', {className: 'fold', textContent: shown ? '▾' : '▸', title: shown ? `Hide its ${what}` : `Show its ${what} (${it.children.length})`});
    fold.onclick = e => {
      e.stopPropagation();
      if (!unfolded.delete(key)) unfolded.add(key);
      renderList(box, data, selected, ctx, also);
    };
    li.prepend(fold);
    if (!shown) return [];
    const list = it.childList;
    return it.children.map((c, i) => {
      const cli = el('li', {className: `item extra${isOn(c.path) ? ' on' : ''}`, textContent: c.label, title: c.title || ''});
      cli.dataset.path = pathKey(c.path);
      cli.onclick = e => (e.shiftKey && ctx.toggle ? ctx.toggle(c.path) : ctx.select(c.path));
      cli.draggable = true;
      cli.ondragstart = e => { e.dataTransfer.setData('text/x-lightwell-extra', JSON.stringify([key, i])); e.dataTransfer.effectAllowed = 'move'; };
      cli.ondragover = e => { if (e.dataTransfer.types.includes('text/x-lightwell-extra')) { e.preventDefault(); e.stopPropagation(); cli.classList.add('drop'); } };
      cli.ondragleave = () => cli.classList.remove('drop');
      cli.ondrop = e => {
        e.preventDefault();
        e.stopPropagation();
        cli.classList.remove('drop');
        const [from, j] = JSON.parse(e.dataTransfer.getData('text/x-lightwell-extra') || '[]');
        // Only within the same piece.
        if (from === key && j !== i) ctx.move(list, j, i);
      };
      return cli;
    });
  }
}

// One of the home's own fields (`key`: sun, view…) as its form shows it, for a panel of its own (the Build view's home).
export function homeField(data, key, ctx) {
  const d = data && typeof data === 'object' ? data : {};
  return row(key, SCHEMA.fields[key], d[key], [key], ctx);
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
  if (t === 'text') {
    const a = el('textarea', {value: value ?? '', className: 'prose', rows: Math.min(6, Math.max(2, String(value ?? '').split('\n').length))});
    a.onchange = () => commit(a.value.trim() === '' ? undefined : a.value);
    return [a];
  }
  if (['string', 'effect'].includes(t)) {
    const i = el('input', {type: 'text', value: value ?? '', placeholder: field.default ?? '', spellcheck: false});
    i.onchange = () => commit(i.value === '' ? undefined : i.value);
    return [i, ...datalist(i, choices(field, ctx).map(v => ({value: v})))];
  }
  if (t === 'list' && field.of?.type === 'opening') {
    // The openings by their position in the list, as the list names them.
    const openings = Array.isArray(ctx.data?.openings) ? ctx.data.openings : [], v = Array.isArray(value) ? value : [];
    return [el('span', {className: 'checks'}, openings.map((o, k) => {
      const c = el('input', {type: 'checkbox', checked: v.includes(k)});
      c.onchange = () => commit(openings.map((_, j) => j).filter(j => (j === k ? c.checked : v.includes(j))));
      return el('label', {title: o?.shutter || ''}, c, `${k}: ${o?.wall} wall${o?.room ? `, ${o.room}` : ''}`);
    }))];
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

// A piece's insides (its extra shapes) as links that select them, with a + to add one and a button to enter it.
function insidesField(label, value, path, ctx) {
  const add = el('button', {type: 'button', className: 'clear', textContent: '+', title: 'Add a shape on it'});
  add.onclick = () => ctx.add({path, add: 'extra'});
  const enter = el('button', {type: 'button', className: 'clear', textContent: 'Edit', title: 'Edit its insides on the plan (double-click it, or Enter)'});
  enter.onclick = () => ctx.enter(path[1]);
  const links = (value || []).map((s, i) => {
    const a = el('button', {type: 'button', className: 'link', textContent: shapeLabel(s), title: 'Select it'});
    a.onclick = () => ctx.select([...path, i]);
    return a;
  });
  return el('fieldset', {}, el('legend', {}, label, add, enter),
    links.length ? el('div', {className: 'links'}, links) : el('p', {className: 'note', textContent: 'Nothing on it yet'}));
}

// A room's form: its rectangles as links, with a + to add one (or its polygon, as YAML); one rectangle's x, y, w and h.
function regionForm(value, path, ctx) {
  const RECT = {type: 'numbers', labels: ['x', 'y', 'w', 'h'], unit: 'u', help: 'A rectangle [x, y, w, h]'};
  const POLY = {type: 'points', unit: 'u', help: 'A polygon [[x, y], ...]'};
  if (path.length === 3) return [row(Array.isArray(value?.[0]) ? 'poly' : 'rect', Array.isArray(value?.[0]) ? POLY : RECT, value, path, ctx)];
  if (Array.isArray(value?.[0]?.[0])) {
    return [el('p', {className: 'help', textContent: 'A polygon room: drag its corners on the plan (the middle of a side adds one).'}),
      row('poly', POLY, value[0], [...path, 0], ctx)];
  }
  const add = el('button', {type: 'button', className: 'clear', textContent: '+', title: 'Add a rectangle to it (next to its last one)'});
  add.onclick = () => ctx.add({path, add: 'rect'});
  const links = (Array.isArray(value) ? value : []).map((q, i) => {
    const a = el('button', {type: 'button', className: 'link', textContent: rectLabel(q), title: 'Select it (or double-click it on the plan)'});
    a.onclick = () => ctx.select([...path, i]);
    return a;
  });
  return [el('p', {className: 'help', textContent: 'Light stays inside its room: one or more rectangles (they may overlap).'}),
    el('fieldset', {}, el('legend', {}, el('span', {className: 'key', textContent: 'rectangles'}), add),
      links.length ? el('div', {className: 'links'}, links) : el('p', {className: 'note', textContent: 'None'}))];
}

// The sun's spills or blockers as links that select them (on the plan, with their own form), with a + to add one.
function itemLinks(label, value, path, ctx) {
  const group = itemGroups(ctx.data).find(g => samePath(g.path, path));
  const add = el('button', {type: 'button', className: 'clear', textContent: '+', title: `Add to ${group.title.toLowerCase()}`});
  add.onclick = () => ctx.add(group);
  const links = group.items.map(it => {
    const a = el('button', {type: 'button', className: 'link', textContent: it.label, title: it.title || 'Select it'});
    a.onclick = () => ctx.select(it.path);
    return a;
  });
  return el('fieldset', {}, el('legend', {}, label, add), links.length ? el('div', {className: 'links'}, links) : el('p', {className: 'note', textContent: 'None'}));
}

// A row (or a fieldset, for an object) for the field `key` at `path`.
function row(key, field, value, path, ctx) {
  const label = el('span', {className: 'key', textContent: key, title: field.help + (field.required ? ' (required)' : '')});
  if (field.required) label.classList.add('required');
  if (path.length === 3 && path[0] === 'furniture' && key === 'extra' && typeof value !== 'string') return insidesField(label, value, path, ctx);
  if (path.length === 2 && path[0] === 'sun' && (key === 'spill' || key === 'blockers') && (value === undefined || Array.isArray(value))) {
    return itemLinks(label, value, path, ctx);
  }
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
    box.append(row('description', SCHEMA.fields.description, d.description, ['description'], ctx));
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
    const extra = selected.length === 4 && selected[0] === 'furniture' && selected[2] === 'extra';
    const group = itemGroups(d).find(g => samePath(g.path, selected.slice(0, -1)));
    const title = el('h2', {}, el('span', {className: 'kind', textContent: group ? `${group.title}: ` : ''}));
    if (extra) {
      // On a piece: its name goes back to it.
      const back = el('button', {type: 'button', className: 'link', textContent: selected[1], title: `Back to ${selected[1]} (Esc)`});
      back.onclick = () => ctx.select(selected.slice(0, 2));
      title.append(back, ` › ${shapeLabel(value)}`);
    } else if (selected.length === 3 && selected[0] === 'rooms') {
      const back = el('button', {type: 'button', className: 'link', textContent: selected[1], title: `Back to ${selected[1]}`});
      back.onclick = () => ctx.select(selected.slice(0, 2));
      title.append(back, Array.isArray(value?.[0]) ? ' › polygon' : ` › rectangle ${selected[2] + 1}`);
    } else if (selected.length === 2 && (selected[0] === 'furniture' || selected[0] === 'rooms')) {
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
    else if (selected[0] === 'rooms') box.append(...regionForm(value, selected, ctx));
    else if (field?.type === 'shape') box.append(...shapeForm(value, selected, ctx));
    else if (field?.type === 'object') box.append(...fields(field, value, selected, ctx));
    else if (field) box.append(row(String(selected.at(-1)), field, value, selected, ctx));
  }
  if (focused) box.querySelector(`[data-path='${focused}'] input, [data-path='${focused}'] select, [data-path='${focused}'] textarea`)?.focus({preventScroll: true});
}
