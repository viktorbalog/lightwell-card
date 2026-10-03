# Step 1: groundwork

Part of [the home editor plan](00-plan.md).

## Steps

1. Move the simulator's controls out of `tools/simulator/index.html` into a module (the sun's position, the date and
   time presets, facing, clouds, shutters, lights off, taps acting in the page), and make the simulator use it. The
   simulator must work exactly as before.
2. `src/editor/model.js`: the home as a `yaml` Document: open text, apply a change at a path (set, insert into a list,
   remove, move within a list), derive the home object, give the text back. Undo and redo as a list of documents.
   Tests: the round trip of both homes is byte for byte; a change keeps the comments around it.
3. `src/editor/editor.js`: the `<lightwell-editor>` element with the card in the middle (light or dark), the shared
   controls, and a raw YAML text view; each change to the text re-derives the home and redraws the card (debounced),
   or shows the check's messages when it doesn't pass.
4. Opening and saving: a file picker and drag and drop; saving back to the same file with the File System Access API
   where there is one, otherwise a download; YAML or JSON. The work in progress kept in the browser's storage.
5. `scripts/build.mjs` also builds `dist/lightwell-editor.js`; `tools/editor/index.html` is the page around it.

## Verification

- The simulator behaves as before (its presets, taps and readout), with no console errors.
- The model's tests pass; the card's bundle is unchanged.
- In Chrome: open the example, change a number in the text view, see the card follow; break a room name, see the
  message; save and reopen.

## Outcome

2026-10-03.

- **Shared controls:** `src/editor/controls.js` (`simulatorControls`, plus `sunPos` and `dayTimes`) builds the form
  and its styles itself, and takes a new version of the home (`setPlan`) so the editor's shutters and scenes follow
  its edits. The simulator works from `file://`, where modules don't load, so the build also writes it as a classic
  script, `tools/simulator/controls.js` (`LightwellControls`), as it does the example's `home.js`.
  `tools/simulator/index.html` is now the page around it.
- **Model:** `src/editor/model.js` (`HomeModel`): `set`, `insert`, `remove`, `move` (in lists and maps, keys and
  comments kept), `edit(fn)` for a change of several paths as one step, `setText`, `undo`/`redo`, `toJSON`, and
  `yamlOf` (plain data as YAML). The document is stringified with `{lineWidth: 0, flowCollectionPadding: false}`,
  which gives both example homes and the Taksony flat back byte for byte. A changed value keeps its node where it
  can (only the numbers change); new values follow the example's style (flow when they fit on 80 characters, lists
  of numbers always flow). Undo keeps the text of each version rather than documents (up to 200).
- **Element:** `src/editor/editor.js` (`<lightwell-editor>`): toolbar (New, Open, Save, Save as YAML, Save as JSON,
  Undo, Redo, Dark), the controls, the card, the YAML text view (the card follows 250 ms after typing), the check's
  messages (the card keeps the last version without mistakes). Ctrl+S saves; Ctrl+Z/Ctrl+Shift+Z undo outside the
  text view (inside it, the text area's own undo). `src/editor/index.js` registers it with the card (unless the page
  has one) and stand-ins for `ha-card`/`ha-icon`; new homes start from `example/home.yaml`, bundled as text.
- **Files:** `src/editor/files.js`: the File System Access API where there is one (saves back to the opened or
  dropped file), a file input and downloads elsewhere. A JSON file is edited as YAML and saved back as JSON; saving
  a YAML home as JSON is an export (the editor goes on with the YAML file). The draft (text, name, last saved text)
  is in `localStorage`; the file handle isn't kept, so after a reload Save asks where.
- **Build:** `scripts/build.mjs` builds the three bundles; `dist/lightwell-editor.js` is 304 kB unminified, most of
  it the `yaml` library. `npm test` also runs `src/editor/*.test.js`.

Verification:

- `npm test`: 44 pass (9 new for the model: the round trip of both example homes, a move changing one line, new
  values' style, insert/remove/move, undo/redo, mistakes, JSON). The Taksony flat's round trip was checked by hand
  (byte for byte); it isn't in the tests, being outside this repository.
- `dist/lightwell-card.js` builds to the same bytes as before (sha256).
- Simulator in Chrome: the old and new pages driven the same way (summer solstice, Golden hour, facing 30°, two
  weather taps, a blind and the TV tapped) give the same readout and values, and screenshots differ only in the
  preset buttons' text colour, which was then put back to the browser's default. No console errors.
- Editor in Chrome: the example opens; a changed number in the text view moves the bed on the card; a misspelt room
  lists `furniture.desk.shadow_room: no room called "bedrom"` while the card keeps the last good version; undo and
  redo; the draft survives a reload; dark theme. Saving was checked with a stand-in file handle (the native dialog
  can't be driven): Save as YAML writes the text unchanged, Save as JSON exports, Save writes back to the same
  file, and a dropped JSON file opens as YAML without errors.
- Not done: Firefox (no Firefox here to drive), and a save and reopen through the real dialogs, by hand.
