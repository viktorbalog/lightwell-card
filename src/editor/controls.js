// The simulator's controls, shared by the simulator page and the editor: a made-up sun (a date and time, with presets
// worked out for the home's location), which way the plan faces, the cloud coverage, the shutters and the lights.
// They turn the states in use into the states a card is shown with, and act on the card's taps (lights toggle, the
// weather steps through its conditions, shutters open or close, media players switch), only here; nothing is sent
// to HA. The simulator loads them as tools/simulator/controls.js (built by npm run build, `LightwellControls`).

// The sun's position (degrees; azimuth clockwise from north), accurate to about half a degree.
export function sunPos(date, lat, lon) {
  const rad = Math.PI / 180, n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, eps = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ha = ((18.697374558 + 24.06570982441908 * n) % 24 * 15 + lon) * rad - ra, la = lat * rad;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return {elevation: el / rad, azimuth: (az / rad + 360) % 360};
}

// Times of day on the date 'YYYY-MM-DD' at `location`, from the sun: [label, minutes after midnight].
export function dayTimes(date, {latitude, longitude}) {
  const [y, m, d] = date.split('-').map(Number);
  const el = Array.from({length: 1440}, (_, t) => sunPos(new Date(y, m - 1, d, 0, t), latitude, longitude).elevation);
  const up = x => el.findIndex((e, t) => t && el[t - 1] < x && e >= x), down = x => el.findIndex((e, t) => t && el[t - 1] >= x && e < x);
  const noon = el.indexOf(Math.max(...el)), rise = up(0), set = down(0);
  return [['Night', 120], ['Dawn', up(-6)], ['Sunrise', rise], ['Morning', rise + 120], ['Noon', noon],
    ['Afternoon', Math.round((noon + set) / 2)], ['Golden hour', set - 60], ['Sunset', set], ['Dusk', down(-6)],
    ['Evening', 22 * 60]].filter(([, t]) => t > 0);
}

