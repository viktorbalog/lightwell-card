# Step 5: entities

Part of [the home editor plan](00-plan.md).

## Steps

1. Entity pickers wherever a field takes an entity (lights, markers, shutters, the sun and weather), filtered by
   domain where it matters (covers for shutters), fed by the states in use: the example's, or a snapshot from
   `snapshot.sh` (which gets an option to save every entity, not only the home's, for the pickers).
2. The label builder: the marker's entity's real attributes to choose from, the rounding and unit, and the text it
   would show now.
3. Icons: a search over the Material Design Icons names (their list loaded from the same CDN the tools already use for
   the icons, when online; a plain text field otherwise).
4. Effects: a light's effect chosen from the home's effects and the presets; an effect's steps edited as colours and
   holds, previewed on the card.

## Verification

- In Chrome with a snapshot: add a marker for a sensor, build its label, and see the same text on the card.

## Outcome

2026-10-04.

- **Pickers** (`src/editor/pickers.js`, its pure helpers tested): every entity field suggests the states in use with
  their names and states, those of the field's domains first (`entityChoices`; a light's entities now have domains in
  the schema: light, switch, media_player, fan, input_boolean), and says under it what the entity is now ("BroadLink
  Temperature · 26.9", or that it isn't in the states). A light's `entities` are a list of such inputs, each taken out
  with ×, one more added below.
- **Snapshot:** `snapshot.sh --home <home> --all` saves every entity in Home Assistant, not only the home's, for the
  pickers (the README says so). Opening the editor with `?states=../simulator/states.js` uses it.
- **The label builder:** a label's `attribute` is chosen from the attributes of the entity it reads, with their values
  now (a new schema type, `attribute`), and under the label's settings the text it shows now ("Shows now: 26.9°", by the
  card's own `labelOf`), or why it shows nothing (`when` not met, the entity missing, not a number to round).
- **Icons:** an icon field shows the icon, and while typing the icons whose names, aliases or tags match
  (`searchIcons`), from the Material Design Icons' list loaded once from the CDN the editor already draws icons from
  (`@mdi/svg/meta.json`; offline it's a plain text field).
- **Effects:** the home's properties have the effects as a form instead of YAML: each effect's fade and steps (a colour
  picker for the hue and saturation, the brightness, the hold), steps added and deleted, effects added, deleted; a
  Preview button plays it on a lamp of the home (its entity on, reporting the effect, in the states the card is shown
  with) until Stop. A light's `effect` field already suggested the home's effects and the presets.

Verification:

- `npm test`: 77 pass (4 new in `pickers.test.js`: entity choices and notes, attributes and the label's text or why
  not, icon search, colours and back). `dist/lightwell-card.js` is unchanged (sha256).
- In Chrome (an isolated context, its page id checked before every script), with a snapshot of every entity (249):
  a marker added to the example for `sensor.broadlink_temperature` through its picker (251 suggestions, its name and
  state shown), a label from its state rounded to 1 with a unit: the panel said "Shows now: 26.9°" and the card showed
  26.9°; the attribute choice listed the sensor's real attributes; searching "thermom" found 24 icons and picking one
  set `mdi:thermometer`; Sunset glow previewed on the living room lamp, a step's colour changed (that step's numbers
  only, the line's style kept), stopped; a light's entities: one added, one taken out. No console errors. The first
  look showed the label's text centred with its space lost: its class clashed with the plan's `.preview` (renamed).

Left open: a new marker starts with `tap: toggle` whatever its entity (a sensor's is better without); effects as
`{fade, steps}` are edited the same, other forms only in the YAML.

