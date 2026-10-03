// <lightwell-editor>: an editor for homes. The card in the middle (light or dark) with an overlay for selecting what's
// on it; on the left the list of the home's items, and the simulator's controls (controls.js); on the right the
// selected item's properties (panels.js, from the schema) and the home's YAML. Every change re-derives the home and
// redraws the card, or lists the check's messages at the bottom while it doesn't pass (a message selects its item).
// The file is opened and saved as YAML (comments kept, model.js) or JSON (for the card's home_url), and the work in
// progress is kept in the browser's storage.
//
// Properties: `states` (the states in use, by entity id) and `location` ({latitude, longitude}, where the sun is
// worked out for), set before it's connected; `example` (the YAML a new home starts from).
import {HomeModel, renameIn, yamlOf} from './model.js';
import {simulatorControls} from './controls.js';
import {droppedFile, formatOf, hasFileAccess, pickFile, renamed, saveFileAs, writeFile} from './files.js';
import {hitTest, itemAt, lightCentre, outlineSvg} from './hit.js';
import {pathKey, renderList, renderProperties} from './panels.js';
import {fieldAt} from '../schema.js';

// The work in progress, in the browser's storage: {text, name, saved} (saved: the text as last opened or saved).
const DRAFT = 'lightwell-editor:draft';
// How long the text view waits after typing before the card follows (ms).
const TYPING = 250;
// How near the pointer counts as on an item (px).
const REACH = 6;