export const compass = b => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8];
// The way each wall side faces, from the plan's top (for the readout).
const SIDE_TURN = {top: 0, right: 90, bottom: 180, left: 270};
// The weather conditions a tap steps through, with their cloud coverage.
const WEATHER = [['sunny', 0], ['partlycloudy', 40], ['cloudy', 90], ['rainy', 95], ['fog', 100], ['snowy', 95]];
const WEATHER_NAMES = {sunny: 'Sunny', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', rainy: 'Rainy', fog: 'Foggy', snowy: 'Snowy'};
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const STYLE = `
  .lw-controls { width: 320px; display: grid; grid-template-columns: auto 1fr auto; gap: 8px 10px; align-items: center;
    align-content: start; font-size: 14px; }
  .lw-controls output { font-variant-numeric: tabular-nums; min-width: 4em; text-align: right; }
  .lw-controls .readout { grid-column: 1 / -1; font-size: 15px; padding: 8px; background: #f3f3f3; border-radius: 8px; }
  .lw-controls h3 { grid-column: 1 / -1; margin: 8px 0 0; font-size: 14px; }
  .lw-controls .wide { grid-column: 1 / -1; margin: 0; }
  .lw-controls .presets { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px; }
  .lw-controls .presets button { font: 12px sans-serif; padding: 3px 7px; border: 1px solid #ccc; border-radius: 12px;
    background: #fafafa; cursor: pointer; }
  .lw-controls .presets button:hover { background: #eee; }
  .lw-controls .presets button.on { background: #1e88e5; border-color: #1e88e5; color: #fff; }
`;

const FORM = `
  <label for="date">Date</label><input id="date" type="date"><span></span>
  <div class="presets" data-part="dates"></div>
  <label for="time">Time</label><input id="time" type="range" min="0" max="1439" step="1"><output data-part="time"></output>
  <div class="presets" data-part="times"></div>
  <label for="facing" title="The compass bearing of the top of the plan (north: 0°)">Plan's top faces</label><input id="facing" type="range" min="0" max="359"><output data-part="facing"></output>
  <label for="lights" title="Tap a light on the card to toggle it">Lights off</label><input id="lights" type="checkbox" style="justify-self: start"><span></span>
  <label for="clouds">Clouds</label><input id="clouds" type="range" min="0" max="100" value="0"><output data-part="clouds"></output>
  <div class="presets" data-part="weathers"></div>
  <h3 data-part="shutters-title">Shutters (100 = open)</h3>
  <div data-part="shutters" style="display: contents"></div>
  <div class="readout" data-part="readout"></div>
  <p class="wide" data-part="no-snapshot" style="color: #b00" hidden>No states: run tools/simulator/snapshot.sh and
    open this page with ?states=states.js.</p>
  <p class="wide" data-part="help" style="color: #666">The time presets can also set the lights, media players and
    shutters for that time of day, as the home's simulator.scenes say ("Now": as saved in HA). Tap a marker on the
    card: lights and media players switch, shutters open or close, the weather changes. Only here; nothing is sent to
    HA.</p>
`;

// Fills `form` with the controls for `plan` (the home, with the defaults the tools rely on: tool.js TOOL.plan) and
// calls `onChange({states, north, sun})` with the states to show whenever something changes. `states`: the states in
// use (a snapshot); `location`: {latitude, longitude}, where the sun is worked out for. Returns:
// - `setPlan(plan)`: a new version of the home (the editor's): the shutters, scenes and sides follow it;
// - `setStates(states)`: other states in use;
// - `callService` and `moreInfo(entityId)` for the cards: the taps that act here (`moreInfo` is true when it did);
// - `update()`: calls onChange again.
export function simulatorControls(form, {plan, states = {}, location = {latitude: 51.4779, longitude: 0},
  noSnapshot = false, help = true, onChange}) {
  const root = form.getRootNode();
  if (!root.querySelector?.('style[data-lw-controls]')) {
    const style = Object.assign(document.createElement('style'), {textContent: STYLE});
    style.dataset.lwControls = '';
    (root.head || root).appendChild(style);
  }
  form.classList.add('lw-controls');
  form.innerHTML = FORM;
  const $ = id => form.querySelector(`#${id}`), part = name => form.querySelector(`[data-part="${name}"]`);
  part('no-snapshot').hidden = !noSnapshot;
  part('help').hidden = !help;

  let STATES = states, sunId, weatherId, shutters = [], sides = [], scenes = {};
  // Tapped lights and media players: {entity: 'on' or 'off'}. `condition` null: the weather from the Clouds slider.
  const toggled = {};
  let condition = null, shown = STATES;
  const shutterInput = id => form.querySelector(`[data-shutter="${CSS_ESCAPE(id)}"]`);

  const now = new Date();
  $('date').value = isoDate(now);
  $('time').value = now.getHours() * 60 + now.getMinutes();

  // From the home: which way the plan faces (the first time only), the shutters, the sun and weather entities, the
  // scenes. Shutters already shown keep their positions.
  function setPlan(p, first = false) {
    plan = p;
    sunId = plan.sun.entity;
    weatherId = plan.sun.weather;
    if (first) {
      $('facing').value = plan.sun.north;
      $('clouds').value = STATES[weatherId]?.attributes.cloud_coverage ?? 0;
    }
    const ids = [...new Set(plan.openings.map(o => o.shutter).filter(Boolean))];
    if (ids.join() !== shutters.join()) {
      const box = part('shutters'), was = Object.fromEntries(shutters.map(id => [id, shutterInput(id).value]));
      box.textContent = '';
      for (const id of ids) {
        const name = STATES[id]?.attributes.friendly_name || id.replace(/^cover\.|_shutter$/g, '').replace(/_/g, ' ');
        const label = Object.assign(document.createElement('label'), {textContent: name, htmlFor: `shutter-${id}`});
        const input = Object.assign(document.createElement('input'), {type: 'range', min: 0, max: 100, id: `shutter-${id}`,
          value: was[id] ?? STATES[id]?.attributes.current_position ?? 100});
        input.dataset.shutter = id;
        box.append(label, input, document.createElement('output'));
      }
      shutters = ids;
    }
    part('shutters-title').hidden = !shutters.length;
    sides = [...new Set(plan.openings.map(o => o.wall))];
    scenes = plan.simulator?.scenes || {};
  }

  for (const [w, cc] of WEATHER) {
    const b = Object.assign(document.createElement('button'), {type: 'button', textContent: WEATHER_NAMES[w]});
    b.dataset.weather = w;
    b.onclick = () => { condition = w; $('clouds').value = cc; update(); };
    part('weathers').appendChild(b);
  }
  function timeButtons() {
    const now = new Date(), box = part('times');
    box.textContent = '';
    for (const [label, t] of [['Now', now.getHours() * 60 + now.getMinutes()], ...dayTimes($('date').value, location)]) {
      const b = Object.assign(document.createElement('button'), {type: 'button', textContent: label,
        title: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`});
      b.dataset.time = t;
      b.onclick = () => { $('time').value = t; scene(label); update(); };
      box.appendChild(b);
    }
  }
  // What each time preset switches, from the home's simulator.scenes: {Preset: {lights, media, shutters}} (lights and
  // media players 'on' or 'off', shutters by entity; any not named are open), or another preset's name. Presets
  // without a scene only move the sun. "Now" goes back to the states as saved in HA (the snapshot), weather included.
  function scene(label) {
    for (const id in toggled) delete toggled[id];
    $('lights').checked = false;
    if (label === 'Now') {
      for (const id of shutters) shutterInput(id).value = STATES[id]?.attributes.current_position ?? 100;
      condition = null;
      $('clouds').value = STATES[weatherId]?.attributes.cloud_coverage ?? 0;
      return;
    }
    let sc = scenes[label];
    if (typeof sc === 'string') sc = scenes[sc];
    if (!sc) return;
    for (const id in STATES) {
      if (id.startsWith('light.') && sc.lights) toggled[id] = sc.lights;
      if (id.startsWith('media_player.') && sc.media) toggled[id] = sc.media;
    }
    for (const id of shutters) shutterInput(id).value = sc.shutters?.[id] ?? 100;
  }
  // A new date: the time presets are worked out again, and an active one (say Sunset) moves to its time on that date.
  function dateChanged() {
    const active = form.querySelector('[data-time].on')?.textContent;
    timeButtons();
    const b = [...form.querySelectorAll('[data-time]')].find(b => b.textContent === active);
    if (b && active !== 'Now') $('time').value = b.dataset.time;
  }
  // Dates: today, and the equinoxes and solstices of this year (the sun's highest, lowest and middle paths).
  const year = new Date().getFullYear();
  for (const [label, md] of [['Today', null], ['Spring equinox', '03-20'], ['Summer solstice', '06-21'],
      ['Autumn equinox', '09-22'], ['Winter solstice', '12-21']]) {
    const value = md ? `${year}-${md}` : isoDate(new Date());
    const b = Object.assign(document.createElement('button'), {type: 'button', textContent: label, title: value});
    b.dataset.date = value;
    b.onclick = () => { $('date').value = value; dateChanged(); update(); };
    part('dates').appendChild(b);
  }

  // Tapping a light on the card toggles it here.
  const callService = (domain, service, data) => {
    if (service !== 'toggle') return;
    toggled[data.entity_id] = shown[data.entity_id]?.state === 'on' ? 'off' : 'on';
    update();
  };
  // Taps that open the details on the dashboard act here instead: the weather steps through its conditions, a shutter
  // opens or closes, a media player switches on or off.
  const moreInfo = id => {
    if (id === weatherId) {
      const k = (WEATHER.findIndex(([w]) => w === condition) + 1) % WEATHER.length;
      [condition, $('clouds').value] = WEATHER[k];
    } else if (shutters.includes(id)) shutterInput(id).value = +shutterInput(id).value > 0 ? 0 : 100;
    else if (id.startsWith('media_player.')) toggled[id] = shown[id]?.state === 'on' ? 'off' : 'on';
    else return false;
    update();
    return true;
  };

  function update() {
    const [y, m, d] = $('date').value.split('-').map(Number), t = +$('time').value;
    const when = new Date(y, m - 1, d, Math.floor(t / 60), t % 60);
    const sun = sunPos(when, location.latitude, location.longitude), facing = +$('facing').value;
    const states = structuredClone(STATES);
    states[sunId] = {entity_id: sunId, state: sun.elevation > 0 ? 'above_horizon' : 'below_horizon', attributes: sun};
    const weather = condition || (+$('clouds').value > 60 ? 'cloudy' : +$('clouds').value > 20 ? 'partlycloudy' : 'sunny');
    states[weatherId] = {...states[weatherId], state: weather === 'sunny' && sun.elevation <= 0 ? 'clear-night' : weather,
      attributes: {...states[weatherId]?.attributes, cloud_coverage: +$('clouds').value}};
    // Lights off: every light and media player, so only the sun and the daylight show.
    if ($('lights').checked) for (const id in states) if (/^(light|media_player)\./.test(id)) states[id] = {...states[id], state: 'off'};
    // A tapped entity the states don't have (the home's own, shown with the example's states) gets a state as HA's
    // look, attributes and all.
    for (const [id, state] of Object.entries(toggled)) states[id] = {entity_id: id, attributes: {}, ...states[id], state};
    shown = states;
    for (const id of shutters) {
      const input = shutterInput(id);
      states[id] = {...states[id], attributes: {...states[id]?.attributes, current_position: +input.value}};
      input.nextElementSibling.textContent = `${input.value}%`;
    }
    part('time').textContent = when.toTimeString().slice(0, 5);
    part('facing').textContent = `${facing}° ${compass(facing)}`;
    part('clouds').textContent = `${$('clouds').value}%`;
    form.querySelectorAll('[data-time]').forEach(b => b.classList.toggle('on', +b.dataset.time === t));
    form.querySelectorAll('[data-date]').forEach(b => b.classList.toggle('on', b.dataset.date === $('date').value));
    form.querySelectorAll('[data-weather]').forEach(b => b.classList.toggle('on', b.dataset.weather === condition));
    // Which of the walls with openings the sun is in front of, and how squarely.
    const lit = sides.map(side => [side, ((sun.azimuth - facing - SIDE_TURN[side] + 540) % 360) - 180])
      .filter(([, rel]) => Math.abs(rel) < 87);
    part('readout').innerHTML = `Sun: azimuth <b>${sun.azimuth.toFixed(1)}° ${compass(sun.azimuth)}</b>, elevation
      <b>${sun.elevation.toFixed(1)}°</b><br>${sun.elevation <= 0 ? 'Below the horizon.' : lit.length
      ? lit.map(([side, rel]) => `In front of the ${side} side, ${Math.abs(rel).toFixed(0)}° off straight on.`).join('<br>')
      : 'Behind the building: no direct sun through any opening.'}`;
    onChange({states, north: facing, sun});
  }

  form.addEventListener('input', e => {
    // "Lights off" starts again from all off (or all as they were), forgetting the lights tapped since.
    if (e.target.id === 'lights') for (const id in toggled) delete toggled[id];
    if (e.target.id === 'clouds') condition = null;
    if (e.target.id === 'date') dateChanged();
    update();
  });
  form.addEventListener('submit', e => e.preventDefault());
  setPlan(plan, true);
  timeButtons();
  update();
  return {
    setPlan(p) { setPlan(p); update(); },
    setStates(s) { STATES = s; update(); },
    callService, moreInfo, update,
  };
}

const CSS_ESCAPE = s => (globalThis.CSS?.escape ? globalThis.CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));
