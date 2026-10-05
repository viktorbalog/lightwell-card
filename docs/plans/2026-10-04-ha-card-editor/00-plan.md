# Lightwell: the editor inside Home Assistant, and a Build view

Written 2026-10-04 at the user's request, as a plan of its own: step 6 of [the home editor plan](../2026-10-03-home-editor/00-plan.md)
was to decide whether to build it, and this is that decision's plan. Reworked the same day, at the start of the
work, as the user asked for more: the editor in HA gets its own shell, and the shared editor a second view, **Build**,
a guided way to make a home (rooms with their walls made for them, windows and doors clicked onto the walls, furniture
from a catalogue, lamps and devices from Home Assistant). The first version of this plan (one element, made compact for
HA's dialog) is in git history.

## Goal

Making and editing a home where the card is, in Home Assistant's card editor ("Edit card"), without knowing the
home's format: a new card opens in a Build view where rooms, windows, doors, furniture and lamps are placed rather
than drawn shape by shape, and the full editor (the Edit view) is one click away. The result is saved with the
dashboard. The standalone editor gets the same Build view for new homes.

## Context

- **The standalone editor** (`src/editor/`, `<lightwell-editor>`, bundled on its own into `dist/lightwell-editor.js`,
  about 480 kB with the `yaml` library) does everything on a home: drawing, moving, the forms from `src/schema.js`, the
  pickers, the simulator's controls, opening and saving files, a live connection through HA's login. It's published on
  GitHub Pages and works from the files. Its tools draw a home shape by shape: walls are rectangles of their own,
  rooms only clip the light, a window is dragged along a wall. That's precise, and a lot to learn for a first home.
- **The card has no visual editor:** `src/card.js` has no `getConfigElement` or `getStubConfig`, so HA offers only
  the YAML code editor for it, and its card picker adds an empty card that fails ("The card needs a home").
- **A card's config is the dashboard's:** with `home:` the home is in the card's config, which HA keeps (as JSON in
  `.storage` for dashboards edited in the UI): comments don't survive there. With `home_url:` the home is a file under
  `/config/www/`, which the frontend can't write. The user's own dashboard uses `home_url:
  /local/floorplan/taksony.json`, deployed from the `homeassistant` repo, and stays so.
- **HA's card editor dialog** is narrow (about 500–900 px), and it gives the config element `hass` and its config,
  and listens for `config-changed`. It shows the card's own preview beside (or under) the editor.

## Approach

### One editor, two views, two shells

