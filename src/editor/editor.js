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
//
// Its shell (the `shell` attribute, set before it's connected): `standalone` (the page's: files, drafts in the
// browser, the Home Assistant sign-in) or `ha` (inside Home Assistant's card editor: the home comes in as `value` and
// goes out with a `value-changed` event after every edit that leaves it without mistakes; `hass` gives the states,
// the location and the theme; keys only while the editor has the focus, and those it uses don't reach HA).
import {HomeModel, renameIn, yamlOf} from './model.js';
import {simulatorControls} from './controls.js';
import {droppedFile, formatOf, hasFileAccess, imageSize, loadPicture, pickFile, renamed, savePicture, saveFileAs, writeFile} from './files.js';
import {HaConnection, cannotReach, finishSignIn, haUrl, savedTokens, signIn, signOut} from './live.js';
import {OPENING_KINDS, emptyHome, lightFrom, openingFrom, pictureHome, pieceFrom, scaleFrom, wallFrom} from './create.js';
import {PREFABS, placePrefab, prefab, prefabOf, prefabSvg, turnedPiece} from './prefabs.js';
import {devicesIn, iconOf, placeDevice, placedIn} from './devices.js';
import {CUTS, adoptOps, applyOps, boundaryAt, boundaryRange, cutOps, cutRunOf, cutSpan, deleteOps, snapCut, gapOf, lampEntityOps, moveBoundaryOps, moveRoomOps, partOf, partsOf, regroupOps,
  resizeCutOps, roomOps, slideOps, snapRoom, splitCutOps, wallAt} from './build.js';
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
// Clicks closer together than this make one run, as a double-click's two do (ms).
const CLICKS = 500;
// How far the pointer moves before a press is a drag (px); a handle's size (px); a turn's steps (°).
const DRAG = 4;
const HANDLE = 8;
const TURN_STEP = 15;
// The grid, as a share of a metre (5 cm).
const GRID = 0.05;
// What each tool does, under the plan.
const HINTS = {
  select: "Click to select (again, or Tab: what's under it; Shift+click: more), drag on empty space for a box · drag to move, Ctrl (⌘)+drag a piece to turn it · in Build, double-click something to change its parts, or a room's name to rename it · the handles to resize, turn or reshape (double-click a corner removes it; Alt: a piece's insides stay) · Shift: along an axis, Alt: no snapping · arrows nudge (Shift: ×10) · Ctrl+D duplicates · double-click a piece (or Enter) to edit its insides · with a lamp selected, Ctrl+click a piece to add it to its shadows or take it out · Alt+click taps the card · Esc clears",
  wall: "Drag a wall's box, or along its middle for a wall of the usual thickness (25 cm outside, 15 cm inside a room) · Esc: back to selecting",
  room: 'Drag a rectangle, or click its corners for a polygon (click the first again, double-click or Enter to finish; Backspace takes the last back) · Esc: back to selecting',
  opening: 'Drag along an outer wall, from one end of the window or door to the other: its side and thickness come from the wall · Esc: back to selecting',
  piece: 'Drag a rectangle, from the middle out for a circle, or click corners for a polygon (choose in the details); a click places a piece of the usual size · Esc: back to selecting',
  light: "Click where the lamp is, or drag out its glow's size: its pool and shadows come with it · Esc: back to selecting",
  marker: 'Click where the marker goes · Esc: back to selecting',
  label: 'Click where the label goes (its middle) · Esc: back to selecting',
  scale: 'Drag along something whose length you know (a wall, a door), then type its length to set the scale; or just measure · Esc: back to selecting',
  // The Build view's.
  'build-room': "Drag a room's rectangle: its walls, floor and name come with it. Drawn against another room's wall, it shares it · click a room to select it, double-click it to rename it · Esc: back to selecting",
  'build-piece': 'Choose a piece, then Shift+click where it goes (or drag it onto the plan) · R turns it · click a piece to select it, drag to move it, R or Ctrl (⌘)+drag turns it · Esc: back to selecting',
  'build-device': 'Choose a lamp or device, then Shift+click where it is (or drag it onto the plan); a blind dropped on a window is its shutter · click one to select it, drag to move it · Esc: back to selecting',
  'build-north': 'Click on the plan in the direction of north (or type its bearing in the details) · Esc: back to selecting',
  'build-cut': 'Click on a wall for a window or a door of the width in the details, or drag along the wall for its width; in a wall between rooms, a doorway · drag the end of one to resize it · Esc: back to selecting',
};
// What the Build view's tab says for each of its tools.
const BUILD_HELP = {
  select: 'Build your home step by step with the tools by the plan: rooms first, then windows and doors, furniture, lamps. Click anything to select it, drag to move it, double-click it to change its parts. Anything finer is in the Edit view.',
  'build-room': 'Name the room here (or leave it without a name: no label then; double-click it later to name it), then drag its rectangle. Start with the rooms indoors; a terrace or a balcony is a room outdoors, without walls of its own.',
  'build-piece': 'Choose a piece, then Shift+click on the plan where it goes, or drag it there. R (or Turn) turns it a quarter. Each piece has its real size and height: the tall ones cast long shadows. A table comes with its chairs, and moves and turns with them.',
  'build-device': 'Your lamps and devices. Choose one, then Shift+click on the plan where it is, or drag it there. A light becomes a lamp that glows in its colour, with a marker that switches it; a blind or shutter dropped on a window darkens it as it closes; a sensor shows its value. Those already on the plan are ticked.',
  'build-north': 'Which way is north? Click on the plan in its direction, or type the bearing the top of the plan faces (0: north is up). It sets where the sun comes in: a map of your building gives it best; a phone compass can be far off indoors.',
  'build-cut': 'Choose a window, a glass door or a door, then click on a wall (for the width here) or drag along it (for its own width). Drag the end of a window, door or doorway to make it wider or narrower: its wall, glass and opening follow. Windows and glass doors let the sun in; in a wall between two rooms you always get a doorway.',
};
// Inside a piece of furniture: what the tools do there, and the ones offered.
const INSIDE_HINTS = {
  select: "Inside {name}: click its shapes to select them (again, or Tab: what's under it; Shift+click: more), drag on its empty space for a box · drag to move, the handles to resize · Shift: along an axis, Alt: no snapping · arrows nudge · Ctrl+D duplicates · Esc or a click outside it leaves",
  piece: 'Inside {name}: drag a rectangle (a cushion, a device), a circle from its middle, or a line (choose in the details); a click places a small one · Esc: back to selecting',
  label: 'Inside {name}: click where the label goes · Esc: back to selecting',
  scale: HINTS.scale,
};
// Inside a Build object (a room, a window, a lamp, furniture from the catalogue), entered by a double-click.
const GROUP_HINT = "Inside {name}: click its parts to select them (again, or Tab: what's under it; Shift+click: more) · drag to move one, the handles to resize · arrows nudge · Esc or a click outside leaves";
// The keys of the tools.
const TOOL_KEYS = {v: 'select', w: 'wall', r: 'room', o: 'opening', f: 'piece', l: 'light', m: 'marker', t: 'label', s: 'scale'};

// The tools, as icons (24 × 24, stroked), with their names and keys as tooltips; the view shows its own.
const ICONS = {
  select: '<path d="M6 3.5 18 13l-5.6.8 3.2 6.2-2.4 1.2-3.2-6.3L6 18.6z"/>',
  rooms: '<path d="M3.5 4.5h17v15h-17zM12 4.5v8M12 16v3.5M12 12.5h3"/>',
  openings: '<path d="M2.5 9.5h6v5h-6zM15.5 9.5h6v5h-6zM8.5 12h7"/>',
  furniture: '<path d="M4 10.5V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M3 11.5a1.5 1.5 0 0 1 3 0V14h12v-2.5a1.5 1.5 0 0 1 3 0V17H3zM5 17v2M19 17v2"/>',
  entities: '<path d="M9 17.5h6M10 20.5h4M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.3-1 2v1h-5v-1c0-.7-.4-1.5-1-2z"/>',
  wall: '<path d="M3 8.5h18v7H3z"/>',
  room: '<path d="M4 4.5h10l6 6v9H4z"/>',
  opening: '<path d="M2.5 9.5h6v5h-6zM15.5 9.5h6v5h-6zM8.5 10.5h7M8.5 13.5h7"/>',
  piece: '<path d="M5 6.5h14v11H5zM8 9.5h8"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  marker: '<circle cx="12" cy="10" r="3"/><path d="M12 21.5s-6.5-6.2-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11.5-6.5 11.5z"/>',
  label: '<path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6"/>',
  scale: '<path d="M3 15.5 15.5 3 21 8.5 8.5 21zM7 14.5l1.5 1.5M10 11.5l2 2M13 8.5l1.5 1.5"/>',
};
const TOOLS = [
  ['select', 'select', 'Select and move (V)', ''],
  ['build-room', 'rooms', 'Rooms: drag one, its walls come with it', 'build-only'],
  ['build-cut', 'openings', 'Windows and doors: click on a wall', 'build-only'],
  ['build-piece', 'furniture', 'Furniture from the catalogue', 'build-only'],
  ['build-device', 'entities', 'Lamps and devices from Home Assistant', 'build-only'],
  ['wall', 'wall', 'Walls (W)', 'edit-only'], ['room', 'room', 'Rooms (R)', 'edit-only'], ['opening', 'opening', 'Windows and doors (O)', 'edit-only'],
  ['piece', 'piece', 'Furniture (F)', 'edit-only'], ['light', 'light', 'Lamps (L)', 'edit-only'], ['marker', 'marker', 'Markers (M)', 'edit-only'],
  ['label', 'label', 'Labels (T)', 'edit-only'], ['scale', 'scale', 'Measure, or set the scale from a known length (S)', 'edit-only'],
];
const TOOLBAR = `<div class="lw-tools" role="toolbar" aria-label="Tools">${TOOLS.map(([tool, icon, title, cls]) =>
  `<button type="button" data-tool="${tool}" class="${cls}" title="${title}" aria-label="${title}"><svg viewBox="0 0 24 24">${ICONS[icon]}</svg></button>`).join('')}</div>`;
// The toolbar's width beside the plan, and its gap (px).
const TOOLBAR_SIDE = 44, TOOLBAR_GAP = 8;

// The editing layer's styles: the overlay over the card's drawing (selection, handles, guides, drafts), the ruler and
// the name field. In the editor's own stage, or inside HA's preview card when the editor edits on it (`.lw-edit`).
const OVERLAY_STYLE = `
  .lw-edit { position: absolute; inset: 0; pointer-events: none; outline: none; --accent: var(--primary-color, #1e88e5); }
  .lw-edit > * { pointer-events: auto; } .lw-edit > .ruler { pointer-events: none; }
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
  .preview.dark .overlay .inside .dim, :host([dark]) .lw-edit .overlay .inside .dim { fill: rgba(17, 17, 17, 0.6); }
  .overlay .inside .piece, .overlay .inside .group * { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 6 4; fill: none; }
  .overlay .inside mask > rect { fill: #fff; } .overlay .inside mask .hole * { fill: #000; stroke: #000; stroke-width: 6; }
  .overlay .inside .pool { display: none; }
  .preview.dark .overlay .inside .dim.all, :host([dark]) .lw-edit .overlay .inside .dim.all { fill: rgba(17, 17, 17, 0.6); }
  .overlay.drawing { cursor: crosshair !important; }
  .overlay.drawing.grab { cursor: move !important; }
  .overlay.drawing.grab-x { cursor: ew-resize !important; } .overlay.drawing.grab-y { cursor: ns-resize !important; }
  .ruler { position: absolute; pointer-events: none; padding: 2px 6px; border-radius: 4px; background: rgba(0, 0, 0, 0.75);
    color: #fff; font: 12px ui-monospace, Menlo, Consolas, monospace; white-space: pre; }
  .ruler:empty { display: none; }
  .overlay .draft rect.cut { fill: var(--accent); fill-opacity: 0.5; stroke: none; }
  input.name-edit { position: absolute; transform: translate(-50%, -50%); z-index: 3; font: 600 16px system-ui, sans-serif;
    text-align: center; padding: 4px 8px; border: 2px solid var(--accent); border-radius: 6px; background: var(--lw-panel);
    color: var(--lw-text); min-width: 8em; }
  .overlay .draft rect.cut.grab { fill-opacity: 0.9; }
  .overlay .draft .north * { stroke: #d81b60; stroke-width: 3; fill: none; }
  .lw-tools { position: absolute; z-index: 4; display: flex; gap: 2px; padding: 3px; border: 1px solid var(--divider-color, #ddd);
    border-radius: 10px; background: var(--card-background-color, #fff); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); box-sizing: border-box; }
  .lw-tools.beside { right: 100%; top: 0; margin-right: ${TOOLBAR_GAP}px; flex-direction: column; width: ${TOOLBAR_SIDE}px; }
  .lw-tools:not(.beside) { bottom: 100%; left: 0; margin-bottom: ${TOOLBAR_GAP}px; }
  .lw-tools button { width: 36px; height: 36px; padding: 0; border: 0; border-radius: 7px; background: none; display: grid; place-items: center;
    color: var(--primary-text-color, #333); cursor: pointer; }
  .lw-tools button:hover:not(:disabled) { background: rgba(127, 127, 127, 0.16); }
  .lw-tools button[aria-pressed="true"] { background: var(--primary-color, #1e88e5); color: var(--text-primary-color, #fff); }
  .lw-tools button:disabled { opacity: 0.35; cursor: default; }
  .lw-tools svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .lw-tools[data-shows=build] .edit-only, .lw-tools[data-shows=edit] .build-only { display: none; }
  .overlay .draft .north text { fill: #d81b60; stroke: none; font: bold 28px sans-serif; text-anchor: middle; vector-effect: none; }
`;

