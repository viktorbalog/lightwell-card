# Step 1: shells and views

Part of [the editor in Home Assistant plan](00-plan.md).

## Steps

1. Colour tokens: the editor's styles take their colours from custom properties (`--lw-bg`, `--lw-panel`,
   `--lw-text`, `--lw-muted`, `--lw-line`, `--lw-accent`, …) with today's values as defaults, and a dark set.
2. `shell` (`standalone` or `ha`, an attribute set before it's connected): the HA shell has no file buttons, no
   Home Assistant button, no drafts in the browser's storage, no dropped files; its header is its own (the views,
   undo and redo, grid, dark).
3. `view` (`edit` or `build`): an attribute the CSS and the toolbar follow; `setView(view)`; Edit is today's editor.
4. The value: `value` (the home as plain data) in, a `value-changed` event out for every edit that leaves a home
   without mistakes. Setting a value equal to the current one does nothing (HA hands the config back after each
   change), another one is a step in the history.
5. `hass`: its states (at most every 250 ms) and its location feed the controls and the pickers; its theme's
   darkness is the preview's at first.
6. Keys: in the HA shell, only those reaching the editor (its focus), and those it uses don't go on to HA (Esc closes
   the dialog only when the editor has nothing to cancel).

## Verification

- Tests: the value round trip (a home in, the same out; comments of the session's YAML aside).
- In Chrome: the standalone editor looks and works as before (screenshot compared); the HA shell on a test page with a
  made-up `hass`, in light and dark.

## Outcome

2026-10-04. `src/editor/editor.js`: the styles' colours are tokens (`--lw-*`, today's values by default; the HA shell
maps them to HA's theme variables). `shell="ha"`: no file buttons, drafts, dropped files or sign-in; `value` in (a step
in the history, nothing when it's the same) and `value-changed` out after each edit without mistakes; `hass` (states at
most every 250 ms, the location, the theme's darkness for the preview at first); keys only from inside, stopped before
HA unless it's an Esc the editor had no use for. `view` (`edit`, `build`), with Build/Edit buttons in the header of
both shells. Its layout in HA: the plan on top, the list and the properties side by side, stacked under 620 px
(a container query). Tests: the value's round trip (both example homes, with a description). Checked in Chrome on
`tools/editor/ha.html` (light, dark, 480–900 px) and the standalone page (unchanged).

Found on the way: the item list scrolled its selected item into view with `scrollIntoView`, which scrolls the page
(or HA's dialog) too; it scrolls the list alone now, and a form field gets its focus back without scrolling.

Left open: the preview follows HA's dark theme when the editor opens, not when the theme changes while it's open.
