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

## Outcome

2026-10-05. In `src/editor/editor.js`:

- **The toolbar** (`.lw-tools`): stroked icons drawn inline (`ICONS`, `TOOLS`), the view's own (Build: Select,
  Rooms, Windows and doors, Furniture, Lamps and devices; Edit: its nine), names and keys as tooltips. `_placeTools`
  puts it beside the plan as a column when there's room (on HA's preview: HA's column wider than the card and the bar;
  the card moves right by the bar's width, keeping HA's 500 px), otherwise as a row above it (the card moves down);
  standalone, beside from a 500 px preview column. It goes into HA's preview with the editing layer. Its styles use
  HA's variables with fallbacks, as they live in the card's shadow root there. Step 5's widening (`_fitHosted`) is gone.
- **The details panel** (`_renderDetails`; the tab is *Details*): a Build object selected whole shows its settings
  (`_groupDetails`): a lamp its light (the picker moved there), a window or door its width (resized round its middle)
  and its opening's heights, a catalogue group which prefab it is (another replaces it in place, turned the same:
  `prefabOf` in `prefabs.js`, tested) and a Turn button, a room its name and size (`moveRoomOps` takes a new size: its
  right and bottom walls and their windows move with those sides; tested). With nothing selected, the tool's choices
  (`_toolDetails`): the room's name and outdoors, the cut's kind and width, the catalogue, the devices; Build's Select
  has the home's (north, typed or pointed at on the plan, and *Find them*). Otherwise the properties form as before. The
  Build panel above the plan and the North tool button are gone (pointing at north is the panel's button, the same tool
  as before). Choosing a tool clears the selection, so that its choices show; after placing something, Esc brings them
  back before it leaves the tool. In Build the Details tab opens first.
- **HA's shell:** no YAML tab (HA's *Show code editor* is there); the hint under the tools is one line, the rest in its
  tooltip. The standalone page keeps its YAML.
- **The keyboard on HA's preview**, found in HA itself with real key presses: every edit makes HA rebuild its preview
  card, and the layer, moved into the new card, lost the focus (before the new card is even in the page, and with a
  focusout when the old card lets go of it), so from the second key on, keys went to HA (and its shortcuts). The layer
  now remembers it had the keys (focusin/focusout, read before the old card lets go) and takes them back once it's in
  the new card. The room-name field gives them back to the plan on Enter or Esc. V selects in Build too. Arrows move a
  whole Build object as a drag does (a room with its walls made again, a window along its wall, then regrouped).

Checked:

