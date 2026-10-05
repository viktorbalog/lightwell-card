# Step 2: Build, rooms and walls

Part of [the editor in Home Assistant plan](00-plan.md).

## Steps

1. `src/editor/build.js` (pure): `roomWalls(data, rect)`: the walls a new room needs (each side not already walled
   gets one outside it, cut where walls are), `classifyWalls(data)` (rooms on both sides: `iwall`), `snapRoom(data,
   rect)` (a room near another's wall moves to its far side), `cutWall(data, point, width, kind)` (a window, a door or
   a doorway: the wall split, the glass, the opening).
2. The Build view: the steps bar (Rooms, Windows and doors, Furniture, Lamps and devices, North), each step's palette,
   the short form of the selected item; select and move as in Edit.
3. Rooms: drag to draw (sizes in metres), a name asked for (default: Room n), with floor, label and walls. Windows
   and doors: kind and width, a click on a wall, or a drag along it for its own width.
4. Sizes by dragging (asked for by the user while this was built): the end of any gap in the walls (a window, a door,
   a doorway; found from the walls, so hand-drawn ones too: `gapsOf`) is dragged along its wall, and the wall pieces,
   the glass, the opening and a doorway's floor follow (`resizeGapOps`), with a live preview and the width shown.

## Verification

- Tests: one room; two side by side (one shared wall, an `iwall`); an L of three; a room over an existing wall; a
  window, an outer door and a doorway cut; each result passes `defineHome`.
- In Chrome: two rooms, a window, a door between them, undo through it.

## Outcome

2026-10-04. `src/editor/build.js` (tested): `roomKey`, `snapRoom`, `roomWalls`, `roomOps` (floor, label and walls,
tagged with the room's key; shared outer walls with a room indoors on the other side become `iwall`; rooms outdoors
get a `terrace` floor, in the palette, and no walls), `cutOps` (window, glass door, door; a span by click or drag;
the filler tagged `window_1`…; a doorway or a door outside gets a floor), `gapsOf`, `gapEndAt`, `gapRange`,
`resizeGapOps`, `slideOps`, `partOf`, `partsOf`, `partKey`, `gapOf`, `deleteOps` (a cut's hole closed; a room's
walls kept where another room needs them, its doorways closed). In the editor: the Rooms and Windows and doors
steps, the cut previewed under the pointer, a gap's end grabbed (resize cursor) and dragged with a live preview,
objects picked, slid and deleted as one. Checked in Chrome, from an empty home: two rooms, a terrace, windows, a glass
door, a doorway, resized, slid, deleted, a room deleted.

Left open: windows in homes not made in Build (the example, the user's flat) have no `part`, so Build's Windows and
doors doesn't pick them; they're edited in the Edit view.

Then, at the user's word (2026-10-04): **adopting a home not made in Build** (`adoptOps`, tested): a light and its
entity's marker are a lamp; an opening a window, glass door or door, with the glass in its span and its shutter's
marker; a room its name (a room label, to the smallest room around it) and a floor of exactly its shape; walls stay
untagged (in hand-drawn homes they run past several rooms). The Build panel offers it ("Find them") while there's
something to adopt; Windows and doors picks an adopted window or door (an opening or glass) even without a gap of its
own, but doesn't slide it (a window and a door side by side share one gap). The user's flat
(`floorplan/taksony.yaml` in the homeassistant repo) was adopted through the model (comments kept, nothing but `part`
added: 34 tags, 9 lamps, 2 windows and 2 doors with their shutters, 5 names, the bathroom's floor) and deployed;
checked in the editor: a window, the living room and a lamp are each picked as one.

Since (2026-10-05, [step 8](08-layout.md)): windows and doors side by side in one gap (rows: `runOf` and the functions
around it) are slid, resized by their ends and the boundary they share, split and deleted in Build, so the flat's
balcony pairs (a window and a door in one gap) no longer need the Edit view.
