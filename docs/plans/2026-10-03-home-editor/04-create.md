# Step 4: drawing things

Part of [the home editor plan](00-plan.md).

## Steps

1. Starting a home: from the example, an empty one (size and scale), or a picture: drop it, draw a line over a known
   length and type it, which sets `units_per_metre` and the view; the picture can stay as `background`.
2. Tools: wall (drag; rectangles in `walls`, or `iwall` inside), room (rectangle, or polygon by clicks), opening (drag
   along an outer wall: the side, outer face and thickness come from the wall under it; glass heights from defaults),
   furniture (rectangle, circle, polygon), light (the glow, then the pool's centre, radius and height), marker, label.
3. Shadows: with a light selected, clicking furniture adds it to or removes it from the light's shadows; the pieces
   in shadow are outlined.
4. Sensible defaults for new items (heights by kind, classes, the room under the pointer as `clip` and
   `shadow_room`), so a new item works before it's edited.

## Verification

- Tests: the opening tool's wall inference (all four sides, walls of different thickness), the scale calibration.
- In Chrome: draw the example flat from a picture of its plan alone and compare its render with the example's.

## Outcome

2026-10-04.

- **Starting a home:** New opens a dialog: the example flat, an empty home (width and height in metres, units a
  metre: `emptyHome`, with the example's comments), or a picture of the plan (or one dropped on the editor:
  `pictureHome`, the view and units the picture's pixels, its `background` named `/local/<file>`). The picture is kept
  in the browser (IndexedDB, by that name) so the card shows it before it's in Home Assistant, and after a reload;
  dropping it again re-attaches it to a home that names it. The scale tool starts ready: drag along a known length,
  type it, and `units_per_metre` follows (`scaleFrom`); without a length it only measures. Over a picture, rooms start
  without a floor (it would hide the picture).
- **Tools** (`src/editor/create.js`, pure and tested; a toolbar over the plan with keys V W R O F L M T S and each
  tool's options; the tools stay on until Esc or V): wall (drag its box, or along its middle for 25 cm outside a room
  and 15 cm inside one as `iwall`; or chosen); room (a rectangle by dragging, a polygon by clicks, closed on its first
  corner, by double-click or Enter, Backspace takes a corner back; with its floor); opening (dragged along an outer
  wall: `inferWall` finds the wall rectangle in whose thickness the drag runs, nearest along it, as a door is a gap
  between two; its outside is the side with no room, else away from the rooms' middle; window or door heights; with
  its glass, 40 % of the wall's thickness in its middle); furniture (rectangle, circle from its middle, polygon; a click
  places one of the usual size); light (a click, or a drag for its glow's size); marker; label. Everything drawn snaps
  like moving does (Shift: along an axis, Alt: not at all), with the ruler.
- **Defaults** so a new item works: a piece's height and class from words in its name (`pieceDefaults`: a wardrobe
  2 m, a bed 0.55 m, a chair 0.9 m and small, a lamp or rug none), the room it's in as `shadow_room`; a lamp kept in
  its room, over the furniture, with a pool 3.5 m wide 1.5 m up in which the room's pieces with a height cast shadows;
  openings in the room on their inside. Entities are `light.new_light` until step 5's pickers.
- **Shadows:** with a lamp selected, Ctrl+click (Cmd on a Mac) on a piece adds it to the pool's shadows or takes it out;
  the pieces in shadow are outlined in orange. A plain click still selects, so the plan's "clicking furniture" became
  Ctrl+click.
- **The model:** an empty flow collection under a block one (`walls: []`) turns block when it gets its first item,
  so a new home's YAML reads like the example's.

Verification:

- `npm test`: 73 pass (7 new in `create.test.js`: new homes pass the check, the scale, the wall inference on all four
  sides, through a gap, with walls of different thickness, within the tolerance and not beyond, interior walls left
  out, no rooms; an opening and its glass; walls from a box or a line; pieces' and lights' defaults; first items on
  their own lines). `dist/lightwell-card.js` is unchanged (sha256).
- In Chrome (an isolated context, with pointer events from a script): instead of the example flat, which has no
  picture, the background example's studio was drawn from `plan.png` alone: started over the picture, measured 5.6 m
  wall to wall (100 units a metre, as the example), seven walls, the room, both windows (exactly the example's
  openings: side, outer face, thickness, span), a door, the sofa, the round table, the bed, the lamp with its pool and
  shadows, a marker and a label. The YAML has the example's shape and the same items, short of the sofa's round
  corners, the weather marker and `north: 25`; it renders like it. Also: a polygon piece by clicks (one name asked,
  closed either way), Backspace and Esc while drawing, Ctrl+click taking the sofa out of the lamp's shadows, the empty
  home, the picture back after a reload, and a relative background still shown. Writing the tests caught `armchair`
  taking a chair's height; the first run in Chrome showed new homes' items on one line (the model fix above), a rug
  with a height, and the card asking for the missing `/local/` picture before it was read back (it now waits).

Left open: drawing with a real mouse, and in Firefox; names and the label's text are asked with `prompt()`; the
example flat drawn from a picture of its own (there's none).

