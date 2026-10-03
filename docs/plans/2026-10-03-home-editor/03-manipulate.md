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
