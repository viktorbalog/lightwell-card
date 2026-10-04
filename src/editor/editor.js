// <lightwell-editor>: an editor for homes. The card in the middle (light or dark) with an overlay for selecting what's
// on it; on the left the list of the home's items, and the simulator's controls (controls.js); on the right the
// selected item's properties (panels.js, from the schema) and the home's YAML. Every change re-derives the home and
// redraws the card, or lists the check's messages at the bottom while it doesn't pass (a message selects its item).
// Items are moved, resized and turned on the plan (manipulate.js): the card follows the pointer, and the model gets
// one edit when it's let go. A piece of furniture is entered (double-click, or Enter) to edit its insides, the shapes
// drawn with it, in its own frame. The tools draw new ones (create.js); a home starts from the example, empty, or over a
// picture of its plan, whose scale is set by measuring a known length on it. Connected to Home Assistant (live.js),
// the states are the house's own, live.
// The file is opened and saved as YAML (comments kept, model.js) or JSON (for the card's home_url), and the work in
// progress is kept in the browser's storage.
//
// Properties: `states` (the states in use, by entity id) and `location` ({latitude, longitude}, where the sun is
// worked out for), set before it's connected; `example` (the YAML a new home starts from).
import {HomeModel, renameIn, yamlOf} from './model.js';
import {simulatorControls} from './controls.js';
import {droppedFile, formatOf, hasFileAccess, imageSize, loadPicture, pickFile, renamed, savePicture, saveFileAs, writeFile} from './files.js';
import {HaConnection, cannotReach, finishSignIn, haUrl, savedTokens, signIn, signOut} from './live.js';
import {OPENING_KINDS, emptyHome, lightFrom, openingFrom, pictureHome, pieceFrom, scaleFrom, wallFrom} from './create.js';
import {applyTransform, hitInside, hitTest, inPoly, invertTransform, isExtra, itemAt, lightCentre, onPiece, outlineSvg, parseTransform, partPoly,
  pieceOutline, pieceTurn} from './hit.js';
import {anchors, axesOf, boundsOf, dragHandle, handles, insideTargets, moveItem, removeCorner, rulerText, snapMove, snapPoint, snapTargets,
  snapsHandle, startHandle, tidy} from './manipulate.js';
import {itemGroups, pathKey, renderList, renderProperties} from './panels.js';
import {fieldAt} from '../schema.js';
import {defineHome} from '../home.js';

// The work in progress, in the browser's storage: {text, name, saved} (saved: the text as last opened or saved).
const DRAFT = 'lightwell-editor:draft';
// How long the text view waits after typing before the card follows (ms).
const TYPING = 250;
// How near the pointer counts as on an item (px).
const REACH = 6;
// How far the pointer moves before a press is a drag (px); a handle's size (px); a turn's steps (°).
const DRAG = 4;
const HANDLE = 8;
const TURN_STEP = 15;
// The grid, as a share of a metre (5 cm).
const GRID = 0.05;
// What each tool does, under the plan.
const HINTS = {
  select: "Click to select (again, or Tab: what's under it; Shift+click: more), drag on empty space for a box · drag to move, the handles to resize, turn or reshape (double-click a corner removes it; Alt: a piece's insides stay) · Shift: along an axis, Alt: no snapping · arrows nudge (Shift: ×10) · Ctrl+D duplicates · double-click a piece (or Enter) to edit its insides · with a lamp selected, Ctrl+click a piece to add it to its shadows or take it out · Alt+click taps the card · Esc clears",
  wall: "Drag a wall's box, or along its middle for a wall of the usual thickness (25 cm outside, 15 cm inside a room) · Esc: back to selecting",
  room: 'Drag a rectangle, or click its corners for a polygon (click the first again, double-click or Enter to finish; Backspace takes the last back) · Esc: back to selecting',
  opening: 'Drag along an outer wall, from one end of the window or door to the other: its side and thickness come from the wall · Esc: back to selecting',
  piece: 'Drag a rectangle, from the middle out for a circle, or click corners for a polygon (choose above); a click places a piece of the usual size · Esc: back to selecting',
  light: "Click where the lamp is, or drag out its glow's size: its pool and shadows come with it · Esc: back to selecting",
  marker: 'Click where the marker goes · Esc: back to selecting',
  label: 'Click where the label goes (its middle) · Esc: back to selecting',
  scale: 'Drag along something whose length you know (a wall, a door), then type its length to set the scale; or just measure · Esc: back to selecting',
};
// Inside a piece of furniture: what the tools do there, and the ones offered.
const INSIDE_HINTS = {
  select: "Inside {name}: click its shapes to select them (again, or Tab: what's under it; Shift+click: more), drag on its empty space for a box · drag to move, the handles to resize · Shift: along an axis, Alt: no snapping · arrows nudge · Ctrl+D duplicates · Esc or a click outside it leaves",
  piece: 'Inside {name}: drag a rectangle (a cushion, a device), a circle from its middle, or a line (choose above); a click places a small one · Esc: back to selecting',
  label: 'Inside {name}: click where the label goes · Esc: back to selecting',
  scale: HINTS.scale,
};
// The keys of the tools.
const TOOL_KEYS = {v: 'select', w: 'wall', r: 'room', o: 'opening', f: 'piece', l: 'light', m: 'marker', t: 'label', s: 'scale'};

