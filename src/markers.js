// A marker's label, icon and whether it shows as on, worked out from its settings (no functions, so a home can be
// YAML).
//
// A marker: `entity`, `x`, `y`, `icon` (mdi); `icons`: {state: icon} (weather entities follow their condition on
// their own); `tap: toggle` (otherwise the entity's details open); `small`; `side` (the label to the right instead of
// below); `active`: the states in which it shows as on (otherwise: anything but off, idle, unavailable, unknown,
// closed or standby, and never for a sensor); `power`: an entity that greys the marker out while it's off; `wake`: a
// button pressed on tap while `power` is off, instead of opening the details.
//
// `label`: the small text under the icon, from the marker's entity or another one:
// - `entity`: read this entity instead of the marker's;
// - `attribute`: show this attribute (otherwise the state);
// - `round`: round to this many decimals (non-numbers then show nothing); `unit`: appended, as in '°' or ' lx';
// - `when`: show it only while the marker's entity is in one of these states; `hide`: values never shown.

// HA weather conditions → MDI icons.
export const WEATHER_ICONS = {
  'clear-night': 'weather-night', cloudy: 'weather-cloudy', fog: 'weather-fog', hail: 'weather-hail',
  lightning: 'weather-lightning', 'lightning-rainy': 'weather-lightning-rainy', partlycloudy: 'weather-partly-cloudy',
  pouring: 'weather-pouring', rainy: 'weather-rainy', snowy: 'weather-snowy', 'snowy-rainy': 'weather-snowy-rainy',
  sunny: 'weather-sunny', windy: 'weather-windy', 'windy-variant': 'weather-windy-variant',
};

const OFF = ['off', 'idle', 'unavailable', 'unknown', 'closed', 'standby'];
export const LABEL_KEYS = ['entity', 'attribute', 'round', 'unit', 'when', 'hide'];

export function labelOf(m, s, states) {
  const l = m.label;
  if (!l || (l.when && !l.when.includes(s.state))) return '';
  const src = l.entity ? states[l.entity] : s;
  let v = l.attribute ? src?.attributes[l.attribute] : src?.state;
  if (v === undefined || v === null || v === '' || l.hide?.includes(v)) return '';
  if (l.round !== undefined) {
    const n = Number(v);
    if (typeof v === 'boolean' || !Number.isFinite(n)) return '';
    v = n.toFixed(l.round).replace(/^-(0(\.0+)?)$/, '$1');
  }
  return `${v}${l.unit ?? ''}`;
}

export function iconOf(m, s) {
  if (m.icons) return m.icons[s.state] || m.icon;
  if (m.entity.startsWith('weather.')) return `mdi:${WEATHER_ICONS[s.state] || 'help-circle-outline'}`;
  return m.icon;
}

export const isActive = (m, s, powered) => (m.active ? m.active.includes(s.state)
  : powered && !OFF.includes(s.state) && !m.entity.startsWith('sensor.'));