const STYLE = `
  :host { display: grid; grid-template-rows: auto 1fr auto; height: 100%; font: 14px system-ui, sans-serif;
    color: #222; background: #f6f6f4; --line: #ddd; --accent: #1e88e5; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; background: #fff;
    border-bottom: 1px solid var(--line); }
  header h1 { font-size: 15px; margin: 0 10px 0 0; }
  header .name { color: #666; margin-right: auto; }
  header .name.unsaved::after { content: ' •'; color: #e65100; }
  button { font: inherit; padding: 4px 10px; border: 1px solid #ccc; border-radius: 6px; background: #fafafa;
    color: inherit; cursor: pointer; }
  button:hover:not(:disabled) { background: #eee; } button:disabled { opacity: 0.45; cursor: default; }
  button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
  main { display: grid; grid-template-columns: 300px minmax(320px, 1fr) minmax(320px, 0.75fr); min-height: 0; }
  main > * { min-height: 0; }
  .side { display: flex; flex-direction: column; background: #fff; min-height: 0; }
  .side.left { border-right: 1px solid var(--line); } .side.right { border-left: 1px solid var(--line); }
  .tabs { display: flex; border-bottom: 1px solid var(--line); flex: none; }
  .tabs button { flex: 1; border: 0; border-radius: 0; background: none; padding: 8px; color: #666; }
  .tabs button[aria-selected="true"] { color: #222; box-shadow: inset 0 -2px var(--accent); }
  .pane { flex: 1; overflow: auto; min-height: 0; } .pane[hidden] { display: none; }
  .controls { padding: 12px; } .controls form { width: auto; }
  .preview { padding: 16px; display: flex; justify-content: center; align-items: flex-start; overflow: auto; outline: none; }
  .preview.dark { background: #111; }
  .stage { position: relative; width: 100%; max-width: 900px; }
  ha-card { display: block; border-radius: 12px; background: var(--card-background-color, #fff); }
  .preview.dark ha-card { --card-background-color: #1c1c1c; }
  .overlay { position: absolute; left: 0; top: 0; cursor: default; overflow: visible; }
  .overlay * { pointer-events: none; fill: none; vector-effect: non-scaling-stroke; }
  .overlay .hover * { stroke: rgba(30, 136, 229, 0.6); stroke-width: 1.5; }
  .overlay .sel * { stroke: var(--accent); stroke-width: 2.5; fill: rgba(30, 136, 229, 0.12); }
  .overlay .sel .pool { fill: none; stroke-dasharray: 6 5; stroke-width: 1.5; }
  .overlay .sel .dot { fill: var(--accent); }
  .preview:focus-visible .stage { outline: 2px solid rgba(30, 136, 229, 0.4); outline-offset: 4px; border-radius: 12px; }
  .hint { color: #888; font-size: 12px; margin: 8px 0 0; text-align: center; }
  .text { display: flex; height: 100%; }
  .text textarea { flex: 1; border: 0; padding: 10px 12px; resize: none; tab-size: 2; white-space: pre; outline: none;
    font: 12.5px/1.5 ui-monospace, Menlo, Consolas, monospace; background: #fff; color: #222; }
  /* The list */
  .list { padding: 6px 0 12px; font-size: 13px; }
  .list summary { display: flex; align-items: center; gap: 6px; padding: 5px 10px; cursor: pointer; font-weight: 600; }
  .list summary small { color: #999; font-weight: normal; margin-right: auto; }
  .list summary .add { padding: 0 7px; line-height: 18px; font-weight: normal; }
  .items { list-style: none; margin: 0; padding: 0; }
  .item { padding: 3px 10px 3px 24px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item.home { padding-left: 10px; font-weight: 600; }
  .item:hover { background: #f2f6fb; } .item.on { background: #e3f0fc; box-shadow: inset 3px 0 var(--accent); }
  .item.drop { box-shadow: inset 0 2px var(--accent); }
  /* The properties */
  .props { padding: 10px 12px 16px; font-size: 13px; }
  .props .title { display: flex; align-items: center; gap: 8px; }
  .props h2 { font-size: 14px; margin: 4px 0; flex: 1; display: flex; align-items: center; gap: 4px; min-width: 0; }
  .props h2 input.name { font: inherit; flex: 1; min-width: 0; }
  .props .help { color: #777; margin: 2px 0 8px; }
  .props .row { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 8px; margin: 3px 0; }
  .props .row.absent { display: block; }
  .props .key { color: #555; overflow: hidden; text-overflow: ellipsis; } .props .key.required::after { content: ' *'; color: #b00020; }
  .props .value { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .props input[type=text], .props input[type=number], .props select, .props textarea { font: inherit; padding: 3px 5px;
    border: 1px solid #ccc; border-radius: 4px; min-width: 0; flex: 1; background: #fff; color: inherit; }
  .props textarea { font: 12px ui-monospace, Menlo, Consolas, monospace; resize: vertical; }
  .props textarea.bad { border-color: #b00020; }
  .props .numbers { display: flex; gap: 4px; flex: 1; min-width: 0; }
  .props .numbers label { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .props .numbers small { color: #999; font-size: 10px; }
  .props .checks { display: flex; flex-wrap: wrap; gap: 2px 10px; }
  .props .unit { color: #888; min-width: 1em; }
  .props .swatch { width: 18px; height: 18px; border-radius: 4px; border: 1px solid #ccc; flex: none; }
  .props fieldset { border: 1px solid #e3e3e3; border-radius: 6px; margin: 8px 0; padding: 4px 8px 6px; }
  .props legend { display: flex; align-items: center; gap: 6px; padding: 0 4px; }
  .props button.clear { padding: 0 6px; line-height: 16px; }
  .props button.add-field { margin: 4px 0; font-size: 12px; padding: 2px 8px; }
  .props button.delete { color: #b00020; }
  footer { max-height: 30vh; overflow: auto; border-top: 1px solid var(--line); background: #fff; }
  footer:empty { display: none; }
  footer p { margin: 0; padding: 4px 12px; font: 12.5px ui-monospace, Menlo, Consolas, monospace; color: #b00020; }
  footer p.link { cursor: pointer; } footer p.link:hover { background: #fff3f3; }
  footer p.info { color: #555; font-family: inherit; }
  .drop { position: absolute; inset: 0; display: none; place-items: center; background: rgba(30, 136, 229, 0.12);
    border: 3px dashed var(--accent); font-size: 18px; pointer-events: none; }
  :host(.dragging) .drop { display: grid; }
  @media (max-width: 1000px) {
    main { grid-template-columns: 1fr; grid-auto-rows: auto; overflow: auto; }
    .pane { overflow: visible; }
    .text textarea { min-height: 50vh; }
  }
`;

