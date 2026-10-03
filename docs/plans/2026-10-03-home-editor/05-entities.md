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
