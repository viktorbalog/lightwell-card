# Changelog

What changed in Lightwell, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/), and the
versions [Semantic Versioning](https://semver.org/). Changes not released yet are under Unreleased.

## Unreleased

### Added

- **The editor** ([online](https://viktorbalog.github.io/lightwell-card/editor/), or `tools/editor/index.html`): a home
  described without writing YAML by hand, with the card lighting it as you go, under any sun, in light or dark.
  - Start from the example, an empty home, or a picture of your plan, whose scale is set by measuring a known length
    on it. The picture can stay as the card's background.
  - Tools for walls, rooms, windows and doors (their wall's side and thickness found from the drawing), furniture,
    lamps, markers and labels, with snapping to the other items and to a 5 cm grid, and lengths in metres.
  - Select, move, resize, turn and reshape on the plan; several items at once; arrows nudge; duplicate and delete.
  - Every field in a form, with your entities by name and state, icons by search, a marker's label with the text it
    shows now, and the effects as colours and holds with a preview on a lamp.
  - Connect to your Home Assistant through its own login page for your entities, their live states and your
    location. It only reads, and Disconnect revokes its access.
  - The YAML itself, editable, with its comments kept; saves YAML or JSON (for `home_url`), back to the same file in
    Chrome and Edge; undo and redo; the work in progress kept in the browser.
- The editor and the simulator are published on GitHub Pages.
- `snapshot.sh --all` saves every entity in Home Assistant, for the editor's pickers.

### Changed

- The tool pages load `?states=`, `?home=` and `?card=` scripts by path only, never from another site, so a link to
  the published pages can't run someone else's code.

### Fixed

- Tapping a light in the tools when the states in use don't have it (a home's own lights with the example's states)
  no longer fails.

## 0.1.0 (2026-10-03)

The first release.

### Added

- `custom:lightwell-card`: a home drawn to scale from a plain description (YAML in the card, or a JSON file through
  `home_url`), checked with one message per mistake.
- Lights glow in their entity's colour and brightness, kept in their room, with a pool of light on the floor and the
  furniture's shadows away from the lamp.
- Effects: a home's own colour flows, a TV's flicker, a pulse for any other.
- The sun through each window and door from `sun.sun`, cut short by the blinds, softened by clouds and trees, with the
  furniture's and the surroundings' shadows; daylight through the glass, and the floors tinted for the time of day.
- Markers for devices: tap toggles, wakes a device that's off, or opens its details; labels from a state or attribute.
- Light and dark themes; a palette of its own per home.
- The simulator, the bench, the reference and capture pages, and `snapshot.sh`, in `tools/simulator/`.
- Installs through HACS.