- In HA (2024.12.5, the test dashboard, the editor opened by Edit card → Edit it here, never saved): with real keys,
  → → ↓ moved the TV's lamp each time and Ctrl+Z undid the last, all reaching the editor and none HA; after a real
  click on a toolbar button, Esc took the selection away and kept the dialog open; the kitchen's name edited on the
  plan (End, a character, Enter), then Esc reached the editor. The toolbar above the plan in the normal dialog, beside
  it in the large one (the card 480 px inside HA's 500).
- On `tools/editor/ha.html` (isolated context): every tool from the toolbar, in both views, with its details; a table
  for 4 swapped for a table for 6 in place; a window's width (1.6 m) and top (2.4 m); a room made 6 m wide, its window
  staying put; its name; the toolbar above at 1000 px, beside at 1400 px, the overlay aligned.
- The standalone page: the toolbar beside the plan, the YAML tab there. `src/card.js` didn't change in this step.
- 122 tests pass.

Left open: a window's kind (window, glass door, door) isn't changed from the panel (delete it and cut another), nor
whether a room is outdoors; the README's picture of the editor (`docs/editor.png`) shows the old tools.

Then, at the user's word (2026-10-05):

- **New in HA** (to start from scratch, for testing): the header's *New…* shows in HA's shell too, offering an empty
  home only (the example and a picture need the standalone page's files); there the new home is a step in the history
  (`_restart`), so Undo brings the card's home back. The start dialog takes the panel's colours (it was the browser's
  white in HA's dark theme).
- **The `home_url` notice:** its two ways on are blocks of their own, the button above what it does, instead of a button
  inside a sentence that ran on from it.
- **Back to the group:** inside a Build object, the details start with *‹ Back to …* (as Esc), to its settings.

Checked on `tools/editor/ha.html`: New → Empty (dark theme) made an empty home in Rooms and sent it to HA, Undo brought
the room back; inside a table for 4, *Back to Table for 4* showed its settings again; the notice in the light theme.
- **Several selected** (the user, the same day): the details list each of them, folded (`_multiDetails`): a Build
  object selected whole as one entry with its settings (and its own Delete and *Its parts*; its changes keep the rest
  selected), anything else with its properties form, built when unfolded. What's unfolded stays so through edits while
  it's selected. In Build, Shift+click adds or takes out a whole object (it had added only the part under the pointer).
  Checked on the test page: a table for 4, the lamp and the sofa, listed and unfolded; the table turned with the list
  staying as it was; the lamp taken out again with Shift+click.
- **Inside a group** (the user, the same day): the details list all its parts (`_memberDetails`), the selected ones
  unfolded and the rest folded; one unfolded by hand stays so, and a selected one folded by hand stays folded until the
  selection changes (`_folds`, shared with the list of several selected). Checked on the test page: inside a table for
  4 with a chair selected, that chair open; the table opened by hand stayed open when another chair was selected, which
  opened as the first folded; a field changed in the open form left the list as it was.
- **Groups in the Items list** (the user, the same day, for symmetry with the details): in the Build view the list
  leads with the home's objects by kind (Rooms, Windows and doors, Furniture, Lamps, Other things), each folding open
  to its parts; a click on one selects it whole (Shift: in or out), a click on a part goes inside it with that part
  selected; the items in no object follow under *Not in a group*, by slot as before. The Edit view's list is as it was
  (switching views redraws it now; it had kept the other view's). Checked on the test page: a room, a window, a table
  for 4 and a lamp listed, the sofa under *Not in a group*; the table selected whole from its line, a chair from its
  part's line (inside the table, the line marked); Edit's list by slot.
- **Windows and doors side by side** (the user, 2026-10-05: openings where one side isn't a wall, two-pane windows,
  balcony door and window pairs; also found in homes not made in Build, and resized by their ends): a gap in the walls
  holds a *row* (`runOf` in `build.js`: the cut objects whose glass, floor or opening lie in the gap, tiling it side by
  side within 2 cm, or one alone), each its own object, with boundaries between them. `boundaryAt`, `boundaryRange`
  and `moveBoundaryOps` drag an end (its wall piece follows) or a shared boundary (both follow); `slideOps` slides the
  row; `resizeCutOps` sets one's width round its middle; `splitCutOps` (*Split in two* in a window's details) makes
  two of one; `deleteOps` gives a deleted one's place back to the wall (the hole closes, the wall piece beside reaches
  over it, or a piece of wall goes between two others); `cutOps` and the preview snap a new cut against one within
  25 cm (`snapCut`); a moved room re-cuts each at its own span. Tested (five new tests: cut beside, boundaries, slide,
  resize, split, deletes, a moved room, a hand-drawn pair a unit off adopted and found). The user's flat: both balcony
  pairs (`window_1` + `door_1`, `window_2` + `door_2`, already tagged) are found as rows, and slide and resize to
  homes that pass `defineHome`. Checked on the test page: a glass door cut 15 cm from the stub's window met it (the
  preview too), their shared boundary dragged, the door's details naming the window beside it.
- **The panel overflowing** (the user, on lamp 3 of the flat, in HA): the light picker's longest option (a long
  device name) set its width, and HA's one column (`1fr`) grew to fit it: 545 px of panel in a 486 px editor, under
  the preview. The column is `minmax(0, 1fr)`, the sides may shrink, the picker takes the row's width. Checked in HA:
  lamp 3, the TV's lamp, a window and the living room each 484 px in the 486 px editor.
- **The example homes grouped** (the user, the same day): `example/home.yaml` redrawn as Build makes homes (each
  room's walls and floor, the wall between the rooms the bedroom's, the doorway with its floor), then adopted through
  the model (the lamps, the window and the glass door with their glass and shutters, the room names; all 39 comments
  kept); `example/background/home.yaml` adopted (its two windows and its lamp). In Build the example lists 3 rooms,
  3 windows and doors (each found in its gap) and 5 lamps, with nothing left to *Find*. `ref.html` against the
  build before: split pieces showed anti-aliased seams where they met (122 pixels over 16, in thin lines along the
  wall between the rooms); with the two rooms' floors overlapping under that wall, and the living room's top and
  bottom walls reaching 15 cm over the bedroom's, 44 pixels differ by more than 16 (max 35), all on the outer edge of
  the top and bottom walls where two pieces overlap. The README's pictures weren't made again.
- **The plan jumping on each change** (the user: arrows in HA animate the card): HA's new preview card showed for a
  frame without the toolbar's room (44 px higher with the toolbar above), as that room was measured only once the card
  was in the page. The editor keeps the room it gave the last card (`_toolRoom`) and gives it to the new one at once,
  measuring again once it's in the page (not before: it would measure nothing). The card's own fades were suspected
  first and ruled out (a rebuilt card sets its values before its first paint, so nothing fades; checked with and
  without them). Checked in HA, every frame for 3 s from real arrow presses: the card and the overlay never moved, in
  the normal dialog (toolbar above) and in the large one (beside), while the lamp moved with each key.