const STYLE = `${OVERLAY_STYLE}
  :host { display: grid; grid-template-rows: auto 1fr auto; height: 100%; font: 14px system-ui, sans-serif;
    --lw-bg: #f6f6f4; --lw-panel: #fff; --lw-text: #222; --lw-muted: #666; --lw-faint: #888; --lw-line: #ddd;
    --lw-border: #ccc; --lw-button: #fafafa; --lw-button-hover: #eee; --lw-accent: #1e88e5; --lw-row-hover: #f2f6fb;
    --lw-row-on: #e3f0fc; --lw-error: #b00020; --lw-error-bg: #fff3f3;
    color: var(--lw-text); background: var(--lw-bg); --line: var(--lw-line); --accent: var(--lw-accent); }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; background: var(--lw-panel);
    border-bottom: 1px solid var(--line); }
  header h1 { font-size: 15px; margin: 0 10px 0 0; }
  header .name { color: var(--lw-muted); margin-right: auto; }
  header .name.unsaved::after { content: ' •'; color: #e65100; }
  header .ha::before { content: '● '; color: var(--lw-faint); } header .ha.on::before { color: #2e7d32; } header .ha.off::before { color: #e65100; }
  dialog.ha input[name=url] { width: 100%; box-sizing: border-box; font: inherit; padding: 4px 6px; margin: 4px 0 8px; }
  dialog.ha .why { color: var(--lw-error); } dialog.ha .status { color: var(--lw-muted); }
  button { font: inherit; padding: 4px 10px; border: 1px solid var(--lw-border); border-radius: 6px; background: var(--lw-button);
    color: inherit; cursor: pointer; }
  button:hover:not(:disabled) { background: var(--lw-button-hover); } button:disabled { opacity: 0.45; cursor: default; }
  button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
  main { display: grid; grid-template-columns: 300px minmax(320px, 1fr) minmax(320px, 0.75fr); min-height: 0; }
  main > * { min-height: 0; }
  .side { display: flex; flex-direction: column; background: var(--lw-panel); min-height: 0; }
  .side.left { border-right: 1px solid var(--line); } .side.right { border-left: 1px solid var(--line); }
  .tabs { display: flex; border-bottom: 1px solid var(--line); flex: none; }
  .tabs button { flex: 1; border: 0; border-radius: 0; background: none; padding: 8px; color: var(--lw-muted); }
  .tabs button[aria-selected="true"] { color: var(--lw-text); box-shadow: inset 0 -2px var(--accent); }
  .pane { flex: 1; overflow: auto; min-height: 0; } .pane[hidden] { display: none; }
  .controls { padding: 12px; } .controls form { width: auto; }
  .preview { padding: 16px; display: flex; justify-content: center; align-items: flex-start; overflow: auto; outline: none; }
  .preview.dark { background: #111; } .preview.dark .hint { color: #bbb; }
  .stage { position: relative; width: 100%; max-width: 900px; }
  ha-card { display: block; border-radius: 12px; background: var(--card-background-color, #fff); }
  .preview.dark ha-card { --card-background-color: #1c1c1c; }
  .stage.beside { margin-left: ${TOOLBAR_SIDE + TOOLBAR_GAP}px; width: calc(100% - ${TOOLBAR_SIDE + TOOLBAR_GAP}px); }
  .stage:not(.beside) { margin-top: 50px; }
  dialog { border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; max-width: 460px; font: 14px system-ui, sans-serif;
    background: var(--lw-panel); color: var(--lw-text); }
  .props .back { margin: 0 0 8px; }
  .props details.multi { border-bottom: 1px solid var(--lw-line); }
  .props details.multi > summary { cursor: pointer; padding: 7px 2px; font-weight: 600; }
  .props details.multi > .body { padding: 0 0 10px 14px; }
  .props .title .grow { flex: 1; }
  dialog h2 { margin: 0 0 12px; font-size: 16px; }
  dialog .choice { display: grid; gap: 4px; margin: 0 0 14px; }
  dialog .choice p { margin: 0; color: var(--lw-muted); font-size: 13px; }
  dialog input[type=number] { width: 5em; font: inherit; }
  dialog .end { text-align: right; }
  .preview:focus-visible .stage { outline: 2px solid rgba(30, 136, 229, 0.4); outline-offset: 4px; border-radius: 12px; }
  .hint { color: var(--lw-faint); font-size: 12px; margin: 8px 0 0; text-align: center; }
  .text { display: flex; height: 100%; }
  .text textarea { flex: 1; border: 0; padding: 10px 12px; resize: none; tab-size: 2; white-space: pre; outline: none;
    font: 12.5px/1.5 ui-monospace, Menlo, Consolas, monospace; background: var(--lw-panel); color: var(--lw-text); }
  /* The list */
  .list { padding: 6px 0 12px; font-size: 13px; }
  .list summary { display: flex; align-items: center; gap: 6px; padding: 5px 10px; cursor: pointer; font-weight: 600; }
  .list .loose { margin: 12px 10px 2px; padding-top: 8px; border-top: 1px solid var(--lw-line); color: var(--lw-muted);
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .list summary small { color: var(--lw-faint); font-weight: normal; margin-right: auto; }
  .list summary .add { padding: 0 7px; line-height: 18px; font-weight: normal; }
  .items { list-style: none; margin: 0; padding: 0; }
  .item { padding: 3px 10px 3px 24px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item.home { padding-left: 10px; font-weight: 600; }
  .item:hover { background: var(--lw-row-hover); } .item.on { background: var(--lw-row-on); box-shadow: inset 3px 0 var(--accent); }
  .item.drop { box-shadow: inset 0 2px var(--accent); }
  .item.extra { padding-left: 40px; color: var(--lw-muted); } .item.in { font-weight: 600; }
  .item .fold { display: inline-block; width: 14px; margin-left: -14px; color: var(--lw-faint); }
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
  .props .help { color: var(--lw-muted); margin: 2px 0 8px; }
  .props .row { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 8px; margin: 3px 0; }
  .props .row.absent { display: block; }
  .props .key { color: var(--lw-muted); overflow: hidden; text-overflow: ellipsis; } .props .key.required::after { content: ' *'; color: var(--lw-error); }
  .props .value { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .props input[type=text], .props input[type=number], .props select, .props textarea { font: inherit; padding: 3px 5px;
    border: 1px solid var(--lw-border); border-radius: 4px; min-width: 0; flex: 1; background: var(--lw-panel); color: inherit; }
  .props textarea { font: 12px ui-monospace, Menlo, Consolas, monospace; resize: vertical; }
  .props textarea.bad { border-color: var(--lw-error); } .props textarea.prose { font: inherit; }
  .props .numbers { display: flex; gap: 4px; flex: 1; min-width: 0; }
  .props .numbers label { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .props .numbers small { color: var(--lw-faint); font-size: 10px; }
  .props .checks { display: flex; flex-wrap: wrap; gap: 2px 10px; }
  .props .unit { color: var(--lw-faint); min-width: 1em; }
  .props .swatch { width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--lw-border); flex: none; }
  .props fieldset { border: 1px solid var(--lw-line); border-radius: 6px; margin: 8px 0; padding: 4px 8px 6px; }
  .props legend { display: flex; align-items: center; gap: 6px; padding: 0 4px; }
  .props button.clear { padding: 0 6px; line-height: 16px; }
  .props button.add-field { margin: 4px 0; font-size: 12px; padding: 2px 8px; }
  .props button.delete { color: var(--lw-error); }
  .props .stack { display: flex; flex-direction: column; flex: 1; min-width: 0; position: relative; }
  .props .note { color: var(--lw-faint); font-size: 11px; min-height: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .props .entities { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .props .icon { width: 20px; height: 20px; flex: none; background: var(--lw-muted); -webkit-mask: var(--icon) center/contain no-repeat;
    mask: var(--icon) center/contain no-repeat; }
  .props .found { position: absolute; top: 100%; left: 0; right: 0; z-index: 2; max-height: 260px; overflow: auto; background: var(--lw-panel);
    border: 1px solid var(--lw-border); border-radius: 6px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15); display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .props .found[hidden] { display: none; }
  .props .found button { display: flex; align-items: center; gap: 6px; border: 0; border-radius: 0; background: none; padding: 4px 6px;
    font-size: 12px; text-align: left; overflow: hidden; }
  .props .found button span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .props .label-now { margin: 6px 0 2px; } .props .label-now.none { color: var(--lw-faint); }
  .props .step { margin: 2px 0; } .props .step input[type=number] { flex: 1; min-width: 3em; }
  .props .step input[type=color] { width: 36px; height: 24px; padding: 0 2px; flex: none; }
  footer { max-height: 30vh; overflow: auto; border-top: 1px solid var(--line); background: var(--lw-panel); }
  footer:empty { display: none; }
  footer p { margin: 0; padding: 4px 12px; font: 12.5px ui-monospace, Menlo, Consolas, monospace; color: var(--lw-error); }
  footer p.link { cursor: pointer; } footer p.link:hover { background: var(--lw-error-bg); }
  footer p.info { color: var(--lw-muted); font-family: inherit; }
  .drop { position: absolute; inset: 0; display: none; place-items: center; background: rgba(30, 136, 229, 0.12);
    border: 3px dashed var(--accent); font-size: 18px; pointer-events: none; }
  :host(.dragging) .drop { display: grid; }
  @media (max-width: 1000px) {
    main { grid-template-columns: 1fr; grid-auto-rows: auto; overflow: auto; }
    .pane { overflow: visible; }
    .text textarea { min-height: 50vh; }
  }
  /* The views: Build's tools and tab, or Edit's. */
  header .views { display: inline-flex; margin-right: 8px; }
  header .views button { border-radius: 0; } header .views button:first-child { border-radius: 6px 0 0 6px; }
  header .views button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
  :host(:not([view=build])) .build-only, :host([view=build]) .edit-only { display: none; }
  .preview > div { width: 100%; max-width: 900px; }
  .props .options { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin: 4px 0 10px; }
  .props .options select, .props .options input[type=number], .props .options input[type=text] { flex: none; }
  .props .muted { color: var(--lw-muted); }
  .props h3 { font-size: 11px; margin: 10px 0 4px; color: var(--lw-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .catalogue { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 4px; }
  .catalogue button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; font-size: 11px;
    line-height: 1.2; text-align: center; cursor: grab; }
  .catalogue button[aria-pressed="true"] { background: var(--lw-row-on); color: inherit; border-color: var(--accent); }
  .catalogue svg { width: 48px; height: 30px; overflow: visible; }
  .catalogue svg * { stroke: #77704a; stroke-width: 0.02; fill: #fbf6d6; }
  .catalogue svg .furn2 { fill: #e4dba2; } .catalogue svg .dev { fill: #3a3a3a; stroke: none; }
  .catalogue svg .fix2 { fill: #b5b5b5; } .catalogue svg .line { fill: none; }
  .catalogue svg .glow { fill: #ffd54f; stroke: none; opacity: 0.8; } .catalogue svg .glow-line { stroke: #ffb300; fill: none; stroke-width: 0.25; stroke-linecap: round; }
  .props .adopt { background: var(--lw-row-on); padding: 6px 8px; border-radius: 6px; } .props .adopt button { margin-left: 4px; }
  .props .lamp { display: flex; align-items: center; gap: 8px; } .props .lamp select { font: inherit; flex: 1; min-width: 0; width: 0; }
  .props select { max-width: 100%; } .side { min-width: 0; }
  .props input[type=search] { width: 100%; box-sizing: border-box; font: inherit; padding: 4px 8px; margin-bottom: 8px;
    border: 1px solid var(--lw-border); border-radius: 6px; background: var(--lw-panel); color: inherit; }
  .devices { display: flex; flex-direction: column; gap: 2px; }
  .devices button { display: flex; align-items: center; gap: 8px; border: 0; border-radius: 4px; background: none; text-align: left;
    padding: 4px 6px; cursor: grab; --mdc-icon-size: 18px; }
  .devices button:hover { background: var(--lw-row-hover); } .devices button[aria-pressed="true"] { background: var(--lw-row-on); color: inherit; }
  .devices .dn { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .devices .tick { color: var(--accent); }
  /* The HA shell: Home Assistant's theme, light or dark, and a layout for its card editor's dialog (half of it, beside
     HA's preview): the plan on top, then one row of tabs for the list, the properties, the YAML and the sun. */
  :host([shell=ha]) { height: auto; grid-template-rows: auto auto auto;
    font-family: var(--mdc-typography-font-family, var(--ha-font-family-body, Roboto, system-ui, sans-serif));
    --lw-bg: transparent; --lw-panel: var(--card-background-color, #fff); --lw-text: var(--primary-text-color, #222);
    --lw-muted: var(--secondary-text-color, #666); --lw-faint: var(--disabled-text-color, #888);
    --lw-line: var(--divider-color, #ddd); --lw-border: var(--divider-color, #ccc);
    --lw-button: var(--secondary-background-color, #fafafa); --lw-button-hover: var(--divider-color, #eee);
    --lw-accent: var(--primary-color, #1e88e5); --lw-row-hover: var(--secondary-background-color, #f2f6fb);
    --lw-row-on: rgba(var(--rgb-primary-color, 30, 136, 229), 0.18); --lw-error: var(--error-color, #b00020);
    --lw-error-bg: rgba(var(--rgb-error-color, 219, 68, 55), 0.08); }
  :host([shell=ha]) header { background: none; border: 0; padding: 0 0 8px; }
  :host([shell=ha]) header :is(h1, .name, [data-act=open], [data-act=save], [data-act=save-yaml], [data-act=save-json], [data-act=ha]) { display: none; }
  :host([shell=ha]) main { grid-template-columns: minmax(0, 1fr); grid-template-areas: "preview" "left"; overflow: visible;
    border: 1px solid var(--lw-line); border-radius: 8px; }
  :host([shell=ha]) .tabs button { padding: 8px 4px; }
  :host([hosted]) .stage, :host([hosted]) [data-act=dark], :host([hosted]) [data-tab=controls] { display: none; }
  :host([hosted]) .preview { padding: 0; border: 0; }
  :host([shell=ha]) .hint { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; line-clamp: 1; overflow: hidden; }
  :host([shell=ha]) dialog.start .file-only { display: none; }
  header .tip { flex-basis: 100%; margin: 4px 0 0; font-size: 12px; color: var(--lw-muted); }
  header .tip button { padding: 0 6px; line-height: 16px; margin-left: 4px; }
  :host([shell=ha]) .preview { grid-area: preview; padding: 8px; border-bottom: 1px solid var(--lw-line); }
  :host([shell=ha]) .side { background: none; } :host([shell=ha]) .side.left { grid-area: left; border-right: 0; }
  :host([shell=ha]) .side.right { grid-area: right; border-left: 0; }
  :host([shell=ha]) .pane { flex: none; height: 420px; overflow: auto; }
  :host([shell=ha]) .text textarea { min-height: 300px; }
  :host([shell=ha]) footer { background: none; border: 0; max-height: none; }
  .preview:not(.dark) ha-card { --card-background-color: #fff; }
`;

