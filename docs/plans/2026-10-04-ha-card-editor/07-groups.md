# Step 7: Build's objects as groups

Part of [the editor in Home Assistant plan](00-plan.md). Asked for by the user on 2026-10-05, after trying the Build
view in HA.

## Context

In the Build view an object made there (a room, a window or door, a lamp: its parts tagged with one `part`) is
selected as one, but it doesn't behave like the editor's other group, a piece of furniture with its insides:

- What a click picks depends on the step in use (`_buildGrab`): Rooms picks rooms, Furniture pieces, and so on.
- A drag moves a lamp's parts, but slides a window along its wall, and refuses a room ("rooms stay where they are").
- There's no way into an object: its parts are only reached in the Edit view.
- A piece from the catalogue has no `part`: a table's chairs are pieces of their own, and nothing records which
  prefab it was.
- A lamp from the catalogue, switched on, shows on its marker, but its pool stays dark (the user, 2026-10-05).

## Approach

**A group is one item until it's entered**, as a piece of furniture is with its insides:

- **A click** selects the whole group. Clicking again where everything is the same steps to what's under it, as now.
  (The steps keep picking their own kind first, `_buildGrab`, so that Windows and doors still picks a window over the
  room around it; step 8's toolbar revisits the tools.)
- **A drag** moves the whole group. What it's in follows where it lands: a lamp's `clip` and its pool's shadows (the
  pieces with a height in its new room), a piece's `shadow_room`, a marker with it. A window or door still slides
  along its wall (it can't leave it); a cut's ends are still dragged to resize it.
- **A room** moves too (the user's choice): its floor, its label, and the windows and doors in its own walls move
  with it; the walls it shared stay where the neighbour needs them (as `deleteOps` keeps them), and walls are made
  around it where it lands as for a newly drawn room (`roomWalls`, sharing, `iwall`). Furniture and lamps standing in
  it stay where they are. Snapped as a new room is (`snapRoom`). In `build.js`, pure and tested: `moveRoomOps(data,
  id, dx, dy)`.
- **A double-click** enters the group (or Enter, with it selected): the rest of the plan dims, the group's outline
  shows, and its parts are selected, moved and edited one by one, with the Edit view's handles, as inside a piece.
  Esc or a click outside leaves it, selecting the group again. Entering works the same in both views: one mechanism
  (`_inside` generalised from a piece's name to `{piece}` or `{part}`), so that the two can't drift. A room's name is
  still edited by a double-click on the name itself.
- **Prefabs are groups:** a piece from the catalogue gets a `part` named after its prefab (`sofa_3_1`, `table_4_1`
  with its chairs), so that the group knows which prefab it is (for step 8's settings: changing it replaces its
  pieces in place, keeping the turn). Turning a group (R, the turn handle) turns it around its middle, all its pieces
  with it.
- **The lamp's pool:** found and fixed; a test with a lamp from the catalogue switched on, its glow and pool lit.

In the Edit view nothing changes: items are picked one by one, `part` is ignored.

## Steps

1. Selection: a click selects the group under it.
2. Moving: groups move as one, with what they're in following (`regroupOps`: clip, pool shadows, `shadow_room`);
   cuts slide; `moveRoomOps` for rooms.
3. Entering: `_inside` generalised; double-click and Enter; dimming, Esc, a click outside; the hint and tools inside.
4. Prefabs tagged as groups (`part` from the prefab id); turning a group; `adoptOps` leaves prefab pieces alone.
5. The lamp's pool lit with its light.

## Verification

- Tests: `moveRoomOps` (a room alone; one sharing a wall, the neighbour's wall kept and the gap closed; with a window
  in its own wall, moved with it); `regroupOps` (a lamp moved into another room: its clip and shadows); prefabs placed
  with their `part`, each passing `defineHome`; a lamp prefab switched on lights its pool.
- In Chrome (an isolated context, `tools/editor/ha.html`): a click on a room, a window, a lamp and a dining table
  selects each as one; dragging each moves it as one (the lamp's room changes when it crosses a wall); a double-click
  enters each, a part is moved there, Esc leaves; undo through it; the same entering in the Edit view on a piece.
EOF

## Outcome

2026-10-05. `src/editor/build.js` (tested): `moveRoomOps` (the room's own walls deleted as `deleteOps` would, those
another room needs kept as its outer walls; the room, its floor and its label moved and snapped; walls made where it
lands, `wallOps`, with `iwall`s; the windows and doors in its own walls cut again there, their glass, opening and
shutter markers moved, keeping their `part`), `regroupOps` (a moved lamp's `clip`, and its pool's shadows reset to the
pieces in its new room; a moved piece's `shadow_room`, out of the old room's pools and into the new one's),
`lampEntityOps`, `applyOps` (the model's changes on plain data, checked against the model); `deleteOps` takes a
deleted group's pieces out of other lamps' shadows. `src/editor/prefabs.js`: a placed prefab's pieces are tagged with a
`part` named after it (`dining_4_1`).

In the editor (`src/editor/editor.js`), Build view: a drag moves a whole group (a lamp: its pool's centre isn't a
handle while it's whole), a room included (previewed as it goes, by the grid, Shift along an axis), then what moved
is regrouped; a double-click on a group enters it (`_group`, beside the piece's `_inside`, sharing its click, drag
and selection paths), the rest of the plan dimmed within the plan, its parts outlined, the hint naming it (a room's
name, the prefab's); there a click picks a part, a drag moves it alone, a double-click on a piece enters its insides;
Esc or a click outside leaves, selecting the group; Enter enters the selected group. A room's name is edited by a
double-click on the name itself. R turns a catalogue group round its middle (a table's chairs go round it). A lamp's
entity set in the form on its light or its marker is set on both (the user's "lamp issue": the marker's entity had
changed alone).

Checked in Chrome (`tools/editor/ha.html`, an isolated context, with HA's preview stand-in): a second room drawn,
clicked (selected whole), dragged 1 m away (the shared wall back to the first room's, outer; the kitchen walled
round); the lamp dragged into the kitchen (glow, pool and marker together; `clip` kitchen; its shadows the kitchen's
pieces); a dining table for 4 placed, turned with R (the chairs round it), moved into the kitchen (all `shadow_room`
kitchen, in the kitchen lamp's shadows), entered, a chair moved alone, Esc, Enter, Esc; a window clicked, slid,
entered, Ctrl+Z; a double-click on the sofa (no group) enters its insides, on the floor the room, on the sofa with the
room selected the room. 120 tests pass. Not tried in HA itself yet.

Found on the way: a double-click's "what was selected before" fell back to what its second click had stepped to when
nothing was selected before; it now goes by the selection before the clicks.

Changed after (2026-10-05, at the user's word): a moved lamp no longer has its shadows reset to its new room's pieces
(a round trip lost the ones the user had chosen); it keeps them, and only its `clip` follows. Moved pieces still join
their new room's lamps. See [step 8](08-layout.md).
