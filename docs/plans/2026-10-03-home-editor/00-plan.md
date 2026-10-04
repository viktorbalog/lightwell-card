# Lightwell: an editor for homes

Follows [the first release](../2026-10-03-first-release/00-plan.md). Written 2026-10-03 at the user's request, before
any change.

## Goal

Describing a home without writing YAML by hand: an editor where the user draws rooms and walls (or traces a picture
of their plan), places windows, furniture, lights and markers, and sees the card light them as they go, under any sun
and in either theme. It saves the same YAML (or JSON) the card reads.

## Context

- **A home is plain data** (`src/home.js`): view and scale, rooms, a drawing in slots, openings, furniture, lights,
  effects, markers, the sun's surroundings, a palette, simulator scenes. `defineHome` checks it and lists every
  mistake. The README documents every field.
- **Today it's written by hand,** in a text editor, with coordinates read off a picture or worked out. The
  example flat is 171 lines; the home it was made general from, 440. It's the biggest hurdle for a HACS user.
- **The card redraws from the home object:** given a new object (`setConfig({home})`), it rebuilds the whole plan.
  That's quick (a few milliseconds), so an editor can simply hand it each edited version.
- **The simulator** (`tools/simulator/index.html`, 233 lines, its code inline) already shows a home in light and dark
  under a chosen date, time, weather and shutters, with lights toggled by tapping. It works from `file://` and takes the
  card, home and states by URL (`tool.js`). It's the natural base: the editor is the simulator plus editing.
- **What the card can't tell an editor:** which item is under the pointer. The card's SVG is generated and blurred, so
  the editor must work out hits from the home's own geometry, not the rendered DOM.

## Approach

### Where it runs

- **A standalone page first**, `tools/editor/index.html`, opened from the files like the other tools, and published
  on GitHub Pages so HACS users can use it without cloning anything. It needs no server: files are opened and saved
  with the File System Access API where the browser has it (Chrome, Edge: save back to the same file), and by
  download elsewhere (Firefox, Safari).
- **Later, perhaps, inside Home Assistant** as the card's visual editor (`getConfigElement`), for homes kept inline
  in the dashboard (`home:`). It can't save `home_url` files (the frontend can't write to `/config/www/`), so it's a
  second phase, built from the same component.
- Decided against: an HA add-on or integration with its own panel (heavy to install and maintain for a card), and a
  desktop app.

### How it's built

- **A custom element, `<lightwell-editor>`,** in `src/editor/`, bundled separately into `dist/lightwell-editor.js` so
  the card's bundle stays as small as it is. The page is a thin shell around it; the same element could later be the
  HA card editor.
- **The YAML document is the model.** The editor keeps the file as a `yaml` Document (the library the build already
  uses) and applies every edit as a change at a path (`furniture.sofa.shape.rect`), so **comments and layout
  survive**: the Taksony flat's YAML is half comments. The home object the card gets is derived from the document
  after each edit. Undo and redo keep the text of each version (cheap at this size; done in step 1 instead of a
  list of documents).
- **One description of the fields**, `src/schema.js`: each field's type, whether it's required, its default, its
  unit and a line of help. The property panel's forms are generated from it. A test checks that it and `defineHome`
  agree, so they can't drift; later it could generate the README's tables too.