- **The shared editor** (`<lightwell-editor>`) keeps the model, the card and its overlay, selecting, moving, undo,
  and the forms. It gets **views**: `edit` (today's editor: every tool, the list, the properties, the YAML) and `build`
  (below). Both work on the same model and history; switching keeps the selection where it can.
- **Shells:** `standalone` (today's header: files, Home Assistant, the page's own look) and `ha` (inside HA's dialog:
  no files or login; HA's `hass` gives the states and the location; the home in and out as a value; HA's theme, light
  or dark; keys only while the editor has the focus, so HA's own shortcuts and Esc on the dialog still work).
- **Colours as tokens:** the editor's styles use custom properties (panel, text, lines, accent…) with today's values
  as defaults; the HA shell maps them to HA's theme variables.

### The Build view

A row of steps over the plan, each with its palette beside or under it; the plan is large, with select and move as
in Edit (a selected item shows a short form: its name, size, turn, entity, Delete).

1. **Rooms:** drag a rectangle (snapped to 5 cm, sizes shown in metres), and name it. The room comes with its floor,
   its label, and its walls: **walls are made from the rooms** (`src/editor/build.js`, pure and tested). Every room
   side not against another room gets an outer wall outside it (25 cm); a room drawn against another's wall shares it
   (a new room snaps to the far side of an existing wall), and walls with rooms on both sides become interior walls
   (`iwall`). New walls are cut where walls already are, so nothing doubles. This reverses the first editor plan's
   "walls are drawn, not generated from rooms" for Build only: Edit still draws walls as they are.
2. **Windows and doors:** click on a wall. An outer wall gets a window or a door (chosen, with its width in metres):
   the wall is cut, its glass added (a window, or a glass door), and the opening with its room (`openingFrom`). An
   interior wall gets a doorway: the gap only.
3. **Furniture:** a catalogue (`src/editor/prefabs.js`) by room: living (sofa for 2 and 3, corner sofa, armchair,
   coffee table, TV unit, bookcase, rug), bedroom (double and single bed, bedside table, wardrobe, desk, chair),
   kitchen and dining (counter run with sink and hob, fridge, dining tables with 2, 4 and 6 chairs), bathroom (bath,
   shower, toilet, washbasin, washing machine). Each is a real size in metres with its height and class, and its
   details as `extra` shapes (cushions, pillows, the sink, the hob); a table with chairs places several pieces. Drag
   one onto the plan, or click it then click the plan; R or the turn handle turns it by 90° (15° in Edit).
4. **Lamps and devices:** the lights, covers, media players and sensors in the states in use (HA's, or the loaded
   ones), searchable; drag one onto the plan. A light becomes a lamp (glow, pool, its room, the room's pieces in its
   shadows) with its marker; anything else a marker with its icon. Placed ones are ticked.
5. **The sun:** which way is north (a dial on the plan's corner), and that's it.

Build covers what a first home needs; anything finer (a polygon room, a piece's own shapes, effects, labels, the
palette) is in Edit, and both work on the same home at any time. A home whose walls were drawn by hand still gets
rooms, doors and furniture in Build: walls are only ever added or cut, never redrawn.

### Where each view opens

In HA's card editor: Build (Edit one click away, and the YAML). In the standalone editor: "New home" (the empty one,
or over a picture) starts in Build; an opened file starts in Edit. The view is remembered per shell.

### Packaging

- **A bundle of its own for HA:** `dist/lightwell-card-editor.js` (`src/editor/ha.js`): the config element and the
  shared editor, without the standalone page's stand-ins (HA has `ha-card` and `ha-icon`) or the example home. The
  card's bundle grows by a loader and the stub home only. `dist/lightwell-editor.js` stays the standalone page's.
- **How it reaches HA** (from HACS's own code, 1.24.5 on the user's HA and `main`, 2.x): when the release has an
  asset named as the card (`filename`), HACS downloads **every asset of that release** into
  `www/community/lightwell-card/`; without assets, everything in `dist/`. The Release workflow uploads
  `lightwell-card.js` first (1.x matches only the first asset) and then `lightwell-card-editor.js`. The card loads it
  from its own address (worked out as it loads: HA loads resources as modules, without `currentScript`), and falls
  back to jsDelivr for the card's version if that fails.
- **The card's hooks:** `static getConfigElement()` loads the bundle on demand and returns `lightwell-card-editor`;
  `static getStubConfig(hass)` gives a small home that works (`src/stub.js`: one room with a window, a sofa, and a lamp
  with its marker for the first light in the house), so a new card from the picker shows something.

### Homes kept in a file (`home_url`)

The config element can't save to `/config/www/`. It shows what the card is and offers both ways on (the user's
choice): **Edit here**, which turns `home_url` into `home:` (the file's content, kept by the dashboard from then on;
the file stays as it was), or **the standalone editor**, with a link to download the file, to open it there and put
it back.

### Descriptions instead of comments

Asked by the user while this was built: a dashboard keeps its cards as JSON, so YAML comments can't survive there. An
optional `description:` text on the home and on every item that is a map (openings, furniture, lights, markers,
shapes, the sun's spills and blockers) carries a note as data: the card ignores it (a shape doesn't write it as an SVG
attribute), `defineHome` checks it's a text, the editor's forms show it (a text area) and the item list as a tooltip.
Rooms are lists of rectangles, not maps, so they have none.

### Decided against

- Writing `/config/www/` files from the frontend (no API for it; an add-on or integration would be needed, which the
  first plan already decided against).
- A second, separate editor for HA: the HA shell and the Build view are parts of the one editor, so they can't drift.
- Regenerating all walls from the rooms on every change: hand-drawn walls would be lost. Walls are added and cut.

## Steps

1. [Shells and views](01-shells.md): colour tokens, the `shell` and `view` of the shared editor, the value in and out,
   `hass`, keys scoped to the editor, the HA shell's look.
2. [Build: rooms and walls](02-rooms.md): `build.js` (walls from rooms, sharing, classes; cutting doors and windows),
   the Build view's steps bar, the room and opening steps.
3. [Build: furniture](03-furniture.md): `prefabs.js`, the catalogue palette, placing and turning.
4. [Build: lamps, devices, north](04-devices.md): the entity palette, placing lamps and markers, the north dial; Build
   first for new homes in the standalone editor.
5. [Home Assistant](05-ha.md): the bundle, the loader, the config element, `getStubConfig`, `home_url` homes, the
   Release workflow; tried on a test dashboard.
6. [Descriptions, docs, release notes](06-docs.md): `description` (done first, at the user's request), the README
   (the editor in HA, Build, descriptions), the CHANGELOG.
7. [Build's objects as groups](07-groups.md) (added 2026-10-05): a click selects a group, a drag moves it (rooms too,
   their walls remade; what it's in follows), a double-click enters it, as a piece's insides in Edit; prefabs as
   groups; a lamp's pool lit with it.
8. [A toolbar, a details panel, the keyboard](08-layout.md) (added 2026-10-05): the tools as icons beside HA's 500 px
   preview (or above it), the panel for the selection's settings (or the tool's choices), no YAML tab in HA, the keys
   on HA's preview.

Steps 2–4 build on each other; 5 needs 1 (and is worth more with 2–4); 6 goes along; 8 builds on 7.

## Verification

- Unit tests: walls from rooms (one room, two side by side sharing a wall, an L of three, a room drawn over an
  existing wall), cutting a window, a door and a doorway, the classes; every prefab passes `defineHome` placed and
  turned; a lamp from a light; the stub home passes `defineHome`; the value in and out keeps the home (round trip);
  descriptions in `defineHome` and the shapes.
- `dist/lightwell-card.js` grows by the loader and the stub only (checked by size); the reference screenshots match.
- In Chrome (an isolated context): build a two-room flat in the Build view from nothing (rooms, a window, a door
  between them, a sofa, a bed, a dining table, a lamp, north), then switch to Edit and back, undo through it.
- In Home Assistant (the user's choice: a development build loaded by hand on a test dashboard, the card under a
  development tag so the HACS one is untouched): add the card from the picker (the stub shows), open "Edit card",
  build a room with a lamp for a real light, save, reload: the dashboard keeps the home; the YAML editor shows it; a
  `home_url` card offers both ways; light and dark themes; a phone-sized window.

## Progress

Asked for by the user while it was built, and done: descriptions; a separate bundle for HA; a Build view of the
shared editor; window and door sizes by dragging; Build's objects tracked as one (`part`); each Build step selecting
its own kind of thing; the Build panel under the steps instead of in a tab; turning pieces (R, the turn handle in the
Furniture step, Ctrl or ⌘ and a drag); a work-in-progress server (nginx on the Mac's Docker, port 8091, with a watch
build) and `tools/editor/ha.html` to see it.

| Step | State | Notes |
| --- | --- | --- |
| 1. Shells and views | done 2026-10-04 | Colour tokens, `shell="ha"` (HA's theme, no files, value in and out, `hass`, keys kept from HA), `view`. |
| 2. Rooms and walls | done 2026-10-04 | `build.js`; cuts by click or drag, resized by their ends, slid; doorways and thresholds get a floor. |
| 3. Furniture | done 2026-10-04 | `prefabs.js`, 23 pieces in 4 rooms; placed by click or drag, turned by R, the handle or Ctrl+drag. |
| 4. Lamps, devices, north | done 2026-10-04 | `devices.js`; a cover dropped on a window is its shutter; New → Empty starts in Build. |
| 5. Home Assistant | built, tried in HA by the user | `ha.js`, `loader.js`, `stub.js`, the Release workflow; editing on HA's preview; selecting and dragging there confirmed by the user (2026-10-04); the keyboard there still unreliable (step 8). The dev build stays on the test dashboard. |
| 6. Descriptions, docs | done 2026-10-04 | README (the editor in HA, Build, notes and parts), CHANGELOG, CLAUDE.md. |
| 7. Groups | done 2026-10-05 | Checked on the test page, not in HA yet. A lamp's entity set on one part reaches all (the user's lamp issue). |
| 8. Toolbar, panel, keys | planned 2026-10-05 | Undoes step 5's widening of the preview. |

Nothing of it is committed yet (2026-10-05): it's all in the working tree of the branch `feature/card-editor`, with
120 tests passing.

## Answers from the user

2026-10-04: **both** ways for `home_url` homes; a **development build by hand** on a test dashboard; the user's flat
**stays `home_url`**; descriptions instead of comments; a **separate bundle** for HA; the HA editor a **shell of its
own over a shared core**, with a **Build view** (opening first for new homes in both editors), **walls made from
rooms**, a catalogue of **living, bedroom, kitchen and dining, and bathroom** furniture, and **lamps and devices
picked from HA**.

2026-10-05: Build's objects **behave as groups** (selected and moved as one, entered by a double-click as Edit's
pieces are); a **room moves** too, its walls remade where it lands; HA's preview **stays 500 px** with the tools
beside it as icons (above it when there's no room); the tools **simplified** to a toolbar; the panel for **details**,
showing the tool's choices (the catalogue, the devices) **when nothing is selected**; **no YAML tab** in HA; a lamp's
**pool lit** with it. As steps of this plan.
