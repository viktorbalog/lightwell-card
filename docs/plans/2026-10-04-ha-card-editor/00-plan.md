# Lightwell: the editor inside Home Assistant

Written 2026-10-04 at the user's request, as a plan of its own: step 6 of [the home editor plan](../2026-10-03-home-editor/00-plan.md)
was to decide whether to build it, and this is that decision's plan. Nothing is built yet.

## Goal

Editing a home where the card is: in Home Assistant's card editor (the dashboard's "Edit card"), with the same tools,
forms and preview as the standalone editor, the card's entities and live states coming from Home Assistant itself, and
the result saved with the dashboard.

## Context

- **The standalone editor** (`src/editor/`, `<lightwell-editor>`, bundled on its own into `dist/lightwell-editor.js`,
  about 390 kB with the `yaml` library) does everything on a home: drawing, moving, the forms from `src/schema.js`, the
  pickers, the simulator's controls, opening and saving files, a live connection through HA's login. It's published on
  GitHub Pages and works from the files.
- **The card has no visual editor:** `src/card.js` has no `getConfigElement` or `getStubConfig`, so HA offers only
  the YAML code editor for it, and its card picker adds an empty card that fails ("The card needs a home").
- **A card's config is the dashboard's:** with `home:` the home is in the card's config, which HA keeps (as JSON in
  `.storage` for dashboards edited in the UI): comments don't survive there anyway. With `home_url:` the home is a file
  under `/config/www/`, which the frontend can't write. The user's own dashboard uses `home_url:
  /local/floorplan/taksony.json`, deployed from the `homeassistant` repo.
- **HACS installs one file:** `hacs.json` names `lightwell-card.js`, so a second bundle in `dist/` isn't installed
  next to it (to be confirmed: what HACS downloads with and without `filename`, and whether release assets count).
- **HA's card editor dialog** is narrow (about 500–900 px, larger in "large" mode on recent versions), and it gives
  the config element `hass` and its config, and listens for `config-changed`.

## Approach

### The element

- **`<lightwell-editor>` gets an embedded mode,** used by the card's config element: no file buttons, no login (HA's
  `hass` gives the states and the location), the home in and out as an object (`value` and a `change` event) instead
  of a file, and a compact layout for a narrow dialog (the plan on top, the list and the properties in tabs below it,
  the YAML tab kept). The standalone editor stays as it is.
- **The config element** (`lightwell-card-editor`, in the editor's bundle): HA's `setConfig(config)` sets the home
  (`config.home`), every edit fires `config-changed` with `{...config, home}`, and `hass` feeds the pickers and the
  preview's states. The preview's taps still don't call HA.
- **The card** gets `static getConfigElement()`, which loads the editor's bundle on demand (the card's own bundle
  stays as small as it is: the editor isn't in it) and returns the element, and `static getStubConfig()`, a small home
  that works (one room, a lamp, a marker for a light the user has), so a new card from the picker shows something.

### Loading the editor's bundle

Options, to be settled in step 1 by trying them in HA:

1. **Next to the card:** the release attaches `lightwell-editor.js` too, and the card loads it from its own address
   (`/hacsfiles/lightwell-card/lightwell-editor.js`), if HACS installs it (without `filename`, or as a second asset).
   Works offline. Preferred.
2. **From the CDN** for the card's own version (`cdn.jsdelivr.net/gh/viktorbalog/lightwell-card@v<version>/dist/…`):
   needs the internet while editing, and the version tag to exist.
3. **In the card's bundle,** behind a lazily run function: no second file, but every dashboard downloads ~390 kB
   more. Decided against unless 1 and 2 both fail.

### Homes kept in a file (`home_url`)

The config element can't save to `/config/www/`. Options (open question 1):

- **Offer to move it into the card:** "Edit here" turns `home_url` into `home:` (the file's content), after which the
  dashboard keeps it; the file stays as it was.
- **Read-only here, edit in the standalone editor:** the element shows the home with a link to the hosted editor
  (connected to this HA) and the steps to save the file back.
- Both: the choice shown in the dialog.

### Decided against

- Writing `/config/www/` files from the frontend (no API for it; an add-on or integration would be needed, which the
  first plan already decided against).
- A second, simpler editor for HA: the same element, embedded, so the two can't drift.

## Steps

1. **Packaging:** find what HACS installs for this repo (with `filename`, without it, with release assets); choose how
   the editor's bundle is loaded; the release workflow attaches what's needed.
2. **Embedded mode** for `<lightwell-editor>`: value in and out, no files or login, `hass` as the states and the
   location, the compact layout.
3. **The config element and the card's hooks:** `getConfigElement`, `getStubConfig`, `config-changed`, the stub home.
4. **`home_url` homes,** as decided (open question 1).
5. **The README and the CHANGELOG:** the editor in HA, and its limits.

## Verification

- Unit tests: the stub home passes `defineHome`; the embedded mode's value in and out keeps the home (round trip).
- `dist/lightwell-card.js` grows by the loader only (a few hundred bytes), checked by size; the reference screenshots
  match.
- In Home Assistant (a test dashboard on the user's HA, with a development build loaded as a resource next to the HACS
  one, or a released beta): add the card from the picker (the stub shows), open "Edit card", draw a room and a lamp,
  pick a real light, save, reload: the dashboard keeps the home; the YAML editor shows it; a `home_url` card behaves
  as decided.
- In the narrow dialog on a phone-sized window: the plan, the list and the properties are all reachable.

## Open questions for the user

1. **`home_url` homes:** move into the card, read-only with a link to the standalone editor, or both?
2. **A beta to test with:** a pre-release (HACS can install betas) or a development build loaded by hand on a test
   dashboard?
3. **Your own flat:** keep it as `home_url` (deployed from the `homeassistant` repo, with its comments in YAML), and
   use the editor in HA only for new homes and others' use?