- **A steady panel** (the user, in HA: it jumps as it's edited): HA's panes are 420 px high (`flex: none`: as flex
  items their basis had overridden the height), scrolling inside; the details keep their scroll while they show the
  same selection and tool, and start at the top for another. Checked in HA: 446 px for a lamp, a room, a window and a
  piece's form; the form's scroll kept through an edit; at the top for another piece.
- **Alt+click switches a group's light** (the user): `_switchAt` finds what an Alt+click switches (a lamp, a Build
  object's lamp, or a marker of a light, switch, fan or media player), `_simulate` switches it: in the simulator
  standalone; on HA's preview through the card's new `simulated` states (laid over HA's own, set only by the editor,
  carried to each rebuilt card), nothing sent to the house, and a first-time note saying so. The card is unchanged
  without it (`ref.html` not affected: `simulated` is null there). Checked in HA: lamp 3 (really on) off on the preview
  and back, its real state on throughout and no service called; still off on the card HA rebuilt after an edit.
- **The overlay over the editor** (the user: things pulled off the plan, and a lamp's reach, showed over the
  config): the overlay draws beyond the plan (`overflow: visible`), and on HA's preview the editor's column is beside
  it. `_place` clips it to the frame it's in (the card's box on HA's preview, the stage standalone). Checked in HA:
  lamp 3's reach stops at the card's edge.
- **The glow round the card on each key** (the user): not a focus ring (nothing focused has one) but HA's `ha-card`,
  which has `transition: all 0.3s` and takes its theme a moment after it's made: on each rebuilt preview card its
  border ran from 3 px of the text colour down to 0 over 0.3 s. The card marks itself `editing` while it carries the
  editor's layer, and its `ha-card` has no transition then (on dashboards, as before). Checked in HA, every frame after
  a real key: 3 px → 0 over 0.3 s with the mark suppressed (in that tab), 0 px from the first frame with it.
- **A lamp's shadows after a round trip** (the user: the bedroom strip moved to the hall and back, and the bed cast
  shadows): `regroupOps` reset a moved lamp's shadows to every piece with a height in its new room, so the way back
  brought the bed in, which the user had left out (the flat's strip: desk, desk chair, wardrobe, dresser). A moved lamp
  now keeps its shadows (another room's pieces' don't show: its light stays in its room); a moved piece still joins
  its new room's lamps. Tested: to the hall and back, the same shadows.
- **The selection is what a drag moves** (the user: a rectangle added to a room was selected, but a drag on it moved
  the floor over it): a drag moved the selection only when it was among the hits, and a room's rectangle is hit as the
  room; in Build the object on top won before the selection was looked at. `_isUnder` (the selection among the hits,
  or a room's rectangle containing the point) now decides first: the selection moves (a Build object selected whole
  as one: a room with its walls, a window along its wall); otherwise what's on top, as before. Checked on the test
  page in both views: an added rectangle moved alone; a lamp dragged while a window was selected moved whole; a room
  selected whole moved as a room; the sofa dragged with nothing selected.
- **A room's rectangles picked one by one** (the user): in a room of several rectangles, `_hitsAt` gives the one under
  the pointer instead of the room (the room whole is its group in Build, and its line in the list); in Build outside
  the room, a click still selects the room as a group. Checked on the test page: in Edit, a click in an added
  rectangle selected it alone; in Build the room's group, and inside it the rectangle.
- **A name twice in the folded lists** (the user: inside a group, the room as the fold's header, then again as the
  form's heading): in a folded entry the form's heading loses its kind ("Rooms: "), and goes where it holds no name
  field; a room's or a piece's name field stays, as *Name* (the user missed it once it had gone with the heading).
  Renaming a room there showed that its Build parts kept the old key as their `part`, losing the room its group:
  `_rename` now carries a room's new key to its parts (and to the group being edited). Checked on the test page: the
  stub's room renamed inside its group, its floor, walls and label following, its lamp's room too.
- **The list's clicks in HA** (the user): a click in the Items list selects and stays on the list; a double-click (two
  clicks on the same line, counted by the editor, `_fromList`: the list is drawn again between them) opens the
  details. A selection on the plan still shows the details. Checked on the test page in both views.
- **The view switch on the right** (the user): Build/Edit at the right end of the header, in both shells (HA's tip
  stays a line of its own under it). (Before it, the home's sun settings were put in Build's details and taken out
  again, the user having meant something else: ab7935d, reverted by 774db8b.)
- **The hint under the panels** (the user): editing on HA's preview, the editor's own plan column holds only the
  tool's hint, so it goes under the tabs and their panel; without a preview (the editor's own plan) the order is as
  before.
- **A shaded panel** (the user: it looked odd): in HA the panels are a card of their own, tinted (the theme's text 4%
  over its card background) with a soft shadow, as the toolbar by the plan; the hint inside them and the messages
  below have room around them; the editor's own dark-preview background no longer shows behind the hint. Checked on
  the test page in light and dark.
