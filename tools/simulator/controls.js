// The simulator's controls, built from src/editor/controls.js by npm run build.
var LightwellControls = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/editor/controls.js
  var controls_exports = {};
  __export(controls_exports, {
    compass: () => compass,
    dayTimes: () => dayTimes,
    simulatorControls: () => simulatorControls,
    sunPos: () => sunPos
  });
  function sunPos(date, lat, lon) {
    const rad = Math.PI / 180, n = date.getTime() / 864e5 + 24405875e-1 - 2451545;
    const L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360 * rad;
    const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 4e-7 * n) * rad;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const ha = ((18.697374558 + 24.06570982441908 * n) % 24 * 15 + lon) * rad - ra, la = lat * rad;
    const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
    const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
    return { elevation: el / rad, azimuth: (az / rad + 360) % 360 };
  }
  function dayTimes(date, { latitude, longitude }) {
    const [y, m, d] = date.split("-").map(Number);
    const el = Array.from({ length: 1440 }, (_, t) => sunPos(new Date(y, m - 1, d, 0, t), latitude, longitude).elevation);
    const up = (x) => el.findIndex((e, t) => t && el[t - 1] < x && e >= x), down = (x) => el.findIndex((e, t) => t && el[t - 1] >= x && e < x);
    const noon = el.indexOf(Math.max(...el)), rise = up(0), set = down(0);
    return [
      ["Night", 120],
      ["Dawn", up(-6)],
      ["Sunrise", rise],
      ["Morning", rise + 120],
      ["Noon", noon],
      ["Afternoon", Math.round((noon + set) / 2)],
      ["Golden hour", set - 60],
      ["Sunset", set],
      ["Dusk", down(-6)],
      ["Evening", 22 * 60]
    ].filter(([, t]) => t > 0);
  }
  var compass = (b) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(b / 45) % 8];
  var SIDE_TURN = { top: 0, right: 90, bottom: 180, left: 270 };
  var WEATHER = [["sunny", 0], ["partlycloudy", 40], ["cloudy", 90], ["rainy", 95], ["fog", 100], ["snowy", 95]];
  var WEATHER_NAMES = { sunny: "Sunny", partlycloudy: "Partly cloudy", cloudy: "Cloudy", rainy: "Rainy", fog: "Foggy", snowy: "Snowy" };
  var pad = (n) => String(n).padStart(2, "0");
  var isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  var STYLE = `
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
  var FORM = `
  <label for="date">Date</label><input id="date" type="date"><span></span>
  <div class="presets" data-part="dates"></div>
  <label for="time">Time</label><input id="time" type="range" min="0" max="1439" step="1"><output data-part="time"></output>
  <div class="presets" data-part="times"></div>
  <label for="facing" title="The compass bearing of the top of the plan (north: 0\xB0)">Plan's top faces</label><input id="facing" type="range" min="0" max="359"><output data-part="facing"></output>
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
  function simulatorControls(form, {
    plan,
    states = {},
    location = { latitude: 51.4779, longitude: 0 },
    noSnapshot = false,
    help = true,
    onChange
  }) {
    const root = form.getRootNode();
    if (!root.querySelector?.("style[data-lw-controls]")) {
      const style = Object.assign(document.createElement("style"), { textContent: STYLE });
      style.dataset.lwControls = "";
      (root.head || root).appendChild(style);
    }
    form.classList.add("lw-controls");
    form.innerHTML = FORM;
    const $ = (id) => form.querySelector(`#${id}`), part = (name) => form.querySelector(`[data-part="${name}"]`);
    part("no-snapshot").hidden = !noSnapshot;
    part("help").hidden = !help;
    let STATES = states, sunId, weatherId, shutters = [], sides = [], scenes = {};
    const toggled = {};
    let condition = null, shown = STATES;
    const shutterInput = (id) => form.querySelector(`[data-shutter="${CSS_ESCAPE(id)}"]`);
    const now = /* @__PURE__ */ new Date();
    $("date").value = isoDate(now);
    $("time").value = now.getHours() * 60 + now.getMinutes();
    function setPlan(p, first = false) {
      plan = p;
      sunId = plan.sun.entity;
      weatherId = plan.sun.weather;
      if (first) {
        $("facing").value = plan.sun.north;
        $("clouds").value = STATES[weatherId]?.attributes.cloud_coverage ?? 0;
      }
      const ids = [...new Set(plan.openings.map((o) => o.shutter).filter(Boolean))];
      if (ids.join() !== shutters.join()) {
        const box = part("shutters"), was = Object.fromEntries(shutters.map((id) => [id, shutterInput(id).value]));
        box.textContent = "";
        for (const id of ids) {
          const name = STATES[id]?.attributes.friendly_name || id.replace(/^cover\.|_shutter$/g, "").replace(/_/g, " ");
          const label = Object.assign(document.createElement("label"), { textContent: name, htmlFor: `shutter-${id}` });
          const input = Object.assign(document.createElement("input"), {
            type: "range",
            min: 0,
            max: 100,
            id: `shutter-${id}`,
            value: was[id] ?? STATES[id]?.attributes.current_position ?? 100
          });
          input.dataset.shutter = id;
          box.append(label, input, document.createElement("output"));
        }
        shutters = ids;
      }
      part("shutters-title").hidden = !shutters.length;
      sides = [...new Set(plan.openings.map((o) => o.wall))];
      scenes = plan.simulator?.scenes || {};
    }
    for (const [w, cc] of WEATHER) {
      const b = Object.assign(document.createElement("button"), { type: "button", textContent: WEATHER_NAMES[w] });
      b.dataset.weather = w;
      b.onclick = () => {
        condition = w;
        $("clouds").value = cc;
        update();
      };
      part("weathers").appendChild(b);
    }
    function timeButtons() {
      const now2 = /* @__PURE__ */ new Date(), box = part("times");
      box.textContent = "";
      for (const [label, t] of [["Now", now2.getHours() * 60 + now2.getMinutes()], ...dayTimes($("date").value, location)]) {
        const b = Object.assign(document.createElement("button"), {
          type: "button",
          textContent: label,
          title: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
        });
        b.dataset.time = t;
        b.onclick = () => {
          $("time").value = t;
          scene(label);
          update();
        };
        box.appendChild(b);
      }
    }
    function scene(label) {
      for (const id in toggled) delete toggled[id];
      $("lights").checked = false;
      if (label === "Now") {
        for (const id of shutters) shutterInput(id).value = STATES[id]?.attributes.current_position ?? 100;
        condition = null;
        $("clouds").value = STATES[weatherId]?.attributes.cloud_coverage ?? 0;
        return;
      }
      let sc = scenes[label];
      if (typeof sc === "string") sc = scenes[sc];
      if (!sc) return;
      for (const id in STATES) {
        if (id.startsWith("light.") && sc.lights) toggled[id] = sc.lights;
        if (id.startsWith("media_player.") && sc.media) toggled[id] = sc.media;
      }
      for (const id of shutters) shutterInput(id).value = sc.shutters?.[id] ?? 100;
    }
    function dateChanged() {
      const active = form.querySelector("[data-time].on")?.textContent;
      timeButtons();
      const b = [...form.querySelectorAll("[data-time]")].find((b2) => b2.textContent === active);
      if (b && active !== "Now") $("time").value = b.dataset.time;
    }
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    for (const [label, md] of [
      ["Today", null],
      ["Spring equinox", "03-20"],
      ["Summer solstice", "06-21"],
      ["Autumn equinox", "09-22"],
      ["Winter solstice", "12-21"]
    ]) {
      const value = md ? `${year}-${md}` : isoDate(/* @__PURE__ */ new Date());
      const b = Object.assign(document.createElement("button"), { type: "button", textContent: label, title: value });
      b.dataset.date = value;
      b.onclick = () => {
        $("date").value = value;
        dateChanged();
        update();
      };
      part("dates").appendChild(b);
    }
    const callService = (domain, service, data) => {
      if (service !== "toggle") return;
      toggled[data.entity_id] = shown[data.entity_id]?.state === "on" ? "off" : "on";
      update();
    };
    const moreInfo = (id) => {
      if (id === weatherId) {
        const k = (WEATHER.findIndex(([w]) => w === condition) + 1) % WEATHER.length;
        [condition, $("clouds").value] = WEATHER[k];
      } else if (shutters.includes(id)) shutterInput(id).value = +shutterInput(id).value > 0 ? 0 : 100;
      else if (id.startsWith("media_player.")) toggled[id] = shown[id]?.state === "on" ? "off" : "on";
      else return false;
      update();
      return true;
    };
    function update() {
      const [y, m, d] = $("date").value.split("-").map(Number), t = +$("time").value;
      const when = new Date(y, m - 1, d, Math.floor(t / 60), t % 60);
      const sun = sunPos(when, location.latitude, location.longitude), facing = +$("facing").value;
      const states2 = structuredClone(STATES);
      states2[sunId] = { entity_id: sunId, state: sun.elevation > 0 ? "above_horizon" : "below_horizon", attributes: sun };
      const weather = condition || (+$("clouds").value > 60 ? "cloudy" : +$("clouds").value > 20 ? "partlycloudy" : "sunny");
      states2[weatherId] = {
        ...states2[weatherId],
        state: weather === "sunny" && sun.elevation <= 0 ? "clear-night" : weather,
        attributes: { ...states2[weatherId]?.attributes, cloud_coverage: +$("clouds").value }
      };
      if ($("lights").checked) {
        for (const id in states2) if (/^(light|media_player)\./.test(id)) states2[id] = { ...states2[id], state: "off" };
      }
      for (const [id, state] of Object.entries(toggled)) states2[id] = { entity_id: id, attributes: {}, ...states2[id], state };
      shown = states2;
      for (const id of shutters) {
        const input = shutterInput(id);
        states2[id] = { ...states2[id], attributes: { ...states2[id]?.attributes, current_position: +input.value } };
        input.nextElementSibling.textContent = `${input.value}%`;
      }
      part("time").textContent = when.toTimeString().slice(0, 5);
      part("facing").textContent = `${facing}\xB0 ${compass(facing)}`;
      part("clouds").textContent = `${$("clouds").value}%`;
      form.querySelectorAll("[data-time]").forEach((b) => b.classList.toggle("on", +b.dataset.time === t));
      form.querySelectorAll("[data-date]").forEach((b) => b.classList.toggle("on", b.dataset.date === $("date").value));
      form.querySelectorAll("[data-weather]").forEach((b) => b.classList.toggle("on", b.dataset.weather === condition));
      const lit = sides.map((side) => [side, (sun.azimuth - facing - SIDE_TURN[side] + 540) % 360 - 180]).filter(([, rel]) => Math.abs(rel) < 87);
      part("readout").innerHTML = `Sun: azimuth <b>${sun.azimuth.toFixed(1)}\xB0 ${compass(sun.azimuth)}</b>, elevation
      <b>${sun.elevation.toFixed(1)}\xB0</b><br>${sun.elevation <= 0 ? "Below the horizon." : lit.length ? lit.map(([side, rel]) => `In front of the ${side} side, ${Math.abs(rel).toFixed(0)}\xB0 off straight on.`).join("<br>") : "Behind the building: no direct sun through any opening."}`;
      onChange({ states: states2, north: facing, sun });
    }
    form.addEventListener("input", (e) => {
      if (e.target.id === "lights") for (const id in toggled) delete toggled[id];
      if (e.target.id === "clouds") condition = null;
      if (e.target.id === "date") dateChanged();
      update();
    });
    form.addEventListener("submit", (e) => e.preventDefault());
    setPlan(plan, true);
    timeButtons();
    update();
    return {
      setPlan(p) {
        setPlan(p);
        update();
      },
      setStates(s) {
        STATES = s;
        update();
      },
      setLocation(l) {
        location = l;
        update();
      },
      callService,
      moreInfo,
      update
    };
  }
  var CSS_ESCAPE = (s) => globalThis.CSS?.escape ? globalThis.CSS.escape(s) : s.replace(/["\\]/g, "\\$&");
  return __toCommonJS(controls_exports);
})();
