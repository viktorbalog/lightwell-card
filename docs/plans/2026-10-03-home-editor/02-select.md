# Step 2: selection and properties

Part of [the home editor plan](00-plan.md).

## Steps

1. The overlay: an SVG with the card's `viewBox` over the card, following its size; pointer positions in drawing
   units.
2. Hit testing from the home's geometry, front to back: markers, lights (glow and pool), furniture (turned outlines),
   openings, drawing shapes, rooms. Clicking selects, Escape clears, Tab cycles through what's under the pointer.
3. `src/schema.js`: every field of a home (type, required, default, unit, help), and a test that it agrees with
   `defineHome` (every field it checks is described, and the other way round).
4. The list panel: rooms, drawing slots, openings, furniture, lights, markers; selecting in either the list or the
   plan selects in both; drag to reorder where order matters (drawing order, furniture order).
5. The property panel: a form for the selected item from the schema (numbers with their unit, room and furniture
   names as choices, colours, checkboxes), each change a model edit. Adding and deleting items from the list.

## Verification

- Tests: hit testing (turned furniture, polygons, overlapping items), the schema check.
- In Chrome: select each kind of item in the example by clicking and from the list; change a light's height and see
  its shadows change; delete a marker and undo.

## Outcome

2026-10-03.

- **Schema:** `src/schema.js` (`SCHEMA`, `SHAPE`, `fieldAt`): every field with its type, help, unit, default, and
  `required` or `check` where `defineHome` fails on it; opening spans have `when` (x and w only on top and bottom
  walls). `src/schema.test.js` checks it three ways on both example homes: every field in them is described; every
  field `defineHome` fails on (given a value of the wrong type) is marked; every marked field fails with a wrong
  value, and every required one when left out. Breaking it on purpose (unmarking `shadow_room`) fails the test.
  Some values make `defineHome` crash rather than report (`entities: 42`, `lights: 42`); the test counts that as
  rejected but not as checked. `defineHome` was left as it is, so that the card stays the same.
- **Hit testing:** `src/editor/hit.js` (`hitTest`, `outlineSvg`, `shapeGeometry`, `pathLines`): rects, circles,
  ellipses, polygons, paths (as polylines, curves by their end points, stroked lines widened by their
  `stroke_width`), texts (an estimated box from their class's size), repeated shapes, turned furniture, opening spans
  (the wall's thickness), markers (their icon's size), rooms. The order changed from the plan: a light's centre
  comes before the furniture and its glow after, since a lamp's glow is often wider than the sofa under it.
- **Overlay:** an SVG laid over the card's drawing with its `viewBox`, placed again whenever the stage resizes or
  the card redraws; pointer positions through its screen matrix, with a 6 px reach. A click selects the frontmost
  item; clicking again in the same place, or Tab, steps through what's under it; Esc clears; Alt+click taps the
  card (lights toggle, the weather changes). The item under the pointer is outlined lightly, the selected one in
  blue (a light with its pool dashed and its centre).
- **List:** the home's items by group (rooms, the drawing's slots, openings, furniture, lights, markers), with a +
  to add an item that works before it's edited (the room under the view's centre as `clip` or `shadow_room`, the
  slot's usual class). Drawing slots and furniture reorder by dragging. Openings don't, because `sun.spill.from`
  refers to them by position.
- **Properties:** the form for the selected item from the schema (numbers with units, rooms as choices, entities
  and effects with suggestions, colours, checkboxes, the furniture of a light's shadows as checkboxes, anything
  else as YAML in flow style), each change one model edit. Nested objects (`pool`, `label`, `trees`, `repeat`,
  `background`) are added with a button and removed with ×. A shape's kind can be changed. Nothing selected shows
  the home's own fields. Furniture and rooms are renamed in place, and the fields naming them follow; deleting a
  piece takes it out of the lights' shadows too. Delete (or the key) deletes; undo restores.
- **Messages and text:** a check's message selects its item; with the YAML tab open, selecting scrolls to the
  item's text and selects it.

Verification:

- `npm test`: 55 pass (3 schema, 7 hit testing: turned furniture, polygons, overlapping items, paths, texts,
  openings, markers, lights; 1 more model test, renaming). `dist/lightwell-card.js` is unchanged (sha256).
- In Chrome, with the example: clicking selected each kind (piece, turned piece, marker, light, opening, label,
  wall, room by cycling, nothing outside); the list selected the TV's light. Raising the living room lamp's pool to
  2.4 m shortened its furniture shadows on the card, and the YAML changed only in that number. Unticking the sofa
  from its shadows; deleting a marker with the Delete key, then Ctrl+Z; renaming the coffee table and the bedroom
  (no errors after: the references followed); deleting the renamed table (it left the shadows); adding a piece and
  a wall; dragging a wall above another; a misspelt room in the YAML listed a message that selected the opening; the
  YAML tab selected the opening's line; Alt+click switched the lamp off. No console errors.
- With the Taksony flat: clicks across the plan selected walls, floors, fittings, labels, furniture, openings,
  lights and markers, with no errors.

Left open: entity pickers and the label builder are step 5; lists like `entities` and `states` are YAML fields
until then.
