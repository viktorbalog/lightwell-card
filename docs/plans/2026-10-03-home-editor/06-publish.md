# Step 6: publishing

Part of [the home editor plan](00-plan.md). Each outward step waits for the user's go-ahead.

## Steps

1. A GitHub Pages workflow publishing the editor (and the simulator) with the example, at
   `viktorbalog.github.io/lightwell-card/editor/`; the user turns Pages on in the repository's settings.
2. The README: an "Editor" section near the top (start from a picture, draw, save, use with `home_url`), with a short
   GIF made the way the others are.
3. A live connection to Home Assistant, optional: the page sends the user to their HA's login and gets a token back
   (HA's own auth flow, as `home-assistant-js-websocket` does), so the pickers list every entity and the preview shows
   the real states. Nothing is pasted into the page, and nothing is stored but HA's own refresh token in the browser.
4. Decide with the user whether to build the HA visual card editor (`getConfigElement`) on the same element, for
   inline homes.
5. A release with the editor, and a CHANGELOG (the repository has none yet).

## Verification

- The hosted editor opens the example and a dropped picture, and saves, in Chrome and Firefox.
- The live connection works against the user's HA, and logging out ends it.

## Outcome

In progress (2026-10-04): steps 1 and 2 are prepared for the user's review; nothing is pushed and Pages isn't on.

- **The site:** `scripts/site.sh <dir>` builds it: the editor, the simulator (its main page), the card's and the
  editor's bundles and the example homes, in the repository's own layout, since the pages and the background
  example's YAML reach their files by paths relative to `tools/…` (`../../dist/`, `../../example/background/plan.png`).
  `editor/`, `simulator/` and the root forward there (query and fragment kept), so the addresses are the plan's
  (`…/lightwell-card/editor/`). Never a snapshot (`tools/simulator/states.js`). 556 kB.
- **The workflow:** `.github/workflows/pages.yml`, on pushes to main touching what the site holds (and by hand): tests,
  a build checked against the committed `dist/` (as Validate does), the site, then GitHub's Pages actions. It needs
  Pages turned on with GitHub Actions as the source.
- **Scripts by path only:** the tools took `?states=`, `?home=` and `?card=` as any script URL; on a public site a
  crafted link would have run another site's script on this one (where the editor keeps drafts, and later perhaps a
  Home Assistant login). `tool.js` and the editor's page now take a path only (no scheme, no `//`, no quotes), which
  every local use is (`states.js`, `../../../floorplan/x.js`, `/Users/…`).
- **The README:** "The editor" after "Use it": a link to the hosted editor, a screenshot (`docs/editor.png`, the
  example with its living room lamp selected, from the site served locally), and the way through: start over a
  picture and set the scale, trace, adjust, save, use with `home_url`; your own entities through a snapshot. "Use it"
  points to it; the Tools section lists the editor and the online pages, and says how scripts are taken. A still
  rather than the plan's GIF, for now.
- Checked: the site served by nginx under `/lightwell-card/` (as Pages will): every address 200; `editor/?states=
  https://…#a` forwarded with its query and fragment, the foreign script refused (the example's states loaded
  instead); the background example's picture loaded by its relative path; the MDI list from the CDN; the simulator
  drew its cards. The one 404 was the browser's `/favicon.ico`: the editor's page now has the logo as its icon.

