// Lightwell: a living floor plan for Home Assistant. Registers the card as `custom:lightwell-card`, which takes its
// home from its config (`home`, or `home_url` for a JSON file).
import {defineFloorplanCard} from './card.js';

defineFloorplanCard('lightwell-card', undefined, {name: 'Lightwell',
  description: 'A living floor plan: lights in their colours, the sun and daylight through your windows, and your devices'});
