# Step 8: a toolbar, a details panel, and the keyboard on HA's preview

Part of [the editor in Home Assistant plan](00-plan.md). Asked for by the user on 2026-10-05, after trying the editor
in HA. Builds on [step 7](07-groups.md) (the group settings need groups).

## Context

In HA the editor edits on HA's own preview of the card (step 5), and its column holds the rest: the Build/Edit
switch, a row of step buttons with their options, the Build panel (help, catalogue, devices), and tabs for the
items, the properties and the YAML.

- In HA's large mode the preview column is wide, but HA keeps the card to 500 px; the card widened itself to fill it
  (step 5). The user prefers the 500 px, and the room beside it used for the tools.
- The steps and their options are a lot of text above the plan; the panel mixes help, catalogues and the selection.
- HA's dashboard already offers the card's code editor ("Show code editor"), so the YAML tab repeats it there.
- Keys on HA's preview are still unreliable (the user, 2026-10-04 and 2026-10-05).

## Approach

**A toolbar of icons**, the view's tools only. In Build: Select, Rooms, Openings, Furniture, Entities (lamps and
devices). Edit's tools in the same bar. North leaves the tools for the home's settings (below).

- **Where it goes:** next to the plan it edits (on HA's preview, inside our card's editing layer; otherwise by the
  editor's own stage). When there's room beside the plan (HA's 500 px card with the column wider than the card and the
  bar), it stands to the left of the plan as a column of icons, and the card moves right by its width (the card's own
  margin, nothing of HA's changed). When there isn't, it's a row of icons above the plan. Followed as the column
  resizes (HA's large mode). Each icon has its name and key as a tooltip.
- **The card keeps HA's 500 px:** `_fitHosted`'s widening goes.

**The edit panel is for details** (the editor's column in HA, the right side standalone):

- **A group selected** (step 7): its settings. A lamp: which light it is (the light picker, moved here from the
  Build panel). A window or door: its kind, its width and height in metres (the cut resized around its middle; its
  opening's `lo`/`hi`). Furniture from the catalogue: which prefab (another one replaces it in place, turned the same)
  and its turn. A room: its name, outdoors or not, and its size. Delete.
- **An item selected** (inside a group, or in Edit): the properties form as now.
- **Nothing selected** (the user's choice): the tool's choices. Rooms: the new room's name, outdoors. Openings: the
  kind and width. Furniture: the catalogue. Entities: the search and the devices. Select: the home's settings (north,
  and *Find them* for a home not made in Build) and a line of help. Placing something selects it, so the panel then
  shows its settings; Esc (or a click on empty space) brings the choices back with the same one chosen, and
  Shift+click goes on placing it.
- The help texts get shorter: one line per tool, the rest in its tooltip.

**HA's shell has no YAML tab** (in either view): its tabs are Items and Details. The standalone editor keeps its YAML.

**The keyboard on HA's preview:** first found in HA itself, as the drags were (trusted input through the browser, the
user signed in): which keys get lost or reach HA, and when (after a click on the plan, on the toolbar, on a choice in
the panel, after a placement, after the room name field, after HA rebuilds the preview). Then fixed at the cause. What
is wanted: once the plan or the toolbar was used last, the editor's keys work (Delete, the arrows, R, Esc, Ctrl+Z,
Ctrl+D, Tab, Enter) and don't reach HA; typing in a field types; Esc with nothing to cancel closes HA's dialog.

## Steps

1. The toolbar: icons (mdi paths inline, as `ha-icon` isn't there standalone), its two placements, in the layer on
   HA's preview and by the stage; the card at 500 px, moved right when the bar stands beside it.
2. The details panel: group settings (lamp, opening, prefab, room), item properties, the tool's choices with nothing
   selected, the home's settings (north) under Select; the Build panel above the plan goes.
3. HA's tabs without YAML.
4. The keyboard on HA's preview: reproduced in HA, fixed, checked there.
5. The README's editor section and the CHANGELOG.

## Verification

- In Chrome on `tools/editor/ha.html` (an isolated context): the toolbar beside the plan at 1400 px, above it at
  1000 px, following a resize; every tool from it; the panel through nothing selected → a placement → its settings →
  Esc; an opening's width and height, a prefab swapped, a lamp's light changed from the panel; no YAML tab.
- The standalone page: the toolbar by its stage, the YAML tab still there; `ref.html` renders as before.
- In HA on the test dashboard, with the user: the card at 500 px with the bar beside it in large mode, above it in the
  normal dialog; the keys listed above, after each of the interactions listed above.
