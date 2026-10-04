# Step 3: moving things

Part of [the home editor plan](00-plan.md).

## Steps

1. Handles for the selection: move anything; resize rectangles from corners and edges, circles by their radius;
   rotate turned rectangles; drag a polygon's corners, add one on an edge, remove one.
2. Lights: drag the pool's centre and radius; the glow moves with the light unless moved on its own. Openings: drag
   along their wall, resize their span.
3. Snapping: the grid (5 cm by default), other items' edges and corners, the axes with Shift; Alt turns it off. A
   ruler shows lengths and distances in metres while dragging.
4. Keyboard: arrows nudge by a grid step (Shift: ten), Delete, Ctrl+Z / Ctrl+Shift+Z, Ctrl+D duplicates.
5. Multiple selection (Shift+click, a box), moving several items together.

## Verification

- Tests: snapping (grid, edges, axes), polygon corner edits, rotation of turned rectangles.
- In Chrome: rearrange the example's living room and check the YAML only changed those pieces' numbers.

## Outcome

2026-10-04.

- **Geometry:** `src/editor/manipulate.js`, pure and tested: moving any item (a piece with its `extra` shapes, a
  light with its glow and pool, an opening along its wall only, a path by rewriting its absolute coordinates and
  leaving relative ones and arc radii as written, room rectangles and polygons); handles (a rectangle's corners and
  sides in its own turned frame, furniture's turn handle, circle and ellipse radii, polygon corners and the middles
  of their sides, a light's pool centre and radius and its glow shapes', a room's rectangles or polygon, an
  opening's two ends); resizing with the opposite side fixed (turned too, flipping rather than going negative);
  turning in 15° steps; corners added by dragging a side's middle and removed by double-clicking (three stay);
  snapping of a point or a move to other items' corners, ends and centres, else to the grid; the ruler's text.
  Values are written to a tenth of a unit, never `-0`.
- **The pool alone:** dragging a light moves its glow and pool together; its pool's centre handle moves the pool
  alone (where the lamp is, for its shadows), and the glow shapes have their own handles. This is how "the glow moves
  with the light unless moved on its own" was read.
- **Editor:** a press is a click until the pointer moves 4 px, then a drag: on a handle it changes the item, on an
  item it moves the selection (selecting the item first if it wasn't), with Shift at the start or on empty space it
  selects with a box (items wholly inside). Shift during a drag keeps it to one axis, Alt turns snapping off (and the
  turn's steps). The card and overlay follow at most once a frame (a version failing the check isn't shown); letting
  go writes one edit (`HomeModel.batch`, new: several sets, inserts and removes as one undo step); Escape drops the
  drag. Guides show where a snap lined things up, a ruler by the pointer the size, radius, side lengths, angle or
  distance in metres, and a Grid button the 5 cm grid (lines only when 6 px apart or more) and metres.
- **Selection of several:** Shift+click on the plan or in the list adds or takes out; the list marks them all; the
  properties show the last one's with a note. Arrows nudge by a grid step (Shift: ten), Ctrl+D duplicates (pieces and
  rooms under a new name, the rest at the end of their lists, so openings' positions referred to by `sun.spill`
  don't shift), Delete deletes them all in one edit (pieces leaving the lights' shadows).
- **SVG transforms on shapes** (found by hand, after the first version: the Taksony flat's "Hallway" label is
  `rotate(-90 680 420)`, and its box was drawn unturned): the editor's geometry now applies a shape's `transform`
  (`parseTransform` in `hit.js`, any SVG transform list) to its outline, hits, anchors and handles; dragging a handle
  works in the shape's own units; moving a shape moves its rotation's centre with it (a matrix's translation is made
  up for, a scale or skew becomes such a matrix).
- Dragging and the keys wait while the YAML has mistakes (a message says so): the plan then shows an older version.

Verification:

- `npm test`: 66 pass (11 new in `manipulate.test.js`: moving each kind, paths, resizing turned and not, turning,
  polygon corners, circles/ellipses/pools/openings/room rectangles, snapping a point and a move, targets, and a
  move written to the example's YAML changing only those lines, undone in one step; a turned label's box, hits,
  move and a rect's handles under a transform). Writing them caught the `-0`.
  `dist/lightwell-card.js` is unchanged (sha256).
- In Chrome, with the example, by pointer events from a script and real key presses: the sofa moved (its two lines
  only, cushion included, snapped to an edge 8 units off: 6 px is 10 cm in a narrow window); the coffee table turned
  to 90° and its turned side resized with the other side fixed; the door's end widened it to 2.6 m; the lamp's pool
  radius; a box selected the bed; arrows nudged it 5 and Shift 50; Ctrl+D made `bed2` and Delete removed it; a
  triangle got a corner from its side's middle and lost it by double-click; Shift kept a move horizontal; the
  dining table and TV stand moved together as one undo step; Alt moved the floor line's path without snapping;
  Escape left the text unchanged; Alt+click still taps the card.
- With the Taksony flat (103 items): a drag frame took 9 ms (median; the first, gathering the snap targets, 42 ms);
  a moved shelf changed its three lines only, undo gave the text back byte for byte; the turned coffee table's
  handles followed its 45°. No console errors.

Left open: rearranging the example's living room by hand with a real mouse (the drags here were synthetic pointer
events, which can't be captured, so `setPointerCapture` is guarded); snapping to other items is strong in a small
window, Alt is the way out. Room rectangles are resized one by one, not as a whole room.