const STYLE = `
  :host { display: grid; grid-template-rows: auto 1fr auto; height: 100%; font: 14px system-ui, sans-serif;
    color: #222; background: #f6f6f4; --line: #ddd; --accent: #1e88e5; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; background: #fff;
    border-bottom: 1px solid var(--line); }
  header h1 { font-size: 15px; margin: 0 10px 0 0; }
  header .name { color: #666; margin-right: auto; }
  header .name.unsaved::after { content: ' •'; color: #e65100; }
  header .ha::before { content: '● '; color: #bbb; } header .ha.on::before { color: #2e7d32; } header .ha.off::before { color: #e65100; }
  dialog.ha input[name=url] { width: 100%; box-sizing: border-box; font: inherit; padding: 4px 6px; margin: 4px 0 8px; }
  dialog.ha .why { color: #b00020; } dialog.ha .status { color: #555; }
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
  .preview.dark { background: #111; } .preview.dark .tools, .preview.dark .hint { color: #bbb; }
  .stage { position: relative; width: 100%; max-width: 900px; }
  ha-card { display: block; border-radius: 12px; background: var(--card-background-color, #fff); }
  .preview.dark ha-card { --card-background-color: #1c1c1c; }
  .overlay { position: absolute; left: 0; top: 0; cursor: default; overflow: visible; }
  .overlay * { pointer-events: none; fill: none; vector-effect: non-scaling-stroke; }
  .overlay .hover * { stroke: rgba(30, 136, 229, 0.6); stroke-width: 1.5; }
  .overlay .sel * { stroke: var(--accent); stroke-width: 2.5; fill: rgba(30, 136, 229, 0.12); }
  .overlay .sel .pool { fill: none; stroke-dasharray: 6 5; stroke-width: 1.5; }
  .overlay .sel .dot { fill: var(--accent); }
  .overlay .handles * { fill: #fff; stroke: var(--accent); stroke-width: 1.5; }
  .overlay .handles .mid { fill: var(--accent); fill-opacity: 0.35; stroke-opacity: 0.6; }
  .overlay .handles .turn { fill: var(--accent); }
  .overlay .guides * { stroke: #d81b60; stroke-width: 1; stroke-dasharray: 4 3; }
  .overlay .box { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 4 3; fill: rgba(30, 136, 229, 0.08); }
  .overlay .grid .minor { stroke: rgba(30, 136, 229, 0.12); stroke-width: 0.5; }
  .overlay .grid .major { stroke: rgba(30, 136, 229, 0.3); stroke-width: 0.75; }
  .overlay .draft * { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 5 3; fill: rgba(30, 136, 229, 0.15); }
  .overlay .draft circle.point { fill: var(--accent); stroke: none; }
  .overlay .shadows * { stroke: #ef6c00; stroke-width: 1.5; stroke-dasharray: 3 3; }
  .overlay .inside .dim { fill: rgba(246, 246, 244, 0.6); fill-rule: evenodd; stroke: none; }
  .preview.dark .overlay .inside .dim { fill: rgba(17, 17, 17, 0.6); }
  .overlay .inside .piece { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 6 4; }
  .overlay.drawing { cursor: crosshair !important; }
  .tools { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 0 0 10px; font-size: 13px; }
  .tools button { padding: 3px 8px; }
  .tools .options { display: flex; align-items: center; gap: 6px; margin-left: 6px; color: #555; }
  .tools select, .tools input { font: inherit; }
  dialog { border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; max-width: 460px; font: 14px system-ui, sans-serif; }
  dialog h2 { margin: 0 0 12px; font-size: 16px; }
  dialog .choice { display: grid; gap: 4px; margin: 0 0 14px; }
  dialog .choice p { margin: 0; color: #666; font-size: 13px; }
  dialog input[type=number] { width: 5em; font: inherit; }
  dialog .end { text-align: right; }
  .ruler { position: absolute; pointer-events: none; padding: 2px 6px; border-radius: 4px; background: rgba(0, 0, 0, 0.75);
    color: #fff; font: 12px ui-monospace, Menlo, Consolas, monospace; white-space: pre; }
  .ruler:empty { display: none; }
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
  .item.extra { padding-left: 40px; color: #555; } .item.in { font-weight: 600; }
  .item .fold { display: inline-block; width: 14px; margin-left: -14px; color: #888; }
  .item { position: relative; }
  .item .add-child { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 0 6px; line-height: 16px;
    font-size: 12px; visibility: hidden; }
  .item:hover .add-child, .item.on .add-child, .item .add-child:focus-visible { visibility: visible; }
  .props button.link { border: 0; background: none; padding: 0 2px; color: var(--accent); font: inherit; }
  .props button.link:hover { text-decoration: underline; background: none; }
  .props .links { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
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
  .props .stack { display: flex; flex-direction: column; flex: 1; min-width: 0; position: relative; }
  .props .note { color: #888; font-size: 11px; min-height: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .props .entities { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .props .icon { width: 20px; height: 20px; flex: none; background: #555; -webkit-mask: var(--icon) center/contain no-repeat;
    mask: var(--icon) center/contain no-repeat; }
  .props .found { position: absolute; top: 100%; left: 0; right: 0; z-index: 2; max-height: 260px; overflow: auto; background: #fff;
    border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15); display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .props .found[hidden] { display: none; }
  .props .found button { display: flex; align-items: center; gap: 6px; border: 0; border-radius: 0; background: none; padding: 4px 6px;
    font-size: 12px; text-align: left; overflow: hidden; }
  .props .found button span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .props .label-now { margin: 6px 0 2px; } .props .label-now.none { color: #888; }
  .props .step { margin: 2px 0; } .props .step input[type=number] { flex: 1; min-width: 3em; }
  .props .step input[type=color] { width: 36px; height: 24px; padding: 0 2px; flex: none; }
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
    <button data-act="ha" class="ha" title="Connect to your Home Assistant for its entities and live states">Home Assistant</button>
    <button data-act="grid" aria-pressed="false" title="Show the grid things snap to (Alt while dragging: no snapping)">Grid</button>
    <button data-act="dark" aria-pressed="false" title="Show the card in the dark theme">Dark</button>
  </header>
  <main>
    <div class="side left">
      <div class="tabs" role="tablist"><button data-tab="list" aria-selected="true">Items</button><button data-tab="controls">Sun and time</button></div>
      <div class="pane list" data-pane="list"></div>
      <div class="pane controls" data-pane="controls" hidden><form></form></div>
    </div>
    <div class="preview" tabindex="0">
      <div><div class="tools" role="toolbar">
        <button data-tool="select" title="Select, move and reshape (V)">Select</button>
        <button data-tool="wall" title="Walls (W)">Wall</button>
        <button data-tool="room" title="Rooms (R)">Room</button>
        <button data-tool="opening" title="Windows and doors (O)">Opening</button>
        <button data-tool="piece" title="Furniture (F)">Furniture</button>
        <button data-tool="light" title="Lamps (L)">Light</button>
        <button data-tool="marker" title="Markers (M)">Marker</button>
        <button data-tool="label" title="Labels (T)">Label</button>
        <button data-tool="scale" title="Measure, or set the scale from a known length (S)">Scale</button>
        <span class="options"></span>
      </div>
      <div class="stage"><svg class="overlay"><g class="inside"></g><g class="grid"></g><g class="hover"></g><g class="shadows"></g><g class="sel"></g><g class="guides"></g><g class="handles"></g><g class="draft"></g><rect class="box" width="0" height="0"/></svg><div class="ruler"></div></div>
      <p class="hint"></p></div>
    </div>
    <div class="side right">
      <div class="tabs" role="tablist"><button data-tab="props" aria-selected="true">Properties</button><button data-tab="text">YAML</button></div>
      <div class="pane props" data-pane="props"></div>
      <div class="pane text" data-pane="text" hidden><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="The home's YAML"></textarea></div>
    </div>
  </main>
  <footer aria-live="polite"></footer>
  <dialog class="ha"><form method="dialog">
    <h2>Home Assistant</h2>
    <p>Connected, the editor shows your entities in its pickers and the card with their live states (and your location's
      sun). You sign in on your Home Assistant's own page; the editor only reads states, and taps on the card still act
      here alone. It keeps Home Assistant's tokens in this browser until you disconnect.</p>
    <p class="status"></p>
    <label>Its address <input name="url" placeholder="https://xxxx.ui.nabu.casa or homeassistant.local:8123" spellcheck="false"></label>
    <p class="why"></p>
    <p class="end"><button value="disconnect" class="disconnect">Disconnect</button> <button value="cancel">Cancel</button>
      <button value="connect" class="connect">Sign in…</button></p>
  </form></dialog>
  <dialog class="start"><form method="dialog">
    <h2>Start a home</h2>
    <div class="choice"><button value="example">The example flat</button><p>A made-up flat with every kind of item, to change into yours.</p></div>
    <div class="choice"><button value="picture">Over a picture of its plan…</button><p>A floor plan image (or drop one on the editor):
      measure a known length on it to set the scale, then trace it. It can stay under the card as its background.</p></div>
    <div class="choice"><button value="empty">Empty</button><p><input type="number" name="w" value="10" min="1" step="any"> ×
      <input type="number" name="h" value="8" min="1" step="any"> m, <input type="number" name="scale" value="100" min="1" step="any"> units a metre</p></div>
    <p class="end"><button value="cancel">Cancel</button></p>
  </form></dialog>
  <div class="drop">Drop a home file (YAML or JSON) to open it, or a picture of a plan to start over it</div>
`;

