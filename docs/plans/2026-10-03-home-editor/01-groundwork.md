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