const HTML = `
  <header>
    <h1>Lightwell editor</h1><span class="name"></span>
    <button data-act="new" title="Start again from the example home">New</button>
    <button data-act="open" title="Open a home file (YAML or JSON), or drop one on the page">Open…</button>
    <button data-act="save" title="Save (Ctrl+S)">Save</button>
    <button data-act="save-yaml" title="Save as a YAML file, comments kept">Save as YAML…</button>
    <button data-act="save-json" title="Save as JSON, for the card's home_url">Save as JSON…</button>
    <button data-act="undo" title="Undo (Ctrl+Z)">Undo</button>
    <button data-act="redo" title="Redo (Ctrl+Shift+Z)">Redo</button>
    <button data-act="dark" aria-pressed="false" title="Show the card in the dark theme">Dark</button>
  </header>
  <main>
    <div class="side left">
      <div class="tabs" role="tablist"><button data-tab="list" aria-selected="true">Items</button><button data-tab="controls">Sun and time</button></div>
      <div class="pane list" data-pane="list"></div>
      <div class="pane controls" data-pane="controls" hidden><form></form></div>
    </div>
    <div class="preview" tabindex="0">
      <div><div class="stage"><svg class="overlay"><g class="hover"></g><g class="sel"></g></svg></div>
      <p class="hint">Click to select (again, or Tab: what's under it) · Alt+click taps the card · Esc clears</p></div>
    </div>
    <div class="side right">
      <div class="tabs" role="tablist"><button data-tab="props" aria-selected="true">Properties</button><button data-tab="text">YAML</button></div>
      <div class="pane props" data-pane="props"></div>
      <div class="pane text" data-pane="text" hidden><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="The home's YAML"></textarea></div>
    </div>
  </main>
  <footer aria-live="polite"></footer>
  <div class="drop">Drop a home file (YAML or JSON) to open it</div>
`;

