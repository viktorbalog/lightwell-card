# Lightwell: editing the insides of furniture

Written 2026-10-04 at the user's request. Follows [the home editor plan](../2026-10-03-home-editor/00-plan.md), whose
editor can't edit them yet. Nothing is built yet.

## Goal

The shapes drawn with a piece of furniture (its `extra`: a sofa's cushions, the devices on a shelf, a bed's line, a
monitor on a desk) selected, moved, resized and drawn on the plan like everything else, in the piece's own frame,
turned with it.

## Context

- **What they are** (`src/furniture.js`): a piece's `extra` is a list of shapes (`shapes.js`: rect, circle, ellipse,
  poly, path, text, with `class` and other SVG attributes), drawn with the piece in its own frame: when the piece is
  turned (`shape.turn`), the card wraps the outline and the extras in one `rotate(turn cx cy)` around the piece's
  rectangle's centre. They cast no shadows; only the piece's outline does.
- **In use:** the example has 4 pieces with insides (the sofa's cushion, the TV on its stand, the wardrobe's line, the
  bed's pillows), the Taksony flat 11 (the desk's monitor, the bed's pillows and line, the TV, the shelf's devices, the
  couch's cushions…).
- **What the editor does with them now:** moving a piece moves its extras (`moveItem`), and they're copied with it;
  nothing else. Hit testing (`hit.js`) sees only the piece's outline, the list shows only the piece, there are no
  handles for them, and the properties show `extra` as one YAML text box. Resizing a piece leaves them where they
  were. A check's message about one (`furniture.sofa.extra[0]…`) selects the piece.
- **What exists to build on:** shapes under an SVG `transform` already work in the editor's geometry (`parseTransform`,
  `applyTransform`, `invertTransform` in `hit.js`; handles mapped through it and the pointer mapped back in
  `manipulate.js`), which is exactly what a turned piece's frame is. The shape form (`panels.js`, `shapeForm`) edits
  any shape. Paths deeper than an item's (`['furniture', 'sofa', 'extra', 0]`) already work with `itemAt`, `fieldAt`
  and the model.

## Approach

- **Entering a piece:** double-click a piece (or Enter with it selected) to edit its insides, as groups are entered
  in drawing programs: the piece stays outlined, the rest of the plan is dimmed in the overlay, clicks select its
  extras (frontmost first), and Esc (or a click outside it) leaves. Outside a piece, clicks still select whole pieces,
  so moving furniture doesn't change. Double-click, as the user chose (2026-10-04): a single click on a selected piece
  keeps stepping through what's under the pointer. Decided against: making extras selectable everywhere (a click on a
  sofa would pick a cushion instead of the sofa).
- **One frame for everything:** an extra's geometry in the drawing is its own shape under the piece's turn, written as
  the transform `rotate(turn cx cy)` composed with the extra's own `transform`, so hit testing, outlines, anchors and
  handles reuse the transform support as it is. Dragging maps the pointer's movement back into the piece's frame (so
  on a sofa turned 90° a cushion follows the pointer, not its unturned axes); arrows nudge along the drawing's axes,
  mapped the same way.
- **Kinds of item:** `kindOf` gets a kind for `['furniture', name, 'extra', i]` (a shape in a piece's frame), with its
  own move, handles and drag, built on the shape ones.
- **Snapping inside:** to the piece's edges and centre lines and to its other extras (in the piece's frame for a turned
  piece: its corners and edges, mapped), then the grid.
- **The list and the properties:** a piece with insides unfolds in the list to show them (by kind and class, as the
  drawing's slots are listed); selecting one there enters the piece. The properties show an extra with the shape form;
  the piece's own form lists its insides as links (with a + to add one) instead of the YAML box. Reordering them in the
  list changes their drawing order.
- **Drawing insides:** while inside a piece, the drawing tools that make sense there draw into its `extra`: a
  rectangle (a cushion, a device), a circle, a line (a `path`, class `line`), a label (`text`, class `lbl`), each with
  the usual class for it (`furn2`, `dev`, `line`, `lbl`), in the piece's frame. The others (walls, rooms, openings,
  lights, markers) aren't offered there.
- **Resizing a piece:** its insides follow, scaled with it within the piece's frame (cushions stay on the sofa), as
  the user chose (2026-10-04); Alt while dragging leaves them where they are. A circle's radius scales by the smaller
  factor; a text moves but keeps its size. Moving a single corner of a polygon piece leaves them (no frame to scale).
- **Messages:** a check's message about an extra selects it (inside its piece).

## Steps

1. **Geometry:** an extra's geometry in the drawing (the piece's turn composed with its own transform), hit testing
   inside a piece, outlines, anchors, handles; moving and dragging in the piece's frame. Tests, with a turned piece.
2. **Entering a piece:** double-click and Enter in, Esc and a click outside out, the dimmed overlay, selecting and
   cycling through its extras, Delete, Ctrl+D, arrows; the messages' paths.
3. **The list and the properties:** a piece's insides in the list (unfolding, reorder), the extra's shape form, the
   piece's form listing its insides.
4. **Drawing insides:** the tools while inside a piece, with their classes and the piece's frame.
5. **Resizing a piece with its insides:** scaled with it, Alt to leave them.
6. **The CHANGELOG** (under Unreleased) and the README's editor section.

