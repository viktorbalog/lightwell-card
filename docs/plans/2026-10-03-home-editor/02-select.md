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
