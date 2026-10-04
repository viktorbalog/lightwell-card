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
- Published 2026-10-04: the user turned Pages on (GitHub Actions as its source); the push of the editor's commits ran
  Validate and Pages successfully, and https://viktorbalog.github.io/lightwell-card/editor/ is live. Every address
  answers 200 there, and no snapshot is published (`tools/simulator/states.js` is a 404).

Then, the same day, at the user's go-ahead:

- **The live connection** (`src/editor/live.js`, its pure helpers tested): a Home Assistant button in the header opens
  a dialog for HA's address (it says when the page can't reach it: an https page and an http HA, or the editor opened
  from the files); "Sign in…" goes to HA's own `/auth/authorize` with the page as the app (`client_id` and
  `redirect_uri` the page's address), and back on the page the code is swapped for tokens at `/auth/token`. The
  connection is HA's websocket API: `get_states`, `get_config` (the location, for the sun) and `state_changed`
  events, passed to the simulator's controls (new: `setLocation`) at most every 250 ms; it reconnects after a drop and
  refreshes the access token before it runs out. It only reads: taps on the preview act in the editor alone. The
  tokens are kept in the browser until Disconnect, which revokes them in HA (`/auth/revoke`) and forgets them. The
  README's editor section says how to connect, and that the hosted editor needs HA's https address.
- Checked: against the user's HA (2024.12.5) from Node, the websocket part signed in with the box's token, got 249
  states, kept getting changes, and the location; HA answers `/auth/token`, `/auth/revoke` and their preflight with the
  Pages origin allowed, and accepts both the hosted and a local server's address as the app. In Chrome, with the site
  served locally (nginx, http) and HA through the LAN relay: the dialog's "Sign in…" reached HA's login page, naming the
  editor's address as the app; the login itself needs the user's password and wasn't done. With the box's long-lived
  token put in an isolated tab's storage as if signed in (no refresh token, so that Disconnect couldn't revoke it):
  connected (the header said so), 251 entities in the card and the pickers, the sun at the home's location;
  Disconnect forgot the tokens and went back to the example's states. No console errors. The test token was in a
  served file for a few seconds and in the isolated tab only; both are gone. Writing the tests caught `ftp://x` being
  taken as an http address.
- **The HA visual card editor** moved to [a plan of its own](../2026-10-04-ha-card-editor/00-plan.md), at the user's
  wish.
- **The CHANGELOG** (`CHANGELOG.md`, Keep a Changelog): 0.1.0 and everything since under Unreleased; from now on every
  user-visible change goes there (CLAUDE.md says so).

The user then signed in through HA's login page with their local Home Assistant, and it worked (2026-10-04).

**The release** (2026-10-04, at the user's word): 0.2.0 in `package.json` and its lock, the bundles rebuilt (the card's
differs from 0.1.0 in its banner only: the card is unchanged), the CHANGELOG's Unreleased became 0.2.0, the commit and
the tag `v0.2.0` (a plain tag, as `v0.1.0`) pushed. Publishing the GitHub release from the tag is the user's (no
GitHub CLI or token in the box); the Release workflow then attaches `lightwell-card.js`, and HACS offers the update.
