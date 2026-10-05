# Step 4: Build, lamps, devices and north

Part of [the editor in Home Assistant plan](00-plan.md).

## Steps

1. The entity palette: lights, covers, media players, climate, sensors and binary sensors… in the states in use,
   searchable, those placed ticked; drag onto the plan. A light: a lamp (`lightFrom`) with its entity and a marker
   (`tap: toggle`); anything else: a marker with its icon (from its domain and device class).
2. North: a dial; `sun.north` follows.
3. The standalone editor: New (empty, or over a picture) starts in Build; the view switch in its header.

## Verification

- Tests: a lamp and a marker from an entity pass `defineHome`; icons by domain.
- In Chrome: with a snapshot's states, a lamp and a sensor placed.

## Outcome

2026-10-04. `src/editor/devices.js` (tested): `devicesIn` (by domain, searchable), `iconOf` (its own, its device class,
a sensor's unit, its domain), `placedIn`, `placeDevice` (a light: `lightFrom` with the entity and a toggling marker,
both `lamp_1`; a cover dropped within 30 cm of an opening: its `shutter`, and a marker; a sensor: its value and unit
as the label). North: a number, or a click in its direction from the view's middle, with an arrow on the plan. New →
Empty starts in Build's Rooms; a home over a picture still starts in Edit (the scale tool is there). Checked in Chrome
with the example's states.