## Verification

- Unit tests: hit testing an extra of a turned piece (a point inside the turned cushion, and one inside it unturned
  but not turned); moving an extra of a piece turned 90° by a pointer drag (its x and y in the piece's frame); handles
  of a turned extra where the card draws them; scaling the insides with a resized piece; drawing a rectangle inside a
  turned piece (its coordinates in the frame); the model writing only the extra's numbers (comments kept).
- `dist/lightwell-card.js` is unchanged (the card isn't touched).
- In Chrome, in an isolated context: in the example, enter the sofa and move its cushion, resize the TV on its stand,
  draw a second cushion; turn the sofa 30° and move the cushion again (it follows the pointer); in the Taksony flat
  (a copy, not the user's tab), select the couch's cushions and the shelf's devices, and check the YAML changed only
  in those lines.

## Decided with the user

2026-10-04: resizing a piece scales its insides with it (Alt leaves them); a piece is entered by double-click.

## Outcome

2026-10-04, on the branch `feature/furniture-insides`.

- **Geometry** (`src/editor/hit.js`, `manipulate.js`): `isExtra`, `pieceTurn`, `drawnExtra` (an extra as drawn: the
  piece's turn, then its own transform), `onPiece`, `hitInside`, outlines of extras; `kindOf` gives `extra`, and
  `moveItem`, `anchors`, `handles`, `dragHandle`, `startHandle`, `removeCorner`, `snapsHandle` take the piece as
  `{piece}`. `insideTargets` (snapping in the piece's frame), `scaleShape`, and `dragHandle` scaling a piece's insides
  when its rectangle or circle is resized (`insides: false` leaves them). `movePath` now goes through a general
  `mapPath`.
- **The editor** (`editor.js`): double-click or Enter enters a piece, Esc or a click (or drag) outside leaves; the plan
  dims around it; clicks, Tab cycling, boxes, Delete, Ctrl+D, arrows and drags work on its shapes, snapped in its
  frame (guides and drafts drawn turned with it). The Furniture tool becomes Shapes (rectangle furn2, circle dev,
  line) and Label draws a `lbl` text; the other drawing tools are disabled inside. Messages about an extra select it.
  Alt while resizing a piece leaves its insides.
- **Panels** (`panels.js`): a piece with insides unfolds in the list (by itself while editing it), they reorder by
  dragging; an extra's title links back to its piece; the piece's form lists them as links, with + and Edit, instead
  of the YAML box.
- **Added at the user's request during the work:** the sun's spills and blockers as items (`['sun', 'spill', i]`,
  `['sun', 'blockers', i]`): hit behind the drawing (before the rooms), moved, with handles (a spill's rx and ry, a
  blocker's rect or corners), in the list ("Daylight spills", "Sun blockers") and as links in the home's sun form; a
  spill's `from` is picked from the openings by checkbox (schema type `opening`).
- **Also added at the user's request:** a path's points as handles (`manipulate.js`: `pathSegments`,
  `movePathPoint`; ids `pt:i`, control points `c:i:j`, drawn as small circles). A point keeps its path's form
  (absolute or relative; H and V move along their axis only), and the relative segment after it (and, for a
  subpath's start, the one after its Z) is made up for, so the rest stays put. Not done: removing or adding a path's
  points (double-click removes only a polygon's corners), and paths with `repeat` (no point handles).
- **Also added at the user's request:** a room's rectangles as items (`['rooms', name, i]`, kind `part` in
  `manipulate.js`, `partPoly` in `hit.js`): the room's form lists them as links with + (a rectangle next to the last
  one, as tall), the list unfolds a room of rectangles, a double-click in the selected room selects the rectangle
  under the pointer, and a rectangle has an x/y/w/h form, its outline and handles; deleting the last one is refused.
  A polygon room stays one part (its polygon in the form). A moved rectangle snaps to its room's other rectangles,
  not to where it started.
- CHANGELOG (Unreleased) and the README's editor section.

**Verified:** `npm test` (new: hits, outlines and anchors of a turned piece's extra; moving and resizing
one in its frame; a piece's insides scaled with it, turned too, and left with `insides: false`; snapping targets;
the model changing only the extra's line; spills and blockers; path points, absolute, relative, curves' control
points, a closed subpath, under a transform and on a turned piece; a room's rectangle on its own), 89 in all. In
Chrome: a rectangle added to the example's bedroom with +, its w changed in its form (only the room's line in the
YAML changed), deleted, the last one refused, and a double-click in the living room selecting its rectangle. In Chrome, the wardrobe's line reshaped by its
end (only its line in the YAML changed). `npm run build`: `dist/lightwell-card.js` unchanged
(same checksum); the editor's bundle rebuilt. In Chrome (an isolated context, the example): entered the sofa by
double-click, moved its cushion, left by a click outside; turned the sofa 30° and dragged the cushion along its own
axis (x moved by 10, y unchanged; snapped to the grid in its frame, guides turned); drew a circle on it; resized the
TV stand from its bottom (its device scaled from 410/140 to 412.5/175); added a spill with its form. No console errors
from the editor.

**Left open:** the Taksony flat wasn't tried in the browser (only the example); a click near a small extra's middle
can still grab one of its handles at low zoom, as for any small item.