const HTML = `
  <header>
    <h1>Lightwell editor</h1><span class="views" role="tablist"><button data-view="build" title="Build a home step by step: rooms, windows and doors">Build</button><button data-view="edit" title="Every field and tool">Edit</button></span><span class="name"></span>
    <button data-act="new" title="Start a new home">New…</button>
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
      <div>
      <div class="stage">${TOOLBAR}<svg class="overlay"><g class="inside"></g><g class="grid"></g><g class="hover"></g><g class="shadows"></g><g class="sel"></g><g class="guides"></g><g class="handles"></g><g class="draft"></g><rect class="box" width="0" height="0"/></svg><div class="ruler"></div></div>
      <p class="hint"></p></div>
    </div>
    <div class="side right">
      <div class="tabs" role="tablist"><button data-tab="props" aria-selected="true">Details</button><button data-tab="text">YAML</button></div>
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
    <div class="choice file-only"><button value="example">The example flat</button><p>A made-up flat with every kind of item, to change into yours.</p></div>
    <div class="choice file-only"><button value="picture">Over a picture of its plan…</button><p>A floor plan image (or drop one on the editor):
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
// An element with properties and children.
const h = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
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

  // The home, as plain data (the HA shell's way in and out). Setting one that is the home already does nothing (HA
  // hands each change back); another is a step in the history.
  get value() {
    return this.model ? this.model.data : this._value;
  }

  set value(home) {
    if (!this.model) { this._value = home; return; }
    const json = JSON.stringify(home);
    if (json === JSON.stringify(this.model.data)) return;
    clearTimeout(this._typing);
    this._sent = json;
    if (this.model.setText(yamlOf(home))) this._changed({text: true});
  }

  // Home Assistant's: its states (at most every 250 ms) and location for the controls and pickers, its theme's
  // darkness for the preview at first.
  set hass(hass) {
    this._hass = hass;
    if (!hass) return;
    if (!this._controls) {
      this.states = hass.states;
      if (hass.config?.latitude !== undefined) this.location = {latitude: hass.config.latitude, longitude: hass.config.longitude};
      return;
    }
    this._hassTimer ||= setTimeout(() => {
      this._hassTimer = 0;
      const h = this._hass, first = this._shown.states !== h.states && !this._hassSeen;
      this._hassSeen = true;
      this._controls.setStates(h.states);
      if (!this._located && h.config?.latitude !== undefined) {
        this._located = true;
        this._controls.setLocation({latitude: h.config.latitude, longitude: h.config.longitude});
      }
      // The pickers list them; later changes only reach the card, so as not to redraw a form being typed in.
      if (first) this._renderPanels();
    }, 250);
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (this._root) {
      if (!this._ha) window.addEventListener('keydown', this._keys);
      if (this._offered) {
        window.addEventListener('lightwell-preview', this._offered);
        window.dispatchEvent(new CustomEvent('lightwell-editor-open'));
      }
      return;
    }
    this._ha = this.getAttribute('shell') === 'ha';
    const root = this._root = this.attachShadow({mode: 'open'});
    root.innerHTML = `<style>${STYLE}</style>${HTML}`;
    if (this._ha) this._oneSide(root);
    this.style.position ||= 'relative';
    const $ = s => root.querySelector(s);
    // The YAML (in HA, which has its own code editor, kept out of sight: the history goes through its text).
    this._el = {name: $('.name'), text: $('textarea') || document.createElement('textarea'), footer: $('footer'), preview: $('.preview'), stage: $('.stage'),
      overlay: $('.overlay'), hover: $('.overlay .hover'), sel: $('.overlay .sel'), list: $('.list'), props: $('.props'),
      handles: $('.overlay .handles'), guides: $('.overlay .guides'), box: $('.overlay .box'), grid: $('.overlay .grid'), ruler: $('.ruler'),
      draft: $('.overlay .draft'), shadows: $('.overlay .shadows'), hint: $('.hint'), toolbar: $('.lw-tools'), start: $('dialog.start'),
      ha: $('dialog.ha'), haButton: $('header .ha'), inside: $('.overlay .inside'),
      buttons: Object.fromEntries([...root.querySelectorAll('[data-act]')].map(b => [b.dataset.act, b]))};

    const draft = this._ha ? null : storage.get();
    this.model = new HomeModel(this._value !== undefined ? yamlOf(this._value) : draft?.text ?? this.example);
    this._sent = JSON.stringify(this.model.data);
    this._file = {name: draft?.name ?? 'home.yaml', handle: null, saved: draft?.saved ?? this.model.text};
    this._dark = this._ha && !!this._hass?.themes?.darkMode;
    this._el.preview.classList.toggle('dark', this._dark);
    this._sel = null;
    this._sels = [];
    // The piece of furniture whose insides are being edited (its name), or null.
    this._inside = null;
    // The Build object being edited part by part (its id), or null.
    this._group = null;
    this._showGrid = false;
    this._preview = null;
    this._pictures = {};
    this._opts = {wall: 'auto', floor: true, kind: 'window', glass: true, piece: 'rect', extra: 'rect',
      roomName: '', outdoor: false, cut: 'window', cutWidth: 1.2, prefab: 'sofa_3', turn: 0, device: null, search: ''};
    this._shown = {states: this.states, north: undefined};

    this._card = document.createElement('lightwell-card');
    this._el.stage.prepend(this._card);
    this._card.addEventListener('hass-more-info', e => this._controls?.moreInfo(e.detail.entityId));
    const plan = this.model.home || {openings: [], sun: {entity: 'sun.sun', weather: 'weather.home', north: 0}};
    this._controls = simulatorControls($('form'), {plan, states: this.states, location: this.location, help: false,
      onChange: shown => { this._shown = shown; this._renderCard(); }});
    new ResizeObserver(() => { this._placeTools(); this._place(); }).observe(this._el.preview);

    root.addEventListener('click', e => {
      const act = e.target.closest?.('[data-act]')?.dataset.act;
      if (act) this._act(act);
      const tab = e.target.closest?.('[data-tab]');
      if (tab) this._tab(tab.dataset.tab);
      const view = e.target.closest?.('[data-view]');
      if (view) this.setView(view.dataset.view);
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
    // The toolbar (with the plan: in HA's preview, it goes with the editing layer).
    this._el.toolbar.addEventListener('click', e => {
      const tool = e.target.closest?.('[data-tool]')?.dataset.tool;
      if (!tool) return;
      // A tool that makes something shows its choices in the details: what was selected goes.
      if (tool !== 'select' && this._group === null && this._inside === null && this._sels.length) this.select(null);
      this.setTool(tool);
    });
    const overlay = this._el.overlay;
    overlay.addEventListener('pointerdown', e => this._down(e));
    overlay.addEventListener('pointermove', e => (this._press ? this._dragTo(e) : this._pointer(e)));
    overlay.addEventListener('pointerup', e => this._up(e));
    overlay.addEventListener('pointercancel', () => this._cancelDrag());
    overlay.addEventListener('dblclick', e => this._dblclick(e));
    // A piece dragged from the Build view's catalogue.
    overlay.addEventListener('dragover', e => {
      const types = e.dataTransfer.types;
      if (!types.includes('text/x-lightwell-prefab') && !types.includes('text/x-lightwell-device')) return;
      e.preventDefault();
      const at = this._at(e);
      if (at && types.includes('text/x-lightwell-prefab')) this._prefabPreview(at.p);
    });
    overlay.addEventListener('drop', e => {
      const id = e.dataTransfer.getData('text/x-lightwell-prefab'), device = e.dataTransfer.getData('text/x-lightwell-device'), at = this._at(e);
      if (!(id || device) || !at) return;
      e.preventDefault();
      e.stopPropagation();
      if (device) this._placeDevice(at.p, at.tol, device);
      else {
        this._opts.prefab = id;
        this._placePrefab(at.p);
      }
      this._el.draft.innerHTML = '';
    });
    overlay.addEventListener('pointerleave', () => {
      this._el.hover.innerHTML = '';
      if (this._tool === 'build-cut' || this._tool === 'build-piece') this._el.draft.innerHTML = '';
    });
    this._el.start.addEventListener('close', () => this._started());
    this._el.ha.addEventListener('close', () => this._haClosed());
    this._el.ha.querySelector('input').addEventListener('input', () => this._haCheck());
    this._el.footer.addEventListener('click', e => {
      const path = e.target.closest('p')?.dataset.path;
      if (path) this.select(JSON.parse(path));
    });
    if (this._ha) {
      // Keys reach it only from inside; those it uses (and all but an Esc it has no use for) stop here, so that HA's
      // shortcuts don't fire as the plan is edited, and Esc still closes HA's dialog.
      this.addEventListener('keydown', e => { if (this._key(e) || e.key !== 'Escape') e.stopPropagation(); });
    } else {
      this._keys = e => this._key(e);
      window.addEventListener('keydown', this._keys);
    }
    // Files dropped on it: a home to open, or a picture of a plan (not in HA, where there are no files).
    if (!this._ha) {
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
    }
    this._ctx = {
      commit: (path, value) => this._commit(path, value),
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
      selectObject: id => { this._out(); this._selectObject(id); },
      toggleObject: id => {
        const parts = partsOf(this.model.data, id), all = parts.every(q => this._sels.some(r => samePath(q, r)));
        this._selectAll(all ? this._sels.filter(r => !parts.some(q => samePath(q, r))) : [...this._sels, ...parts]);
      },
      enterObject: (id, path) => { if (this._group !== id) this._out(); this._enterGroup(id, [path]); },
      shapeTemplate: (kind, old) => this._shapeTemplate(kind, old),
    };
    this.setView(this.getAttribute('view') || (this._ha ? 'build' : 'edit'));
    this._changed({text: true});
    if (!this._ha) this._liveStart();
    if (this._ha) {
      // HA's preview of the card (card.js) offers itself; the editor then edits on it, rather than on a copy.
      this._offered = e => this._adopt(e.detail);
      window.addEventListener('lightwell-preview', this._offered);
      window.dispatchEvent(new CustomEvent('lightwell-editor-open'));
    }
  }

  disconnectedCallback() {
    if (this._keys) window.removeEventListener('keydown', this._keys);
    if (this._offered) window.removeEventListener('lightwell-preview', this._offered);
    if (this._hosted) { this._hosted.editLayer = null; this._unplaceTools(this._hosted); }
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
    if (!this._ha) storage.set({text: this.model.text, name: this._file.name, saved: this._file.saved});
    else if (home) {
      const json = JSON.stringify(data);
      if (json !== this._sent) {
        this._sent = json;
        this.dispatchEvent(new CustomEvent('value-changed', {detail: {value: data}}));
      }
    }
  }

  // A field set from the forms (undefined: removed). In the Build view, a lamp's entity set on one of its parts (its
  // light, its marker) is set on all of them, so that its glow, its pool and its marker stay one lamp.
  _commit(path, value) {
    const lamp = this._view === 'build' && this.model.data && lampEntityOps(this.model.data, path, value);
    if (lamp) return this._edit(() => this.model.batch(lamp));
    this._edit(() => (value === undefined ? this.model.get(path) !== undefined && this.model.remove(path) : this.model.set(path, value)));
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
    if (!this._ha && bg && typeof bg.image === 'string' && !(bg.image in this._pictures)) this._loadPicture(bg.image);
    const url = bg && this._pictures[bg.image];
    if (url) data = {...data, drawing: {...data.drawing, background: {...bg, image: url}}};
    else if (bg && url === null) data = {...data, drawing: {...data.drawing, background: undefined}};
    try {
      this._card.setConfig({home: data, north: this._shown.north});
      // HA's preview shows HA's own states and theme (and taps on it act in HA, which the overlay keeps it from).
      this._card.hass = this._hosted ? this._hass : {states: this._effectStates(), themes: {darkMode: this._dark}, callService: this._controls.callService};
    } catch (e) {
      this._message(e.message);
    }
    this._place();
  }

  // HA's preview of the card (`card`, offering itself): the editing layer (the overlay, the ruler) moves into it, over
  // its plan, and the editor's own copy of the card hides. The card then shows the home being edited with HA's own
  // states and theme, so the simulated sun and time and the Dark button go. A newer preview (HA rebuilds it on every
  // change) takes the layer over.
  _adopt(card) {
    if (!card) return;
    // Taking the layer out of the old card fires a focusout: whether it had the keys is taken before.
    const keys = !!this._layerFocus;
    if (card === this._hosted) { card.editLayer = this._layer; this._refocus(); if (card.isConnected) this._placeTools(); return; }
    if (this._hosted) { this._hosted.editLayer = null; this._unplaceTools(this._hosted); }
    if (!this._layer) {
      // Focusable, so that a click on the plan there gives it the keys (the card has nothing else to focus), which it
      // hands to the editor as its own.
      this._layer = Object.assign(document.createElement('div'), {className: 'lw-edit', tabIndex: -1});
      this._layer.innerHTML = `<style>${OVERLAY_STYLE}</style>`;
      this._layer.addEventListener('keydown', e => { if (this._key(e) || e.key !== 'Escape') e.stopPropagation(); });
      // Whether it has the keys. HA rebuilds its preview on every change, taking the layer out with the old card, which
      // drops its focus without a focusout (so the flag stays): the layer gets it back in the new card.
      this._layer.addEventListener('focusin', () => { this._layerFocus = true; });
      this._layer.addEventListener('focusout', e => { if (!this._layer.contains(e.relatedTarget)) this._layerFocus = false; });
    }
    this._layer.append(this._el.overlay, this._el.ruler, this._el.toolbar);
    // The room the toolbar had beside or above the card before (HA rebuilds the card on every change): kept from its
    // first frame, so that the plan doesn't jump while it's measured again.
    if (this._toolRoom) Object.assign(card.style, this._toolRoom);
    this._hosted = this._card = card;
    card.editLayer = this._layer;
    if (this._simulated && Object.keys(this._simulated).length) card.simulated = this._simulated;
    // The new card offers itself before HA puts it in the page (and again once it's there): the keys go back to the
    // layer once it's in the page.
    if (keys) this._focusDue = true;
    this._refocus();
    requestAnimationFrame(() => this._refocus());
    this.setAttribute('hosted', '');
    this._hostObserver?.disconnect();
    this._hostObserver = new ResizeObserver(() => { this._placeTools(); this._place(); });
    this._hostObserver.observe(card);
    this._column = null;
    this._renderCard();
    this._placeTools();
  }

  // The layer gets the keys back, if it had them before HA rebuilt its preview, once it's in the page.
  _refocus() {
    if (!this._focusDue || !this._layer?.isConnected) return;
    this._focusDue = false;
    this._layer.focus({preventScroll: true});
  }

  // The toolbar beside the plan (a column of icons on its left) where there's room for it, otherwise above it. On HA's
  // preview, the room is in the column HA's preview is in (HA keeps the card to 500 px, also in its large mode): the
  // card moves right by the toolbar's width, keeping its own (only our card's margins change, nothing of HA's). In the
  // editor's own stage, by the stage's width.
  _placeTools() {
    const bar = this._el.toolbar, card = this._hosted, side = TOOLBAR_SIDE + TOOLBAR_GAP;
    let beside;
    if (card) {
      // Not in the page yet (HA's new card offers itself before): it keeps the room it was given until it is.
      if (!card.isConnected || !card.offsetWidth) return;
      // The column around the hui-card around our card, once HA has put it there (followed for its width).
      const column = card.parentElement?.parentElement;
      if (column && this._column !== column) { this._column = column; this._hostObserver.observe(column); }
      this._unplaceTools(card);
      const k = card.offsetWidth ? card.getBoundingClientRect().width / card.offsetWidth || 1 : 1, width = card.offsetWidth;
      const pad = column ? parseFloat(getComputedStyle(column).paddingRight) || 0 : 0;
      const room = column ? (column.getBoundingClientRect().right - card.getBoundingClientRect().left) / k - pad : 0;
      beside = room >= width + side;
      bar.classList.toggle('beside', beside);
      this._toolRoom = beside ? {marginLeft: `${side}px`, width: `${width}px`, marginTop: ''} : {marginTop: `${bar.offsetHeight + TOOLBAR_GAP}px`, marginLeft: '', width: ''};
      Object.assign(card.style, this._toolRoom);
    } else {
      beside = this._el.preview.clientWidth >= 500;
      this._el.stage.classList.toggle('beside', beside);
    }
    bar.classList.toggle('beside', beside);
  }

  // Our card as HA laid it out, without the toolbar's room.
  _unplaceTools(card) {
    Object.assign(card.style, {marginLeft: '', marginTop: '', width: ''});
  }

  // The element the editing layer is placed in: the editor's stage, or the layer in HA's preview card.
  _frameEl() {
    return this._hosted ? this._layer : this._el.stage;
  }

  // How much the frame is scaled on screen (HA's dialog zooms in as it opens): its width there over its own.
  _frameScale() {
    const f = this._frameEl(), w = f.offsetWidth;
    return w ? f.getBoundingClientRect().width / w || 1 : 1;
  }

  // A point on the screen (client pixels) in the frame's own pixels, whatever scale it's shown at.
  _inFrame(x, y) {
    const s = this._frameEl().getBoundingClientRect(), k = this._frameScale();
    return [(x - s.left) / k, (y - s.top) / k];
  }

  // The overlay over the card's drawing, in the drawing's units.
  _place() {
    const svg = this._card.shadowRoot?.querySelector('.plan svg'), view = this._home?.view;
    if (!svg || !view) return;
    const r = svg.getBoundingClientRect();
    // Not laid out yet (HA's ha-card renders what's in it a moment after it's made, so just after the card rebuilds,
    // as on every frame of a drag on HA's preview, its drawing has no size): the overlay stays as it is, and is
    // placed again on the next frame.
    if (!r.width || !r.height) {
      this._placeAgain ||= requestAnimationFrame(() => { this._placeAgain = 0; this._place(); });
      return;
    }
    const o = this._el.overlay, [x, y] = this._inFrame(r.left, r.top), k = this._frameScale();
    // What it draws beyond the plan (a lamp's reach, a piece dragged off it) stays within the card: on HA's preview
    // the editor's own column is beside it.
    const f = this._frameEl(), [fw, fh] = [f.offsetWidth, f.offsetHeight];
    Object.assign(o.style, {left: `${x}px`, top: `${y}px`, width: `${r.width / k}px`, height: `${r.height / k}px`,
      clipPath: fw && fh ? `polygon(${-x}px ${-y}px, ${fw - x}px ${-y}px, ${fw - x}px ${fh - y}px, ${-x}px ${fh - y}px)` : ''});
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
  // In the Build view's Furniture and Lamps and devices, those of a selected piece, or lamp, too.
  _handles(data = this._data) {
    const own = this._tool === 'select' || (this._tool === 'build-piece' && ['furniture', 'lights'].includes(this._sel?.[0]))
      || (this._tool === 'build-device' && this._sel?.[0] === 'lights');
    // One item, or in the Build view a lamp (its light's handles: a strip's ends, its pool).
    const one = this._sels.length === 1 || (this._view === 'build' && this._sel?.[0] === 'lights' && this._objectOf(this._sels));
    if (!own || !one || !this.model.home || !data) return [];
    const list = handles(this._sel, itemAt(data, this._sel), this._withPiece(this._sel, data, {reach: 3 * HANDLE * this._px()}));
    // A whole lamp in the Build view: a press on its middle moves all of it, so its pool's centre isn't a handle there
    // (inside it, it is).
    return this._view === 'build' && this._group === null && this._sels.length > 1 ? list.filter(h => h.id !== 'pool') : list;
  }

  // Inside a piece: the rest of the plan dimmed, the piece outlined; the guides and the drawing in its frame.
  _renderInside(home) {
    const piece = home?.furniture?.[this._inside], v = home?.view;
    const turn = pieceTurn(piece);
    for (const g of [this._el.guides, this._el.draft]) turn ? g.setAttribute('transform', turn) : g.removeAttribute('transform');
    if (!piece) { this._el.inside.innerHTML = this._group !== null && home ? this._groupDim(home) : ''; return; }
    const o = pieceOutline(piece), f = v => +v.toFixed(1);
    const d = o.poly ? `M${o.poly.map(q => q.map(f).join(',')).join(' L')} Z`
      : `M${f(o.circle[0] - o.circle[2])},${o.circle[1]} a${o.circle[2]},${o.circle[2]} 0 1,0 ${f(2 * o.circle[2])},0 a${o.circle[2]},${o.circle[2]} 0 1,0 ${f(-2 * o.circle[2])},0 Z`;
    // Far beyond the view, so that the overlay's overflow is dimmed too.
    const [x0, y0, x1, y1] = [v.x - v.w, v.y - v.h, v.x + 2 * v.w, v.y + 2 * v.h];
    this._el.inside.innerHTML = `<path class="dim" d="M${x0},${y0} H${x1} V${y1} H${x0} Z ${d}"/><path class="piece" d="${d}"/>`;
  }

  // Inside a Build object: the rest of the plan dimmed (but where its parts are), its parts outlined.
  _groupDim(home) {
    const v = home.view, parts = partsOf(this.model.data, this._group).map(p => outlineSvg(home, p)).join('');
    const [x, y, w, h] = [v.x, v.y, v.w, v.h];
    return `<mask id="lw-group-hole" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
      + `<g class="hole">${parts}</g></mask><rect class="dim all" x="${x}" y="${y}" width="${w}" height="${h}" mask="url(#lw-group-hole)"/><g class="group">${parts}</g>`;
  }

  // What a Build object is called: a room's name (its label), the catalogue's name for what it was made from, or its id.
  _groupName(id) {
    const label = partsOf(this.model.data, id).find(p => p[1] === 'labels');
    return (label && itemAt(this.model.data, label)?.text) || prefab(id.replace(/_\d+$/, ''))?.name || id.replace(/_(\d+)$/, ' $1').replace(/_/g, ' ');
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
    const hits = hitTest(this._home, at.p, at.tol);
    // Inside a Build object: its parts under the pointer, if any.
    if (this._group !== null) {
      const own = hits.filter(h => partOf(this.model.data, h) === this._group);
      if (own.length) return {hits: own, inside: true};
    }
    return {hits, inside: false};
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

  // Out of the piece (or the Build object), with nothing selected (before selecting what's outside it).
  _out() {
    this._inside = null;
    this._group = null;
    this._hits = null;
    this._sels = [];
    this._sel = null;
    this._renderTools();
    this._renderOverlay();
  }

  // Edits the Build object `id` part by part, selecting `paths` (its parts), as a piece's insides are edited.
  _enterGroup(id, paths = []) {
    if (!partsOf(this.model.data, id).length) return;
    this._group = id;
    this._hits = null;
    this._selectAll(paths);
    this._renderTools();
  }

  // Back out of the Build object, selecting it whole.
  _leaveGroup() {
    const id = this._group;
    this._group = null;
    this._hits = null;
    this._selectObject(id);
    this._renderTools();
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
    renderList(this._el.list, this.model.data, this._sel, {...this._ctx, inside: this._inside, group: this._group, objects: this._objects()}, this._sels);
    this._renderDetails();
    this._renderOverlay();
  }

  // Selects the item at `path` (null: the home itself) in the list, on the plan and in the text.
  select(path) {
    if (!path) { this._inside = null; this._group = null; }
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
    const group = this._group;
    if (group !== null && this._sels.some(p => partOf(this.model.data, p) !== group)) this._group = null;
    this._sel = this._sels.at(-1) || null;
    this._folded = null;
    if (was !== this._inside || group !== this._group) this._renderTools();
    // In HA's dialog, the list and the properties share the tabs: what's selected shows its properties.
    if (this._ha && this._sel && this._tabNow === 'list') this._tab('props');
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

  // In HA's dialog (its editor gets half of it, beside HA's own preview of the card): the two sides as one, under the
  // plan, with one row of tabs (Items, Properties, YAML, Sun and time), and a tip on making the dialog larger (HA's
  // own: a click on its title).
  _oneSide(root) {
    const left = root.querySelector('.side.left'), right = root.querySelector('.side.right'), tabs = left.querySelector('.tabs');
    // No YAML: HA's own code editor shows the card's (its "Show code editor").
    right.querySelector('[data-tab="text"]').remove();
    right.querySelector('[data-pane="text"]').remove();
    tabs.querySelector('[data-tab="list"]').after(...right.querySelectorAll('.tabs [data-tab]'));
    left.append(...right.querySelectorAll('.pane'));
    right.remove();
    let seen = false;
    try { seen = localStorage.getItem('lightwell-editor:tip-large') === '1'; } catch { /* blocked */ }
    if (seen) return;
    const tip = Object.assign(document.createElement('p'), {className: 'tip'});
    tip.innerHTML = 'Tip: click the dialog\'s title to make it larger. <button type="button" title="Got it">×</button>';
    tip.querySelector('button').onclick = () => {
      tip.remove();
      try { localStorage.setItem('lightwell-editor:tip-large', '1'); } catch { /* blocked */ }
    };
    root.querySelector('header').append(tip);
  }

  _tab(name) {
    this._tabNow = name;
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
      // Over a handle of what's selected: no preview of a new one.
      if (this._handleAt(at)) {
        this._el.hover.innerHTML = this._el.draft.innerHTML = '';
        this._el.overlay.classList.add('grab');
        return;
      }
      // Over something the step picks: it outlined (all its parts), and no preview of a new one.
      const grab = this._buildGrab(at);
      if (grab) {
        const id = this._objectAt(grab), paths = id ? partsOf(this.model.data, id) : [grab];
        this._el.hover.innerHTML = paths.filter(p => !this._sels.some(q => samePath(p, q))).map(p => outlineSvg(this._home, p)).join('');
        this._el.draft.innerHTML = '';
        this._el.overlay.classList.add('grab');
        return;
      }
      this._el.overlay.classList.remove('grab');
      if (this._tool === 'build-cut') this._cutPreview(at);
      if (this._tool === 'build-piece') {
        this._lastAt = at.p;
        if (e.shiftKey) this._prefabPreview(at.p);
        else this._el.draft.innerHTML = '';
      }
      return;
    }
    const handle = this._handleAt(at), hit = !handle && this._hitsAt(at).hits[0];
    this._el.hover.innerHTML = hit && !this._sels.some(p => samePath(p, hit)) ? outlineSvg(this._home, hit) : '';
    this._el.overlay.style.cursor = handle ? 'crosshair' : hit && this.model.home ? 'move' : 'default';
  }

  // A room's name edited on the plan, from a double-click on its label (or, with `anywhere`, anywhere in the room): its
  // label's text, in a field over the label (or the room's middle, adding one). Enter or leaving the field keeps it,
  // Esc doesn't. The room's key stays as it is (the references to it use it). False when there's no room there.
  _editRoomName(e, anywhere) {
    const at = this._at(e), data = this.model.data, hits = at ? this._hitsAt(at).hits : [];
    const isRoom = id => id && data.rooms?.[id] !== undefined;
    const room = (anywhere ? hits : hits.filter(h => h[0] === 'drawing' && h[1] === 'labels')).map(h => this._objectAt(h)).find(isRoom);
    if (!room) return false;
    this._selectObject(room);
    const label = partsOf(data, room).find(p => p[0] === 'drawing' && p[1] === 'labels'), shape = label && itemAt(data, label);
    const r = data.rooms[room][0], spot = shape?.at || (Array.isArray(r?.[0]) ? r[0] : [r[0] + r[2] / 2, r[1] + r[3] / 2]);
    const m = this._el.overlay.getScreenCTM(), q = new DOMPoint(...spot).matrixTransform(m), [qx, qy] = this._inFrame(q.x, q.y);
    this._frameEl().querySelector('input.name-edit')?.remove();
    const input = Object.assign(document.createElement('input'), {type: 'text', className: 'name-edit', value: shape?.text ?? '', placeholder: 'Its name', spellcheck: false});
    Object.assign(input.style, {left: `${qx}px`, top: `${qy}px`});
    let done = false;
    const finish = keep => {
      if (done) return;
      done = true;
      const text = input.value.trim();
      input.remove();
      if (!keep || !text || text === shape?.text) return;
      this._setRoomName(room, text);
    };
    // Enter or Esc: the keys back to the plan (the field had them; leaving it by a click elsewhere gives them there).
    const back = () => (this._hosted ? this._layer : this._el.preview).focus({preventScroll: true});
    input.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { finish(true); back(); }
      else if (ev.key === 'Escape') { finish(false); back(); }
    });
    input.addEventListener('blur', () => finish(true));
    this._frameEl().append(input);
    input.focus();
    input.select();
    return true;
  }

  // What a Build step picks under the pointer (its own kind of thing): a window, door or doorway in Windows and doors,
  // a piece in Furniture, a lamp or marker in Lamps and devices. Its path, or undefined. (A gap's end is grabbed
  // before this, to resize it; a room is picked by a click in Rooms, as a drag there draws one.)
  _buildGrab(at) {
    const t = this._tool, data = this.model.data;
    if (!['build-cut', 'build-piece', 'build-device'].includes(t) || !data || (t === 'build-cut' && boundaryAt(data, at.p, at.tol + HANDLE * this._px() / 2))) return undefined;
    return this._hitsAt(at).hits.find(h => (t === 'build-piece' ? h[0] === 'furniture' && h.length === 2
      : t === 'build-device' ? h[0] === 'lights' || h[0] === 'markers'
      : this._isCut(this._objectAt(h))));
  }

  // Whether object `id` is a window or door: a gap of its own, or (adopted from a home not made in Build) an opening
  // or glass.
  _isCut(id) {
    if (!id) return false;
    const data = this.model.data;
    return !!gapOf(data, id) || partsOf(data, id).some(p => p[0] === 'openings' || p[1] === 'glazing');
  }

  // Over a wall in the Build view's Windows and doors: the end of a gap the pointer would grab (outlined), or where a
  // click would cut the wall.
  _cutPreview(at) {
    const data = this.model.data, f = v => +v.toFixed(1);
    if (!data) return;
    // An end of a window or door, or where two side by side meet.
    const grab = boundaryAt(data, at.p, at.tol + HANDLE * this._px() / 2);
    if (grab) {
      const {gap, bounds} = grab.run, v = bounds[grab.k], w = 3 * this._px(), r = gap.axis === 0 ? [v - w, gap.band[0], 2 * w, gap.band[1] - gap.band[0]]
        : [gap.band[0], v - w, gap.band[1] - gap.band[0], 2 * w];
      this._el.overlay.classList.toggle('grab-x', gap.axis === 0);
      this._el.overlay.classList.toggle('grab-y', gap.axis === 1);
      this._el.draft.innerHTML = `<rect class="cut grab" x="${f(r[0])}" y="${f(r[1])}" width="${f(r[2])}" height="${f(r[3])}"/>`;
      return;
    }
    this._el.overlay.classList.remove('grab-x', 'grab-y');
    const r = this._cutRect(at)?.rect;
    this._el.draft.innerHTML = r ? `<rect class="cut" x="${f(r[0])}" y="${f(r[1])}" width="${f(r[2])}" height="${f(r[3])}"/>` : '';
  }

  // The part of the wall under `at` a cut takes: the width chosen around it, or as far as `to` along the wall:
  // {rect, length}, or null.
  _cutRect(at, to) {
    const data = this.model.data, wall = data && wallAt(data, at.p, at.tol);
    if (!wall) return null;
    const r = [...wall.rect], a = r[2] >= r[3] ? 0 : 1;
    const span = to ? [Math.max(Math.min(at.p[a], to[a]), r[a]), Math.min(Math.max(at.p[a], to[a]), r[a] + r[a + 2])]
      : cutSpan(r, at.p[a], this._opts.cutWidth * (data.units_per_metre || 100));
    if (!span) return null;
    // Against a window or door beside it, as the cut will be.
    snapCut(data, wall, span, !to);
    r[a] = span[0];
    r[a + 2] = span[1] - span[0];
    return {rect: r, length: r[a + 2]};
  }

  // A press on the plan: a click when the pointer doesn't move (_click), otherwise a drag (_startDrag).
  _down(e) {
    if (e.button !== 0 || !this._home) return;
    const at = this._at(e);
    if (!at) return;
    (this._hosted ? this._layer : this._el.preview).focus({preventScroll: true});
    try { this._el.overlay.setPointerCapture(e.pointerId); } catch { /* a pointer the browser doesn't track */ }
    this._press = {x: e.clientX, y: e.clientY, at, handle: this._handleAt(at), shift: e.shiftKey, turn: e.ctrlKey || e.metaKey, drag: null};
    // In a Build step, a thing of its own kind under the pointer is selected and moved, rather than a new one made.
    this._press.grab = !this._press.handle && this._buildGrab(at);
    // Furniture, and lamps and devices, are placed by Shift+click (or dragged from the catalogue); a plain click
    // selects, as Select does.
    const placing = !['build-piece', 'build-device'].includes(this._tool) || e.shiftKey;
    if (this._tool !== 'select' && !this._press.grab && !this._press.handle && placing) Object.assign(this._press, {create: true, start: this._snap(e, at, this._poly?.points.at(-1))});
    if (this._tool === 'build-cut') this._press.gapEnd = boundaryAt(this.model.data, at.p, at.tol + HANDLE * this._px() / 2);
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
    // Alt+click taps the card underneath: a marker (in the simulator), or a lamp, or a Build object with something to
    // switch in it, switched (on HA's preview only simulated there: nothing acts on the house).
    if (e.altKey) {
      const marker = !this._hosted && this._card.shadowRoot?.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList?.contains('m'));
      if (marker) return marker.click();
      const entity = this._switchAt(press.at);
      if (entity) this._simulate(entity);
      return;
    }
    // What was selected before a run of clicks: a double-click acts on it, not on what its clicks stepped to.
    const now = performance.now();
    if (!this._clicks || now - this._clicks.t > CLICKS) this._clicks = {sel: this._sel};
    this._clicks.t = now;
    if (press.handle) return;
    const found = this._hitsAt(press.at), inside = found.inside;
    const hits = press.grab ? [press.grab, ...found.hits.filter(h => !samePath(h, press.grab))] : found.hits;
    // A click outside the piece (or Build object) being edited leaves it.
    if ((this._inside !== null || this._group !== null) && !inside) this._out();
    if ((e.ctrlKey || e.metaKey) && this._toggleShadow(hits)) return;
    if (press.shift) {
      // A Build object goes in or out whole.
      const id = hits[0] && this._objectAt(hits[0]);
      if (id) {
        const parts = partsOf(this.model.data, id), all = parts.every(q => this._sels.some(r => samePath(q, r)));
        this._selectAll(all ? this._sels.filter(r => !parts.some(q => samePath(q, r))) : [...this._sels, ...parts]);
      } else if (hits[0]) this._toggle(hits[0]);
      return;
    }
    const again = this._hits && hits.length && hits.map(pathKey).join() === this._hits.map(pathKey).join();
    this._hits = hits;
    if (again) return this._cycle();
    if (inside) this._selectAll(hits.slice(0, 1));
    else if (this._objectAt(hits[0])) this._selectObject(this._objectAt(hits[0]));
    else this.select(hits[0] || null);
  }

  // What an Alt+click at `at` switches: the entity of the lamp under it (or of a Build object's lamp, or a marker that
  // switches: a switch, a fan, a media player), or undefined.
  _switchAt(at) {
    const data = this.model.data, switches = id => /^(light|switch|fan|input_boolean|media_player)\./.test(id || '');
    const entityOf = path => {
      const item = itemAt(data, path);
      if (path[0] === 'lights') return item?.entities?.find(switches);
      if (path[0] === 'markers') return switches(item?.entity) ? item.entity : undefined;
      return undefined;
    };
    for (const hit of this._hitsAt(at).hits) {
      const id = this._view === 'build' ? partOf(data, hit) : undefined, paths = id && data.rooms?.[id] === undefined ? partsOf(data, id) : [hit];
      const entity = [...paths.filter(p => p[0] === 'lights'), ...paths.filter(p => p[0] === 'markers')].map(entityOf).find(Boolean);
      if (entity) return entity;
    }
    return undefined;
  }

  // Switches `entity` in the simulation: the simulator's (standalone), or on HA's preview only, over HA's own states
  // (it goes when the editor closes; switched back, HA's own state shows again).
  _simulate(entity) {
    if (!this._hosted) return this._controls.callService('homeassistant', 'toggle', {entity_id: entity});
    const real = this._hass?.states?.[entity], now = this._simulated?.[entity] || real;
    const on = ['on', 'playing', 'open'].includes(now?.state), next = {entity_id: entity, attributes: {}, ...real, state: on ? 'off' : 'on'};
    this._simulated = {...this._simulated};
    if (real && real.state === next.state) delete this._simulated[entity];
    else this._simulated[entity] = next;
    this._hosted.simulated = Object.keys(this._simulated).length ? this._simulated : null;
    if (!this._toldSimulated) {
      this._toldSimulated = true;
      this._message(`${entity} is switched on the preview only: nothing is switched in your home.`, 'info');
    }
  }

  // Whether the item at `path` is under point `p` (`hits`: what's there): among them, or (a room's rectangle, which they
  // name as the room) inside it.
  _isUnder(path, hits, p) {
    if (hits.some(h => samePath(h, path))) return true;
    if (path[0] === 'rooms' && path.length === 3) {
      const poly = partPoly(itemAt(this.model.data, path));
      return !!poly && inPoly(poly, p);
    }
    return false;
  }

  // In the Build view, the object (made there) the item at `path` is part of: its id, or undefined.
  _objectAt(path) {
    if (this._view !== 'build' || !path) return undefined;
    const id = partOf(this.model.data, path);
    return id && id !== this._group && partsOf(this.model.data, id).length ? id : undefined;
  }

  // Selects all the parts of object `id`; the one whose properties show is the room, or the opening.
  _selectObject(id) {
    const paths = partsOf(this.model.data, id), main = paths.find(p => p[0] === 'rooms' || p[0] === 'openings' || p[0] === 'lights');
    this._selectAll(main ? [...paths.filter(p => p !== main), main] : paths);
  }

  // The one object the paths are all part of, in the Build view, or undefined.
  _objectOf(paths) {
    const ids = new Set(paths.map(p => this._objectAt(p)));
    return ids.size === 1 ? [...ids][0] : undefined;
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
  // selecting the one under the pointer); while drawing a polygon, it finishes it. It goes by what was selected before
  // its two clicks (which step through what's under the pointer): a selected piece under it is the one entered, and in
  // a selected room the rectangle under it is selected.
  _dblclick(e) {
    // In the Build view, a room's name is edited on the plan by a double-click on it; a double-click elsewhere on an
    // object made there enters it (its parts then picked one by one), as a piece's insides are.
    if (this._view === 'build' && this._group === null && !this._poly) {
      if (this._editRoomName(e, false)) return;
      const at = this._at(e), hits = at ? this._hitsAt(at).hits : [], before = this._clicks ? this._clicks.sel : this._sel;
      // The object selected before the clicks, if it's under the pointer; otherwise the one on top there.
      const id = (before && hits.some(h => samePath(h, before)) && this._objectAt(before)) || (hits[0] && this._objectAt(hits[0]));
      if (id) {
        this.setTool('select');
        return this._enterGroup(id, hits.filter(h => partOf(this.model.data, h) === id).slice(0, 1));
      }
    }
    if (this._tool === 'build-room') return;
    if (this._tool !== 'select') return this._poly && this._finishPoly();
    const at = this._at(e), handle = at && this._handleAt(at);
    if (at && !handle?.id.match(/(^|\/)v:\d+$/)) {
      if (this._hitsAt(at).inside) return;
      const hits = hitTest(this._home, at.p, at.tol), before = this._clicks?.sel ?? this._sel;
      const under = path => hits.some(h => samePath(h, path.slice(0, 2)));
      // In a selected room (or one of its rectangles): the rectangle under the pointer, the last listed first.
      const room = before?.[0] === 'rooms' && under(before) && this.model.data.rooms[before[1]];
      if (Array.isArray(room) && !Array.isArray(room[0]?.[0])) {
        const i = room.findLastIndex(q => inPoly(partPoly(q) || [], at.p));
        if (i >= 0) return this.select(['rooms', before[1], i]);
      }
      const piece = before?.[0] === 'furniture' && before.length === 2 && under(before) ? before : hits.find(h => h[0] === 'furniture');
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
      // A drag starting outside the piece (or Build object) being edited leaves it.
      if ((this._inside !== null || this._group !== null) && !found.inside) this._out();
      hits = press.grab ? [press.grab, ...found.hits.filter(h => !samePath(h, press.grab))] : found.hits;
    }
    if (press.shift || (!press.handle && !hits.length)) return {kind: 'box', from: at.p, add: press.shift};
    // Ctrl (⌘) and a drag on a piece: it turns around its middle.
    const turning = press.turn && !press.handle && hits.find(h => h[0] === 'furniture' && h.length === 2);
    if (turning) {
      const item = itemAt(this.model.data, turning), sh = item?.shape;
      const pts = sh?.rect ? [[sh.rect[0], sh.rect[1]], [sh.rect[0] + sh.rect[2], sh.rect[1] + sh.rect[3]]] : sh?.poly || (sh?.circle ? [sh.circle.slice(0, 2)] : []);
      if (pts.length && !sh.circle) {
        this.select(turning);
        const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), centre = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
        return {kind: 'turn', path: turning, item, centre, from: Math.atan2(at.p[1] - centre[1], at.p[0] - centre[0])};
      }
    }
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
    // What's selected, where it is under the pointer, is what a drag moves (not what lies on top of it there): a room's
    // rectangle just added, a part under another's. Selected whole, a Build object moves as one.
    const under = this._sels.some(p => this._isUnder(p, hits, at.p));
    const chosen = under ? this._objectOf(this._sels) : undefined;
    const whole = chosen && partsOf(data, chosen).length === this._sels.length;
    // In the Build view: a window or door slides along its wall; a room moves with its walls made again.
    const object = under ? (whole ? chosen : undefined) : this._objectAt(hits[0]);
    if (object) {
      this._selectObject(object);
      const gap = gapOf(data, object);
      if (gap) return {kind: 'slide', gap, from: at.p};
      if (this._isCut(object)) {
        this._message("This window or door isn't in a gap that it and its neighbours fill side by side (drawn by hand): move it in the Edit view.", 'info');
        return {kind: 'none'};
      }
      if (data.rooms?.[object] !== undefined) {
        if (!moveRoomOps(data, object, 0, 0)) {
          this._message("A room of several rectangles or a polygon is moved in the Edit view (its walls weren't made with it).", 'info');
          return {kind: 'none'};
        }
        return {kind: 'room', id: object, from: at.p};
      }
    }
    // Otherwise what's on top there (a Build object's parts were selected above).
    if (!under && !object) frame ? this._selectAll(hits.slice(0, 1)) : this.select(hits[0]);
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
    } else if (drag.kind === 'turn') {
      // By its turn, in 15° steps (Alt: free).
      const a = (Math.atan2(at.p[1] - drag.centre[1], at.p[0] - drag.centre[0]) - drag.from) * 180 / Math.PI;
      const sh = drag.item.shape, step = e.altKey ? 1 : TURN_STEP, d = Math.round(a / step) * step;
      const turn = (((sh.turn || 0) + d) % 360 + 360) % 360, {turn: _, ...rest} = sh;
      const value = {...drag.item, shape: turn ? {...rest, turn} : rest};
      drag.changes = [[drag.path, value]];
      ruler = null;
      this._el.ruler.dataset.text = `${((d % 360) + 360) % 360}°`;
    } else if (drag.kind === 'room') {
      // Moved by the grid (Alt: freely), snapped against the walls where it lands; its walls made there.
      const g = e.altKey ? 0 : this._grid(), d = [0, 1].map(k => at.p[k] - drag.from[k]).map(v => (g ? Math.round(v / g) * g : v));
      if (e.shiftKey) d[Math.abs(d[0]) < Math.abs(d[1]) ? 0 : 1] = 0;
      if (drag.d?.[0] !== d[0] || drag.d?.[1] !== d[1]) {
        drag.d = d;
        drag.ops = moveRoomOps(this._data, drag.id, d[0], d[1], e.altKey ? 0 : 0.3 * (this._data.units_per_metre || 100))?.ops;
        if (drag.ops) this._showPreview(null, drag.ops);
      }
      ruler = {move: d};
    } else if (drag.kind === 'slide') {
      const ax = drag.gap.axis, grid = e.altKey ? 0 : this._grid(), d = at.p[ax] - drag.from[ax];
      drag.changes = slideOps(this._data, drag.gap, grid ? Math.round(d / grid) * grid : d).map(op => [op.set, op.value]);
      ruler = {move: ax === 0 ? [d, 0] : [0, d]};
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
    const [fx, fy] = this._inFrame(e.clientX, e.clientY);
    Object.assign(this._el.ruler.style, {left: `${fx + 16}px`, top: `${fy + 16}px`});
    this._el.ruler.textContent = drag.kind === 'turn' ? this._el.ruler.dataset.text : rulerText(ruler, this._data.units_per_metre);
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
  _showPreview(changes, ops) {
    this._pending = ops ? {ops} : changes;
    this._frameRequest ||= requestAnimationFrame(() => {
      this._frameRequest = 0;
      if (!this._pending) return;
      const data = this._pending.ops ? applyOps(this._data, this._pending.ops) : structuredClone(this._data);
      if (!this._pending.ops) for (const [path, value] of this._pending) path.slice(0, -1).reduce((o, k) => o[k], data)[path.at(-1)] = value;
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
    } else if (drag.kind === 'room' && drag.ops) {
      this._edit(() => this.model.batch(drag.ops));
      this._selectObject(drag.id);
      this._renderCard();
    } else if (changes) {
      const ops = changes.map(([path, value]) => ({set: path, value}));
      // In the Build view, what moved is in the room it's in now (a lamp's clip and shadows, a piece's room).
      if (this._view === 'build' && drag.kind === 'move') ops.push(...regroupOps(applyOps(this._data, ops), drag.paths));
      this._edit(() => this.model.batch(ops));
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

  // The view: 'build' (a home step by step: rooms with their walls, windows and doors clicked onto them) or 'edit'
  // (every tool and field). Both work on the same home and history.
  setView(view) {
    if (view !== 'build' && view !== 'edit') return;
    this._view = view;
    this.setAttribute('view', view);
    for (const b of this._root.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', b.dataset.view === view);
    this._el.toolbar.dataset.shows = view;
    if (view === 'build' && this._inside !== null) this._leave();
    if (view !== 'build' && this._group !== null) this._out();
    // Build's panel is its details (the home's, the tool's choices, the selection's); Edit starts from the list.
    this._tab(view === 'build' ? 'props' : 'list');
    this.setTool('select');
    this._placeTools();
    // The list is the view's own (Build's leads with its objects).
    if (this.model) this._renderPanels();
  }

  // The details panel: a Build object's settings when one is selected whole; with nothing selected, the tool's choices
  // (in Build's Select, the home's); otherwise the selected item's properties.
  _renderDetails() {
    // Drawn again after every edit: where it was scrolled to stays while it shows the same (what's selected, the tool).
    const box = this._el.props, shows = [this._view, this._tool, this._group, ...this._sels.map(pathKey)].join('|');
    const top = shows === this._detailsShow ? box.scrollTop : 0;
    this._detailsShow = shows;
    this._details();
    if (box.scrollTop !== top) box.scrollTop = top;
  }

  _details() {
    const box = this._el.props, data = this.model?.data;
    const id = this._view === 'build' && this._group === null && this._inside === null && data ? this._objectOf(this._sels) : undefined;
    if (id && partsOf(data, id).length === this._sels.length) return this._groupDetails(box, id);
    if (this._group !== null && data) return this._memberDetails(box);
    if (!this._sels.length && (this._view === 'build' || this._tool !== 'select')) return this._toolDetails(box);
    if (this._sels.length > 1) return this._multiDetails(box);
    renderProperties(box, data, this._sel, {...this._ctx, data, states: this._shown.states, previewing: this._effect});
  }

  // Inside a Build object: the way back to it whole, and each of its parts, folded but those selected (and those
  // unfolded by hand).
  _memberDetails(box) {
    const data = this.model.data, back = h('button', {type: 'button', textContent: `‹ Back to ${this._groupName(this._group)}`, title: 'The whole of it again, with its settings (Esc)'});
    back.onclick = () => this._leaveGroup();
    const parts = partsOf(data, this._group);
    this._folds(box, parts.map(p => this._itemEntry(p)), key => this._sels.some(p => pathKey(p) === key),
      h('p', {className: 'back'}, back), h('p', {className: 'help', textContent: `Its ${parts.length} parts: click one on the plan to select it.`}));
  }

  // The item at `path` as an entry of a folded list: its kind and name, and its properties form.
  _itemEntry(p) {
    const data = this.model.data, group = itemGroups(data).find(g => samePath(g.path, p.slice(0, -1)));
    const label = group?.items.find(it => samePath(it.path, p))?.label ?? p.join('.');
    return {key: pathKey(p), title: `${group ? `${group.title}: ` : ''}${label}`,
      render: b => renderProperties(b, data, p, {...this._ctx, data, states: this._shown.states, previewing: this._effect})};
  }

  // A list of entries ({key, title, render(box)}) folded in `box`, after `head`: unfolded when `wanted` says so (what's
  // selected), unless folded by hand (until the selection changes), or when unfolded by hand. A form is built when it's unfolded.
  _folds(box, entries, wanted, ...head) {
    const opened = this._unfolded ||= new Set(), closed = this._folded ||= new Set();
    box.textContent = '';
    box.append(...head);
    for (const entry of entries) {
      const auto = wanted(entry.key), body = h('div', {className: 'body'});
      const fold = h('details', {className: 'multi', open: auto ? !closed.has(entry.key) : opened.has(entry.key)}, h('summary', {textContent: entry.title}), body);
      const fill = () => { if (fold.open && !body.childElementCount) entry.render(body); };
      fold.ontoggle = () => {
        const set = auto ? closed : opened;
        if (fold.open === auto) set.delete(entry.key); else set.add(entry.key);
        fill();
      };
      fill();
      box.append(fold);
    }
  }

  // Several things selected: each of them, folded (a click unfolds it, and it stays so while it's selected). In the
  // Build view, an object selected whole is one of them, with its settings; anything else has its properties.
  _multiDetails(box) {
    const data = this.model.data, entries = [], seen = new Set();
    for (const p of this._sels) {
      const id = this._view === 'build' && this._group === null && this._inside === null ? this._objectAt(p) : undefined;
      if (id && partsOf(data, id).every(q => this._sels.some(r => samePath(q, r)))) {
        if (!seen.has(id)) { seen.add(id); entries.push({key: `object:${id}`, title: `${this._groupKind(id)}: ${this._groupName(id)}`, render: b => this._groupDetails(b, id, {single: false})}); }
      } else entries.push(this._itemEntry(p));
    }
    this._folds(box, entries, () => false, h('p', {className: 'help', textContent: `${entries.length} selected: they move together, and Delete deletes them all.`}));
  }

  // With nothing selected: what the tool does, and its choices (the catalogue, the devices, a room's name, a cut's
  // kind and width); in Build's Select, the home's settings.
  _toolDetails(box) {
    box.textContent = '';
    const tool = this._tool, build = this._view === 'build', data = this.model?.data;
    const title = {select: build ? 'Your home' : 'The home', 'build-room': 'Rooms', 'build-cut': 'Windows and doors', 'build-piece': 'Furniture',
      'build-device': 'Lamps and devices', 'build-north': 'North'}[tool] || TOOLS.find(t => t[0] === tool)?.[2].replace(/ \(.\)$/, '');
    box.append(h('h2', {textContent: title}), h('p', {className: 'help', textContent: (build ? BUILD_HELP[tool] : null) || HINTS[tool]}));
    const options = h('div', {className: 'options'});
    options.innerHTML = this._optionsHtml();
    if (options.innerHTML) { box.append(options); this._wireOptions(options); }
    if (build && tool === 'select' && data) {
      // A home not made here: its objects found and tagged, so that Build picks them as one.
      const adopt = this.model.home ? adoptOps(data) : [];
      if (adopt.length) {
        const b = h('button', {type: 'button', textContent: 'Find them'});
        b.onclick = () => this._edit(() => this.model.batch(adoptOps(this.model.data)));
        box.append(h('p', {className: 'adopt'}, `This home has rooms, windows, doors or lamps not made in Build (${adopt.length} parts): find them, so that Build picks each as one. `, b));
      }
      const rooms = Object.keys(data.rooms || {}).length, cuts = (data.openings || []).length;
      box.append(h('p', {className: 'help', textContent: `${rooms} room${rooms === 1 ? '' : 's'}, ${cuts} window${cuts === 1 ? '' : 's'} and glass door${cuts === 1 ? '' : 's'} so far.`}));
    }
    if (tool === 'build-device') this._renderDevices(box);
    if (tool !== 'build-piece') return;
    // The catalogue: each piece drawn, chosen by a click, or dragged onto the plan.
    for (const group of Object.values(PREFABS)) {
      box.append(h('h3', {textContent: group.title}));
      const grid = h('div', {className: 'catalogue'});
      for (const [id, item] of Object.entries(group.items)) {
        const b = h('button', {type: 'button', draggable: true, title: `${item.name}: ${item.w} × ${item.d} m${item.height ? `, ${item.height} m high` : ''}`});
        b.innerHTML = `${prefabSvg(id)}<span></span>`;
        b.querySelector('span').textContent = item.name;
        b.setAttribute('aria-pressed', this._opts.prefab === id);
        b.onclick = () => { this._opts.prefab = id; this._renderDetails(); };
        b.ondragstart = e => { this._opts.prefab = id; e.dataTransfer.setData('text/x-lightwell-prefab', id); e.dataTransfer.effectAllowed = 'copy'; };
        grid.append(b);
      }
      box.append(grid);
    }
  }

  // A Build object selected whole: what it is, and its settings. A lamp: which light it is. A window or door: its width
  // and heights. Furniture from the catalogue: which piece it is (another replaces it, in its place), and a turn. A
  // room: its name and size. Its parts are a double-click (or Enter) away.
  // (`single`: it's all that's selected; otherwise it's one of several, in their list, and they stay selected.)
  _groupDetails(box, id, {single = true} = {}) {
    box.textContent = '';
    const data = this.model.data, parts = partsOf(data, id), u = data.units_per_metre || 100, metres = v => +(v / u).toFixed(2);
    const room = data.rooms?.[id] !== undefined, lamp = parts.some(p => p[0] === 'lights'), cut = !room && this._isCut(id);
    const found = !room && !lamp && !cut && parts.every(p => p[0] === 'furniture') ? prefabOf(data, id) : null;
    const kind = this._groupKind(id), keep = () => { if (single) this._selectObject(id); };
    const enter = h('button', {type: 'button', textContent: 'Its parts', title: 'Change its parts one by one (double-click it, or Enter)'});
    enter.onclick = () => this._enterGroup(id, [parts.at(-1)]);
    const del = h('button', {type: 'button', className: 'delete', textContent: 'Delete', title: 'Delete it (Delete)'});
    del.onclick = () => this._remove(partsOf(this.model.data, id));
    box.append(h('div', {className: 'title'}, single ? h('h2', {textContent: `${kind}: ${this._groupName(id)}`}) : h('span', {className: 'grow'}), enter, del));
    const row = (label, ...kids) => h('div', {className: 'row'}, h('span', {className: 'key', textContent: label}), h('span', {className: 'value'}, ...kids));
    const number = (value, onchange, attrs = {}) => {
      const i = h('input', {type: 'number', value, step: 0.05, min: 0, ...attrs});
      i.onchange = () => { const v = +i.value; if (i.value !== '' && Number.isFinite(v)) onchange(v); };
      return i;
    };
    const unit = text => h('span', {className: 'unit', textContent: text});
    if (lamp) box.append(this._lampPicker(id, keep));
    if (room) {
      const label = parts.find(p => p[1] === 'labels'), name = h('input', {type: 'text', value: (label && itemAt(data, label)?.text) || '', placeholder: 'none: no label', spellcheck: false});
      name.onchange = () => this._setRoomName(id, name.value.trim());
      box.append(row('Name', name));
      const r = data.rooms[id];
      if (r.length === 1 && Array.isArray(r[0]) && !Array.isArray(r[0][0])) {
        const resize = (w, d) => {
          const made = moveRoomOps(this.model.data, id, 0, 0, 0, [tidy(w * u), tidy(d * u)]);
          if (made) this._edit(() => this.model.batch(made.ops));
          keep();
        };
        const [w, d] = [metres(r[0][2]), metres(r[0][3])];
        box.append(row('Size', number(w, v => resize(v, d), {min: 0.5}), unit('×'), number(d, v => resize(w, v), {min: 0.5}), unit('m')));
      } else box.append(h('p', {className: 'help', textContent: 'A room of several rectangles, or a polygon: its shape is changed in the Edit view.'}));
    }
    if (cut) {
      const found = cutRunOf(data, id);
      if (found) {
        const {bounds, cuts} = found.run, i = found.index;
        const width = number(metres(bounds[i + 1] - bounds[i]), v => {
          if (v * u >= 0.3 * u) this._edit(() => this.model.batch(resizeCutOps(this.model.data, id, v * u)));
          keep();
        }, {min: 0.3});
        box.append(row('Width', width, unit('m')));
        if (cuts.length > 1) box.append(h('p', {className: 'help', textContent: `Side by side with ${cuts.filter(c => c.id !== id).map(c => this._groupName(c.id)).join(', ')}: they slide together, and the end they share moves both.`}));
        // Two panes (or a door beside a door): the second a copy of it.
        const split = h('button', {type: 'button', textContent: 'Split in two', title: 'Two side by side in its place: a two-pane window, or a door beside a door'});
        split.onclick = () => {
          const made = splitCutOps(this.model.data, id);
          if (!made) return this._message('Too narrow to split: each needs 30 cm at least.', 'info');
          this._edit(() => this.model.batch(made.ops));
          this._selectObject(made.part);
        };
        box.append(row('', split));
      } else box.append(h('p', {className: 'help', textContent: "Not in a gap in the wall that it and its neighbours fill side by side (drawn by hand): its size is changed in the Edit view."}));
      const opening = parts.find(p => p[0] === 'openings'), o = opening && itemAt(data, opening);
      if (o) {
        const set = (key, v) => { this._edit(() => this.model.set([...opening, key], v)); keep(); };
        box.append(row('From', number(o.lo ?? 0, v => set('lo', v)), unit('m above the floor')), row('To', number(o.hi ?? 2.2, v => set('hi', v)), unit('m')));
      }
    }
    if (kind === 'Furniture') {
      const select = h('select', {disabled: !found, title: found ? 'Another piece in its place' : 'Its pieces were changed since it was placed: delete it and place another'});
      for (const group of Object.values(PREFABS)) {
        const og = h('optgroup', {label: group.title});
        for (const [pid, item] of Object.entries(group.items)) if (!item.lamp) og.append(h('option', {value: pid, textContent: item.name, selected: found?.id === pid}));
        if (og.children.length) select.append(og);
      }
      if (!found) select.prepend(h('option', {value: '', textContent: 'Changed since it was placed', selected: true}));
      select.onchange = () => this._replacePrefab(id, select.value);
      const turn = h('button', {type: 'button', textContent: 'Turn ↻', title: 'Turn it a quarter (R)'});
      turn.onclick = () => this._turnPieces(90, parts);
      box.append(row('Which', select), row('', turn));
    }
  }

  // In the Build view, the home's objects for the list: [{id, kind, name, parts}], in the order their items come.
  _objects() {
    const data = this.model?.data;
    if (this._view !== 'build' || !data) return null;
    const ids = [...new Set(itemGroups(data).flatMap(g => g.items.map(it => partOf(data, it.path))).filter(Boolean))];
    return ids.map(id => ({id, parts: partsOf(data, id)})).filter(o => o.parts.length)
      .map(o => ({...o, kind: this._groupKind(o.id), name: this._groupName(o.id)}));
  }

  // What kind of Build object `id` is, in words.
  _groupKind(id) {
    const data = this.model.data, parts = partsOf(data, id);
    if (data.rooms?.[id] !== undefined) return 'Room';
    if (parts.some(p => p[0] === 'lights')) return 'Lamp';
    if (this._isCut(id)) return {window: 'Window', glass_door: 'Glass door', door: 'Door', doorway: 'Doorway'}[id.replace(/_\d+$/, '')] || 'Window or door';
    return parts.every(p => p[0] === 'furniture') ? 'Furniture' : 'Object';
  }

  // The catalogue's object `id` replaced by the prefab `with`, where it is and turned as it is.
  _replacePrefab(id, other) {
    const data = this.model.data, found = prefabOf(data, id);
    if (!found || !other) return;
    const del = deleteOps(data, id), made = placePrefab(applyOps(data, del), other, found.at, found.turn);
    if (!made) return;
    this._edit(() => this.model.batch([...del, ...made.ops]));
    this._selectObject(made.part);
  }

  // A room's name: its label's text (a label added in its middle when it has none; none when emptied).
  _setRoomName(room, text) {
    const data = this.model.data, label = partsOf(data, room).find(p => p[0] === 'drawing' && p[1] === 'labels'), shape = label && itemAt(data, label);
    if (text === (shape?.text ?? '')) return;
    const r = data.rooms[room][0], spot = shape?.at || (Array.isArray(r?.[0]) ? r[0] : [r[0] + r[2] / 2, r[1] + r[3] / 2]);
    this._edit(() => this.model.batch(!text ? [{remove: label}] : label ? [{set: [...label, 'text'], value: text}]
      : [{insert: ['drawing', 'labels'], value: {text, at: spot.map(tidy), class: 'room', part: room}}]));
    this._selectObject(room);
  }

  // The prefab about to be placed turned a quarter.
  _turnPrefab() {
    this._opts.turn = (this._opts.turn + 90) % 360;
    if (this._lastAt) this._prefabPreview(this._lastAt);
  }

  // Which light the selected lamp (object `id`) is: an entity of the states in use, or none (lit always, while the sun
  // is down, or never). Its marker follows its entity; without one it has none.
  _lampPicker(id, keep = () => this._selectObject(id)) {
    const data = this.model.data, paths = partsOf(data, id), lightPath = paths.find(p => p[0] === 'lights'), light = itemAt(data, lightPath);
    const markers = paths.filter(p => p[0] === 'markers'), current = light?.entities?.[0] ?? `lit:${light?.lit || 'dark'}`;
    const choices = devicesIn(this._shown.states).filter(d => ['light', 'switch', 'fan', 'media_player'].includes(d.domain));
    const row = Object.assign(document.createElement('p'), {className: 'lamp'});
    const select = document.createElement('select');
    const option = (value, text) => Object.assign(document.createElement('option'), {value, textContent: text, selected: value === current});
    const none = Object.assign(document.createElement('optgroup'), {label: 'Not in Home Assistant'});
    none.append(option('lit:always', 'No entity: always lit'), option('lit:dark', 'No entity: lit after dark'), option('lit:never', 'No entity: never lit'));
    const known = Object.assign(document.createElement('optgroup'), {label: 'Your devices'});
    known.append(...choices.map(d => option(d.id, `${d.name} (${d.id})`)));
    if (!current.startsWith('lit:') && !choices.some(d => d.id === current)) known.prepend(option(current, current));
    select.append(known, none);
    select.onchange = () => {
      const v = select.value, x = light.pool?.x ?? lightCentre(light)[0], y = light.pool?.y ?? lightCentre(light)[1];
      const ops = [];
      if (v.startsWith('lit:')) {
        const {entities: _, states: __, ...rest} = light;
        ops.push({set: lightPath, value: {...rest, lit: v.slice(4)}});
        for (const m of [...markers].reverse()) ops.push({remove: m});
      } else {
        const {lit: _, ...rest} = light;
        ops.push({set: lightPath, value: {...rest, entities: [v]}});
        if (markers.length) for (const m of markers) ops.push({set: [...m, 'entity'], value: v});
        else ops.push({insert: ['markers'], value: {entity: v, x, y, icon: iconOf(v, this._shown.states?.[v]), tap: 'toggle', small: true, part: id}});
      }
      this._edit(() => this.model.batch(ops));
      keep();
    };
    row.append(Object.assign(document.createElement('strong'), {textContent: 'This light is '}), select);
    return row;
  }

  // The Build panel's devices: a search, and the entities in use by domain, those on the plan ticked.
  _renderDevices(box) {
    const search = Object.assign(document.createElement('input'), {type: 'search', placeholder: 'Search your devices', value: this._opts.search});
    const list = Object.assign(document.createElement('div'), {className: 'devices'});
    const fill = () => {
      const placed = placedIn(this.model.data), found = devicesIn(this._shown.states, this._opts.search);
      list.innerHTML = '';
      if (!found.length) list.append(Object.assign(document.createElement('p'), {className: 'muted', textContent: Object.keys(this._shown.states || {}).length ? 'Nothing found.' : 'No devices: connect to Home Assistant for yours.'}));
      for (const d of found.slice(0, 200)) {
        const b = Object.assign(document.createElement('button'), {type: 'button', draggable: true, title: d.id});
        b.innerHTML = `<ha-icon></ha-icon><span class="dn"></span><span class="tick">${placed.has(d.id) ? '✓' : ''}</span>`;
        b.querySelector('ha-icon').setAttribute('icon', d.icon);
        b.querySelector('.dn').textContent = d.name;
        b.setAttribute('aria-pressed', this._opts.device === d.id);
        b.onclick = () => { this._opts.device = d.id; fill(); };
        b.ondragstart = e => { this._opts.device = d.id; e.dataTransfer.setData('text/x-lightwell-device', d.id); e.dataTransfer.effectAllowed = 'copy'; };
        list.append(b);
      }
    };
    search.oninput = () => { this._opts.search = search.value; fill(); };
    fill();
    box.append(search, list);
  }

  // Places the entity `id` (the one chosen) at `p`: a lamp, a shutter, or a marker; selects what it made.
  _placeDevice(p, tol, id = this._opts.device) {
    if (!id) return this._message('Choose a lamp or device in the details first.', 'info');
    if (!this.model.home) return this._message('Fix the mistakes listed here first: the plan shows the last version without them.');
    const g = this._grid(), at = p.map(v => tidy(Math.round(v / g) * g));
    const made = placeDevice(this.model.data, id, this._shown.states?.[id], at, Math.max(tol, 0.3 * (this._data?.units_per_metre || 100)));
    this._edit(() => this.model.batch(made.ops));
    this._selectObject(made.part);
    if (made.what === 'shutter') this._message(`${id} is that window's shutter now: the window darkens as it closes.`, 'info');
  }

  // North: the bearing the top of the plan faces, from a click in north's direction (from the middle of the view).
  _northFrom(p) {
    const v = this._home.view, c = [v.x + v.w / 2, v.y + v.h / 2];
    const towards = Math.atan2(p[0] - c[0], -(p[1] - c[1])) * 180 / Math.PI;
    return Math.round(((360 - towards) % 360 + 360) % 360);
  }

  // An arrow from the middle of the view towards north, at `north` (the bearing the top faces).
  _northArrow(north) {
    const v = this._home?.view;
    if (!v) return;
    const c = [v.x + v.w / 2, v.y + v.h / 2], len = Math.min(v.w, v.h) * 0.35, a = (360 - north) * Math.PI / 180;
    const tip = [c[0] + Math.sin(a) * len, c[1] - Math.cos(a) * len], f = q => q.map(n => +n.toFixed(1)).join(',');
    const side = s => [tip[0] - Math.sin(a + s) * len * 0.12, tip[1] + Math.cos(a + s) * len * 0.12];
    this._el.draft.innerHTML = `<g class="north"><line x1="${c[0]}" y1="${c[1]}" x2="${tip[0]}" y2="${tip[1]}"/><polyline points="${f(side(0.5))} ${f(tip)} ${f(side(-0.5))}"/>`
      + `<text x="${tip[0]}" y="${tip[1]}" dy="-0.6em">N</text></g>`;
  }

  // The chosen prefab placed with its middle at `p` (snapped to the grid), as it would be: {ops, keys}.
  _prefabAt(p, snap = true) {
    const g = this._grid(), at = snap ? p.map(v => tidy(Math.round(v / g) * g)) : p;
    return placePrefab(this.model.data, this._opts.prefab, at, this._opts.turn, {entity: this._freeLight()});
  }

  // The chosen prefab's outline under the pointer.
  _prefabPreview(p) {
    const made = this._prefabAt(p), f = v => +v.toFixed(1);
    const svg = sh => (sh.poly ? `<polygon points="${sh.poly.map(q => q.map(f).join(',')).join(' ')}"/>`
      : sh.circle ? `<circle cx="${f(sh.circle[0])}" cy="${f(sh.circle[1])}" r="${f(sh.circle[2])}"/>`
      : sh.path ? `<path d="${sh.path}"/>`
      : sh.rect ? `<rect x="${f(sh.rect[0])}" y="${f(sh.rect[1])}" width="${f(sh.rect[2])}" height="${f(sh.rect[3])}"${sh.rx ? ` rx="${sh.rx}"` : ''}/>` : '');
    // A piece's outline; a lamp's glow.
    this._el.draft.innerHTML = made ? made.ops.flatMap(({value: v}) => (v?.shape && !Array.isArray(v.shape) ? [v.shape] : Array.isArray(v?.shape) ? v.shape : []))
      .map(svg).join('') : '';
  }

  // Places the chosen prefab at `p`, selecting what it made.
  _placePrefab(p) {
    if (!this.model.home) return this._message('Fix the mistakes listed here first: the plan shows the last version without them.');
    const made = this._prefabAt(p);
    if (!made) return;
    this._edit(() => this.model.batch(made.ops));
    if (made.part) this._selectObject(made.part);
    else this._selectAll(made.keys.map(k => ['furniture', k]));
  }

  // A light for a new lamp: the first in the states in use that isn't on the plan yet.
  _freeLight() {
    const placed = placedIn(this.model.data);
    return devicesIn(this._shown.states).find(d => d.domain === 'light' && !placed.has(d.id))?.id || 'light.new_light';
  }

  // The tool in use: 'select', or one that draws (wall, room, opening, piece, light, marker, label, scale).
  // Inside a piece of furniture, only those that draw its insides (piece, label) and the scale.
  setTool(tool) {
    if (!HINTS[tool] || (this._inside !== null && !INSIDE_HINTS[tool])) return;
    this._tool = tool;
    this._poly = null;
    this._el.overlay.classList.remove('grab', 'grab-x', 'grab-y');
    this._cancelDrag();
    this._el.draft.innerHTML = '';
    if (tool === 'build-north') this._northArrow(this.model?.data?.sun?.north ?? 0);
    // In HA's dialog the details share the tabs with the list: a tool with choices shows them.
    if (this._ha && tool !== 'select' && !this._sels.length) this._tab('props');
    this._renderTools();
    this._renderOverlay();
  }

  // The tools' buttons, options and hint, for the tool in use and whether a piece is being edited.
  _renderTools() {
    const inside = this._inside !== null, tool = this._tool;
    for (const b of this._el.toolbar.querySelectorAll('[data-tool]')) {
      b.setAttribute('aria-pressed', b.dataset.tool === tool || (tool === 'build-north' && b.dataset.tool === 'select'));
      b.disabled = (inside && !INSIDE_HINTS[b.dataset.tool]) || (this._group !== null && b.dataset.tool !== 'select');
    }
    const piece = this._el.toolbar.querySelector('[data-tool="piece"]');
    piece.title = inside ? `Shapes on ${this._inside} (F)` : 'Furniture (F)';
    this._el.overlay.classList.toggle('drawing', tool !== 'select');
    this._el.hint.textContent = this._el.hint.title = inside ? INSIDE_HINTS[tool].replace('{name}', this._inside)
      : this._group !== null ? GROUP_HINT.replace('{name}', this._groupName(this._group)) : HINTS[tool];
    this._renderDetails();
  }

  // The selected pieces turned by `deg` (a quarter): each around its middle, or a Build object's around the middle of
  // them all, so that a table keeps its chairs round it.
  _turnPieces(deg, among = this._sels) {
    const data = this.model.data, paths = among.filter(p => p[0] === 'furniture' && p.length === 2);
    const middle = it => { const sh = it.shape; return sh.circle?.slice(0, 2) || (sh.rect ? [sh.rect[0] + sh.rect[2] / 2, sh.rect[1] + sh.rect[3] / 2] : boundsOf(sh.poly).reduce((a, v, i) => (a[i % 2] += v / 2, a), [0, 0])); };
    const whole = paths.length > 1 && this._objectOf(paths);
    const [x0, y0, x1, y1] = whole ? boundsOf(paths.map(p => middle(itemAt(data, p)))) : [0, 0, 0, 0], c = [(x0 + x1) / 2, (y0 + y1) / 2];
    const a = deg * Math.PI / 180, [cos, sin] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
    this._edit(() => this.model.batch(paths.map(p => {
      const item = itemAt(data, p), turned = turnedPiece(item, deg);
      if (!whole) return {set: p, value: turned};
      const [mx, my] = middle(item), [dx, dy] = [mx - c[0], my - c[1]], to = [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
      return {set: p, value: moveItem(p, turned, tidy(to[0] - mx), tidy(to[1] - my))};
    })));
  }

  // The tool's choices changed (or what they show): the details show them again, when they're showing.
  _renderOptions() {
    if (!this._sels.length) this._renderDetails();
  }

  // The tool's choices, as HTML (wired by _wireOptions): a room's name, a cut's kind and width, the piece about to be
  // placed, the shapes the Edit tools draw; in Build's Select, north.
  _optionsHtml() {
    const o = this._opts;
    const select = (key, values) => `<label>${{wall: 'Kind', kind: 'Kind', piece: 'Shape', extra: 'Shape', cut: 'Kind'}[key] || ''} <select data-opt="${key}">${Object.entries(values).map(([v, t]) => `<option value="${v}"${o[key] === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
    const check = (key, text) => `<label><input type="checkbox" data-opt="${key}"${o[key] ? ' checked' : ''}> ${text}</label>`;
    const esc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const north = `<label>The top of the plan faces <input type="number" data-north value="${this.model?.data?.sun?.north ?? 0}" min="0" max="359" step="1" style="width: 4.5em">° from north</label>`;
    return {
      select: this._view === 'build' ? `${north}<span><button type="button" data-point-north title="Click on the plan towards north">Point to north on the plan</button></span>` : '',
      'build-north': north,
      'build-room': `<label>The new room's name <input type="text" data-opt="roomName" value="${esc(o.roomName)}" placeholder="none: no label" size="14"></label>`
        + check('outdoor', 'outdoors (a terrace, a balcony)'),
      'build-piece': `<span>${esc(prefab(o.prefab)?.name || '')}: Shift+click on the plan to place it <button type="button" data-turn title="Turn it a quarter (R)">Turn ↻</button></span>`,
      'build-cut': select('cut', CUTS) + `<label>Width <input type="number" data-opt="cutWidth" value="${o.cutWidth}" min="0.3" step="0.1" style="width: 4.5em"> m</label>`,
      wall: select('wall', {auto: 'Outer or inner, by where', outer: 'Outer wall', inner: 'Inner wall'}),
      room: check('floor', 'with its floor'),
      opening: select('kind', {window: 'Window', door: 'Door'}) + check('glass', 'with its glass'),
      piece: this._inside !== null ? select('extra', {rect: 'Rectangle', circle: 'Circle', line: 'Line'})
        : select('piece', {rect: 'Rectangle', circle: 'Circle', poly: 'Polygon'}),
    }[this._tool] || '';
  }

  _wireOptions(box) {
    const o = this._opts, north = box.querySelector('[data-north]');
    if (north) north.onchange = () => { const v = ((+north.value % 360) + 360) % 360; if (Number.isFinite(v)) this._edit(() => this.model.set(['sun', 'north'], v)); };
    const turn = box.querySelector('[data-turn]');
    if (turn) turn.onclick = () => this._turnPrefab();
    const point = box.querySelector('[data-point-north]');
    if (point) point.onclick = () => this.setTool('build-north');
    for (const input of box.querySelectorAll('[data-opt]')) {
      input.onchange = () => {
        o[input.dataset.opt] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? (+input.value > 0 ? +input.value : o[input.dataset.opt]) : input.value;
        this._poly = null;
        this._el.draft.innerHTML = '';
      };
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
    } else if (press && tool === 'build-cut') {
      const cut = this._cutRect(press.at, p), r = cut?.rect;
      if (r) svg = `<rect class="cut" x="${f(r[0])}" y="${f(r[1])}" width="${f(r[2])}" height="${f(r[3])}"/>`;
      if (r) ruler = {length: cut.length};
    } else if (a && tool === 'build-room') {
      const rect = this._buildRoomRect(a, p);
      svg = `<rect x="${f(rect[0])}" y="${f(rect[1])}" width="${f(rect[2])}" height="${f(rect[3])}"/>`;
      ruler = {size: [rect[2], rect[3]]};
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
      const [fx, fy] = this._inFrame(e.clientX, e.clientY);
      Object.assign(this._el.ruler.style, {left: `${fx + 16}px`, top: `${fy + 16}px`});
    }
    this._el.ruler.textContent = rulerText(ruler, m);
  }

  // A room dragged from `a` to `b` in the Build view: its rectangle, against the walls near its sides (30 cm).
  _buildRoomRect(a, b) {
    const [x0, y0, x1, y1] = boundsOf([a, b]);
    return snapRoom(this.model.data, [x0, y0, x1 - x0, y1 - y0], 0.3 * (this._data?.units_per_metre || 100));
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
    if (at && press.gapEnd) this._resizeGap(e, at, press);
    else if (at) this._drawDraft(this._snap(e, at, press.start), press, e);
  }

  // The end of a window, door or doorway dragged along its wall (to the grid; Alt: not): the card follows, with the
  // wall, the glass and the opening.
  // (In a row of them, where two meet: both follow.) The ruler shows the widths either side of it.
  _resizeGap(e, at, press) {
    const data = this.model.data, {run, k} = press.gapEnd, ax = run.gap.axis, grid = this._grid(), [lo, hi] = boundaryRange(data, run, k);
    const v = Math.min(Math.max(e.altKey ? at.p[ax] : Math.round(at.p[ax] / grid) * grid, lo), hi), b = run.bounds;
    press.gapOps = moveBoundaryOps(data, run, k, v);
    this._showPreview(press.gapOps.map(op => [op.set, op.value]));
    const sides = [k > 0 ? v - b[k - 1] : 0, k < b.length - 1 ? b[k + 1] - v : 0].filter(x => x > 0);
    const [fx, fy] = this._inFrame(e.clientX, e.clientY);
    Object.assign(this._el.ruler.style, {left: `${fx + 16}px`, top: `${fy + 16}px`});
    this._el.ruler.textContent = sides.map(x => rulerText({length: x}, data.units_per_metre || 100)).join(' | ');
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
    if (tool === 'build-room') {
      if (!moved) {
        // A click picks the room under it.
        const room = this._hitsAt(press.at).hits.map(h => this._objectAt(h)).find(id => id && data.rooms?.[id] !== undefined);
        return room ? this._selectObject(room) : this.select(null);
      }
      const rect = this._buildRoomRect(a, b);
      if (rect[2] < 0.5 * m || rect[3] < 0.5 * m) return this._message('A room needs to be at least 50 cm each way: drag out its rectangle.', 'info');
      // A room without a name has no label (a double-click on it names it later).
      const {key, ops} = roomOps(data, this._opts.roomName, rect, {outdoor: this._opts.outdoor});
      this._opts.roomName = '';
      this._create(ops, ['rooms', key]);
      this._renderOptions();
    } else if (tool === 'build-piece') {
      if (!moved) this._placePrefab(press.at.p);
    } else if (tool === 'build-device') {
      if (!moved) this._placeDevice(press.at.p, press.at.tol);
    } else if (tool === 'build-north') {
      const north = this._northFrom(press.at.p);
      this._edit(() => this.model.set(['sun', 'north'], north));
      this._northArrow(north);
      this._renderOptions();
    } else if (tool === 'build-cut') {
      if (press.gapEnd) {
        const ops = press.gapOps;
        this._clearDrag();
        if (ops) this._edit(() => this.model.batch(ops));
        return;
      }
      const made = cutOps(data, press.at.p, {kind: this._opts.cut, metres: this._opts.cutWidth, tol: press.at.tol, until: moved ? at.p : undefined});
      if (!made) return this._message(wallAt(data, press.at.p, press.at.tol) ? `That wall is shorter than ${this._opts.cutWidth} m.` : 'Click on a wall.', 'info');
      this._create(made.ops, made.opening ? ['openings', (data.openings || []).length] : null);
    } else if (tool === 'wall') {
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
    const data = this.model.data, id = this._view === 'build' && this._group === null ? this._objectOf(this._sels) : undefined;
    // A Build object moves as a drag moves it: a room with its walls made again, a window or door along its wall.
    if (id && data.rooms?.[id] !== undefined) {
      const made = moveRoomOps(data, id, dx, dy);
      if (made) { this._edit(() => this.model.batch(made.ops)); this._selectObject(id); }
      return;
    }
    const gap = id && gapOf(data, id);
    if (gap) {
      const d = gap.axis === 0 ? dx : dy;
      if (d) this._edit(() => this.model.batch(slideOps(data, gap, d)));
      this._selectObject(id);
      return;
    }
    const ops = this._sels.map(p => ({set: p, value: moveItem(p, itemAt(data, p), dx, dy, this._withPiece(p))}));
    if (this._view === 'build') ops.push(...regroupOps(applyOps(data, ops), this._sels));
    this._edit(() => this.model.batch(ops));
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
    // In the Build view, an object made there goes as one: a window's hole closes, a room keeps the walls others need.
    const object = this._objectOf(paths);
    if (object) {
      this._edit(() => this.model.batch(deleteOps(this.model.data, object)));
      this.select(null);
      return;
    }
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
      // In HA the home is the card's, and a new one is a step in the history (undone as any other).
      if (!this._ha && this._unsaved() && !confirm('Start a new home? The changes not saved are lost.')) return;
      if (how === 'example') this._open({name: 'home.yaml', text: this.example, handle: null});
      else {
        const [w, h, scale] = ['w', 'h', 'scale'].map(k => +form.elements[k].value);
        if (!(w > 0 && h > 0 && scale > 0)) throw new Error('An empty home needs a size and a scale above 0');
        if (this._ha) this._restart(emptyHome(w, h, scale));
        else this._open({name: 'home.yaml', text: emptyHome(w, h, scale), handle: null});
        this._opts.floor = true;
        // A new home is built step by step: its rooms first.
        this.setView('build');
        this.setTool('build-room');
      }
    } catch (e) {
      this._message(e.message);
    }
  }

  // The home replaced by the one in `text` (HA's shell), as one step in the history: nothing selected, nothing entered.
  _restart(text) {
    this._inside = null;
    this._group = null;
    this._sels = [];
    this._sel = null;
    if (this.model.setText(text)) this._changed({text: true});
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

  // A key pressed: what it does, if anything (true when it did something).
  _key(e) {
    const target = e.composedPath()[0], typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName);
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 's' && !this._ha) {
        e.preventDefault();
        this._act(e.shiftKey ? 'save-yaml' : 'save');
      } else if ((key === 'z' || key === 'y') && !typing) {
        // In a text field, its own undo; elsewhere the editor's.
        e.preventDefault();
        this._act(key === 'y' || e.shiftKey ? 'redo' : 'undo');
      } else if (key === 'd' && !typing && this._sels.length) {
        e.preventDefault();
        this._duplicate();
      } else return false;
      return true;
    }
    if (typing || !this._root.contains(target) && target !== this && !this._layer?.contains(target)) return false;
    const arrow = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
    if (this._poly && (e.key === 'Enter' || e.key === 'Backspace')) {
      e.preventDefault();
      if (e.key === 'Enter') this._finishPoly();
      else if (this._poly.points.pop() && !this._poly.points.length) { this._poly = null; this._el.draft.innerHTML = ''; }
      return true;
    }
    if (e.key === 'Escape') {
      if (this._press) this._cancelDrag();
      else if (this._poly) { this._poly = null; this._el.draft.innerHTML = ''; this._el.ruler.textContent = ''; }
      else if (this._sels.length && this._tool.startsWith('build-') && this._group === null) this.select(null);
      else if (this._tool !== 'select') this.setTool('select');
      else if (this._inside !== null) this._leave();
      else if (this._group !== null) this._leaveGroup();
      else if (this._sels.length) this.select(null);
      else return false;
    } else if (e.key === 'Enter' && this._view === 'build' && this._group === null && this._objectOf(this._sels)) {
      e.preventDefault();
      this._enterGroup(this._objectOf(this._sels), [this._sel]);
    } else if (e.key === 'Enter' && this._tool === 'select' && this._sels.length === 1 && this._sel[0] === 'furniture' && this._sel.length === 2) {
      e.preventDefault();
      this._enter(this._sel[1]);
    } else if (this._tool === 'build-piece' && e.key.toLowerCase() === 'r' && !this._sels.some(p => p[0] === 'furniture')) {
      this._turnPrefab();
    } else if (this._view === 'build' && e.key.toLowerCase() === 'r' && this._sels.some(p => p[0] === 'furniture' && p.length === 2)) {
      // The selected pieces turned a quarter (Shift: back).
      this._turnPieces(e.shiftKey ? -90 : 90);
    } else if ((this._view !== 'build' || e.key.toLowerCase() === 'v') && !e.altKey && !e.shiftKey && TOOL_KEYS[e.key.toLowerCase()] && e.key.length === 1) this.setTool(TOOL_KEYS[e.key.toLowerCase()]);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && this._sels.length) {
      e.preventDefault();
      this._remove(this._sels);
    } else if (arrow && this._sels.length && !e.altKey) {
      e.preventDefault();
      const step = this._grid() * (e.shiftKey ? 10 : 1);
      this._moveBy(arrow[0] * step, arrow[1] * step);
    } else if (e.key === 'Tab' && (target === this._el.preview || target === this._layer) && this._hits?.length > 1) {
      e.preventDefault();
      this._cycle(e.shiftKey ? -1 : 1);
    } else return false;
    return true;
  }
}
