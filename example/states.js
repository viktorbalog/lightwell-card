// Made-up states for the example homes (home.yaml, background/home.yaml), so the tools work without a Home Assistant: an evening with the
// living room lamp, the TV and the terrace lights on, and the bedroom lamp playing an effect. Your own home's come
// from tools/simulator/snapshot.sh. HOME is the location the sun is worked out for (here: Berlin).
const at = (state, attributes = {}) => ({state, attributes});
window.STATES = {
  'light.living_room_lamp': at('on', {brightness: 200, rgb_color: [255, 190, 120], friendly_name: 'Living room lamp'}),
  'light.kitchen_strip': at('off', {friendly_name: 'Kitchen strip'}),
  'light.bedroom_lamp': at('on', {brightness: 150, rgb_color: [255, 140, 60], effect: 'Sunset glow', friendly_name: 'Bedroom lamp'}),
  'light.terrace_lights': at('on', {friendly_name: 'Terrace lights'}),
  'light.studio_lamp': at('on', {brightness: 220, rgb_color: [255, 200, 140], friendly_name: 'Studio lamp'}),
  'media_player.tv': at('on', {source: 'Netflix', friendly_name: 'TV'}),
  'climate.living_room': at('cool', {temperature: 22, friendly_name: 'Living room AC'}),
  'sensor.bedroom_temperature': at('21.4', {unit_of_measurement: '°C', friendly_name: 'Bedroom temperature'}),
  'cover.living_room_blind': at('open', {current_position: 100, friendly_name: 'Terrace door blind'}),
  'cover.bedroom_blind': at('open', {current_position: 60, friendly_name: 'Bedroom blind'}),
  'weather.home': at('sunny', {temperature: 18, cloud_coverage: 10, friendly_name: 'Home'}),
  'sun.sun': at('below_horizon', {elevation: -8, azimuth: 290, friendly_name: 'Sun'}),
};
for (const [id, s] of Object.entries(window.STATES)) s.entity_id = id;
window.HOME = {latitude: 52.52, longitude: 13.405};
