# Step 3: Build, furniture

Part of [the editor in Home Assistant plan](00-plan.md).

## Steps

1. `src/editor/prefabs.js`: the catalogue (living, bedroom, kitchen and dining, bathroom), each with its size in
   metres, height, class, rounding and details (`extra`); `placePrefab(data, prefab, at, turn)`: the pieces (named
   after it, numbered when taken), in the room under them as their shadow room.
2. The palette: by room, each with a small drawing of itself; drag onto the plan, or click and click; R turns the one
   being placed or the selected piece by 90°.

## Verification

- Tests: every prefab placed at 100 and at 37.5 units a metre, turned and not, passes `defineHome`; names don't clash.
- In Chrome: a sofa, a bed and a dining table placed, turned, moved.

## Outcome

2026-10-04. `src/editor/prefabs.js` (tested: every piece at two scales and four turns passes `defineHome`):
living (sofas for 2 and 3, corner sofa, armchair, coffee table, TV unit, bookcase, rug), bedroom (double and single
bed, bedside table, wardrobe, desk, chair), kitchen and dining (counter with sink and hob, fridge, tables for 2, 4 and
6 with their chairs as pieces of their own), bathroom (bath, shower, toilet, washbasin, washing machine); drawn small
in the catalogue (`prefabSvg`). `turnedPiece`: a rectangle by its `turn`, a polygon with its insides moved round. In
the editor: the catalogue in the Build panel; a click or a drag onto the plan places one (its outline follows the
pointer); R turns the one being placed or the selected pieces; in the Furniture step a piece on the plan is
selected, moved, and has its handles (resize, turn); Ctrl or ⌘ and a drag turns a piece in either view. Prefab pieces
have no `part`: each chair moves on its own.

Then, at the user's word: a polygon piece couldn't be turned (only rectangles had `turn`). The card turns one now as it
does a rectangle, by an SVG transform, around the middle of its bounding box (`src/furniture.js`; `turnPoly` and
`polyMiddle` in `src/geometry.js` for its shadow and the editor's hit testing); the editor gives it the turn handle,
and R and Ctrl+drag set its `turn`. A turned polygon has no corner handles (moving a corner would move its middle, and
the whole of it); it's reshaped unturned. Tested (its drawing, clip and shadow); `ref.html` renders as before, 0 pixels
differ.

Then, at the user's word, the same day:

- **Lights in the catalogue:** ceiling lamp, pendant, floor lamp (with its base), table lamp, light strips of 1 and
  2 m (a stroked line, `top`). Each is one object (`lamp_1`): its glow, its pool (the room's pieces with a height in
  its shadows), its small marker; placed with the first light of the states not on the plan yet. With a lamp selected
  in the Build view, the panel asks which light it is (the states' lights, switches, fans, media players), or none.
  A strip's ends are dragged (the lamp's light handles show for the whole object).
- **Lights without an entity** (`lit: always | dark | never`, in `defineHome`, the schema, the card: lit while the
  sun's elevation is below 0, in its `color` or warm white; tested). Choosing none in the picker takes the marker away
  (a marker needs an entity); choosing a light again brings it back.
- **Placing by Shift+click:** in Furniture and Lamps and devices a plain click selects (and a drag moves, or boxes),
  as Select does; Shift+click places what's chosen (its outline under the pointer while Shift is held), as does a drag
  from the catalogue.
- **A room's name on the plan:** a double-click on a room (with Select or in Rooms; at first only in Rooms, which the
  user found didn't work where they tried it), or on its name in any Build step, edits its label in place (Enter or leaving keeps
  it, Esc doesn't and stays out of HA's dialog). The room's key stays, as everything refers to it by that.
- The Build panel sits above the plan's overlay (a lamp's pool outline drew over it). `ref.html` still renders as
  0.2.0, 0 pixels differ.
