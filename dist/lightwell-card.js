// Lightwell 0.2.0: a living floor plan for Home Assistant (MIT licence).
// Built from src/ by npm run build.
(() => {
  // src/geometry.js
  var clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  var box = (x, y, w, h, deg = 0) => {
    const cx = x + w / 2, cy = y + h / 2, a = deg * Math.PI / 180;
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a), cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a)]);
  };
  var turnPoly = (poly, deg = 0, c = polyMiddle(poly)) => {
    if (!deg) return poly;
    const a = deg * Math.PI / 180;
    return poly.map(([px, py]) => [c[0] + (px - c[0]) * Math.cos(a) - (py - c[1]) * Math.sin(a), c[1] + (px - c[0]) * Math.sin(a) + (py - c[1]) * Math.cos(a)]);
  };
  var polyMiddle = (poly) => {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  };
  var round = (cx, cy, r) => Array.from({ length: 12 }, (_, k) => [cx + r * Math.cos(k * Math.PI / 6), cy + r * Math.sin(k * Math.PI / 6)]);
  var points = (ps) => ps.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  var clipShapes = (region) => Array.isArray(region[0][0]) ? `<polygon points="${region[0].map((p) => p.join(",")).join(" ")}"/>` : region.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("");
  var sweep = (poly, move) => poly.map((a, k) => {
    const b = poly[(k + 1) % poly.length];
    return `<polygon points="${points([a, b, move(b), move(a)])}"/>`;
  }).join("");
  var shadowOf = (poly, x, y, k) => sweep(poly, ([px, py]) => [px + (px - x) * k, py + (py - y) * k]);
  var castAlong = (poly, dx, dy) => sweep(poly, ([px, py]) => [px + dx, py + dy]);

  // src/shapes.js
  var esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  var GEOMETRY = ["rect", "circle", "ellipse", "poly", "path", "text", "at", "svg", "repeat"];
  var attrs = (shape) => Object.entries(shape).filter(([k, v]) => !GEOMETRY.includes(k) && k !== "description" && k !== "part" && v !== void 0).map(([k, v]) => ` ${k.replace(/_/g, "-")}="${esc(v)}"`).join("");
  function shapeSvg(s) {
    if (s.svg !== void 0) return s.svg;
    if (s.repeat) return repeated(s);
    const a = attrs(s);
    if (s.rect) {
      const [x, y, w, h] = s.rect;
      return `<rect${a} x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    }
    if (s.circle) {
      const [cx, cy, r] = s.circle;
      return `<circle${a} cx="${cx}" cy="${cy}" r="${r}"/>`;
    }
    if (s.ellipse) {
      const [cx, cy, rx, ry] = s.ellipse;
      return `<ellipse${a} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
    }
    if (s.poly) return `<polygon${a} points="${s.poly.map((p) => p.join(",")).join(" ")}"/>`;
    if (s.path !== void 0) return `<path${a} d="${esc(s.path)}"/>`;
    if (s.text !== void 0) return `<text${a} x="${s.at[0]}" y="${s.at[1]}">${esc(s.text).replace(/>/g, "&gt;")}</text>`;
    throw new Error(`not a shape: ${JSON.stringify(s)}`);
  }
  function repeated({ repeat: { count, step: [dx, dy] }, ...s }) {
    const move = (v, i) => {
      if (s.rect) return { rect: [s.rect[0] + dx * i, s.rect[1] + dy * i, s.rect[2], s.rect[3]] };
      if (s.circle) return { circle: [s.circle[0] + dx * i, s.circle[1] + dy * i, s.circle[2]] };
      if (s.ellipse) return { ellipse: [s.ellipse[0] + dx * i, s.ellipse[1] + dy * i, s.ellipse[2], s.ellipse[3]] };
      if (s.poly) return { poly: s.poly.map(([x, y]) => [x + dx * i, y + dy * i]) };
      if (s.text !== void 0) return { at: [s.at[0] + dx * i, s.at[1] + dy * i] };
      return { transform: `translate(${dx * i} ${dy * i})` };
    };
    return Array.from({ length: count }, (_, i) => {
      const copy = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) && !GEOMETRY.includes(k) ? v[i % v.length] : v]));
      return shapeSvg({ ...copy, ...move(s, i) });
    }).join("");
  }
  var shapesSvg = (list) => typeof list === "string" ? list : (list || []).map(shapeSvg).join("");
  function shapeErrors(list) {
    if (list === void 0 || typeof list === "string") return [];
    if (!Array.isArray(list)) return ["needs a list of shapes"];
    return list.flatMap((s, i) => {
      const kinds = GEOMETRY.filter((k) => k !== "at" && k !== "repeat" && s?.[k] !== void 0);
      if (kinds.length !== 1) return [`[${i}]: needs exactly one of rect, circle, ellipse, poly, path, text or svg`];
      if (kinds[0] === "text" && !(Array.isArray(s.at) && s.at.length === 2)) return [`[${i}]: a text needs at: [x, y]`];
      const r = s.repeat;
      if (r && !(r.count > 0 && Array.isArray(r.step) && r.step.length === 2)) return [`[${i}]: repeat needs a count and step: [dx, dy]`];
      for (const k of ["description", "part"]) if (s[k] !== void 0 && typeof s[k] !== "string") return [`[${i}].${k}: needs a text`];
      return [];
    });
  }

  // src/furniture.js
  function outline({ shape: { rect, rx, circle, poly } }, attrs2 = "") {
    if (rect) return `<rect${attrs2} x="${rect[0]}" y="${rect[1]}" width="${rect[2]}" height="${rect[3]}"${rx ? ` rx="${rx}"` : ""}/>`;
    if (circle) return `<circle${attrs2} cx="${circle[0]}" cy="${circle[1]}" r="${circle[2]}"/>`;
    return `<path${attrs2} d="M${poly.map((p) => p.join(",")).join(" L")} Z"/>`;
  }
  var pieceCentre = ({ rect, poly }) => rect ? [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2] : poly ? polyMiddle(poly) : null;
  var turn = ({ shape }) => {
    const c = shape.turn && pieceCentre(shape);
    return c ? `rotate(${shape.turn} ${c[0]} ${c[1]})` : "";
  };
  var furnitureSvg = (furniture) => Object.values(furniture).map((p) => {
    const svg = outline(p, ` class="${p.class || "furn"}"`) + shapesSvg(p.extra);
    return turn(p) ? `<g transform="${turn(p)}">${svg}</g>` : svg;
  }).join("\n");
  var furnitureClip = (furniture) => Object.values(furniture).map((p) => outline(p, turn(p) ? ` transform="${turn(p)}"` : "")).join("");
  function caster(furniture, name) {
    const p = furniture[name];
    if (!p?.height) throw new Error(`no furniture casting shadows called ${name}`);
    const { rect, circle, poly, turn: turn2 = 0 } = p.shape;
    return [rect ? box(...rect, turn2) : circle ? round(...circle) : turnPoly(poly, turn2), p.height];
  }
  var castersIn = (furniture, room) => Object.keys(furniture).filter((n) => furniture[n].shadow_room === room && furniture[n].height).map((n) => caster(furniture, n));

  // src/openings.js
  var SIDES = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
  var isHorizontal = (o) => o.wall === "top" || o.wall === "bottom";
  var ends = (o) => isHorizontal(o) ? [[o.x, o.at], [o.x + o.w, o.at]] : [[o.at, o.y], [o.at, o.y + o.h]];
  function shutterRect(o) {
    const [dx, dy] = SIDES[o.wall], inner = o.at - o.depth * (dx || dy);
    const lo = Math.min(o.at, inner);
    return isHorizontal(o) ? [o.x, lo, o.w, o.depth] : [lo, o.y, o.depth, o.h];
  }
  var SKY = { inset: 28, along: 1e3, inward: 1450 };
  function skyEllipse(o, unitsPerMetre) {
    const k = (v) => Math.round(v * unitsPerMetre / 175 * 10) / 10, [dx, dy] = SIDES[o.wall];
    const [[x0, y0], [x1, y1]] = ends(o), cx = (x0 + x1) / 2 - dx * k(SKY.inset), cy = (y0 + y1) / 2 - dy * k(SKY.inset);
    return isHorizontal(o) ? [cx, cy, k(SKY.along), k(SKY.inward)] : [cx, cy, k(SKY.inward), k(SKY.along)];
  }
  function openingErrors(o) {
    if (!SIDES[o.wall]) return ["needs wall: top, bottom, left or right"];
    const keys = ["at", "depth", "lo", "hi", ...isHorizontal(o) ? ["x", "w"] : ["y", "h"]];
    return keys.filter((k) => typeof o[k] !== "number").map((k) => `needs a number ${k}`);
  }

  // src/effects.js
  var PRESETS = {
    // A TV's flickering light: cool and restless, with quick fades.
    flicker: { fade: 250, steps: [
      [215, 25, 85, 700],
      [225, 15, 100, 400],
      [205, 35, 70, 900],
      [220, 20, 95, 500],
      [230, 30, 80, 1100],
      [210, 10, 100, 350]
    ] }
  };
  var TICK = 100;
  function timeline(effect, color, effects = {}) {
    const def = effects[effect] || PRESETS[effect], steps = def?.steps || def;
    if (!steps) return { total: 3e3, points: [[0, color, 1, true], [1500, color, 0.35, true], [3e3, color, 1]] };
    const fade = def.fade || 666, at = ([h, s, v]) => [hsvRgb(h, s), Math.max(v, 1) / 100];
    const points2 = [[0, ...at(steps.at(-1))]];
    let t = 0;
    for (const st of steps) {
      points2.push([t + fade, ...at(st)]);
      t += fade + st[3];
      points2.push([t, ...at(st)]);
    }
    return { total: t, points: points2 };
  }
  function frameAt({ total, points: points2 }, t) {
    t %= total;
    const k = points2.findIndex((p, i) => i + 1 < points2.length && points2[i + 1][0] > t);
    const [t0, c0, o0, eased] = points2[k], [t1, c1, o1] = points2[k + 1];
    const still = o0 === o1 && c0.every((v, i) => v === c1[i]);
    if (still) return { color: c0, opacity: o0, next: t1 - t };
    let f = (t - t0) / (t1 - t0);
    if (eased) f = f * f * (3 - 2 * f);
    return {
      color: c0.map((v, i) => Math.round(v + (c1[i] - v) * f)),
      opacity: +(o0 + (o1 - o0) * f).toFixed(3),
      next: Math.min(TICK, t1 - t)
    };
  }
  function hsvRgb(h, s) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return Math.round(255 * (1 - s / 100 * Math.max(0, Math.min(k, 4 - k, 1))));
    };
    return [f(5), f(3), f(1)];
  }
  var lightRgb = (s) => s.attributes.rgb_color || [255, 214, 140];
  var lightColor = (s) => `rgb(${lightRgb(s).join(", ")})`;
  var rgb = (c) => `rgb(${c.join(", ")})`;

  // src/markers.js
  var WEATHER_ICONS = {
    "clear-night": "weather-night",
    cloudy: "weather-cloudy",
    fog: "weather-fog",
    hail: "weather-hail",
    lightning: "weather-lightning",
    "lightning-rainy": "weather-lightning-rainy",
    partlycloudy: "weather-partly-cloudy",
    pouring: "weather-pouring",
    rainy: "weather-rainy",
    snowy: "weather-snowy",
    "snowy-rainy": "weather-snowy-rainy",
    sunny: "weather-sunny",
    windy: "weather-windy",
    "windy-variant": "weather-windy-variant"
  };
  var OFF = ["off", "idle", "unavailable", "unknown", "closed", "standby"];
  var LABEL_KEYS = ["entity", "attribute", "round", "unit", "when", "hide"];
  function labelOf(m, s, states) {
    const l = m.label;
    if (!l || l.when && !l.when.includes(s.state)) return "";
    const src = l.entity ? states[l.entity] : s;
    let v = l.attribute ? src?.attributes[l.attribute] : src?.state;
    if (v === void 0 || v === null || v === "" || l.hide?.includes(v)) return "";
    if (l.round !== void 0) {
      const n = Number(v);
      if (typeof v === "boolean" || !Number.isFinite(n)) return "";
      v = n.toFixed(l.round).replace(/^-(0(\.0+)?)$/, "$1");
    }
    return `${v}${l.unit ?? ""}`;
  }
  function iconOf(m, s) {
    if (m.icons) return m.icons[s.state] || m.icon;
    if (m.entity.startsWith("weather.")) return `mdi:${WEATHER_ICONS[s.state] || "help-circle-outline"}`;
    return m.icon;
  }
  var isActive = (m, s, powered) => m.active ? m.active.includes(s.state) : powered && !OFF.includes(s.state) && !m.entity.startsWith("sensor.");

  // src/home.js
  var SLOTS = ["floors", "walls", "glazing", "fittings", "under_furniture", "on_furniture", "labels"];
  var LIT = ["always", "dark", "never"];
  function defineHome(home) {
    const h = { ...home };
    for (const [k, v] of Object.entries({ rooms: {}, openings: [], furniture: {}, lights: [], effects: {}, markers: [] })) h[k] ?? (h[k] = v);
    const sun = h.sun = { ...home.sun }, drawing = h.drawing = { ...home.drawing };
    for (const [k, v] of Object.entries({ entity: "sun.sun", weather: "weather.home", blockers: [], spill: [], trees: null, outdoor: [] })) sun[k] ?? (sun[k] = v);
    h.palette = { light: {}, dark: {}, tinted: [], ...home.palette };
    const errors = [];
    const fail = (where, msg) => errors.push(`${where}: ${msg}`);
    const room = (where, name) => {
      if (name !== void 0 && !h.rooms[name]) fail(where, `no room called "${name}"`);
    };
    const entity = (where, id) => {
      if (id !== void 0 && !/^[a-z_]+\.[a-z0-9_]+$/.test(id)) fail(where, `"${id}" isn't an entity id`);
    };
    const shapesFail = (where, list) => shapeErrors(list).forEach((e) => errors.push(e.startsWith("[") ? `${where}${e}` : `${where}: ${e}`));
    const described = (where, item) => {
      if (item?.description !== void 0 && typeof item.description !== "string") fail(where ? `${where}.description` : "description", "needs a text");
      if (where && item?.part !== void 0 && typeof item.part !== "string") fail(`${where}.part`, "needs a text");
    };
    described("", h);
    if (!["x", "y", "w", "h"].every((k) => typeof h.view?.[k] === "number")) fail("view", "needs numbers x, y, w and h");
    if (!(h.units_per_metre > 0)) fail("units_per_metre", "needs a number above 0");
    for (const k of Object.keys(drawing)) if (!SLOTS.includes(k) && k !== "background") fail(`drawing.${k}`, `isn't a slot (${SLOTS.join(", ")}, background)`);
    for (const k of SLOTS) shapesFail(`drawing.${k}`, drawing[k]);
    if (drawing.background && typeof drawing.background.image !== "string") fail("drawing.background", "needs an image URL");
    for (const [name, p] of Object.entries(h.furniture)) {
      const { rect, circle, poly } = p.shape || {};
      if (!rect && !circle && !poly) fail(`furniture.${name}`, "needs a shape: rect, circle or poly");
      room(`furniture.${name}.shadow_room`, p.shadow_room);
      if (p.height !== void 0 && !(p.height > 0)) fail(`furniture.${name}.height`, "needs a number of metres above 0");
      shapesFail(`furniture.${name}.extra`, p.extra);
      described(`furniture.${name}`, p);
    }
    h.openings = h.openings.map((o) => ({ ...o, sky: o.sky ?? o.room }));
    h.openings.forEach((o, i) => {
      const where = `openings[${i}]`;
      if (o.room === void 0) fail(where, "needs the room its sun falls in");
      openingErrors(o).forEach((e) => fail(where, e));
      room(`${where}.room`, o.room);
      room(`${where}.sky`, o.sky);
      entity(`${where}.shutter`, o.shutter);
      described(where, o);
    });
    h.lights.forEach((g, i) => {
      const where = `lights[${i}]`;
      if (!g.entities?.length && !g.lit) fail(where, "needs entities, or lit: always, dark or never");
      if (g.lit !== void 0 && !LIT.includes(g.lit)) fail(`${where}.lit`, `needs ${LIT.join(", ")}`);
      g.entities?.forEach((e) => entity(`${where}.entities`, e));
      if (!g.shape?.length) fail(where, "needs a shape");
      shapesFail(`${where}.shape`, g.shape);
      room(`${where}.clip`, g.clip);
      if (g.pool) {
        for (const k of ["x", "y", "r", "height"]) if (typeof g.pool[k] !== "number") fail(`${where}.pool`, `needs a number ${k}`);
      }
      for (const name of g.pool?.shadows || []) if (!h.furniture[name]?.height) fail(`${where}.pool.shadows`, `no furniture with a height called "${name}"`);
      described(where, g);
    });
    h.markers.forEach((m, i) => {
      const where = `markers[${i}]`;
      entity(`${where}.entity`, m.entity);
      if (!m.entity) fail(where, "needs an entity");
      for (const k of ["x", "y"]) if (typeof m[k] !== "number") fail(where, `needs a number ${k}`);
      if (!m.icon) fail(where, "needs an icon");
      for (const k of ["power", "wake"]) entity(`${where}.${k}`, m[k]);
      if (m.label !== void 0) {
        if (typeof m.label !== "object") fail(`${where}.label`, "needs settings ({attribute, unit, \u2026}), not a function or text");
        else {
          for (const k of Object.keys(m.label)) if (!LABEL_KEYS.includes(k)) fail(`${where}.label`, `unknown setting "${k}" (${LABEL_KEYS.join(", ")})`);
          entity(`${where}.label.entity`, m.label.entity);
          for (const k of ["when", "hide"]) if (m.label[k] !== void 0 && !Array.isArray(m.label[k])) fail(`${where}.label.${k}`, "needs a list");
        }
      }
      if (m.active !== void 0 && !Array.isArray(m.active)) fail(`${where}.active`, "needs a list of states");
      if (m.icons !== void 0 && typeof m.icons !== "object") fail(`${where}.icons`, "needs {state: icon}");
      described(where, m);
    });
    if (typeof sun.north !== "number") fail("sun.north", "needs the compass bearing of the top of the drawing");
    entity("sun.entity", sun.entity);
    entity("sun.weather", sun.weather);
    sun.spill.forEach((p, i) => {
      room(`sun.spill[${i}].clip`, p.clip);
      for (const k of p.from || []) if (!h.openings[k]) fail(`sun.spill[${i}].from`, `no opening ${k}`);
      described(`sun.spill[${i}]`, p);
    });
    shapesFail("sun.outdoor", sun.outdoor);
    sun.blockers.forEach((b, i) => {
      if (!b.rect && !b.poly) fail(`sun.blockers[${i}]`, "needs a rect or a poly");
      if (!(b.height > 0)) fail(`sun.blockers[${i}]`, "needs a height in metres");
      described(`sun.blockers[${i}]`, b);
    });
    for (const mode of ["light", "dark"]) {
      for (const [k, v] of Object.entries(h.palette[mode])) if (typeof v !== "string") fail(`palette.${mode}.${k}`, "needs a colour");
    }
    for (const k of h.palette.tinted) {
      if (!/^#[0-9a-f]{6}$/i.test(h.palette.light[k] ?? "#000000") || !/^#[0-9a-f]{6}$/i.test(h.palette.dark[k] ?? "#000000")) {
        fail(`palette.tinted`, `"${k}" needs #rrggbb colours to be tinted`);
      }
    }
    for (const [name, sc] of Object.entries(h.simulator?.scenes || {})) {
      if (typeof sc === "string") {
        if (!h.simulator.scenes[sc]) fail(`simulator.scenes.${name}`, `no scene called "${sc}"`);
        continue;
      }
      for (const k of ["lights", "media"]) if (sc[k] !== void 0 && !["on", "off"].includes(sc[k])) fail(`simulator.scenes.${name}.${k}`, "needs 'on' or 'off'");
      for (const id of Object.keys(sc.shutters || {})) entity(`simulator.scenes.${name}.shutters`, id);
    }
    if (errors.length) throw new Error(`Invalid home:
${errors.join("\n")}`);
    return h;
  }
  var entitiesOf = (home) => [.../* @__PURE__ */ new Set([
    ...home.lights.flatMap((g) => g.entities || []),
    ...home.markers.flatMap((m) => [m.entity, m.power, m.wake, m.label?.entity]).filter(Boolean),
    ...home.openings.map((o) => o.shutter).filter(Boolean),
    home.sun.entity,
    home.sun.weather
  ])];

  // src/sun.js
  var SUN_WEATHER = {
    sunny: 1,
    "clear-night": 0,
    windy: 0.9,
    "windy-variant": 0.6,
    partlycloudy: 0.6,
    cloudy: 0.15,
    fog: 0.1,
    rainy: 0.1,
    pouring: 0.05,
    snowy: 0.1,
    "snowy-rainy": 0.05,
    hail: 0.05,
    lightning: 0.05,
    "lightning-rainy": 0.05,
    exceptional: 0.3
  };
  var DAYLIGHT = [
    [-12, 15, 25, 70, 0.5],
    [-5, 70, 60, 140, 0.35],
    [0, 255, 130, 70, 0.22],
    [8, 255, 185, 110, 0.12],
    [20, 150, 140, 110, 0.14]
  ];
  var daylight = (elevation) => clamp((elevation + 4) / 14);
  function floorTint(el, clouds, dark) {
    const k = DAYLIGHT.findIndex((st) => st[0] > el);
    const [a, b] = k < 0 ? [DAYLIGHT.at(-1), DAYLIGHT.at(-1)] : k === 0 ? [DAYLIGHT[0], DAYLIGHT[0]] : [DAYLIGHT[k - 1], DAYLIGHT[k]];
    const t = b[0] === a[0] ? 0 : (el - a[0]) / (b[0] - a[0]), v = (n) => a[n] + (b[n] - a[n]) * t;
    const day = clamp(el / 6), grey = 0.7 * clouds * day;
    return {
      color: [1, 2, 3].map((n) => Math.round(v(n) * (1 - grey) + 140 * grey)),
      opacity: Math.max(v(4), 0.18 * clouds * day) * (dark ? 0.6 : 1)
    };
  }
  function labelColors(under, [skyColor, skyOp]) {
    const c = under.map((v, i) => Math.round(v * (1 - skyOp * 0.8) + skyColor[i] * skyOp * 0.8));
    const light = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 > 0.5;
    return { fill: light ? "rgba(70, 62, 25, 0.7)" : "rgba(245, 240, 220, 0.8)", halo: `rgba(${c.join(", ")}, 0.6)` };
  }
  function sunScene(home, states, north = home.sun.north, dark = false) {
    const { openings, sun: { trees, spill }, units_per_metre: u } = home;
    const sun = states[home.sun.entity]?.attributes || {}, weather = states[home.sun.weather];
    const el = sun.elevation ?? -90, azDeg = sun.azimuth ?? 0;
    const rel = (azDeg - north) * Math.PI / 180;
    const tx = -Math.sin(rel), ty = Math.cos(rel);
    const cc = weather?.attributes.cloud_coverage;
    const clear = typeof cc === "number" ? 1 - 0.85 * cc / 100 : SUN_WEATHER[weather?.state] ?? 0.5;
    const tint = floorTint(el, typeof cc === "number" ? cc / 100 : 1 - clear, dark);
    const m = clamp(el / 25), mix = (a, b) => Math.round(a + (b - a) * m);
    const sky = { color: [mix(255, 236), mix(185, 243), mix(130, 255)], opacity: daylight(el) * (dark ? 0.65 : 0.85) };
    const position = (o) => states[o.shutter]?.attributes.current_position ?? 100;
    const spills = spill.map((p) => p.k * p.from.reduce((t, i) => t + position(openings[i]), 0) / p.from.length / 100);
    const facing = openings.map((o) => el > 0 ? clamp(-(tx * SIDES[o.wall][0] + ty * SIDES[o.wall][1] + 0.05) / 0.2) : 0);
    const lit = facing.some((f) => f > 0);
    const behind = trees ? clamp(Math.min((azDeg - trees.from) / 4, (trees.to - azDeg) / 4, (trees.top - el) / 2)) : 0;
    const leaves = 1 - behind * (1 - (trees?.through ?? 1));
    const scene = {
      el,
      tx,
      ty,
      tint,
      sky,
      spills,
      lit,
      skyThrough: openings.map((o) => position(o) / 100),
      opacity: lit ? clear * leaves * Math.min(1, el / 6) : 0,
      facing
    };
    if (!lit) return scene;
    scene.fill = `rgb(255, ${mix(150, 248)}, ${mix(70, 220)})`;
    scene.blur = (3 + 20 * (1 - clear) + 12 * behind).toFixed(1);
    scene.patches = openings.map((o, k) => {
      const hi = o.lo + (o.hi - o.lo) * position(o) / 100;
      if (!facing[k] || hi - o.lo < 0.02) return "";
      const [a, b] = ends(o), at = ([x, y], h) => [x + tx * run(el, h, u), y + ty * run(el, h, u)];
      return points([at(a, o.lo), at(b, o.lo), at(b, hi), at(a, hi)]);
    });
    return scene;
  }
  var run = (el, h, unitsPerMetre) => Math.min(h / Math.tan(el * Math.PI / 180), 20) * unitsPerMetre;
  function sunShadows(home, { el, tx, ty }) {
    const u = home.units_per_metre, rooms = [...new Set(Object.values(home.furniture).map((p) => p.shadow_room).filter(Boolean))];
    const cast = (pieces) => pieces.map(([p, h]) => castAlong(p, tx * run(el, h, u), ty * run(el, h, u))).join("");
    const blockers = home.sun.blockers.map((b) => [b.rect ? box(...b.rect) : b.poly, b.height]);
    return { walls: cast(blockers), rooms: rooms.map((room) => [room, cast(castersIn(home.furniture, room))]) };
  }

  // src/loader.js
  var EDITOR = "lightwell-card-editor.js";
  var VERSION = true ? "0.2.0" : void 0;
  function scriptUrl(stack) {
    const m = String(stack || "").match(/(https?:\/\/[^\s()'"@]+?\.js)(\?[^\s():'"]*)?/);
    return m ? m[1] + (m[2] || "") : void 0;
  }
  function editorUrls(self, version) {
    const urls = [];
    if (self) {
      const u = new URL(self);
      u.pathname = u.pathname.replace(/[^/]*$/, EDITOR);
      urls.push(u.href);
    }
    if (version) urls.push(`https://cdn.jsdelivr.net/gh/viktorbalog/lightwell-card@v${version}/dist/${EDITOR}`);
    return urls;
  }
  var SELF = (() => {
    try {
      return document.currentScript?.src || scriptUrl(new Error().stack);
    } catch {
      return void 0;
    }
  })();
  var script = (url) => new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), { src: url });
    s.onload = resolve;
    s.onerror = () => {
      s.remove();
      reject(new Error(`${url} didn't load`));
    };
    document.head.append(s);
  });
  var loading;
  function loadEditor() {
    if (customElements.get("lightwell-card-editor")) return Promise.resolve();
    loading ?? (loading = editorUrls(SELF, VERSION).reduce((p, url) => p.catch(() => script(url)), Promise.reject(new Error("no address"))).then(() => customElements.whenDefined("lightwell-card-editor")).catch((e) => {
      loading = null;
      throw new Error(`Lightwell's editor couldn't be loaded (${e.message}): edit the card in YAML instead.`);
    }));
    return loading;
  }

  // src/stub.js
  function stubHome(states = {}) {
    const light = Object.keys(states).sort().find((id) => id.startsWith("light.")) || "light.living_room";
    return {
      description: "A new home: change it in the card editor, or describe yours as the README says.",
      view: { x: -20, y: -20, w: 590, h: 490 },
      units_per_metre: 100,
      rooms: { room: [[25, 25, 500, 400]] },
      drawing: {
        floors: [{ rect: [25, 25, 500, 400], class: "floor", part: "room" }],
        walls: [
          { rect: [0, 0, 550, 25], class: "wall", part: "room" },
          { rect: [0, 425, 175, 25], class: "wall", part: "room" },
          { rect: [375, 425, 175, 25], class: "wall", part: "room" },
          { rect: [0, 25, 25, 400], class: "wall", part: "room" },
          { rect: [525, 25, 25, 400], class: "wall", part: "room" }
        ],
        glazing: [{ rect: [175, 432, 200, 10], class: "glass", part: "window_1" }],
        labels: [{ text: "Room", at: [275, 90], class: "room", part: "room" }]
      },
      openings: [{ wall: "bottom", at: 450, depth: 25, x: 175, w: 200, lo: 0.9, hi: 2.2, room: "room", part: "window_1" }],
      furniture: { sofa: { shape: { rect: [175, 300, 200, 85], rx: 8 }, height: 0.8, shadow_room: "room" } },
      lights: [{
        entities: [light],
        shape: [{ circle: [275, 200, 60] }],
        over: true,
        clip: "room",
        pool: { x: 275, y: 200, r: 350, height: 1.5, shadows: ["sofa"] },
        part: "lamp_1"
      }],
      markers: [{ entity: light, x: 275, y: 200, icon: "mdi:ceiling-light", tap: "toggle", part: "lamp_1" }],
      sun: { north: 0 }
    };
  }

  // src/card.js
  var NS = "http://www.w3.org/2000/svg";
  var REDUCED = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  var PALETTE = {
    light: {
      floor: "#ece06a",
      wall: "#000",
      iwall: "#525252",
      fix: "#b5b5b5",
      fix2: "#808080",
      glass: "#4dbdbd",
      furn: "#fbf6d6",
      furn2: "#e4dba2",
      stroke: "#77704a",
      dev: "#3a3a3a",
      room: "rgba(110, 100, 40, 0.45)",
      chip: "rgba(255, 255, 255, 0.85)",
      "chip-text": "#333"
    },
    dark: {
      floor: "#3d3a2a",
      wall: "#0a0a0a",
      iwall: "#1c1c1c",
      fix: "#5a5a5a",
      fix2: "#474747",
      glass: "#4dbdbd",
      furn: "#57533e",
      furn2: "#6b6648",
      stroke: "#26241a",
      dev: "#111",
      room: "rgba(230, 220, 170, 0.3)",
      chip: "rgba(20, 20, 20, 0.75)",
      "chip-text": "#eee"
    },
    tinted: ["floor", "furn", "furn2", "fix", "fix2"]
  };
  var OWN_RULES = ["stroke", "room", "chip", "chip-text", "furn", "furn2"];
  var rgbOf = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
  var vars = (palette) => Object.entries(palette).map(([k, v]) => `--${k}: ${v};`).join(" ");
  var paletteOf = (home) => ({
    light: { ...PALETTE.light, ...home.palette.light },
    dark: { ...PALETTE.dark, ...home.palette.dark },
    tinted: [.../* @__PURE__ */ new Set([...PALETTE.tinted, ...home.palette.tinted])]
  });
  var style = (palette) => `
  :host { ${vars(palette.light)} }
  :host([dark]) { ${vars(palette.dark)} }
  ha-card { overflow: hidden; }
  .plan { position: relative; container-type: inline-size; }
  svg { display: block; width: 100%; height: auto; }
  /* A picture of the plan doesn't take the theme's colours: dimmed in the dark theme instead. */
  :host([dark]) .background { filter: brightness(0.42) saturate(0.8); }
  ${Object.keys(palette.light).filter((k) => !OWN_RULES.includes(k)).map((k) => `.${k} { fill: var(--${k}); }`).join(" ")}
  /* Strokes and text in the drawing's units, scaled with the view's width (--k, set per home) so they look the same
     on any drawing. */
  .furn { fill: var(--furn); stroke: var(--stroke); stroke-width: calc(4px * var(--k, 1)); }
  .furn2 { fill: var(--furn2); stroke: var(--stroke); stroke-width: calc(3px * var(--k, 1)); }
  .line { stroke: var(--stroke); stroke-width: calc(3px * var(--k, 1)); fill: none; }
  .lbl { font: calc(24px * var(--k, 1)) sans-serif; fill: var(--lbl, var(--stroke)); text-anchor: middle; }
  .room { font: 600 calc(40px * var(--k, 1)) sans-serif; fill: var(--room); text-anchor: middle; }
  .lbl, .room { stroke: var(--lbl-halo, transparent); stroke-width: calc(5px * var(--k, 1)); stroke-linejoin: round;
                paint-order: stroke; transition: fill 1s, stroke 1s; }
  .room { stroke: var(--room-halo, transparent); stroke-width: calc(9px * var(--k, 1)); }
  #glows > *, #glows-top > *, #glows-over > * { filter: url(#blur); transition: opacity 0.4s, fill 0.4s, stroke 0.4s; }
  #cast > g { fill: #000; filter: url(#penumbra); transition: opacity 0.4s; }
  #sun, #sun-on-furn { transition: opacity 1s; }
  #skylight { transition: opacity 1s; } #skylight > ellipse { transition: opacity 0.4s; }
  #shutters > rect { fill: #202020; transition: opacity 0.4s; }
  .m { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column;
       align-items: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .m ha-icon { --mdc-icon-size: 4.6cqw; color: var(--state-inactive-color, #8a8a8a); padding: 0.6cqw;
               border-radius: 50%; background: var(--chip); box-shadow: 0 0 0.6cqw rgba(0, 0, 0, 0.25);
               transition: color 0.3s; }
  .m.small ha-icon { --mdc-icon-size: 3.2cqw; padding: 0.4cqw; }
  .m.on ha-icon { color: var(--marker-color, var(--state-active-color, #f9a825)); }
  .m.unavailable { opacity: 0.45; }
  .m span { font: 500 2.6cqw/1.2 sans-serif; color: var(--chip-text); background: var(--chip); margin-top: 0.3cqw;
            padding: 0 0.6cqw; border-radius: 0.8cqw; white-space: nowrap; max-width: 22cqw;
            overflow: hidden; text-overflow: ellipsis; }
  .m span:empty { display: none; }
  .m.side { flex-direction: row; transform: translate(-2cqw, -50%); }
  .m.side span { margin: 0 0 0 0.4cqw; }
`;
  function planSvg(home) {
    const d = home.drawing, slot = (k) => shapesSvg(d[k]), bg = d.background;
    const [bx, by, bw, bh] = bg?.rect || [home.view.x, home.view.y, home.view.w, home.view.h];
    return `
  ${bg ? `<image class="background" href="${bg.image.replace(/"/g, "&quot;")}" x="${bx}" y="${by}" width="${bw}" height="${bh}" preserveAspectRatio="none"/>
    <rect id="background-tint" x="${bx}" y="${by}" width="${bw}" height="${bh}" opacity="0"/>` : ""}
  ${slot("floors")}
  <g id="skylight"></g>
  <g id="sun" mask="url(#sun-mask)" filter="url(#sunblur)"><g id="sun-light">${shapesSvg(home.sun.outdoor)}</g></g>
  <g id="glows"></g>
  ${slot("walls")}
  ${slot("glazing")}
  <g id="shutters"></g>
  ${slot("fittings")}
  <g id="glows-top"></g>
  <g id="cast"></g>
  ${slot("under_furniture")}
  ${furnitureSvg(home.furniture)}
  ${slot("on_furniture")}
  <g clip-path="url(#furn-clip)" opacity="0.4"><use href="#skylight"/><use id="sun-on-furn" href="#sun-light" filter="url(#sunblur)" mask="url(#sun-mask-walls)"/></g>
  <g id="glows-over"></g>
  ${slot("labels")}
`;
  }
  var overView = (v) => `filterUnits="userSpaceOnUse" x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}"`;
  var blur = (v, id, sd) => `<filter id="${id}" ${overView(v)}><feGaussianBlur stdDeviation="${sd}"/></filter>`;
  var maskOverView = (v, id) => `<mask id="${id}" ${overView(v).replace("filterUnits", "maskUnits")}>`;
  var written = /* @__PURE__ */ new WeakMap();
  function put(el, key, value, write) {
    let m = written.get(el);
    if (!m) written.set(el, m = /* @__PURE__ */ new Map());
    if (m.get(key) === value) return;
    m.set(key, value);
    write();
  }
  var attr = (el, name, v) => put(el, name, String(v), () => el.setAttribute(name, v));
  var css = (el, prop, v) => put(el, `style:${prop}`, String(v), () => el.style.setProperty(prop, String(v)));
  var text = (el, v) => put(el, "text", v, () => {
    el.textContent = v;
  });
  var svgEl = (tag, attrs2 = {}, html = "") => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs2).forEach(([k, v]) => el.setAttribute(k, v));
    el.innerHTML = html;
    return el;
  };
  var paintProp = (sh) => sh.tagName === "path" ? "stroke" : "fill";
  var previews = /* @__PURE__ */ new Set();
  window.addEventListener("lightwell-editor-open", () => previews.forEach((card) => card._offer()));
  var FloorplanCard = class extends HTMLElement {
    set preview(on) {
      this._isPreview = !!on;
      if (on) {
        previews.add(this);
        this._offer();
      } else previews.delete(this);
    }
    get preview() {
      return !!this._isPreview;
    }
    _offer() {
      window.dispatchEvent(new CustomEvent("lightwell-preview", { detail: this }));
    }
    // An editor's layer over the card (selection, handles, drawing), kept there through rebuilds; null removes it.
    // While it's there, taps on the markers do nothing (they'd act on the house while the home is being edited).
    set editLayer(layer) {
      if (this._editLayer && this._editLayer !== layer) this._editLayer.remove();
      this._editLayer = layer;
      if (layer) Object.assign(this.style, { display: "block", position: "relative" });
      if (layer && this.shadowRoot && layer.parentNode !== this.shadowRoot) this.shadowRoot.append(layer);
    }
    get editLayer() {
      return this._editLayer;
    }
    // States the editor shows on this card instead of HA's ({entity_id: state}), or null.
    set simulated(states) {
      this._simulated = states;
      if (this._hass) this.hass = this._hass;
    }
    setConfig(config) {
      this._config = config;
      this._seen = null;
      const source = this.constructor.home || config.home || config.home_url;
      if (!source) throw new Error("The card needs a home: home (the home itself) or home_url (a JSON file with it)");
      if (source === this._source) return;
      this._source = source;
      if (typeof source === "string") this._load(source);
      else this._build(source === this.constructor.home ? source : defineHome(source));
    }
    // A home from a JSON file; a failure shows in the card.
    async _load(url) {
      try {
        const r = await fetch(url, { cache: "no-cache" });
        if (!r.ok) throw new Error(`${url}: ${r.status} ${r.statusText}`);
        const home = defineHome(await r.json());
        if (this._source === url) this._build(home);
      } catch (e) {
        if (this._source === url) this._showError(e.message.includes(url) ? e.message : `${url}: ${e.message}`);
      }
    }
    _showError(message) {
      this._home = null;
      clearTimeout(this._timer);
      (this.shadowRoot || this.attachShadow({ mode: "open" })).innerHTML = `<ha-card><pre style="margin: 0; padding: 16px;
      white-space: pre-wrap; color: var(--error-color, #db4437)"></pre></ha-card>`;
      this.shadowRoot.querySelector("pre").textContent = message;
    }
    // Builds the plan for `home` (once per home); every `hass` update then only renders changes.
    _build(home) {
      this._home = home;
      this._seen = null;
      const VB = home.view;
      const km = this._km = home.units_per_metre / 175;
      clearTimeout(this._timer);
      this._entities = entitiesOf(home);
      this._palette = paletteOf(home);
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      const pos = (x, y) => `left:${((x - VB.x) / VB.w * 100).toFixed(2)}%;top:${((y - VB.y) / VB.h * 100).toFixed(2)}%`;
      const layer = this._editLayer?.parentNode === this.shadowRoot ? this._editLayer : null;
      if (layer) {
        for (const n of [...this.shadowRoot.childNodes]) if (n !== layer) n.remove();
      }
      (layer ? (html) => layer.insertAdjacentHTML("beforebegin", html) : (html) => {
        this.shadowRoot.innerHTML = html;
      })(`<style>${style(this._palette)}</style>
      <ha-card>
        <div class="plan" style="--k: ${+(VB.w / 1145).toFixed(4)}">
          <svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}">
            <defs>${blur(VB, "blur", 14 * km)}${blur(VB, "penumbra", 10 * km)}${blur(VB, "sunblur", 4 * km)}${blur(VB, "bounceblur", 55 * km)}
              <radialGradient id="sky-fall"><stop offset="0" stop-color="currentColor"/>
              <stop offset="0.6" stop-color="currentColor" stop-opacity="0.8"/>
              <stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>
              ${["sun-mask", "sun-mask-walls"].map((id) => `${maskOverView(VB, id)}
                <rect x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" fill="#fff"/><g fill="#000"></g></mask>`).join("")}
              ${Object.entries(home.rooms).map(([name, region]) => `<clipPath id="room-${name}">${clipShapes(region)}</clipPath>`).join("")}
              <clipPath id="furn-clip">${furnitureClip(home.furniture)}</clipPath>
            </defs>
            ${planSvg(home)}
          </svg>
          ${home.markers.map((m, i) => `<div class="m${m.small ? " small" : ""}${m.side ? " side" : ""}" data-i="${i}" style="${pos(m.x, m.y)}">
            <ha-icon icon="${m.icon}"></ha-icon><span></span></div>`).join("")}
        </div>
      </ha-card>`);
      const $ = (id) => this.shadowRoot.getElementById(id);
      this._el = {
        plan: this.shadowRoot.querySelector(".plan"),
        defs: this.shadowRoot.querySelector("defs"),
        sun: $("sun"),
        sunOnFurn: $("sun-on-furn"),
        skylight: $("skylight"),
        skyFall: $("sky-fall"),
        sunBlur: this.shadowRoot.querySelector("#sunblur feGaussianBlur"),
        sunMask: this.shadowRoot.querySelector("#sun-mask g"),
        sunMaskWalls: this.shadowRoot.querySelector("#sun-mask-walls g")
      };
      this._glows = home.lights.map((g, i) => this._buildGlow(g, i));
      this._fx = home.lights.map(() => null);
      this._shutters = home.openings.map((o) => {
        const [x, y, width, height] = shutterRect(o);
        return $("shutters").appendChild(svgEl("rect", { x, y, width, height }));
      });
      this._buildDaylight();
      this._markers = [...this.shadowRoot.querySelectorAll(".m")];
      if (this._editLayer && !layer) this.shadowRoot.append(this._editLayer);
      this._markers.forEach((el) => el.addEventListener("click", () => this._tap(home.markers[el.dataset.i])));
      if (this._io) {
        this._io.disconnect();
        this._io.observe(this._el.plan);
      }
      if (this._hass) this.hass = this._hass;
    }
    // A glow: its shape in its layer, and for a point light its pool on the floor and the furniture's shadows from it.
    _buildGlow(g, i) {
      const $ = (id) => this.shadowRoot.getElementById(id);
      const clip = g.clip ? { "clip-path": `url(#room-${g.clip})` } : {};
      const el = svgEl("g", clip, shapesSvg(g.shape));
      const layer = $(g.over ? "glows-over" : g.top ? "glows-top" : "glows");
      if (!g.pool) return { el: layer.appendChild(el), shapes: [...el.children] };
      const { x, y, r, height: h, shadows } = g.pool;
      const cast = shadows.map((n) => caster(this._home.furniture, n)).map(([p, ph]) => shadowOf(p, x, y, ph >= h ? 2.5 : Math.min(ph / (h - ph), 2.5))).join("");
      const v = this._home.view;
      this._el.defs.insertAdjacentHTML("beforeend", `${maskOverView(v, `pool-${i}`)}
      <radialGradient id="falloff-${i}"><stop offset="0" stop-color="#fff"/>
      <stop offset="0.45" stop-color="#999"/><stop offset="1" stop-color="#000"/></radialGradient>
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#falloff-${i})"/>
      <g fill="#000" filter="url(#penumbra)">${cast}</g></mask>
      ${maskOverView(v, `fade-${i}`)}<circle cx="${x}" cy="${y}" r="${r}" fill="url(#falloff-${i})"/></mask>`);
      const pool = $("glows").appendChild(svgEl(
        "g",
        clip,
        `<circle cx="${x}" cy="${y}" r="${r}" fill-opacity="0.75" mask="url(#pool-${i})"/>`
      ));
      const shade = $("cast").appendChild(svgEl("g", clip, `<g mask="url(#fade-${i})">${cast}</g>`));
      layer.appendChild(el);
      return { el, pool, shade, shapes: [...el.children, ...pool.children] };
    }
    // Per opening: the direct sun patch, its glow (the same patch, widely blurred) and the daylight pool through it;
    // then the daylight spilling on through the doors.
    _buildDaylight() {
      const sun = this.shadowRoot.getElementById("sun-light");
      const { openings, sun: { spill } } = this._home;
      this._patches = openings.map((o) => ["patch", "bounce"].map((cls) => sun.appendChild(svgEl("polygon", {
        // As attributes, not CSS, so the copy on the furniture (a <use>) gets them too.
        class: cls,
        "fill-opacity": cls === "patch" ? 0.85 : 0.55,
        "clip-path": `url(#room-${o.room})`,
        ...cls === "bounce" ? { filter: "url(#bounceblur)" } : {}
      }))));
      const ellipse = (cx, cy, rx, ry, clip) => this._el.skylight.appendChild(svgEl(
        "ellipse",
        { cx, cy, rx, ry, fill: "url(#sky-fall)", "clip-path": `url(#room-${clip})` }
      ));
      this._sky = openings.map((o) => ellipse(...skyEllipse(o, this._home.units_per_metre), o.sky));
      this._spills = spill.map((p) => ellipse(p.cx, p.cy, p.rx, p.ry, p.clip));
    }
    set hass(given) {
      this._hass = given;
      if (!this._home) return;
      const hass = this._simulated ? { ...given, states: { ...given.states, ...this._simulated } } : given;
      const dark = !!hass.themes?.darkMode, states = this._entities.map((id) => hass.states[id]);
      const seen = this._seen;
      if (seen && seen.dark === dark && seen.config === this._config && states.every((s, i) => s === seen.states[i])) return;
      this._seen = { dark, config: this._config, states };
      this.toggleAttribute("dark", dark);
      const home = this._home;
      const scene = sunScene(home, hass.states, this._config?.north ?? home.sun.north, dark);
      this._renderGlows(hass, scene);
      this._renderDaylight(scene, dark);
      this._renderSun(scene);
      home.openings.forEach((o, i) => {
        const pos = hass.states[o.shutter]?.attributes.current_position;
        css(this._shutters[i], "opacity", pos === void 0 ? 0 : (100 - pos) / 100 * 0.85);
      });
      this._renderMarkers(hass);
    }
    _renderGlows(hass, scene) {
      const outside = daylight(scene.el);
      this._home.lights.forEach((g, i) => {
        const s = g.entities?.length ? g.entities.map((e) => hass.states[e]).find((s2) => (g.states || ["on"]).includes(s2?.state)) : g.lit === "always" || g.lit === "dark" && scene.el < 0 ? { entity_id: `light ${i}`, state: "on", attributes: {} } : void 0;
        const c = s && (g.color || lightRgb(s)), color = c && rgb(c);
        const { el, pool, shade, shapes } = this._glows[i];
        if (!g.multi) shapes.forEach((sh) => attr(sh, paintProp(sh), color || "transparent"));
        const level = (s?.attributes.brightness ?? 255) / 255;
        const opacity = s ? (0.35 + 0.6 * level) * (g.outdoor ? 1 - 0.85 * outside : 1) : 0;
        css(el, "opacity", opacity);
        if (pool) css(pool, "opacity", opacity);
        if (shade) css(shade, "opacity", s ? 0.2 + 0.35 * level : 0);
        const effect = s && g.effect ? g.effect : s && !g.multi && s.attributes.effect && !["Stop", "None", "none", "off"].includes(s.attributes.effect) && !!(s.attributes.flowing ?? true) ? s.attributes.effect : null;
        const key = effect && `${s.entity_id}:${effect}:${color}`;
        if (this._fx[i]?.key !== key) {
          const playing = !!key;
          shapes.forEach((sh) => {
            css(sh, "will-change", playing ? "opacity" : "");
            if (!playing) {
              css(sh, paintProp(sh), "");
              css(sh, `${paintProp(sh)}-opacity`, "");
            }
          });
          this._fx[i] = key ? { key, tl: timeline(effect, c, this._home.effects), start: performance.now(), shapes } : null;
        }
      });
      this._play();
    }
    // Plays the running effects, all on one timer: a redraw every TICK ms while one fades, none while they all hold.
    // Not while the card is off-screen or the page hidden (the IntersectionObserver and visibilitychange call it again).
    _play() {
      clearTimeout(this._timer);
      const running = this._fx?.filter(Boolean) || [];
      if (!running.length || !this.isConnected || this._offscreen || document.hidden) return;
      const now = performance.now(), still = !!REDUCED?.matches;
      let next = Infinity;
      for (const fx of running) {
        const { color, opacity, next: wait } = frameAt(fx.tl, still ? 0 : now - fx.start);
        fx.shapes.forEach((sh) => {
          const prop = paintProp(sh), base = +(sh.getAttribute(`${prop}-opacity`) ?? 1);
          css(sh, prop, rgb(color));
          css(sh, `${prop}-opacity`, +(base * opacity).toFixed(3));
        });
        next = Math.min(next, wait);
      }
      if (!still) this._timer = setTimeout(() => this._play(), next);
    }
    connectedCallback() {
      if (this._isPreview) {
        previews.add(this);
        this._offer();
      }
      this._replay || (this._replay = () => this._play());
      document.addEventListener("visibilitychange", this._replay);
      this._io || (this._io = new IntersectionObserver(([e]) => {
        this._offscreen = !e.isIntersecting;
        this._play();
      }));
      this._io.observe(this.shadowRoot?.querySelector(".plan") || this);
      this._play();
    }
    disconnectedCallback() {
      previews.delete(this);
      document.removeEventListener("visibilitychange", this._replay);
      this._io?.disconnect();
      clearTimeout(this._timer);
    }
    // The floors tinted for the time of day, mixed into the theme's own colours (so floors, fittings and furniture all
    // change together and the lamps' glows still show on top); the labels' colours to go with them; the daylight pools.
    _renderDaylight({ tint, sky, skyThrough, spills }, dark) {
      const tinted = {};
      for (const name of this._palette.tinted) {
        tinted[name] = rgbOf(this._palette[dark ? "dark" : "light"][name]).map((b, i) => Math.round(b * (1 - tint.opacity) + tint.color[i] * tint.opacity));
        css(this._el.plan, `--${name}`, `rgb(${tinted[name].join(", ")})`);
      }
      const bgTint = this.shadowRoot.getElementById("background-tint");
      if (bgTint) {
        attr(bgTint, "fill", `rgb(${tint.color.join(", ")})`);
        attr(bgTint, "opacity", tint.opacity.toFixed(3));
      }
      for (const [label, under] of [["room", "floor"], ["lbl", "furn2"]]) {
        const { fill, halo } = labelColors(tinted[under], [sky.color, sky.opacity]);
        css(this._el.plan, `--${label}`, fill);
        css(this._el.plan, `--${label}-halo`, halo);
      }
      css(this._el.skyFall, "color", `rgb(${sky.color.join(", ")})`);
      css(this._el.skylight, "opacity", sky.opacity.toFixed(3));
      this._sky.forEach((el, k) => css(el, "opacity", skyThrough[k]));
      this._spills.forEach((el, k) => css(el, "opacity", spills[k].toFixed(3)));
    }
    // Direct sunlight: patches on the floor behind the openings, with the shadows of the blockers and the furniture.
    _renderSun(scene) {
      const { sun, sunOnFurn } = this._el;
      css(sun, "opacity", scene.opacity);
      css(sunOnFurn, "opacity", scene.opacity);
      if (!scene.lit) return;
      css(sun, "fill", scene.fill);
      css(sunOnFurn, "fill", scene.fill);
      attr(this._el.sunBlur, "stdDeviation", (scene.blur * this._km).toFixed(1));
      this._patches.forEach(([patch, glow], k) => {
        attr(patch, "points", scene.patches[k]);
        attr(glow, "points", scene.patches[k]);
        attr(patch, "fill-opacity", +(0.85 * scene.facing[k]).toFixed(3));
        attr(glow, "fill-opacity", +(0.55 * scene.facing[k]).toFixed(3));
      });
      const { walls, rooms } = sunShadows(this._home, scene);
      const all = walls + rooms.map(([clip, svg]) => `<g clip-path="url(#room-${clip})">${svg}</g>`).join("");
      put(this._el.sunMask, "html", all, () => {
        this._el.sunMask.innerHTML = all;
      });
      put(this._el.sunMaskWalls, "html", walls, () => {
        this._el.sunMaskWalls.innerHTML = walls;
      });
    }
    _renderMarkers(hass) {
      this._home.markers.forEach((m, i) => {
        const el = this._markers[i];
        const s = hass.states[m.entity];
        if (!s) {
          el.classList.add("unavailable");
          attr(el, "title", `${m.entity}: not found`);
          return;
        }
        const power = m.power ? hass.states[m.power]?.state === "on" : true;
        const on = isActive(m, s, power);
        el.classList.toggle("on", !!on);
        el.classList.toggle("unavailable", s.state === "unavailable" || !!m.power && !power);
        attr(el.firstElementChild, "icon", iconOf(m, s));
        const rgb2 = s.attributes.rgb_color;
        css(el, "--marker-color", rgb2 && Math.min(...rgb2) < 200 ? lightColor(s) : "");
        text(el.lastElementChild, labelOf(m, s, hass.states));
        const name = s.attributes.friendly_name || m.entity;
        attr(el, "title", `${name}: ${hass.formatEntityState ? hass.formatEntityState(s) : s.state}`);
      });
    }
    _tap(m) {
      if (this._editLayer) return;
      if (m.wake && this._hass.states[m.power]?.state !== "on") this._hass.callService("button", "press", { entity_id: m.wake });
      else if (m.tap === "toggle") this._hass.callService("homeassistant", "toggle", { entity_id: m.entity });
      else this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: m.entity }, bubbles: true, composed: true }));
    }
    getCardSize() {
      return 9;
    }
    getGridOptions() {
      return { columns: 12, min_columns: 6 };
    }
    // HA's visual editor: loaded on demand (loader.js), so the card's bundle stays small.
    static async getConfigElement() {
      await loadEditor();
      return document.createElement("lightwell-card-editor");
    }
    // A new card from HA's card picker: a small home that works (stub.js), with a light of the house.
    static getStubConfig(hass) {
      return { home: stubHome(hass?.states) };
    }
  };
  function defineFloorplanCard(tag, home, { name = tag, description = "" } = {}) {
    const Card = class extends FloorplanCard {
    };
    Card.home = home;
    customElements.define(tag, Card);
    window.customCards = window.customCards || [];
    window.customCards.push({ type: tag, name, description });
    return Card;
  }

  // src/index.js
  defineFloorplanCard("lightwell-card", void 0, {
    name: "Lightwell",
    description: "A living floor plan: lights in their colours, the sun and daylight through your windows, and your devices"
  });
})();