const storage = {
  get() { try { return JSON.parse(localStorage.getItem(DRAFT)); } catch { return null; } },
  set(v) { try { localStorage.setItem(DRAFT, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};
const samePath = (a, b) => (a === b) || (!!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]));
const round = tidy;
// Paths in an order that deletes safely: within a list, the last first (and what's inside an item before it).
const byPathDescending = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    return typeof a[i] === 'number' && typeof b[i] === 'number' ? b[i] - a[i] : String(b[i]).localeCompare(String(a[i]));
  }
  return b.length - a.length;
};
// The item a check's message is about: "furniture.sofa.height: …" → ['furniture', 'sofa'], and one of a piece's
// extra shapes: "furniture.sofa.extra[0]: …" → ['furniture', 'sofa', 'extra', 0].
export function messagePath(message) {
  const where = message.slice(0, message.indexOf(': '));
  const path = where.split(/\.|(?=\[)/).filter(Boolean).map(k => (/^\[\d+\]$/.test(k) ? +k.slice(1, -1) : k));
  if (isExtra(path.slice(0, 4))) return path.slice(0, 4);
  const depth = path[0] === 'drawing' || (path[0] === 'sun' && ['spill', 'blockers'].includes(path[1])) ? 3 : ['furniture', 'rooms', 'openings', 'lights', 'markers'].includes(path[0]) ? 2 : 0;
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
      handles: $('.overlay .handles'), guides: $('.overlay .guides'), box: $('.overlay .box'), grid: $('.overlay .grid'), ruler: $('.ruler'),
      draft: $('.overlay .draft'), shadows: $('.overlay .shadows'), hint: $('.hint'), options: $('.tools .options'), start: $('dialog.start'),
      ha: $('dialog.ha'), haButton: $('header .ha'), inside: $('.overlay .inside'),
      buttons: Object.fromEntries([...root.querySelectorAll('[data-act]')].map(b => [b.dataset.act, b]))};

    const draft = storage.get();
    this.model = new HomeModel(draft?.text ?? this.example);
    this._file = {name: draft?.name ?? 'home.yaml', handle: null, saved: draft?.saved ?? this.model.text};
    this._dark = false;
    this._sel = null;
    this._sels = [];
    // The piece of furniture whose insides are being edited (its name), or null.
    this._inside = null;
    this._showGrid = false;
    this._preview = null;
    this._pictures = {};
    this._opts = {wall: 'auto', floor: true, kind: 'window', glass: true, piece: 'rect', extra: 'rect'};
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
      const tool = e.target.closest?.('[data-tool]');
      if (tool) this.setTool(tool.dataset.tool);
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
    const overlay = this._el.overlay;
    overlay.addEventListener('pointerdown', e => this._down(e));
    overlay.addEventListener('pointermove', e => (this._press ? this._dragTo(e) : this._pointer(e)));
    overlay.addEventListener('pointerup', e => this._up(e));
    overlay.addEventListener('pointercancel', () => this._cancelDrag());
    overlay.addEventListener('dblclick', e => this._dblclick(e));
    overlay.addEventListener('pointerleave', () => { this._el.hover.innerHTML = ''; });
    this._el.start.addEventListener('close', () => this._started());
    this._el.ha.addEventListener('close', () => this._haClosed());
    this._el.ha.querySelector('input').addEventListener('input', () => this._haCheck());
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
      const image = [...e.dataTransfer.items].find(i => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile();
      if (image) return this._picture(image).catch(err => this._message(err.message));
      const file = await droppedFile(e.dataTransfer);
      if (file) this._open(file);
    });
    this._ctx = {
      commit: (path, value) => this._edit(() => (value === undefined ? this.model.get(path) !== undefined && this.model.remove(path) : this.model.set(path, value))),
      select: path => this.select(path),
      toggle: path => this._toggle(path),
      add: group => this._add(group),
      remove: path => this._remove([path]),
      duplicate: () => this._duplicate(),
      previewEffect: (name, entity) => this._previewEffect(name, entity),
      rename: (path, name) => this._rename(path, name),
      move: (path, from, to) => this._move(path, from, to),
      template: path => this._template(path),
      enter: name => this._enter(name),
      shapeTemplate: (kind, old) => this._shapeTemplate(kind, old),
    };
    this.setTool('select');
    this._changed({text: true});
    this._liveStart();
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._keys);
    this._live?.close();
  }

  // Back from Home Assistant's sign-in, or signed in before: connects.
  async _liveStart() {
    try {
      const tokens = (await finishSignIn()) || savedTokens();
      if (tokens) this._connect(tokens);
    } catch (e) {
      this._message(e.message);
    }
    this._haStatus('', null);
  }

  _connect(tokens) {
    this._live?.close();
    let first = true;
    this._live = new HaConnection(tokens, {
      onStates: states => {
        this._controls.setStates(states);
        // The pickers list them; later changes only reach the card, so as not to redraw a form being typed in.
        if (first) this._renderPanels();
        first = false;
      },
      onConfig: ({latitude, longitude}) => this._controls.setLocation({latitude, longitude}),
      onStatus: (text, ok) => {
        this._haStatus(text, ok);
        if (!ok) this._message(text);
      },
    });
  }

  // The header's Home Assistant button: connected (green), dropped or refused (orange), or not connected.
  _haStatus(text, ok) {
    const b = this._el.haButton, on = !!this._live && !this._live.closed;
    b.classList.toggle('on', on && ok !== false);
    b.classList.toggle('off', on && ok === false);
    b.title = text || (on ? 'Connected to Home Assistant' : 'Connect to your Home Assistant for its entities and live states');
    this._haText = text;
  }

  _haDialog() {
    const d = this._el.ha, on = !!this._live && !this._live.closed;
    d.querySelector('input').value = savedTokens()?.base || (() => { try { return localStorage.getItem('lightwell-editor:ha-url') || ''; } catch { return ''; } })();
    d.querySelector('.status').textContent = on ? (this._haText || 'Connected.') : 'Not connected: the pickers show the states the editor was opened with.';
    d.querySelector('.disconnect').hidden = !on;
    this._haCheck();
    d.returnValue = '';
    d.showModal();
  }

  // Whether the address typed can be reached from this page, said under it.
  _haCheck() {
    const d = this._el.ha, base = haUrl(d.querySelector('input').value);
    const why = !d.querySelector('input').value.trim() ? '' : !base ? "That isn't a web address." : cannotReach(base, location);
    d.querySelector('.why').textContent = why;
    d.querySelector('.connect').disabled = !base || !!why;
  }

  async _haClosed() {
    const d = this._el.ha, how = d.returnValue;
    if (how === 'connect') {
      const base = haUrl(d.querySelector('input').value);
      if (!base || cannotReach(base, location)) return;
      try { localStorage.setItem('lightwell-editor:ha-url', base); } catch { /* blocked */ }
      // The work in progress is in the browser's storage, so it's there again after the sign-in.
      this._textChanged();
      signIn(base);
    } else if (how === 'disconnect') {
      this._live?.close();
      this._live = null;
      await signOut();
      this._controls.setStates(this.states);
      this._controls.setLocation(this.location);
      this._haStatus('', null);
      this._renderPanels();
      this._message('Disconnected from Home Assistant: its tokens are revoked and forgotten here.', 'info');
    }
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
    if (this._inside !== null && !data?.furniture?.[this._inside]) this._inside = null;
    this._sels = this._sels.filter(p => itemAt(data, p) !== undefined);
    if (this._sel && itemAt(data, this._sel) === undefined) this._sel = this._sels.at(-1) || null;
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
    let data = this._preview?.data || this._data;
    if (!data) return;
    // A background picture kept in the browser stands in for the one the home names (/local/plan.png); while it's
    // being looked for there (null), the card goes without, rather than asking for a file that isn't there.
    const bg = data.drawing?.background;
    if (bg && typeof bg.image === 'string' && !(bg.image in this._pictures)) this._loadPicture(bg.image);
    const url = bg && this._pictures[bg.image];
    if (url) data = {...data, drawing: {...data.drawing, background: {...bg, image: url}}};
    else if (bg && url === null) data = {...data, drawing: {...data.drawing, background: undefined}};
    try {
      this._card.setConfig({home: data, north: this._shown.north});
      this._card.hass = {states: this._effectStates(), themes: {darkMode: this._dark}, callService: this._controls.callService};
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

  // The selection's outlines, and the handles of a single selected item (while the home has no mistakes); the grid.
  _renderOverlay() {
    const home = this._preview?.home || this._home, data = this._preview?.data || this._data;
    this._el.sel.innerHTML = home ? this._sels.map(p => outlineSvg(home, p)).join('') : '';
    const px = this._px(), f = v => +v.toFixed(2), s = HANDLE * px;
    this._el.handles.innerHTML = this._handles(data).map(h => (h.turn || h.mid || h.ctrl || h.id.startsWith('pool')
      ? `<circle class="${h.turn ? 'turn' : h.mid || h.ctrl ? 'mid' : ''}" cx="${f(h.at[0])}" cy="${f(h.at[1])}" r="${f(s / (h.mid || h.ctrl ? 2.6 : 2))}"/>`
      : `<rect x="${f(h.at[0] - s / 2)}" y="${f(h.at[1] - s / 2)}" width="${f(s)}" height="${f(s)}"/>`)).join('');
    this._renderInside(home);
    // A selected lamp's pieces in shadow.
    const pool = this._sels.length === 1 && this._sel[0] === 'lights' && itemAt(data, this._sel)?.pool;
    this._el.shadows.innerHTML = home && pool ? (pool.shadows || []).map(n => outlineSvg(home, ['furniture', n])).join('') : '';
    this._renderGrid();
  }

  // The handles of the selected item, if it's the only one and can be changed.
  _handles(data = this._data) {
    if (this._tool !== 'select' || this._sels.length !== 1 || !this.model.home || !data) return [];
    return handles(this._sel, itemAt(data, this._sel), this._withPiece(this._sel, data, {reach: 3 * HANDLE * this._px()}));
  }

  // Inside a piece: the rest of the plan dimmed, the piece outlined; the guides and the drawing in its frame.
  _renderInside(home) {
    const piece = home?.furniture?.[this._inside], v = home?.view;
    const turn = pieceTurn(piece);
    for (const g of [this._el.guides, this._el.draft]) turn ? g.setAttribute('transform', turn) : g.removeAttribute('transform');
    if (!piece) { this._el.inside.innerHTML = ''; return; }
    const o = pieceOutline(piece), f = v => +v.toFixed(1);
    const d = o.poly ? `M${o.poly.map(q => q.map(f).join(',')).join(' L')} Z`
      : `M${f(o.circle[0] - o.circle[2])},${o.circle[1]} a${o.circle[2]},${o.circle[2]} 0 1,0 ${f(2 * o.circle[2])},0 a${o.circle[2]},${o.circle[2]} 0 1,0 ${f(-2 * o.circle[2])},0 Z`;
    // Far beyond the view, so that the overlay's overflow is dimmed too.
    const [x0, y0, x1, y1] = [v.x - v.w, v.y - v.h, v.x + 2 * v.w, v.y + 2 * v.h];
    this._el.inside.innerHTML = `<path class="dim" d="M${x0},${y0} H${x1} V${y1} H${x0} Z ${d}"/><path class="piece" d="${d}"/>`;
  }

  // The options the manipulate functions take for the item at `path` (plus `rest`): an extra shape's piece.
  _withPiece(path, data = this.model.data, rest = {}) {
    return isExtra(path) ? {...rest, piece: itemAt(data, path.slice(0, 2))} : rest;
  }

  // The piece whose insides are being edited, in `data`.
  _piece(data = this._data) {
    return this._inside === null ? undefined : data?.furniture?.[this._inside];
  }

  // A point in the drawing in the frame of the piece being edited, and back (the same unless it's turned).
  _toFrame(p, data) {
    const m = parseTransform(pieceTurn(this._piece(data)));
    return m ? applyTransform(invertTransform(m), p) : p;
  }

  _fromFrame(p, data) {
    return applyTransform(parseTransform(pieceTurn(this._piece(data))), p);
  }

  // What's under the pointer: inside a piece, its shapes, front to back (`inside` true); otherwise every item.
  _hitsAt(at) {
    const piece = this._home?.furniture?.[this._inside];
    if (piece && onPiece(piece, at.p, at.tol)) return {hits: hitInside(this._home, this._inside, at.p, at.tol), inside: true};
    return {hits: hitTest(this._home, at.p, at.tol), inside: false};
  }

  // Edits the insides of the piece `name`, selecting `paths` (its shapes).
  _enter(name, paths = []) {
    if (!this.model.data?.furniture?.[name]) return;
    this._inside = name;
    this._hits = null;
    this._poly = null;
    this._el.draft.innerHTML = '';
    if (!INSIDE_HINTS[this._tool]) this._tool = 'select';
    this._selectAll(paths);
    this._renderTools();
  }

  // Out of the piece, with nothing selected (before selecting what's outside it).
  _out() {
    this._inside = null;
    this._hits = null;
    this._sels = [];
    this._sel = null;
    this._renderTools();
    this._renderOverlay();
  }

  // Back out of the piece, selecting it.
  _leave() {
    const name = this._inside;
    this._inside = null;
    this._hits = null;
    this._selectAll(name === null ? [] : [['furniture', name]]);
    this._renderTools();
  }

  // The grid things snap to (GRID), with a stronger line every metre; the minor lines only when they're far enough
  // apart to see.
  _renderGrid() {
    const g = this._el.grid, v = this._home?.view;
    if (!this._showGrid || !v) { g.innerHTML = ''; return; }
    const step = this._grid(), metre = step / GRID, px = this._px();
    const lines = (d, cls) => {
      if (d / px < 6) return '';
      const out = [];
      for (let x = Math.ceil(v.x / d) * d; x <= v.x + v.w; x += d) out.push(`M${+x.toFixed(2)},${v.y}V${v.y + v.h}`);
      for (let y = Math.ceil(v.y / d) * d; y <= v.y + v.h; y += d) out.push(`M${v.x},${+y.toFixed(2)}H${v.x + v.w}`);
      return `<path class="${cls}" d="${out.join('')}"/>`;
    };
    g.innerHTML = lines(step, 'minor') + lines(metre, 'major');
  }

  _renderPanels() {
    renderList(this._el.list, this.model.data, this._sel, {...this._ctx, inside: this._inside}, this._sels);
    renderProperties(this._el.props, this.model.data, this._sel, {...this._ctx, data: this.model.data, states: this._shown.states,
      previewing: this._effect});
    if (this._sels.length > 1) {
      this._el.props.prepend(Object.assign(document.createElement('p'), {className: 'help',
        textContent: `${this._sels.length} items selected: they move together, and Delete deletes them all. The last one's properties:`}));
    }
    this._renderOverlay();
  }

  // Selects the item at `path` (null: the home itself) in the list, on the plan and in the text.
  select(path) {
    if (!path) this._inside = null;
    this._selectAll(path ? [path] : []);
    if (this._sel && !this._el.text.closest('[hidden]')) this._showInText(this._sel);
  }

  // Selects several items; the last is the one whose properties show.
  // Selecting a piece's shapes enters it (only its shapes stay selected); selecting anything else leaves it.
  _selectAll(paths) {
    const seen = new Set(), was = this._inside;
    this._sels = paths.filter(p => itemAt(this.model.data, p) !== undefined && !seen.has(pathKey(p)) && seen.add(pathKey(p)));
    const extra = this._sels.findLast(isExtra);
    if (extra) this._inside = extra[1];
    else if (this._sels.length) this._inside = null;
    if (this._inside !== null) this._sels = this._sels.filter(p => isExtra(p) && p[1] === this._inside);
    this._sel = this._sels.at(-1) || null;
    if (was !== this._inside) this._renderTools();
    this._renderPanels();
  }

  // Adds an item to the selection, or takes it out.
  _toggle(path) {
    const has = this._sels.some(p => samePath(p, path));
    this._selectAll(has ? this._sels.filter(p => !samePath(p, path)) : [...this._sels, path]);
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

  // A pixel in the drawing's units.
  _px() {
    const m = this._el.overlay.getScreenCTM();
    return m?.a ? 1 / m.a : 1;
  }

  // The grid's step in the drawing's units.
  _grid() {
    return (this._data?.units_per_metre || 100) * GRID;
  }

  // The handle under the pointer, if any: the nearest within reach.
  _handleAt(at) {
    let best = null;
    for (const h of this._handles()) {
      const d = Math.hypot(h.at[0] - at.p[0], h.at[1] - at.p[1]);
      if (d <= at.tol + HANDLE * this._px() / 2 && (!best || d < best.d)) best = {...h, d};
    }
    return best;
  }

  _pointer(e) {
    const at = this._at(e);
    if (!at) return;
    if (this._tool !== 'select') {
      this._el.hover.innerHTML = '';
      if (this._poly) this._drawDraft(this._snap(e, at, this._poly.points.at(-1)), null, e);
      return;
    }
    const handle = this._handleAt(at), hit = !handle && this._hitsAt(at).hits[0];
    this._el.hover.innerHTML = hit && !this._sels.some(p => samePath(p, hit)) ? outlineSvg(this._home, hit) : '';
    this._el.overlay.style.cursor = handle ? 'crosshair' : hit && this.model.home ? 'move' : 'default';
  }

  // A press on the plan: a click when the pointer doesn't move (_click), otherwise a drag (_startDrag).
  _down(e) {
    if (e.button !== 0 || !this._home) return;
    const at = this._at(e);
    if (!at) return;
    this._el.preview.focus({preventScroll: true});
    try { this._el.overlay.setPointerCapture(e.pointerId); } catch { /* a pointer the browser doesn't track */ }
    this._press = {x: e.clientX, y: e.clientY, at, handle: this._handleAt(at), shift: e.shiftKey, drag: null};
    if (this._tool !== 'select') Object.assign(this._press, {create: true, start: this._snap(e, at, this._poly?.points.at(-1))});
  }

  _up(e) {
    const press = this._press;
    this._press = null;
    if (!press) return;
    if (press.create) this._drawEnd(e, press);
    else if (press.drag) this._endDrag(press.drag);
    else this._click(e, press);
  }

  // A click selects what's under it; clicking again where everything is the same goes on to the next thing under it;
  // Shift+click adds it to the selection (or takes it out). Alt+click taps the card underneath instead (lights toggle,
  // the weather changes). A click on a handle does nothing.
  _click(e, press) {
    if (e.altKey) {
      const marker = this._card.shadowRoot?.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList?.contains('m'));
      marker?.click();
      return;
    }
    if (press.handle) return;
    const {hits, inside} = this._hitsAt(press.at);
    // A click outside the piece being edited leaves it.
    if (this._inside !== null && !inside) this._out();
    if ((e.ctrlKey || e.metaKey) && this._toggleShadow(hits)) return;
    if (press.shift) {
      if (hits[0]) this._toggle(hits[0]);
      return;
    }
    const again = this._hits && hits.length && hits.map(pathKey).join() === this._hits.map(pathKey).join();
    this._hits = hits;
    if (again) return this._cycle();
    if (inside) this._selectAll(hits.slice(0, 1));
    else this.select(hits[0] || null);
  }

  // With a lamp with a pool selected: the piece among `hits` added to its shadows, or taken out. False when it isn't.
  _toggleShadow(hits) {
    const path = this._sels.length === 1 && this._sel[0] === 'lights' ? this._sel : null;
    const light = path && itemAt(this.model.data, path), piece = hits.find(h => h[0] === 'furniture' && h.length === 2);
    if (!light?.pool || !piece) return false;
    if (!this.model.data.furniture[piece[1]]?.height) {
      this._message(`${piece[1]} has no height, so it casts no shadows: give it one first`);
      return true;
    }
    const shadows = light.pool.shadows || [];
    const next = shadows.includes(piece[1]) ? shadows.filter(n => n !== piece[1]) : [...shadows, piece[1]];
    this._edit(() => this.model.set([...path, 'pool', 'shadows'], next));
    return true;
  }

  // A double click on a polygon's corner removes it; on a piece of furniture, it enters it (to edit its insides,
  // selecting the one under the pointer); while drawing a polygon, it finishes it.
  _dblclick(e) {
    if (this._tool !== 'select') return this._poly && this._finishPoly();
    const at = this._at(e), handle = at && this._handleAt(at);
    if (at && !handle?.id.match(/(^|\/)v:\d+$/)) {
      if (this._hitsAt(at).inside) return;
      const hits = hitTest(this._home, at.p, at.tol);
      // In a selected room (or one of its rectangles): the rectangle under the pointer, the last listed first.
      const room = this._sel?.[0] === 'rooms' && hits.some(h => h[0] === 'rooms' && h[1] === this._sel[1]) && this.model.data.rooms[this._sel[1]];
      if (Array.isArray(room) && !Array.isArray(room[0]?.[0])) {
        const i = room.findLastIndex(q => inPoly(partPoly(q) || [], at.p));
        if (i >= 0) return this.select(['rooms', this._sel[1], i]);
      }
      const piece = hits.find(h => h[0] === 'furniture');
      if (piece) this._enter(piece[1], hitInside(this._home, piece[1], at.p, at.tol).slice(0, 1));
      return;
    }
    if (!handle) return;
    const item = removeCorner(this._sel, itemAt(this.model.data, this._sel), handle.id, this._withPiece(this._sel));
    if (item) this._edit(() => this.model.set(this._sel, item));
    else this._message('A polygon keeps at least three corners');
  }

  // What a drag does, decided when the pointer has moved far enough: a handle changes its item; on an item, moves
  // the selection (the item first selected, if it wasn't); with Shift or on empty space, selects with a box.
  _startDrag(press) {
    const {at} = press;
    let hits = [];
    if (!press.handle) {
      const found = this._hitsAt(at);
      // A drag starting outside the piece being edited leaves it.
      if (this._inside !== null && !found.inside) this._out();
      hits = found.hits;
    }
    if (press.shift || (!press.handle && !hits.length)) return {kind: 'box', from: at.p, add: press.shift};
    if (!this.model.home) {
      this._message('Fix the mistakes listed here first: the plan shows the last version without them.');
      return {kind: 'none'};
    }
    const data = this.model.data, view = this._home.view.w / 1145;
    // Inside a piece, snapping is in its frame: to its outline and its other shapes.
    const frame = this._inside !== null, piece = this._piece(data);
    const targets = except => (frame ? insideTargets(piece, except.filter(isExtra).map(p => p[3]), view) : snapTargets(this._items(data, except), except, view));
    if (press.handle) {
      const {item, id} = startHandle(this._sel, itemAt(data, this._sel), press.handle.id, this._withPiece(this._sel, data));
      return {kind: 'handle', path: this._sel, item, id, from: press.handle.at, frame, targets: targets([this._sel])};
    }
    if (!hits.some(h => this._sels.some(p => samePath(p, h)))) frame ? this._selectAll(hits.slice(0, 1)) : this.select(hits[0]);
    const paths = this._sels, items = paths.map(p => itemAt(data, p));
    // Anchors in the piece's frame inside it (without the piece, they're in its frame).
    return {kind: 'move', paths, items, from: at.p, frame, pts: paths.flatMap((p, i) => anchors(p, items[i], view, frame ? {} : this._withPiece(p, data))),
      axes: paths.length === 1 ? axesOf(paths[0], items[0]) : [1, 1], targets: targets(paths)};
  }

  // Every item of the home: [[path, item]]; inside a piece, its shapes. A room without its rectangles in `except`.
  _items(data, except = []) {
    if (this._inside !== null) {
      const list = this._piece(data)?.extra;
      return Array.isArray(list) ? list.map((s, i) => [['furniture', this._inside, 'extra', i], s]) : [];
    }
    const parts = except.filter(p => p[0] === 'rooms' && p.length === 3);
    return itemGroups(data).flatMap(g => g.items.map(it => {
      const item = itemAt(data, it.path), out = parts.filter(p => p[1] === it.path[1] && it.path[0] === 'rooms').map(p => p[2]);
      return [it.path, out.length ? item.filter((_, i) => !out.includes(i)) : item];
    }));
  }

  // The pointer moved while pressed: starts the drag once it's far enough, then previews it.
  _dragTo(e) {
    const press = this._press;
    if (press.create) return this._drawTo(e, press);
    if (!press.drag) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG) return;
      press.drag = this._startDrag(press);
    }
    const drag = press.drag, at = this._at(e);
    if (!at || drag.kind === 'none') return;
    const snap = {...drag.targets, tol: at.tol, grid: e.altKey ? 0 : this._grid(), axis: e.shiftKey};
    if (e.altKey) Object.assign(snap, {xs: [], ys: []});
    let guides = {}, ruler = null;
    if (drag.kind === 'box') {
      const [x0, y0, x1, y1] = boundsOf([drag.from, at.p]);
      Object.assign(drag, {rect: [x0, y0, x1, y1]});
      this._el.box.setAttribute('x', x0);
      this._el.box.setAttribute('y', y0);
      this._el.box.setAttribute('width', x1 - x0);
      this._el.box.setAttribute('height', y1 - y0);
      ruler = {size: [x1 - x0, y1 - y0]};
    } else if (drag.kind === 'move') {
      // Inside a piece, the move is snapped in its frame, and made in the drawing again.
      const [to, from] = drag.frame ? [this._toFrame(at.p), this._toFrame(drag.from)] : [at.p, drag.from];
      const moved = snapMove(drag.pts, to[0] - from[0], to[1] - from[1], {...snap, axes: drag.axes});
      guides = moved.guides;
      const [o, d] = drag.frame ? [this._fromFrame([0, 0]), this._fromFrame([moved.dx, moved.dy])] : [[0, 0], [moved.dx, moved.dy]];
      drag.changes = drag.paths.map((p, i) => [p, moveItem(p, drag.items[i], d[0] - o[0], d[1] - o[1], this._withPiece(p, this._data))]);
      ruler = {move: [moved.dx, moved.dy]};
    } else if (drag.kind === 'handle') {
      let p = at.p;
      const piece = this._withPiece(drag.path, this._data);
      if (!e.altKey && snapsHandle(drag.path, drag.item, drag.id, piece)) {
        const local = drag.frame ? snapPoint(this._toFrame(p), {...snap, from: this._toFrame(drag.from)}) : snapPoint(p, {...snap, from: drag.from});
        ({guides} = local);
        p = drag.frame ? this._fromFrame(local.p) : local.p;
      }
      const done = dragHandle(drag.path, drag.item, drag.id, p, {turnStep: e.altKey ? 0 : TURN_STEP, insides: !e.altKey, ...piece});
      drag.changes = [[drag.path, done.item]];
      ruler = done.ruler;
    }
    this._showGuides(guides);
    const s = this._el.stage.getBoundingClientRect();
    Object.assign(this._el.ruler.style, {left: `${e.clientX - s.left + 16}px`, top: `${e.clientY - s.top + 16}px`});
    this._el.ruler.textContent = rulerText(ruler, this._data.units_per_metre);
    if (drag.changes) this._showPreview(drag.changes);
  }

  // Lines across the view where a snap lined things up.
  // Inside a turned piece they're in its frame (the guides are drawn turned with it), so they reach further.
  _showGuides({x, y} = {}) {
    const v = this._home.view, far = this._inside === null ? 0 : Math.max(v.w, v.h);
    const [x0, y0, x1, y1] = [v.x - far, v.y - far, v.x + v.w + far, v.y + v.h + far];
    this._el.guides.innerHTML = (x !== undefined ? `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>` : '')
      + (y !== undefined ? `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>` : '');
  }

  // The card and the overlay as they'd be with `changes` ([[path, value]]), drawn at most once a frame. A version
  // that doesn't pass the check isn't shown.
  _showPreview(changes) {
    this._pending = changes;
    this._frameRequest ||= requestAnimationFrame(() => {
      this._frameRequest = 0;
      if (!this._pending) return;
      const data = structuredClone(this._data);
      for (const [path, value] of this._pending) path.slice(0, -1).reduce((o, k) => o[k], data)[path.at(-1)] = value;
      this._pending = null;
      try {
        this._preview = {data, home: defineHome(data)};
      } catch {
        return;
      }
      this._renderCard();
    });
  }

  // The drag is over: the changes become one edit, a box selects what's inside it.
  _endDrag(drag) {
    const changes = drag.changes;
    this._clearDrag();
    if (drag.kind === 'box' && drag.rect) {
      const [x0, y0, x1, y1] = drag.rect, view = this._home.view.w / 1145;
      const inside = this._items(this._data).filter(([path, item]) => {
        const pts = anchors(path, item, view, this._withPiece(path, this._data));
        return pts.length && pts.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
      }).map(([path]) => path);
      this._selectAll(drag.add ? [...this._sels, ...inside] : inside);
    } else if (changes) {
      this._edit(() => this.model.batch(changes.map(([path, value]) => ({set: path, value}))));
      this._renderCard();
    }
  }

  // Escape, or the browser took the pointer: the drag is dropped, nothing changes.
  _cancelDrag() {
    if (!this._press) return;
    this._press = null;
    this._el.draft.innerHTML = '';
    this._clearDrag();
    this._renderCard();
  }

  _clearDrag() {
    cancelAnimationFrame(this._frameRequest);
    this._frameRequest = 0;
    this._pending = null;
    this._preview = null;
    this._showGuides();
    this._el.ruler.textContent = '';
    this._el.box.setAttribute('width', 0);
    this._el.box.setAttribute('height', 0);
  }

  // Plays an effect of the home on a lamp (its entity on, reporting the effect), until stopped (name null).
  _previewEffect(name, entity) {
    this._effect = name && entity ? {name, entity} : null;
    this._renderCard();
    this._renderPanels();
  }

  // The states the card is shown with: the simulator's, with the lamp playing a previewed effect.
  _effectStates() {
    const states = this._shown.states, fx = this._effect;
    if (!fx) return states;
    const s = states[fx.entity] || {entity_id: fx.entity, attributes: {}};
    return {...states, [fx.entity]: {...s, state: 'on', attributes: {...s.attributes, effect: fx.name}}};
  }

  // The tool in use: 'select', or one that draws (wall, room, opening, piece, light, marker, label, scale).
  // Inside a piece of furniture, only those that draw its insides (piece, label) and the scale.
  setTool(tool) {
    if (!HINTS[tool] || (this._inside !== null && !INSIDE_HINTS[tool])) return;
    this._tool = tool;
    this._poly = null;
    this._cancelDrag();
    this._el.draft.innerHTML = '';
    this._renderTools();
    this._renderOverlay();
  }

  // The tools' buttons, options and hint, for the tool in use and whether a piece is being edited.
  _renderTools() {
    const inside = this._inside !== null, tool = this._tool;
    for (const b of this._root.querySelectorAll('[data-tool]')) {
      b.setAttribute('aria-pressed', b.dataset.tool === tool);
      b.disabled = inside && !INSIDE_HINTS[b.dataset.tool];
    }
    const piece = this._root.querySelector('[data-tool="piece"]');
    piece.textContent = inside ? 'Shapes' : 'Furniture';
    piece.title = inside ? `Shapes on ${this._inside} (F)` : 'Furniture (F)';
    this._el.overlay.classList.toggle('drawing', tool !== 'select');
    this._el.hint.textContent = inside ? INSIDE_HINTS[tool].replace('{name}', this._inside) : HINTS[tool];
    this._renderOptions();
  }

  // The tool's options, next to the tools.
  _renderOptions() {
    const o = this._opts, box = this._el.options;
    const select = (key, values) => `<select data-opt="${key}">${Object.entries(values).map(([v, t]) => `<option value="${v}"${o[key] === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
    const check = (key, text) => `<label><input type="checkbox" data-opt="${key}"${o[key] ? ' checked' : ''}> ${text}</label>`;
    box.innerHTML = {
      wall: select('wall', {auto: 'Outer or inner, by where', outer: 'Outer wall', inner: 'Inner wall'}),
      room: check('floor', 'with its floor'),
      opening: select('kind', {window: 'Window', door: 'Door'}) + check('glass', 'with its glass'),
      piece: this._inside !== null ? select('extra', {rect: 'Rectangle', circle: 'Circle', line: 'Line'})
        : select('piece', {rect: 'Rectangle', circle: 'Circle', poly: 'Polygon'}),
    }[this._tool] || '';
    for (const input of box.querySelectorAll('[data-opt]')) {
      input.onchange = () => { o[input.dataset.opt] = input.type === 'checkbox' ? input.checked : input.value; this._poly = null; this._el.draft.innerHTML = ''; };
    }
  }

  // A pointer position snapped for drawing: to the other items and the grid (Shift: along an axis from `from`; Alt:
  // not at all), with the guides shown.
  // Inside a piece of furniture, in its frame: snapped to its outline and its shapes.
  _snap(e, at, from) {
    const inside = this._inside !== null, q = inside ? this._toFrame(at.p) : at.p;
    if (e.altKey || !this._data) { this._showGuides(); return q; }
    const key = `${this._inside}:${this.model.text}`, k = this._home.view.w / 1145;
    if (this._targets?.key !== key) this._targets = {key, ...(inside ? insideTargets(this._piece(), [], k) : snapTargets(this._items(this._data), [], k))};
    const {p, guides} = snapPoint(q, {...this._targets, tol: at.tol, grid: this._grid(), axis: e.shiftKey && !!from, from});
    this._showGuides(guides);
    return p;
  }

  // What's being drawn, in the overlay: a box, a line, a circle or a polygon so far; the ruler with its size.
  _drawDraft(p, press, e) {
    const f = v => +v.toFixed(1), a = press?.start, tool = this._tool, m = this._data?.units_per_metre || 100;
    let svg = '', ruler = null;
    if (this._poly) {
      const pts = [...this._poly.points, p];
      svg = `<polyline points="${pts.map(q => q.map(f).join(',')).join(' ')}"/>` + this._poly.points.map(q => `<circle class="point" cx="${f(q[0])}" cy="${f(q[1])}" r="${f(3 * this._px())}"/>`).join('');
      ruler = {length: Math.hypot(p[0] - pts.at(-2)[0], p[1] - pts.at(-2)[1])};
    } else if (a && (tool === 'scale' || tool === 'opening' || (tool === 'piece' && this._inside !== null && this._opts.extra === 'line'))) {
      svg = `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(p[0])}" y2="${f(p[1])}"/>`;
      ruler = {length: Math.hypot(p[0] - a[0], p[1] - a[1])};
    } else if (a && (tool === 'light' || (tool === 'piece' && (this._inside !== null ? this._opts.extra : this._opts.piece) === 'circle'))) {
      const r = Math.hypot(p[0] - a[0], p[1] - a[1]);
      svg = `<circle cx="${f(a[0])}" cy="${f(a[1])}" r="${f(r)}"/>`;
      ruler = {radius: r};
    } else if (a && tool === 'wall') {
      const {rect} = wallFrom(this._data, a, p, this._wallOpts());
      svg = `<rect x="${rect[0]}" y="${rect[1]}" width="${rect[2]}" height="${rect[3]}"/>`;
      ruler = {size: [rect[2], rect[3]]};
    } else if (a) {
      const [x0, y0, x1, y1] = boundsOf([a, p]);
      svg = `<rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}"/>`;
      ruler = {size: [x1 - x0, y1 - y0]};
    }
    this._el.draft.innerHTML = svg;
    if (e) {
      const s = this._el.stage.getBoundingClientRect();
      Object.assign(this._el.ruler.style, {left: `${e.clientX - s.left + 16}px`, top: `${e.clientY - s.top + 16}px`});
    }
    this._el.ruler.textContent = rulerText(ruler, m);
  }

  _wallOpts() {
    return {inner: this._opts.wall === 'auto' ? undefined : this._opts.wall === 'inner'};
  }

  _drawTo(e, press) {
    if (!press.drag) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG) return;
      press.drag = {kind: 'draw'};
    }
    const at = this._at(e);
    if (at) this._drawDraft(this._snap(e, at, press.start), press, e);
  }

  // The pointer was let go while drawing: the new item, from the drag (or the click).
  _drawEnd(e, press) {
    const at = this._at(e), moved = !!press.drag, a = press.start, b = at && this._snap(e, at, a);
    this._el.draft.innerHTML = '';
    this._el.ruler.textContent = '';
    this._showGuides();
    if (!b || !this._data) return;
    if (!this.model.home && this._tool !== 'scale') return this._message('Fix the mistakes listed here first: the plan shows the last version without them.');
    const data = this.model.data, m = data.units_per_metre || 100, tool = this._tool, r = v => tidy(v);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const box = () => { const [x0, y0, x1, y1] = boundsOf([a, b]); return [x0, y0, x1 - x0, y1 - y0].map(r); };
    if (this._inside !== null && tool !== 'scale') return this._drawInside(a, b, moved);
    if ((tool === 'room' || (tool === 'piece' && this._opts.piece === 'poly')) && (!moved || this._poly)) return this._addCorner(moved ? b : a);
    if (tool === 'wall') {
      if (!moved) return;
      this._create([{insert: ['drawing', 'walls'], value: wallFrom(data, a, b, this._wallOpts())}], ['drawing', 'walls', (data.drawing?.walls || []).length]);
    } else if (tool === 'room') {
      this._newRoom([box()], {rect: box()});
    } else if (tool === 'opening') {
      if (!moved) return;
      const made = openingFrom(data, a, b, {tol: at.tol, kind: this._opts.kind});
      if (!made) return this._message('Drag along an outer wall: a rectangle in the walls (of class wall), from one end of the opening to the other.');
      const ops = [{insert: ['openings'], value: made.opening}];
      if (this._opts.glass) ops.push({insert: ['drawing', 'glazing'], value: made.glass});
      this._create(ops, ['openings', (data.openings || []).length]);
      if (!made.opening.room) this._message('This opening is in no room yet: choose its room.', 'info');
    } else if (tool === 'piece') {
      const kind = this._opts.piece;
      const shape = kind === 'circle' ? {circle: [r(a[0]), r(a[1]), r(moved ? d : 0.3 * m)]}
        : {rect: moved ? box() : [r(a[0] - 0.5 * m), r(a[1] - 0.3 * m), r(m), r(0.6 * m)]};
      this._newPiece(shape);
    } else if (tool === 'light') {
      this._create([{insert: ['lights'], value: lightFrom(data, a, moved ? d : 0)}], ['lights', (data.lights || []).length]);
    } else if (tool === 'marker') {
      if (moved) return;
      this._create([{insert: ['markers'], value: {entity: 'light.new_light', x: r(a[0]), y: r(a[1]), icon: 'mdi:lightbulb', tap: 'toggle'}}], ['markers', (data.markers || []).length]);
    } else if (tool === 'label') {
      if (moved) return;
      const text = prompt('The label:', 'Room')?.trim();
      if (!text) return;
      this._create([{insert: ['drawing', 'labels'], value: {text, at: [r(a[0]), r(a[1])], class: 'room'}}], ['drawing', 'labels', (data.drawing?.labels || []).length]);
    } else if (tool === 'scale') {
      if (!moved) return;
      const now = `${(d / m).toFixed(2)} m at the scale now`;
      const answer = prompt(`That line is ${now}. How long is it really, in metres? (Cancel just measures.)`, (d / m).toFixed(2));
      const metres = parseFloat(String(answer ?? '').replace(',', '.'));
      if (!(metres > 0)) return this._message(`Measured: ${now}.`, 'info');
      const scale = scaleFrom(a, b, metres);
      this._edit(() => this.model.set(['units_per_metre'], scale));
      this._message(`The scale is ${scale} units a metre now. Lengths in metres (heights, the ruler, shadows) follow it.`, 'info');
    }
  }

  // A shape drawn inside the piece being edited (from `a` to `b`, in its frame), with the usual class for it: a
  // rectangle (furn2), a circle (dev), a line, a label (lbl).
  _drawInside(a, b, moved) {
    const data = this.model.data, m = data.units_per_metre || 100, r = v => tidy(v), name = this._inside;
    const list = data.furniture[name].extra;
    if (list !== undefined && !Array.isArray(list)) return this._message(`${name}'s extra is raw SVG: edit it in the YAML`);
    const [x0, y0, x1, y1] = boundsOf([a, b]);
    let value;
    if (this._tool === 'label') {
      if (moved) return;
      const text = prompt('The label:', 'Label')?.trim();
      if (!text) return;
      value = {text, at: [r(a[0]), r(a[1])], class: 'lbl'};
    } else if (this._opts.extra === 'circle') {
      value = {circle: [r(a[0]), r(a[1]), r(moved ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0.1 * m)], class: 'dev'};
    } else if (this._opts.extra === 'line') {
      if (!moved) return;
      value = {path: `M${r(a[0])},${r(a[1])} L${r(b[0])},${r(b[1])}`, class: 'line'};
    } else {
      value = {rect: moved ? [x0, y0, x1 - x0, y1 - y0].map(r) : [r(a[0] - 0.2 * m), r(a[1] - 0.1 * m), r(0.4 * m), r(0.2 * m)], class: 'furn2'};
    }
    this._create([{insert: ['furniture', name, 'extra'], value}], ['furniture', name, 'extra', (list || []).length]);
  }

  // Adds ops as one edit and selects `path`, staying in the tool.
  _create(ops, path) {
    this._edit(() => this.model.batch(ops));
    this.select(path);
  }

  _newRoom(region, floor) {
    const name = this._newName(['rooms'], 'room');
    if (!name) return;
    const ops = [{set: ['rooms', name], value: region}];
    if (this._opts.floor) ops.push({insert: ['drawing', 'floors'], value: {...floor, class: 'floor'}});
    this._create(ops, ['rooms', name]);
  }

  _newPiece(shape) {
    const name = this._newName(['furniture'], 'piece');
    if (name) this._create([{set: ['furniture', name], value: pieceFrom(this.model.data, name, shape)}], ['furniture', name]);
  }

  // A polygon drawn by clicks: a corner more, or the polygon finished by clicking its first corner again.
  _addCorner(p) {
    const poly = this._poly ??= {points: []}, pts = poly.points, px = this._px();
    if (pts.length >= 3 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= (REACH + 2) * px) return this._finishPoly();
    const last = pts.at(-1);
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > px) pts.push(p.map(tidy));
    this._drawDraft(p);
  }

  _finishPoly() {
    const pts = this._poly?.points || [];
    this._poly = null;
    this._el.draft.innerHTML = '';
    this._el.ruler.textContent = '';
    if (pts.length < 3) return this._message('A polygon needs three corners at least', 'info');
    if (this._tool === 'room') this._newRoom([pts], {poly: pts});
    else this._newPiece({poly: pts});
  }

  // Moves the selection by (dx, dy), as one edit.
  _moveBy(dx, dy) {
    if (!this._sels.length) return;
    if (!this.model.home) return this._message('Fix the mistakes listed here first: the plan shows the last version without them.');
    this._edit(() => this.model.batch(this._sels.map(p => ({set: p, value: moveItem(p, itemAt(this.model.data, p), dx, dy, this._withPiece(p))}))));
  }

  // Copies of the selected items, a little down and to the right, selected: pieces and rooms under a new name, the
  // others at the end of their list.
  _duplicate() {
    if (!this._sels.length) return;
    if (!this.model.home) return this._message('Fix the mistakes listed here first: the plan shows the last version without them.');
    const data = this.model.data, off = 4 * this._grid(), ops = [], made = [], ends = {};
    for (const path of this._sels) {
      const value = moveItem(path, structuredClone(itemAt(data, path)), off, off, this._withPiece(path, data));
      if (path.length === 2 && (path[0] === 'furniture' || path[0] === 'rooms')) {
        const base = String(path[1]).replace(/\d+$/, '');
        let k = 2;
        while (data[path[0]][`${base}${k}`] !== undefined || made.some(p => p[0] === path[0] && p[1] === `${base}${k}`)) k++;
        ops.push({set: [path[0], `${base}${k}`], value});
        made.push([path[0], `${base}${k}`]);
      } else {
        const list = path.slice(0, -1), key = pathKey(list);
        ends[key] ??= itemAt(data, list).length;
        ops.push({insert: list, value});
        made.push([...list, ends[key]++]);
      }
    }
    this._edit(() => this.model.batch(ops));
    this._selectAll(made);
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
    if (kind === 'extra') return this._addInside(group.path[1]);
    if (kind === 'rect') return this._addRect(group.path);
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
      else if (kind === 'spill') value = {cx: r(cx), cy: r(cy), rx: r(2 * m), ry: r(2 * m), ...(room ? {clip: room} : {}), from: [], k: 0.5};
      else if (kind === 'blocker') value = {rect: [r(cx - m / 2), r(cy - m / 2), r(m), r(m)], height: 3};
    }
    this._edit(() => (kind === 'room' || kind === 'piece' ? this.model.set(path, value) : this.model.insert(group.path, value)));
    this.select(path);
  }

  // A rectangle added to the room at `path`, next to its last one (to its right, as tall), selected.
  _addRect(path) {
    const region = this.model.get(path), {cx, cy, m} = this._frame(), r = round;
    if (!Array.isArray(region) || Array.isArray(region[0]?.[0])) return this._message('A polygon room is one shape: drag its corners instead');
    const last = region.at(-1);
    const value = last?.length === 4 ? [r(last[0] + last[2]), last[1], r(m), last[3]] : [r(cx - m), r(cy - m), r(2 * m), r(2 * m)];
    this._edit(() => this.model.insert(path, value));
    this.select([...path, region.length]);
  }

  // A shape added in the middle of the piece `name` (in its frame), selected: inside it.
  _addInside(name) {
    const piece = this.model.data?.furniture?.[name], {m} = this._frame(), r = round;
    if (!piece) return;
    if (piece.extra !== undefined && !Array.isArray(piece.extra)) return this._message(`${name}'s extra is raw SVG: edit it in the YAML`);
    const {rect, circle, poly} = piece.shape || {};
    const c = rect ? [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2] : circle ? circle.slice(0, 2)
      : (poly || [[0, 0]]).reduce((a, q, _, all) => [a[0] + q[0] / all.length, a[1] + q[1] / all.length], [0, 0]);
    const value = {rect: [r(c[0] - 0.2 * m), r(c[1] - 0.1 * m), r(0.4 * m), r(0.2 * m)], class: 'furn2'};
    this._edit(() => this.model.insert(['furniture', name, 'extra'], value));
    this.select(['furniture', name, 'extra', (piece.extra || []).length]);
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

  // Deletes items, as one edit; a piece of furniture leaves the lights' shadows too. A room keeps one rectangle.
  _remove(paths) {
    const parts = paths.filter(p => p[0] === 'rooms' && p.length === 3);
    for (const name of new Set(parts.map(p => p[1]))) {
      if (parts.filter(p => p[1] === name).length >= (this.model.get(['rooms', name]) || []).length) {
        return this._message(`${name} needs a rectangle at least: delete the room itself instead`);
      }
    }
    const refs = paths.flatMap(p => (p[0] === 'furniture' && p.length === 2 ? this._references('furniture', p[1]) : []));
    // Last first, so that the indexes of the others stay right.
    const all = [...paths, ...refs].sort(byPathDescending).filter((p, i, a) => !i || !samePath(p, a[i - 1]));
    this._edit(() => this.model.edit(doc => {
      for (const p of all) if (!doc.deleteIn(p) && paths.includes(p)) throw new Error(`Nothing at ${p.join('.')}`);
    }));
    if (this._inside !== null && paths.every(isExtra)) this._selectAll([]);
    else this.select(null);
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
    b.grid.setAttribute('aria-pressed', this._showGrid);
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
      } else if (act === 'ha') {
        this._haDialog();
      } else if (act === 'grid') {
        this._showGrid = !this._showGrid;
        this._renderGrid();
        this._updateButtons();
      } else if (act === 'dark') {
        this._dark = !this._dark;
        this._el.preview.classList.toggle('dark', this._dark);
        this._renderCard();
        this._updateButtons();
      } else if (act === 'new') {
        this._el.start.returnValue = '';
        this._el.start.showModal();
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

  // The start dialog closed: a new home from the example, an empty one, or a picture of a plan.
  async _started() {
    const how = this._el.start.returnValue, form = this._el.start.querySelector('form');
    if (!['example', 'empty', 'picture'].includes(how)) return;
    try {
      if (how === 'picture') {
        const file = await new Promise(resolve => {
          const input = Object.assign(document.createElement('input'), {type: 'file', accept: 'image/*'});
          input.onchange = () => resolve(input.files[0]);
          input.oncancel = () => resolve(null);
          input.click();
        });
        if (file) await this._picture(file);
        return;
      }
      if (this._unsaved() && !confirm('Start a new home? The changes not saved are lost.')) return;
      if (how === 'example') this._open({name: 'home.yaml', text: this.example, handle: null});
      else {
        const [w, h, scale] = ['w', 'h', 'scale'].map(k => +form.elements[k].value);
        if (!(w > 0 && h > 0 && scale > 0)) throw new Error('An empty home needs a size and a scale above 0');
        this._open({name: 'home.yaml', text: emptyHome(w, h, scale), handle: null});
        this._opts.floor = true;
        this.setTool('wall');
      }
    } catch (e) {
      this._message(e.message);
    }
  }

  // A picture of a plan: the background of the open home if it names it (/local/<its name>), or else a new home
  // drawn over it, in its pixels, with the scale tool ready to measure a known length on it.
  async _picture(file) {
    const path = `/local/${file.name}`, url = URL.createObjectURL(file);
    const own = this._data?.drawing?.background?.image;
    if (own === path || own?.split('/').pop() === file.name) {
      this._pictures[own] = url;
      savePicture(own, file);
      this._renderCard();
      return;
    }
    const {w, h} = await imageSize(url);
    if (this._unsaved() && !confirm('Start a new home over this picture? The changes not saved are lost.')) return;
    this._pictures[path] = url;
    savePicture(path, file);
    this._open({name: `${file.name.replace(/\.[^.]+$/, '')}.yaml`, text: pictureHome(path, w, h), handle: null});
    // Its floor would hide the picture: rooms start without one (the room tool's checkbox).
    this._opts.floor = false;
    this.setTool('scale');
    this._message(`Now drag along something on the picture whose length you know (a wall, a door), and type its length: that sets the scale. In Home Assistant, put ${file.name} in /config/www/.`, 'info');
  }

  // A picture kept in the browser, for a background the home names (false when there's none: the home's own URL).
  _loadPicture(path) {
    this._pictures[path] = null;
    loadPicture(path).then(blob => {
      this._pictures[path] = blob ? URL.createObjectURL(blob) : false;
      this._renderCard();
    });
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
    this._inside = null;
    this._renderTools();
    this._data = null;
    this._home = null;
    this._sel = null;
    this._sels = [];
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
      } else if (key === 'd' && !typing && this._sels.length) {
        e.preventDefault();
        this._duplicate();
      }
      return;
    }
    if (typing || !this._root.contains(target) && target !== this) return;
    const arrow = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
    if (this._poly && (e.key === 'Enter' || e.key === 'Backspace')) {
      e.preventDefault();
      if (e.key === 'Enter') this._finishPoly();
      else if (this._poly.points.pop() && !this._poly.points.length) { this._poly = null; this._el.draft.innerHTML = ''; }
      return;
    }
    if (e.key === 'Escape') {
      if (this._press) this._cancelDrag();
      else if (this._poly) { this._poly = null; this._el.draft.innerHTML = ''; this._el.ruler.textContent = ''; }
      else if (this._tool !== 'select') this.setTool('select');
      else if (this._inside !== null) this._leave();
      else this.select(null);
    } else if (e.key === 'Enter' && this._tool === 'select' && this._sels.length === 1 && this._sel[0] === 'furniture' && this._sel.length === 2) {
      e.preventDefault();
      this._enter(this._sel[1]);
    } else if (!e.altKey && !e.shiftKey && TOOL_KEYS[e.key.toLowerCase()] && e.key.length === 1) this.setTool(TOOL_KEYS[e.key.toLowerCase()]);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && this._sels.length) {
      e.preventDefault();
      this._remove(this._sels);
    } else if (arrow && this._sels.length && !e.altKey) {
      e.preventDefault();
      const step = this._grid() * (e.shiftKey ? 10 : 1);
      this._moveBy(arrow[0] * step, arrow[1] * step);
    } else if (e.key === 'Tab' && target === this._el.preview && this._hits?.length > 1) {
      e.preventDefault();
      this._cycle(e.shiftKey ? -1 : 1);
    }
  }
}
