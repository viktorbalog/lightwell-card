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
