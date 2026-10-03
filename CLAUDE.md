# Lightwell

A Home Assistant dashboard card (`custom:lightwell-card`) that draws a home to scale and lights it live: lamps in
their colours, the sun and daylight through the windows, furniture shadows, blinds, markers. Public, installed through
HACS. The README describes it for users; read it first.

## Layout

- `src/`: the card, plain ES modules. `home.js` describes and checks a home (`defineHome`); `card.js` is the custom
  element; `sun.js`, `effects.js`, `markers.js`, `openings.js`, `furniture.js`, `shapes.js`, `geometry.js` are pure
  and tested (`*.test.js` next to them). `index.js` registers `lightwell-card`.
- `src/editor/`: the editor for homes (`<lightwell-editor>`, bundled on its own into `dist/lightwell-editor.js`, so the
  card's bundle doesn't grow): `model.js` keeps the home as a `yaml` Document (comments survive edits), `controls.js`
  the simulator's controls (also built into `tools/simulator/controls.js` for the simulator), `files.js` opening and
  saving. The page is `tools/editor/index.html`. Plan: `docs/plans/2026-10-03-home-editor/`.
- `dist/lightwell-card.js`: the bundle, built by `npm run build` and committed (HACS installs it from the repo). Never
  edit it by hand; rebuild and commit it with the source change.
- `example/`: the example homes (YAML, plus the `home.js` the build makes for the tools) and made-up states.
- `tools/editor/`: the editor's page. `tools/simulator/`: the simulator, the bench, the reference page, the capture
  page, `home-tool.mjs`, `snapshot.sh`.
- `docs/`: the logo and the README's pictures; `docs/plans/`: the plans.

## Working on it

- `npm install`, then `npm test` and `npm run build`. Node only; no framework.
- **The engine knows no particular home.** Nothing about anyone's flat (room names, coordinates, entity ids) goes in
  `src/`; everything comes from the home object. The example homes are the place for examples.
- **Looks:** before a change that could alter how the card looks, screenshot `tools/simulator/ref.html` (1224 px wide,
  full page) with the current build, and compare after with `node tools/simulator/pngdiff.cjs a.png b.png`. Say what
  differs and why.
- **Cost:** HA sets `hass` on every state change in the whole house. The card must do nothing unless one of its own
  entities changed, write to the DOM only through `attr`/`css`/`text` in `card.js` (which skip unchanged values), and
  play effects with its single timer, never CSS or Web Animations. `bench.html` with `trace-report.cjs` measures it.
- **Scale:** blur radii scale with `units_per_metre` / 175, strokes and text with the view's width / 1145 (`--k`): the
  numbers were tuned on a drawing of that size. New sizes follow the same rule.
- A new field in a home: document it in `home.js` (or the module that reads it), check it in `defineHome` with a test
  for its error, and describe it in the README.
- The README's pictures: `capture.html` in Chrome at 1980 px wide, a full-page screenshot, then `scripts/pictures.sh`.