const storage = {
  get() { try { return JSON.parse(localStorage.getItem(DRAFT)); } catch { return null; } },
  set(v) { try { localStorage.setItem(DRAFT, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};
const samePath = (a, b) => (a === b) || (!!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]));
const round = v => Math.round(v * 10) / 10;
// The item a check's message is about: "furniture.sofa.height: …" → ['furniture', 'sofa'].
export function messagePath(message) {
  const where = message.slice(0, message.indexOf(': '));
  const path = where.split(/\.|(?=\[)/).filter(Boolean).map(k => (/^\[\d+\]$/.test(k) ? +k.slice(1, -1) : k));
  const depth = path[0] === 'drawing' ? 3 : ['furniture', 'rooms', 'openings', 'lights', 'markers'].includes(path[0]) ? 2 : 0;
  return depth && path.length >= depth ? path.slice(0, depth) : null;
}

export class LightwellEditor extends HTMLElement {
  constructor() {
    super();
    this.states = {};
    this.location = {latitude: 51.4779, longitude: 0};
    this.example = '';
  }

  connectedCallback() {
    if (this._root) return;
    const root = this._root = this.attachShadow({mode: 'open'});
    root.innerHTML = `<style>${STYLE}</style>${HTML}`;
    this.style.position ||= 'relative';
    const $ = s => root.querySelector(s);
    this._el = {name: $('.name'), text: $('textarea'), footer: $('footer'), preview: $('.preview'), stage: $('.stage'),
      overlay: $('.overlay'), hover: $('.overlay .hover'), sel: $('.overlay .sel'), list: $('.list'), props: $('.props'),
      buttons: Object.fromEntries([...root.querySelectorAll('[data-act]')].map(b => [b.dataset.act, b]))};

    const draft = storage.get();
    this.model = new HomeModel(draft?.text ?? this.example);
    this._file = {name: draft?.name ?? 'home.yaml', handle: null, saved: draft?.saved ?? this.model.text};
    this._dark = false;
    this._sel = null;
    this._shown = {states: this.states, north: undefined};

    this._card = document.createElement('lightwell-card');
    this._el.stage.prepend(this._card);
    this._card.addEventListener('hass-more-info', e => this._controls?.moreInfo(e.detail.entityId));
    const plan = this.model.home || {openings: [], sun: {entity: 'sun.sun', weather: 'weather.home', north: 0}};
    this._controls = simulatorControls($('form'), {plan, states: this.states, location: this.location, help: false,
      onChange: shown => { this._shown = shown; this._renderCard(); }});
    new ResizeObserver(() => this._place()).observe(this._el.stage);

    root.addEventListener('click', e => {
      const act = e.target.closest?.('[data-act]')?.dataset.act;
      if (act) this._act(act);
      const tab = e.target.closest?.('[data-tab]');
      if (tab) this._tab(tab.dataset.tab);
    });
    this._el.text.addEventListener('input', () => {
      clearTimeout(this._typing);
      this._typing = setTimeout(() => this._textChanged(), TYPING);
    });
    this._el.text.addEventListener('keydown', e => {
      // Tab indents (two spaces) instead of leaving the text.
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
      }
    });
    this._el.overlay.addEventListener('click', e => this._click(e));
    this._el.overlay.addEventListener('pointermove', e => this._pointer(e));
    this._el.overlay.addEventListener('pointerleave', () => { this._el.hover.innerHTML = ''; });
    this._el.footer.addEventListener('click', e => {
      const path = e.target.closest('p')?.dataset.path;
      if (path) this.select(JSON.parse(path));
    });
    this._keys = e => this._key(e);
    window.addEventListener('keydown', this._keys);
    this.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      this.classList.add('dragging');
    });
    this.addEventListener('dragleave', e => { if (!this.contains(e.relatedTarget)) this.classList.remove('dragging'); });
    this.addEventListener('drop', async e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      this.classList.remove('dragging');
      const file = await droppedFile(e.dataTransfer);
      if (file) this._open(file);
    });
    this._ctx = {
      commit: (path, value) => this._edit(() => (value === undefined ? this.model.get(path) !== undefined && this.model.remove(path) : this.model.set(path, value))),
      select: path => this.select(path),
      add: group => this._add(group),
      remove: path => this._remove(path),
      rename: (path, name) => this._rename(path, name),
      move: (path, from, to) => this._move(path, from, to),
      template: path => this._template(path),
      shapeTemplate: (kind, old) => this._shapeTemplate(kind, old),
    };
    this._changed({text: true});
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._keys);
  }

  // After the model changed: the text view (unless it's where the change came from), the card, the panels, the
  // messages, the buttons and the draft.
  _changed({text}) {
    if (text) this._el.text.value = this.model.text;
    const {home, data, errors} = this.model;
    if (home) {
      this._data = data;
      this._home = home;
      this._controls.setPlan(home);
    } else this._renderCard();
    if (this._sel && itemAt(data, this._sel) === undefined) this._sel = null;
    this._el.footer.textContent = '';
    for (const e of errors) {
      const p = this._message(e), path = messagePath(e);
      if (path) { p.dataset.path = JSON.stringify(path); p.classList.add('link'); p.title = 'Select it'; }
    }
    if (errors.length && this._data) this._message('The card shows the last version without mistakes.', 'info');
    this._renderPanels();
    this._updateButtons();
    storage.set({text: this.model.text, name: this._file.name, saved: this._file.saved});
  }

  // Applies an edit (a function changing the model), and shows a failure as a message.
  _edit(fn) {
    try {
      if (fn() !== false) this._changed({text: true});
    } catch (e) {
      this._message(e.message);
    }
  }

  _renderCard() {
    if (!this._data) return;
    try {
      this._card.setConfig({home: this._data, north: this._shown.north});
      this._card.hass = {states: this._shown.states, themes: {darkMode: this._dark}, callService: this._controls.callService};
    } catch (e) {
      this._message(e.message);
    }
    this._place();
  }

  // The overlay over the card's drawing, in the drawing's units.
  _place() {
    const svg = this._card.shadowRoot?.querySelector('.plan svg'), view = this._home?.view;
    if (!svg || !view) return;
    const r = svg.getBoundingClientRect(), s = this._el.stage.getBoundingClientRect(), o = this._el.overlay;
    Object.assign(o.style, {left: `${r.left - s.left}px`, top: `${r.top - s.top}px`, width: `${r.width}px`, height: `${r.height}px`});
    o.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    this._renderOverlay();
  }

  _renderOverlay() {
    this._el.sel.innerHTML = this._home && this._sel ? outlineSvg(this._home, this._sel) : '';
  }

  _renderPanels() {
    renderList(this._el.list, this.model.data, this._sel, this._ctx);
    renderProperties(this._el.props, this.model.data, this._sel, {...this._ctx, data: this.model.data, states: this._shown.states});
    this._renderOverlay();
  }

  // Selects the item at `path` (null: the home itself) in the list, on the plan and in the text.
  select(path) {
    this._sel = path && itemAt(this.model.data, path) !== undefined ? path : null;
    this._renderPanels();
    if (this._sel && !this._el.text.closest('[hidden]')) this._showInText(this._sel);
  }

  // Scrolls the YAML to the item and selects its text.
  _showInText(path) {
    const node = this.model.doc.getIn(path, true), range = node?.range;
    if (!range) return;
    const ta = this._el.text, line = ta.value.slice(0, range[0]).split('\n').length - 1;
    ta.setSelectionRange(range[0], range[1]);
    ta.scrollTop = Math.max(0, line * parseFloat(getComputedStyle(ta).lineHeight) - ta.clientHeight / 3);
  }

  _tab(name) {
    for (const b of this._root.querySelectorAll('[data-tab]')) {
      const side = b.closest('.side');
      if (!side.querySelector(`[data-tab="${name}"]`)) continue;
      b.setAttribute('aria-selected', b.dataset.tab === name);
      side.querySelector(`[data-pane="${b.dataset.tab}"]`).hidden = b.dataset.tab !== name;
    }
    if (name === 'text' && this._sel) this._showInText(this._sel);
  }

  // A pointer position in the drawing's units, and how far REACH pixels go there.
  _at(e) {
    const m = this._el.overlay.getScreenCTM();
    if (!m || !this._home) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return {p: [p.x, p.y], tol: REACH / m.a};
  }

  _pointer(e) {
    const at = this._at(e);
    const hit = at && hitTest(this._home, at.p, at.tol)[0];
    this._el.hover.innerHTML = hit && !samePath(hit, this._sel) ? outlineSvg(this._home, hit) : '';
  }

  // A click selects what's under it; clicking again where everything is the same goes on to the next thing under it.
  // Alt+click taps the card underneath instead (lights toggle, the weather changes).
  _click(e) {
    if (e.altKey) {
      const marker = this._card.shadowRoot?.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList?.contains('m'));
      marker?.click();
      return;
    }
    const at = this._at(e);
    if (!at) return;
    const hits = hitTest(this._home, at.p, at.tol);
    const again = this._hits && hits.length && hits.map(pathKey).join() === this._hits.map(pathKey).join();
    this._hits = hits;
    this._el.preview.focus({preventScroll: true});
    if (again) return this._cycle();
    this.select(hits[0] || null);
  }

  // The next item under the last click.
  _cycle(step = 1) {
    if (!this._hits?.length) return;
    const i = this._hits.findIndex(h => samePath(h, this._sel));
    this.select(this._hits[(i + step + this._hits.length) % this._hits.length]);
  }

  // The view's centre and a metre, for new items.
  _frame() {
    const v = this._data?.view || {x: 0, y: 0, w: 1000, h: 1000}, m = this._data?.units_per_metre || 100;
    return {cx: v.x + v.w / 2, cy: v.y + v.h / 2, m, v};
  }

  // The room under a point, or the first one.
  _roomAt(x, y) {
    const hit = this._home && hitTest(this._home, [x, y]).find(h => h[0] === 'rooms');
    return hit?.[1] ?? Object.keys(this._data?.rooms || {})[0];
  }

  // A name for a new item in the map at `path`: asked for, suggested `base` (made unique).
  _newName(path, base) {
    const taken = this.model.get(path) || {};
    let suggestion = base, k = 2;
    while (taken[suggestion] !== undefined) suggestion = `${base}${k++}`;
    const name = prompt(`A name for the new ${base}:`, suggestion)?.trim();
    if (!name) return null;
    if (taken[name] !== undefined) { this._message(`There's already a ${name}`); return null; }
    return name;
  }

  // Adds a new item to a group of the list, with values that work before they're edited, and selects it.
  _add(group) {
    const {cx, cy, m, v} = this._frame(), r = round, room = this._roomAt(cx, cy);
    const kind = group.add, list = this.model.get(group.path);
    let path, value;
    if (kind === 'room' || kind === 'piece') {
      const name = this._newName(group.path, kind === 'room' ? 'room' : 'piece');
      if (!name) return;
      path = [...group.path, name];
      value = kind === 'room' ? [[r(cx - m), r(cy - m), r(2 * m), r(2 * m)]]
        : {shape: {rect: [r(cx - m / 2), r(cy - 0.3 * m), r(m), r(0.6 * m)]}, height: 0.75, ...(room ? {shadow_room: room} : {})};
    } else {
      path = [...group.path, Array.isArray(list) ? list.length : 0];
      if (kind === 'shape') value = this._shapeTemplate(group.path[1] === 'labels' ? 'text' : 'rect', null, group.path[1]);
      else if (kind === 'opening') value = {wall: 'top', at: r(v.y), depth: r(0.25 * m), x: r(cx - 0.6 * m), w: r(1.2 * m), lo: 0.9, hi: 2.2, ...(room ? {room} : {})};
      else if (kind === 'light') value = {entities: ['light.new_light'], shape: [{circle: [r(cx), r(cy), r(0.4 * m)]}], ...(room ? {clip: room} : {})};
      else if (kind === 'marker') value = {entity: 'light.new_light', x: r(cx), y: r(cy), icon: 'mdi:lightbulb', tap: 'toggle'};
    }
    this._edit(() => (kind === 'room' || kind === 'piece' ? this.model.set(path, value) : this.model.insert(group.path, value)));
    this.select(path);
  }

  // A shape of `kind` where `old` was (or in the middle of the view), with the slot's usual class.
  _shapeTemplate(kind, old, slot) {
    const {cx, cy, m} = this._frame(), r = round;
    const c = old?.rect ? [old.rect[0] + old.rect[2] / 2, old.rect[1] + old.rect[3] / 2] : old?.circle || old?.ellipse || old?.at || [cx, cy];
    const [x, y] = [r(c[0]), r(c[1])], h = r(m / 2);
    const cls = {floors: 'floor', walls: 'wall', glazing: 'glass', fittings: 'fix', under_furniture: 'furn2', on_furniture: 'dev', labels: 'room'}[slot];
    const geometry = {rect: {rect: [x - h, y - h, 2 * h, 2 * h]}, circle: {circle: [x, y, h]}, ellipse: {ellipse: [x, y, h, r(h / 2)]},
      poly: {poly: [[x - h, y + h], [x + h, y + h], [x, y - h]]}, path: {path: `M${x - h},${y} H${x + h}`, class: 'line'},
      text: {text: 'Label', at: [x, y]}, svg: {svg: '<g></g>'}}[kind];
    return {...geometry, ...(cls && !geometry.class ? {class: cls} : {})};
  }

  // The value an absent object field starts with.
  _template(path) {
    const {m} = this._frame(), key = path.at(-1);
    if (key === 'pool' && path[0] === 'lights') {
      const c = lightCentre(itemAt(this.model.data, path.slice(0, 2))) || [this._frame().cx, this._frame().cy];
      return {x: round(c[0]), y: round(c[1]), r: round(2.5 * m), height: 1.5, shadows: []};
    }
    if (key === 'repeat') return {count: 2, step: [round(m), 0]};
    if (key === 'trees') return {from: 240, to: 300, top: 10, through: 0.5};
    if (key === 'background') return {image: '/local/plan.png'};
    if (key === 'label') return {attribute: 'friendly_name'};
    if (key === 'view') return {x: 0, y: 0, w: 1000, h: 800};
    return {};
  }

  // Where the home names the room or piece `name`: the paths of fields of `type` ('room' or 'furniture') holding it.
  _references(type, name) {
    const out = [];
    const walk = (v, path) => {
      if (path.length && fieldAt(path)?.type === type && v === name) out.push(path);
      if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) walk(c, [...path, Array.isArray(v) ? +k : k]);
    };
    walk(this.model.data, []);
    return out;
  }

  // Deletes an item; a piece of furniture leaves the lights' shadows too.
  _remove(path) {
    const refs = path[0] === 'furniture' ? this._references('furniture', path[1]) : [];
    this._edit(() => this.model.edit(doc => {
      // Last first, so that the indexes of the others stay right.
      for (const p of refs.reverse()) doc.deleteIn(p);
      if (!doc.deleteIn(path)) throw new Error(`Nothing at ${path.join('.')}`);
    }));
    this.select(null);
  }

  // Renames a room or a piece of furniture; the fields naming it follow.
  _rename(path, name) {
    const refs = this._references(path[0] === 'rooms' ? 'room' : 'furniture', path[1]);
    this._edit(() => this.model.edit(doc => {
      renameIn(doc, path, name);
      for (const p of refs) doc.setIn(p, name);
    }));
    if (this.model.get([path[0], name]) !== undefined) this.select([path[0], name]);
  }

  // Moves an item within its list (or map); the selection follows it.
  _move(path, from, to) {
    this._edit(() => this.model.move(path, from, to));
    const sel = this._sel;
    if (sel && sel.length === path.length + 1 && samePath(sel.slice(0, -1), path) && typeof sel.at(-1) === 'number') {
      const i = sel.at(-1), j = i === from ? to : from < i && i <= to ? i - 1 : to <= i && i < from ? i + 1 : i;
      this.select([...path, j]);
    }
  }

  _message(text, kind = '') {
    return this._el.footer.appendChild(Object.assign(document.createElement('p'), {textContent: text, className: kind}));
  }

  _updateButtons() {
    const b = this._el.buttons;
    b.undo.disabled = !this.model.canUndo;
    b.redo.disabled = !this.model.canRedo;
    b['save-json'].disabled = !this.model.data;
    b.dark.setAttribute('aria-pressed', this._dark);
    this._el.name.textContent = this._file.name;
    this._el.name.title = this._file.handle ? 'Saves back to this file' : hasFileAccess() ? 'Save asks where to save it' : 'Saving downloads it';
    this._el.name.classList.toggle('unsaved', this.model.text !== this._file.saved);
  }

  _textChanged() {
    clearTimeout(this._typing);
    if (this.model.setText(this._el.text.value)) this._changed({text: false});
  }

  async _act(act) {
    try {
      if (act === 'undo' || act === 'redo') {
        this._textChanged();
        if (this.model[act]()) this._changed({text: true});
      } else if (act === 'dark') {
        this._dark = !this._dark;
        this._el.preview.classList.toggle('dark', this._dark);
        this._renderCard();
        this._updateButtons();
      } else if (act === 'new') {
        if (this._unsaved() && !confirm('Start again from the example? The changes not saved are lost.')) return;
        this._open({name: 'home.yaml', text: this.example, handle: null});
      } else if (act === 'open') {
        if (this._unsaved() && !confirm('Open another file? The changes not saved are lost.')) return;
        const file = await pickFile();
        if (file) this._open(file);
      } else if (act === 'save') await this.save();
      else if (act === 'save-yaml') await this.save({as: 'yaml'});
      else if (act === 'save-json') await this.save({as: 'json'});
    } catch (e) {
      this._message(e.message);
    }
  }

  _unsaved() {
    return this.model.text !== this._file.saved;
  }

  // Opens a file ({name, text, handle}): a JSON file is edited as YAML, and saved back as JSON.
  _open({name, text, handle}) {
    if (formatOf(name) === 'json') {
      try {
        text = yamlOf(JSON.parse(text));
      } catch (e) {
        this._message(`${name}: ${e.message}`);
        return;
      }
    }
    this.model.open(text);
    this._file = {name, handle, saved: this.model.text};
    this._data = null;
    this._home = null;
    this._sel = null;
    this._changed({text: true});
  }

  // Saves the home: back to its file (where the browser can; otherwise it asks where, or downloads it), or with `as`
  // ('yaml' or 'json') as a new file. Saving a YAML home as JSON is an export: the editor goes on with the YAML.
  async save({as} = {}) {
    this._textChanged();
    const format = as || formatOf(this._file.name);
    const text = format === 'json' ? this.model.toJSON() : this.model.text;
    let saved;
    if (!as && this._file.handle) {
      await writeFile(this._file.handle, text);
      saved = {name: this._file.name, handle: this._file.handle};
    } else {
      saved = await saveFileAs(text, format, renamed(this._file.name, format));
      if (!saved) return;
    }
    if (format === formatOf(this._file.name) || format === 'yaml') this._file = {...saved, saved: this.model.text};
    this._changed({text: false});
  }

  _key(e) {
    const target = e.composedPath()[0], typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName);
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        this._act(e.shiftKey ? 'save-yaml' : 'save');
      } else if ((key === 'z' || key === 'y') && !typing) {
        // In a text field, its own undo; elsewhere the editor's.
        e.preventDefault();
        this._act(key === 'y' || e.shiftKey ? 'redo' : 'undo');
      }
      return;
    }
    if (typing || !this._root.contains(target) && target !== this) return;
    if (e.key === 'Escape') this.select(null);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && this._sel) {
      e.preventDefault();
      this._remove(this._sel);
    } else if (e.key === 'Tab' && target === this._el.preview && this._hits?.length > 1) {
      e.preventDefault();
      this._cycle(e.shiftKey ? -1 : 1);
    }
  }
}