- **The simulator's controls become a module** (date, time and its presets, facing, clouds, shutters, lights off),
  shared by the simulator page and the editor, so both stay one implementation (`src/editor/controls.js`; the
  simulator, opened from `file://` where modules don't load, gets it built as `tools/simulator/controls.js`).
- **An overlay for editing:** a transparent SVG with the same `viewBox` laid over the card, carrying the selection,
  handles, guides and the grid. Pointer positions are converted to the drawing's units through its screen matrix.
  Hit testing uses the home's geometry (shapes, furniture outlines, opening spans, pool circles, marker positions),
  front to back: markers, the lights' centres, furniture, openings, the lights' glows, drawing shapes, rooms (step 2:
  a lamp's glow is often wider than the furniture under it, so only its centre comes before the furniture).
- **Snapping:** to a grid (5 cm by default, from `units_per_metre`), to other items' edges and corners, and to the
  axes with Shift. A ruler shows lengths in metres while drawing.

### What the editor does

- **Layout:** the card (light or dark, with the simulator's controls) in the middle; a list of everything on the
  left (rooms, drawing slots in their order, openings, furniture, lights, markers), reorderable where order matters;
  the selected item's properties on the right; the check's messages at the bottom, each one selecting its item.
- **Start a home:** from the example, from an empty one with a size and a scale, or **from a picture of the plan**:
  drop the image, draw a line along something whose length is known (a wall, a door), type its length, and the scale
  and view follow; then trace over it, or keep it as the `background`.
- **Tools:** select (move, resize from corners, rotate turned pieces, drag a polygon's corners and add or remove
  them), wall, room (rectangle or polygon), opening (drag along an outer wall: its side, outer face and thickness come
  from the wall under it), furniture (rectangle, circle, polygon; height, shadow room, class), light (its glow, then
  its pool's centre and radius, its height; furniture is added to its shadows by clicking it), marker, label.
- **Entities:** pickers fed by the states in use (the example's, a snapshot from `snapshot.sh`, or, later, a live
  connection to Home Assistant through its own login page, so no token is ever pasted into the page). A marker's label
  is built by choosing an attribute from the entity's real attributes and seeing the text it gives.
- **Raw YAML:** a text view of the same document, editable, for anything the forms don't cover; the preview follows
  it as it's typed.
- **Saving:** YAML (comments kept), and JSON for `home_url`. The work in progress is also kept in the browser's
  storage, so a closed tab loses nothing.

### Decided against, for now

- A general drawing program (free-form curves, layers of its own): the editor edits a home's fields, nothing else.
- Generating walls from rooms: walls are drawn (or traced from the picture) as they are; rooms are their own shapes.
- A live HA connection in the first version: snapshots cover the pickers; the login flow comes later (step 6).

### Open questions for the user

1. **Standalone first, the HA visual editor later?** (assumed)
2. **GitHub Pages** for the hosted editor, at `viktorbalog.github.io/lightwell-card/editor/`? It needs Pages turned
   on in the repository's settings (from a workflow).
3. **Keeping comments** when saving, which ties the editor to the `yaml` Document model (assumed: yes, the Taksony
   flat depends on them).
4. **The text view:** a plain text area (no dependencies) or CodeMirror (highlighting, line numbers, +~150 kB to the
   editor's bundle only)? Plain first is assumed.

## Steps

1. [Groundwork](01-groundwork.md): the shared simulator controls, the editor page and element, opening and saving with
   comments kept, undo and redo, the raw YAML view with a live preview and the check's messages.
2. [Selection and properties](02-select.md): the overlay, hit testing, the list, the property panel from
   `src/schema.js`.
3. [Moving things](03-manipulate.md): move, resize, rotate, polygon corners, snapping, the grid and the ruler.
4. [Drawing things](04-create.md): the creation tools, starting from a picture with its scale calibrated.
5. [Entities](05-entities.md): pickers from the states, the label builder, icons.
6. [Publishing](06-publish.md): GitHub Pages, the README's editor section, a live HA connection through its login
   flow, and whether to go on to the HA visual editor.

Steps 2–5 build on each other in order; step 6 can start once step 4 is done.

## Progress

The open questions were taken as assumed (standalone first, comments kept, a plain text area); Pages waits for
step 6.

| Step | State | Notes |
| --- | --- | --- |
| 1. Groundwork | done 2026-10-03 | Shared controls, the model (both example homes and the Taksony flat round-trip byte for byte), `<lightwell-editor>` with the YAML view, opening and saving, its own bundle. A fix followed the same day: states made up by a tap now have `attributes` (tapping a home's own lights failed with the example's states). |
| 2. Selection and properties | done 2026-10-03 | `src/schema.js` with its check against `defineHome`, hit testing, the overlay, the item list (add, reorder, rename with references, delete), the property forms. A light's glow is picked after the furniture (see Approach). |
| 3. Moving things | done 2026-10-04 | `src/editor/manipulate.js` (moving, handles, resizing, turning, polygon corners, snapping, the ruler), dragging with a live preview and one edit on letting go (`HomeModel.batch`), a selection of several, arrows, Ctrl+D, a grid. A light's pool centre handle moves the pool alone. |
| 4. Drawing things | done 2026-10-04 | `src/editor/create.js`: new homes (example, empty, over a picture kept in the browser, with the scale measured on it), the tools (wall, room, opening with its wall inferred, furniture, light, marker, label, scale), defaults by name and room. A lamp's shadows are toggled by Ctrl+click. Checked by tracing the background example's studio from its picture. |
| 5. Entities | done 2026-10-04 | `src/editor/pickers.js`: entity pickers with names and states (a light's entities as a list), `snapshot.sh --all`, the label builder with the text it shows now, icon search from the MDI list, an effects form with a preview on a lamp. |
| 6. Publishing | done 2026-10-04 | The Pages workflow and site (`scripts/site.sh`), scripts taken by path only, the README's editor section with a screenshot: published 2026-10-04 at viktorbalog.github.io/lightwell-card/editor/; the live HA connection (`src/editor/live.js`); `CHANGELOG.md`. The HA visual editor has [a plan of its own](../2026-10-04-ha-card-editor/00-plan.md). The user signed in with their local HA. Released as 0.2.0. |

Each step's file has its Outcome. Still to do by hand from steps 1–3: Firefox, saving and reopening through the
browser's real file dialogs, and drawing with a real mouse.

## Verification

- **Round trip:** opening the Taksony flat's and the example's YAML and saving without changes gives the same text,
  byte for byte; a move of one piece changes only that piece's numbers, its comments intact (tests on the model).
- **Unit tests** for the model's edits, undo and redo, hit testing, snapping, the opening tool's wall inference, the
  scale calibration, and the schema agreeing with `defineHome`.
- **The card is unchanged:** `dist/lightwell-card.js` builds to the same bytes as before the editor (the editor has
  its own bundle), and the reference screenshots match.
- **By hand, in Chrome:** draw the example flat from its picture alone, then compare the result's render with the
  example's (the same rooms, openings, lights and markers in the same places, within the snapping). And in Firefox:
  open, edit and download.
- **A stranger's test** before announcing it: someone who hasn't seen the YAML draws their own home with it.

## Outcome

2026-10-04. The editor is done and released as 0.2.0, online at
https://viktorbalog.github.io/lightwell-card/editor/ and in `tools/editor/` (each step's file has its own Outcome).

- **What changed:** `src/editor/` (the model, the element, files, hit testing, moving, drawing, the pickers, the live
  connection), `src/schema.js`, `dist/lightwell-editor.js` (a bundle of its own), `tools/editor/index.html`,
  `scripts/site.sh` and the Pages workflow, the README's editor section, `CHANGELOG.md`. The card
  (`dist/lightwell-card.js`) is unchanged but for its version.
- **How it was checked:** 81 unit tests (the model's round trips and edits, the schema against `defineHome`, hit
  testing, moving and snapping, drawing and the wall inference, the pickers, the live connection's helpers); in Chrome
  step by step, with the example, the background example traced from its picture, the Taksony flat, and a snapshot of
  the user's 249 entities; the site served as Pages serves it; the live connection against the user's HA, and the
  user's own sign-in. The user moved things with a real mouse.
- **Decided against or changed on the way:** a lamp's shadows toggled by Ctrl+click rather than a plain click; the
  pool's centre handle moves the pool alone; a still in the README instead of a GIF; the example flat wasn't drawn from
  a picture of its own (there's none), the background example's studio was.
- **Left open:** Firefox; saving and reopening through the browser's real file dialogs; a stranger's test before
  announcing it; the editor inside Home Assistant, in [its own plan](../2026-10-04-ha-card-editor/00-plan.md).

