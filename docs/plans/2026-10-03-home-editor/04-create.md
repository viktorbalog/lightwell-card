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
