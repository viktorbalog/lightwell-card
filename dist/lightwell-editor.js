// Lightwell 0.2.0's editor for homes (MIT licence; includes the yaml library, ISC licence).
// Built from src/editor/ by npm run build.
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/geometry.js
  var clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  var box = (x, y, w, h2, deg = 0) => {
    const cx = x + w / 2, cy = y + h2 / 2, a = deg * Math.PI / 180;
    return [[x, y], [x + w, y], [x + w, y + h2], [x, y + h2]].map(([px, py]) => [cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a), cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a)]);
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
  var clipShapes = (region) => Array.isArray(region[0][0]) ? `<polygon points="${region[0].map((p) => p.join(",")).join(" ")}"/>` : region.map(([x, y, w, h2]) => `<rect x="${x}" y="${y}" width="${w}" height="${h2}"/>`).join("");
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
      const [x, y, w, h2] = s.rect;
      return `<rect${a} x="${x}" y="${y}" width="${w}" height="${h2}"/>`;
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
  var castersIn = (furniture, room) => Object.keys(furniture).filter((n2) => furniture[n2].shadow_room === room && furniture[n2].height).map((n2) => caster(furniture, n2));

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
    const fade = def.fade || 666, at = ([h2, s, v]) => [hsvRgb(h2, s), Math.max(v, 1) / 100];
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
  function hsvRgb(h2, s) {
    const f = (n2) => {
      const k = (n2 + h2 / 60) % 6;
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
  function labelOf(m2, s, states) {
    const l = m2.label;
    if (!l || l.when && !l.when.includes(s.state)) return "";
    const src = l.entity ? states[l.entity] : s;
    let v = l.attribute ? src?.attributes[l.attribute] : src?.state;
    if (v === void 0 || v === null || v === "" || l.hide?.includes(v)) return "";
    if (l.round !== void 0) {
      const n2 = Number(v);
      if (typeof v === "boolean" || !Number.isFinite(n2)) return "";
      v = n2.toFixed(l.round).replace(/^-(0(\.0+)?)$/, "$1");
    }
    return `${v}${l.unit ?? ""}`;
  }
  function iconOf(m2, s) {
    if (m2.icons) return m2.icons[s.state] || m2.icon;
    if (m2.entity.startsWith("weather.")) return `mdi:${WEATHER_ICONS[s.state] || "help-circle-outline"}`;
    return m2.icon;
  }
  var isActive = (m2, s, powered) => m2.active ? m2.active.includes(s.state) : powered && !OFF.includes(s.state) && !m2.entity.startsWith("sensor.");

  // src/home.js
  var SLOTS = ["floors", "walls", "glazing", "fittings", "under_furniture", "on_furniture", "labels"];
  var LIT = ["always", "dark", "never"];
  function defineHome(home) {
    const h2 = { ...home };
    for (const [k, v] of Object.entries({ rooms: {}, openings: [], furniture: {}, lights: [], effects: {}, markers: [] })) h2[k] ?? (h2[k] = v);
    const sun = h2.sun = { ...home.sun }, drawing = h2.drawing = { ...home.drawing };
    for (const [k, v] of Object.entries({ entity: "sun.sun", weather: "weather.home", blockers: [], spill: [], trees: null, outdoor: [] })) sun[k] ?? (sun[k] = v);
    h2.palette = { light: {}, dark: {}, tinted: [], ...home.palette };
    const errors = [];
    const fail = (where, msg) => errors.push(`${where}: ${msg}`);
    const room = (where, name) => {
      if (name !== void 0 && !h2.rooms[name]) fail(where, `no room called "${name}"`);
    };
    const entity = (where, id) => {
      if (id !== void 0 && !/^[a-z_]+\.[a-z0-9_]+$/.test(id)) fail(where, `"${id}" isn't an entity id`);
    };
    const shapesFail = (where, list) => shapeErrors(list).forEach((e) => errors.push(e.startsWith("[") ? `${where}${e}` : `${where}: ${e}`));
    const described = (where, item) => {
      if (item?.description !== void 0 && typeof item.description !== "string") fail(where ? `${where}.description` : "description", "needs a text");
      if (where && item?.part !== void 0 && typeof item.part !== "string") fail(`${where}.part`, "needs a text");
    };
    described("", h2);
    if (!["x", "y", "w", "h"].every((k) => typeof h2.view?.[k] === "number")) fail("view", "needs numbers x, y, w and h");
    if (!(h2.units_per_metre > 0)) fail("units_per_metre", "needs a number above 0");
    for (const k of Object.keys(drawing)) if (!SLOTS.includes(k) && k !== "background") fail(`drawing.${k}`, `isn't a slot (${SLOTS.join(", ")}, background)`);
    for (const k of SLOTS) shapesFail(`drawing.${k}`, drawing[k]);
    if (drawing.background && typeof drawing.background.image !== "string") fail("drawing.background", "needs an image URL");
    for (const [name, p] of Object.entries(h2.furniture)) {
      const { rect, circle, poly } = p.shape || {};
      if (!rect && !circle && !poly) fail(`furniture.${name}`, "needs a shape: rect, circle or poly");
      room(`furniture.${name}.shadow_room`, p.shadow_room);
      if (p.height !== void 0 && !(p.height > 0)) fail(`furniture.${name}.height`, "needs a number of metres above 0");
      shapesFail(`furniture.${name}.extra`, p.extra);
      described(`furniture.${name}`, p);
    }
    h2.openings = h2.openings.map((o) => ({ ...o, sky: o.sky ?? o.room }));
    h2.openings.forEach((o, i) => {
      const where = `openings[${i}]`;
      if (o.room === void 0) fail(where, "needs the room its sun falls in");
      openingErrors(o).forEach((e) => fail(where, e));
      room(`${where}.room`, o.room);
      room(`${where}.sky`, o.sky);
      entity(`${where}.shutter`, o.shutter);
      described(where, o);
    });
    h2.lights.forEach((g, i) => {
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
      for (const name of g.pool?.shadows || []) if (!h2.furniture[name]?.height) fail(`${where}.pool.shadows`, `no furniture with a height called "${name}"`);
      described(where, g);
    });
    h2.markers.forEach((m2, i) => {
      const where = `markers[${i}]`;
      entity(`${where}.entity`, m2.entity);
      if (!m2.entity) fail(where, "needs an entity");
      for (const k of ["x", "y"]) if (typeof m2[k] !== "number") fail(where, `needs a number ${k}`);
      if (!m2.icon) fail(where, "needs an icon");
      for (const k of ["power", "wake"]) entity(`${where}.${k}`, m2[k]);
      if (m2.label !== void 0) {
        if (typeof m2.label !== "object") fail(`${where}.label`, "needs settings ({attribute, unit, \u2026}), not a function or text");
        else {
          for (const k of Object.keys(m2.label)) if (!LABEL_KEYS.includes(k)) fail(`${where}.label`, `unknown setting "${k}" (${LABEL_KEYS.join(", ")})`);
          entity(`${where}.label.entity`, m2.label.entity);
          for (const k of ["when", "hide"]) if (m2.label[k] !== void 0 && !Array.isArray(m2.label[k])) fail(`${where}.label.${k}`, "needs a list");
        }
      }
      if (m2.active !== void 0 && !Array.isArray(m2.active)) fail(`${where}.active`, "needs a list of states");
      if (m2.icons !== void 0 && typeof m2.icons !== "object") fail(`${where}.icons`, "needs {state: icon}");
      described(where, m2);
    });
    if (typeof sun.north !== "number") fail("sun.north", "needs the compass bearing of the top of the drawing");
    entity("sun.entity", sun.entity);
    entity("sun.weather", sun.weather);
    sun.spill.forEach((p, i) => {
      room(`sun.spill[${i}].clip`, p.clip);
      for (const k of p.from || []) if (!h2.openings[k]) fail(`sun.spill[${i}].from`, `no opening ${k}`);
      described(`sun.spill[${i}]`, p);
    });
    shapesFail("sun.outdoor", sun.outdoor);
    sun.blockers.forEach((b, i) => {
      if (!b.rect && !b.poly) fail(`sun.blockers[${i}]`, "needs a rect or a poly");
      if (!(b.height > 0)) fail(`sun.blockers[${i}]`, "needs a height in metres");
      described(`sun.blockers[${i}]`, b);
    });
    for (const mode of ["light", "dark"]) {
      for (const [k, v] of Object.entries(h2.palette[mode])) if (typeof v !== "string") fail(`palette.${mode}.${k}`, "needs a colour");
    }
    for (const k of h2.palette.tinted) {
      if (!/^#[0-9a-f]{6}$/i.test(h2.palette.light[k] ?? "#000000") || !/^#[0-9a-f]{6}$/i.test(h2.palette.dark[k] ?? "#000000")) {
        fail(`palette.tinted`, `"${k}" needs #rrggbb colours to be tinted`);
      }
    }
    for (const [name, sc] of Object.entries(h2.simulator?.scenes || {})) {
      if (typeof sc === "string") {
        if (!h2.simulator.scenes[sc]) fail(`simulator.scenes.${name}`, `no scene called "${sc}"`);
        continue;
      }
      for (const k of ["lights", "media"]) if (sc[k] !== void 0 && !["on", "off"].includes(sc[k])) fail(`simulator.scenes.${name}.${k}`, "needs 'on' or 'off'");
      for (const id of Object.keys(sc.shutters || {})) entity(`simulator.scenes.${name}.shutters`, id);
    }
    if (errors.length) throw new Error(`Invalid home:
${errors.join("\n")}`);
    return h2;
  }
  var entitiesOf = (home) => [.../* @__PURE__ */ new Set([
    ...home.lights.flatMap((g) => g.entities || []),
    ...home.markers.flatMap((m2) => [m2.entity, m2.power, m2.wake, m2.label?.entity]).filter(Boolean),
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
  function floorTint(el2, clouds, dark) {
    const k = DAYLIGHT.findIndex((st) => st[0] > el2);
    const [a, b] = k < 0 ? [DAYLIGHT.at(-1), DAYLIGHT.at(-1)] : k === 0 ? [DAYLIGHT[0], DAYLIGHT[0]] : [DAYLIGHT[k - 1], DAYLIGHT[k]];
    const t = b[0] === a[0] ? 0 : (el2 - a[0]) / (b[0] - a[0]), v = (n2) => a[n2] + (b[n2] - a[n2]) * t;
    const day = clamp(el2 / 6), grey = 0.7 * clouds * day;
    return {
      color: [1, 2, 3].map((n2) => Math.round(v(n2) * (1 - grey) + 140 * grey)),
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
    const el2 = sun.elevation ?? -90, azDeg = sun.azimuth ?? 0;
    const rel = (azDeg - north) * Math.PI / 180;
    const tx = -Math.sin(rel), ty = Math.cos(rel);
    const cc = weather?.attributes.cloud_coverage;
    const clear = typeof cc === "number" ? 1 - 0.85 * cc / 100 : SUN_WEATHER[weather?.state] ?? 0.5;
    const tint = floorTint(el2, typeof cc === "number" ? cc / 100 : 1 - clear, dark);
    const m2 = clamp(el2 / 25), mix = (a, b) => Math.round(a + (b - a) * m2);
    const sky = { color: [mix(255, 236), mix(185, 243), mix(130, 255)], opacity: daylight(el2) * (dark ? 0.65 : 0.85) };
    const position = (o) => states[o.shutter]?.attributes.current_position ?? 100;
    const spills = spill.map((p) => p.k * p.from.reduce((t, i) => t + position(openings[i]), 0) / p.from.length / 100);
    const facing = openings.map((o) => el2 > 0 ? clamp(-(tx * SIDES[o.wall][0] + ty * SIDES[o.wall][1] + 0.05) / 0.2) : 0);
    const lit = facing.some((f) => f > 0);
    const behind = trees ? clamp(Math.min((azDeg - trees.from) / 4, (trees.to - azDeg) / 4, (trees.top - el2) / 2)) : 0;
    const leaves = 1 - behind * (1 - (trees?.through ?? 1));
    const scene = {
      el: el2,
      tx,
      ty,
      tint,
      sky,
      spills,
      lit,
      skyThrough: openings.map((o) => position(o) / 100),
      opacity: lit ? clear * leaves * Math.min(1, el2 / 6) : 0,
      facing
    };
    if (!lit) return scene;
    scene.fill = `rgb(255, ${mix(150, 248)}, ${mix(70, 220)})`;
    scene.blur = (3 + 20 * (1 - clear) + 12 * behind).toFixed(1);
    scene.patches = openings.map((o, k) => {
      const hi = o.lo + (o.hi - o.lo) * position(o) / 100;
      if (!facing[k] || hi - o.lo < 0.02) return "";
      const [a, b] = ends(o), at = ([x, y], h2) => [x + tx * run(el2, h2, u), y + ty * run(el2, h2, u)];
      return points([at(a, o.lo), at(b, o.lo), at(b, hi), at(a, hi)]);
    });
    return scene;
  }
  var run = (el2, h2, unitsPerMetre) => Math.min(h2 / Math.tan(el2 * Math.PI / 180), 20) * unitsPerMetre;
  function sunShadows(home, { el: el2, tx, ty }) {
    const u = home.units_per_metre, rooms = [...new Set(Object.values(home.furniture).map((p) => p.shadow_room).filter(Boolean))];
    const cast = (pieces) => pieces.map(([p, h2]) => castAlong(p, tx * run(el2, h2, u), ty * run(el2, h2, u))).join("");
    const blockers = home.sun.blockers.map((b) => [b.rect ? box(...b.rect) : b.poly, b.height]);
    return { walls: cast(blockers), rooms: rooms.map((room) => [room, cast(castersIn(home.furniture, room))]) };
  }

  // src/loader.js
  var EDITOR = "lightwell-card-editor.js";
  var VERSION = true ? "0.2.0" : void 0;
  function scriptUrl(stack) {
    const m2 = String(stack || "").match(/(https?:\/\/[^\s()'"@]+?\.js)(\?[^\s():'"]*)?/);
    return m2 ? m2[1] + (m2[2] || "") : void 0;
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
  function put(el2, key, value, write) {
    let m2 = written.get(el2);
    if (!m2) written.set(el2, m2 = /* @__PURE__ */ new Map());
    if (m2.get(key) === value) return;
    m2.set(key, value);
    write();
  }
  var attr = (el2, name, v) => put(el2, name, String(v), () => el2.setAttribute(name, v));
  var css = (el2, prop, v) => put(el2, `style:${prop}`, String(v), () => el2.style.setProperty(prop, String(v)));
  var text = (el2, v) => put(el2, "text", v, () => {
    el2.textContent = v;
  });
  var svgEl = (tag, attrs2 = {}, html = "") => {
    const el2 = document.createElementNS(NS, tag);
    Object.entries(attrs2).forEach(([k, v]) => el2.setAttribute(k, v));
    el2.innerHTML = html;
    return el2;
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
        for (const n2 of [...this.shadowRoot.childNodes]) if (n2 !== layer) n2.remove();
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
          ${home.markers.map((m2, i) => `<div class="m${m2.small ? " small" : ""}${m2.side ? " side" : ""}" data-i="${i}" style="${pos(m2.x, m2.y)}">
            <ha-icon icon="${m2.icon}"></ha-icon><span></span></div>`).join("")}
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
      this._markers.forEach((el2) => el2.addEventListener("click", () => this._tap(home.markers[el2.dataset.i])));
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
      const el2 = svgEl("g", clip, shapesSvg(g.shape));
      const layer = $(g.over ? "glows-over" : g.top ? "glows-top" : "glows");
      if (!g.pool) return { el: layer.appendChild(el2), shapes: [...el2.children] };
      const { x, y, r, height: h2, shadows } = g.pool;
      const cast = shadows.map((n2) => caster(this._home.furniture, n2)).map(([p, ph]) => shadowOf(p, x, y, ph >= h2 ? 2.5 : Math.min(ph / (h2 - ph), 2.5))).join("");
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
      layer.appendChild(el2);
      return { el: el2, pool, shade, shapes: [...el2.children, ...pool.children] };
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
    set hass(hass) {
      this._hass = hass;
      if (!this._home) return;
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
        const { el: el2, pool, shade, shapes } = this._glows[i];
        if (!g.multi) shapes.forEach((sh) => attr(sh, paintProp(sh), color || "transparent"));
        const level = (s?.attributes.brightness ?? 255) / 255;
        const opacity = s ? (0.35 + 0.6 * level) * (g.outdoor ? 1 - 0.85 * outside : 1) : 0;
        css(el2, "opacity", opacity);
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
      this._sky.forEach((el2, k) => css(el2, "opacity", skyThrough[k]));
      this._spills.forEach((el2, k) => css(el2, "opacity", spills[k].toFixed(3)));
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
      this._home.markers.forEach((m2, i) => {
        const el2 = this._markers[i];
        const s = hass.states[m2.entity];
        if (!s) {
          el2.classList.add("unavailable");
          attr(el2, "title", `${m2.entity}: not found`);
          return;
        }
        const power = m2.power ? hass.states[m2.power]?.state === "on" : true;
        const on = isActive(m2, s, power);
        el2.classList.toggle("on", !!on);
        el2.classList.toggle("unavailable", s.state === "unavailable" || !!m2.power && !power);
        attr(el2.firstElementChild, "icon", iconOf(m2, s));
        const rgb2 = s.attributes.rgb_color;
        css(el2, "--marker-color", rgb2 && Math.min(...rgb2) < 200 ? lightColor(s) : "");
        text(el2.lastElementChild, labelOf(m2, s, hass.states));
        const name = s.attributes.friendly_name || m2.entity;
        attr(el2, "title", `${name}: ${hass.formatEntityState ? hass.formatEntityState(s) : s.state}`);
      });
    }
    _tap(m2) {
      if (this._editLayer) return;
      if (m2.wake && this._hass.states[m2.power]?.state !== "on") this._hass.callService("button", "press", { entity_id: m2.wake });
      else if (m2.tap === "toggle") this._hass.callService("homeassistant", "toggle", { entity_id: m2.entity });
      else this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: m2.entity }, bubbles: true, composed: true }));
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

  // node_modules/yaml/browser/dist/index.js
  var dist_exports = {};
  __export(dist_exports, {
    Alias: () => Alias,
    CST: () => cst_exports,
    Composer: () => Composer,
    Document: () => Document,
    Lexer: () => Lexer,
    LineCounter: () => LineCounter,
    Pair: () => Pair,
    Parser: () => Parser,
    Scalar: () => Scalar,
    Schema: () => Schema,
    YAMLError: () => YAMLError,
    YAMLMap: () => YAMLMap,
    YAMLParseError: () => YAMLParseError,
    YAMLSeq: () => YAMLSeq,
    YAMLWarning: () => YAMLWarning,
    isAlias: () => isAlias,
    isCollection: () => isCollection,
    isDocument: () => isDocument,
    isMap: () => isMap,
    isNode: () => isNode,
    isPair: () => isPair,
    isScalar: () => isScalar,
    isSeq: () => isSeq,
    parse: () => parse,
    parseAllDocuments: () => parseAllDocuments,
    parseDocument: () => parseDocument,
    stringify: () => stringify3,
    visit: () => visit,
    visitAsync: () => visitAsync
  });

  // node_modules/yaml/browser/dist/nodes/identity.js
  var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
  var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
  var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
  var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
  var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
  var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
  var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
  var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

  // node_modules/yaml/browser/dist/visit.js
  var BREAK = /* @__PURE__ */ Symbol("break visit");
  var SKIP = /* @__PURE__ */ Symbol("skip children");
  var REMOVE = /* @__PURE__ */ Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (isNode(ctrl) || isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i = 0; i < node.items.length; ++i) {
          const ci = visit_(i, node.items[i], visitor, path);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = visit_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path) {
    const ctrl = await callVisitor(key, node, visitor, path);
    if (isNode(ctrl) || isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visitAsync_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i = 0; i < node.items.length; ++i) {
          const ci = await visitAsync_(i, node.items[i], visitor, path);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path) {
    if (typeof visitor === "function")
      return visitor(key, node, path);
    if (isMap(node))
      return visitor.Map?.(key, node, path);
    if (isSeq(node))
      return visitor.Seq?.(key, node, path);
    if (isPair(node))
      return visitor.Pair?.(key, node, path);
    if (isScalar(node))
      return visitor.Scalar?.(key, node, path);
    if (isAlias(node))
      return visitor.Alias?.(key, node, path);
    return void 0;
  }
  function replaceNode(key, path, node) {
    const parent = path[path.length - 1];
    if (isCollection(parent)) {
      parent.items[key] = node;
    } else if (isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }

  // node_modules/yaml/browser/dist/doc/directives.js
  var escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
  var Directives = class _Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, _Directives.defaultTags, tags);
    }
    clone() {
      const copy = new _Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
      const res = new _Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: _Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, _Directives.defaultTags);
          break;
      }
      return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, _Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
        const tags = {};
        visit(doc.contents, (_key, node) => {
          if (isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join("\n");
    }
  };
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

  // node_modules/yaml/browser/dist/doc/anchors.js
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors2 = /* @__PURE__ */ new Set();
    visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors2.add(node.anchor);
      }
    });
    return anchors2;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i = 1; true; ++i) {
      const name = `${prefix}${i}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = /* @__PURE__ */ new Map();
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        prevAnchors ?? (prevAnchors = anchorNames(doc));
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      /**
       * With circular references, the source node is only resolved after all
       * of its child nodes are. This is why anchors are set only after all of
       * the nodes have been created.
       */
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }

  // node_modules/yaml/browser/dist/doc/applyReviver.js
  function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0, len = val.length; i < len; ++i) {
          const v0 = val[i];
          const v1 = applyReviver(reviver, val, String(i), v0);
          if (v1 === void 0)
            delete val[i];
          else if (v1 !== v0)
            val[i] = v1;
        }
      } else if (val instanceof Map) {
        for (const k of Array.from(val.keys())) {
          const v0 = val.get(k);
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === void 0)
            val.delete(k);
          else if (v1 !== v0)
            val.set(k, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver(reviver, val, v0, v0);
          if (v1 === void 0)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k, v0] of Object.entries(val)) {
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === void 0)
            delete val[k];
          else if (v1 !== v0)
            val[k] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }

  // node_modules/yaml/browser/dist/nodes/toJS.js
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: void 0 };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }

  // node_modules/yaml/browser/dist/nodes/Node.js
  var NodeBase = class {
    constructor(type) {
      Object.defineProperty(this, NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
  };

  // node_modules/yaml/browser/dist/nodes/Alias.js
  var Alias = class extends NodeBase {
    constructor(source) {
      super(ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc, ctx) {
      if (ctx?.maxAliasCount === 0)
        throw new ReferenceError("Alias resolution is disabled");
      let nodes;
      if (ctx?.aliasResolveCache) {
        nodes = ctx.aliasResolveCache;
      } else {
        nodes = [];
        visit(doc, {
          Node: (_key, node) => {
            if (isAlias(node) || hasAnchor(node))
              nodes.push(node);
          }
        });
        if (ctx)
          ctx.aliasResolveCache = nodes;
      }
      let found = void 0;
      for (const node of nodes) {
        if (node === this)
          break;
        if (node.anchor === this.source)
          found = node;
      }
      if (found && ctx) {
        const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
        let data = anchors2.get(found);
        if (!data) {
          toJS(found, null, ctx);
          data = anchors2.get(found);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc2, found, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
      }
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const source = this.resolve(ctx.doc, ctx);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      return ctx.anchors.get(source).res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  };
  function getAliasCount(doc, node, anchors2) {
    if (isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors2 && source && anchors2.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c = getAliasCount(doc, item, anchors2);
        if (c > count)
          count = c;
      }
      return count;
    } else if (isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors2);
      const vc = getAliasCount(doc, node.value, anchors2);
      return Math.max(kc, vc);
    }
    return 1;
  }

  // node_modules/yaml/browser/dist/nodes/Scalar.js
  var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
  var Scalar = class extends NodeBase {
    constructor(value) {
      super(SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  };
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

  // node_modules/yaml/browser/dist/doc/createNode.js
  var defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode(value, tagName, ctx) {
    if (isDocument(value))
      value = value.contents;
    if (isNode(value))
      return value;
    if (isPair(value)) {
      const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
      map2.items.push(value);
      return map2;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
    let ref = void 0;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        ref.anchor ?? (ref.anchor = onAnchor(value));
        return new Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema4.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }

  // node_modules/yaml/browser/dist/nodes/Collection.js
  function collectionFromPath(schema4, path, value) {
    let v = value;
    for (let i = path.length - 1; i >= 0; --i) {
      const k = path[i];
      if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
        const a = [];
        a[k] = v;
        v = a;
      } else {
        v = /* @__PURE__ */ new Map([[k, v]]);
      }
    }
    return createNode(v, void 0, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema: schema4,
      sourceObjects: /* @__PURE__ */ new Map()
    });
  }
  var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
  var Collection = class extends NodeBase {
    constructor(type, schema4) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema4,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema4) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema4)
        copy.schema = schema4;
      copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path, value) {
      if (isEmptyPath(path))
        this.add(value);
      else {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (isCollection(node))
          node.addIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && isScalar(node) ? node.value : node;
      else
        return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!isPair(node))
          return false;
        const n2 = node.value;
        return n2 == null || allowScalar && isScalar(n2) && n2.value == null && !n2.commentBefore && !n2.comment && !n2.tag;
      });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      const [key, ...rest] = path;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (isCollection(node))
          node.setIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyComment.js
  var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

  // node_modules/yaml/browser/dist/stringify/foldFlowLines.js
  var FOLD_FLOW = "flow";
  var FOLD_BLOCK = "block";
  var FOLD_QUOTED = "quoted";
  function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text2;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text2.length <= endStep)
      return text2;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = void 0;
    let prev = void 0;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text2, i, indent.length);
      if (i !== -1)
        end = i + endStep;
    }
    for (let ch; ch = text2[i += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i;
        switch (text2[i + 1]) {
          case "x":
            i += 3;
            break;
          case "u":
            i += 5;
            break;
          case "U":
            i += 9;
            break;
          default:
            i += 1;
        }
        escEnd = i;
      }
      if (ch === "\n") {
        if (mode === FOLD_BLOCK)
          i = consumeMoreIndentedLines(text2, i, indent.length);
        end = i + indent.length + endStep;
        split = void 0;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
          const next = text2[i + 1];
          if (next && next !== " " && next !== "\n" && next !== "	")
            split = i;
        }
        if (i >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = void 0;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "	") {
              prev = ch;
              ch = text2[i += 1];
              overflow = true;
            }
            const j = i > escEnd + 1 ? i - 2 : escStart - 1;
            if (escapedFolds[j])
              return text2;
            folds.push(j);
            escapedFolds[j] = true;
            end = j + endStep;
            split = void 0;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text2;
    if (onFold)
      onFold();
    let res = text2.slice(0, folds[0]);
    for (let i2 = 0; i2 < folds.length; ++i2) {
      const fold = folds[i2];
      const end2 = folds[i2 + 1] || text2.length;
      if (fold === 0)
        res = `
${indent}${text2.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text2[fold]}\\`;
        res += `
${indent}${text2.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text2, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text2[start];
    while (ch === " " || ch === "	") {
      if (i < start + indent) {
        ch = text2[++i];
      } else {
        do {
          ch = text2[++i];
        } while (ch && ch !== "\n");
        end = i;
        start = i + 1;
        ch = text2[start];
      }
    }
    return end;
  }

  // node_modules/yaml/browser/dist/stringify/stringifyString.js
  var getFoldOptions = (ctx, isBlock2) => ({
    indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i = 0, start = 0; i < strLen; ++i) {
      if (str[i] === "\n") {
        if (i - start > limit)
          return true;
        start = i + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
      if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
        str += json.slice(start, i) + "\\ ";
        i += 1;
        start = i;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i + 1]) {
          case "u":
            {
              str += json.slice(start, i);
              const code = json.substr(i + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i, 6);
              }
              i += 5;
              start = i + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
              i += 1;
            } else {
              str += json.slice(start, i) + "\n\n";
              while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                str += "\n";
                i += 2;
              }
              str += indent;
              if (json[i + 2] === " ")
                str += "\\";
              i += 1;
              start = i + 1;
            }
            break;
          default:
            i += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  var blockEndNewlines;
  try {
    blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? "|\n" : ">\n";
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== "\n" && ch !== "	" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf("\n");
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === "\n")
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === "\n")
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.BLOCK_FOLDED:
        case Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }

  // node_modules/yaml/browser/dist/stringify/stringify.js
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trailingComma: false,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: /* @__PURE__ */ new Set(),
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item) {
    if (item.tag) {
      const match = tags.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = void 0;
    let obj;
    if (isScalar(item)) {
      obj = item.value;
      let match = tags.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors: anchors2, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
    if (anchor && anchorIsValid(anchor)) {
      anchors2.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item, ctx, onComment, onChompKeep) {
    if (isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if (ctx.resolvedAliases?.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = void 0;
    const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }

  // node_modules/yaml/browser/dist/stringify/stringifyPair.js
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (isCollection(key) || !isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? "\n" : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === "\n" && valueComment)
          ws = "\n\n";
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf("\n");
      const hasNewline = nl0 !== -1;
      const flow2 = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow2) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === "\n") {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }

  // node_modules/yaml/browser/dist/log.js
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      console.warn(warning);
    }
  }

  // node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
  var MERGE_KEY = "<<";
  var merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
  function addMergeToJSMap(ctx, map2, value) {
    const source = resolveAliasValue(ctx, value);
    if (isSeq(source))
      for (const it of source.items)
        mergeValue(ctx, map2, it);
    else if (Array.isArray(source))
      for (const it of source)
        mergeValue(ctx, map2, it);
    else
      mergeValue(ctx, map2, source);
  }
  function mergeValue(ctx, map2, value) {
    const source = resolveAliasValue(ctx, value);
    if (!isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map2 instanceof Map) {
        if (!map2.has(key))
          map2.set(key, value2);
      } else if (map2 instanceof Set) {
        map2.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
        Object.defineProperty(map2, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map2;
  }
  function resolveAliasValue(ctx, value) {
    return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
  }

  // node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
  function addPairToJSMap(ctx, map2, { key, value }) {
    if (isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map2, value);
    else if (isMergeKey(ctx, key))
      addMergeToJSMap(ctx, map2, value);
    else {
      const jsKey = toJS(key, "", ctx);
      if (map2 instanceof Map) {
        map2.set(jsKey, toJS(value, jsKey, ctx));
      } else if (map2 instanceof Set) {
        map2.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS(value, stringKey, ctx);
        if (stringKey in map2)
          Object.defineProperty(map2, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map2[stringKey] = jsValue;
      }
    }
    return map2;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (isNode(key) && ctx?.doc) {
      const strCtx = createStringifyContext(ctx.doc, {});
      strCtx.anchors = /* @__PURE__ */ new Set();
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }

  // node_modules/yaml/browser/dist/nodes/Pair.js
  function createPair(key, value, ctx) {
    const k = createNode(key, void 0, ctx);
    const v = createNode(value, void 0, ctx);
    return new Pair(k, v);
  }
  var Pair = class _Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, NODE_TYPE, { value: PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema4) {
      let { key, value } = this;
      if (isNode(key))
        key = key.clone(schema4);
      if (isNode(value))
        value = value.clone(schema4);
      return new _Pair(key, value);
    }
    toJSON(_, ctx) {
      const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      return addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyCollection.js
  function stringifyCollection(collection, ctx, options) {
    const flow2 = ctx.inFlow ?? collection.flow;
    const stringify4 = flow2 ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify4(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      let comment2 = null;
      if (isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment2 = item.comment;
      } else if (isPair(item)) {
        const ik = isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i];
        str += line ? `
${indent}${line}` : "\n";
      }
    }
    if (comment) {
      str += "\n" + indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      let comment = null;
      if (isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment = item.comment;
      } else if (isPair(item)) {
        const ik = isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify(item, itemCtx, () => comment = null);
      reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
      if (i < items.length - 1) {
        str += ",";
      } else if (ctx.options.trailingComma) {
        if (ctx.options.lineWidth > 0) {
          reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
        }
        if (reqNewline) {
          str += ",";
        }
      }
      if (comment)
        str += lineComment(str, itemIndent, commentString(comment));
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : "\n";
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }

  // node_modules/yaml/browser/dist/nodes/YAMLMap.js
  function findPair(items, key) {
    const k = isScalar(key) ? key.value : key;
    for (const it of items) {
      if (isPair(it)) {
        if (it.key === key || it.key === k)
          return it;
        if (isScalar(it.key) && it.key.value === k)
          return it;
      }
    }
    return void 0;
  }
  var YAMLMap = class extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema4) {
      super(MAP, schema4);
      this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema4, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map2 = new this(schema4);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== void 0 || keepUndefined)
          map2.items.push(createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema4.sortMapEntries === "function") {
        map2.items.sort(schema4.sortMapEntries);
      }
      return map2;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair, overwrite) {
      let _pair;
      if (isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair(pair, pair?.value);
      } else
        _pair = new Pair(pair.key, pair.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (isScalar(prev.value) && isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i === -1)
          this.items.push(_pair);
        else
          this.items.splice(i, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
      const map2 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const item of this.items)
        addPairToJSMap(ctx, map2, item);
      return map2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  };

  // node_modules/yaml/browser/dist/schema/common/map.js
  var map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
  };

  // node_modules/yaml/browser/dist/nodes/YAMLSeq.js
  var YAMLSeq = class extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema4) {
      super(SEQ, schema4);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return void 0;
      const it = this.items[idx];
      return !keepScalar && isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (isScalar(prev) && isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq2 = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq2);
      let i = 0;
      for (const item of this.items)
        seq2.push(toJS(item, String(i++), ctx));
      return seq2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema4, obj, ctx) {
      const { replacer } = ctx;
      const seq2 = new this(schema4);
      if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i++);
            it = replacer.call(obj, key, it);
          }
          seq2.items.push(createNode(it, void 0, ctx));
        }
      }
      return seq2;
    }
  };
  function asItemIndex(key) {
    let idx = isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }

  // node_modules/yaml/browser/dist/schema/common/seq.js
  var seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
  };

  // node_modules/yaml/browser/dist/schema/common/string.js
  var string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString(item, ctx, onComment, onChompKeep);
    }
  };

  // node_modules/yaml/browser/dist/schema/common/null.js
  var nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };

  // node_modules/yaml/browser/dist/schema/core/bool.js
  var boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyNumber.js
  function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n2 = Object.is(value, -0) ? "-0" : JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n2) && !n2.includes("e")) {
      let i = n2.indexOf(".");
      if (i < 0) {
        i = n2.length;
        n2 += ".";
      }
      let d = minFractionDigits - (n2.length - i - 1);
      while (d-- > 0)
        n2 += "0";
    }
    return n2;
  }

  // node_modules/yaml/browser/dist/schema/core/float.js
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber
  };

  // node_modules/yaml/browser/dist/schema/core/int.js
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber(node);
  }
  var intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  var intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };

  // node_modules/yaml/browser/dist/schema/core/schema.js
  var schema = [
    map,
    seq,
    string,
    nullTag,
    boolTag,
    intOct,
    int,
    intHex,
    floatNaN,
    floatExp,
    float
  ];

  // node_modules/yaml/browser/dist/schema/json/schema.js
  function intIdentify2(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  var stringifyJSON = ({ value }) => JSON.stringify(value);
  var jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify2,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  var jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  var schema2 = [map, seq].concat(jsonScalars, jsonError);

  // node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
  var binary = {
    identify: (value) => value instanceof Uint8Array,
    // Buffer inherits from Uint8Array
    default: false,
    tag: "tag:yaml.org,2002:binary",
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
      if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i = 0; i < str.length; ++i)
          buffer[i] = str.charCodeAt(i);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      if (!value)
        return "";
      const buf = value;
      let str;
      if (typeof btoa === "function") {
        let s = "";
        for (let i = 0; i < buf.length; ++i)
          s += String.fromCharCode(buf[i]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      type ?? (type = Scalar.BLOCK_LITERAL);
      if (type !== Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n2 = Math.ceil(str.length / lineWidth);
        const lines = new Array(n2);
        for (let i = 0, o = 0; i < n2; ++i, o += lineWidth) {
          lines[i] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
      }
      return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
  function resolvePairs(seq2, onError) {
    if (isSeq(seq2)) {
      for (let i = 0; i < seq2.items.length; ++i) {
        let item = seq2.items[i];
        if (isPair(item))
          continue;
        else if (isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair(new Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq2.items[i] = isPair(item) ? item : new Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq2;
  }
  function createPairs(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq(schema4);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(createPair(key, value, ctx));
      }
    return pairs2;
  }
  var pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
  var YAMLOMap = class _YAMLOMap extends YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.prototype.set.bind(this);
      this.tag = _YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map2 = /* @__PURE__ */ new Map();
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const pair of this.items) {
        let key, value;
        if (isPair(pair)) {
          key = toJS(pair.key, "", ctx);
          value = toJS(pair.value, key, ctx);
        } else {
          key = toJS(pair, "", ctx);
        }
        if (map2.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map2.set(key, value);
      }
      return map2;
    }
    static from(schema4, iterable, ctx) {
      const pairs2 = createPairs(schema4, iterable, ctx);
      const omap2 = new this();
      omap2.items = pairs2.items;
      return omap2;
    }
  };
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  var omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq2, onError) {
      const pairs2 = resolvePairs(seq2, onError);
      const seenKeys = [];
      for (const { key } of pairs2.items) {
        if (isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap(), pairs2);
    },
    createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  var trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar(true),
    stringify: boolStringify
  };
  var falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar(false),
    stringify: boolStringify
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
  var floatNaN2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  var floatExp2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  var float2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f = str.substring(dot + 1).replace(/_/g, "");
        if (f[f.length - 1] === "0")
          node.minFractionDigits = f.length;
      }
      return node;
    },
    stringify: stringifyNumber
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
  var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve2(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n3 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n3 : n3;
    }
    const n2 = parseInt(str, radix);
    return sign === "-" ? -1 * n2 : n2;
  }
  function intStringify2(node, radix, prefix) {
    const { value } = node;
    if (intIdentify3(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber(node);
  }
  var intBin = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
    stringify: (node) => intStringify2(node, 2, "0b")
  };
  var intOct2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
    stringify: (node) => intStringify2(node, 8, "0")
  };
  var int2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  var intHex2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
    stringify: (node) => intStringify2(node, 16, "0x")
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
  var YAMLSet = class _YAMLSet extends YAMLMap {
    constructor(schema4) {
      super(schema4);
      this.tag = _YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair(key.key, null);
      else
        pair = new Pair(key, null);
      const prev = findPair(this.items, pair.key);
      if (!prev)
        this.items.push(pair);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
      const pair = findPair(this.items, key);
      return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema4, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema4);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(createPair(value, null, ctx));
        }
      return set2;
    }
  };
  YAMLSet.tag = "tag:yaml.org,2002:set";
  var set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
    resolve(map2, onError) {
      if (isMap(map2)) {
        if (map2.hasAllNullValues(true))
          return Object.assign(new YAMLSet(), map2);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map2;
    }
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n2) => asBigInt ? BigInt(n2) : Number(n2);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n2) => n2;
    if (typeof value === "bigint")
      num = (n2) => BigInt(n2);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n2) => String(n2).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  var intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  var floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  var timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 6e4 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
  var schema3 = [
    map,
    seq,
    string,
    nullTag,
    trueTag,
    falseTag,
    intBin,
    intOct2,
    int2,
    intHex2,
    floatNaN2,
    floatExp2,
    float2,
    binary,
    merge,
    omap,
    pairs,
    set,
    intTime,
    floatTime,
    timestamp
  ];

  // node_modules/yaml/browser/dist/schema/tags.js
  var schemas = /* @__PURE__ */ new Map([
    ["core", schema],
    ["failsafe", [map, seq, string]],
    ["json", schema2],
    ["yaml11", schema3],
    ["yaml-1.1", schema3]
  ]);
  var tagsByName = {
    binary,
    bool: boolTag,
    float,
    floatExp,
    floatNaN,
    floatTime,
    int,
    intHex,
    intOct,
    intTime,
    map,
    merge,
    null: nullTag,
    omap,
    pairs,
    seq,
    set,
    timestamp
  };
  var coreKnownTags = {
    "tag:yaml.org,2002:binary": binary,
    "tag:yaml.org,2002:merge": merge,
    "tag:yaml.org,2002:omap": omap,
    "tag:yaml.org,2002:pairs": pairs,
    "tag:yaml.org,2002:set": set,
    "tag:yaml.org,2002:timestamp": timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }

  // node_modules/yaml/browser/dist/schema/Schema.js
  var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  var Schema = class _Schema {
    constructor({ compat, customTags, merge: merge3, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
      this.name = typeof schema4 === "string" && schema4 || "core";
      this.knownTags = resolveKnownTags ? coreKnownTags : {};
      this.tags = getTags(customTags, this.name, merge3);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, MAP, { value: map });
      Object.defineProperty(this, SCALAR, { value: string });
      Object.defineProperty(this, SEQ, { value: seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyDocument.js
  function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
      let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes("\n")) {
          lines.push("...");
          lines.push(indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(indentComment(commentString(dc), ""));
      }
    }
    return lines.join("\n") + "\n";
  }

  // node_modules/yaml/browser/dist/doc/Document.js
  var Document = class _Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, NODE_TYPE, { value: DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new Directives({ version });
      this.setSchema(version, options);
      this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
      const copy = Object.create(_Document.prototype, {
        [NODE_TYPE]: { value: DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** Adds a value to the document. */
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchorNames(this);
        node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
      }
      return new Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = void 0;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow: flow2, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
        this,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || "a"
      );
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode(value, tag, ctx);
      if (flow2 && isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
      const k = this.createNode(key, null, options);
      const v = this.createNode(value, null, options);
      return new Pair(k, v);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      if (isEmptyPath(path)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
      return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      if (isEmptyPath(path))
        return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
      return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
      return isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path) {
      if (isEmptyPath(path))
        return this.contents !== void 0;
      return isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
      if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      if (isEmptyPath(path)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, Array.from(path), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path, value);
      }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument(this, options);
    }
  };
  function assertCollection(contents) {
    if (isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }

  // node_modules/yaml/browser/dist/errors.js
  var YAMLError = class extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  };
  var YAMLParseError = class extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  };
  var YAMLWarning = class extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  };
  var prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "\u2026" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "\u2026";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + "\u2026\n";
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end?.line === line && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer}
`;
    }
  };

  // node_modules/yaml/browser/dist/compose/resolve-props.js
  function resolveProps(tokens, { flow: flow2, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow2 && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else if (!found || indicator !== "seq-item-ind")
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow2 ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow2) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow2}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        // else fallthrough
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }

  // node_modules/yaml/browser/dist/compose/util-contains-newline.js
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes("\n"))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }

  // node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }

  // node_modules/yaml/browser/dist/compose/util-map-includes.js
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
    return items.some((pair) => isEqual(pair.key, search));
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-map.js
  var startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap;
    const map2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map2.comment)
              map2.comment += "\n" + keyProps.comment;
            else
              map2.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (mapIncludes(ctx, map2.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map2.range = [bm.offset, offset, commentEnd ?? offset];
    return map2;
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-seq.js
  function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq;
    const seq2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value?.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq2.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq2.items.push(node);
    }
    seq2.range = [bs.offset, offset, commentEnd ?? offset];
    return seq2;
  }

  // node_modules/yaml/browser/dist/compose/resolve-end.js
  function resolveEnd(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }

  // node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
  var blockMsg = "Block collections are not allowed within flow collections";
  var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
    const isMap2 = fc.start.source === "{";
    const fcName = isMap2 ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0; i < fc.items.length; ++i) {
      const collItem = fc.items[i];
      const { start, key, sep, value } = collItem;
      const props = resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += "\n" + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap2 && ctx.options.strict && containsNewline(key))
          onError(
            key,
            // checked by containsNewline()
            "MULTILINE_IMPLICIT_KEY",
            "Implicit keys of flow sequence pairs need to be on a single line"
          );
      }
      if (i === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop: for (const st of start) {
            switch (st.type) {
              case "comma":
              case "space":
                break;
              case "comment":
                prevItemComment = st.source.substring(1);
                break loop;
              default:
                break loop;
            }
          }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += "\n" + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap2 && !sep && !props.found) {
        const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap2 && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source?.[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap2) {
          const map2 = coll;
          if (mapIncludes(ctx, map2.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map2.items.push(pair);
        } else {
          const map2 = new YAMLMap(ctx.schema);
          map2.flow = true;
          map2.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map2.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map2);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap2 ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += "\n" + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }

  // node_modules/yaml/browser/dist/compose/compose-collection.js
  function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN2, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt?.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN2, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = isNode(res) ? res : new Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
  function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i = lines.length - 1; i >= 0; --i) {
      const content = lines[i][1];
      if (content === "" || content === "\r")
        chompStart = i;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar.source)
        end2 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0; i < chompStart; ++i) {
      const [indent, content] = lines[i];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i = lines.length - 1; i >= chompStart; --i) {
      if (lines[i][0].length > trimIndent)
        chompStart = i + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i = 0; i < contentStart; ++i)
      value += lines[i][0].slice(trimIndent) + "\n";
    for (let i = contentStart; i < chompStart; ++i) {
      let [indent, content] = lines[i];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
      } else if (indent.length > trimIndent || content[0] === "	") {
        if (sep === " ")
          sep = "\n";
        else if (!prevMoreIndented && sep === "\n")
          sep = "\n\n";
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === "\n")
          value += "\n";
        else
          sep = "\n";
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i = chompStart; i < lines.length; ++i)
          value += "\n" + lines[i][0].slice(trimIndent);
        if (value[value.length - 1] !== "\n")
          value += "\n";
        break;
      default:
        value += "\n";
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i = 1; i < source.length; ++i) {
      const ch = source[i];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n2 = Number(ch);
        if (!indent && n2)
          indent = n2;
        else if (error === -1)
          error = offset + i;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i = 1; i < props.length; ++i) {
      const token = props[i];
      switch (token.type) {
        case "space":
          hasSpace = true;
        // fallthrough
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        /* istanbul ignore next should not happen */
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m2 = first.match(/^( *)/);
    const line0 = m2?.[1] ? [m2[1], first.slice(m2[1].length)] : ["", first];
    const lines = [line0];
    for (let i = 1; i < split.length; i += 2)
      lines.push([split[i], split[i + 1]]);
    return lines;
  }

  // node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
  function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      /* istanbul ignore next should not happen */
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      /* istanbul ignore next should not happen */
      case "	":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return unfoldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function unfoldLines(source) {
    const line = /(.*?)\r?\n/sy;
    let match = line.exec(source);
    if (!match)
      return source;
    let trimEnd, trimBoth;
    try {
      trimEnd = new RegExp("(?<![ 	])[ 	]+$");
      trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
    } catch {
      trimEnd = /[ \t]+$/;
      trimBoth = /^[ \t]+|[ \t]+$/g;
    }
    let res = match[1].replace(trimEnd, "");
    let sep = " ";
    let pos = line.lastIndex;
    while (match = line.exec(source)) {
      const lm = match[1].replace(trimBoth, "");
      if (lm === "") {
        if (sep === "\n")
          res += sep;
        else
          sep = "\n";
      } else {
        res += sep + lm;
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i = 1; i < source.length - 1; ++i) {
      const ch = source[i];
      if (ch === "\r" && source[i + 1] === "\n")
        continue;
      if (ch === "\n") {
        const { fold, offset } = foldNewline(source, i);
        res += fold;
        i = offset;
      } else if (ch === "\\") {
        let next = source[++i];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === "\n") {
          next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
        } else if (next === "\r" && source[i + 1] === "\n") {
          next = source[++i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = next === "x" ? 2 : next === "u" ? 4 : 8;
          res += parseCharCode(source, i + 1, length, onError);
          i += length;
        } else {
          const raw = source.substr(i - 1, 2);
          onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "	") {
        const wsStart = i;
        let next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
        if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
          res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== "\n")
        break;
      if (ch === "\n")
        fold += "\n";
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  var escapeCodes = {
    "0": "\0",
    // null character
    a: "\x07",
    // bell character
    b: "\b",
    // backspace
    e: "\x1B",
    // escape character
    f: "\f",
    // form feed
    n: "\n",
    // line feed
    r: "\r",
    // carriage return
    t: "	",
    // horizontal tab
    v: "\v",
    // vertical tab
    N: "\x85",
    // Unicode next line
    _: "\xA0",
    // Unicode non-breaking space
    L: "\u2028",
    // Unicode line separator
    P: "\u2029",
    // Unicode paragraph separator
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "	": "	"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
      return String.fromCodePoint(code);
    } catch {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
  }

  // node_modules/yaml/browser/dist/compose/compose-scalar.js
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[SCALAR];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = isScalar(res) ? res : new Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment)
      scalar.comment = comment;
    return scalar;
  }
  function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema4[SCALAR];
    const matchWithTest = [];
    for (const tag of schema4.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema4.knownTags[tagName];
    if (kt && !kt.collection) {
      schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema4[SCALAR];
  }
  function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
    const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
    if (schema4.compat) {
      const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }

  // node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      pos ?? (pos = before.length);
      for (let i = pos - 1; i >= 0; --i) {
        let st = before[i];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i];
        }
        break;
      }
    }
    return offset;
  }

  // node_modules/yaml/browser/dist/compose/compose-node.js
  var CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        try {
          node = composeCollection(CN, ctx, token, props, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onError(token, "RESOURCE_EXHAUSTION", message);
        }
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        isSrcToken = false;
      }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }

  // node_modules/yaml/browser/dist/compose/compose-doc.js
  function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document(void 0, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }

  // node_modules/yaml/browser/dist/compose/composer.js
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0; i < prelude.length; ++i) {
      const source = prelude[i];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i + 1]?.[0] !== "#")
            i += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }
  var Composer = class {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new YAMLWarning(pos, code, message));
        else
          this.errors.push(new YAMLParseError(pos, code, message));
      };
      this.directives = new Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        for (let i = 0; i < this.errors.length; ++i)
          doc.errors.push(this.errors[i]);
        for (let i = 0; i < this.warnings.length; ++i)
          doc.warnings.push(this.warnings[i]);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document(void 0, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  };

  // node_modules/yaml/browser/dist/parse/cst.js
  var cst_exports = {};
  __export(cst_exports, {
    BOM: () => BOM,
    DOCUMENT: () => DOCUMENT,
    FLOW_END: () => FLOW_END,
    SCALAR: () => SCALAR2,
    createScalarToken: () => createScalarToken,
    isCollection: () => isCollection2,
    isScalar: () => isScalar2,
    prettyToken: () => prettyToken,
    resolveAsScalar: () => resolveAsScalar,
    setScalarValue: () => setScalarValue,
    stringify: () => stringify2,
    tokenType: () => tokenType,
    visit: () => visit2
  });

  // node_modules/yaml/browser/dist/parse/cst-scalar.js
  function resolveAsScalar(token, strict = true, onError) {
    if (token) {
      const _onError = (pos, code, message) => {
        const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
        if (onError)
          onError(offset, code, message);
        else
          throw new YAMLParseError([offset, offset + 1], code, message);
      };
      switch (token.type) {
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return resolveFlowScalar(token, strict, _onError);
        case "block-scalar":
          return resolveBlockScalar({ options: { strict } }, token, _onError);
      }
    }
    return null;
  }
  function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
    const source = stringifyString({ type, value }, {
      implicitKey,
      indent: indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
      { type: "newline", offset: -1, indent, source: "\n" }
    ];
    switch (source[0]) {
      case "|":
      case ">": {
        const he = source.indexOf("\n");
        const head = source.substring(0, he);
        const body = source.substring(he + 1) + "\n";
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, end))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        return { type: "block-scalar", offset, indent, props, source: body };
      }
      case '"':
        return { type: "double-quoted-scalar", offset, indent, source, end };
      case "'":
        return { type: "single-quoted-scalar", offset, indent, source, end };
      default:
        return { type: "scalar", offset, indent, source, end };
    }
  }
  function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = "indent" in token ? token.indent : null;
    if (afterKey && typeof indent === "number")
      indent += 2;
    if (!type)
      switch (token.type) {
        case "single-quoted-scalar":
          type = "QUOTE_SINGLE";
          break;
        case "double-quoted-scalar":
          type = "QUOTE_DOUBLE";
          break;
        case "block-scalar": {
          const header = token.props[0];
          if (header.type !== "block-scalar-header")
            throw new Error("Invalid block scalar header");
          type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
          break;
        }
        default:
          type = "PLAIN";
      }
    const source = stringifyString({ type, value }, {
      implicitKey: implicitKey || indent === null,
      indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
      case "|":
      case ">":
        setBlockScalarValue(token, source);
        break;
      case '"':
        setFlowScalarValue(token, source, "double-quoted-scalar");
        break;
      case "'":
        setFlowScalarValue(token, source, "single-quoted-scalar");
        break;
      default:
        setFlowScalarValue(token, source, "scalar");
    }
  }
  function setBlockScalarValue(token, source) {
    const he = source.indexOf("\n");
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + "\n";
    if (token.type === "block-scalar") {
      const header = token.props[0];
      if (header.type !== "block-scalar-header")
        throw new Error("Invalid block scalar header");
      header.source = head;
      token.source = body;
    } else {
      const { offset } = token;
      const indent = "indent" in token ? token.indent : -1;
      const props = [
        { type: "block-scalar-header", offset, indent, source: head }
      ];
      if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
        props.push({ type: "newline", offset: -1, indent, source: "\n" });
      for (const key of Object.keys(token))
        if (key !== "type" && key !== "offset")
          delete token[key];
      Object.assign(token, { type: "block-scalar", indent, props, source: body });
    }
  }
  function addEndtoBlockProps(props, end) {
    if (end)
      for (const st of end)
        switch (st.type) {
          case "space":
          case "comment":
            props.push(st);
            break;
          case "newline":
            props.push(st);
            return true;
        }
    return false;
  }
  function setFlowScalarValue(token, source, type) {
    switch (token.type) {
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        token.type = type;
        token.source = source;
        break;
      case "block-scalar": {
        const end = token.props.slice(1);
        let oa = source.length;
        if (token.props[0].type === "block-scalar-header")
          oa -= token.props[0].source.length;
        for (const tok of end)
          tok.offset += oa;
        delete token.props;
        Object.assign(token, { type, source, end });
        break;
      }
      case "block-map":
      case "block-seq": {
        const offset = token.offset + source.length;
        const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
        delete token.items;
        Object.assign(token, { type, source, end: [nl] });
        break;
      }
      default: {
        const indent = "indent" in token ? token.indent : -1;
        const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type, indent, source, end });
      }
    }
  }

  // node_modules/yaml/browser/dist/parse/cst-stringify.js
  var stringify2 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
  function stringifyToken(token) {
    switch (token.type) {
      case "block-scalar": {
        let res = "";
        for (const tok of token.props)
          res += stringifyToken(tok);
        return res + token.source;
      }
      case "block-map":
      case "block-seq": {
        let res = "";
        for (const item of token.items)
          res += stringifyItem(item);
        return res;
      }
      case "flow-collection": {
        let res = token.start.source;
        for (const item of token.items)
          res += stringifyItem(item);
        for (const st of token.end)
          res += st.source;
        return res;
      }
      case "document": {
        let res = stringifyItem(token);
        if (token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
      default: {
        let res = token.source;
        if ("end" in token && token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
    }
  }
  function stringifyItem({ start, key, sep, value }) {
    let res = "";
    for (const st of start)
      res += st.source;
    if (key)
      res += stringifyToken(key);
    if (sep)
      for (const st of sep)
        res += st.source;
    if (value)
      res += stringifyToken(value);
    return res;
  }

  // node_modules/yaml/browser/dist/parse/cst-visit.js
  var BREAK2 = /* @__PURE__ */ Symbol("break visit");
  var SKIP2 = /* @__PURE__ */ Symbol("skip children");
  var REMOVE2 = /* @__PURE__ */ Symbol("remove item");
  function visit2(cst, visitor) {
    if ("type" in cst && cst.type === "document")
      cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
  }
  visit2.BREAK = BREAK2;
  visit2.SKIP = SKIP2;
  visit2.REMOVE = REMOVE2;
  visit2.itemAtPath = (cst, path) => {
    let item = cst;
    for (const [field, index] of path) {
      const tok = item?.[field];
      if (tok && "items" in tok) {
        item = tok.items[index];
      } else
        return void 0;
    }
    return item;
  };
  visit2.parentCollection = (cst, path) => {
    const parent = visit2.itemAtPath(cst, path.slice(0, -1));
    const field = path[path.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path, item, visitor) {
    let ctrl = visitor(item, path);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item[field];
      if (token && "items" in token) {
        for (let i = 0; i < token.items.length; ++i) {
          const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK2)
            return BREAK2;
          else if (ci === REMOVE2) {
            token.items.splice(i, 1);
            i -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item, path);
      }
    }
    return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
  }

  // node_modules/yaml/browser/dist/parse/cst.js
  var BOM = "\uFEFF";
  var DOCUMENT = "";
  var FLOW_END = "";
  var SCALAR2 = "";
  var isCollection2 = (token) => !!token && "items" in token;
  var isScalar2 = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
  function prettyToken(token) {
    switch (token) {
      case BOM:
        return "<BOM>";
      case DOCUMENT:
        return "<DOC>";
      case FLOW_END:
        return "<FLOW_END>";
      case SCALAR2:
        return "<SCALAR>";
      default:
        return JSON.stringify(token);
    }
  }
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR2:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case "\n":
      case "\r\n":
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "	":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }

  // node_modules/yaml/browser/dist/parse/lexer.js
  function isEmpty(ch) {
    switch (ch) {
      case void 0:
      case " ":
      case "\n":
      case "\r":
      case "	":
        return true;
      default:
        return false;
    }
  }
  var hexDigits = new Set("0123456789ABCDEFabcdef");
  var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  var flowIndicatorChars = new Set(",[]{}");
  var invalidAnchorChars = new Set(" ,[]{}\n\r	");
  var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
  var Lexer = class {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i = this.pos;
      let ch = this.buffer[i];
      while (ch === " " || ch === "	")
        ch = this.buffer[++i];
      if (!ch || ch === "#" || ch === "\n")
        return true;
      if (ch === "\r")
        return this.buffer[i + 1] === "\n";
      return false;
    }
    charAt(n2) {
      return this.buffer[this.pos + n2];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === "\n" || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf("\n", this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n2) {
      return this.pos + n2 <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n2) {
      return this.buffer.substr(this.pos, n2);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "	") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "	")
            dirEnd -= 1;
          else
            break;
        }
        const n2 = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n2);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n2 = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n2;
        return "block-start";
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n2 = yield* this.pushIndicators();
      switch (line[n2]) {
        case "#":
          yield* this.pushCount(line.length - n2);
        // fallthrough
        case void 0:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n2 += yield* this.parseBlockScalarHeader();
          n2 += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n2);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n2 = 0;
      while (line[n2] === ",") {
        n2 += yield* this.pushCount(1);
        n2 += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n2 += yield* this.pushIndicators();
      switch (line[n2]) {
        case void 0:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n2);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        // fallthrough
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n2 = 0;
          while (this.buffer[end - 1 - n2] === "\\")
            n2 += 1;
          if (n2 % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf("\n", this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf("\n", cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i = this.pos;
      while (true) {
        const ch = this.buffer[++i];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
        switch (ch) {
          case " ":
            indent += 1;
            break;
          case "\n":
            nl = i2;
            indent = 0;
            break;
          case "\r": {
            const next = this.buffer[i2 + 1];
            if (!next && !this.atEnd)
              return this.setNext("block-scalar");
            if (next === "\n")
              break;
          }
          // fallthrough
          default:
            break loop;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf("\n", cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i = nl + 1;
      ch = this.buffer[i];
      while (ch === " ")
        ch = this.buffer[++i];
      if (ch === "	") {
        while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
          ch = this.buffer[++i];
        nl = i - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i2 = nl - 1;
          let ch2 = this.buffer[i2];
          if (ch2 === "\r")
            ch2 = this.buffer[--i2];
          const lastChar = i2;
          while (ch2 === " ")
            ch2 = this.buffer[--i2];
          if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
            nl = i2;
          else
            break;
        } while (true);
      }
      yield SCALAR2;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i]) {
        if (ch === ":") {
          const next = this.buffer[i + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i + 1];
          if (ch === "\r") {
            if (next === "\n") {
              i += 1;
              ch = "\n";
              next = this.buffer[i + 1];
            } else
              end = i;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === "\n") {
            const cs = this.continueScalar(i + 1);
            if (cs === -1)
              break;
            i = Math.max(i, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield SCALAR2;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n2) {
      if (n2 > 0) {
        yield this.buffer.substr(this.pos, n2);
        this.pos += n2;
        return n2;
      }
      return 0;
    }
    *pushToIndex(i, allowEmpty) {
      const s = this.buffer.slice(this.pos, i);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      let n2 = 0;
      loop: while (true) {
        switch (this.charAt(0)) {
          case "!":
            n2 += yield* this.pushTag();
            n2 += yield* this.pushSpaces(true);
            continue loop;
          case "&":
            n2 += yield* this.pushUntil(isNotAnchorChar);
            n2 += yield* this.pushSpaces(true);
            continue loop;
          case "-":
          // this is an error
          case "?":
          // this is an error outside flow collections
          case ":": {
            const inFlow = this.flowLevel > 0;
            const ch1 = this.charAt(1);
            if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
              if (!inFlow)
                this.indentNext = this.indentValue + 1;
              else if (this.flowKey)
                this.flowKey = false;
              n2 += yield* this.pushCount(1);
              n2 += yield* this.pushSpaces(true);
              continue loop;
            }
          }
        }
        break loop;
      }
      return n2;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i = this.pos + 2;
        let ch = this.buffer[i];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i];
        return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
      } else {
        let i = this.pos + 1;
        let ch = this.buffer[i];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i];
          else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
            ch = this.buffer[i += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === "\n")
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === "\n")
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i];
      } while (ch === " " || allowTabs && ch === "	");
      const n2 = i - this.pos;
      if (n2 > 0) {
        yield this.buffer.substr(this.pos, n2);
        this.pos = i;
      }
      return n2;
    }
    *pushUntil(test) {
      let i = this.pos;
      let ch = this.buffer[i];
      while (!test(ch))
        ch = this.buffer[++i];
      return yield* this.pushToIndex(i, false);
    }
  };

  // node_modules/yaml/browser/dist/parse/line-counter.js
  var LineCounter = class {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  };

  // node_modules/yaml/browser/dist/parse/parser.js
  function includesToken(list, type) {
    for (let i = 0; i < list.length; ++i)
      if (list[i].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list) {
    for (let i = 0; i < list.length; ++i) {
      switch (list[i].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      /* istanbul ignore next should not happen */
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i = prev.length;
    loop: while (--i >= 0) {
      switch (prev[i].type) {
        case "doc-start":
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
        case "newline":
          break loop;
      }
    }
    while (prev[++i]?.type === "space") {
    }
    return prev.splice(i, prev.length);
  }
  function arrayPushArray(target, source) {
    if (source.length < 1e5)
      Array.prototype.push.apply(target, source);
    else
      for (let i = 0; i < source.length; ++i)
        target.push(source[i]);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              arrayPushArray(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            arrayPushArray(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }
  var Parser = class {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new Lexer();
      this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
      this.source = source;
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && top?.type !== "doc-end") {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n2) {
      return this.stack[this.stack.length - n2];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map2 = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf("\n") + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf("\n", nl) + 1;
            }
          }
          yield* this.pop();
          break;
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map2) {
      const it = map2.items[map2.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map2.indent)) {
              const prev = map2.items[map2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                map2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map2.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i = 0; i < it.sep.length; ++i) {
            const st = it.sep[i];
            switch (st.type) {
              case "newline":
                nl.push(i);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map2.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map2.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map2.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map2);
            if (bv) {
              if (bv.type === "block-seq") {
                if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                  yield* this.pop({
                    type: "error",
                    offset: this.offset,
                    message: "Unexpected block-seq-ind on same line with key",
                    source: this.source
                  });
                  return;
                }
              } else if (atMapIndent) {
                map2.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq2) {
      const it = seq2.items[seq2.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq2.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq2.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq2.indent)) {
              const prev = seq2.items[seq2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                seq2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq2.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq2.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq2.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq2.indent) {
        const bv = this.startBlockValue(seq2);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top?.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map2 = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map2;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf("\n") + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf("\n", nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        // fallthrough
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  };

  // node_modules/yaml/browser/dist/public-api.js
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
    return { lineCounter, prettyErrors };
  }
  function parseAllDocuments(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser = new Parser(lineCounter?.addNewLine);
    const composer = new Composer(options);
    const docs = Array.from(composer.compose(parser.parse(source)));
    if (prettyErrors && lineCounter)
      for (const doc of docs) {
        doc.errors.forEach(prettifyError(source, lineCounter));
        doc.warnings.forEach(prettifyError(source, lineCounter));
      }
    if (docs.length > 0)
      return docs;
    return Object.assign([], { empty: true }, composer.streamInfo());
  }
  function parseDocument(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser = new Parser(lineCounter?.addNewLine);
    const composer = new Composer(options);
    let doc = null;
    for (const _doc of composer.compose(parser.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter) {
      doc.errors.forEach(prettifyError(source, lineCounter));
      doc.warnings.forEach(prettifyError(source, lineCounter));
    }
    return doc;
  }
  function parse(src, reviver, options) {
    let _reviver = void 0;
    if (typeof reviver === "function") {
      _reviver = reviver;
    } else if (options === void 0 && reviver && typeof reviver === "object") {
      options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
      return null;
    doc.warnings.forEach((warning) => warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
      if (doc.options.logLevel !== "silent")
        throw doc.errors[0];
      else
        doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
  }
  function stringify3(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
    }
    if (typeof options === "string")
      options = options.length;
    if (typeof options === "number") {
      const indent = Math.round(options);
      options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === void 0) {
      const { keepUndefined } = options ?? replacer ?? {};
      if (!keepUndefined)
        return void 0;
    }
    if (isDocument(value) && !_replacer)
      return value.toString(options);
    return new Document(value, _replacer, options).toString(options);
  }

  // node_modules/yaml/browser/index.js
  var browser_default = dist_exports;

  // src/editor/model.js
  var TO_STRING = { lineWidth: 0, flowCollectionPadding: false };
  var HISTORY = 200;
  var isCollection3 = (node) => browser_default.isMap(node) || browser_default.isSeq(node);
  function deriveHome(doc) {
    if (doc.errors.length) return { data: null, home: null, errors: doc.errors.map((e) => e.message.split("\n")[0]) };
    const data = doc.toJS();
    if (!data || typeof data !== "object" || Array.isArray(data)) return { data, home: null, errors: ["The file needs to be a home: a map of fields (view, units_per_metre, rooms, \u2026)"] };
    try {
      return { data, home: defineHome(data), errors: [] };
    } catch (e) {
      return { data, home: null, errors: e.message.replace(/^Invalid home:\n/, "").split("\n") };
    }
  }
  function merge2(doc, node, value, flow2) {
    if (browser_default.isScalar(node) && (value === null || typeof value !== "object")) {
      node.value = value;
      return node;
    }
    if (browser_default.isSeq(node) && Array.isArray(value)) {
      value.forEach((v, i) => {
        node.items[i] = i < node.items.length ? merge2(doc, node.items[i], v, node.flow) : create(doc, v, node.flow);
      });
      node.items.length = value.length;
      return node;
    }
    if (browser_default.isMap(node) && value && typeof value === "object" && !Array.isArray(value)) {
      for (const pair of [...node.items]) if (!(String(pair.key?.value ?? pair.key) in value)) node.delete(pair.key);
      for (const [k, v] of Object.entries(value)) {
        const pair = node.items.find((p) => String(p.key?.value ?? p.key) === k);
        if (pair) pair.value = merge2(doc, pair.value, v, node.flow);
        else node.add(doc.createPair(k, create(doc, v, node.flow)));
      }
      return node;
    }
    const fresh = create(doc, value, flow2 || isCollection3(node) && node.flow);
    if (node?.commentBefore) fresh.commentBefore = node.commentBefore;
    if (node?.comment) fresh.comment = node.comment;
    return fresh;
  }
  var SHORT = 80;
  function create(doc, value, flow2) {
    const node = doc.createNode(value);
    const children = (n2) => n2.items.map((i) => browser_default.isPair(i) ? i.value : i);
    const flowAll = (n2) => {
      if (isCollection3(n2)) {
        n2.flow = true;
        children(n2).forEach(flowAll);
      }
    };
    const numbers = (n2) => browser_default.isSeq(n2) && n2.items.every((i) => browser_default.isScalar(i) && typeof i.value === "number" || numbers(i));
    const style2 = (n2) => {
      if (!isCollection3(n2)) return;
      children(n2).forEach(style2);
      const flat = n2.clone();
      flowAll(flat);
      if (numbers(n2) || new browser_default.Document(flat).toString(TO_STRING).trimEnd().length <= SHORT) flowAll(n2);
    };
    if (flow2) flowAll(node);
    else style2(node);
    return node;
  }
  function unflowEmpty(doc, path) {
    const node = path.length ? doc.getIn(path, true) : doc.contents;
    const outer = path.length > 1 ? doc.getIn(path.slice(0, -1), true) : doc.contents;
    if (isCollection3(node) && node.flow && !node.items.length && path.length && isCollection3(outer) && !outer.flow) node.flow = false;
  }
  function setIn(doc, path, value) {
    const node = doc.getIn(path, true);
    if (node === void 0) {
      if (path.length > 1) unflowEmpty(doc, path.slice(0, -1));
      const parent = path.length > 1 ? doc.getIn(path.slice(0, -1), true) : doc.contents;
      doc.setIn(path, create(doc, value, isCollection3(parent) && parent.flow));
    } else {
      const fresh = merge2(doc, node, value, false);
      if (fresh !== node) doc.setIn(path, fresh);
    }
  }
  function insertIn(doc, path, value, index) {
    let seq2 = doc.getIn(path, true);
    if (seq2 === void 0) {
      doc.setIn(path, doc.createNode([]));
      seq2 = doc.getIn(path, true);
    }
    if (!browser_default.isSeq(seq2)) throw new Error(`${path.join(".")} isn't a list`);
    unflowEmpty(doc, path);
    seq2.items.splice(index ?? seq2.items.length, 0, create(doc, value, seq2.flow));
  }
  function renameIn(doc, path, key) {
    const map2 = path.length > 1 ? doc.getIn(path.slice(0, -1), true) : doc.contents;
    const pair = browser_default.isMap(map2) && map2.items.find((p) => String(p.key?.value ?? p.key) === String(path.at(-1)));
    if (!pair) throw new Error(`Nothing at ${path.join(".")}`);
    if (map2.items.some((p) => p !== pair && String(p.key?.value ?? p.key) === key)) throw new Error(`There's already a ${key}`);
    if (browser_default.isScalar(pair.key)) pair.key.value = key;
    else pair.key = doc.createNode(key);
  }
  function yamlOf(data) {
    const doc = new browser_default.Document();
    doc.contents = create(doc, data, false);
    if (isCollection3(doc.contents)) doc.contents.flow = false;
    return doc.toString(TO_STRING);
  }
  var HomeModel = class {
    constructor(text2 = "") {
      this.open(text2);
    }
    // A new file: its text, with an empty history.
    open(text2) {
      this._past = [];
      this._future = [];
      this._load(text2);
    }
    _load(text2) {
      this._text = text2;
      this.doc = browser_default.parseDocument(text2);
      this.derived = deriveHome(this.doc);
    }
    get text() {
      return this._text;
    }
    get data() {
      return this.derived.data;
    }
    get home() {
      return this.derived.home;
    }
    get errors() {
      return this.derived.errors;
    }
    get canUndo() {
      return this._past.length > 0;
    }
    get canRedo() {
      return this._future.length > 0;
    }
    // A new version of the text (the text view's): one step in the history.
    setText(text2) {
      if (text2 === this._text) return false;
      this._push();
      this._load(text2);
      return true;
    }
    _push() {
      this._past.push(this._text);
      if (this._past.length > HISTORY) this._past.shift();
      this._future = [];
    }
    // Applies `fn(doc)`, which changes the document, as one step: the text is the document's afterwards. Nothing
    // happens (and nothing is kept) when the YAML doesn't parse, or the text doesn't change.
    edit(fn) {
      if (this.doc.errors.length) throw new Error("The YAML doesn't parse; fix it in the text first");
      try {
        fn(this.doc);
      } catch (e) {
        this._load(this._text);
        throw e;
      }
      const text2 = this.doc.toString(TO_STRING);
      if (text2 === this._text) return false;
      this._push();
      this._load(text2);
      return true;
    }
    // The value at `path` (plain), or undefined.
    get(path) {
      const node = this.doc.getIn(path, true);
      return browser_default.isNode(node) ? node.toJSON() : node;
    }
    // Sets the value at `path`, creating the maps on the way; numbers and lists already there are changed in place.
    set(path, value) {
      return this.edit((doc) => setIn(doc, path, value));
    }
    // Inserts `value` into the list at `path`, before `index` (at the end when it's left out); creates the list.
    insert(path, value, index) {
      return this.edit((doc) => insertIn(doc, path, value, index));
    }
    // Several changes as one step: [{set: path, value}, {insert: path, value, index}, {remove: path}], in order.
    batch(ops) {
      return this.edit((doc) => {
        for (const op of ops) {
          if (op.set) setIn(doc, op.set, op.value);
          else if (op.insert) insertIn(doc, op.insert, op.value, op.index);
          else if (op.remove && !doc.deleteIn(op.remove)) throw new Error(`Nothing at ${op.remove.join(".")}`);
        }
      });
    }
    // Removes the value at `path` (a key from its map, an item from its list).
    remove(path) {
      return this.edit((doc) => {
        if (!doc.deleteIn(path)) throw new Error(`Nothing at ${path.join(".")}`);
      });
    }
    // Moves the item at `from` to `to` in the list (or map, keeping the keys) at `path`, with its comments.
    move(path, from, to) {
      return this.edit((doc) => {
        const node = path.length ? doc.getIn(path, true) : doc.contents;
        if (!isCollection3(node)) throw new Error(`${path.join(".")} isn't a list or a map`);
        const items = node.items;
        if (browser_default.isMap(node)) [from, to] = [from, to].map((k) => typeof k === "number" ? k : items.findIndex((p) => String(p.key?.value ?? p.key) === k));
        if (!(from >= 0 && from < items.length && to >= 0 && to < items.length)) throw new Error(`No item ${from} or ${to} in ${path.join(".")}`);
        items.splice(to, 0, ...items.splice(from, 1));
      });
    }
    undo() {
      if (!this._past.length) return false;
      this._future.push(this._text);
      this._load(this._past.pop());
      return true;
    }
    redo() {
      if (!this._future.length) return false;
      this._past.push(this._text);
      this._load(this._future.pop());
      return true;
    }
    // The home as JSON, for the card's home_url.
    toJSON() {
      if (!this.data) throw new Error("The YAML doesn't parse; fix it in the text first");
      return `${JSON.stringify(this.data, null, 1)}
`;
    }
  };

  // src/editor/controls.js
  function sunPos(date, lat, lon) {
    const rad2 = Math.PI / 180, n2 = date.getTime() / 864e5 + 24405875e-1 - 2451545;
    const L2 = (280.46 + 0.9856474 * n2) % 360, g = (357.528 + 0.9856003 * n2) % 360 * rad2;
    const lambda = (L2 + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad2, eps = (23.439 - 4e-7 * n2) * rad2;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const ha = ((18.697374558 + 24.06570982441908 * n2) % 24 * 15 + lon) * rad2 - ra, la = lat * rad2;
    const el2 = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
    const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
    return { elevation: el2 / rad2, azimuth: (az / rad2 + 360) % 360 };
  }
  function dayTimes(date, { latitude, longitude }) {
    const [y, m2, d] = date.split("-").map(Number);
    const el2 = Array.from({ length: 1440 }, (_, t) => sunPos(new Date(y, m2 - 1, d, 0, t), latitude, longitude).elevation);
    const up = (x) => el2.findIndex((e, t) => t && el2[t - 1] < x && e >= x), down = (x) => el2.findIndex((e, t) => t && el2[t - 1] >= x && e < x);
    const noon = el2.indexOf(Math.max(...el2)), rise = up(0), set2 = down(0);
    return [
      ["Night", 120],
      ["Dawn", up(-6)],
      ["Sunrise", rise],
      ["Morning", rise + 120],
      ["Noon", noon],
      ["Afternoon", Math.round((noon + set2) / 2)],
      ["Golden hour", set2 - 60],
      ["Sunset", set2],
      ["Dusk", down(-6)],
      ["Evening", 22 * 60]
    ].filter(([, t]) => t > 0);
  }
  var compass = (b) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(b / 45) % 8];
  var SIDE_TURN = { top: 0, right: 90, bottom: 180, left: 270 };
  var WEATHER = [["sunny", 0], ["partlycloudy", 40], ["cloudy", 90], ["rainy", 95], ["fog", 100], ["snowy", 95]];
  var WEATHER_NAMES = { sunny: "Sunny", partlycloudy: "Partly cloudy", cloudy: "Cloudy", rainy: "Rainy", fog: "Foggy", snowy: "Snowy" };
  var pad = (n2) => String(n2).padStart(2, "0");
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
    location: location2 = { latitude: 51.4779, longitude: 0 },
    noSnapshot = false,
    help = true,
    onChange
  }) {
    const root = form.getRootNode();
    if (!root.querySelector?.("style[data-lw-controls]")) {
      const style2 = Object.assign(document.createElement("style"), { textContent: STYLE });
      style2.dataset.lwControls = "";
      (root.head || root).appendChild(style2);
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
        const box2 = part("shutters"), was = Object.fromEntries(shutters.map((id) => [id, shutterInput(id).value]));
        box2.textContent = "";
        for (const id of ids) {
          const name = STATES[id]?.attributes.friendly_name || id.replace(/^cover\.|_shutter$/g, "").replace(/_/g, " ");
          const label = Object.assign(document.createElement("label"), { textContent: name, htmlFor: `shutter-${id}` });
          const input2 = Object.assign(document.createElement("input"), {
            type: "range",
            min: 0,
            max: 100,
            id: `shutter-${id}`,
            value: was[id] ?? STATES[id]?.attributes.current_position ?? 100
          });
          input2.dataset.shutter = id;
          box2.append(label, input2, document.createElement("output"));
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
      const now2 = /* @__PURE__ */ new Date(), box2 = part("times");
      box2.textContent = "";
      for (const [label, t] of [["Now", now2.getHours() * 60 + now2.getMinutes()], ...dayTimes($("date").value, location2)]) {
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
        box2.appendChild(b);
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
      const [y, m2, d] = $("date").value.split("-").map(Number), t = +$("time").value;
      const when = new Date(y, m2 - 1, d, Math.floor(t / 60), t % 60);
      const sun = sunPos(when, location2.latitude, location2.longitude), facing = +$("facing").value;
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
        const input2 = shutterInput(id);
        states2[id] = { ...states2[id], attributes: { ...states2[id]?.attributes, current_position: +input2.value } };
        input2.nextElementSibling.textContent = `${input2.value}%`;
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
        location2 = l;
        update();
      },
      callService,
      moreInfo,
      update
    };
  }
  var CSS_ESCAPE = (s) => globalThis.CSS?.escape ? globalThis.CSS.escape(s) : s.replace(/["\\]/g, "\\$&");

  // src/editor/files.js
  var TYPES = {
    yaml: { description: "Home (YAML)", accept: { "text/yaml": [".yaml", ".yml"] }, mime: "text/yaml" },
    json: { description: "Home (JSON, for home_url)", accept: { "application/json": [".json"] }, mime: "application/json" }
  };
  var hasFileAccess = () => typeof window.showOpenFilePicker === "function";
  var formatOf = (name) => /\.json$/i.test(name || "") ? "json" : "yaml";
  var renamed = (name, format) => `${(name || "home").replace(/\.(ya?ml|json)$/i, "")}.${format === "json" ? "json" : "yaml"}`;
  async function pickFile() {
    if (hasFileAccess()) {
      try {
        const [handle] = await window.showOpenFilePicker({ types: [{
          description: "Home (YAML or JSON)",
          accept: { "text/yaml": [".yaml", ".yml"], "application/json": [".json"] }
        }] });
        const file = await handle.getFile();
        return { name: file.name, text: await file.text(), handle };
      } catch (e) {
        if (e.name === "AbortError") return null;
        throw e;
      }
    }
    return new Promise((resolve) => {
      const input2 = Object.assign(document.createElement("input"), { type: "file", accept: ".yaml,.yml,.json" });
      input2.onchange = async () => {
        const file = input2.files[0];
        resolve(file ? { name: file.name, text: await file.text(), handle: null } : null);
      };
      input2.oncancel = () => resolve(null);
      input2.click();
    });
  }
  async function droppedFile(dataTransfer) {
    const item = [...dataTransfer.items].find((i) => i.kind === "file");
    if (!item) return null;
    const handle = await item.getAsFileSystemHandle?.().catch(() => null);
    const file = handle?.kind === "file" ? await handle.getFile() : item.getAsFile();
    return file && { name: file.name, text: await file.text(), handle: handle?.kind === "file" ? handle : null };
  }
  async function writeFile(handle, text2) {
    if (await handle.queryPermission?.({ mode: "readwrite" }) === "prompt") await handle.requestPermission({ mode: "readwrite" });
    const w = await handle.createWritable();
    await w.write(text2);
    await w.close();
  }
  async function saveFileAs(text2, format, name) {
    const type = TYPES[format];
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: type.description, accept: type.accept }] });
        await writeFile(handle, text2);
        return { name: handle.name, handle };
      } catch (e) {
        if (e.name === "AbortError") return null;
        throw e;
      }
    }
    const a = Object.assign(document.createElement("a"), {
      download: name,
      href: URL.createObjectURL(new Blob([text2], { type: type.mime }))
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
    return { name, handle: null };
  }
  var db = () => new Promise((resolve, reject) => {
    const req = indexedDB.open("lightwell-editor", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("pictures");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  var inStore = (mode, fn) => db().then((d) => new Promise((resolve, reject) => {
    const req = fn(d.transaction("pictures", mode).objectStore("pictures"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  var savePicture = (path, blob) => inStore("readwrite", (s) => s.put(blob, path)).catch(() => null);
  var loadPicture = (path) => inStore("readonly", (s) => s.get(path)).catch(() => null);
  function imageSize(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("That picture didn't load"));
      img.src = url;
    });
  }

  // src/editor/live.js
  var STORE = "lightwell-editor:ha";
  var PENDING = "lightwell-editor:ha-pending";
  function haUrl(input2) {
    let v = String(input2 || "").trim();
    if (!v) return null;
    if (/^[a-z][\w+.-]*:\/\//i.test(v) && !/^https?:\/\//i.test(v)) return null;
    if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
    try {
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol) || !u.hostname) return null;
      return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      return null;
    }
  }
  var wsUrl = (base) => `${base.replace(/^http/, "ws")}/api/websocket`;
  function cannotReach(base, page) {
    if (!/^https?:$/.test(page.protocol)) return "The live connection needs the editor served from a web address: the hosted editor, or a local server (npx serve, python3 -m http.server) for an HA on your network.";
    if (page.protocol === "https:" && base.startsWith("http:") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(base)) {
      return "This page is served over https, and the browser won't let it reach an HA on plain http. Use HA's https address (Nabu Casa, or your own certificate), or open the editor from a local server.";
    }
    return "";
  }
  function clientOf(page) {
    const here = `${page.origin}${page.pathname}`;
    return { clientId: here, redirectUri: here };
  }
  function authorizeUrl(base, { clientId, redirectUri }, state) {
    const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state });
    return `${base}/auth/authorize?${q}`;
  }
  function applyEvent(states, event) {
    const { entity_id: id, new_state: s } = event?.data || {};
    if (!id) return states;
    const next = { ...states };
    if (s) next[id] = s;
    else delete next[id];
    return next;
  }
  var tokensOf = (answer, base, clientId, now = Date.now()) => ({
    base,
    clientId,
    access_token: answer.access_token,
    refresh_token: answer.refresh_token,
    expires: now + (answer.expires_in || 1800) * 1e3
  });
  var storage = {
    get(key) {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    set(key, v) {
      try {
        v === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(v));
      } catch {
      }
    }
  };
  var savedTokens = () => storage.get(STORE);
  function signIn(base, page = location) {
    const client = clientOf(page), state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    storage.set(PENDING, { base, state, ...client });
    page.assign(authorizeUrl(base, client, state));
  }
  async function finishSignIn(page = location) {
    const q = new URLSearchParams(page.search), code = q.get("code"), state = q.get("state");
    if (!code) return null;
    const pending = storage.get(PENDING);
    storage.set(PENDING, null);
    q.delete("code");
    q.delete("state");
    history.replaceState(null, "", `${page.pathname}${q.size ? `?${q}` : ""}${page.hash}`);
    if (!pending || pending.state !== state) throw new Error("That sign-in to Home Assistant didn't come from this page: connect again.");
    const tokens = tokensOf(await tokenRequest(pending.base, { grant_type: "authorization_code", code, client_id: pending.clientId }), pending.base, pending.clientId);
    storage.set(STORE, tokens);
    return tokens;
  }
  async function tokenRequest(base, form) {
    const r = await fetch(`${base}/auth/token`, { method: "POST", body: new URLSearchParams(form) });
    if (!r.ok) throw new Error(`Home Assistant refused the sign-in (${r.status}): connect again.`);
    return r.json();
  }
  async function freshTokens(tokens) {
    if (tokens.expires - Date.now() > 6e4) return tokens;
    const answer = await tokenRequest(tokens.base, { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: tokens.clientId });
    const next = tokensOf({ ...answer, refresh_token: tokens.refresh_token }, tokens.base, tokens.clientId);
    storage.set(STORE, next);
    return next;
  }
  async function signOut(tokens = savedTokens()) {
    storage.set(STORE, null);
    if (tokens?.refresh_token) await fetch(`${tokens.base}/auth/revoke`, { method: "POST", body: new URLSearchParams({ token: tokens.refresh_token }) }).catch(() => {
    });
  }
  var HaConnection = class {
    constructor(tokens, { onStates, onConfig, onStatus, WebSocketImpl = globalThis.WebSocket }) {
      Object.assign(this, { tokens, onStates, onConfig, onStatus, WebSocketImpl, states: {}, closed: false, retry: 1e3 });
      this._open();
    }
    async _open() {
      if (this.closed) return;
      try {
        this.tokens = await freshTokens(this.tokens);
      } catch (e) {
        this.onStatus?.(e.message, false);
        return;
      }
      const ws = this.ws = new this.WebSocketImpl(wsUrl(this.tokens.base));
      let id = 0;
      const send = (msg) => {
        ws.send(JSON.stringify({ id: ++id, ...msg }));
        return id;
      };
      const asked = {};
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "auth_required") ws.send(JSON.stringify({ type: "auth", access_token: this.tokens.access_token }));
        else if (msg.type === "auth_invalid") {
          this.onStatus?.(`Home Assistant refused the connection: ${msg.message}. Connect again.`, false);
          this.close();
        } else if (msg.type === "auth_ok") {
          this.retry = 1e3;
          asked.states = send({ type: "get_states" });
          asked.config = send({ type: "get_config" });
          send({ type: "subscribe_events", event_type: "state_changed" });
          this.onStatus?.(`Connected to Home Assistant ${msg.ha_version}`, true);
        } else if (msg.type === "result" && msg.id === asked.states && msg.success) {
          this.states = Object.fromEntries(msg.result.map((s) => [s.entity_id, s]));
          this._tell();
        } else if (msg.type === "result" && msg.id === asked.config && msg.success) {
          const { latitude, longitude, location_name: name } = msg.result;
          this.onConfig?.({ latitude, longitude, name });
        } else if (msg.type === "event" && msg.event?.event_type === "state_changed") {
          this.states = applyEvent(this.states, msg.event);
          this._tell();
        }
      };
      ws.onclose = () => {
        if (this.closed) return;
        this.onStatus?.("The connection to Home Assistant dropped: trying again\u2026", false);
        setTimeout(() => this._open(), this.retry);
        this.retry = Math.min(this.retry * 2, 3e4);
      };
    }
    // The states, at most every 250 ms.
    _tell() {
      this._timer || (this._timer = setTimeout(() => {
        this._timer = 0;
        this.onStates?.(this.states);
      }, 250));
    }
    close() {
      this.closed = true;
      clearTimeout(this._timer);
      this.ws?.close();
    }
  };

  // src/editor/hit.js
  var MARKER = 0.03;
  var TEXT = { room: 40, lbl: 24 };
  var inPoly = (poly, [x, y]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  var nearSegment = ([ax, ay], [bx, by], [x, y], tol) => {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= tol;
  };
  var nearPoly = (poly, p, tol, closed = true) => poly.some((a, i) => (closed || i < poly.length - 1) && nearSegment(a, poly[(i + 1) % poly.length], p, tol));
  var inRect = ([x, y, w, h2], [px, py], tol = 0) => px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h2 + tol;
  function pathLines(d) {
    const lines = [], closed = [];
    let line = null, x = 0, y = 0, sx = 0, sy = 0;
    const tokens = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
    let cmd = null;
    const num = () => +tokens.shift();
    const takes = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
    while (tokens.length) {
      if (/[a-zA-Z]/.test(tokens[0])) cmd = tokens.shift();
      if (!cmd) break;
      const C2 = cmd.toUpperCase(), rel = cmd !== C2;
      if (C2 === "Z") {
        if (line) {
          line.push([sx, sy]);
          closed[lines.length - 1] = true;
        }
        [x, y] = [sx, sy];
        line = null;
        cmd = null;
        continue;
      }
      if (!(C2 in takes) || tokens.length < takes[C2] || /[a-zA-Z]/.test(tokens[0])) break;
      const v = Array.from({ length: takes[C2] }, num);
      if (C2 === "H") x = rel ? x + v[0] : v[0];
      else if (C2 === "V") y = rel ? y + v[0] : v[0];
      else [x, y] = rel ? [x + v.at(-2), y + v.at(-1)] : [v.at(-2), v.at(-1)];
      if (C2 === "M") {
        line = [[x, y]];
        lines.push(line);
        closed.push(false);
        [sx, sy] = [x, y];
        cmd = rel ? "l" : "L";
      } else {
        if (!line) {
          line = [[sx, sy]];
          lines.push(line);
          closed.push(false);
        }
        line.push([x, y]);
      }
    }
    return { lines, closed };
  }
  function parseTransform(t) {
    if (typeof t !== "string" || !t.trim()) return null;
    const mul = ([a, b, c, d, e, f], [A, B, C2, D, E2, F]) => [a * A + c * B, b * A + d * B, a * C2 + c * D, b * C2 + d * D, a * E2 + c * F + e, b * E2 + d * F + f];
    let m2 = [1, 0, 0, 1, 0, 0], rest = t;
    const re = /^\s*,?\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/;
    while (rest.trim()) {
      const found = rest.match(re);
      if (!found) return null;
      rest = rest.slice(found[0].length);
      const v = found[2].split(/[\s,]+/).filter(Boolean).map(Number), rad2 = (v[0] || 0) * Math.PI / 180;
      if (v.some(Number.isNaN)) return null;
      const [cos, sin] = [Math.cos(rad2), Math.sin(rad2)];
      const step = {
        matrix: () => v.length === 6 && v,
        translate: () => [1, 0, 0, 1, v[0] || 0, v[1] || 0],
        scale: () => [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0],
        rotate: () => {
          const [cx = 0, cy = 0] = v.slice(1);
          return mul(mul([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
        },
        skewX: () => [1, 0, Math.tan(rad2), 1, 0, 0],
        skewY: () => [1, Math.tan(rad2), 0, 1, 0, 0]
      }[found[1]]();
      if (!step) return null;
      m2 = mul(m2, step);
    }
    return m2;
  }
  var applyTransform = (m2, [x, y]) => m2 ? [m2[0] * x + m2[2] * y + m2[4], m2[1] * x + m2[3] * y + m2[5]] : [x, y];
  function invertTransform([a, b, c, d, e, f]) {
    const det = a * d - b * c;
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  }
  function shapeGeometry(s, k = 1) {
    const g = { polys: [], lines: [], circles: [], width: +s?.stroke_width || 0 };
    if (!s || typeof s !== "object" || s.svg !== void 0) return g;
    const copies = s.repeat ? s.repeat.count : 1, [dx, dy] = s.repeat?.step || [0, 0];
    for (let i = 0; i < copies; i++) {
      const ox = dx * i, oy = dy * i, at = ([x, y]) => [x + ox, y + oy];
      if (s.rect) g.polys.push(box(s.rect[0] + ox, s.rect[1] + oy, s.rect[2], s.rect[3]));
      else if (s.circle) g.circles.push([s.circle[0] + ox, s.circle[1] + oy, s.circle[2], s.circle[2]]);
      else if (s.ellipse) g.circles.push([s.ellipse[0] + ox, s.ellipse[1] + oy, s.ellipse[2], s.ellipse[3]]);
      else if (s.poly) g.polys.push(s.poly.map(at));
      else if (s.path !== void 0) {
        const { lines, closed } = pathLines(s.path);
        lines.forEach((l, j) => (closed[j] ? g.polys : g.lines).push(l.map(at)));
      } else if (s.text !== void 0 && s.at) {
        const size = (TEXT[s.class] ?? 24) * k, w = String(s.text).length * size * 0.55;
        const [x, y] = at(s.at), x0 = TEXT[s.class] ? x - w / 2 : x;
        g.polys.push(box(x0, y - size * 0.8, w, size));
      }
    }
    const m2 = parseTransform(s.transform);
    if (!m2) return g;
    const ellipse = ([cx, cy, rx, ry]) => Array.from({ length: 24 }, (_, j) => [cx + rx * Math.cos(j * Math.PI / 12), cy + ry * Math.sin(j * Math.PI / 12)]);
    const map2 = (list) => list.map((q) => applyTransform(m2, q));
    return { polys: [...g.polys, ...g.circles.map(ellipse)].map(map2), lines: g.lines.map(map2), circles: [], width: g.width };
  }
  var inGeometry = (g, p, tol) => g.polys.some((poly) => inPoly(poly, p) || nearPoly(poly, p, tol)) || g.lines.some((l) => nearPoly(l, p, tol + g.width / 2, false)) || g.circles.some(([cx, cy, rx, ry]) => ((p[0] - cx) / (rx + tol)) ** 2 + ((p[1] - cy) / (ry + tol)) ** 2 <= 1);
  var blockerGeometry = (b) => ({ polys: b?.rect ? [box(...b.rect)] : Array.isArray(b?.poly) ? [b.poly] : [], lines: [], circles: [], width: 0 });
  var spillGeometry = (s) => ({ polys: [], lines: [], circles: [s].filter((x) => [x?.cx, x?.cy, x?.rx, x?.ry].every((v) => typeof v === "number")).map((x) => [x.cx, x.cy, x.rx, x.ry]), width: 0 });
  function pieceOutline({ shape: { rect, turn: turn2 = 0, circle, poly } }) {
    if (rect) return { poly: box(...rect, turn2) };
    if (circle) return { circle };
    return { poly: turnPoly(poly, turn2) };
  }
  function onPiece(piece, p, tol = 0) {
    const o = pieceOutline(piece);
    return o.poly ? inPoly(o.poly, p) || nearPoly(o.poly, p, tol) : Math.hypot(p[0] - o.circle[0], p[1] - o.circle[1]) <= o.circle[2] + tol;
  }
  var isExtra = (path) => Array.isArray(path) && path.length === 4 && path[0] === "furniture" && path[2] === "extra";
  var pieceTurn = (piece) => {
    const s = piece?.shape || {}, c = s.turn && pieceCentre(s);
    return c ? `rotate(${s.turn} ${c[0]} ${c[1]})` : "";
  };
  function drawnExtra(piece, s) {
    const t = pieceTurn(piece);
    return t && s && typeof s === "object" && s.svg === void 0 ? { ...s, transform: [t, s.transform].filter(Boolean).join(" ") } : s;
  }
  var regionPolys = (region) => Array.isArray(region?.[0]?.[0]) ? [region[0]] : (region || []).map((r) => box(...r));
  var partPoly = (q) => Array.isArray(q?.[0]) ? q : Array.isArray(q) && q.length === 4 ? box(...q) : null;
  function lightCentre(g) {
    if (g.pool) return [g.pool.x, g.pool.y];
    const s = g.shape?.[0];
    if (s?.circle) return s.circle.slice(0, 2);
    if (s?.ellipse) return s.ellipse.slice(0, 2);
    if (s?.rect) return [s.rect[0] + s.rect[2] / 2, s.rect[1] + s.rect[3] / 2];
    if (s?.poly) return [s.poly.reduce((a, p) => a + p[0], 0) / s.poly.length, s.poly.reduce((a, p) => a + p[1], 0) / s.poly.length];
    return null;
  }
  function hitTest(home, p, tol = 0) {
    const k = home.view.w / 1145, hits = [];
    (home.markers || []).forEach((m2, i) => {
      if (Math.hypot(p[0] - m2.x, p[1] - m2.y) <= MARKER * home.view.w + tol) hits.push(["markers", i]);
    });
    (home.lights || []).forEach((g, i) => {
      const c = lightCentre(g);
      if (c && Math.hypot(p[0] - c[0], p[1] - c[1]) <= 2 * tol + 4 * k) hits.push(["lights", i]);
    });
    for (const [name, piece] of Object.entries(home.furniture || {}).reverse()) if (onPiece(piece, p, tol)) hits.push(["furniture", name]);
    (home.openings || []).forEach((o, i) => {
      if (inRect(shutterRect(o), p, tol)) hits.push(["openings", i]);
    });
    (home.lights || []).forEach((g, i) => {
      if (!hits.some((h2) => h2[0] === "lights" && h2[1] === i) && (g.shape || []).some((s) => inGeometry(shapeGeometry(s, k), p, tol))) hits.push(["lights", i]);
    });
    for (const slot of [...SLOTS].reverse()) {
      const list = home.drawing?.[slot];
      if (!Array.isArray(list)) continue;
      for (let i = list.length - 1; i >= 0; i--) if (inGeometry(shapeGeometry(list[i], k), p, tol)) hits.push(["drawing", slot, i]);
    }
    (home.sun?.blockers || []).forEach((b, i) => {
      if (inGeometry(blockerGeometry(b), p, tol)) hits.push(["sun", "blockers", i]);
    });
    (home.sun?.spill || []).forEach((s, i) => {
      if (inGeometry(spillGeometry(s), p, tol)) hits.push(["sun", "spill", i]);
    });
    for (const [name, region] of Object.entries(home.rooms || {}).reverse()) {
      if (regionPolys(region).some((poly) => inPoly(poly, p))) hits.push(["rooms", name]);
    }
    return hits;
  }
  function hitInside(home, name, p, tol = 0) {
    const piece = home.furniture?.[name], list = piece?.extra, k = home.view.w / 1145, hits = [];
    if (!Array.isArray(list)) return hits;
    for (let i = list.length - 1; i >= 0; i--) if (inGeometry(shapeGeometry(drawnExtra(piece, list[i]), k), p, tol)) hits.push(["furniture", name, "extra", i]);
    return hits;
  }
  var itemAt = (home, path) => path.reduce((o, k) => o?.[k], home);
  function outlineSvg(home, path) {
    const item = itemAt(home, path), k = home.view.w / 1145, f = (v) => +v.toFixed(1);
    if (!item) return "";
    const pts = (poly) => poly.map((q) => q.map(f).join(",")).join(" ");
    const geometry = (g) => [
      ...g.polys.map((poly) => `<polygon points="${pts(poly)}"/>`),
      ...g.lines.map((l) => `<polyline points="${pts(l)}"/>`),
      ...g.circles.map(([cx, cy, rx, ry]) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"/>`)
    ].join("");
    switch (path[0]) {
      case "markers":
        return `<circle cx="${item.x}" cy="${item.y}" r="${f(MARKER * home.view.w)}"/>`;
      case "furniture": {
        if (isExtra(path)) return geometry(shapeGeometry(drawnExtra(home.furniture[path[1]], item), k));
        if (path.length !== 2) return "";
        const o = pieceOutline(item);
        return o.poly ? `<polygon points="${pts(o.poly)}"/>` : `<circle cx="${o.circle[0]}" cy="${o.circle[1]}" r="${o.circle[2]}"/>`;
      }
      case "openings": {
        const [x, y, w, h2] = shutterRect(item);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h2}"/>`;
      }
      case "lights": {
        const shapes = (item.shape || []).map((s) => geometry(shapeGeometry(s, k))).join("");
        const pool = item.pool ? `<circle class="pool" cx="${item.pool.x}" cy="${item.pool.y}" r="${item.pool.r}"/>` : "";
        const c = lightCentre(item);
        return shapes + pool + (c ? `<circle class="dot" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(4 * k)}"/>` : "");
      }
      case "drawing":
        return path.length === 3 ? geometry(shapeGeometry(item, k)) : "";
      case "rooms":
        return (path.length === 3 ? [partPoly(item)].filter(Boolean) : regionPolys(item)).map((poly) => `<polygon points="${pts(poly)}"/>`).join("");
      case "sun":
        return path.length !== 3 ? "" : geometry(path[1] === "spill" ? spillGeometry(item) : path[1] === "blockers" ? blockerGeometry(item) : { polys: [], lines: [], circles: [] });
      default:
        return "";
    }
  }

  // src/editor/manipulate.js
  var tidy = (v) => Math.round(v * 10) / 10 || 0;
  var rad = (deg) => deg * Math.PI / 180;
  var turnBy = ([x, y], deg) => [x * Math.cos(rad(deg)) - y * Math.sin(rad(deg)), x * Math.sin(rad(deg)) + y * Math.cos(rad(deg))];
  var dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  var isNum = (v) => typeof v === "number";
  var kindOf = (path) => isExtra(path) ? "extra" : path[0] === "rooms" && path.length === 3 ? "part" : path[0] === "sun" ? { spill: "spill", blockers: "blocker" }[path[1]] : { drawing: "shape", furniture: "piece", lights: "light", markers: "marker", openings: "opening", rooms: "room" }[path[0]];
  function intoFrame(piece, [dx, dy]) {
    const m2 = parseTransform(pieceTurn(piece));
    return m2 ? applyTransform([...invertTransform(m2).slice(0, 4), 0, 0], [dx, dy]) : [dx, dy];
  }
  var ROLES = { M: "xy", L: "xy", T: "xy", H: "x", V: "y", C: "xyxyxy", S: "xyxy", Q: "xyxy", A: "XY---xy" };
  function mapPath(d, at, by) {
    let cmd = null, k = 0, start = true;
    return String(d).replace(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g, (tok) => {
      if (/^[a-zA-Z]$/.test(tok)) {
        cmd = tok;
        k = 0;
        return tok;
      }
      const C2 = cmd?.toUpperCase(), roles = ROLES[C2];
      if (!roles) return tok;
      const role = roles[k % roles.length];
      const abs = cmd === C2 || start && k < 2;
      if (++k >= 2) start = false;
      if (role === "-") return tok;
      const axis = role.toLowerCase() === "x" ? 0 : 1;
      if (abs && role === role.toLowerCase()) return String(tidy(at[axis](+tok)));
      return by ? String(tidy(by[axis](+tok))) : tok;
    });
  }
  var movePath = (d, dx, dy) => mapPath(d, [(x) => x + dx, (y) => y + dy], null);
  var TAKES = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  function pathSegments(d) {
    const re = /[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g, toks = [], segs = [];
    for (let m2; m2 = re.exec(String(d)); ) toks.push({ s: m2[0], i: m2.index });
    let cmd = null, x = 0, y = 0, start = [0, 0], sub = 0;
    for (let t = 0; t < toks.length; ) {
      if (/[a-zA-Z]/.test(toks[t].s)) {
        cmd = toks[t++].s;
        if (cmd.toUpperCase() === "Z") {
          segs.push({ C: "Z", rel: false, idx: [], from: [x, y], end: start, controls: [], sub });
          [x, y] = start;
        }
        continue;
      }
      const C2 = cmd?.toUpperCase(), n2 = TAKES[C2];
      if (!n2 || t + n2 > toks.length) break;
      const idx = Array.from({ length: n2 }, (_, j) => t + j);
      if (idx.some((j) => /[a-zA-Z]/.test(toks[j].s))) break;
      const v = idx.map((j) => +toks[j].s), rel = cmd !== C2, [ox, oy] = rel ? [x, y] : [0, 0];
      const end = C2 === "H" ? [ox + v[0], y] : C2 === "V" ? [x, oy + v[0]] : [ox + v[n2 - 2], oy + v[n2 - 1]];
      const controls = "CSQ".includes(C2) ? Array.from({ length: n2 / 2 - 1 }, (_, j) => [ox + v[2 * j], oy + v[2 * j + 1]]) : [];
      if (C2 === "M") {
        sub = segs.length;
        start = end;
      }
      segs.push({ C: C2, rel, idx, from: [x, y], end, controls, sub });
      [x, y] = end;
      if (C2 === "M") cmd = rel ? "l" : "L";
      t += n2;
    }
    return { toks, segs };
  }
  function movePathPoint(d, id, p) {
    const { toks, segs } = pathSegments(d), vals = toks.map((t) => t.s), set2 = (j, v) => {
      vals[j] = String(tidy(v));
    };
    let m2;
    if (m2 = id.match(/^c:(\d+):(\d+)$/)) {
      const seg = segs[+m2[1]], k = +m2[2];
      if (!seg?.controls[k]) return d;
      const [ox, oy] = seg.rel ? seg.from : [0, 0];
      set2(seg.idx[2 * k], p[0] - ox);
      set2(seg.idx[2 * k + 1], p[1] - oy);
    } else if (m2 = id.match(/^pt:(\d+)$/)) {
      const i = +m2[1], seg = segs[i];
      if (!seg || seg.C === "Z") return d;
      const [ox, oy] = seg.rel ? seg.from : [0, 0], n2 = seg.idx.length;
      const delta = [seg.C === "V" ? 0 : p[0] - seg.end[0], seg.C === "H" ? 0 : p[1] - seg.end[1]];
      if (seg.C === "H") set2(seg.idx[0], p[0] - ox);
      else if (seg.C === "V") set2(seg.idx[0], p[1] - oy);
      else {
        set2(seg.idx[n2 - 2], p[0] - ox);
        set2(seg.idx[n2 - 1], p[1] - oy);
      }
      const next = [segs[i + 1]];
      if (seg.C === "M") segs.forEach((z, j) => {
        if (z.C === "Z" && z.sub === i) next.push(segs[j + 1]);
      });
      for (const s of next) {
        if (!s?.rel || s.C === "Z") continue;
        const roles = { H: "x", V: "y", A: "-----xy" }[s.C] || "xy".repeat(s.idx.length / 2);
        s.idx.forEach((j, r) => {
          if (roles[r] !== "-") set2(j, +toks[j].s - delta[roles[r] === "x" ? 0 : 1]);
        });
      }
    } else return d;
    let out = String(d);
    for (let j = toks.length - 1; j >= 0; j--) if (vals[j] !== toks[j].s) out = out.slice(0, toks[j].i) + vals[j] + out.slice(toks[j].i + toks[j].s.length);
    return out;
  }
  function moveTransform(t, dx, dy) {
    const f = (v) => String(+v.toFixed(4) || 0);
    return String(t).replace(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g, (all, fn, args) => {
      const v = args.split(/[\s,]+/).filter(Boolean).map(Number);
      if (fn === "translate" || v.some(Number.isNaN)) return all;
      if (fn === "rotate") return `rotate(${f(v[0])} ${f((v[1] || 0) + dx)} ${f((v[2] || 0) + dy)})`;
      const [a, b, c, d, e, g] = parseTransform(all) || [];
      if (a === void 0) return all;
      return `matrix(${[a, b, c, d, e + dx - (a * dx + c * dy), g + dy - (b * dx + d * dy)].map(f).join(" ")})`;
    });
  }
  function moveShape(s, dx, dy) {
    if (!s || typeof s !== "object") return s;
    if (s.transform !== void 0 && s.svg === void 0) return { ...moveShape({ ...s, transform: void 0 }, dx, dy), transform: moveTransform(s.transform, dx, dy) };
    const at = ([x, y, ...rest]) => [tidy(x + dx), tidy(y + dy), ...rest];
    if (s.rect) return { ...s, rect: at(s.rect) };
    if (s.circle) return { ...s, circle: at(s.circle) };
    if (s.ellipse) return { ...s, ellipse: at(s.ellipse) };
    if (s.poly) return { ...s, poly: s.poly.map(at) };
    if (s.path !== void 0) return { ...s, path: movePath(s.path, dx, dy) };
    if (s.text !== void 0 && s.at) return { ...s, at: at(s.at) };
    return s;
  }
  function scaleShape(s, from, to) {
    if (!s || typeof s !== "object" || s.svg !== void 0) return s;
    const [sx, sy] = [to[2] / from[2], to[3] / from[3]];
    const X = (x) => to[0] + (x - from[0]) * sx, Y = (y) => to[1] + (y - from[1]) * sy;
    const at = ([x, y, ...rest]) => [tidy(X(x)), tidy(Y(y)), ...rest];
    const out = { ...s };
    if (s.rect) out.rect = [...at(s.rect).slice(0, 2), tidy(s.rect[2] * sx), tidy(s.rect[3] * sy)];
    else if (s.circle) out.circle = [...at(s.circle).slice(0, 2), tidy(s.circle[2] * Math.min(sx, sy))];
    else if (s.ellipse) out.ellipse = [...at(s.ellipse).slice(0, 2), tidy(s.ellipse[2] * sx), tidy(s.ellipse[3] * sy)];
    else if (s.poly) out.poly = s.poly.map(at);
    else if (s.path !== void 0) out.path = mapPath(s.path, [X, Y], [(x) => x * sx, (y) => y * sy]);
    else if (s.text !== void 0 && s.at) out.at = at(s.at);
    if (s.repeat?.step) out.repeat = { ...s.repeat, step: [tidy(s.repeat.step[0] * sx), tidy(s.repeat.step[1] * sy)] };
    if (typeof s.transform === "string") {
      const f = (v) => String(+v.toFixed(4) || 0);
      out.transform = s.transform.replace(/(rotate|translate)\s*\(([^)]*)\)/g, (all, fn, args) => {
        const v = args.split(/[\s,]+/).filter(Boolean).map(Number);
        if (v.some(Number.isNaN)) return all;
        if (fn === "translate") return `translate(${f((v[0] || 0) * sx)} ${f((v[1] || 0) * sy)})`;
        return v.length < 3 ? all : `rotate(${f(v[0])} ${f(X(v[1]))} ${f(Y(v[2]))})`;
      });
    }
    return out;
  }
  var pieceBox = (shape) => shape?.rect ? shape.rect.slice(0, 4) : shape?.circle ? [shape.circle[0] - shape.circle[2], shape.circle[1] - shape.circle[2], 2 * shape.circle[2], 2 * shape.circle[2]] : null;
  function moveItem(path, item, dx, dy, { piece } = {}) {
    switch (kindOf(path)) {
      case "shape":
        return moveShape(item, dx, dy);
      case "extra":
        return moveShape(item, ...intoFrame(piece, [dx, dy]));
      case "piece":
        return { ...item, shape: moveShape(item.shape, dx, dy), ...Array.isArray(item.extra) ? { extra: item.extra.map((s) => moveShape(s, dx, dy)) } : {} };
      case "light":
        return {
          ...item,
          ...Array.isArray(item.shape) ? { shape: item.shape.map((s) => moveShape(s, dx, dy)) } : {},
          ...item.pool ? { pool: { ...item.pool, x: tidy(item.pool.x + dx), y: tidy(item.pool.y + dy) } } : {}
        };
      case "marker":
        return { ...item, x: tidy(item.x + dx), y: tidy(item.y + dy) };
      case "spill":
        return { ...item, cx: tidy(item.cx + dx), cy: tidy(item.cy + dy) };
      case "part":
        return moveItem(["rooms", "r"], [item], dx, dy)[0];
      case "blocker":
        return { ...item, ...moveShape(item.rect ? { rect: item.rect } : { poly: item.poly }, dx, dy) };
      case "opening":
        return isHorizontal(item) ? { ...item, x: tidy(item.x + dx) } : { ...item, y: tidy(item.y + dy) };
      case "room":
        return item.map((q) => Array.isArray(q[0]) ? q.map(([x, y]) => [tidy(x + dx), tidy(y + dy)]) : moveShape({ rect: q }, dx, dy).rect);
      default:
        return item;
    }
  }
  var axesOf = (path, item) => kindOf(path) === "opening" ? isHorizontal(item) ? [1, 0] : [0, 1] : [1, 1];
  function anchors(path, item, k = 1, { piece } = {}) {
    const fromGeometry = (g) => [
      ...g.polys.flat(),
      ...g.lines.flat(),
      ...g.circles.flatMap(([cx, cy, rx, ry]) => [[cx, cy], [cx - rx, cy], [cx + rx, cy], [cx, cy - ry], [cx, cy + ry]])
    ];
    const circle = ([cx, cy, r]) => fromGeometry({ polys: [], lines: [], circles: [[cx, cy, r, r]] });
    if (!item) return [];
    switch (kindOf(path)) {
      case "extra":
        return anchors(["drawing", "extra", 0], drawnExtra(piece, item), k);
      case "shape": {
        if (item.text !== void 0 && item.at) return [applyTransform(parseTransform(item.transform), item.at.slice(0, 2))];
        return fromGeometry(shapeGeometry(item, k));
      }
      case "piece": {
        const o = pieceOutline(item);
        return o.poly || circle(o.circle);
      }
      case "light":
        return (Array.isArray(item.shape) ? item.shape : []).flatMap((s) => fromGeometry(shapeGeometry(s, k))).concat(item.pool ? [[item.pool.x, item.pool.y]] : []);
      case "marker":
        return [[item.x, item.y]];
      case "part":
        return partPoly(item) || [];
      case "spill":
        return fromGeometry({ polys: [], lines: [], circles: [[item.cx, item.cy, item.rx, item.ry]] });
      case "blocker":
        return item.rect ? box(...item.rect) : item.poly || [];
      case "opening": {
        const [x, y, w, h2] = shutterRect(item);
        return box(x, y, w, h2);
      }
      case "room":
        return regionPolys(item).flat();
      default:
        return [];
    }
  }
  var boundsOf = (pts) => pts.reduce(
    ([a, b, c, d], [x, y]) => [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
  function shapeHandles(s, { turnable, reach = 20 } = {}) {
    if (!s || typeof s !== "object") return [];
    const m2 = !turnable && parseTransform(s.transform);
    if (m2) return shapeHandles({ ...s, transform: void 0 }).map((h2) => ({ ...h2, at: applyTransform(m2, h2.at) }));
    if (s.rect) {
      const [x, y, w, h2] = s.rect, t = s.turn || 0, c = [x + w / 2, y + h2 / 2];
      const at = (ax, ay) => {
        const [u, v] = turnBy([ax * w / 2, ay * h2 / 2], t);
        return [c[0] + u, c[1] + v];
      };
      const out = [];
      for (const ay of [-1, 0, 1]) for (const ax of [-1, 0, 1]) if (ax || ay) out.push({ id: `rect:${ax},${ay}`, at: at(ax, ay) });
      if (turnable) {
        const [u, v] = turnBy([0, -h2 / 2 - reach], t);
        out.push({ id: "turn", at: [c[0] + u, c[1] + v], turn: true });
      }
      return out;
    }
    if (typeof s.path === "string" && !s.repeat) {
      const { segs } = pathSegments(s.path);
      return segs.flatMap((seg, i) => seg.C === "Z" ? [] : [
        { id: `pt:${i}`, at: seg.end },
        ...seg.controls.map((c, j) => ({ id: `c:${i}:${j}`, at: c, ctrl: true }))
      ]);
    }
    if (s.circle) return [{ id: "r", at: [s.circle[0] + s.circle[2], s.circle[1]] }];
    if (s.ellipse) return [{ id: "rx", at: [s.ellipse[0] + s.ellipse[2], s.ellipse[1]] }, { id: "ry", at: [s.ellipse[0], s.ellipse[1] + s.ellipse[3]] }];
    if (Array.isArray(s.poly) && turnable) {
      const xs = s.poly.map((q) => q[0]), ys = s.poly.map((q) => q[1]), c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      const [u, v] = turnBy([0, -(Math.max(...ys) - Math.min(...ys)) / 2 - reach], s.turn || 0);
      return [...s.turn ? [] : shapeHandles({ poly: s.poly }), { id: "turn", at: [c[0] + u, c[1] + v], turn: true }];
    }
    if (Array.isArray(s.poly)) {
      const p = s.poly;
      return [
        ...p.map((q, i) => ({ id: `v:${i}`, at: q })),
        ...p.map((q, i) => ({ id: `mid:${i}`, at: [(q[0] + p[(i + 1) % p.length][0]) / 2, (q[1] + p[(i + 1) % p.length][1]) / 2], mid: true }))
      ];
    }
    return [];
  }
  function partOf(path, item, id, piece) {
    const [head, rest] = id.includes("/") ? [id.slice(0, id.indexOf("/")), id.slice(id.indexOf("/") + 1)] : [null, id];
    switch (kindOf(path)) {
      case "shape":
        return { s: item, put: (s) => s, id };
      // As it's drawn (turned with the piece), and back with its own transform.
      case "extra":
        return { s: drawnExtra(piece, item), put: (s) => {
          const out = { ...item, ...s, transform: item.transform };
          if (item.transform === void 0) delete out.transform;
          return out;
        }, id };
      case "piece":
        return { s: item.shape, put: (s) => ({ ...item, shape: s }), id, turnable: !!(item.shape?.rect || item.shape?.poly) };
      case "light": {
        const i = +head?.slice(1);
        if (!/^s\d+$/.test(head || "") || !item.shape?.[i]) return null;
        return { s: item.shape[i], put: (s) => ({ ...item, shape: item.shape.map((x, j) => j === i ? s : x) }), id: rest };
      }
      case "part":
        return { s: Array.isArray(item[0]) ? { poly: item } : { rect: item }, put: (s) => s.rect || s.poly, id };
      case "spill":
        return { s: { ellipse: [item.cx, item.cy, item.rx, item.ry] }, put: ({ ellipse: [cx, cy, rx, ry] }) => ({ ...item, cx, cy, rx, ry }), id };
      case "blocker":
        return { s: item.rect ? { rect: item.rect } : { poly: item.poly }, put: (s) => ({ ...item, ...s }), id };
      case "room": {
        if (head === "p" && Array.isArray(item[0]?.[0])) return { s: { poly: item[0] }, put: (s) => [s.poly], id: rest };
        const j = +head?.slice(1);
        if (!/^q\d+$/.test(head || "") || !item[j]) return null;
        return { s: { rect: item[j] }, put: (s) => item.map((q, i) => i === j ? s.rect : q), id: rest };
      }
      default:
        return null;
    }
  }
  function handles(path, item, { reach, piece } = {}) {
    if (!item || typeof item !== "object") return [];
    const prefixed = (pre, list) => list.map((h2) => ({ ...h2, id: `${pre}/${h2.id}` }));
    switch (kindOf(path)) {
      case "shape":
        return shapeHandles(item);
      case "extra":
        return shapeHandles(drawnExtra(piece, item));
      case "piece":
        return shapeHandles(item.shape, { turnable: !!(item.shape?.rect || item.shape?.poly), reach });
      case "light":
        return [
          ...item.pool ? [{ id: "pool", at: [item.pool.x, item.pool.y] }, { id: "pool-r", at: [item.pool.x + item.pool.r, item.pool.y] }] : [],
          ...Array.isArray(item.shape) ? item.shape.flatMap((s, i) => prefixed(`s${i}`, shapeHandles(s))) : []
        ];
      case "part":
        return shapeHandles(Array.isArray(item[0]) ? { poly: item } : { rect: item });
      case "spill":
        return shapeHandles({ ellipse: [item.cx, item.cy, item.rx, item.ry] });
      case "blocker":
        return shapeHandles(item.rect ? { rect: item.rect } : { poly: item.poly });
      case "opening": {
        const [x, y, w, h2] = shutterRect(item);
        return isHorizontal(item) ? [{ id: "end:0", at: [x, y + h2 / 2] }, { id: "end:1", at: [x + w, y + h2 / 2] }] : [{ id: "end:0", at: [x + w / 2, y] }, { id: "end:1", at: [x + w / 2, y + h2] }];
      }
      case "room":
        return Array.isArray(item[0]?.[0]) ? prefixed("p", shapeHandles({ poly: item[0] })) : item.flatMap((q, j) => prefixed(`q${j}`, shapeHandles({ rect: q })));
      default:
        return [];
    }
  }
  function snapsHandle(path, item, id, { piece } = {}) {
    const part = partOf(path, item, id, piece);
    return !(part && (part.id === "turn" || (part.s?.rect || part.s?.poly) && part.s.turn));
  }
  function startHandle(path, item, id, { piece } = {}) {
    const part = partOf(path, item, id, piece), m2 = part?.id.match(/^mid:(\d+)$/);
    if (!m2) return { item, id };
    const i = +m2[1], p = part.s.poly, q = p[(i + 1) % p.length];
    const poly = [...p.slice(0, i + 1), [tidy((p[i][0] + q[0]) / 2), tidy((p[i][1] + q[1]) / 2)], ...p.slice(i + 1)];
    return { item: part.put({ ...part.s, poly }), id: id.replace(/mid:\d+$/, `v:${i + 1}`) };
  }
  function removeCorner(path, item, id, { piece } = {}) {
    const part = partOf(path, item, id, piece), m2 = part?.id.match(/^v:(\d+)$/);
    if (!m2 || part.s.poly.length <= 3) return null;
    return part.put({ ...part.s, poly: part.s.poly.filter((_, i) => i !== +m2[1]) });
  }
  function resizeRect([x, y, w, h2], turn2, ax, ay, p) {
    const c = [x + w / 2, y + h2 / 2], q = turnBy([p[0] - c[0], p[1] - c[1]], -turn2);
    const span = (a, half, v2) => a ? [Math.min(-a * half, v2), Math.max(-a * half, v2)] : [-half, half];
    const [x0, x1] = span(ax, w / 2, q[0]), [y0, y1] = span(ay, h2 / 2, q[1]);
    const nw = Math.max(x1 - x0, 1), nh = Math.max(y1 - y0, 1);
    const [u, v] = turnBy([(x0 + x1) / 2, (y0 + y1) / 2], turn2), nc = [c[0] + u, c[1] + v];
    return [tidy(nc[0] - nw / 2), tidy(nc[1] - nh / 2), tidy(nw), tidy(nh)];
  }
  function dragShape(s, id, p, { turnStep }) {
    let m2;
    if ((m2 = id.match(/^rect:(-?\d),(-?\d)$/)) && s.rect) {
      const rect = resizeRect(s.rect, s.turn || 0, +m2[1], +m2[2], p);
      return { s: { ...s, rect }, ruler: { size: [rect[2], rect[3]] } };
    }
    if (id === "turn" && (s.rect || s.poly)) {
      const xs = s.rect ? [s.rect[0], s.rect[0] + s.rect[2]] : s.poly.map((q) => q[0]), ys = s.rect ? [s.rect[1], s.rect[1] + s.rect[3]] : s.poly.map((q) => q[1]);
      const c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      let turn2 = Math.atan2(p[0] - c[0], -(p[1] - c[1])) * 180 / Math.PI;
      turn2 = turnStep ? Math.round(turn2 / turnStep) * turnStep : tidy(turn2);
      if (turn2 <= -180) turn2 += 360;
      if (turn2 > 180) turn2 -= 360;
      turn2 || (turn2 = 0);
      const { turn: _, ...rest } = s;
      return { s: turn2 || s.turn !== void 0 ? { ...rest, turn: turn2 } : rest, ruler: { angle: turn2 } };
    }
    if (id === "r" && s.circle) {
      const r = Math.max(tidy(dist(p, s.circle)), 1);
      return { s: { ...s, circle: [s.circle[0], s.circle[1], r] }, ruler: { radius: r } };
    }
    if (/^(pt|c):/.test(id) && typeof s.path === "string") {
      const path = movePathPoint(s.path, id, p), seg = pathSegments(path).segs[+id.split(":")[1]];
      return { s: { ...s, path }, ruler: seg && id.startsWith("pt") ? { length: dist(seg.from, seg.end) } : null };
    }
    if ((id === "rx" || id === "ry") && s.ellipse) {
      const e = [...s.ellipse], k = id === "rx" ? 0 : 1;
      e[2 + k] = Math.max(tidy(Math.abs(p[k] - e[k])), 1);
      return { s: { ...s, ellipse: e }, ruler: { size: [e[2] * 2, e[3] * 2] } };
    }
    if ((m2 = id.match(/^v:(\d+)$/)) && Array.isArray(s.poly)) {
      const i = +m2[1], n2 = s.poly.length, at = [tidy(p[0]), tidy(p[1])];
      const poly = s.poly.map((q, j) => j === i ? at : q);
      return { s: { ...s, poly }, ruler: { sides: [dist(poly[(i + n2 - 1) % n2], at), dist(at, poly[(i + 1) % n2])] } };
    }
    return { s, ruler: null };
  }
  function dragHandle(path, item, id, p, { turnStep = 15, piece, insides = true } = {}) {
    const kind = kindOf(path);
    if (kind === "light" && item.pool && (id === "pool" || id === "pool-r")) {
      if (id === "pool") return { item: { ...item, pool: { ...item.pool, x: tidy(p[0]), y: tidy(p[1]) } }, ruler: null };
      const r = Math.max(tidy(dist(p, [item.pool.x, item.pool.y])), 1);
      return { item: { ...item, pool: { ...item.pool, r } }, ruler: { radius: r } };
    }
    if (kind === "opening" && /^end:[01]$/.test(id)) {
      const h2 = isHorizontal(item), [a, l] = h2 ? ["x", "w"] : ["y", "h"], v = p[h2 ? 0 : 1];
      const other = id === "end:0" ? item[a] + item[l] : item[a];
      const from2 = Math.min(v, other), len = Math.max(Math.abs(v - other), 1);
      return { item: { ...item, [a]: tidy(from2), [l]: tidy(len) }, ruler: { length: tidy(len) } };
    }
    const part = partOf(path, item, id, piece);
    if (!part) return { item, ruler: null };
    const m2 = !part.turnable && parseTransform(part.s.transform);
    if (m2) p = applyTransform(invertTransform(m2), p);
    const { s, ruler } = dragShape(part.s, part.id, p, { turnStep });
    if (s === part.s) return { item, ruler };
    const next = part.put(s), from = pieceBox(part.s), to = pieceBox(s);
    if (kind === "piece" && insides && Array.isArray(item.extra) && /^(rect:|r$)/.test(part.id) && from && to) {
      next.extra = item.extra.map((x) => scaleShape(x, from, to));
    }
    return { item: next, ruler };
  }
  function rulerText(ruler, unitsPerMetre) {
    if (!ruler) return "";
    const m2 = (v) => (Math.abs(v) / unitsPerMetre).toFixed(2);
    if (ruler.size) return `${m2(ruler.size[0])} \xD7 ${m2(ruler.size[1])} m`;
    if (ruler.radius !== void 0) return `r ${m2(ruler.radius)} m`;
    if (ruler.length !== void 0) return `${m2(ruler.length)} m`;
    if (ruler.sides) return ruler.sides.map((v) => `${m2(v)} m`).join(" \xB7 ");
    if (ruler.angle !== void 0) return `${ruler.angle}\xB0`;
    if (ruler.move) return `${ruler.move[0] < 0 ? "\u2190" : "\u2192"} ${m2(ruler.move[0])} m  ${ruler.move[1] < 0 ? "\u2191" : "\u2193"} ${m2(ruler.move[1])} m`;
    return "";
  }
  function snapTargets(items, except = [], k = 1) {
    const skip = new Set(except.map((p) => JSON.stringify(p)));
    const xs = [], ys = [];
    for (const [path, item] of items) {
      if (skip.has(JSON.stringify(path))) continue;
      for (const [x, y] of anchors(path, item, k)) if (isNum(x) && isNum(y)) {
        xs.push(x);
        ys.push(y);
      }
    }
    const sorted = (a) => [...new Set(a)].sort((p, q) => p - q);
    return { xs: sorted(xs), ys: sorted(ys) };
  }
  function insideTargets(piece, except = [], k = 1) {
    const { rect, circle, poly } = piece?.shape || {}, xs = [], ys = [];
    const own = rect ? [...box(...rect.slice(0, 4)), [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2]] : circle ? anchors(["furniture", "p"], { shape: { circle } }) : poly || [];
    const extras = (Array.isArray(piece?.extra) ? piece.extra : []).flatMap((s, i) => except.includes(i) ? [] : anchors(["furniture", "p", "extra", i], s, k));
    for (const [x, y] of [...own, ...extras]) if (isNum(x) && isNum(y)) {
      xs.push(x);
      ys.push(y);
    }
    const sorted = (a) => [...new Set(a)].sort((p, q) => p - q);
    return { xs: sorted(xs), ys: sorted(ys) };
  }
  function nearest(sorted, v, tol) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    const best = [sorted[lo - 1], sorted[lo]].filter(isNum).sort((a, b) => Math.abs(a - v) - Math.abs(b - v))[0];
    return isNum(best) && Math.abs(best - v) <= tol ? best : void 0;
  }
  function snapPoint(p, { xs = [], ys = [], tol = 0, grid = 0, axis = false, from = null } = {}) {
    const lock = axis && from ? Math.abs(p[0] - from[0]) < Math.abs(p[1] - from[1]) ? 0 : 1 : -1;
    const one = (v, targets, k) => {
      if (lock === k) return { v: from[k] };
      const t = nearest(targets, v, tol);
      if (t !== void 0) return { v: t, guide: t };
      return { v: grid ? Math.round(v / grid) * grid : v };
    };
    const x = one(p[0], xs, 0), y = one(p[1], ys, 1);
    return { p: [x.v, y.v], guides: { x: x.guide, y: y.guide } };
  }
  function snapMove(pts, dx, dy, { xs = [], ys = [], tol = 0, grid = 0, axis = false, axes = [1, 1] } = {}) {
    let [mx, my] = axes;
    if (axis) Math.abs(dx) >= Math.abs(dy) ? my = 0 : mx = 0;
    const [x0, y0] = boundsOf(pts);
    const one = (d, targets, k, on) => {
      if (!on) return { d: 0 };
      let best;
      for (const q of pts) {
        const t = nearest(targets, q[k] + d, tol);
        if (t !== void 0 && (!best || Math.abs(t - q[k] - d) < Math.abs(best.d - d))) best = { d: t - q[k], guide: t };
      }
      if (best) return best;
      const start = k ? y0 : x0;
      return { d: grid && isFinite(start) ? Math.round((start + d) / grid) * grid - start : d };
    };
    const x = one(dx, xs, 0, mx), y = one(dy, ys, 1, my);
    return { dx: x.d, dy: y.d, guides: { x: x.guide, y: y.guide } };
  }

  // src/editor/create.js
  var dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function emptyHome(w, h2, unitsPerMetre = 100) {
    const u = (v) => tidy(v * unitsPerMetre), m2 = u(0.2);
    return `# A home for Lightwell, started in its editor: ${w} \xD7 ${h2} m at ${unitsPerMetre} units per metre. Every field is
# described in the README.

view: {x: ${-m2}, y: ${-m2}, w: ${u(w) + 2 * m2}, h: ${u(h2) + 2 * m2}}
units_per_metre: ${unitsPerMetre}

# Light stays inside its room: rectangles [x, y, w, h], or one polygon.
rooms: {}

drawing:
  floors: []
  walls: []
  glazing: []
  labels: []

# Windows and doors: where the sun and daylight come in.
openings: []

furniture: {}

lights: []

markers: []

sun:
  # The compass bearing the top of the plan faces (0: north).
  north: 0
`;
  }
  function pictureHome(image, w, h2) {
    return emptyHome(1, 1).replace(/view: .*\nunits_per_metre: .*/, `view: {x: 0, y: 0, w: ${w}, h: ${h2}}
# Units are the picture's pixels: this many make a metre.
units_per_metre: 100`).replace(/^# A home for Lightwell.*\n# described.*\n/, `# A home for Lightwell, drawn over a picture of its plan (${image}): in Home Assistant, put the picture
# under /config/www/. Every field is described in the README.
`).replace("drawing:\n", `drawing:
  background: {image: ${/^[\w/.-]+$/.test(image) ? image : JSON.stringify(image)}, rect: [0, 0, ${w}, ${h2}]}
`);
  }
  var scaleFrom = (a, b, metres) => Math.round(dist2(a, b) / metres * 100) / 100;
  function roomAt(data, p) {
    const rooms = Object.entries(data?.rooms || {});
    return rooms.reverse().find(([, region]) => regionPolys(region).some((poly) => inPoly(poly, p)))?.[0];
  }
  function wallRects(data) {
    return SLOTS.flatMap((slot) => (Array.isArray(data?.drawing?.[slot]) ? data.drawing[slot] : []).filter((s) => Array.isArray(s?.rect) && (s.class === "wall" || slot === "walls" && s.class !== "iwall")).map((s) => s.rect));
  }
  function inferWall(data, a, b, tol = 0) {
    const along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1, across = 1 - along;
    const mid = (a[across] + b[across]) / 2, from = Math.min(a[along], b[along]), to = Math.max(a[along], b[along]);
    let best = null;
    for (const r of wallRects(data)) {
      const lo = [r[0], r[1]], size = [r[2], r[3]];
      if (size[along] < size[across]) continue;
      if (mid < lo[across] - tol || mid > lo[across] + size[across] + tol) continue;
      const gap = Math.max(0, lo[along] - to, from - (lo[along] + size[along]));
      if (!best || gap < best.gap) best = { gap, lo: lo[across], hi: lo[across] + size[across] };
    }
    if (!best) return null;
    const probe = (v) => {
      const p = [0, 0];
      p[along] = (from + to) / 2;
      p[across] = v;
      return roomAt(data, p);
    };
    const eps = Math.max(tol, 1) + 1, before = probe(best.lo - eps), after = probe(best.hi + eps);
    let outsideBefore;
    if (after && !before) outsideBefore = true;
    else if (before && !after) outsideBefore = false;
    else {
      const polys = Object.values(data?.rooms || {}).flatMap(regionPolys).flat();
      const v = data?.view, centre = polys.length ? polys.reduce((s, p) => s + p[across], 0) / polys.length : v ? across ? v.y + v.h / 2 : v.x + v.w / 2 : 0;
      outsideBefore = centre > (best.lo + best.hi) / 2;
    }
    const wall = along === 0 ? outsideBefore ? "top" : "bottom" : outsideBefore ? "left" : "right";
    return {
      wall,
      at: tidy(outsideBefore ? best.lo : best.hi),
      depth: tidy(best.hi - best.lo),
      room: outsideBefore ? after : before,
      from: tidy(from),
      to: tidy(to)
    };
  }
  var OPENING_KINDS = { window: { lo: 0.9, hi: 2.2 }, door: { lo: 0, hi: 2.1 } };
  function openingFrom(data, a, b, { tol = 0, kind = "window" } = {}) {
    const w = inferWall(data, a, b, tol);
    if (!w || w.to - w.from < 1) return null;
    const horizontal = w.wall === "top" || w.wall === "bottom", inner = w.wall === "top" || w.wall === "left" ? w.at : w.at - w.depth;
    const pane = tidy(w.depth * 0.4), offset = tidy(inner + (w.depth - pane) / 2), len = tidy(w.to - w.from);
    const opening = {
      wall: w.wall,
      at: w.at,
      depth: w.depth,
      ...horizontal ? { x: w.from, w: len } : { y: w.from, h: len },
      ...OPENING_KINDS[kind],
      ...w.room ? { room: w.room } : {}
    };
    const glass = { rect: horizontal ? [w.from, offset, len, pane] : [offset, w.from, pane, len], class: "glass" };
    return { opening, glass };
  }
  function wallFrom(data, a, b, { thickness, inner } = {}) {
    const [x0, y0, x1, y1] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    const inside = inner ?? !!(roomAt(data, a) && roomAt(data, b) && roomAt(data, [(x0 + x1) / 2, (y0 + y1) / 2]));
    const t = thickness ?? (data?.units_per_metre || 100) * (inside ? 0.15 : 0.25);
    let rect;
    if (x1 - x0 >= t / 2 && y1 - y0 >= t / 2) rect = [x0, y0, x1 - x0, y1 - y0];
    else if (x1 - x0 >= y1 - y0) rect = [x0, (y0 + y1) / 2 - t / 2, x1 - x0, t];
    else rect = [(x0 + x1) / 2 - t / 2, y0, t, y1 - y0];
    return { rect: rect.map(tidy), class: inside ? "iwall" : "wall" };
  }
  var PIECES = [
    [/wardrobe|closet|cupboard|shel(f|v)|bookcase|cabinet|fridge|dresser/i, 2, "furn"],
    [/bedside|night/i, 0.5, "furn2"],
    [/sofa|couch|armchair/i, 0.8, "furn"],
    [/chair|stool|pouf|ottoman/i, 0.9, "furn2"],
    [/bed/i, 0.55, "furn"],
    [/coffee|side/i, 0.45, "furn"],
    [/tv|media|sideboard|bench/i, 0.5, "furn"],
    [/lamp|plant|rug|carpet|mat\b/i, null, "furn2"],
    [/table|desk|counter|island/i, 0.75, "furn"]
  ];
  function pieceDefaults(name) {
    const [, height, cls] = PIECES.find(([re]) => re.test(name)) || [null, 0.75, "furn"];
    return { ...height ? { height } : {}, ...cls !== "furn" ? { class: cls } : {} };
  }
  function pieceFrom(data, name, shape) {
    const c = shape.rect ? [shape.rect[0] + shape.rect[2] / 2, shape.rect[1] + shape.rect[3] / 2] : shape.circle ? shape.circle.slice(0, 2) : shape.poly[0];
    const d = pieceDefaults(name), room = roomAt(data, c);
    return { shape, ...d, ...d.height && room ? { shadow_room: room } : {} };
  }
  function lightFrom(data, c, r) {
    const m2 = data?.units_per_metre || 100, room = roomAt(data, c), [x, y] = c.map(tidy);
    const shadows = Object.entries(data?.furniture || {}).filter(([, p]) => p?.height && (!room || p.shadow_room === room)).map(([n2]) => n2);
    return {
      entities: ["light.new_light"],
      shape: [{ circle: [x, y, tidy(r || 0.5 * m2)] }],
      over: true,
      ...room ? { clip: room } : {},
      pool: { x, y, r: tidy(3.5 * m2), height: 1.5, shadows }
    };
  }

  // src/editor/build.js
  var WALL = { outer: 0.25, inner: 0.15 };
  var TERRACE = { light: "#d9cfc0", dark: "#3a352e" };
  var CRUMB = 0.5;
  var upm = (data) => data?.units_per_metre || 100;
  var wallsOf = (data) => (Array.isArray(data?.drawing?.walls) ? data.drawing.walls : []).map((s, i) => ({ i, rect: s?.rect, cls: s?.class })).filter((w) => Array.isArray(w.rect) && w.rect.length === 4 && w.cls !== "line");
  var overlaps = (a, b, eps = 0.01) => Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) > eps && Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) > eps;
  var inRect2 = (r, [x, y], tol = 0) => x >= r[0] - tol && x <= r[0] + r[2] + tol && y >= r[1] - tol && y <= r[1] + r[3] + tol;
  function roomKey(data, name) {
    const base = String(name).trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "room";
    let key = base;
    for (let n2 = 2; data?.rooms?.[key] !== void 0; n2++) key = `${base}_${n2}`;
    return key;
  }
  function snapRoom(data, rect, tol = 0) {
    let [x0, y0] = rect, x1 = rect[0] + rect[2], y1 = rect[1] + rect[3];
    for (const { rect: [wx, wy, ww, wh] } of wallsOf(data)) {
      if (wh >= ww && Math.min(y1, wy + wh) - Math.max(y0, wy) > 0) {
        if (x0 >= wx - tol && x0 <= wx + ww + tol && x1 > wx + ww) x0 = wx + ww;
        if (x1 >= wx - tol && x1 <= wx + ww + tol && x0 < wx) x1 = wx;
      }
      if (ww >= wh && Math.min(x1, wx + ww) - Math.max(x0, wx) > 0) {
        if (y0 >= wy - tol && y0 <= wy + wh + tol && y1 > wy + wh) y0 = wy + wh;
        if (y1 >= wy - tol && y1 <= wy + wh + tol && y0 < wy) y1 = wy;
      }
    }
    return [x0, y0, x1 - x0, y1 - y0].map(tidy);
  }
  function uncovered(s, walls) {
    const a = s[2] >= s[3] ? 0 : 1;
    let parts = [[s[a], s[a] + s[a + 2]]];
    for (const r of walls) {
      if (!overlaps(s, r)) continue;
      const lo = r[a], hi = r[a] + r[a + 2];
      parts = parts.flatMap(([p, q]) => hi <= p || lo >= q ? [[p, q]] : [[p, lo], [hi, q]].filter(([u, v]) => v - u > CRUMB));
    }
    return parts.map(([p, q]) => a === 0 ? [p, s[1], q - p, s[3]] : [s[0], p, s[2], q - p]);
  }
  function roomWalls(data, [x, y, w, h2]) {
    const t = tidy(upm(data) * WALL.outer), walls = wallsOf(data).map((v) => v.rect);
    const strips = [[x - t, y - t, w + 2 * t, t], [x - t, y + h2, w + 2 * t, t], [x - t, y, t, h2], [x + w, y, t, h2]];
    return strips.flatMap((s) => uncovered(s, walls)).map((r) => ({ rect: r.map(tidy), class: "wall" }));
  }
  function outdoors(data, name) {
    const r = data?.rooms?.[name]?.[0];
    if (!Array.isArray(r) || Array.isArray(r[0])) return false;
    const c = [r[0] + r[2] / 2, r[1] + r[3] / 2];
    const floor = (data.drawing?.floors || []).findLast((s) => Array.isArray(s?.rect) && inRect2(s.rect, c));
    return !!floor && floor.class !== "floor";
  }
  function sharedWalls(data, [x, y, w, h2]) {
    return wallsOf(data).filter(({ rect: r, cls }) => {
      if (cls !== "wall") return false;
      const vertical = r[3] > r[2], [a, b] = vertical ? [y, y + h2] : [x, x + w];
      if (Math.min(b, vertical ? r[1] + r[3] : r[0] + r[2]) - Math.max(a, vertical ? r[1] : r[0]) <= CRUMB) return false;
      const mid = (Math.max(a, vertical ? r[1] : r[0]) + Math.min(b, vertical ? r[1] + r[3] : r[0] + r[2])) / 2;
      const [lo, hi] = vertical ? [r[0], r[0] + r[2]] : [r[1], r[1] + r[3]], [e0, e1] = vertical ? [x, x + w] : [y, y + h2];
      const beyond = Math.abs(e1 - lo) < 0.01 ? hi + 1 : Math.abs(e0 - hi) < 0.01 ? lo - 1 : null;
      if (beyond === null) return false;
      const other = roomAt(data, vertical ? [beyond, mid] : [mid, beyond]);
      return other && !outdoors(data, other);
    }).map((v) => v.i);
  }
  function roomOps(data, name, rect, { outdoor = false } = {}) {
    rect = rect.map(tidy);
    const text2 = String(name ?? "").trim(), key = roomKey(data, text2 || "room"), [x, y, w, h2] = rect;
    const ops = [
      { set: ["rooms", key], value: [rect] },
      { insert: ["drawing", "floors"], value: { rect, class: outdoor ? "terrace" : "floor", part: key } }
    ];
    if (text2) ops.push({ insert: ["drawing", "labels"], value: { text: text2, at: [tidy(x + w / 2), tidy(y + h2 / 2)], class: "room", part: key } });
    if (outdoor) {
      if (!data?.palette?.light?.terrace) ops.push({ set: ["palette", "light", "terrace"], value: TERRACE.light });
      if (!data?.palette?.dark?.terrace) ops.push({ set: ["palette", "dark", "terrace"], value: TERRACE.dark });
      if (!(data?.palette?.tinted || []).includes("terrace")) ops.push({ insert: ["palette", "tinted"], value: "terrace" });
    } else {
      for (const i of sharedWalls(data, rect)) ops.push({ set: ["drawing", "walls", i, "class"], value: "iwall" });
      for (const wall of roomWalls(data, rect)) ops.push({ insert: ["drawing", "walls"], value: { ...wall, part: key } });
    }
    return { key, ops };
  }
  var CUTS = { window: "Window", glass_door: "Glass door", door: "Door" };
  function wallAt(data, p, tol = 0) {
    return wallsOf(data).filter((w) => inRect2(w.rect, p, tol)).sort((a, b) => Math.min(a.rect[2], a.rect[3]) - Math.min(b.rect[2], b.rect[3]))[0];
  }
  function cutSpan(rect, c, width) {
    const a = rect[2] >= rect[3] ? 0 : 1, start = rect[a], end = rect[a] + rect[a + 2];
    if (end - start < width) return null;
    const from = Math.min(Math.max(c - width / 2, start), end - width);
    return [tidy(from), tidy(from + width)];
  }
  function gapsOf(data, widest = 4 * upm(data)) {
    const lines = /* @__PURE__ */ new Map();
    for (const w of wallsOf(data)) {
      const r = w.rect, axis = r[2] >= r[3] ? 0 : 1, key = `${axis}:${r[1 - axis]}:${r[3 - axis]}`;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push(w);
    }
    const gaps = [];
    for (const [key, list] of lines) {
      const [axis, lo, size] = key.split(":").map(Number);
      list.sort((p, q) => p.rect[axis] - q.rect[axis]);
      for (let k = 1; k < list.length; k++) {
        const from = list[k - 1].rect[axis] + list[k - 1].rect[axis + 2], to = list[k].rect[axis];
        if (to - from > CRUMB && to - from <= widest) gaps.push({ a: list[k - 1].i, b: list[k].i, axis, from, to, band: [lo, lo + size] });
      }
    }
    return gaps;
  }
  function resizeGapOps(data, gap, from, to) {
    [from, to] = [tidy(from), tidy(to)];
    const ax = gap.axis, ops = [], same = (u, v) => Math.abs(u - v) < 0.01;
    const along = (rect, lo, hi) => {
      const r = [...rect];
      r[ax] = tidy(lo);
      r[ax + 2] = tidy(hi - lo);
      return r;
    };
    const a = data.drawing.walls[gap.a].rect, b = data.drawing.walls[gap.b].rect;
    ops.push({ set: ["drawing", "walls", gap.a, "rect"], value: along(a, a[ax], from) });
    ops.push({ set: ["drawing", "walls", gap.b, "rect"], value: along(b, to, b[ax] + b[ax + 2]) });
    for (const slot of ["glazing", "floors"]) {
      (data.drawing[slot] || []).forEach((sh, i) => {
        const r = sh?.rect;
        if (!Array.isArray(r) || !same(r[ax], gap.from) || !same(r[ax] + r[ax + 2], gap.to)) return;
        if (r[1 - ax] < gap.band[0] - 0.01 || r[1 - ax] + r[3 - ax] > gap.band[1] + 0.01) return;
        ops.push({ set: ["drawing", slot, i, "rect"], value: along(r, from, to) });
      });
    }
    const [pos, len] = ax === 0 ? ["x", "w"] : ["y", "h"];
    (data.openings || []).forEach((o, i) => {
      const side = ax === 0 ? ["top", "bottom"] : ["left", "right"];
      if (!side.includes(o?.wall) || !same(o[pos], gap.from) || !same(o[pos] + o[len], gap.to)) return;
      if (o.at < gap.band[0] - 0.01 || o.at > gap.band[1] + 0.01) return;
      ops.push({ set: ["openings", i, pos], value: from }, { set: ["openings", i, len], value: tidy(to - from) });
    });
    return ops;
  }
  function partIds(data) {
    const ids = new Set(Object.keys(data?.rooms || {}));
    const add = (list) => (Array.isArray(list) ? list : Object.values(list || {})).forEach((it) => {
      if (typeof it?.part === "string") ids.add(it.part);
    });
    for (const slot of Object.values(data?.drawing || {})) add(slot);
    for (const k of ["openings", "lights", "markers", "furniture"]) add(data?.[k]);
    return ids;
  }
  function partKey(data, base) {
    const ids = partIds(data);
    let n2 = 1;
    while (ids.has(`${base}_${n2}`)) n2++;
    return `${base}_${n2}`;
  }
  function partOf2(data, path) {
    if (path[0] === "rooms" && path.length >= 2) return path[1];
    return path.reduce((o, k) => o?.[k], data)?.part;
  }
  function partsOf(data, id) {
    const paths = data?.rooms?.[id] !== void 0 ? [["rooms", id]] : [];
    for (const [slot, list] of Object.entries(data?.drawing || {})) {
      if (Array.isArray(list)) list.forEach((s, i) => {
        if (s?.part === id) paths.push(["drawing", slot, i]);
      });
    }
    for (const k of ["openings", "lights", "markers"]) (data?.[k] || []).forEach((it, i) => {
      if (it?.part === id) paths.push([k, i]);
    });
    for (const [name, p] of Object.entries(data?.furniture || {})) if (p?.part === id) paths.push(["furniture", name]);
    return paths;
  }
  function cutSpanIn(data, id, gap) {
    const ax = gap.axis, slack = 0.02 * upm(data), ends2 = [];
    const across = (lo, hi) => lo >= gap.band[0] - slack && hi <= gap.band[1] + slack;
    for (const slot of ["glazing", "floors"]) {
      for (const sh of data?.drawing?.[slot] || []) {
        const r = sh?.rect;
        if (sh?.part === id && Array.isArray(r) && across(r[1 - ax], r[1 - ax] + r[3 - ax])) ends2.push([r[ax], r[ax] + r[ax + 2]]);
      }
    }
    const [pos, len] = ax === 0 ? ["x", "w"] : ["y", "h"], sides = ax === 0 ? ["top", "bottom"] : ["left", "right"];
    for (const o of data?.openings || []) {
      if (o?.part === id && sides.includes(o.wall) && o.at >= gap.band[0] - slack && o.at <= gap.band[1] + slack) ends2.push([o[pos], o[pos] + o[len]]);
    }
    if (!ends2.length) return null;
    const span = [Math.min(...ends2.map((e) => e[0])), Math.max(...ends2.map((e) => e[1]))];
    return span[0] >= gap.from - slack && span[1] <= gap.to + slack ? span : null;
  }
  function runOf(data, gap, ids = partIds(data)) {
    const slack = 0.02 * upm(data), cuts = [];
    for (const id of ids) {
      if (data?.rooms?.[id] !== void 0) continue;
      const span = cutSpanIn(data, id, gap);
      if (span) cuts.push({ id, from: span[0], to: span[1] });
    }
    cuts.sort((a, b) => a.from - b.from);
    const whole = { gap, cuts: [], bounds: [gap.from, gap.to] };
    if (!cuts.length) return whole;
    if (cuts.length > 1 && (Math.abs(cuts[0].from - gap.from) > slack || Math.abs(cuts.at(-1).to - gap.to) > slack || cuts.some((c, k) => k && Math.abs(c.from - cuts[k - 1].to) > slack))) return whole;
    return { gap, cuts, bounds: [gap.from, ...cuts.slice(1).map((c) => c.from), gap.to] };
  }
  function cutRunOf(data, id) {
    const ids = partIds(data);
    for (const gap of gapsOf(data)) {
      const run2 = runOf(data, gap, ids), index = run2.cuts.findIndex((c) => c.id === id);
      if (index >= 0) return { run: run2, index };
    }
    return void 0;
  }
  function gapOf(data, id) {
    return cutRunOf(data, id)?.run.gap;
  }
  function runOps(data, run2, bounds) {
    bounds = bounds.map(tidy);
    if (!run2.cuts.length) return resizeGapOps(data, run2.gap, bounds[0], bounds.at(-1));
    const { gap } = run2, ax = gap.axis, ops = [], slack = 0.02 * upm(data);
    const along = (rect, lo, hi) => {
      const r = [...rect];
      r[ax] = tidy(lo);
      r[ax + 2] = tidy(hi - lo);
      return r;
    };
    const a = data.drawing.walls[gap.a].rect, b = data.drawing.walls[gap.b].rect;
    ops.push({ set: ["drawing", "walls", gap.a, "rect"], value: along(a, a[ax], bounds[0]) });
    ops.push({ set: ["drawing", "walls", gap.b, "rect"], value: along(b, bounds.at(-1), b[ax] + b[ax + 2]) });
    const [pos, len] = ax === 0 ? ["x", "w"] : ["y", "h"], sides = ax === 0 ? ["top", "bottom"] : ["left", "right"];
    run2.cuts.forEach(({ id }, k) => {
      const [lo, hi] = [bounds[k], bounds[k + 1]];
      for (const slot of ["glazing", "floors"]) {
        (data.drawing[slot] || []).forEach((sh, i) => {
          const r = sh?.rect;
          if (sh?.part !== id || !Array.isArray(r) || r[1 - ax] < gap.band[0] - slack || r[1 - ax] + r[3 - ax] > gap.band[1] + slack) return;
          ops.push({ set: ["drawing", slot, i, "rect"], value: along(r, lo, hi) });
        });
      }
      (data.openings || []).forEach((o, i) => {
        if (o?.part !== id || !sides.includes(o.wall)) return;
        ops.push({ set: ["openings", i, pos], value: tidy(lo) }, { set: ["openings", i, len], value: tidy(hi - lo) });
      });
    });
    return ops;
  }
  function boundaryAt(data, p, tol = 0) {
    let best;
    const ids = partIds(data);
    for (const gap of gapsOf(data)) {
      const across = p[1 - gap.axis];
      if (across < gap.band[0] - tol || across > gap.band[1] + tol) continue;
      const run2 = runOf(data, gap, ids);
      run2.bounds.forEach((v, k) => {
        const d = Math.abs(p[gap.axis] - v);
        if (d <= tol && (!best || d < best.d)) best = { run: run2, k, d };
      });
    }
    return best && { run: best.run, k: best.k };
  }
  function boundaryRange(data, run2, k) {
    const { gap, bounds } = run2, walls = data.drawing.walls, min = 0.3 * upm(data), ax = gap.axis;
    const lo = k === 0 ? walls[gap.a].rect[ax] + CRUMB : bounds[k - 1] + min;
    const b = walls[gap.b].rect, hi = k === bounds.length - 1 ? b[ax] + b[ax + 2] - CRUMB : bounds[k + 1] - min;
    return [lo, hi];
  }
  function moveBoundaryOps(data, run2, k, v) {
    const [lo, hi] = boundaryRange(data, run2, k), bounds = [...run2.bounds];
    bounds[k] = Math.min(Math.max(v, lo), hi);
    return runOps(data, run2, bounds);
  }
  function slideOps(data, gap, d) {
    const run2 = runOf(data, gap), walls = data.drawing.walls, a = walls[gap.a].rect, b = walls[gap.b].rect, ax = gap.axis;
    const lo = a[ax] + CRUMB - run2.bounds[0], hi = b[ax] + b[ax + 2] - CRUMB - run2.bounds.at(-1);
    const move = Math.min(Math.max(d, lo), hi);
    return runOps(data, run2, run2.bounds.map((v) => v + move));
  }
  function resizeCutOps(data, id, width) {
    const found = cutRunOf(data, id);
    if (!found) return [];
    const { run: run2, index: i } = found, bounds = [...run2.bounds], mid = (bounds[i] + bounds[i + 1]) / 2;
    const [lo] = boundaryRange(data, run2, i), [, hi] = boundaryRange(data, run2, i + 1);
    bounds[i] = Math.max(mid - width / 2, lo);
    bounds[i + 1] = Math.min(mid + width / 2, hi);
    return runOps(data, run2, bounds);
  }
  function splitCutOps(data, id) {
    const found = cutRunOf(data, id);
    if (!found) return null;
    const { run: run2, index: i } = found, { gap } = run2, ax = gap.axis, [lo, hi] = [run2.bounds[i], run2.bounds[i + 1]], mid = tidy((lo + hi) / 2);
    if (mid - lo < 0.3 * upm(data)) return null;
    const part = partKey(data, id.replace(/_\d+$/, "")), [pos, len] = ax === 0 ? ["x", "w"] : ["y", "h"];
    const ops = runOps(data, { ...run2, cuts: [run2.cuts[i]] }, [lo, mid]).filter((op) => op.set[0] !== "drawing" || op.set[1] !== "walls");
    for (const p of partsOf(data, id)) {
      const item = p.reduce((o, k) => o?.[k], data);
      if (p[0] === "drawing" && Array.isArray(item?.rect)) {
        const r = [...item.rect];
        r[ax] = mid;
        r[ax + 2] = tidy(hi - mid);
        ops.push({ insert: p.slice(0, -1), value: { ...item, rect: r, part } });
      } else if (p[0] === "openings") ops.push({ insert: ["openings"], value: { ...item, [pos]: mid, [len]: tidy(hi - mid), part } });
    }
    return { ops, part };
  }
  function ordered(sets, removals) {
    const seen = /* @__PURE__ */ new Set(), list = removals.filter((p) => !seen.has(JSON.stringify(p)) && seen.add(JSON.stringify(p)));
    list.sort((p, q) => {
      const [a, b] = [JSON.stringify(p.slice(0, -1)), JSON.stringify(q.slice(0, -1))];
      if (a !== b) return a < b ? -1 : 1;
      return typeof p.at(-1) === "number" ? q.at(-1) - p.at(-1) : 0;
    });
    return [...sets, ...list.map((remove) => ({ remove }))];
  }
  function deleteOps(data, id) {
    const sets = [], removals = partsOf(data, id);
    if (data?.rooms?.[id] === void 0) {
      const found = cutRunOf(data, id);
      if (found) {
        const { run: { gap, cuts, bounds }, index: i } = found, ax = gap.axis, [lo, hi] = [bounds[i], bounds[i + 1]];
        const a = data.drawing.walls[gap.a], b = data.drawing.walls[gap.b], r = [...a.rect];
        if (cuts.length === 1) {
          r[ax + 2] = tidy(b.rect[ax] + b.rect[ax + 2] - a.rect[ax]);
          sets.push({ set: ["drawing", "walls", gap.a, "rect"], value: r });
          removals.push(["drawing", "walls", gap.b]);
        } else if (i === 0) {
          r[ax + 2] = tidy(hi - a.rect[ax]);
          sets.push({ set: ["drawing", "walls", gap.a, "rect"], value: r });
        } else if (i === cuts.length - 1) {
          const q = [...b.rect];
          q[ax + 2] = tidy(b.rect[ax] + b.rect[ax + 2] - lo);
          q[ax] = tidy(lo);
          sets.push({ set: ["drawing", "walls", gap.b, "rect"], value: q });
        } else {
          r[ax] = tidy(lo);
          r[ax + 2] = tidy(hi - lo);
          sets.push({ insert: ["drawing", "walls"], value: { ...a, rect: r } });
        }
      }
      const pieces = removals.filter((p) => p[0] === "furniture").map((p) => p[1]);
      (data?.lights || []).forEach((g, i) => {
        const list = g?.pool?.shadows;
        if (g?.part !== id && Array.isArray(list) && list.some((n2) => pieces.includes(n2))) {
          sets.push({ set: ["lights", i, "pool", "shadows"], value: list.filter((n2) => !pieces.includes(n2)) });
        }
      });
      return ordered(sets, removals);
    }
    const others = { ...data, rooms: Object.fromEntries(Object.entries(data.rooms).filter(([k]) => k !== id)) };
    const sides = (d, r) => {
      const ax = r[2] >= r[3] ? 0 : 1, mid = r[ax] + r[ax + 2] / 2, probe = (v) => roomAt(d, ax === 0 ? [mid, v] : [v, mid]);
      return [probe(r[1 - ax] - 1), probe(r[1 - ax] + r[3 - ax] + 1)];
    };
    const gone = /* @__PURE__ */ new Set(), opened = /* @__PURE__ */ new Set();
    (data.drawing?.walls || []).forEach((w, i) => {
      if (!Array.isArray(w?.rect)) return;
      const [before, after] = sides(others, w.rect), other = before || after;
      if (w.part === id && other) {
        sets.push({ set: ["drawing", "walls", i, "part"], value: other });
        if (w.class === "iwall") sets.push({ set: ["drawing", "walls", i, "class"], value: "wall" });
        opened.add(i);
      } else if (w.part === id) {
        removals.push(["drawing", "walls", i]);
        gone.add(i);
      } else if (w.class === "iwall" && sides(data, w.rect).includes(id) && !(before && after)) {
        sets.push({ set: ["drawing", "walls", i, "class"], value: "wall" });
        opened.add(i);
      }
    });
    for (const pid of partIds(data)) {
      const g = /^doorway_/.test(pid) && gapOf(data, pid);
      if (!g || !opened.has(g.a) || !opened.has(g.b)) continue;
      const a = data.drawing.walls[g.a].rect, b = data.drawing.walls[g.b].rect, r = [...a];
      r[g.axis + 2] = tidy(b[g.axis] + b[g.axis + 2] - a[g.axis]);
      sets.push({ set: ["drawing", "walls", g.a, "rect"], value: r });
      removals.push(["drawing", "walls", g.b], ...partsOf(data, pid));
    }
    for (const gap of gapsOf(data)) {
      if (!gone.has(gap.a) || !gone.has(gap.b)) continue;
      for (const pid of partIds(data)) {
        const g = pid !== id && gapOf(data, pid);
        if (g && g.a === gap.a && g.b === gap.b) removals.push(...partsOf(data, pid));
      }
    }
    return ordered(sets, removals);
  }
  function adoptOps(data) {
    const ops = [], taken = partIds(data), used = /* @__PURE__ */ new Set();
    const tag = (path, id) => {
      used.add(JSON.stringify(path));
      ops.push({ set: [...path, "part"], value: id });
    };
    const fresh = (base) => {
      let n2 = 1;
      while (taken.has(`${base}_${n2}`)) n2++;
      taken.add(`${base}_${n2}`);
      return `${base}_${n2}`;
    };
    const markers = (data?.markers || []).map((m2, i) => ({ m: m2, path: ["markers", i] }));
    const free = (path) => path.reduce((o, k) => o?.[k], data)?.part === void 0 && !used.has(JSON.stringify(path));
    (data?.lights || []).forEach((g, i) => {
      if (g?.part !== void 0 || !g?.entities?.length) return;
      const id = fresh("lamp");
      tag(["lights", i], id);
      for (const { m: m2, path } of markers) if (m2?.entity === g.entities[0] && free(path)) tag(path, id);
    });
    (data?.openings || []).forEach((o, i) => {
      if (o?.part !== void 0 || !o?.wall) return;
      const horizontal = o.wall === "top" || o.wall === "bottom", [lo, len] = horizontal ? [o.x, o.w] : [o.y, o.h];
      const band = [o.at - o.depth, o.at];
      const glass = (data.drawing?.glazing || []).map((g, j) => ({ g, j })).filter(({ g, j }) => {
        const r = g?.rect;
        if (!Array.isArray(r) || !free(["drawing", "glazing", j])) return false;
        const [a, l, c, t] = horizontal ? [r[0], r[2], r[1], r[3]] : [r[1], r[3], r[0], r[2]];
        return a >= lo - 1 && a + l <= lo + len + 1 && c >= band[0] - 1 && c + t <= band[1] + 1;
      });
      const id = fresh(o.lo > 0 ? "window" : glass.length ? "glass_door" : "door");
      tag(["openings", i], id);
      for (const { j } of glass) tag(["drawing", "glazing", j], id);
      for (const { m: m2, path } of markers) if (o.shutter && m2?.entity === o.shutter && free(path)) tag(path, id);
    });
    const rooms = Object.entries(data?.rooms || {}), area = (region) => regionPolys(region).reduce((s, poly) => s + Math.abs(poly.reduce((a, p, k) => {
      const q = poly[(k + 1) % poly.length];
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0)) / 2, 0);
    (data?.drawing?.labels || []).forEach((l, j) => {
      if (l?.part !== void 0 || l?.class !== "room" || !Array.isArray(l.at)) return;
      const around = rooms.filter(([, region]) => regionPolys(region).some((poly) => inPoly(poly, l.at))).sort((a, b) => area(a[1]) - area(b[1]));
      if (around.length) tag(["drawing", "labels", j], around[0][0]);
    });
    (data?.drawing?.floors || []).forEach((f, j) => {
      if (f?.part !== void 0) return;
      const own = rooms.find(([, region]) => Array.isArray(f?.rect) && region.length === 1 && Array.isArray(region[0]) && region[0].length === 4 && !Array.isArray(region[0][0]) && region[0].every((v, k) => Math.abs(v - f.rect[k]) < 0.01) || Array.isArray(f?.poly) && Array.isArray(region[0]?.[0]) && JSON.stringify(region[0]) === JSON.stringify(f.poly));
      if (own) tag(["drawing", "floors", j], own[0]);
    });
    return ops;
  }
  function snapCut(data, wall, span, move = true) {
    const r = wall.rect, a = r[2] >= r[3] ? 0 : 1, near = move ? 0.25 * upm(data) : CRUMB, gaps = gapsOf(data), end = r[a] + r[a + 2];
    if (gaps.some((g) => g.b === wall.i) && span[0] - r[a] <= near) {
      if (move) span[1] = tidy(span[1] - (span[0] - r[a]));
      span[0] = r[a];
    }
    if (gaps.some((g) => g.a === wall.i) && end - span[1] <= near) {
      if (move) span[0] = tidy(span[0] + (end - span[1]));
      span[1] = tidy(end);
    }
    return span;
  }
  function cutOps(data, p, { kind = "window", metres = 1, tol = 0, until } = {}) {
    const wall = wallAt(data, p, tol);
    if (!wall) return null;
    const r = wall.rect, a = r[2] >= r[3] ? 0 : 1;
    const span = until ? [Math.max(Math.min(p[a], until[a]), r[a]), Math.min(Math.max(p[a], until[a]), r[a] + r[a + 2])].map(tidy) : cutSpan(r, p[a], tidy(metres * upm(data)));
    if (!span || span[1] - span[0] < 0.3 * upm(data)) return null;
    snapCut(data, wall, span, !until);
    if (!span) return null;
    const [from, to] = span, mid = r[1 - a] + r[3 - a] / 2;
    const at = (v) => a === 0 ? [v, mid] : [mid, v];
    const glazed = wall.cls === "wall" && kind !== "door" && openingFrom(data, at(from), at(to), { kind: kind === "glass_door" ? "door" : "window", tol: 1 });
    const piece = (lo, hi) => {
      const rect = [...r];
      rect[a] = tidy(lo);
      rect[a + 2] = tidy(hi - lo);
      return { ...data.drawing.walls[wall.i], rect };
    };
    const pieces = [[r[a], from], [to, r[a] + r[a + 2]]].filter(([lo, hi]) => hi - lo > CRUMB).map(([lo, hi]) => piece(lo, hi));
    const ops = [{ remove: ["drawing", "walls", wall.i] }, ...pieces.reverse().map((value) => ({ insert: ["drawing", "walls"], value, index: wall.i }))];
    let opening = false;
    const part = partKey(data, wall.cls === "iwall" ? "doorway" : glazed ? kind : "door");
    if (glazed) {
      ops.push({ insert: ["drawing", "glazing"], value: { ...glazed.glass, part } });
      if (glazed.opening.room) {
        ops.push({ insert: ["openings"], value: { ...glazed.opening, part } });
        opening = true;
      }
    } else {
      ops.push({ insert: ["drawing", "floors"], value: { rect: piece(from, to).rect, class: "floor", part } });
    }
    return { ops, opening, part };
  }
  function lampEntityOps(data, path, value) {
    const field = path.length === 3 && (path[0] === "markers" ? path[2] === "entity" : path[0] === "lights" && path[2] === "entities");
    const id = field && partOf2(data, path.slice(0, 2)), entity = path[0] === "markers" ? value : value?.[0];
    const parts = id ? partsOf(data, id) : [];
    if (typeof entity !== "string" || !parts.some((p) => p[0] === "lights")) return null;
    return parts.flatMap((p) => {
      const item = p.reduce((o, k) => o?.[k], data);
      if (p[0] === "markers") return [{ set: [...p, "entity"], value: entity }];
      if (p[0] !== "lights") return [];
      const { lit: _, ...rest } = item;
      return [{ set: p, value: { ...rest, entities: path[0] === "lights" && p[1] === path[1] ? value : [entity, ...(item.entities || []).slice(1)] } }];
    });
  }
  function applyOps(data, ops) {
    const out = structuredClone(data);
    const at = (path) => path.reduce((o, k) => o?.[k], out);
    for (const op of ops) {
      if (op.set) {
        let o = out;
        for (const [k, key] of op.set.slice(0, -1).entries()) o = o[key] ?? (o[key] = typeof op.set[k + 1] === "number" ? [] : {});
        o[op.set.at(-1)] = op.value;
      } else if (op.insert) {
        let list = at(op.insert);
        if (!list) {
          list = [];
          applyOps.set(out, op.insert, list);
        }
        list.splice(op.index ?? list.length, 0, op.value);
      } else if (op.remove) {
        const parent = at(op.remove.slice(0, -1)), key = op.remove.at(-1);
        if (Array.isArray(parent)) parent.splice(key, 1);
        else if (parent) delete parent[key];
      }
    }
    return out;
  }
  applyOps.set = (o, path, v) => {
    for (const k of path.slice(0, -1)) o = o[k] ?? (o[k] = {});
    o[path.at(-1)] = v;
  };
  function wallOps(data, key, rect) {
    return [
      ...sharedWalls(data, rect).map((i) => ({ set: ["drawing", "walls", i, "class"], value: "iwall" })),
      ...roomWalls(data, rect).map((wall) => ({ insert: ["drawing", "walls"], value: { ...wall, part: key } }))
    ];
  }
  function shifted(item, dx, dy) {
    const s = { ...item };
    if (Array.isArray(s.rect)) s.rect = [tidy(s.rect[0] + dx), tidy(s.rect[1] + dy), s.rect[2], s.rect[3]];
    if (Array.isArray(s.poly)) s.poly = s.poly.map(([x, y]) => [tidy(x + dx), tidy(y + dy)]);
    if (Array.isArray(s.at)) s.at = [tidy(s.at[0] + dx), tidy(s.at[1] + dy), ...s.at.slice(2)];
    if (typeof s.wall === "string") {
      const horizontal = s.wall === "top" || s.wall === "bottom";
      s.at = tidy(s.at + (horizontal ? dy : dx));
      if (horizontal) s.x = tidy(s.x + dx);
      else s.y = tidy(s.y + dy);
    } else if (typeof s.x === "number" && typeof s.y === "number") [s.x, s.y] = [tidy(s.x + dx), tidy(s.y + dy)];
    return s;
  }
  function moveRoomOps(data, id, dx, dy, tol = 0, size = null) {
    const region = data?.rooms?.[id], old = region?.[0];
    if (!Array.isArray(region) || region.length !== 1 || !Array.isArray(old) || Array.isArray(old[0])) return null;
    const outdoor = outdoors(data, id), kept = /* @__PURE__ */ new Set(["floors", "labels"]);
    const own = new Set((data.drawing?.walls || []).flatMap((w, i) => w?.part === id ? [i] : []));
    const cuts = [...partIds(data)].filter((pid) => pid !== id && data.rooms?.[pid] === void 0).flatMap((pid) => {
      const found = cutRunOf(data, pid), gap = found?.run.gap;
      if (!gap || !own.has(gap.a) || !own.has(gap.b)) return [];
      const span = { ...gap, from: found.run.bounds[found.index], to: found.run.bounds[found.index + 1] };
      return [{ pid, gap: span, parts: partsOf(data, pid).map((p) => [p, p.reduce((o, k) => o?.[k], data)]) }];
    });
    const del = deleteOps(data, id).filter((op) => !(op.remove && (op.remove[0] === "rooms" || op.remove[0] === "drawing" && kept.has(op.remove[1]) && op.remove.reduce((o, k) => o?.[k], data)?.part === id)));
    const stage1 = applyOps(data, del);
    const placed = [old[0] + dx, old[1] + dy, size?.[0] ?? old[2], size?.[1] ?? old[3]].map(tidy);
    const rect = size ? placed : snapRoom(stage1, placed, tol);
    const [mx, my, dw, dh] = [rect[0] - old[0], rect[1] - old[1], rect[2] - old[2], rect[3] - old[3]];
    const same = (a, b) => Array.isArray(a) && a.every((v, k) => Math.abs(v - b[k]) < 0.01);
    const move = [{ set: ["rooms", id], value: [rect] }, ...partsOf(stage1, id).filter((p) => p[0] === "drawing").map((p) => {
      const item = p.reduce((o, k) => o?.[k], stage1);
      if (same(item.rect, old)) return { set: p, value: { ...item, rect } };
      return { set: p, value: shifted(item, mx + (p[1] === "labels" ? dw / 2 : 0), my + (p[1] === "labels" ? dh / 2 : 0)) };
    })];
    const stage2 = applyOps(stage1, move);
    const walls = outdoor ? [] : wallOps(stage2, id, rect);
    let now = applyOps(stage2, walls);
    const recut = [];
    for (const { gap, parts } of cuts) {
      const ax = gap.axis, far = gap.band[0] >= (ax === 0 ? old[1] + old[3] : old[0] + old[2]) - 0.01;
      const [ox, oy] = [mx + (ax === 1 && far ? dw : 0), my + (ax === 0 && far ? dh : 0)];
      const mid = (gap.band[0] + gap.band[1]) / 2 + (ax === 0 ? oy : ox), d = ax === 0 ? ox : oy;
      const at = (v) => ax === 0 ? [v, mid] : [mid, v];
      const made = cutOps(now, at(gap.from + d), { until: at(gap.to + d) });
      if (!made) continue;
      const ops = [
        ...made.ops.filter((op) => (op.remove || op.insert)?.[1] === "walls"),
        ...parts.map(([path, item]) => ({ insert: path.slice(0, -1), value: shifted(item, ox, oy) }))
      ];
      recut.push(...ops);
      now = applyOps(now, ops);
    }
    return { ops: [...del, ...move, ...walls, ...recut], rect };
  }
  function regroupOps(data, paths) {
    const ops = [], shadows = /* @__PURE__ */ new Map();
    const lights = data?.lights || [], furniture = data?.furniture || {};
    const shadowsOf = (i) => shadows.get(i) ?? lights[i].pool.shadows ?? [];
    for (const path of paths) {
      const item = path.reduce((o, k) => o?.[k], data);
      if (path[0] === "lights" && path.length === 2 && item) {
        const c = lightCentre(item), room = c && roomAt(data, c);
        if (!room || room === item.clip) continue;
        ops.push({ set: [...path, "clip"], value: room });
        if (item.pool) shadows.set(path[1], Object.entries(furniture).filter(([, p]) => p?.height && p.shadow_room === room).map(([n2]) => n2));
      } else if (path[0] === "furniture" && path.length === 2 && item?.shape) {
        const c = item.shape.circle?.slice(0, 2) || pieceCentre(item.shape), room = c && roomAt(data, c), was = item.shadow_room;
        if (!room || room === was) continue;
        ops.push({ set: [...path, "shadow_room"], value: room });
        if (!item.height) continue;
        lights.forEach((g, i) => {
          if (!g?.pool || paths.some((p) => p[0] === "lights" && p[1] === i)) return;
          const list = shadowsOf(i);
          if (g.clip === was && list.includes(path[1])) shadows.set(i, list.filter((n2) => n2 !== path[1]));
          if (g.clip === room && !list.includes(path[1])) shadows.set(i, [...list, path[1]]);
        });
      }
    }
    for (const [i, list] of shadows) ops.push({ set: ["lights", i, "pool", "shadows"], value: list });
    return ops;
  }

  // src/editor/prefabs.js
  var R = (x, y, w, h2, cls = "furn2", rx) => ({ rect: [x, y, w, h2], class: cls, ...rx ? { rx } : {} });
  var C = (cx, cy, r, cls = "dev") => ({ circle: [cx, cy, r], class: cls });
  var E = (cx, cy, rx, ry, cls = "furn2") => ({ ellipse: [cx, cy, rx, ry], class: cls });
  var L = (x1, y1, x2, y2) => ({ line: [[x1, y1], [x2, y2]] });
  var seating = (w, d, seats) => {
    const arm = 0.18, back = 0.2, inner = w - 2 * arm, out = [R(0, 0, w, back, "furn2", 0.05), R(0, 0, arm, d, "furn2", 0.05), R(w - arm, 0, arm, d, "furn2", 0.05)];
    for (let i = 1; i < seats; i++) out.push(L(arm + inner * i / seats, back, arm + inner * i / seats, d - 0.04));
    return out;
  };
  var bed = (w, pillows) => {
    const pw = (w - 0.1 * (pillows + 1)) / pillows;
    return [...Array.from({ length: pillows }, (_, i) => R(0.1 + i * (pw + 0.1), 0.1, pw, 0.4, "furn2", 0.06)), L(0.02, 0.65, w - 0.02, 0.65)];
  };
  var chair = { w: 0.45, d: 0.45, height: 0.9, cls: "furn2", rx: 0.05, extra: [R(0.02, 0, 0.41, 0.08, "furn", 0.03)] };
  var PREFABS = {
    living: {
      title: "Living room",
      items: {
        sofa_2: { name: "Sofa for 2", w: 1.6, d: 0.9, height: 0.8, rx: 0.08, extra: seating(1.6, 0.9, 2) },
        sofa_3: { name: "Sofa for 3", w: 2.2, d: 0.9, height: 0.8, rx: 0.08, extra: seating(2.2, 0.9, 3) },
        corner_sofa: {
          name: "Corner sofa",
          w: 2.5,
          d: 1.7,
          height: 0.8,
          poly: [[0, 0], [2.5, 0], [2.5, 0.9], [0.9, 0.9], [0.9, 1.7], [0, 1.7]],
          extra: [R(0, 0, 2.5, 0.2, "furn2", 0.05), R(0, 0, 0.2, 1.7, "furn2", 0.05), R(2.32, 0, 0.18, 0.9, "furn2", 0.05), L(0.2, 0.9, 0.9, 0.9), L(1.6, 0.2, 1.6, 0.86)]
        },
        armchair: { name: "Armchair", w: 0.85, d: 0.85, height: 0.8, rx: 0.08, extra: seating(0.85, 0.85, 1) },
        coffee_table: { name: "Coffee table", w: 1.1, d: 0.6, height: 0.45, rx: 0.05 },
        tv_unit: { name: "TV unit", w: 1.6, d: 0.4, height: 0.5, extra: [R(0.25, 0.04, 1.1, 0.06, "dev")] },
        bookcase: { name: "Bookcase", w: 1, d: 0.35, height: 2, extra: [L(0.5, 0.02, 0.5, 0.33)] },
        rug: { name: "Rug", w: 2, d: 1.4, cls: "furn2", rx: 0.05 }
      }
    },
    bedroom: {
      title: "Bedroom",
      items: {
        double_bed: { name: "Double bed", w: 1.6, d: 2, height: 0.55, rx: 0.05, extra: bed(1.6, 2) },
        single_bed: { name: "Single bed", w: 0.9, d: 2, height: 0.55, rx: 0.05, extra: bed(0.9, 1) },
        bedside_table: { name: "Bedside table", w: 0.45, d: 0.4, height: 0.5, cls: "furn2", rx: 0.03 },
        wardrobe: { name: "Wardrobe", w: 1.2, d: 0.6, height: 2, extra: [L(0.6, 0.04, 0.6, 0.56)] },
        desk: { name: "Desk", w: 1.2, d: 0.6, height: 0.75 },
        chair: { name: "Chair", ...chair }
      }
    },
    kitchen: {
      title: "Kitchen and dining",
      items: {
        counter: {
          name: "Counter with sink and hob",
          w: 2.4,
          d: 0.6,
          height: 0.9,
          extra: [R(0.3, 0.1, 0.6, 0.4, "fix2", 0.05), C(1.55, 0.2, 0.08), C(1.85, 0.2, 0.08), C(1.55, 0.42, 0.07), C(1.85, 0.42, 0.07)]
        },
        fridge: { name: "Fridge", w: 0.6, d: 0.65, height: 1.8, extra: [L(0.03, 0.6, 0.57, 0.6)] },
        dining_2: { name: "Table for 2", w: 0.8, d: 1.7, pieces: [{ of: "table_s", at: [0.4, 0.85] }, { of: "chair", at: [0.4, 0.22] }, { of: "chair", at: [0.4, 1.48], turn: 180 }] },
        dining_4: { name: "Table for 4", w: 1.2, d: 1.7, pieces: [
          { of: "table_m", at: [0.6, 0.85] },
          ...[0.32, 0.88].flatMap((x) => [{ of: "chair", at: [x, 0.22] }, { of: "chair", at: [x, 1.48], turn: 180 }])
        ] },
        dining_6: { name: "Table for 6", w: 1.8, d: 1.8, pieces: [
          { of: "table_l", at: [0.9, 0.9] },
          ...[0.4, 1.4].flatMap((x) => [{ of: "chair", at: [x, 0.22] }, { of: "chair", at: [x, 1.58], turn: 180 }]),
          { of: "chair", at: [0.22 - 0.3, 0.9], turn: 270 },
          { of: "chair", at: [1.58 + 0.3, 0.9], turn: 90 }
        ] }
      }
    },
    lights: {
      title: "Lights",
      items: {
        ceiling_lamp: { name: "Ceiling lamp", w: 0.6, d: 0.6, lamp: { glow: [C(0.3, 0.3, 0.5)], pool: { r: 3.5, height: 2.4 }, icon: "mdi:ceiling-light" } },
        pendant: { name: "Pendant", w: 0.4, d: 0.4, lamp: { glow: [C(0.2, 0.2, 0.4)], pool: { r: 2.5, height: 1.8 }, icon: "mdi:ceiling-light-outline" } },
        floor_lamp: {
          name: "Floor lamp",
          w: 0.4,
          d: 0.4,
          base: { w: 0.36, d: 0.36, shape: "circle", cls: "furn2" },
          lamp: { glow: [C(0.2, 0.2, 0.4)], pool: { r: 3, height: 1.6 }, icon: "mdi:floor-lamp" }
        },
        table_lamp: { name: "Table lamp", w: 0.3, d: 0.3, lamp: { glow: [C(0.15, 0.15, 0.25)], pool: { r: 2, height: 0.7 }, icon: "mdi:lamp" } },
        strip_1: { name: "Light strip 1 m", w: 1, d: 0.1, lamp: { glow: [{ line: [[0, 0.05], [1, 0.05]], width: 0.15 }], top: true, icon: "mdi:led-strip-variant" } },
        strip_2: { name: "Light strip 2 m", w: 2, d: 0.1, lamp: { glow: [{ line: [[0, 0.05], [2, 0.05]], width: 0.15 }], top: true, icon: "mdi:led-strip-variant" } }
      }
    },
    bathroom: {
      title: "Bathroom",
      items: {
        bath: { name: "Bath", w: 1.7, d: 0.75, height: 0.6, rx: 0.08, extra: [R(0.08, 0.08, 1.54, 0.59, "fix2", 0.25), C(1.5, 0.375, 0.03)] },
        shower: { name: "Shower", w: 0.9, d: 0.9, cls: "furn2", extra: [L(0, 0, 0.9, 0.9), L(0.9, 0, 0, 0.9), C(0.45, 0.45, 0.04)] },
        toilet: { name: "Toilet", w: 0.4, d: 0.65, height: 0.4, cls: "furn2", rx: 0.05, extra: [R(0, 0, 0.4, 0.18, "furn", 0.03), E(0.2, 0.42, 0.16, 0.2, "furn")] },
        washbasin: { name: "Washbasin", w: 0.6, d: 0.45, height: 0.85, rx: 0.05, extra: [E(0.3, 0.25, 0.22, 0.15, "fix2"), C(0.3, 0.06, 0.025)] },
        washing_machine: { name: "Washing machine", w: 0.6, d: 0.6, height: 0.85, extra: [C(0.3, 0.32, 0.2, "furn2"), C(0.3, 0.32, 0.13)] }
      }
    }
  };
  var PARTS = {
    table_s: { name: "Table", w: 0.8, d: 0.8, height: 0.75, rx: 0.03 },
    table_m: { name: "Table", w: 1.2, d: 0.8, height: 0.75, rx: 0.03 },
    table_l: { name: "Table", w: 1.8, d: 0.9, height: 0.75, rx: 0.03 },
    chair: PREFABS.bedroom.items.chair
  };
  var prefab = (id) => Object.values(PREFABS).map((g) => g.items[id]).find(Boolean) || PARTS[id];
  var turned = ([x, y], turn2) => {
    const q = (Math.round(turn2 / 90) % 4 + 4) % 4;
    return [[x, y], [-y, x], [-x, -y], [y, -x]][q];
  };
  function placeShape(s, { w, d }, at, turn2, u) {
    const p = ([x, y]) => {
      const [a, b] = turned([x - w / 2, y - d / 2], turn2);
      return [tidy(at[0] + a * u), tidy(at[1] + b * u)];
    };
    const swap = Math.round(turn2 / 90) % 2 !== 0;
    const { class: cls, rx } = s, rest = { ...cls ? { class: cls } : {}, ...rx ? { rx: tidy(rx * u) } : {} };
    if (s.rect) {
      const [x, y, rw, rh] = s.rect, [a, b] = [p([x, y]), p([x + rw, y + rh])];
      return { rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), tidy(Math.abs(b[0] - a[0])), tidy(Math.abs(b[1] - a[1]))], ...rest };
    }
    if (s.circle) return { circle: [...p(s.circle), tidy(s.circle[2] * u)], ...rest };
    if (s.ellipse) {
      const [rx2, ry2] = swap ? [s.ellipse[3], s.ellipse[2]] : [s.ellipse[2], s.ellipse[3]];
      return { ellipse: [...p(s.ellipse), tidy(rx2 * u), tidy(ry2 * u)], ...rest };
    }
    if (s.poly) return { poly: s.poly.map(p), ...rest };
    if (s.line) {
      const [a, b] = s.line.map(p);
      return { path: `M${a[0]},${a[1]} L${b[0]},${b[1]}`, class: "line" };
    }
    throw new Error(`not a prefab shape: ${JSON.stringify(s)}`);
  }
  function pieceOf(data, item, at, turn2 = 0) {
    const u = data?.units_per_metre || 100;
    const outline2 = placeShape(item.poly ? { poly: item.poly } : item.shape === "circle" ? { circle: [item.w / 2, item.d / 2, item.w / 2] } : { rect: [0, 0, item.w, item.d], rx: item.rx }, item, at, turn2, u);
    const room = item.height ? roomAt(data, at) : void 0;
    return {
      shape: outline2.poly ? { poly: outline2.poly } : outline2.circle ? { circle: outline2.circle } : { rect: outline2.rect, ...outline2.rx ? { rx: outline2.rx } : {} },
      ...item.height ? { height: item.height } : {},
      ...room ? { shadow_room: room } : {},
      ...item.cls === "furn2" ? { class: "furn2" } : {},
      ...item.extra?.length ? { extra: item.extra.map((s) => placeShape(s, item, at, turn2, u)) } : {}
    };
  }
  function pieceKey(data, base, taken) {
    let key = base;
    for (let n2 = 2; data?.furniture?.[key] !== void 0 || taken.has(key); n2++) key = `${base}_${n2}`;
    taken.add(key);
    return key;
  }
  function placePrefab(data, id, at, turn2 = 0, { entity = "light.new_light" } = {}) {
    const item = prefab(id), u = data?.units_per_metre || 100;
    if (!item) return null;
    if (item.lamp) return placeLamp(data, item, id, at, turn2, entity);
    const taken = /* @__PURE__ */ new Set(), ops = [], keys = [], group = partKey(data, id);
    const parts = item.pieces || [{ of: id, at: [item.w / 2, item.d / 2] }];
    for (const part of parts) {
      const piece = prefab(part.of), [a, b] = turned([part.at[0] - item.w / 2, part.at[1] - item.d / 2], turn2);
      const key = pieceKey(data, part.of.replace(/^table_[sml]$/, "table"), taken);
      ops.push({ set: ["furniture", key], value: { ...pieceOf(data, piece, [tidy(at[0] + a * u), tidy(at[1] + b * u)], turn2 + (part.turn || 0)), part: group } });
      keys.push(key);
    }
    return { ops, keys, part: group };
  }
  function placeLamp(data, item, id, at, turn2, entity) {
    const u = data?.units_per_metre || 100, part = partKey(data, "lamp"), [x, y] = at.map(tidy), room = roomAt(data, at);
    const shape = item.lamp.glow.map((s) => {
      const placed = placeShape({ ...s, class: void 0 }, item, at, turn2, u);
      return s.line ? { path: placed.path, stroke_width: tidy(s.width * u), fill: "none" } : placed;
    });
    const shadows = Object.entries(data?.furniture || {}).filter(([, p]) => p?.height && (!room || p.shadow_room === room)).map(([n2]) => n2);
    const light = {
      entities: [entity],
      shape,
      ...item.lamp.top ? { top: true } : { over: true },
      ...room ? { clip: room } : {},
      ...item.lamp.pool ? { pool: { x, y, r: tidy(item.lamp.pool.r * u), height: item.lamp.pool.height, shadows } } : {},
      part
    };
    const ops = [
      { insert: ["lights"], value: light },
      { insert: ["markers"], value: { entity, x, y, icon: item.lamp.icon, tap: "toggle", small: true, part } }
    ];
    const keys = [];
    if (item.base) {
      const key = pieceKey(data, id, /* @__PURE__ */ new Set());
      ops.push({ set: ["furniture", key], value: { ...pieceOf(data, item.base, at, turn2), part } });
      keys.push(key);
    }
    return { ops, keys, part };
  }
  function prefabSvg(id) {
    const item = prefab(id);
    if (item.lamp) {
      const glow = item.lamp.glow.map((s) => s.line ? `<path class="glow-line" d="M${s.line[0].join(",")} L${s.line[1].join(",")}" stroke-width="${s.width}"/>` : `<circle class="glow" cx="${s.circle[0]}" cy="${s.circle[1]}" r="${s.circle[2]}"/>`).join("");
      const base = item.base ? `<circle class="furn2" cx="${item.w / 2}" cy="${item.d / 2}" r="${item.base.w / 2}"/>` : "";
      const r = Math.max(...item.lamp.glow.map((s) => s.circle ? s.circle[2] : 0), item.w / 2, 0.3), c = [item.w / 2, item.d / 2];
      return `<svg viewBox="${tidy(c[0] - r - 0.05)} ${tidy(c[1] - r - 0.05)} ${tidy(2 * r + 0.1)} ${tidy(2 * r + 0.1)}">${glow}${base}</svg>`;
    }
    const parts = item.pieces || [{ of: id, at: [item.w / 2, item.d / 2] }];
    const xs = [], ys = [];
    const body = parts.map((part) => {
      const piece = prefab(part.of), data = { units_per_metre: 1 };
      const v = pieceOf(data, piece, part.at, part.turn || 0);
      const shapes = [v.shape.poly ? { poly: v.shape.poly, class: v.class || "furn" } : { rect: v.shape.rect, rx: v.shape.rx, class: v.class || "furn" }, ...v.extra || []];
      return shapes.map((s) => {
        if (s.rect) {
          xs.push(s.rect[0], s.rect[0] + s.rect[2]);
          ys.push(s.rect[1], s.rect[1] + s.rect[3]);
          return `<rect class="${s.class}" x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}"${s.rx ? ` rx="${s.rx}"` : ""}/>`;
        }
        if (s.poly) {
          s.poly.forEach(([x, y]) => {
            xs.push(x);
            ys.push(y);
          });
          return `<polygon class="${s.class}" points="${s.poly.map((q) => q.join(",")).join(" ")}"/>`;
        }
        if (s.circle) return `<circle class="${s.class}" cx="${s.circle[0]}" cy="${s.circle[1]}" r="${s.circle[2]}"/>`;
        if (s.ellipse) return `<ellipse class="${s.class}" cx="${s.ellipse[0]}" cy="${s.ellipse[1]}" rx="${s.ellipse[2]}" ry="${s.ellipse[3]}"/>`;
        return `<path class="line" d="${s.path}"/>`;
      }).join("");
    }).join("");
    const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], pad2 = 0.1;
    return `<svg viewBox="${tidy(x0 - pad2)} ${tidy(y0 - pad2)} ${tidy(x1 - x0 + 2 * pad2)} ${tidy(y1 - y0 + 2 * pad2)}">${body}</svg>`;
  }
  function turnedPiece(piece, deg) {
    const s = piece?.shape;
    if (!s) return piece;
    if (s.rect || s.poly) {
      const turn2 = (((s.turn || 0) + deg) % 360 + 360) % 360;
      const { turn: _, ...rest } = s;
      return { ...piece, shape: turn2 ? { ...rest, turn: turn2 } : rest };
    }
    const pts = s.poly || [s.circle.slice(0, 2)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    const t = ([x, y]) => {
      const [a, b] = turned([x - c[0], y - c[1]], deg);
      return [tidy(c[0] + a), tidy(c[1] + b)];
    };
    const swap = Math.round(deg / 90) % 2 !== 0;
    const one = (sh) => {
      if (sh.rect) {
        const [a, b] = [t(sh.rect.slice(0, 2)), t([sh.rect[0] + sh.rect[2], sh.rect[1] + sh.rect[3]])];
        return { ...sh, rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), tidy(Math.abs(b[0] - a[0])), tidy(Math.abs(b[1] - a[1]))] };
      }
      if (sh.circle) return { ...sh, circle: [...t(sh.circle), sh.circle[2]] };
      if (sh.ellipse) return { ...sh, ellipse: [...t(sh.ellipse), ...swap ? [sh.ellipse[3], sh.ellipse[2]] : sh.ellipse.slice(2)] };
      if (sh.poly) return { ...sh, poly: sh.poly.map(t) };
      const line = typeof sh.path === "string" && sh.path.match(/^M\s*(-?[\d.]+)[ ,](-?[\d.]+)\s*L\s*(-?[\d.]+)[ ,](-?[\d.]+)$/);
      if (line) {
        const [a, b] = [t([+line[1], +line[2]]), t([+line[3], +line[4]])];
        return { ...sh, path: `M${a[0]},${a[1]} L${b[0]},${b[1]}` };
      }
      return sh;
    };
    return { ...piece, shape: one(s), ...Array.isArray(piece.extra) ? { extra: piece.extra.map(one) } : {} };
  }
  function prefabOf(data, part) {
    const id = String(part).replace(/_\d+$/, ""), item = prefab(id);
    if (!item || item.lamp) return null;
    const pieces = Object.values(data?.furniture || {}).filter((p) => p?.part === part);
    const point = (sh) => sh?.rect ? sh.rect.slice(0, 2) : sh?.circle ? sh.circle.slice(0, 2) : sh?.poly?.[0];
    for (const turn2 of [0, 90, 180, 270]) {
      const made = placePrefab(data, id, [0, 0], turn2).ops.map((op) => op.value);
      if (made.length !== pieces.length) return null;
      const [a, b] = [point(made[0].shape), point(pieces[0].shape)];
      if (!a || !b) return null;
      const at = [tidy(b[0] - a[0]), tidy(b[1] - a[1])];
      const fits = made.every((m2, k) => {
        const [p, q] = [point(m2.shape), point(pieces[k].shape)];
        return p && q && Math.abs(p[0] + at[0] - q[0]) < 0.5 && Math.abs(p[1] + at[1] - q[1]) < 0.5 && JSON.stringify(m2.shape.rect?.slice(2)) === JSON.stringify(pieces[k].shape.rect?.slice(2)) && (m2.shape.turn || 0) === (pieces[k].shape.turn || 0);
      });
      if (fits) return { id, at, turn: turn2 };
    }
    return null;
  }

  // src/editor/devices.js
  var DEVICE_DOMAINS = ["light", "switch", "cover", "media_player", "climate", "fan", "vacuum", "sensor", "binary_sensor", "lock", "camera", "weather"];
  var ICONS = {
    light: "mdi:lightbulb",
    switch: "mdi:power-socket-eu",
    cover: "mdi:window-shutter",
    media_player: "mdi:television",
    climate: "mdi:air-conditioner",
    fan: "mdi:fan",
    vacuum: "mdi:robot-vacuum",
    sensor: "mdi:eye",
    binary_sensor: "mdi:checkbox-blank-circle-outline",
    lock: "mdi:lock",
    camera: "mdi:cctv",
    weather: "mdi:weather-partly-cloudy"
  };
  var CLASS_ICONS = {
    temperature: "mdi:thermometer",
    humidity: "mdi:water-percent",
    illuminance: "mdi:brightness-5",
    power: "mdi:flash",
    energy: "mdi:lightning-bolt",
    battery: "mdi:battery",
    co2: "mdi:molecule-co2",
    motion: "mdi:motion-sensor",
    occupancy: "mdi:home-account",
    door: "mdi:door",
    window: "mdi:window-closed-variant",
    speaker: "mdi:speaker",
    tv: "mdi:television",
    blind: "mdi:blinds",
    shutter: "mdi:window-shutter",
    curtain: "mdi:curtains",
    garage: "mdi:garage",
    outlet: "mdi:power-socket-eu"
  };
  var TOGGLES = ["light", "switch", "fan", "input_boolean"];
  var domainOf = (id) => id.split(".")[0];
  function devicesIn(states, query = "") {
    const q = query.trim().toLowerCase();
    return Object.entries(states || {}).filter(([id]) => DEVICE_DOMAINS.includes(domainOf(id))).map(([id, s]) => ({ id, name: s?.attributes?.friendly_name || id, icon: iconOf2(id, s), domain: domainOf(id) })).filter((d) => !q || d.name.toLowerCase().includes(q) || d.id.includes(q)).sort((a, b) => DEVICE_DOMAINS.indexOf(a.domain) - DEVICE_DOMAINS.indexOf(b.domain) || a.name.localeCompare(b.name));
  }
  var UNIT_CLASSES = { "\xB0C": "temperature", "\xB0F": "temperature", "%": "humidity", lx: "illuminance", W: "power", kWh: "energy", ppm: "co2" };
  function iconOf2(id, state) {
    const a = state?.attributes || {}, cls = a.device_class || (domainOf(id) === "sensor" ? UNIT_CLASSES[a.unit_of_measurement] : void 0);
    return a.icon || CLASS_ICONS[cls] || ICONS[domainOf(id)] || "mdi:help-circle-outline";
  }
  function placedIn(data) {
    return new Set([...(data?.lights || []).flatMap((g) => g?.entities || []), ...(data?.markers || []).map((m2) => m2?.entity)].filter(Boolean));
  }
  function labelFor(state) {
    const unit = state?.attributes?.unit_of_measurement;
    if (!Number.isFinite(Number(state?.state))) return {};
    return { label: { round: Number.isInteger(Number(state.state)) ? 0 : 1, ...unit ? { unit: /^\u00b0[CF]$/.test(unit) ? "\xB0" : unit === "%" ? "%" : ` ${unit}` } : {} } };
  }
  function openingNear(data, p, tol) {
    let best = -1, bestD = Infinity;
    (data?.openings || []).forEach((o, i) => {
      const horizontal = o.wall === "top" || o.wall === "bottom";
      const [x0, y0, x1, y1] = horizontal ? [o.x, o.at - o.depth, o.x + o.w, o.at] : [o.at - o.depth, o.y, o.at, o.y + o.h];
      const d = Math.hypot(Math.max(x0 - p[0], 0, p[0] - x1), Math.max(y0 - p[1], 0, p[1] - y1));
      if (d <= tol && d < bestD) [best, bestD] = [i, d];
    });
    return best;
  }
  function placeDevice(data, id, state, p, tol = 0) {
    const at = p.map(tidy), domain = domainOf(id), m2 = data?.units_per_metre || 100;
    const part = partKey(data, domain === "light" ? "lamp" : id.split(".")[1]);
    const marker = {
      entity: id,
      x: at[0],
      y: at[1],
      icon: iconOf2(id, state),
      ...TOGGLES.includes(domain) ? { tap: "toggle" } : {},
      ...domain === "sensor" ? labelFor(state) : {},
      part
    };
    if (domain === "light") {
      const lamp = { ...lightFrom(data, at, 0.5 * m2), entities: [id], part };
      return { ops: [{ insert: ["lights"], value: lamp }, { insert: ["markers"], value: marker }], part, what: "lamp" };
    }
    if (domain === "cover") {
      const i = openingNear(data, at, tol);
      if (i >= 0) return { ops: [{ set: ["openings", i, "shutter"], value: id }, { insert: ["markers"], value: marker }], part, what: "shutter" };
    }
    return { ops: [{ insert: ["markers"], value: marker }], part, what: "marker" };
  }

  // src/schema.js
  var n = (help, extra) => ({ type: "number", unit: "u", help, ...extra });
  var m = (help, extra) => ({ type: "number", unit: "m", help, ...extra });
  var RECT = ["x", "y", "w", "h"];
  var DESCRIPTION = { type: "text", check: true, help: "A note about it, for whoever edits the home; the card ignores it" };
  var PART = { type: "string", check: true, help: "The Build view's object it is part of (a room's name, window_1\u2026); the card ignores it" };
  var SHAPE_KINDS = ["rect", "circle", "ellipse", "poly", "path", "text", "svg"];
  var SHAPE = { type: "shape", check: true, help: "A shape: one of rect, circle, ellipse, poly, path, text or svg, plus SVG attributes", fields: {
    rect: { type: "numbers", labels: RECT, unit: "u", help: "A rectangle [x, y, w, h]" },
    circle: { type: "numbers", labels: ["cx", "cy", "r"], unit: "u", help: "A circle [cx, cy, r]" },
    ellipse: { type: "numbers", labels: ["cx", "cy", "rx", "ry"], unit: "u", help: "An ellipse [cx, cy, rx, ry]" },
    poly: { type: "points", unit: "u", help: "A polygon [[x, y], ...]" },
    path: { type: "string", help: "An SVG path ('M0,0 H10')" },
    text: { type: "string", help: "A text, at `at`" },
    at: { type: "numbers", labels: ["x", "y"], unit: "u", check: true, help: "Where a text is: [x, y]" },
    svg: { type: "string", help: "Raw SVG, for anything else" },
    class: { type: "string", help: "Its colour, from the theme: floor, wall, iwall, fix, fix2, glass, dev, line, room, lbl, or a palette class" },
    rx: n("Round corners (a rect)"),
    repeat: { type: "object", help: "Draws the shape count times, each copy moved on by step", fields: {
      count: { type: "number", help: "How many copies", min: 1 },
      step: { type: "numbers", labels: ["dx", "dy"], unit: "u", help: "How far each copy moves on" }
    } },
    description: DESCRIPTION,
    part: PART
  } };
  var SHAPES = (help) => ({ type: "list", of: SHAPE, help, check: true });
  var OPENING = { type: "object", check: true, help: "A window or door, where the sun and daylight come in", fields: {
    wall: { type: "enum", values: ["top", "bottom", "left", "right"], required: true, help: "The side of the drawing its wall faces out to" },
    at: n("The wall's outer face: a y on a top or bottom wall, an x on a left or right one", { required: true }),
    depth: n("The wall's thickness", { required: true }),
    x: n("Where it starts along a top or bottom wall", { when: { wall: ["top", "bottom"] }, required: true }),
    w: n("How wide it is, along a top or bottom wall", { when: { wall: ["top", "bottom"] }, required: true }),
    y: n("Where it starts along a left or right wall", { when: { wall: ["left", "right"] }, required: true }),
    h: n("How long it is, along a left or right wall", { when: { wall: ["left", "right"] }, required: true }),
    lo: m("The glass from this high above the floor", { required: true }),
    hi: m("The glass up to this high above the floor", { required: true }),
    shutter: { type: "entity", domain: "cover", check: true, help: "A cover: its position darkens the opening and shortens the sun's patch" },
    room: { type: "room", required: true, help: "The room the sun's patch falls in" },
    sky: { type: "room", check: true, help: "The room the daylight spreads over (default: room)" },
    description: DESCRIPTION,
    part: PART
  } };
  var PIECE = { type: "object", check: true, help: "A piece of furniture: drawn, casting shadows, with daylight on its top", fields: {
    shape: { type: "object", required: true, help: "Its outline: a rect (turned by turn degrees), a circle or a poly", fields: {
      rect: { type: "numbers", labels: RECT, unit: "u", help: "A rectangle [x, y, w, h]" },
      rx: n("Round corners"),
      turn: { type: "number", unit: "\xB0", help: "Turned by this many degrees around its centre (clockwise): a rect's, or the middle of a poly's bounding box" },
      circle: { type: "numbers", labels: ["cx", "cy", "r"], unit: "u", help: "A circle [cx, cy, r]" },
      poly: { type: "points", unit: "u", help: "A polygon [[x, y], ...]" }
    } },
    height: m("Its height; only pieces with one cast shadows", { check: true, min: 0 }),
    shadow_room: { type: "room", check: true, help: "The room its shadow in the sun stays in; without one it casts none in the sun" },
    class: { type: "enum", values: ["furn", "furn2"], default: "furn", help: "furn, or furn2 for smaller, darker pieces" },
    extra: { ...SHAPES("Shapes drawn with it, in its own frame and turned with it: cushions, devices on it, lines") },
    description: DESCRIPTION,
    part: PART
  } };
  var LIGHT = { type: "object", check: true, help: "A light drawn as a glow, in its entity's colour and brightness", fields: {
    entities: { type: "list", of: { type: "entity", domain: ["light", "switch", "media_player", "fan", "input_boolean"], check: true, help: "An entity" }, check: true, help: "The first of them that is on lights it, in its colour (or, without any, lit says when)" },
    lit: { type: "enum", values: ["always", "dark", "never"], check: true, help: "Without entities (a lamp that isn't smart): lit always, while the sun is down (dark), or never" },
    states: { type: "list", of: { type: "string", help: "A state" }, default: ["on"], help: "What counts as on" },
    color: { type: "rgb", help: "[r, g, b], for entities without a colour of their own" },
    shape: { ...SHAPES("Shapes, blurred into a glow"), required: true },
    top: { type: "bool", help: "Drawn over the fittings (otherwise on the floor)" },
    over: { type: "bool", help: "Drawn over the furniture too" },
    clip: { type: "room", check: true, help: "The room it stays in" },
    pool: { type: "object", check: true, help: "A soft pool of light around a point light, with furniture casting shadows away from it", fields: {
      x: n("Its centre", { required: true }),
      y: n("Its centre", { required: true }),
      r: n("Its radius", { required: true }),
      height: m("How high the light is", { required: true }),
      shadows: { type: "list", of: { type: "furniture", check: true, help: "A piece with a height" }, help: "The furniture casting shadows from it" }
    } },
    outdoor: { type: "bool", help: "Fades out by day" },
    effect: { type: "effect", help: "An effect it plays all the time it is lit" },
    multi: { type: "bool", help: "Keeps the shapes' own colours (a string of coloured bulbs)" },
    description: DESCRIPTION,
    part: PART
  } };
  var MARKER2 = { type: "object", check: true, help: "A marker over the plan: tap toggles a light or switch, or opens the details", fields: {
    entity: { type: "entity", required: true, help: "What it shows" },
    x: n("Where it is", { required: true }),
    y: n("Where it is", { required: true }),
    icon: { type: "icon", required: true, help: "Its icon (mdi:\u2026)" },
    icons: { type: "map", of: { type: "icon", help: "The icon in this state" }, check: true, help: "Icons by state; weather entities follow their condition on their own" },
    tap: { type: "enum", values: ["toggle"], help: "toggle, or (left out) open the details" },
    small: { type: "bool", help: "A smaller marker" },
    side: { type: "bool", help: "The label to its right instead of below" },
    label: { type: "object", check: true, help: "The small text under the icon", fields: {
      entity: { type: "entity", check: true, help: "Read this entity instead of the marker's" },
      attribute: { type: "attribute", help: "Show this attribute (otherwise the state)" },
      round: { type: "number", help: "Round to this many decimals", min: 0 },
      unit: { type: "string", help: "Appended, as in '\xB0' or ' lx'" },
      when: { type: "list", of: { type: "string", help: "A state" }, check: true, help: "Only while the marker's entity is in one of these states" },
      hide: { type: "list", of: { type: "string", help: "A value" }, check: true, help: "Values never shown" }
    } },
    active: { type: "list", of: { type: "string", help: "A state" }, check: true, help: "The states in which it shows as on" },
    power: { type: "entity", check: true, help: "An entity that greys it out while it's off" },
    wake: { type: "entity", domain: "button", check: true, help: "A button pressed on tap while power is off" },
    description: DESCRIPTION,
    part: PART
  } };
  var SCHEMA = { type: "object", help: "A home", fields: {
    description: { ...DESCRIPTION, help: "A note about the home, for whoever edits it; the card ignores it" },
    view: { type: "object", required: true, help: "The part of the drawing the card shows", fields: {
      x: n("Its left edge", { required: true }),
      y: n("Its top edge", { required: true }),
      w: n("Its width", { required: true }),
      h: n("Its height", { required: true })
    } },
    units_per_metre: { type: "number", required: true, min: 0, help: "The drawing's scale: how many of its units make a metre" },
    rooms: {
      type: "map",
      of: { type: "yaml", help: "Rectangles [[x, y, w, h], ...], or one polygon [[[x, y], ...]]" },
      help: "Light stays inside its room"
    },
    drawing: { type: "object", help: "The plan itself, as lists of shapes in slots, bottom to top", fields: {
      background: { type: "object", check: true, help: "A picture of the plan under everything", fields: {
        image: { type: "string", required: true, help: "The picture's URL (/local/plan.png)" },
        rect: { type: "numbers", labels: RECT, unit: "u", help: "Where it goes (default: the view)" }
      } },
      floors: SHAPES("Floors, under the daylight and the lamps"),
      walls: SHAPES("Walls, over the lamps on the floor"),
      glazing: SHAPES("Glass, under the blinds"),
      fittings: SHAPES("Kitchen counters, bathroom fittings"),
      under_furniture: SHAPES("Under the furniture, over its shadows: rugs"),
      on_furniture: SHAPES("On the furniture, under the daylight on it"),
      labels: SHAPES("Room names and labels, over everything")
    } },
    openings: { type: "list", of: OPENING, help: "Windows and doors" },
    furniture: { type: "map", of: PIECE, help: "The furniture, by name, drawn in its order" },
    lights: { type: "list", of: LIGHT, help: "Lights drawn as glows" },
    effects: {
      type: "map",
      of: { type: "yaml", help: "Steps [hue, saturation, brightness %, hold ms], or {fade, steps}" },
      help: "Effects by name, adding to flicker"
    },
    markers: { type: "list", of: MARKER2, help: "Markers over the plan" },
    sun: { type: "object", required: true, help: "The surroundings for the sun and daylight", fields: {
      north: { type: "number", unit: "\xB0", required: true, help: "The compass bearing the top of the plan faces (0: north is up)" },
      entity: { type: "entity", domain: "sun", default: "sun.sun", check: true, help: "The sun" },
      weather: { type: "entity", domain: "weather", default: "weather.home", check: true, help: "The weather" },
      blockers: { type: "list", check: true, help: "Things outside that shade the openings", of: { type: "object", check: true, help: "A blocker", fields: {
        rect: { type: "numbers", labels: RECT, unit: "u", help: "A rectangle [x, y, w, h]" },
        poly: { type: "points", unit: "u", help: "A polygon [[x, y], ...]" },
        height: m("Its height", { required: true }),
        description: DESCRIPTION
      } } },
      trees: { type: "object", help: "A band of sky where the sun is dimmed", fields: {
        from: { type: "number", unit: "\xB0", help: "From this azimuth" },
        to: { type: "number", unit: "\xB0", help: "To this azimuth" },
        top: { type: "number", unit: "\xB0", help: "Up to this elevation" },
        through: { type: "number", help: "How much of the sun gets through (0\u20131)" }
      } },
      spill: { type: "list", help: "Daylight carried on through doors into rooms without windows", of: { type: "object", help: "A spill", fields: {
        cx: n("Its centre"),
        cy: n("Its centre"),
        rx: n("Its radius across"),
        ry: n("Its radius down"),
        clip: { type: "room", check: true, help: "The room it stays in" },
        from: { type: "list", of: { type: "opening", check: true, help: "An opening's position in the list" }, help: "The openings whose shutters dim it" },
        k: { type: "number", help: "How much of the daylight gets through (0\u20131)" },
        description: DESCRIPTION
      } } },
      outdoor: { ...SHAPES("Shapes in the sun whenever it comes in (a terrace)") }
    } },
    palette: { type: "object", help: "Colours for the drawing's classes, in light and dark", fields: {
      light: { type: "map", of: { type: "color", check: true, help: "A colour" }, help: "In the light theme" },
      dark: { type: "map", of: { type: "color", check: true, help: "A colour" }, help: "In the dark theme" },
      tinted: { type: "list", of: { type: "string", help: "A class" }, check: true, help: "Classes taking the time of day's tint (#rrggbb colours)" }
    } },
    simulator: { type: "object", help: "For the simulator's time presets", fields: {
      scenes: { type: "map", help: "What each time preset switches", of: {
        type: "yaml",
        help: "{lights: on/off, media: on/off, shutters: {entity: position}}, or another preset's name"
      } }
    } }
  } };
  function fieldAt(path, schema4 = SCHEMA) {
    let f = schema4;
    for (const k of path) {
      if (!f) return void 0;
      if (f.type === "list" || f.type === "map") f = f.of;
      else if (f.type === "object" || f.type === "shape") f = f.fields[k] ?? (f.type === "shape" ? { type: "yaml", help: "An SVG attribute (a list: its values in turn, copy by copy)" } : void 0);
      else if (f.type === "numbers" || f.type === "rgb") f = { type: "number", unit: f.unit, help: f.labels?.[k] ?? "A number" };
      else if (f.type === "points") f = { type: "numbers", labels: ["x", "y"], unit: f.unit, help: "A point [x, y]" };
      else return f.type === "yaml" ? f : void 0;
    }
    return f;
  }

  // src/editor/pickers.js
  var el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    for (const c of children.flat()) if (c !== null && c !== void 0 && c !== false) e.append(c);
    return e;
  };
  function entityChoices(states, domain) {
    const domains = [domain].flat().filter(Boolean);
    const fits = (id) => !domains.length || domains.includes(id.split(".")[0]);
    return Object.entries(states || {}).map(([id, s]) => ({ id, name: s?.attributes?.friendly_name || "", state: s?.state, fits: fits(id) })).sort((a, b) => b.fits - a.fits || a.id.localeCompare(b.id));
  }
  function entityNote(states, id) {
    if (!id) return "";
    const s = states?.[id];
    if (!s) return Object.keys(states || {}).length ? "not in the states in use" : "";
    return [s.attributes?.friendly_name, s.state].filter((v) => v !== void 0 && v !== "").join(" \xB7 ");
  }
  var OWN = ["friendly_name", "icon", "entity_picture", "supported_features", "supported_color_modes", "attribution"];
  function attributesOf(state) {
    return Object.keys(state?.attributes || {}).sort((a, b) => OWN.includes(a) - OWN.includes(b) || a.localeCompare(b));
  }
  function labelPreview(marker, states) {
    const s = states?.[marker?.entity];
    if (!marker?.label) return { text: "", why: "no label" };
    if (!s) return { text: "", why: `${marker.entity || "its entity"} isn't in the states in use` };
    const text2 = labelOf(marker, s, states);
    if (text2) return { text: text2, why: "" };
    const l = marker.label;
    if (l.when && !l.when.includes(s.state)) return { text: "", why: `nothing now: only while ${marker.entity} is ${l.when.join(" or ")} (it's ${s.state})` };
    if (l.entity && !states[l.entity]) return { text: "", why: `${l.entity} isn't in the states in use` };
    return { text: "", why: "nothing now: no value, a hidden one, or not a number to round" };
  }
  function searchIcons(list, query, n2 = 60) {
    const q = String(query || "").toLowerCase().replace(/^mdi:/, "").trim();
    if (!q) return [];
    const rank = (i) => i.name.startsWith(q) ? 0 : i.name.includes(q) ? 1 : (i.aliases || []).some((a) => a.includes(q)) ? 2 : (i.tags || []).some((t) => t.toLowerCase().includes(q)) ? 3 : 9;
    return list.map((i) => [rank(i), i.name]).filter(([r]) => r < 9).sort((a, b) => a[0] - b[0] || a[1].length - b[1].length || a[1].localeCompare(b[1])).slice(0, n2).map(([, name]) => name);
  }
  var hsHex = (h2, s) => `#${hsvRgb(h2, s).map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  function hexHs(hex) {
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    if (!max || !d) return [0, 0];
    const h2 = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [Math.round((h2 * 60 + 360) % 360), Math.round(d / max * 100)];
  }
  var lists = 0;
  function datalist(input2, options) {
    if (!options.length) return [];
    const id = `lw-list-${++lists}`;
    input2.setAttribute("list", id);
    return [el("datalist", { id }, options.map((o) => el("option", { value: o.value, label: o.label || "" })))];
  }
  function entityInput(field, value, commit, states) {
    const i = el("input", { type: "text", value: value ?? "", placeholder: field.default ?? (field.domain ? `${[field.domain].flat()[0]}.\u2026` : "domain.name"), spellcheck: false });
    const note = el("small", { className: "note", textContent: entityNote(states, value) });
    i.onchange = () => commit(i.value.trim() === "" ? void 0 : i.value.trim());
    i.oninput = () => {
      note.textContent = entityNote(states, i.value.trim());
    };
    const options = entityChoices(states, field.domain).map((c) => ({ value: c.id, label: [c.name, c.state].filter(Boolean).join(" \xB7 ") }));
    return [el("span", { className: "stack" }, i, note), ...datalist(i, options)];
  }
  function entityList(field, value, commit, states) {
    const v = Array.isArray(value) ? value : [];
    const rows = v.map((id, k) => {
      const remove = el("button", { type: "button", className: "clear", textContent: "\xD7", title: "Take it out" });
      remove.onclick = () => commit(v.filter((_, j) => j !== k));
      return el("span", { className: "value" }, entityInput(field.of, id, (x) => commit(x === void 0 ? v.filter((_, j) => j !== k) : v.map((y, j) => j === k ? x : y)), states), remove);
    });
    const add = entityInput({ ...field.of, default: "another\u2026" }, void 0, (x) => x !== void 0 && commit([...v, x]), states);
    return [el("span", { className: "entities" }, rows, el("span", { className: "value" }, add))];
  }
  var ICONS_URL = "https://cdn.jsdelivr.net/npm/@mdi/svg/meta.json";
  var icons;
  var loadIcons = () => icons ?? (icons = fetch(ICONS_URL).then((r) => r.ok ? r.json() : null).then((list) => list && list.map(({ name, aliases, tags }) => ({ name, aliases, tags }))).catch(() => null));
  var iconSwatch = (name) => {
    const s = el("span", { className: "icon" });
    if (/^mdi:[\w-]+$/.test(name || "")) s.style.setProperty("--icon", `url(https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${name.slice(4)}.svg)`);
    return s;
  };
  function iconInput(field, value, commit) {
    const i = el("input", { type: "text", value: value ?? "", placeholder: "mdi:\u2026 (type to search)", spellcheck: false });
    const swatch = iconSwatch(value), found = el("div", { className: "found", hidden: true });
    const pick = (name) => {
      i.value = name;
      found.hidden = true;
      commit(name);
    };
    let typed = 0;
    i.onchange = () => commit(i.value.trim() === "" ? void 0 : i.value.trim());
    i.oninput = async () => {
      const mine = ++typed, list = await loadIcons();
      if (mine !== typed) return;
      const names = list ? searchIcons(list, i.value) : [];
      found.textContent = "";
      found.hidden = !names.length;
      for (const name of names) {
        const b = el("button", { type: "button", title: `mdi:${name}` }, iconSwatch(`mdi:${name}`), el("span", { textContent: name }));
        b.onmousedown = (e) => e.preventDefault();
        b.onclick = () => pick(`mdi:${name}`);
        found.append(b);
      }
    };
    i.onblur = () => setTimeout(() => {
      found.hidden = true;
    }, 150);
    return [swatch, el("span", { className: "stack search" }, i, found)];
  }
  function labelLine(marker, states) {
    const { text: text2, why } = labelPreview(marker, states);
    return el("p", { className: `label-now${text2 ? "" : " none"}` }, text2 ? ["Shows now: ", el("b", { textContent: text2 })] : why);
  }
  function effectsEditor(effects, { commit, preview, previewing, lights }) {
    const all = effects && typeof effects === "object" ? effects : {};
    const set2 = (name2, def) => commit(Object.keys({ ...all, [name2]: def }).length ? { ...all, [name2]: def } : void 0);
    const out = [];
    for (const [name2, def] of Object.entries(all)) {
      const steps = Array.isArray(def) ? def : Array.isArray(def?.steps) ? def.steps : null;
      const box2 = el("fieldset", { className: "effect" });
      const remove = el("button", { type: "button", className: "clear", textContent: "\xD7", title: `Delete ${name2}` });
      remove.onclick = () => {
        const rest = { ...all };
        delete rest[name2];
        commit(Object.keys(rest).length ? rest : void 0);
      };
      box2.append(el("legend", {}, el("span", { className: "key", textContent: name2 }), remove));
      if (!steps) {
        box2.append(el("p", { className: "help", textContent: "Not a list of steps: edit it in the YAML." }));
        out.push(box2);
        continue;
      }
      const put2 = (list) => set2(name2, Array.isArray(def) ? list : { ...def, steps: list });
      const fade = el("input", { type: "number", min: 0, step: 50, value: Array.isArray(def) ? "" : def.fade ?? "", placeholder: "666" });
      fade.onchange = () => set2(name2, fade.value === "" ? steps : { ...Array.isArray(def) ? {} : def, fade: +fade.value, steps });
      box2.append(el(
        "label",
        { className: "row" },
        el("span", { className: "key", textContent: "fade", title: "Each step fades in over this long" }),
        el("span", { className: "value" }, fade, el("span", { className: "unit", textContent: "ms" }))
      ));
      steps.forEach((st, k) => {
        const [h2, s, v, hold] = st, colour = el("input", { type: "color", value: hsHex(h2, s), title: `hue ${h2}, saturation ${s}` });
        const bright = el("input", { type: "number", min: 1, max: 100, value: v, title: "Brightness %" });
        const holdIn = el("input", { type: "number", min: 0, step: 100, value: hold, title: "Held this long (ms)" });
        const change = () => put2(steps.map((x, j) => j === k ? [...hexHs(colour.value), +bright.value, +holdIn.value] : x));
        colour.onchange = bright.onchange = holdIn.onchange = change;
        const del = el("button", { type: "button", className: "clear", textContent: "\xD7", title: "Delete this step", disabled: steps.length < 2 });
        del.onclick = () => put2(steps.filter((_, j) => j !== k));
        box2.append(el("span", { className: "value step" }, colour, bright, el("span", { className: "unit", textContent: "%" }), holdIn, el("span", { className: "unit", textContent: "ms" }), del));
      });
      const add = el("button", { type: "button", className: "add-field", textContent: "+ step" });
      add.onclick = () => put2([...steps, [...steps.at(-1) || [30, 80, 100, 2e3]]]);
      const on = previewing?.name === name2;
      const lamp = el("select", { title: "The lamp it plays on" }, lights.map((id) => el("option", { value: id, textContent: id, selected: on && previewing.entity === id })));
      const play = el("button", { type: "button", className: "add-field", textContent: on ? "Stop" : "Preview on", disabled: !lights.length });
      play.setAttribute("aria-pressed", on);
      play.onclick = () => preview(on ? null : name2, lamp.value);
      box2.append(el("span", { className: "value" }, add, play, lamp));
      out.push(box2);
    }
    const name = el("input", { type: "text", placeholder: "a new effect\u2019s name", spellcheck: false });
    name.onchange = () => {
      const n2 = name.value.trim();
      if (n2 && !all[n2]) set2(n2, [[30, 80, 100, 3e3], [15, 90, 70, 3e3]]);
    };
    out.push(el("div", { className: "row" }, name), el("p", { className: "help", textContent: `Built in: ${Object.keys(PRESETS).join(", ")}.` }));
    return out;
  }

  // src/editor/panels.js
  var flow = (v) => v === void 0 ? "" : browser_default.stringify(v, { collectionStyle: "flow", lineWidth: 0, flowCollectionPadding: false }).trim();
  var samePath = (a, b) => !!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]);
  var pathKey = (path) => JSON.stringify(path);
  var OBJECT_KINDS = [
    { title: "Rooms", kinds: ["Room"] },
    { title: "Windows and doors", kinds: ["Window", "Glass door", "Door", "Doorway", "Window or door"] },
    { title: "Furniture", kinds: ["Furniture"] },
    { title: "Lamps", kinds: ["Lamp"] },
    { title: "Other things" }
  ];
  var SLOT_NAMES = {
    floors: "Floors",
    walls: "Walls",
    glazing: "Glazing",
    fittings: "Fittings",
    under_furniture: "Under the furniture",
    on_furniture: "On the furniture",
    labels: "Labels"
  };
  function shapeLabel(s) {
    if (typeof s !== "object" || !s) return "raw SVG";
    const kind = SHAPE_KINDS.find((k) => s[k] !== void 0) || "?";
    const what = kind === "text" ? `text: ${s.text}` : kind;
    return [what, s.class, s.repeat && `\xD7${s.repeat.count}`].filter(Boolean).join(" \xB7 ");
  }
  var rectLabel = (q) => Array.isArray(q) && q.length === 4 ? `rect ${q[2]} \xD7 ${q[3]} at ${q[0]}, ${q[1]}` : "rect ?";
  function itemGroups(data) {
    const d = data && typeof data === "object" ? data : {};
    const groups = [];
    groups.push({
      title: "Rooms",
      path: ["rooms"],
      add: "room",
      items: Object.entries(d.rooms || {}).map(([name, region]) => ({
        path: ["rooms", name],
        label: name,
        // A room of rectangles: each of them (one polygon is the room itself).
        children: Array.isArray(region) && !Array.isArray(region[0]?.[0]) ? region.map((q, i) => ({ path: ["rooms", name, i], label: rectLabel(q) })) : [],
        childList: ["rooms", name],
        addChild: Array.isArray(region) && !Array.isArray(region[0]?.[0]) ? { path: ["rooms", name], add: "rect", title: "Add a rectangle to it" } : null
      }))
    });
    for (const slot of SLOTS) {
      const list = Array.isArray(d.drawing?.[slot]) ? d.drawing[slot] : [];
      groups.push({
        title: SLOT_NAMES[slot],
        path: ["drawing", slot],
        add: "shape",
        reorder: true,
        items: list.map((s, i) => ({ path: ["drawing", slot, i], label: shapeLabel(s) }))
      });
    }
    groups.push({
      title: "Openings",
      path: ["openings"],
      add: "opening",
      items: (d.openings || []).map((o, i) => ({
        path: ["openings", i],
        label: `${o.wall} wall${o.room ? `, ${o.room}` : ""}`,
        title: o.shutter
      }))
    });
    groups.push({
      title: "Furniture",
      path: ["furniture"],
      add: "piece",
      reorder: true,
      items: Object.entries(d.furniture || {}).map(([name, p]) => ({
        path: ["furniture", name],
        label: name,
        title: p?.height ? `${p.height} m` : "no height: casts no shadows",
        children: (Array.isArray(p?.extra) ? p.extra : []).map((s, i) => ({ path: ["furniture", name, "extra", i], label: shapeLabel(s) })),
        childList: ["furniture", name, "extra"],
        addChild: typeof p?.extra === "string" ? null : { path: ["furniture", name, "extra"], add: "extra", title: "Add a shape on it (a cushion, a device\u2026)" }
      }))
    });
    groups.push({
      title: "Lights",
      path: ["lights"],
      add: "light",
      items: (d.lights || []).map((g, i) => ({ path: ["lights", i], label: g.entities?.[0] || `light ${i + 1}` }))
    });
    groups.push({
      title: "Markers",
      path: ["markers"],
      add: "marker",
      items: (d.markers || []).map((m2, i) => ({ path: ["markers", i], label: m2.entity || `marker ${i + 1}` }))
    });
    groups.push({
      title: "Daylight spills",
      path: ["sun", "spill"],
      add: "spill",
      items: (Array.isArray(d.sun?.spill) ? d.sun.spill : []).map((s, i) => ({
        path: ["sun", "spill", i],
        label: s?.clip ? `into ${s.clip}` : `spill ${i + 1}`,
        title: `from openings ${(s?.from || []).join(", ") || "none"}, ${s?.k ?? "?"} through`
      }))
    });
    groups.push({
      title: "Sun blockers",
      path: ["sun", "blockers"],
      add: "blocker",
      items: (Array.isArray(d.sun?.blockers) ? d.sun.blockers : []).map((b, i) => ({ path: ["sun", "blockers", i], label: `${b?.rect ? "rect" : "poly"}, ${b?.height ?? "?"} m` }))
    });
    const described = (it) => {
      const note = it.path.reduce((o, k) => o?.[k], d)?.description;
      return typeof note === "string" && note ? { ...it, title: [note, it.title].filter(Boolean).join("\n") } : it;
    };
    for (const g of groups) g.items = g.items.map((it) => ({ ...described(it), children: it.children?.map(described) }));
    return groups;
  }
  function renderList(box2, data, selected, ctx, also = []) {
    const open = box2._open ?? (box2._open = /* @__PURE__ */ new Set(["Furniture", "Lights", "Markers", "Openings", "Rooms", "Daylight spills"]));
    const unfolded = box2._unfolded ?? (box2._unfolded = /* @__PURE__ */ new Set());
    const isOn = (path) => samePath(path, selected) || also.some((p) => samePath(path, p));
    box2.textContent = "";
    const home = el("li", { className: `item home${selected ? "" : " on"}`, textContent: "The home" });
    home.onclick = () => ctx.select(null);
    box2.append(el("ul", { className: "items" }, home));
    const all = itemGroups(data), inObject = /* @__PURE__ */ new Set();
    if (ctx.objects) for (const section of OBJECT_KINDS) {
      const objects = ctx.objects.filter((o) => section.kinds ? section.kinds.includes(o.kind) : !OBJECT_KINDS.some((k) => k.kinds?.includes(o.kind)));
      for (const o of objects) for (const p of o.parts) inObject.add(pathKey(p));
      if (!objects.length) continue;
      const key = `object:${section.title}`, details = el("details", { open: !box2._shut?.has(key) });
      details.ontoggle = () => {
        box2._shut ?? (box2._shut = /* @__PURE__ */ new Set());
        details.open ? box2._shut.delete(key) : box2._shut.add(key);
      };
      details.append(el("summary", {}, el("span", { textContent: section.title }), el("small", { textContent: objects.length })));
      const ul = el("ul", { className: "items" });
      for (const o of objects) ul.append(...objectLines(o));
      details.append(ul);
      box2.append(details);
    }
    let loose = false;
    for (const g0 of all) {
      const g = ctx.objects ? { ...g0, items: g0.items.filter((it) => !inObject.has(pathKey(it.path))) } : g0;
      if (ctx.objects && !g.items.length) continue;
      if (ctx.objects && !loose && (loose = true)) box2.append(el("p", { className: "loose", textContent: "Not in a group" }));
      const has = g.items.some((it) => [selected, ...also].some((sel) => sel && samePath(it.path, sel.slice(0, it.path.length))));
      const details = el("details", { open: open.has(g.title) || has });
      details.ontoggle = () => details.open ? open.add(g.title) : open.delete(g.title);
      const add = el("button", { type: "button", className: "add", textContent: "+", title: `Add to ${g.title.toLowerCase()}` });
      add.onclick = (e) => {
        e.preventDefault();
        ctx.add(g);
      };
      details.append(el("summary", {}, el("span", { textContent: g.title }), el("small", { textContent: g.items.length }), add));
      const ul = el("ul", { className: "items" });
      g.items.forEach((it, i) => {
        const on2 = isOn(it.path);
        const li = el("li", { className: `item${on2 ? " on" : ""}${ctx.inside != null && it.path[0] === "furniture" && it.path[1] === ctx.inside ? " in" : ""}`, textContent: it.label, title: it.title || "" });
        li.dataset.path = pathKey(it.path);
        li.onclick = (e) => e.shiftKey && ctx.toggle ? ctx.toggle(it.path) : ctx.select(it.path);
        if (g.reorder) {
          li.draggable = true;
          li.ondragstart = (e) => {
            e.dataTransfer.setData("text/x-lightwell-item", String(i));
            e.dataTransfer.effectAllowed = "move";
          };
          li.ondragover = (e) => {
            if (e.dataTransfer.types.includes("text/x-lightwell-item")) {
              e.preventDefault();
              e.stopPropagation();
              li.classList.add("drop");
            }
          };
          li.ondragleave = () => li.classList.remove("drop");
          li.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            li.classList.remove("drop");
            const from = +e.dataTransfer.getData("text/x-lightwell-item");
            if (from !== i) ctx.move(g.path, from, i);
          };
        }
        if (it.addChild) {
          const plus = el("button", { type: "button", className: "add-child", textContent: "+", title: it.addChild.title });
          plus.onclick = (e) => {
            e.stopPropagation();
            ctx.add(it.addChild);
          };
          li.append(plus);
        }
        ul.append(li);
        if (it.children?.length) ul.append(...insides(it, li));
      });
      details.append(ul);
      box2.append(details);
    }
    const on = box2.querySelector(".item.on");
    if (on) {
      const b = box2.getBoundingClientRect(), r = on.getBoundingClientRect();
      if (r.top < b.top) box2.scrollTop += r.top - b.top;
      else if (r.bottom > b.bottom) box2.scrollTop += r.bottom - b.bottom;
    }
    function objectLines(o) {
      const whole = o.parts.length && o.parts.every(isOn), inside = ctx.group === o.id, key = `object:${o.id}`;
      const li = el("li", { className: `item${whole ? " on" : ""}${inside ? " in" : ""}`, textContent: o.name, title: o.kind });
      li.onclick = (e) => e.shiftKey ? ctx.toggleObject(o.id) : ctx.selectObject(o.id);
      const shown = unfolded.has(key) || inside;
      const fold = el("span", { className: "fold", textContent: shown ? "\u25BE" : "\u25B8", title: shown ? "Hide its parts" : `Show its parts (${o.parts.length})` });
      fold.onclick = (e) => {
        e.stopPropagation();
        if (!unfolded.delete(key)) unfolded.add(key);
        renderList(box2, data, selected, ctx, also);
      };
      li.prepend(fold);
      if (!shown) return [li];
      return [li, ...o.parts.map((p) => {
        const g = all.find((x) => samePath(x.path, p.slice(0, -1))), label = g?.items.find((it) => samePath(it.path, p))?.label ?? p.join(".");
        const cli = el("li", { className: `item extra${inside && isOn(p) ? " on" : ""}`, textContent: `${g ? `${g.title}: ` : ""}${label}` });
        cli.dataset.path = pathKey(p);
        cli.onclick = () => ctx.enterObject(o.id, p);
        return cli;
      })];
    }
    function insides(it, li) {
      const key = pathKey(it.path), within = selected?.length > it.path.length && samePath(selected.slice(0, it.path.length), it.path);
      const shown = unfolded.has(key) || within || it.path[0] === "furniture" && it.path[1] === ctx.inside;
      const what = it.path[0] === "rooms" ? "rectangles" : "insides";
      const fold = el("span", { className: "fold", textContent: shown ? "\u25BE" : "\u25B8", title: shown ? `Hide its ${what}` : `Show its ${what} (${it.children.length})` });
      fold.onclick = (e) => {
        e.stopPropagation();
        if (!unfolded.delete(key)) unfolded.add(key);
        renderList(box2, data, selected, ctx, also);
      };
      li.prepend(fold);
      if (!shown) return [];
      const list = it.childList;
      return it.children.map((c, i) => {
        const cli = el("li", { className: `item extra${isOn(c.path) ? " on" : ""}`, textContent: c.label, title: c.title || "" });
        cli.dataset.path = pathKey(c.path);
        cli.onclick = (e) => e.shiftKey && ctx.toggle ? ctx.toggle(c.path) : ctx.select(c.path);
        cli.draggable = true;
        cli.ondragstart = (e) => {
          e.dataTransfer.setData("text/x-lightwell-extra", JSON.stringify([key, i]));
          e.dataTransfer.effectAllowed = "move";
        };
        cli.ondragover = (e) => {
          if (e.dataTransfer.types.includes("text/x-lightwell-extra")) {
            e.preventDefault();
            e.stopPropagation();
            cli.classList.add("drop");
          }
        };
        cli.ondragleave = () => cli.classList.remove("drop");
        cli.ondrop = (e) => {
          e.preventDefault();
          e.stopPropagation();
          cli.classList.remove("drop");
          const [from, j] = JSON.parse(e.dataTransfer.getData("text/x-lightwell-extra") || "[]");
          if (from === key && j !== i) ctx.move(list, j, i);
        };
        return cli;
      });
    }
  }
  function choices(field, ctx) {
    const d = ctx.data || {};
    switch (field.type) {
      case "room":
        return Object.keys(d.rooms || {});
      case "furniture":
        return Object.keys(d.furniture || {}).filter((n2) => d.furniture[n2]?.height);
      case "effect":
        return [.../* @__PURE__ */ new Set([...Object.keys(PRESETS), ...Object.keys(d.effects || {})])];
      default:
        return [];
    }
  }
  var markerOf = (path, ctx) => path[0] === "markers" ? ctx.data?.markers?.[path[1]] : void 0;
  function input(field, value, path, ctx) {
    const commit = (v) => ctx.commit(path, v);
    const t = field.type;
    if (t === "bool") {
      const c = el("input", { type: "checkbox", checked: !!value });
      c.onchange = () => commit(c.checked ? true : void 0);
      return [c];
    }
    if (t === "number") {
      const i = el("input", { type: "number", step: "any", value: value ?? "", placeholder: field.default ?? "" });
      i.onchange = () => commit(i.value === "" ? void 0 : +i.value);
      return [i, field.unit && el("span", { className: "unit", textContent: field.unit === "u" ? "" : field.unit })];
    }
    if (t === "enum" || t === "room") {
      const values = t === "enum" ? field.values : choices(field, ctx);
      const s = el(
        "select",
        {},
        el("option", { value: "", textContent: field.default ? `(${field.default})` : "\u2014" }),
        [...values, ...value !== void 0 && !values.includes(value) ? [value] : []].map((v) => el("option", { value: v, textContent: v, selected: v === value }))
      );
      s.onchange = () => commit(s.value === "" ? void 0 : s.value);
      return [s];
    }
    if (t === "numbers") {
      const labels = field.labels, v = Array.isArray(value) ? value : [];
      const inputs = labels.map((l, k) => el("input", { type: "number", step: "any", value: v[k] ?? "", title: l, placeholder: l }));
      inputs.forEach((i) => {
        i.onchange = () => commit(inputs.every((x) => x.value === "") ? void 0 : inputs.map((x) => +x.value));
      });
      return [el("span", { className: "numbers" }, inputs.map((i, k) => el("label", {}, el("small", { textContent: labels[k] }), i)))];
    }
    if (t === "rgb") {
      const hex = Array.isArray(value) ? `#${value.map((c2) => Math.round(c2).toString(16).padStart(2, "0")).join("")}` : "#ffffff";
      const c = el("input", { type: "color", value: hex });
      const clear = el("button", { type: "button", className: "clear", textContent: "\xD7", title: "Leave it out", hidden: value === void 0 });
      c.onchange = () => commit([1, 3, 5].map((k) => parseInt(c.value.slice(k, k + 2), 16)));
      clear.onclick = () => commit(void 0);
      return [c, el("code", { textContent: value ? flow(value) : "\u2014" }), clear];
    }
    if (t === "color") {
      const i = el("input", { type: "text", value: value ?? "" });
      const swatch = el("span", { className: "swatch" });
      swatch.style.background = value || "transparent";
      i.onchange = () => commit(i.value === "" ? void 0 : i.value);
      return [swatch, i];
    }
    if (t === "entity") return entityInput(field, value, commit, ctx.states);
    if (t === "icon") return iconInput(field, value, commit);
    if (t === "list" && field.of?.type === "entity") return entityList(field, value, commit, ctx.states);
    if (t === "attribute") {
      const m2 = markerOf(path, ctx), id = m2?.label?.entity || m2?.entity, names = attributesOf(ctx.states?.[id]);
      const s = el(
        "select",
        {},
        el("option", { value: "", textContent: "(its state)" }),
        [...names, ...value !== void 0 && !names.includes(value) ? [value] : []].map((n2) => el("option", {
          value: n2,
          selected: n2 === value,
          textContent: `${n2}: ${JSON.stringify(ctx.states?.[id]?.attributes?.[n2] ?? "?")}`.slice(0, 60)
        }))
      );
      s.onchange = () => commit(s.value === "" ? void 0 : s.value);
      return [s];
    }
    if (t === "text") {
      const a2 = el("textarea", { value: value ?? "", className: "prose", rows: Math.min(6, Math.max(2, String(value ?? "").split("\n").length)) });
      a2.onchange = () => commit(a2.value.trim() === "" ? void 0 : a2.value);
      return [a2];
    }
    if (["string", "effect"].includes(t)) {
      const i = el("input", { type: "text", value: value ?? "", placeholder: field.default ?? "", spellcheck: false });
      i.onchange = () => commit(i.value === "" ? void 0 : i.value);
      return [i, ...datalist(i, choices(field, ctx).map((v) => ({ value: v })))];
    }
    if (t === "list" && field.of?.type === "opening") {
      const openings = Array.isArray(ctx.data?.openings) ? ctx.data.openings : [], v = Array.isArray(value) ? value : [];
      return [el("span", { className: "checks" }, openings.map((o, k) => {
        const c = el("input", { type: "checkbox", checked: v.includes(k) });
        c.onchange = () => commit(openings.map((_, j) => j).filter((j) => j === k ? c.checked : v.includes(j)));
        return el("label", { title: o?.shutter || "" }, c, `${k}: ${o?.wall} wall${o?.room ? `, ${o.room}` : ""}`);
      }))];
    }
    if (t === "list" && field.of?.type === "furniture") {
      const names = choices(field.of, ctx), v = Array.isArray(value) ? value : [];
      return [el("span", { className: "checks" }, names.map((name) => {
        const c = el("input", { type: "checkbox", checked: v.includes(name) });
        c.onchange = () => commit(names.filter((n2) => n2 === name ? c.checked : v.includes(n2)));
        return el("label", {}, c, name);
      }))];
    }
    const a = el("textarea", { value: flow(value), rows: 1, spellcheck: false, placeholder: "YAML" });
    a.rows = Math.min(6, Math.max(1, Math.ceil(a.value.length / 38)));
    a.onchange = () => {
      if (a.value.trim() === "") return commit(void 0);
      try {
        commit(browser_default.parse(a.value));
        a.classList.remove("bad");
      } catch (e) {
        a.classList.add("bad");
        a.title = e.message;
      }
    };
    return [a];
  }
  function insidesField(label, value, path, ctx) {
    const add = el("button", { type: "button", className: "clear", textContent: "+", title: "Add a shape on it" });
    add.onclick = () => ctx.add({ path, add: "extra" });
    const enter = el("button", { type: "button", className: "clear", textContent: "Edit", title: "Edit its insides on the plan (double-click it, or Enter)" });
    enter.onclick = () => ctx.enter(path[1]);
    const links = (value || []).map((s, i) => {
      const a = el("button", { type: "button", className: "link", textContent: shapeLabel(s), title: "Select it" });
      a.onclick = () => ctx.select([...path, i]);
      return a;
    });
    return el(
      "fieldset",
      {},
      el("legend", {}, label, add, enter),
      links.length ? el("div", { className: "links" }, links) : el("p", { className: "note", textContent: "Nothing on it yet" })
    );
  }
  function regionForm(value, path, ctx) {
    const RECT2 = { type: "numbers", labels: ["x", "y", "w", "h"], unit: "u", help: "A rectangle [x, y, w, h]" };
    const POLY = { type: "points", unit: "u", help: "A polygon [[x, y], ...]" };
    if (path.length === 3) return [row(Array.isArray(value?.[0]) ? "poly" : "rect", Array.isArray(value?.[0]) ? POLY : RECT2, value, path, ctx)];
    if (Array.isArray(value?.[0]?.[0])) {
      return [
        el("p", { className: "help", textContent: "A polygon room: drag its corners on the plan (the middle of a side adds one)." }),
        row("poly", POLY, value[0], [...path, 0], ctx)
      ];
    }
    const add = el("button", { type: "button", className: "clear", textContent: "+", title: "Add a rectangle to it (next to its last one)" });
    add.onclick = () => ctx.add({ path, add: "rect" });
    const links = (Array.isArray(value) ? value : []).map((q, i) => {
      const a = el("button", { type: "button", className: "link", textContent: rectLabel(q), title: "Select it (or double-click it on the plan)" });
      a.onclick = () => ctx.select([...path, i]);
      return a;
    });
    return [
      el("p", { className: "help", textContent: "Light stays inside its room: one or more rectangles (they may overlap)." }),
      el(
        "fieldset",
        {},
        el("legend", {}, el("span", { className: "key", textContent: "rectangles" }), add),
        links.length ? el("div", { className: "links" }, links) : el("p", { className: "note", textContent: "None" })
      )
    ];
  }
  function itemLinks(label, value, path, ctx) {
    const group = itemGroups(ctx.data).find((g) => samePath(g.path, path));
    const add = el("button", { type: "button", className: "clear", textContent: "+", title: `Add to ${group.title.toLowerCase()}` });
    add.onclick = () => ctx.add(group);
    const links = group.items.map((it) => {
      const a = el("button", { type: "button", className: "link", textContent: it.label, title: it.title || "Select it" });
      a.onclick = () => ctx.select(it.path);
      return a;
    });
    return el("fieldset", {}, el("legend", {}, label, add), links.length ? el("div", { className: "links" }, links) : el("p", { className: "note", textContent: "None" }));
  }
  function row(key, field, value, path, ctx) {
    const label = el("span", { className: "key", textContent: key, title: field.help + (field.required ? " (required)" : "") });
    if (field.required) label.classList.add("required");
    if (path.length === 3 && path[0] === "furniture" && key === "extra" && typeof value !== "string") return insidesField(label, value, path, ctx);
    if (path.length === 2 && path[0] === "sun" && (key === "spill" || key === "blockers") && (value === void 0 || Array.isArray(value))) {
      return itemLinks(label, value, path, ctx);
    }
    if (field.type === "object") {
      if (value === void 0) {
        const add = el("button", { type: "button", className: "add-field", textContent: `+ ${key}`, title: field.help });
        add.onclick = () => ctx.commit(path, ctx.template?.(path) ?? {});
        return el("div", { className: "row absent" }, add);
      }
      const remove = !field.required && el("button", { type: "button", className: "clear", textContent: "\xD7", title: `Leave ${key} out` });
      if (remove) remove.onclick = () => ctx.commit(path, void 0);
      const preview = path[0] === "markers" && path.length === 3 && key === "label" && labelLine(markerOf(path, ctx), ctx.states);
      return el("fieldset", {}, el("legend", {}, label, remove), fields(field, value, path, ctx), preview);
    }
    const r = el("label", { className: "row" }, label, el("span", { className: "value" }, input(field, value, path, ctx)));
    r.dataset.path = pathKey(path);
    return r;
  }
  function fields(field, value, path, ctx) {
    const v = value && typeof value === "object" ? value : {};
    const out = [];
    for (const [key, f] of Object.entries(field.fields)) {
      if (f.when && !Object.entries(f.when).every(([k, vals]) => vals.includes(v[k]))) continue;
      out.push(row(key, f, v[key], [...path, key], ctx));
    }
    return out;
  }
  function shapeForm(value, path, ctx) {
    const v = value && typeof value === "object" ? value : {};
    const kind = SHAPE_KINDS.find((k) => v[k] !== void 0) || "rect";
    const select = el("select", {}, SHAPE_KINDS.map((k) => el("option", { value: k, textContent: k, selected: k === kind })));
    select.onchange = () => ctx.commit(path, { ...ctx.shapeTemplate(select.value, v), ...Object.fromEntries(Object.entries(v).filter(([k]) => !SHAPE_KINDS.includes(k) && k !== "at")) });
    const own = SHAPE_KINDS.filter((k) => k !== kind).concat(kind === "text" ? [] : ["at"]);
    const out = [el("label", { className: "row" }, el("span", { className: "key", textContent: "kind" }), el("span", { className: "value" }, select))];
    for (const [key, f] of Object.entries(fieldAt(path).fields)) {
      if (own.includes(key)) continue;
      if (["rx", "repeat"].includes(key) && v[key] === void 0 && !(key === "rx" && kind === "rect")) continue;
      out.push(row(key, f, v[key], [...path, key], ctx));
    }
    for (const key of Object.keys(v)) {
      if (fieldAt(path).fields[key]) continue;
      out.push(row(key, fieldAt([...path, key]), v[key], [...path, key], ctx));
    }
    const name = el("input", { type: "text", placeholder: "another attribute (fill, opacity\u2026)", spellcheck: false });
    name.onchange = () => {
      if (name.value) ctx.commit([...path, name.value.trim().replace(/-/g, "_")], "");
    };
    out.push(el("div", { className: "row" }, name));
    return out;
  }
  function renderProperties(box2, data, selected, ctx) {
    const focused = box2.querySelector(":focus")?.closest("[data-path]")?.dataset.path;
    box2.textContent = "";
    const d = data && typeof data === "object" ? data : {};
    if (!selected) {
      box2.append(el("h2", { textContent: "The home" }));
      box2.append(row("description", SCHEMA.fields.description, d.description, ["description"], ctx));
      for (const key of ["view", "units_per_metre", "sun"]) box2.append(row(key, SCHEMA.fields[key], d[key], [key], ctx));
      box2.append(row("background", SCHEMA.fields.drawing.fields.background, d.drawing?.background, ["drawing", "background"], ctx));
      const lights = [...new Set((d.lights || []).map((g) => g?.entities?.[0]).filter(Boolean))];
      box2.append(el(
        "fieldset",
        {},
        el("legend", {}, el("span", { className: "key", textContent: "effects", title: SCHEMA.fields.effects.help })),
        effectsEditor(d.effects, { commit: (v) => ctx.commit(["effects"], v), preview: ctx.previewEffect, previewing: ctx.previewing, lights })
      ));
      for (const key of ["palette", "simulator"]) {
        const f = SCHEMA.fields[key];
        box2.append(row(key, { type: "yaml", help: f.help }, d[key], [key], ctx));
      }
    } else {
      const value = selected.reduce((o, k) => o?.[k], d), field = fieldAt(selected);
      const extra = selected.length === 4 && selected[0] === "furniture" && selected[2] === "extra";
      const group = itemGroups(d).find((g) => samePath(g.path, selected.slice(0, -1)));
      const title = el("h2", { textContent: group ? `${group.title}: ` : "" });
      if (extra) {
        const back = el("button", { type: "button", className: "link", textContent: selected[1], title: `Back to ${selected[1]} (Esc)` });
        back.onclick = () => ctx.select(selected.slice(0, 2));
        title.append(back, ` \u203A ${shapeLabel(value)}`);
      } else if (selected.length === 3 && selected[0] === "rooms") {
        const back = el("button", { type: "button", className: "link", textContent: selected[1], title: `Back to ${selected[1]}` });
        back.onclick = () => ctx.select(selected.slice(0, 2));
        title.append(back, Array.isArray(value?.[0]) ? " \u203A polygon" : ` \u203A rectangle ${selected[2] + 1}`);
      } else if (selected.length === 2 && (selected[0] === "furniture" || selected[0] === "rooms")) {
        const name = el("input", { type: "text", value: selected.at(-1), className: "name", spellcheck: false, title: "Rename (its references follow)" });
        name.onchange = () => {
          if (name.value && name.value !== selected.at(-1)) ctx.rename(selected, name.value.trim());
        };
        title.append(name);
      } else title.append(group?.items.find((it) => samePath(it.path, selected))?.label ?? selected.join("."));
      const del = el("button", { type: "button", className: "delete", textContent: "Delete", title: "Delete it (Delete)" });
      del.onclick = () => ctx.remove(selected);
      const dup = el("button", { type: "button", textContent: "Duplicate", title: "A copy of it, a little down and to the right (Ctrl+D)" });
      dup.onclick = () => ctx.duplicate();
      box2.append(el("div", { className: "title" }, title, dup, del));
      if (field?.help) box2.append(el("p", { className: "help", textContent: field.help }));
      if (value === void 0) box2.append(el("p", { textContent: "Not in the home any more." }));
      else if (selected[0] === "rooms") box2.append(...regionForm(value, selected, ctx));
      else if (field?.type === "shape") box2.append(...shapeForm(value, selected, ctx));
      else if (field?.type === "object") box2.append(...fields(field, value, selected, ctx));
      else if (field) box2.append(row(String(selected.at(-1)), field, value, selected, ctx));
    }
    if (focused) box2.querySelector(`[data-path='${focused}'] input, [data-path='${focused}'] select, [data-path='${focused}'] textarea`)?.focus({ preventScroll: true });
  }

  // src/editor/editor.js
  var DRAFT = "lightwell-editor:draft";
  var TYPING = 250;
  var REACH = 6;
  var CLICKS = 500;
  var DRAG = 4;
  var HANDLE = 8;
  var TURN_STEP = 15;
  var GRID = 0.05;
  var HINTS = {
    select: "Click to select (again, or Tab: what's under it; Shift+click: more), drag on empty space for a box \xB7 drag to move, Ctrl (\u2318)+drag a piece to turn it \xB7 in Build, double-click something to change its parts, or a room's name to rename it \xB7 the handles to resize, turn or reshape (double-click a corner removes it; Alt: a piece's insides stay) \xB7 Shift: along an axis, Alt: no snapping \xB7 arrows nudge (Shift: \xD710) \xB7 Ctrl+D duplicates \xB7 double-click a piece (or Enter) to edit its insides \xB7 with a lamp selected, Ctrl+click a piece to add it to its shadows or take it out \xB7 Alt+click taps the card \xB7 Esc clears",
    wall: "Drag a wall's box, or along its middle for a wall of the usual thickness (25 cm outside, 15 cm inside a room) \xB7 Esc: back to selecting",
    room: "Drag a rectangle, or click its corners for a polygon (click the first again, double-click or Enter to finish; Backspace takes the last back) \xB7 Esc: back to selecting",
    opening: "Drag along an outer wall, from one end of the window or door to the other: its side and thickness come from the wall \xB7 Esc: back to selecting",
    piece: "Drag a rectangle, from the middle out for a circle, or click corners for a polygon (choose in the details); a click places a piece of the usual size \xB7 Esc: back to selecting",
    light: "Click where the lamp is, or drag out its glow's size: its pool and shadows come with it \xB7 Esc: back to selecting",
    marker: "Click where the marker goes \xB7 Esc: back to selecting",
    label: "Click where the label goes (its middle) \xB7 Esc: back to selecting",
    scale: "Drag along something whose length you know (a wall, a door), then type its length to set the scale; or just measure \xB7 Esc: back to selecting",
    // The Build view's.
    "build-room": "Drag a room's rectangle: its walls, floor and name come with it. Drawn against another room's wall, it shares it \xB7 click a room to select it, double-click it to rename it \xB7 Esc: back to selecting",
    "build-piece": "Choose a piece, then Shift+click where it goes (or drag it onto the plan) \xB7 R turns it \xB7 click a piece to select it, drag to move it, R or Ctrl (\u2318)+drag turns it \xB7 Esc: back to selecting",
    "build-device": "Choose a lamp or device, then Shift+click where it is (or drag it onto the plan); a blind dropped on a window is its shutter \xB7 click one to select it, drag to move it \xB7 Esc: back to selecting",
    "build-north": "Click on the plan in the direction of north (or type its bearing in the details) \xB7 Esc: back to selecting",
    "build-cut": "Click on a wall for a window or a door of the width in the details, or drag along the wall for its width; in a wall between rooms, a doorway \xB7 drag the end of one to resize it \xB7 Esc: back to selecting"
  };
  var BUILD_HELP = {
    select: "Build your home step by step with the tools by the plan: rooms first, then windows and doors, furniture, lamps. Click anything to select it, drag to move it, double-click it to change its parts. Anything finer is in the Edit view.",
    "build-room": "Name the room here (or leave it without a name: no label then; double-click it later to name it), then drag its rectangle. Start with the rooms indoors; a terrace or a balcony is a room outdoors, without walls of its own.",
    "build-piece": "Choose a piece, then Shift+click on the plan where it goes, or drag it there. R (or Turn) turns it a quarter. Each piece has its real size and height: the tall ones cast long shadows. A table comes with its chairs, and moves and turns with them.",
    "build-device": "Your lamps and devices. Choose one, then Shift+click on the plan where it is, or drag it there. A light becomes a lamp that glows in its colour, with a marker that switches it; a blind or shutter dropped on a window darkens it as it closes; a sensor shows its value. Those already on the plan are ticked.",
    "build-north": "Which way is north? Click on the plan in its direction, or type the bearing the top of the plan faces (0: north is up). It sets where the sun comes in: a map of your building gives it best; a phone compass can be far off indoors.",
    "build-cut": "Choose a window, a glass door or a door, then click on a wall (for the width here) or drag along it (for its own width). Drag the end of a window, door or doorway to make it wider or narrower: its wall, glass and opening follow. Windows and glass doors let the sun in; in a wall between two rooms you always get a doorway."
  };
  var INSIDE_HINTS = {
    select: "Inside {name}: click its shapes to select them (again, or Tab: what's under it; Shift+click: more), drag on its empty space for a box \xB7 drag to move, the handles to resize \xB7 Shift: along an axis, Alt: no snapping \xB7 arrows nudge \xB7 Ctrl+D duplicates \xB7 Esc or a click outside it leaves",
    piece: "Inside {name}: drag a rectangle (a cushion, a device), a circle from its middle, or a line (choose in the details); a click places a small one \xB7 Esc: back to selecting",
    label: "Inside {name}: click where the label goes \xB7 Esc: back to selecting",
    scale: HINTS.scale
  };
  var GROUP_HINT = "Inside {name}: click its parts to select them (again, or Tab: what's under it; Shift+click: more) \xB7 drag to move one, the handles to resize \xB7 arrows nudge \xB7 Esc or a click outside leaves";
  var TOOL_KEYS = { v: "select", w: "wall", r: "room", o: "opening", f: "piece", l: "light", m: "marker", t: "label", s: "scale" };
  var ICONS2 = {
    select: '<path d="M6 3.5 18 13l-5.6.8 3.2 6.2-2.4 1.2-3.2-6.3L6 18.6z"/>',
    rooms: '<path d="M3.5 4.5h17v15h-17zM12 4.5v8M12 16v3.5M12 12.5h3"/>',
    openings: '<path d="M2.5 9.5h6v5h-6zM15.5 9.5h6v5h-6zM8.5 12h7"/>',
    furniture: '<path d="M4 10.5V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M3 11.5a1.5 1.5 0 0 1 3 0V14h12v-2.5a1.5 1.5 0 0 1 3 0V17H3zM5 17v2M19 17v2"/>',
    entities: '<path d="M9 17.5h6M10 20.5h4M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.3-1 2v1h-5v-1c0-.7-.4-1.5-1-2z"/>',
    wall: '<path d="M3 8.5h18v7H3z"/>',
    room: '<path d="M4 4.5h10l6 6v9H4z"/>',
    opening: '<path d="M2.5 9.5h6v5h-6zM15.5 9.5h6v5h-6zM8.5 10.5h7M8.5 13.5h7"/>',
    piece: '<path d="M5 6.5h14v11H5zM8 9.5h8"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    marker: '<circle cx="12" cy="10" r="3"/><path d="M12 21.5s-6.5-6.2-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11.5-6.5 11.5z"/>',
    label: '<path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6"/>',
    scale: '<path d="M3 15.5 15.5 3 21 8.5 8.5 21zM7 14.5l1.5 1.5M10 11.5l2 2M13 8.5l1.5 1.5"/>'
  };
  var TOOLS = [
    ["select", "select", "Select and move (V)", ""],
    ["build-room", "rooms", "Rooms: drag one, its walls come with it", "build-only"],
    ["build-cut", "openings", "Windows and doors: click on a wall", "build-only"],
    ["build-piece", "furniture", "Furniture from the catalogue", "build-only"],
    ["build-device", "entities", "Lamps and devices from Home Assistant", "build-only"],
    ["wall", "wall", "Walls (W)", "edit-only"],
    ["room", "room", "Rooms (R)", "edit-only"],
    ["opening", "opening", "Windows and doors (O)", "edit-only"],
    ["piece", "piece", "Furniture (F)", "edit-only"],
    ["light", "light", "Lamps (L)", "edit-only"],
    ["marker", "marker", "Markers (M)", "edit-only"],
    ["label", "label", "Labels (T)", "edit-only"],
    ["scale", "scale", "Measure, or set the scale from a known length (S)", "edit-only"]
  ];
  var TOOLBAR = `<div class="lw-tools" role="toolbar" aria-label="Tools">${TOOLS.map(([tool, icon, title, cls]) => `<button type="button" data-tool="${tool}" class="${cls}" title="${title}" aria-label="${title}"><svg viewBox="0 0 24 24">${ICONS2[icon]}</svg></button>`).join("")}</div>`;
  var TOOLBAR_SIDE = 44;
  var TOOLBAR_GAP = 8;
  var OVERLAY_STYLE = `
  .lw-edit { position: absolute; inset: 0; pointer-events: none; outline: none; --accent: var(--primary-color, #1e88e5); }
  .lw-edit > * { pointer-events: auto; } .lw-edit > .ruler { pointer-events: none; }
  .overlay { position: absolute; left: 0; top: 0; cursor: default; overflow: visible; }
  .overlay * { pointer-events: none; fill: none; vector-effect: non-scaling-stroke; }
  .overlay .hover * { stroke: rgba(30, 136, 229, 0.6); stroke-width: 1.5; }
  .overlay .sel * { stroke: var(--accent); stroke-width: 2.5; fill: rgba(30, 136, 229, 0.12); }
  .overlay .sel .pool { fill: none; stroke-dasharray: 6 5; stroke-width: 1.5; }
  .overlay .sel .dot { fill: var(--accent); }
  .overlay .handles * { fill: #fff; stroke: var(--accent); stroke-width: 1.5; }
  .overlay .handles .mid { fill: var(--accent); fill-opacity: 0.35; stroke-opacity: 0.6; }
  .overlay .handles .turn { fill: var(--accent); }
  .overlay .guides * { stroke: #d81b60; stroke-width: 1; stroke-dasharray: 4 3; }
  .overlay .box { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 4 3; fill: rgba(30, 136, 229, 0.08); }
  .overlay .grid .minor { stroke: rgba(30, 136, 229, 0.12); stroke-width: 0.5; }
  .overlay .grid .major { stroke: rgba(30, 136, 229, 0.3); stroke-width: 0.75; }
  .overlay .draft * { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 5 3; fill: rgba(30, 136, 229, 0.15); }
  .overlay .draft circle.point { fill: var(--accent); stroke: none; }
  .overlay .shadows * { stroke: #ef6c00; stroke-width: 1.5; stroke-dasharray: 3 3; }
  .overlay .inside .dim { fill: rgba(246, 246, 244, 0.6); fill-rule: evenodd; stroke: none; }
  .preview.dark .overlay .inside .dim, :host([dark]) .lw-edit .overlay .inside .dim { fill: rgba(17, 17, 17, 0.6); }
  .overlay .inside .piece, .overlay .inside .group * { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 6 4; fill: none; }
  .overlay .inside mask > rect { fill: #fff; } .overlay .inside mask .hole * { fill: #000; stroke: #000; stroke-width: 6; }
  .overlay .inside .pool { display: none; }
  .preview.dark .overlay .inside .dim.all, :host([dark]) .lw-edit .overlay .inside .dim.all { fill: rgba(17, 17, 17, 0.6); }
  .overlay.drawing { cursor: crosshair !important; }
  .overlay.drawing.grab { cursor: move !important; }
  .overlay.drawing.grab-x { cursor: ew-resize !important; } .overlay.drawing.grab-y { cursor: ns-resize !important; }
  .ruler { position: absolute; pointer-events: none; padding: 2px 6px; border-radius: 4px; background: rgba(0, 0, 0, 0.75);
    color: #fff; font: 12px ui-monospace, Menlo, Consolas, monospace; white-space: pre; }
  .ruler:empty { display: none; }
  .overlay .draft rect.cut { fill: var(--accent); fill-opacity: 0.5; stroke: none; }
  input.name-edit { position: absolute; transform: translate(-50%, -50%); z-index: 3; font: 600 16px system-ui, sans-serif;
    text-align: center; padding: 4px 8px; border: 2px solid var(--accent); border-radius: 6px; background: var(--lw-panel);
    color: var(--lw-text); min-width: 8em; }
  .overlay .draft rect.cut.grab { fill-opacity: 0.9; }
  .overlay .draft .north * { stroke: #d81b60; stroke-width: 3; fill: none; }
  .lw-tools { position: absolute; z-index: 4; display: flex; gap: 2px; padding: 3px; border: 1px solid var(--divider-color, #ddd);
    border-radius: 10px; background: var(--card-background-color, #fff); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); box-sizing: border-box; }
  .lw-tools.beside { right: 100%; top: 0; margin-right: ${TOOLBAR_GAP}px; flex-direction: column; width: ${TOOLBAR_SIDE}px; }
  .lw-tools:not(.beside) { bottom: 100%; left: 0; margin-bottom: ${TOOLBAR_GAP}px; }
  .lw-tools button { width: 36px; height: 36px; padding: 0; border: 0; border-radius: 7px; background: none; display: grid; place-items: center;
    color: var(--primary-text-color, #333); cursor: pointer; }
  .lw-tools button:hover:not(:disabled) { background: rgba(127, 127, 127, 0.16); }
  .lw-tools button[aria-pressed="true"] { background: var(--primary-color, #1e88e5); color: var(--text-primary-color, #fff); }
  .lw-tools button:disabled { opacity: 0.35; cursor: default; }
  .lw-tools svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .lw-tools[data-shows=build] .edit-only, .lw-tools[data-shows=edit] .build-only { display: none; }
  .overlay .draft .north text { fill: #d81b60; stroke: none; font: bold 28px sans-serif; text-anchor: middle; vector-effect: none; }
`;
  var STYLE2 = `${OVERLAY_STYLE}
  :host { display: grid; grid-template-rows: auto 1fr auto; height: 100%; font: 14px system-ui, sans-serif;
    --lw-bg: #f6f6f4; --lw-panel: #fff; --lw-text: #222; --lw-muted: #666; --lw-faint: #888; --lw-line: #ddd;
    --lw-border: #ccc; --lw-button: #fafafa; --lw-button-hover: #eee; --lw-accent: #1e88e5; --lw-row-hover: #f2f6fb;
    --lw-row-on: #e3f0fc; --lw-error: #b00020; --lw-error-bg: #fff3f3;
    color: var(--lw-text); background: var(--lw-bg); --line: var(--lw-line); --accent: var(--lw-accent); }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; background: var(--lw-panel);
    border-bottom: 1px solid var(--line); }
  header h1 { font-size: 15px; margin: 0 10px 0 0; }
  header .name { color: var(--lw-muted); margin-right: auto; }
  header .name.unsaved::after { content: ' \u2022'; color: #e65100; }
  header .ha::before { content: '\u25CF '; color: var(--lw-faint); } header .ha.on::before { color: #2e7d32; } header .ha.off::before { color: #e65100; }
  dialog.ha input[name=url] { width: 100%; box-sizing: border-box; font: inherit; padding: 4px 6px; margin: 4px 0 8px; }
  dialog.ha .why { color: var(--lw-error); } dialog.ha .status { color: var(--lw-muted); }
  button { font: inherit; padding: 4px 10px; border: 1px solid var(--lw-border); border-radius: 6px; background: var(--lw-button);
    color: inherit; cursor: pointer; }
  button:hover:not(:disabled) { background: var(--lw-button-hover); } button:disabled { opacity: 0.45; cursor: default; }
  button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
  main { display: grid; grid-template-columns: 300px minmax(320px, 1fr) minmax(320px, 0.75fr); min-height: 0; }
  main > * { min-height: 0; }
  .side { display: flex; flex-direction: column; background: var(--lw-panel); min-height: 0; }
  .side.left { border-right: 1px solid var(--line); } .side.right { border-left: 1px solid var(--line); }
  .tabs { display: flex; border-bottom: 1px solid var(--line); flex: none; }
  .tabs button { flex: 1; border: 0; border-radius: 0; background: none; padding: 8px; color: var(--lw-muted); }
  .tabs button[aria-selected="true"] { color: var(--lw-text); box-shadow: inset 0 -2px var(--accent); }
  .pane { flex: 1; overflow: auto; min-height: 0; } .pane[hidden] { display: none; }
  .controls { padding: 12px; } .controls form { width: auto; }
  .preview { padding: 16px; display: flex; justify-content: center; align-items: flex-start; overflow: auto; outline: none; }
  .preview.dark { background: #111; } .preview.dark .hint { color: #bbb; }
  .stage { position: relative; width: 100%; max-width: 900px; }
  ha-card { display: block; border-radius: 12px; background: var(--card-background-color, #fff); }
  .preview.dark ha-card { --card-background-color: #1c1c1c; }
  .stage.beside { margin-left: ${TOOLBAR_SIDE + TOOLBAR_GAP}px; width: calc(100% - ${TOOLBAR_SIDE + TOOLBAR_GAP}px); }
  .stage:not(.beside) { margin-top: 50px; }
  dialog { border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; max-width: 460px; font: 14px system-ui, sans-serif;
    background: var(--lw-panel); color: var(--lw-text); }
  .props .back { margin: 0 0 8px; }
  .props details.multi { border-bottom: 1px solid var(--lw-line); }
  .props details.multi > summary { cursor: pointer; padding: 7px 2px; font-weight: 600; }
  .props details.multi > .body { padding: 0 0 10px 14px; }
  .props .title .grow { flex: 1; }
  dialog h2 { margin: 0 0 12px; font-size: 16px; }
  dialog .choice { display: grid; gap: 4px; margin: 0 0 14px; }
  dialog .choice p { margin: 0; color: var(--lw-muted); font-size: 13px; }
  dialog input[type=number] { width: 5em; font: inherit; }
  dialog .end { text-align: right; }
  .preview:focus-visible .stage { outline: 2px solid rgba(30, 136, 229, 0.4); outline-offset: 4px; border-radius: 12px; }
  .hint { color: var(--lw-faint); font-size: 12px; margin: 8px 0 0; text-align: center; }
  .text { display: flex; height: 100%; }
  .text textarea { flex: 1; border: 0; padding: 10px 12px; resize: none; tab-size: 2; white-space: pre; outline: none;
    font: 12.5px/1.5 ui-monospace, Menlo, Consolas, monospace; background: var(--lw-panel); color: var(--lw-text); }
  /* The list */
  .list { padding: 6px 0 12px; font-size: 13px; }
  .list summary { display: flex; align-items: center; gap: 6px; padding: 5px 10px; cursor: pointer; font-weight: 600; }
  .list .loose { margin: 12px 10px 2px; padding-top: 8px; border-top: 1px solid var(--lw-line); color: var(--lw-muted);
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .list summary small { color: var(--lw-faint); font-weight: normal; margin-right: auto; }
  .list summary .add { padding: 0 7px; line-height: 18px; font-weight: normal; }
  .items { list-style: none; margin: 0; padding: 0; }
  .item { padding: 3px 10px 3px 24px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item.home { padding-left: 10px; font-weight: 600; }
  .item:hover { background: var(--lw-row-hover); } .item.on { background: var(--lw-row-on); box-shadow: inset 3px 0 var(--accent); }
  .item.drop { box-shadow: inset 0 2px var(--accent); }
  .item.extra { padding-left: 40px; color: var(--lw-muted); } .item.in { font-weight: 600; }
  .item .fold { display: inline-block; width: 14px; margin-left: -14px; color: var(--lw-faint); }
  .item { position: relative; }
  .item .add-child { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 0 6px; line-height: 16px;
    font-size: 12px; visibility: hidden; }
  .item:hover .add-child, .item.on .add-child, .item .add-child:focus-visible { visibility: visible; }
  .props button.link { border: 0; background: none; padding: 0 2px; color: var(--accent); font: inherit; }
  .props button.link:hover { text-decoration: underline; background: none; }
  .props .links { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  /* The properties */
  .props { padding: 10px 12px 16px; font-size: 13px; }
  .props .title { display: flex; align-items: center; gap: 8px; }
  .props h2 { font-size: 14px; margin: 4px 0; flex: 1; display: flex; align-items: center; gap: 4px; min-width: 0; }
  .props h2 input.name { font: inherit; flex: 1; min-width: 0; }
  .props .help { color: var(--lw-muted); margin: 2px 0 8px; }
  .props .row { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 8px; margin: 3px 0; }
  .props .row.absent { display: block; }
  .props .key { color: var(--lw-muted); overflow: hidden; text-overflow: ellipsis; } .props .key.required::after { content: ' *'; color: var(--lw-error); }
  .props .value { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .props input[type=text], .props input[type=number], .props select, .props textarea { font: inherit; padding: 3px 5px;
    border: 1px solid var(--lw-border); border-radius: 4px; min-width: 0; flex: 1; background: var(--lw-panel); color: inherit; }
  .props textarea { font: 12px ui-monospace, Menlo, Consolas, monospace; resize: vertical; }
  .props textarea.bad { border-color: var(--lw-error); } .props textarea.prose { font: inherit; }
  .props .numbers { display: flex; gap: 4px; flex: 1; min-width: 0; }
  .props .numbers label { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .props .numbers small { color: var(--lw-faint); font-size: 10px; }
  .props .checks { display: flex; flex-wrap: wrap; gap: 2px 10px; }
  .props .unit { color: var(--lw-faint); min-width: 1em; }
  .props .swatch { width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--lw-border); flex: none; }
  .props fieldset { border: 1px solid var(--lw-line); border-radius: 6px; margin: 8px 0; padding: 4px 8px 6px; }
  .props legend { display: flex; align-items: center; gap: 6px; padding: 0 4px; }
  .props button.clear { padding: 0 6px; line-height: 16px; }
  .props button.add-field { margin: 4px 0; font-size: 12px; padding: 2px 8px; }
  .props button.delete { color: var(--lw-error); }
  .props .stack { display: flex; flex-direction: column; flex: 1; min-width: 0; position: relative; }
  .props .note { color: var(--lw-faint); font-size: 11px; min-height: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .props .entities { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .props .icon { width: 20px; height: 20px; flex: none; background: var(--lw-muted); -webkit-mask: var(--icon) center/contain no-repeat;
    mask: var(--icon) center/contain no-repeat; }
  .props .found { position: absolute; top: 100%; left: 0; right: 0; z-index: 2; max-height: 260px; overflow: auto; background: var(--lw-panel);
    border: 1px solid var(--lw-border); border-radius: 6px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15); display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .props .found[hidden] { display: none; }
  .props .found button { display: flex; align-items: center; gap: 6px; border: 0; border-radius: 0; background: none; padding: 4px 6px;
    font-size: 12px; text-align: left; overflow: hidden; }
  .props .found button span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .props .label-now { margin: 6px 0 2px; } .props .label-now.none { color: var(--lw-faint); }
  .props .step { margin: 2px 0; } .props .step input[type=number] { flex: 1; min-width: 3em; }
  .props .step input[type=color] { width: 36px; height: 24px; padding: 0 2px; flex: none; }
  footer { max-height: 30vh; overflow: auto; border-top: 1px solid var(--line); background: var(--lw-panel); }
  footer:empty { display: none; }
  footer p { margin: 0; padding: 4px 12px; font: 12.5px ui-monospace, Menlo, Consolas, monospace; color: var(--lw-error); }
  footer p.link { cursor: pointer; } footer p.link:hover { background: var(--lw-error-bg); }
  footer p.info { color: var(--lw-muted); font-family: inherit; }
  .drop { position: absolute; inset: 0; display: none; place-items: center; background: rgba(30, 136, 229, 0.12);
    border: 3px dashed var(--accent); font-size: 18px; pointer-events: none; }
  :host(.dragging) .drop { display: grid; }
  @media (max-width: 1000px) {
    main { grid-template-columns: 1fr; grid-auto-rows: auto; overflow: auto; }
    .pane { overflow: visible; }
    .text textarea { min-height: 50vh; }
  }
  /* The views: Build's tools and tab, or Edit's. */
  header .views { display: inline-flex; margin-right: 8px; }
  header .views button { border-radius: 0; } header .views button:first-child { border-radius: 6px 0 0 6px; }
  header .views button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
  :host(:not([view=build])) .build-only, :host([view=build]) .edit-only { display: none; }
  .preview > div { width: 100%; max-width: 900px; }
  .props .options { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin: 4px 0 10px; }
  .props .options select, .props .options input[type=number], .props .options input[type=text] { flex: none; }
  .props .muted { color: var(--lw-muted); }
  .props h3 { font-size: 11px; margin: 10px 0 4px; color: var(--lw-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .catalogue { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 4px; }
  .catalogue button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; font-size: 11px;
    line-height: 1.2; text-align: center; cursor: grab; }
  .catalogue button[aria-pressed="true"] { background: var(--lw-row-on); color: inherit; border-color: var(--accent); }
  .catalogue svg { width: 48px; height: 30px; overflow: visible; }
  .catalogue svg * { stroke: #77704a; stroke-width: 0.02; fill: #fbf6d6; }
  .catalogue svg .furn2 { fill: #e4dba2; } .catalogue svg .dev { fill: #3a3a3a; stroke: none; }
  .catalogue svg .fix2 { fill: #b5b5b5; } .catalogue svg .line { fill: none; }
  .catalogue svg .glow { fill: #ffd54f; stroke: none; opacity: 0.8; } .catalogue svg .glow-line { stroke: #ffb300; fill: none; stroke-width: 0.25; stroke-linecap: round; }
  .props .adopt { background: var(--lw-row-on); padding: 6px 8px; border-radius: 6px; } .props .adopt button { margin-left: 4px; }
  .props .lamp { display: flex; align-items: center; gap: 8px; } .props .lamp select { font: inherit; flex: 1; min-width: 0; width: 0; }
  .props select { max-width: 100%; } .side { min-width: 0; }
  .props input[type=search] { width: 100%; box-sizing: border-box; font: inherit; padding: 4px 8px; margin-bottom: 8px;
    border: 1px solid var(--lw-border); border-radius: 6px; background: var(--lw-panel); color: inherit; }
  .devices { display: flex; flex-direction: column; gap: 2px; }
  .devices button { display: flex; align-items: center; gap: 8px; border: 0; border-radius: 4px; background: none; text-align: left;
    padding: 4px 6px; cursor: grab; --mdc-icon-size: 18px; }
  .devices button:hover { background: var(--lw-row-hover); } .devices button[aria-pressed="true"] { background: var(--lw-row-on); color: inherit; }
  .devices .dn { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .devices .tick { color: var(--accent); }
  /* The HA shell: Home Assistant's theme, light or dark, and a layout for its card editor's dialog (half of it, beside
     HA's preview): the plan on top, then one row of tabs for the list, the properties, the YAML and the sun. */
  :host([shell=ha]) { height: auto; grid-template-rows: auto auto auto;
    font-family: var(--mdc-typography-font-family, var(--ha-font-family-body, Roboto, system-ui, sans-serif));
    --lw-bg: transparent; --lw-panel: var(--card-background-color, #fff); --lw-text: var(--primary-text-color, #222);
    --lw-muted: var(--secondary-text-color, #666); --lw-faint: var(--disabled-text-color, #888);
    --lw-line: var(--divider-color, #ddd); --lw-border: var(--divider-color, #ccc);
    --lw-button: var(--secondary-background-color, #fafafa); --lw-button-hover: var(--divider-color, #eee);
    --lw-accent: var(--primary-color, #1e88e5); --lw-row-hover: var(--secondary-background-color, #f2f6fb);
    --lw-row-on: rgba(var(--rgb-primary-color, 30, 136, 229), 0.18); --lw-error: var(--error-color, #b00020);
    --lw-error-bg: rgba(var(--rgb-error-color, 219, 68, 55), 0.08); }
  :host([shell=ha]) header { background: none; border: 0; padding: 0 0 8px; }
  :host([shell=ha]) header :is(h1, .name, [data-act=open], [data-act=save], [data-act=save-yaml], [data-act=save-json], [data-act=ha]) { display: none; }
  :host([shell=ha]) main { grid-template-columns: minmax(0, 1fr); grid-template-areas: "preview" "left"; overflow: visible;
    border: 1px solid var(--lw-line); border-radius: 8px; }
  :host([shell=ha]) .tabs button { padding: 8px 4px; }
  :host([hosted]) .stage, :host([hosted]) [data-act=dark], :host([hosted]) [data-tab=controls] { display: none; }
  :host([hosted]) .preview { padding: 0; border: 0; }
  :host([shell=ha]) .hint { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; line-clamp: 1; overflow: hidden; }
  :host([shell=ha]) dialog.start .file-only { display: none; }
  header .tip { flex-basis: 100%; margin: 4px 0 0; font-size: 12px; color: var(--lw-muted); }
  header .tip button { padding: 0 6px; line-height: 16px; margin-left: 4px; }
  :host([shell=ha]) .preview { grid-area: preview; padding: 8px; border-bottom: 1px solid var(--lw-line); }
  :host([shell=ha]) .side { background: none; } :host([shell=ha]) .side.left { grid-area: left; border-right: 0; }
  :host([shell=ha]) .side.right { grid-area: right; border-left: 0; }
  :host([shell=ha]) .pane { max-height: 420px; overflow: auto; }
  :host([shell=ha]) .text textarea { min-height: 300px; }
  :host([shell=ha]) footer { background: none; border: 0; max-height: none; }
  .preview:not(.dark) ha-card { --card-background-color: #fff; }
`;
  var HTML = `
  <header>
    <h1>Lightwell editor</h1><span class="views" role="tablist"><button data-view="build" title="Build a home step by step: rooms, windows and doors">Build</button><button data-view="edit" title="Every field and tool">Edit</button></span><span class="name"></span>
    <button data-act="new" title="Start a new home">New\u2026</button>
    <button data-act="open" title="Open a home file (YAML or JSON), or drop one on the page">Open\u2026</button>
    <button data-act="save" title="Save (Ctrl+S)">Save</button>
    <button data-act="save-yaml" title="Save as a YAML file, comments kept">Save as YAML\u2026</button>
    <button data-act="save-json" title="Save as JSON, for the card's home_url">Save as JSON\u2026</button>
    <button data-act="undo" title="Undo (Ctrl+Z)">Undo</button>
    <button data-act="redo" title="Redo (Ctrl+Shift+Z)">Redo</button>
    <button data-act="ha" class="ha" title="Connect to your Home Assistant for its entities and live states">Home Assistant</button>
    <button data-act="grid" aria-pressed="false" title="Show the grid things snap to (Alt while dragging: no snapping)">Grid</button>
    <button data-act="dark" aria-pressed="false" title="Show the card in the dark theme">Dark</button>
  </header>
  <main>
    <div class="side left">
      <div class="tabs" role="tablist"><button data-tab="list" aria-selected="true">Items</button><button data-tab="controls">Sun and time</button></div>
      <div class="pane list" data-pane="list"></div>
      <div class="pane controls" data-pane="controls" hidden><form></form></div>
    </div>
    <div class="preview" tabindex="0">
      <div>
      <div class="stage">${TOOLBAR}<svg class="overlay"><g class="inside"></g><g class="grid"></g><g class="hover"></g><g class="shadows"></g><g class="sel"></g><g class="guides"></g><g class="handles"></g><g class="draft"></g><rect class="box" width="0" height="0"/></svg><div class="ruler"></div></div>
      <p class="hint"></p></div>
    </div>
    <div class="side right">
      <div class="tabs" role="tablist"><button data-tab="props" aria-selected="true">Details</button><button data-tab="text">YAML</button></div>
      <div class="pane props" data-pane="props"></div>
      <div class="pane text" data-pane="text" hidden><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="The home's YAML"></textarea></div>
    </div>
  </main>
  <footer aria-live="polite"></footer>
  <dialog class="ha"><form method="dialog">
    <h2>Home Assistant</h2>
    <p>Connected, the editor shows your entities in its pickers and the card with their live states (and your location's
      sun). You sign in on your Home Assistant's own page; the editor only reads states, and taps on the card still act
      here alone. It keeps Home Assistant's tokens in this browser until you disconnect.</p>
    <p class="status"></p>
    <label>Its address <input name="url" placeholder="https://xxxx.ui.nabu.casa or homeassistant.local:8123" spellcheck="false"></label>
    <p class="why"></p>
    <p class="end"><button value="disconnect" class="disconnect">Disconnect</button> <button value="cancel">Cancel</button>
      <button value="connect" class="connect">Sign in\u2026</button></p>
  </form></dialog>
  <dialog class="start"><form method="dialog">
    <h2>Start a home</h2>
    <div class="choice file-only"><button value="example">The example flat</button><p>A made-up flat with every kind of item, to change into yours.</p></div>
    <div class="choice file-only"><button value="picture">Over a picture of its plan\u2026</button><p>A floor plan image (or drop one on the editor):
      measure a known length on it to set the scale, then trace it. It can stay under the card as its background.</p></div>
    <div class="choice"><button value="empty">Empty</button><p><input type="number" name="w" value="10" min="1" step="any"> \xD7
      <input type="number" name="h" value="8" min="1" step="any"> m, <input type="number" name="scale" value="100" min="1" step="any"> units a metre</p></div>
    <p class="end"><button value="cancel">Cancel</button></p>
  </form></dialog>
  <div class="drop">Drop a home file (YAML or JSON) to open it, or a picture of a plan to start over it</div>
`;
  var storage2 = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(DRAFT));
      } catch {
        return null;
      }
    },
    set(v) {
      try {
        localStorage.setItem(DRAFT, JSON.stringify(v));
      } catch {
      }
    }
  };
  var h = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  var samePath2 = (a, b) => a === b || !!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]);
  var round2 = tidy;
  var byPathDescending = (a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) continue;
      return typeof a[i] === "number" && typeof b[i] === "number" ? b[i] - a[i] : String(b[i]).localeCompare(String(a[i]));
    }
    return b.length - a.length;
  };
  function messagePath(message) {
    const where = message.slice(0, message.indexOf(": "));
    const path = where.split(/\.|(?=\[)/).filter(Boolean).map((k) => /^\[\d+\]$/.test(k) ? +k.slice(1, -1) : k);
    if (isExtra(path.slice(0, 4))) return path.slice(0, 4);
    const depth = path[0] === "drawing" || path[0] === "sun" && ["spill", "blockers"].includes(path[1]) ? 3 : ["furniture", "rooms", "openings", "lights", "markers"].includes(path[0]) ? 2 : 0;
    return depth && path.length >= depth ? path.slice(0, depth) : null;
  }
  var LightwellEditor = class extends HTMLElement {
    constructor() {
      super();
      this.states = {};
      this.location = { latitude: 51.4779, longitude: 0 };
      this.example = "";
    }
    // The home, as plain data (the HA shell's way in and out). Setting one that is the home already does nothing (HA
    // hands each change back); another is a step in the history.
    get value() {
      return this.model ? this.model.data : this._value;
    }
    set value(home) {
      if (!this.model) {
        this._value = home;
        return;
      }
      const json = JSON.stringify(home);
      if (json === JSON.stringify(this.model.data)) return;
      clearTimeout(this._typing);
      this._sent = json;
      if (this.model.setText(yamlOf(home))) this._changed({ text: true });
    }
    // Home Assistant's: its states (at most every 250 ms) and location for the controls and pickers, its theme's
    // darkness for the preview at first.
    set hass(hass) {
      this._hass = hass;
      if (!hass) return;
      if (!this._controls) {
        this.states = hass.states;
        if (hass.config?.latitude !== void 0) this.location = { latitude: hass.config.latitude, longitude: hass.config.longitude };
        return;
      }
      this._hassTimer || (this._hassTimer = setTimeout(() => {
        this._hassTimer = 0;
        const h2 = this._hass, first = this._shown.states !== h2.states && !this._hassSeen;
        this._hassSeen = true;
        this._controls.setStates(h2.states);
        if (!this._located && h2.config?.latitude !== void 0) {
          this._located = true;
          this._controls.setLocation({ latitude: h2.config.latitude, longitude: h2.config.longitude });
        }
        if (first) this._renderPanels();
      }, 250));
    }
    get hass() {
      return this._hass;
    }
    connectedCallback() {
      var _a;
      if (this._root) {
        if (!this._ha) window.addEventListener("keydown", this._keys);
        if (this._offered) {
          window.addEventListener("lightwell-preview", this._offered);
          window.dispatchEvent(new CustomEvent("lightwell-editor-open"));
        }
        return;
      }
      this._ha = this.getAttribute("shell") === "ha";
      const root = this._root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${STYLE2}</style>${HTML}`;
      if (this._ha) this._oneSide(root);
      (_a = this.style).position || (_a.position = "relative");
      const $ = (s) => root.querySelector(s);
      this._el = {
        name: $(".name"),
        text: $("textarea") || document.createElement("textarea"),
        footer: $("footer"),
        preview: $(".preview"),
        stage: $(".stage"),
        overlay: $(".overlay"),
        hover: $(".overlay .hover"),
        sel: $(".overlay .sel"),
        list: $(".list"),
        props: $(".props"),
        handles: $(".overlay .handles"),
        guides: $(".overlay .guides"),
        box: $(".overlay .box"),
        grid: $(".overlay .grid"),
        ruler: $(".ruler"),
        draft: $(".overlay .draft"),
        shadows: $(".overlay .shadows"),
        hint: $(".hint"),
        toolbar: $(".lw-tools"),
        start: $("dialog.start"),
        ha: $("dialog.ha"),
        haButton: $("header .ha"),
        inside: $(".overlay .inside"),
        buttons: Object.fromEntries([...root.querySelectorAll("[data-act]")].map((b) => [b.dataset.act, b]))
      };
      const draft = this._ha ? null : storage2.get();
      this.model = new HomeModel(this._value !== void 0 ? yamlOf(this._value) : draft?.text ?? this.example);
      this._sent = JSON.stringify(this.model.data);
      this._file = { name: draft?.name ?? "home.yaml", handle: null, saved: draft?.saved ?? this.model.text };
      this._dark = this._ha && !!this._hass?.themes?.darkMode;
      this._el.preview.classList.toggle("dark", this._dark);
      this._sel = null;
      this._sels = [];
      this._inside = null;
      this._group = null;
      this._showGrid = false;
      this._preview = null;
      this._pictures = {};
      this._opts = {
        wall: "auto",
        floor: true,
        kind: "window",
        glass: true,
        piece: "rect",
        extra: "rect",
        roomName: "",
        outdoor: false,
        cut: "window",
        cutWidth: 1.2,
        prefab: "sofa_3",
        turn: 0,
        device: null,
        search: ""
      };
      this._shown = { states: this.states, north: void 0 };
      this._card = document.createElement("lightwell-card");
      this._el.stage.prepend(this._card);
      this._card.addEventListener("hass-more-info", (e) => this._controls?.moreInfo(e.detail.entityId));
      const plan = this.model.home || { openings: [], sun: { entity: "sun.sun", weather: "weather.home", north: 0 } };
      this._controls = simulatorControls($("form"), {
        plan,
        states: this.states,
        location: this.location,
        help: false,
        onChange: (shown) => {
          this._shown = shown;
          this._renderCard();
        }
      });
      new ResizeObserver(() => {
        this._placeTools();
        this._place();
      }).observe(this._el.preview);
      root.addEventListener("click", (e) => {
        const act = e.target.closest?.("[data-act]")?.dataset.act;
        if (act) this._act(act);
        const tab = e.target.closest?.("[data-tab]");
        if (tab) this._tab(tab.dataset.tab);
        const view = e.target.closest?.("[data-view]");
        if (view) this.setView(view.dataset.view);
      });
      this._el.text.addEventListener("input", () => {
        clearTimeout(this._typing);
        this._typing = setTimeout(() => this._textChanged(), TYPING);
      });
      this._el.text.addEventListener("keydown", (e) => {
        if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          document.execCommand("insertText", false, "  ");
        }
      });
      this._el.toolbar.addEventListener("click", (e) => {
        const tool = e.target.closest?.("[data-tool]")?.dataset.tool;
        if (!tool) return;
        if (tool !== "select" && this._group === null && this._inside === null && this._sels.length) this.select(null);
        this.setTool(tool);
      });
      const overlay = this._el.overlay;
      overlay.addEventListener("pointerdown", (e) => this._down(e));
      overlay.addEventListener("pointermove", (e) => this._press ? this._dragTo(e) : this._pointer(e));
      overlay.addEventListener("pointerup", (e) => this._up(e));
      overlay.addEventListener("pointercancel", () => this._cancelDrag());
      overlay.addEventListener("dblclick", (e) => this._dblclick(e));
      overlay.addEventListener("dragover", (e) => {
        const types = e.dataTransfer.types;
        if (!types.includes("text/x-lightwell-prefab") && !types.includes("text/x-lightwell-device")) return;
        e.preventDefault();
        const at = this._at(e);
        if (at && types.includes("text/x-lightwell-prefab")) this._prefabPreview(at.p);
      });
      overlay.addEventListener("drop", (e) => {
        const id = e.dataTransfer.getData("text/x-lightwell-prefab"), device = e.dataTransfer.getData("text/x-lightwell-device"), at = this._at(e);
        if (!(id || device) || !at) return;
        e.preventDefault();
        e.stopPropagation();
        if (device) this._placeDevice(at.p, at.tol, device);
        else {
          this._opts.prefab = id;
          this._placePrefab(at.p);
        }
        this._el.draft.innerHTML = "";
      });
      overlay.addEventListener("pointerleave", () => {
        this._el.hover.innerHTML = "";
        if (this._tool === "build-cut" || this._tool === "build-piece") this._el.draft.innerHTML = "";
      });
      this._el.start.addEventListener("close", () => this._started());
      this._el.ha.addEventListener("close", () => this._haClosed());
      this._el.ha.querySelector("input").addEventListener("input", () => this._haCheck());
      this._el.footer.addEventListener("click", (e) => {
        const path = e.target.closest("p")?.dataset.path;
        if (path) this.select(JSON.parse(path));
      });
      if (this._ha) {
        this.addEventListener("keydown", (e) => {
          if (this._key(e) || e.key !== "Escape") e.stopPropagation();
        });
      } else {
        this._keys = (e) => this._key(e);
        window.addEventListener("keydown", this._keys);
      }
      if (!this._ha) {
        this.addEventListener("dragover", (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          this.classList.add("dragging");
        });
        this.addEventListener("dragleave", (e) => {
          if (!this.contains(e.relatedTarget)) this.classList.remove("dragging");
        });
        this.addEventListener("drop", async (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          this.classList.remove("dragging");
          const image = [...e.dataTransfer.items].find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
          if (image) return this._picture(image).catch((err) => this._message(err.message));
          const file = await droppedFile(e.dataTransfer);
          if (file) this._open(file);
        });
      }
      this._ctx = {
        commit: (path, value) => this._commit(path, value),
        select: (path) => this.select(path),
        toggle: (path) => this._toggle(path),
        add: (group) => this._add(group),
        remove: (path) => this._remove([path]),
        duplicate: () => this._duplicate(),
        previewEffect: (name, entity) => this._previewEffect(name, entity),
        rename: (path, name) => this._rename(path, name),
        move: (path, from, to) => this._move(path, from, to),
        template: (path) => this._template(path),
        enter: (name) => this._enter(name),
        selectObject: (id) => {
          this._out();
          this._selectObject(id);
        },
        toggleObject: (id) => {
          const parts = partsOf(this.model.data, id), all = parts.every((q) => this._sels.some((r) => samePath2(q, r)));
          this._selectAll(all ? this._sels.filter((r) => !parts.some((q) => samePath2(q, r))) : [...this._sels, ...parts]);
        },
        enterObject: (id, path) => {
          if (this._group !== id) this._out();
          this._enterGroup(id, [path]);
        },
        shapeTemplate: (kind, old) => this._shapeTemplate(kind, old)
      };
      this.setView(this.getAttribute("view") || (this._ha ? "build" : "edit"));
      this._changed({ text: true });
      if (!this._ha) this._liveStart();
      if (this._ha) {
        this._offered = (e) => this._adopt(e.detail);
        window.addEventListener("lightwell-preview", this._offered);
        window.dispatchEvent(new CustomEvent("lightwell-editor-open"));
      }
    }
    disconnectedCallback() {
      if (this._keys) window.removeEventListener("keydown", this._keys);
      if (this._offered) window.removeEventListener("lightwell-preview", this._offered);
      if (this._hosted) {
        this._hosted.editLayer = null;
        this._unplaceTools(this._hosted);
      }
      this._live?.close();
    }
    // Back from Home Assistant's sign-in, or signed in before: connects.
    async _liveStart() {
      try {
        const tokens = await finishSignIn() || savedTokens();
        if (tokens) this._connect(tokens);
      } catch (e) {
        this._message(e.message);
      }
      this._haStatus("", null);
    }
    _connect(tokens) {
      this._live?.close();
      let first = true;
      this._live = new HaConnection(tokens, {
        onStates: (states) => {
          this._controls.setStates(states);
          if (first) this._renderPanels();
          first = false;
        },
        onConfig: ({ latitude, longitude }) => this._controls.setLocation({ latitude, longitude }),
        onStatus: (text2, ok) => {
          this._haStatus(text2, ok);
          if (!ok) this._message(text2);
        }
      });
    }
    // The header's Home Assistant button: connected (green), dropped or refused (orange), or not connected.
    _haStatus(text2, ok) {
      const b = this._el.haButton, on = !!this._live && !this._live.closed;
      b.classList.toggle("on", on && ok !== false);
      b.classList.toggle("off", on && ok === false);
      b.title = text2 || (on ? "Connected to Home Assistant" : "Connect to your Home Assistant for its entities and live states");
      this._haText = text2;
    }
    _haDialog() {
      const d = this._el.ha, on = !!this._live && !this._live.closed;
      d.querySelector("input").value = savedTokens()?.base || (() => {
        try {
          return localStorage.getItem("lightwell-editor:ha-url") || "";
        } catch {
          return "";
        }
      })();
      d.querySelector(".status").textContent = on ? this._haText || "Connected." : "Not connected: the pickers show the states the editor was opened with.";
      d.querySelector(".disconnect").hidden = !on;
      this._haCheck();
      d.returnValue = "";
      d.showModal();
    }
    // Whether the address typed can be reached from this page, said under it.
    _haCheck() {
      const d = this._el.ha, base = haUrl(d.querySelector("input").value);
      const why = !d.querySelector("input").value.trim() ? "" : !base ? "That isn't a web address." : cannotReach(base, location);
      d.querySelector(".why").textContent = why;
      d.querySelector(".connect").disabled = !base || !!why;
    }
    async _haClosed() {
      const d = this._el.ha, how = d.returnValue;
      if (how === "connect") {
        const base = haUrl(d.querySelector("input").value);
        if (!base || cannotReach(base, location)) return;
        try {
          localStorage.setItem("lightwell-editor:ha-url", base);
        } catch {
        }
        this._textChanged();
        signIn(base);
      } else if (how === "disconnect") {
        this._live?.close();
        this._live = null;
        await signOut();
        this._controls.setStates(this.states);
        this._controls.setLocation(this.location);
        this._haStatus("", null);
        this._renderPanels();
        this._message("Disconnected from Home Assistant: its tokens are revoked and forgotten here.", "info");
      }
    }
    // After the model changed: the text view (unless it's where the change came from), the card, the panels, the
    // messages, the buttons and the draft.
    _changed({ text: text2 }) {
      if (text2) this._el.text.value = this.model.text;
      const { home, data, errors } = this.model;
      if (home) {
        this._data = data;
        this._home = home;
        this._controls.setPlan(home);
      } else this._renderCard();
      if (this._inside !== null && !data?.furniture?.[this._inside]) this._inside = null;
      this._sels = this._sels.filter((p) => itemAt(data, p) !== void 0);
      if (this._sel && itemAt(data, this._sel) === void 0) this._sel = this._sels.at(-1) || null;
      this._el.footer.textContent = "";
      for (const e of errors) {
        const p = this._message(e), path = messagePath(e);
        if (path) {
          p.dataset.path = JSON.stringify(path);
          p.classList.add("link");
          p.title = "Select it";
        }
      }
      if (errors.length && this._data) this._message("The card shows the last version without mistakes.", "info");
      this._renderPanels();
      this._updateButtons();
      if (!this._ha) storage2.set({ text: this.model.text, name: this._file.name, saved: this._file.saved });
      else if (home) {
        const json = JSON.stringify(data);
        if (json !== this._sent) {
          this._sent = json;
          this.dispatchEvent(new CustomEvent("value-changed", { detail: { value: data } }));
        }
      }
    }
    // A field set from the forms (undefined: removed). In the Build view, a lamp's entity set on one of its parts (its
    // light, its marker) is set on all of them, so that its glow, its pool and its marker stay one lamp.
    _commit(path, value) {
      const lamp = this._view === "build" && this.model.data && lampEntityOps(this.model.data, path, value);
      if (lamp) return this._edit(() => this.model.batch(lamp));
      this._edit(() => value === void 0 ? this.model.get(path) !== void 0 && this.model.remove(path) : this.model.set(path, value));
    }
    // Applies an edit (a function changing the model), and shows a failure as a message.
    _edit(fn) {
      try {
        if (fn() !== false) this._changed({ text: true });
      } catch (e) {
        this._message(e.message);
      }
    }
    _renderCard() {
      let data = this._preview?.data || this._data;
      if (!data) return;
      const bg = data.drawing?.background;
      if (!this._ha && bg && typeof bg.image === "string" && !(bg.image in this._pictures)) this._loadPicture(bg.image);
      const url = bg && this._pictures[bg.image];
      if (url) data = { ...data, drawing: { ...data.drawing, background: { ...bg, image: url } } };
      else if (bg && url === null) data = { ...data, drawing: { ...data.drawing, background: void 0 } };
      try {
        this._card.setConfig({ home: data, north: this._shown.north });
        this._card.hass = this._hosted ? this._hass : { states: this._effectStates(), themes: { darkMode: this._dark }, callService: this._controls.callService };
      } catch (e) {
        this._message(e.message);
      }
      this._place();
    }
    // HA's preview of the card (`card`, offering itself): the editing layer (the overlay, the ruler) moves into it, over
    // its plan, and the editor's own copy of the card hides. The card then shows the home being edited with HA's own
    // states and theme, so the simulated sun and time and the Dark button go. A newer preview (HA rebuilds it on every
    // change) takes the layer over.
    _adopt(card) {
      if (!card) return;
      const keys = !!this._layerFocus;
      if (card === this._hosted) {
        card.editLayer = this._layer;
        this._refocus();
        return;
      }
      if (this._hosted) {
        this._hosted.editLayer = null;
        this._unplaceTools(this._hosted);
      }
      if (!this._layer) {
        this._layer = Object.assign(document.createElement("div"), { className: "lw-edit", tabIndex: -1 });
        this._layer.innerHTML = `<style>${OVERLAY_STYLE}</style>`;
        this._layer.addEventListener("keydown", (e) => {
          if (this._key(e) || e.key !== "Escape") e.stopPropagation();
        });
        this._layer.addEventListener("focusin", () => {
          this._layerFocus = true;
        });
        this._layer.addEventListener("focusout", (e) => {
          if (!this._layer.contains(e.relatedTarget)) this._layerFocus = false;
        });
      }
      this._layer.append(this._el.overlay, this._el.ruler, this._el.toolbar);
      this._hosted = this._card = card;
      card.editLayer = this._layer;
      if (keys) this._focusDue = true;
      this._refocus();
      requestAnimationFrame(() => this._refocus());
      this.setAttribute("hosted", "");
      this._hostObserver?.disconnect();
      this._hostObserver = new ResizeObserver(() => {
        this._placeTools();
        this._place();
      });
      this._hostObserver.observe(card);
      this._column = null;
      this._renderCard();
      this._placeTools();
    }
    // The layer gets the keys back, if it had them before HA rebuilt its preview, once it's in the page.
    _refocus() {
      if (!this._focusDue || !this._layer?.isConnected) return;
      this._focusDue = false;
      this._layer.focus({ preventScroll: true });
    }
    // The toolbar beside the plan (a column of icons on its left) where there's room for it, otherwise above it. On HA's
    // preview, the room is in the column HA's preview is in (HA keeps the card to 500 px, also in its large mode): the
    // card moves right by the toolbar's width, keeping its own (only our card's margins change, nothing of HA's). In the
    // editor's own stage, by the stage's width.
    _placeTools() {
      const bar = this._el.toolbar, card = this._hosted, side = TOOLBAR_SIDE + TOOLBAR_GAP;
      let beside;
      if (card) {
        const column = card.parentElement?.parentElement;
        if (column && this._column !== column) {
          this._column = column;
          this._hostObserver.observe(column);
        }
        this._unplaceTools(card);
        const k = card.offsetWidth ? card.getBoundingClientRect().width / card.offsetWidth || 1 : 1, width = card.offsetWidth;
        const pad2 = column ? parseFloat(getComputedStyle(column).paddingRight) || 0 : 0;
        const room = column ? (column.getBoundingClientRect().right - card.getBoundingClientRect().left) / k - pad2 : 0;
        beside = room >= width + side;
        bar.classList.toggle("beside", beside);
        Object.assign(card.style, beside ? { marginLeft: `${side}px`, width: `${width}px` } : { marginTop: `${bar.offsetHeight + TOOLBAR_GAP}px` });
      } else {
        beside = this._el.preview.clientWidth >= 500;
        this._el.stage.classList.toggle("beside", beside);
      }
      bar.classList.toggle("beside", beside);
    }
    // Our card as HA laid it out, without the toolbar's room.
    _unplaceTools(card) {
      Object.assign(card.style, { marginLeft: "", marginTop: "", width: "" });
    }
    // The element the editing layer is placed in: the editor's stage, or the layer in HA's preview card.
    _frameEl() {
      return this._hosted ? this._layer : this._el.stage;
    }
    // How much the frame is scaled on screen (HA's dialog zooms in as it opens): its width there over its own.
    _frameScale() {
      const f = this._frameEl(), w = f.offsetWidth;
      return w ? f.getBoundingClientRect().width / w || 1 : 1;
    }
    // A point on the screen (client pixels) in the frame's own pixels, whatever scale it's shown at.
    _inFrame(x, y) {
      const s = this._frameEl().getBoundingClientRect(), k = this._frameScale();
      return [(x - s.left) / k, (y - s.top) / k];
    }
    // The overlay over the card's drawing, in the drawing's units.
    _place() {
      const svg = this._card.shadowRoot?.querySelector(".plan svg"), view = this._home?.view;
      if (!svg || !view) return;
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) {
        this._placeAgain || (this._placeAgain = requestAnimationFrame(() => {
          this._placeAgain = 0;
          this._place();
        }));
        return;
      }
      const o = this._el.overlay, [x, y] = this._inFrame(r.left, r.top), k = this._frameScale();
      Object.assign(o.style, { left: `${x}px`, top: `${y}px`, width: `${r.width / k}px`, height: `${r.height / k}px` });
      o.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
      this._renderOverlay();
    }
    // The selection's outlines, and the handles of a single selected item (while the home has no mistakes); the grid.
    _renderOverlay() {
      const home = this._preview?.home || this._home, data = this._preview?.data || this._data;
      this._el.sel.innerHTML = home ? this._sels.map((p) => outlineSvg(home, p)).join("") : "";
      const px = this._px(), f = (v) => +v.toFixed(2), s = HANDLE * px;
      this._el.handles.innerHTML = this._handles(data).map((h2) => h2.turn || h2.mid || h2.ctrl || h2.id.startsWith("pool") ? `<circle class="${h2.turn ? "turn" : h2.mid || h2.ctrl ? "mid" : ""}" cx="${f(h2.at[0])}" cy="${f(h2.at[1])}" r="${f(s / (h2.mid || h2.ctrl ? 2.6 : 2))}"/>` : `<rect x="${f(h2.at[0] - s / 2)}" y="${f(h2.at[1] - s / 2)}" width="${f(s)}" height="${f(s)}"/>`).join("");
      this._renderInside(home);
      const pool = this._sels.length === 1 && this._sel[0] === "lights" && itemAt(data, this._sel)?.pool;
      this._el.shadows.innerHTML = home && pool ? (pool.shadows || []).map((n2) => outlineSvg(home, ["furniture", n2])).join("") : "";
      this._renderGrid();
    }
    // The handles of the selected item, if it's the only one and can be changed.
    // In the Build view's Furniture and Lamps and devices, those of a selected piece, or lamp, too.
    _handles(data = this._data) {
      const own = this._tool === "select" || this._tool === "build-piece" && ["furniture", "lights"].includes(this._sel?.[0]) || this._tool === "build-device" && this._sel?.[0] === "lights";
      const one = this._sels.length === 1 || this._view === "build" && this._sel?.[0] === "lights" && this._objectOf(this._sels);
      if (!own || !one || !this.model.home || !data) return [];
      const list = handles(this._sel, itemAt(data, this._sel), this._withPiece(this._sel, data, { reach: 3 * HANDLE * this._px() }));
      return this._view === "build" && this._group === null && this._sels.length > 1 ? list.filter((h2) => h2.id !== "pool") : list;
    }
    // Inside a piece: the rest of the plan dimmed, the piece outlined; the guides and the drawing in its frame.
    _renderInside(home) {
      const piece = home?.furniture?.[this._inside], v = home?.view;
      const turn2 = pieceTurn(piece);
      for (const g of [this._el.guides, this._el.draft]) turn2 ? g.setAttribute("transform", turn2) : g.removeAttribute("transform");
      if (!piece) {
        this._el.inside.innerHTML = this._group !== null && home ? this._groupDim(home) : "";
        return;
      }
      const o = pieceOutline(piece), f = (v2) => +v2.toFixed(1);
      const d = o.poly ? `M${o.poly.map((q) => q.map(f).join(",")).join(" L")} Z` : `M${f(o.circle[0] - o.circle[2])},${o.circle[1]} a${o.circle[2]},${o.circle[2]} 0 1,0 ${f(2 * o.circle[2])},0 a${o.circle[2]},${o.circle[2]} 0 1,0 ${f(-2 * o.circle[2])},0 Z`;
      const [x0, y0, x1, y1] = [v.x - v.w, v.y - v.h, v.x + 2 * v.w, v.y + 2 * v.h];
      this._el.inside.innerHTML = `<path class="dim" d="M${x0},${y0} H${x1} V${y1} H${x0} Z ${d}"/><path class="piece" d="${d}"/>`;
    }
    // Inside a Build object: the rest of the plan dimmed (but where its parts are), its parts outlined.
    _groupDim(home) {
      const v = home.view, parts = partsOf(this.model.data, this._group).map((p) => outlineSvg(home, p)).join("");
      const [x, y, w, h2] = [v.x, v.y, v.w, v.h];
      return `<mask id="lw-group-hole" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h2}"><rect x="${x}" y="${y}" width="${w}" height="${h2}"/><g class="hole">${parts}</g></mask><rect class="dim all" x="${x}" y="${y}" width="${w}" height="${h2}" mask="url(#lw-group-hole)"/><g class="group">${parts}</g>`;
    }
    // What a Build object is called: a room's name (its label), the catalogue's name for what it was made from, or its id.
    _groupName(id) {
      const label = partsOf(this.model.data, id).find((p) => p[1] === "labels");
      return label && itemAt(this.model.data, label)?.text || prefab(id.replace(/_\d+$/, ""))?.name || id.replace(/_(\d+)$/, " $1").replace(/_/g, " ");
    }
    // The options the manipulate functions take for the item at `path` (plus `rest`): an extra shape's piece.
    _withPiece(path, data = this.model.data, rest = {}) {
      return isExtra(path) ? { ...rest, piece: itemAt(data, path.slice(0, 2)) } : rest;
    }
    // The piece whose insides are being edited, in `data`.
    _piece(data = this._data) {
      return this._inside === null ? void 0 : data?.furniture?.[this._inside];
    }
    // A point in the drawing in the frame of the piece being edited, and back (the same unless it's turned).
    _toFrame(p, data) {
      const m2 = parseTransform(pieceTurn(this._piece(data)));
      return m2 ? applyTransform(invertTransform(m2), p) : p;
    }
    _fromFrame(p, data) {
      return applyTransform(parseTransform(pieceTurn(this._piece(data))), p);
    }
    // What's under the pointer: inside a piece, its shapes, front to back (`inside` true); otherwise every item.
    _hitsAt(at) {
      const piece = this._home?.furniture?.[this._inside];
      if (piece && onPiece(piece, at.p, at.tol)) return { hits: hitInside(this._home, this._inside, at.p, at.tol), inside: true };
      const hits = hitTest(this._home, at.p, at.tol);
      if (this._group !== null) {
        const own = hits.filter((h2) => partOf2(this.model.data, h2) === this._group);
        if (own.length) return { hits: own, inside: true };
      }
      return { hits, inside: false };
    }
    // Edits the insides of the piece `name`, selecting `paths` (its shapes).
    _enter(name, paths = []) {
      if (!this.model.data?.furniture?.[name]) return;
      this._inside = name;
      this._hits = null;
      this._poly = null;
      this._el.draft.innerHTML = "";
      if (!INSIDE_HINTS[this._tool]) this._tool = "select";
      this._selectAll(paths);
      this._renderTools();
    }
    // Out of the piece (or the Build object), with nothing selected (before selecting what's outside it).
    _out() {
      this._inside = null;
      this._group = null;
      this._hits = null;
      this._sels = [];
      this._sel = null;
      this._renderTools();
      this._renderOverlay();
    }
    // Edits the Build object `id` part by part, selecting `paths` (its parts), as a piece's insides are edited.
    _enterGroup(id, paths = []) {
      if (!partsOf(this.model.data, id).length) return;
      this._group = id;
      this._hits = null;
      this._selectAll(paths);
      this._renderTools();
    }
    // Back out of the Build object, selecting it whole.
    _leaveGroup() {
      const id = this._group;
      this._group = null;
      this._hits = null;
      this._selectObject(id);
      this._renderTools();
    }
    // Back out of the piece, selecting it.
    _leave() {
      const name = this._inside;
      this._inside = null;
      this._hits = null;
      this._selectAll(name === null ? [] : [["furniture", name]]);
      this._renderTools();
    }
    // The grid things snap to (GRID), with a stronger line every metre; the minor lines only when they're far enough
    // apart to see.
    _renderGrid() {
      const g = this._el.grid, v = this._home?.view;
      if (!this._showGrid || !v) {
        g.innerHTML = "";
        return;
      }
      const step = this._grid(), metre = step / GRID, px = this._px();
      const lines = (d, cls) => {
        if (d / px < 6) return "";
        const out = [];
        for (let x = Math.ceil(v.x / d) * d; x <= v.x + v.w; x += d) out.push(`M${+x.toFixed(2)},${v.y}V${v.y + v.h}`);
        for (let y = Math.ceil(v.y / d) * d; y <= v.y + v.h; y += d) out.push(`M${v.x},${+y.toFixed(2)}H${v.x + v.w}`);
        return `<path class="${cls}" d="${out.join("")}"/>`;
      };
      g.innerHTML = lines(step, "minor") + lines(metre, "major");
    }
    _renderPanels() {
      renderList(this._el.list, this.model.data, this._sel, { ...this._ctx, inside: this._inside, group: this._group, objects: this._objects() }, this._sels);
      this._renderDetails();
      this._renderOverlay();
    }
    // Selects the item at `path` (null: the home itself) in the list, on the plan and in the text.
    select(path) {
      if (!path) {
        this._inside = null;
        this._group = null;
      }
      this._selectAll(path ? [path] : []);
      if (this._sel && !this._el.text.closest("[hidden]")) this._showInText(this._sel);
    }
    // Selects several items; the last is the one whose properties show.
    // Selecting a piece's shapes enters it (only its shapes stay selected); selecting anything else leaves it.
    _selectAll(paths) {
      const seen = /* @__PURE__ */ new Set(), was = this._inside;
      this._sels = paths.filter((p) => itemAt(this.model.data, p) !== void 0 && !seen.has(pathKey(p)) && seen.add(pathKey(p)));
      const extra = this._sels.findLast(isExtra);
      if (extra) this._inside = extra[1];
      else if (this._sels.length) this._inside = null;
      if (this._inside !== null) this._sels = this._sels.filter((p) => isExtra(p) && p[1] === this._inside);
      const group = this._group;
      if (group !== null && this._sels.some((p) => partOf2(this.model.data, p) !== group)) this._group = null;
      this._sel = this._sels.at(-1) || null;
      this._folded = null;
      if (was !== this._inside || group !== this._group) this._renderTools();
      if (this._ha && this._sel && this._tabNow === "list") this._tab("props");
      this._renderPanels();
    }
    // Adds an item to the selection, or takes it out.
    _toggle(path) {
      const has = this._sels.some((p) => samePath2(p, path));
      this._selectAll(has ? this._sels.filter((p) => !samePath2(p, path)) : [...this._sels, path]);
    }
    // Scrolls the YAML to the item and selects its text.
    _showInText(path) {
      const node = this.model.doc.getIn(path, true), range = node?.range;
      if (!range) return;
      const ta = this._el.text, line = ta.value.slice(0, range[0]).split("\n").length - 1;
      ta.setSelectionRange(range[0], range[1]);
      ta.scrollTop = Math.max(0, line * parseFloat(getComputedStyle(ta).lineHeight) - ta.clientHeight / 3);
    }
    // In HA's dialog (its editor gets half of it, beside HA's own preview of the card): the two sides as one, under the
    // plan, with one row of tabs (Items, Properties, YAML, Sun and time), and a tip on making the dialog larger (HA's
    // own: a click on its title).
    _oneSide(root) {
      const left = root.querySelector(".side.left"), right = root.querySelector(".side.right"), tabs = left.querySelector(".tabs");
      right.querySelector('[data-tab="text"]').remove();
      right.querySelector('[data-pane="text"]').remove();
      tabs.querySelector('[data-tab="list"]').after(...right.querySelectorAll(".tabs [data-tab]"));
      left.append(...right.querySelectorAll(".pane"));
      right.remove();
      let seen = false;
      try {
        seen = localStorage.getItem("lightwell-editor:tip-large") === "1";
      } catch {
      }
      if (seen) return;
      const tip = Object.assign(document.createElement("p"), { className: "tip" });
      tip.innerHTML = `Tip: click the dialog's title to make it larger. <button type="button" title="Got it">\xD7</button>`;
      tip.querySelector("button").onclick = () => {
        tip.remove();
        try {
          localStorage.setItem("lightwell-editor:tip-large", "1");
        } catch {
        }
      };
      root.querySelector("header").append(tip);
    }
    _tab(name) {
      this._tabNow = name;
      for (const b of this._root.querySelectorAll("[data-tab]")) {
        const side = b.closest(".side");
        if (!side.querySelector(`[data-tab="${name}"]`)) continue;
        b.setAttribute("aria-selected", b.dataset.tab === name);
        side.querySelector(`[data-pane="${b.dataset.tab}"]`).hidden = b.dataset.tab !== name;
      }
      if (name === "text" && this._sel) this._showInText(this._sel);
    }
    // A pointer position in the drawing's units, and how far REACH pixels go there.
    _at(e) {
      const m2 = this._el.overlay.getScreenCTM();
      if (!m2 || !this._home) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m2.inverse());
      return { p: [p.x, p.y], tol: REACH / m2.a };
    }
    // A pixel in the drawing's units.
    _px() {
      const m2 = this._el.overlay.getScreenCTM();
      return m2?.a ? 1 / m2.a : 1;
    }
    // The grid's step in the drawing's units.
    _grid() {
      return (this._data?.units_per_metre || 100) * GRID;
    }
    // The handle under the pointer, if any: the nearest within reach.
    _handleAt(at) {
      let best = null;
      for (const h2 of this._handles()) {
        const d = Math.hypot(h2.at[0] - at.p[0], h2.at[1] - at.p[1]);
        if (d <= at.tol + HANDLE * this._px() / 2 && (!best || d < best.d)) best = { ...h2, d };
      }
      return best;
    }
    _pointer(e) {
      const at = this._at(e);
      if (!at) return;
      if (this._tool !== "select") {
        this._el.hover.innerHTML = "";
        if (this._poly) this._drawDraft(this._snap(e, at, this._poly.points.at(-1)), null, e);
        if (this._handleAt(at)) {
          this._el.hover.innerHTML = this._el.draft.innerHTML = "";
          this._el.overlay.classList.add("grab");
          return;
        }
        const grab = this._buildGrab(at);
        if (grab) {
          const id = this._objectAt(grab), paths = id ? partsOf(this.model.data, id) : [grab];
          this._el.hover.innerHTML = paths.filter((p) => !this._sels.some((q) => samePath2(p, q))).map((p) => outlineSvg(this._home, p)).join("");
          this._el.draft.innerHTML = "";
          this._el.overlay.classList.add("grab");
          return;
        }
        this._el.overlay.classList.remove("grab");
        if (this._tool === "build-cut") this._cutPreview(at);
        if (this._tool === "build-piece") {
          this._lastAt = at.p;
          if (e.shiftKey) this._prefabPreview(at.p);
          else this._el.draft.innerHTML = "";
        }
        return;
      }
      const handle = this._handleAt(at), hit = !handle && this._hitsAt(at).hits[0];
      this._el.hover.innerHTML = hit && !this._sels.some((p) => samePath2(p, hit)) ? outlineSvg(this._home, hit) : "";
      this._el.overlay.style.cursor = handle ? "crosshair" : hit && this.model.home ? "move" : "default";
    }
    // A room's name edited on the plan, from a double-click on its label (or, with `anywhere`, anywhere in the room): its
    // label's text, in a field over the label (or the room's middle, adding one). Enter or leaving the field keeps it,
    // Esc doesn't. The room's key stays as it is (the references to it use it). False when there's no room there.
    _editRoomName(e, anywhere) {
      const at = this._at(e), data = this.model.data, hits = at ? this._hitsAt(at).hits : [];
      const isRoom = (id) => id && data.rooms?.[id] !== void 0;
      const room = (anywhere ? hits : hits.filter((h2) => h2[0] === "drawing" && h2[1] === "labels")).map((h2) => this._objectAt(h2)).find(isRoom);
      if (!room) return false;
      this._selectObject(room);
      const label = partsOf(data, room).find((p) => p[0] === "drawing" && p[1] === "labels"), shape = label && itemAt(data, label);
      const r = data.rooms[room][0], spot = shape?.at || (Array.isArray(r?.[0]) ? r[0] : [r[0] + r[2] / 2, r[1] + r[3] / 2]);
      const m2 = this._el.overlay.getScreenCTM(), q = new DOMPoint(...spot).matrixTransform(m2), [qx, qy] = this._inFrame(q.x, q.y);
      this._frameEl().querySelector("input.name-edit")?.remove();
      const input2 = Object.assign(document.createElement("input"), { type: "text", className: "name-edit", value: shape?.text ?? "", placeholder: "Its name", spellcheck: false });
      Object.assign(input2.style, { left: `${qx}px`, top: `${qy}px` });
      let done = false;
      const finish = (keep) => {
        if (done) return;
        done = true;
        const text2 = input2.value.trim();
        input2.remove();
        if (!keep || !text2 || text2 === shape?.text) return;
        this._setRoomName(room, text2);
      };
      const back = () => (this._hosted ? this._layer : this._el.preview).focus({ preventScroll: true });
      input2.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter") {
          finish(true);
          back();
        } else if (ev.key === "Escape") {
          finish(false);
          back();
        }
      });
      input2.addEventListener("blur", () => finish(true));
      this._frameEl().append(input2);
      input2.focus();
      input2.select();
      return true;
    }
    // What a Build step picks under the pointer (its own kind of thing): a window, door or doorway in Windows and doors,
    // a piece in Furniture, a lamp or marker in Lamps and devices. Its path, or undefined. (A gap's end is grabbed
    // before this, to resize it; a room is picked by a click in Rooms, as a drag there draws one.)
    _buildGrab(at) {
      const t = this._tool, data = this.model.data;
      if (!["build-cut", "build-piece", "build-device"].includes(t) || !data || t === "build-cut" && boundaryAt(data, at.p, at.tol + HANDLE * this._px() / 2)) return void 0;
      return this._hitsAt(at).hits.find((h2) => t === "build-piece" ? h2[0] === "furniture" && h2.length === 2 : t === "build-device" ? h2[0] === "lights" || h2[0] === "markers" : this._isCut(this._objectAt(h2)));
    }
    // Whether object `id` is a window or door: a gap of its own, or (adopted from a home not made in Build) an opening
    // or glass.
    _isCut(id) {
      if (!id) return false;
      const data = this.model.data;
      return !!gapOf(data, id) || partsOf(data, id).some((p) => p[0] === "openings" || p[1] === "glazing");
    }
    // Over a wall in the Build view's Windows and doors: the end of a gap the pointer would grab (outlined), or where a
    // click would cut the wall.
    _cutPreview(at) {
      const data = this.model.data, f = (v) => +v.toFixed(1);
      if (!data) return;
      const grab = boundaryAt(data, at.p, at.tol + HANDLE * this._px() / 2);
      if (grab) {
        const { gap, bounds } = grab.run, v = bounds[grab.k], w = 3 * this._px(), r2 = gap.axis === 0 ? [v - w, gap.band[0], 2 * w, gap.band[1] - gap.band[0]] : [gap.band[0], v - w, gap.band[1] - gap.band[0], 2 * w];
        this._el.overlay.classList.toggle("grab-x", gap.axis === 0);
        this._el.overlay.classList.toggle("grab-y", gap.axis === 1);
        this._el.draft.innerHTML = `<rect class="cut grab" x="${f(r2[0])}" y="${f(r2[1])}" width="${f(r2[2])}" height="${f(r2[3])}"/>`;
        return;
      }
      this._el.overlay.classList.remove("grab-x", "grab-y");
      const r = this._cutRect(at)?.rect;
      this._el.draft.innerHTML = r ? `<rect class="cut" x="${f(r[0])}" y="${f(r[1])}" width="${f(r[2])}" height="${f(r[3])}"/>` : "";
    }
    // The part of the wall under `at` a cut takes: the width chosen around it, or as far as `to` along the wall:
    // {rect, length}, or null.
    _cutRect(at, to) {
      const data = this.model.data, wall = data && wallAt(data, at.p, at.tol);
      if (!wall) return null;
      const r = [...wall.rect], a = r[2] >= r[3] ? 0 : 1;
      const span = to ? [Math.max(Math.min(at.p[a], to[a]), r[a]), Math.min(Math.max(at.p[a], to[a]), r[a] + r[a + 2])] : cutSpan(r, at.p[a], this._opts.cutWidth * (data.units_per_metre || 100));
      if (!span) return null;
      snapCut(data, wall, span, !to);
      r[a] = span[0];
      r[a + 2] = span[1] - span[0];
      return { rect: r, length: r[a + 2] };
    }
    // A press on the plan: a click when the pointer doesn't move (_click), otherwise a drag (_startDrag).
    _down(e) {
      if (e.button !== 0 || !this._home) return;
      const at = this._at(e);
      if (!at) return;
      (this._hosted ? this._layer : this._el.preview).focus({ preventScroll: true });
      try {
        this._el.overlay.setPointerCapture(e.pointerId);
      } catch {
      }
      this._press = { x: e.clientX, y: e.clientY, at, handle: this._handleAt(at), shift: e.shiftKey, turn: e.ctrlKey || e.metaKey, drag: null };
      this._press.grab = !this._press.handle && this._buildGrab(at);
      const placing = !["build-piece", "build-device"].includes(this._tool) || e.shiftKey;
      if (this._tool !== "select" && !this._press.grab && !this._press.handle && placing) Object.assign(this._press, { create: true, start: this._snap(e, at, this._poly?.points.at(-1)) });
      if (this._tool === "build-cut") this._press.gapEnd = boundaryAt(this.model.data, at.p, at.tol + HANDLE * this._px() / 2);
    }
    _up(e) {
      const press = this._press;
      this._press = null;
      if (!press) return;
      if (press.create) this._drawEnd(e, press);
      else if (press.drag) this._endDrag(press.drag);
      else this._click(e, press);
    }
    // A click selects what's under it; clicking again where everything is the same goes on to the next thing under it;
    // Shift+click adds it to the selection (or takes it out). Alt+click taps the card underneath instead (lights toggle,
    // the weather changes). A click on a handle does nothing.
    _click(e, press) {
      if (e.altKey && !this._hosted) {
        const marker = this._card.shadowRoot?.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList?.contains("m"));
        marker?.click();
        return;
      }
      const now = performance.now();
      if (!this._clicks || now - this._clicks.t > CLICKS) this._clicks = { sel: this._sel };
      this._clicks.t = now;
      if (press.handle) return;
      const found = this._hitsAt(press.at), inside = found.inside;
      const hits = press.grab ? [press.grab, ...found.hits.filter((h2) => !samePath2(h2, press.grab))] : found.hits;
      if ((this._inside !== null || this._group !== null) && !inside) this._out();
      if ((e.ctrlKey || e.metaKey) && this._toggleShadow(hits)) return;
      if (press.shift) {
        const id = hits[0] && this._objectAt(hits[0]);
        if (id) {
          const parts = partsOf(this.model.data, id), all = parts.every((q) => this._sels.some((r) => samePath2(q, r)));
          this._selectAll(all ? this._sels.filter((r) => !parts.some((q) => samePath2(q, r))) : [...this._sels, ...parts]);
        } else if (hits[0]) this._toggle(hits[0]);
        return;
      }
      const again = this._hits && hits.length && hits.map(pathKey).join() === this._hits.map(pathKey).join();
      this._hits = hits;
      if (again) return this._cycle();
      if (inside) this._selectAll(hits.slice(0, 1));
      else if (this._objectAt(hits[0])) this._selectObject(this._objectAt(hits[0]));
      else this.select(hits[0] || null);
    }
    // In the Build view, the object (made there) the item at `path` is part of: its id, or undefined.
    _objectAt(path) {
      if (this._view !== "build" || !path) return void 0;
      const id = partOf2(this.model.data, path);
      return id && id !== this._group && partsOf(this.model.data, id).length ? id : void 0;
    }
    // Selects all the parts of object `id`; the one whose properties show is the room, or the opening.
    _selectObject(id) {
      const paths = partsOf(this.model.data, id), main = paths.find((p) => p[0] === "rooms" || p[0] === "openings" || p[0] === "lights");
      this._selectAll(main ? [...paths.filter((p) => p !== main), main] : paths);
    }
    // The one object the paths are all part of, in the Build view, or undefined.
    _objectOf(paths) {
      const ids = new Set(paths.map((p) => this._objectAt(p)));
      return ids.size === 1 ? [...ids][0] : void 0;
    }
    // With a lamp with a pool selected: the piece among `hits` added to its shadows, or taken out. False when it isn't.
    _toggleShadow(hits) {
      const path = this._sels.length === 1 && this._sel[0] === "lights" ? this._sel : null;
      const light = path && itemAt(this.model.data, path), piece = hits.find((h2) => h2[0] === "furniture" && h2.length === 2);
      if (!light?.pool || !piece) return false;
      if (!this.model.data.furniture[piece[1]]?.height) {
        this._message(`${piece[1]} has no height, so it casts no shadows: give it one first`);
        return true;
      }
      const shadows = light.pool.shadows || [];
      const next = shadows.includes(piece[1]) ? shadows.filter((n2) => n2 !== piece[1]) : [...shadows, piece[1]];
      this._edit(() => this.model.set([...path, "pool", "shadows"], next));
      return true;
    }
    // A double click on a polygon's corner removes it; on a piece of furniture, it enters it (to edit its insides,
    // selecting the one under the pointer); while drawing a polygon, it finishes it. It goes by what was selected before
    // its two clicks (which step through what's under the pointer): a selected piece under it is the one entered, and in
    // a selected room the rectangle under it is selected.
    _dblclick(e) {
      if (this._view === "build" && this._group === null && !this._poly) {
        if (this._editRoomName(e, false)) return;
        const at2 = this._at(e), hits = at2 ? this._hitsAt(at2).hits : [], before = this._clicks ? this._clicks.sel : this._sel;
        const id = before && hits.some((h2) => samePath2(h2, before)) && this._objectAt(before) || hits[0] && this._objectAt(hits[0]);
        if (id) {
          this.setTool("select");
          return this._enterGroup(id, hits.filter((h2) => partOf2(this.model.data, h2) === id).slice(0, 1));
        }
      }
      if (this._tool === "build-room") return;
      if (this._tool !== "select") return this._poly && this._finishPoly();
      const at = this._at(e), handle = at && this._handleAt(at);
      if (at && !handle?.id.match(/(^|\/)v:\d+$/)) {
        if (this._hitsAt(at).inside) return;
        const hits = hitTest(this._home, at.p, at.tol), before = this._clicks?.sel ?? this._sel;
        const under = (path) => hits.some((h2) => samePath2(h2, path.slice(0, 2)));
        const room = before?.[0] === "rooms" && under(before) && this.model.data.rooms[before[1]];
        if (Array.isArray(room) && !Array.isArray(room[0]?.[0])) {
          const i = room.findLastIndex((q) => inPoly(partPoly(q) || [], at.p));
          if (i >= 0) return this.select(["rooms", before[1], i]);
        }
        const piece = before?.[0] === "furniture" && before.length === 2 && under(before) ? before : hits.find((h2) => h2[0] === "furniture");
        if (piece) this._enter(piece[1], hitInside(this._home, piece[1], at.p, at.tol).slice(0, 1));
        return;
      }
      if (!handle) return;
      const item = removeCorner(this._sel, itemAt(this.model.data, this._sel), handle.id, this._withPiece(this._sel));
      if (item) this._edit(() => this.model.set(this._sel, item));
      else this._message("A polygon keeps at least three corners");
    }
    // What a drag does, decided when the pointer has moved far enough: a handle changes its item; on an item, moves
    // the selection (the item first selected, if it wasn't); with Shift or on empty space, selects with a box.
    _startDrag(press) {
      const { at } = press;
      let hits = [];
      if (!press.handle) {
        const found = this._hitsAt(at);
        if ((this._inside !== null || this._group !== null) && !found.inside) this._out();
        hits = press.grab ? [press.grab, ...found.hits.filter((h2) => !samePath2(h2, press.grab))] : found.hits;
      }
      if (press.shift || !press.handle && !hits.length) return { kind: "box", from: at.p, add: press.shift };
      const turning = press.turn && !press.handle && hits.find((h2) => h2[0] === "furniture" && h2.length === 2);
      if (turning) {
        const item = itemAt(this.model.data, turning), sh = item?.shape;
        const pts = sh?.rect ? [[sh.rect[0], sh.rect[1]], [sh.rect[0] + sh.rect[2], sh.rect[1] + sh.rect[3]]] : sh?.poly || (sh?.circle ? [sh.circle.slice(0, 2)] : []);
        if (pts.length && !sh.circle) {
          this.select(turning);
          const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), centre = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
          return { kind: "turn", path: turning, item, centre, from: Math.atan2(at.p[1] - centre[1], at.p[0] - centre[0]) };
        }
      }
      if (!this.model.home) {
        this._message("Fix the mistakes listed here first: the plan shows the last version without them.");
        return { kind: "none" };
      }
      const data = this.model.data, view = this._home.view.w / 1145;
      const frame = this._inside !== null, piece = this._piece(data);
      const targets = (except) => frame ? insideTargets(piece, except.filter(isExtra).map((p) => p[3]), view) : snapTargets(this._items(data, except), except, view);
      if (press.handle) {
        const { item, id } = startHandle(this._sel, itemAt(data, this._sel), press.handle.id, this._withPiece(this._sel, data));
        return { kind: "handle", path: this._sel, item, id, from: press.handle.at, frame, targets: targets([this._sel]) };
      }
      const object = this._objectAt(hits[0]);
      if (object) {
        this._selectObject(object);
        const gap = gapOf(data, object);
        if (gap) return { kind: "slide", gap, from: at.p };
        if (this._isCut(object)) {
          this._message("This window or door isn't in a gap that it and its neighbours fill side by side (drawn by hand): move it in the Edit view.", "info");
          return { kind: "none" };
        }
        if (data.rooms?.[object] !== void 0) {
          if (!moveRoomOps(data, object, 0, 0)) {
            this._message("A room of several rectangles or a polygon is moved in the Edit view (its walls weren't made with it).", "info");
            return { kind: "none" };
          }
          return { kind: "room", id: object, from: at.p };
        }
      }
      if (!hits.some((h2) => this._sels.some((p) => samePath2(p, h2)))) frame ? this._selectAll(hits.slice(0, 1)) : this.select(hits[0]);
      const paths = this._sels, items = paths.map((p) => itemAt(data, p));
      return {
        kind: "move",
        paths,
        items,
        from: at.p,
        frame,
        pts: paths.flatMap((p, i) => anchors(p, items[i], view, frame ? {} : this._withPiece(p, data))),
        axes: paths.length === 1 ? axesOf(paths[0], items[0]) : [1, 1],
        targets: targets(paths)
      };
    }
    // Every item of the home: [[path, item]]; inside a piece, its shapes. A room without its rectangles in `except`.
    _items(data, except = []) {
      if (this._inside !== null) {
        const list = this._piece(data)?.extra;
        return Array.isArray(list) ? list.map((s, i) => [["furniture", this._inside, "extra", i], s]) : [];
      }
      const parts = except.filter((p) => p[0] === "rooms" && p.length === 3);
      return itemGroups(data).flatMap((g) => g.items.map((it) => {
        const item = itemAt(data, it.path), out = parts.filter((p) => p[1] === it.path[1] && it.path[0] === "rooms").map((p) => p[2]);
        return [it.path, out.length ? item.filter((_, i) => !out.includes(i)) : item];
      }));
    }
    // The pointer moved while pressed: starts the drag once it's far enough, then previews it.
    _dragTo(e) {
      const press = this._press;
      if (press.create) return this._drawTo(e, press);
      if (!press.drag) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG) return;
        press.drag = this._startDrag(press);
      }
      const drag = press.drag, at = this._at(e);
      if (!at || drag.kind === "none") return;
      const snap = { ...drag.targets, tol: at.tol, grid: e.altKey ? 0 : this._grid(), axis: e.shiftKey };
      if (e.altKey) Object.assign(snap, { xs: [], ys: [] });
      let guides = {}, ruler = null;
      if (drag.kind === "box") {
        const [x0, y0, x1, y1] = boundsOf([drag.from, at.p]);
        Object.assign(drag, { rect: [x0, y0, x1, y1] });
        this._el.box.setAttribute("x", x0);
        this._el.box.setAttribute("y", y0);
        this._el.box.setAttribute("width", x1 - x0);
        this._el.box.setAttribute("height", y1 - y0);
        ruler = { size: [x1 - x0, y1 - y0] };
      } else if (drag.kind === "move") {
        const [to, from] = drag.frame ? [this._toFrame(at.p), this._toFrame(drag.from)] : [at.p, drag.from];
        const moved = snapMove(drag.pts, to[0] - from[0], to[1] - from[1], { ...snap, axes: drag.axes });
        guides = moved.guides;
        const [o, d] = drag.frame ? [this._fromFrame([0, 0]), this._fromFrame([moved.dx, moved.dy])] : [[0, 0], [moved.dx, moved.dy]];
        drag.changes = drag.paths.map((p, i) => [p, moveItem(p, drag.items[i], d[0] - o[0], d[1] - o[1], this._withPiece(p, this._data))]);
        ruler = { move: [moved.dx, moved.dy] };
      } else if (drag.kind === "turn") {
        const a = (Math.atan2(at.p[1] - drag.centre[1], at.p[0] - drag.centre[0]) - drag.from) * 180 / Math.PI;
        const sh = drag.item.shape, step = e.altKey ? 1 : TURN_STEP, d = Math.round(a / step) * step;
        const turn2 = (((sh.turn || 0) + d) % 360 + 360) % 360, { turn: _, ...rest } = sh;
        const value = { ...drag.item, shape: turn2 ? { ...rest, turn: turn2 } : rest };
        drag.changes = [[drag.path, value]];
        ruler = null;
        this._el.ruler.dataset.text = `${(d % 360 + 360) % 360}\xB0`;
      } else if (drag.kind === "room") {
        const g = e.altKey ? 0 : this._grid(), d = [0, 1].map((k) => at.p[k] - drag.from[k]).map((v) => g ? Math.round(v / g) * g : v);
        if (e.shiftKey) d[Math.abs(d[0]) < Math.abs(d[1]) ? 0 : 1] = 0;
        if (drag.d?.[0] !== d[0] || drag.d?.[1] !== d[1]) {
          drag.d = d;
          drag.ops = moveRoomOps(this._data, drag.id, d[0], d[1], e.altKey ? 0 : 0.3 * (this._data.units_per_metre || 100))?.ops;
          if (drag.ops) this._showPreview(null, drag.ops);
        }
        ruler = { move: d };
      } else if (drag.kind === "slide") {
        const ax = drag.gap.axis, grid = e.altKey ? 0 : this._grid(), d = at.p[ax] - drag.from[ax];
        drag.changes = slideOps(this._data, drag.gap, grid ? Math.round(d / grid) * grid : d).map((op) => [op.set, op.value]);
        ruler = { move: ax === 0 ? [d, 0] : [0, d] };
      } else if (drag.kind === "handle") {
        let p = at.p;
        const piece = this._withPiece(drag.path, this._data);
        if (!e.altKey && snapsHandle(drag.path, drag.item, drag.id, piece)) {
          const local = drag.frame ? snapPoint(this._toFrame(p), { ...snap, from: this._toFrame(drag.from) }) : snapPoint(p, { ...snap, from: drag.from });
          ({ guides } = local);
          p = drag.frame ? this._fromFrame(local.p) : local.p;
        }
        const done = dragHandle(drag.path, drag.item, drag.id, p, { turnStep: e.altKey ? 0 : TURN_STEP, insides: !e.altKey, ...piece });
        drag.changes = [[drag.path, done.item]];
        ruler = done.ruler;
      }
      this._showGuides(guides);
      const [fx, fy] = this._inFrame(e.clientX, e.clientY);
      Object.assign(this._el.ruler.style, { left: `${fx + 16}px`, top: `${fy + 16}px` });
      this._el.ruler.textContent = drag.kind === "turn" ? this._el.ruler.dataset.text : rulerText(ruler, this._data.units_per_metre);
      if (drag.changes) this._showPreview(drag.changes);
    }
    // Lines across the view where a snap lined things up.
    // Inside a turned piece they're in its frame (the guides are drawn turned with it), so they reach further.
    _showGuides({ x, y } = {}) {
      const v = this._home.view, far = this._inside === null ? 0 : Math.max(v.w, v.h);
      const [x0, y0, x1, y1] = [v.x - far, v.y - far, v.x + v.w + far, v.y + v.h + far];
      this._el.guides.innerHTML = (x !== void 0 ? `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>` : "") + (y !== void 0 ? `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>` : "");
    }
    // The card and the overlay as they'd be with `changes` ([[path, value]]), drawn at most once a frame. A version
    // that doesn't pass the check isn't shown.
    _showPreview(changes, ops) {
      this._pending = ops ? { ops } : changes;
      this._frameRequest || (this._frameRequest = requestAnimationFrame(() => {
        this._frameRequest = 0;
        if (!this._pending) return;
        const data = this._pending.ops ? applyOps(this._data, this._pending.ops) : structuredClone(this._data);
        if (!this._pending.ops) for (const [path, value] of this._pending) path.slice(0, -1).reduce((o, k) => o[k], data)[path.at(-1)] = value;
        this._pending = null;
        try {
          this._preview = { data, home: defineHome(data) };
        } catch {
          return;
        }
        this._renderCard();
      }));
    }
    // The drag is over: the changes become one edit, a box selects what's inside it.
    _endDrag(drag) {
      const changes = drag.changes;
      this._clearDrag();
      if (drag.kind === "box" && drag.rect) {
        const [x0, y0, x1, y1] = drag.rect, view = this._home.view.w / 1145;
        const inside = this._items(this._data).filter(([path, item]) => {
          const pts = anchors(path, item, view, this._withPiece(path, this._data));
          return pts.length && pts.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
        }).map(([path]) => path);
        this._selectAll(drag.add ? [...this._sels, ...inside] : inside);
      } else if (drag.kind === "room" && drag.ops) {
        this._edit(() => this.model.batch(drag.ops));
        this._selectObject(drag.id);
        this._renderCard();
      } else if (changes) {
        const ops = changes.map(([path, value]) => ({ set: path, value }));
        if (this._view === "build" && drag.kind === "move") ops.push(...regroupOps(applyOps(this._data, ops), drag.paths));
        this._edit(() => this.model.batch(ops));
        this._renderCard();
      }
    }
    // Escape, or the browser took the pointer: the drag is dropped, nothing changes.
    _cancelDrag() {
      if (!this._press) return;
      this._press = null;
      this._el.draft.innerHTML = "";
      this._clearDrag();
      this._renderCard();
    }
    _clearDrag() {
      cancelAnimationFrame(this._frameRequest);
      this._frameRequest = 0;
      this._pending = null;
      this._preview = null;
      this._showGuides();
      this._el.ruler.textContent = "";
      this._el.box.setAttribute("width", 0);
      this._el.box.setAttribute("height", 0);
    }
    // Plays an effect of the home on a lamp (its entity on, reporting the effect), until stopped (name null).
    _previewEffect(name, entity) {
      this._effect = name && entity ? { name, entity } : null;
      this._renderCard();
      this._renderPanels();
    }
    // The states the card is shown with: the simulator's, with the lamp playing a previewed effect.
    _effectStates() {
      const states = this._shown.states, fx = this._effect;
      if (!fx) return states;
      const s = states[fx.entity] || { entity_id: fx.entity, attributes: {} };
      return { ...states, [fx.entity]: { ...s, state: "on", attributes: { ...s.attributes, effect: fx.name } } };
    }
    // The view: 'build' (a home step by step: rooms with their walls, windows and doors clicked onto them) or 'edit'
    // (every tool and field). Both work on the same home and history.
    setView(view) {
      if (view !== "build" && view !== "edit") return;
      this._view = view;
      this.setAttribute("view", view);
      for (const b of this._root.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", b.dataset.view === view);
      this._el.toolbar.dataset.shows = view;
      if (view === "build" && this._inside !== null) this._leave();
      if (view !== "build" && this._group !== null) this._out();
      this._tab(view === "build" ? "props" : "list");
      this.setTool("select");
      this._placeTools();
      if (this.model) this._renderPanels();
    }
    // The details panel: a Build object's settings when one is selected whole; with nothing selected, the tool's choices
    // (in Build's Select, the home's); otherwise the selected item's properties.
    _renderDetails() {
      const box2 = this._el.props, data = this.model?.data;
      const id = this._view === "build" && this._group === null && this._inside === null && data ? this._objectOf(this._sels) : void 0;
      if (id && partsOf(data, id).length === this._sels.length) return this._groupDetails(box2, id);
      if (this._group !== null && data) return this._memberDetails(box2);
      if (!this._sels.length && (this._view === "build" || this._tool !== "select")) return this._toolDetails(box2);
      if (this._sels.length > 1) return this._multiDetails(box2);
      renderProperties(box2, data, this._sel, { ...this._ctx, data, states: this._shown.states, previewing: this._effect });
    }
    // Inside a Build object: the way back to it whole, and each of its parts, folded but those selected (and those
    // unfolded by hand).
    _memberDetails(box2) {
      const data = this.model.data, back = h("button", { type: "button", textContent: `\u2039 Back to ${this._groupName(this._group)}`, title: "The whole of it again, with its settings (Esc)" });
      back.onclick = () => this._leaveGroup();
      const parts = partsOf(data, this._group);
      this._folds(
        box2,
        parts.map((p) => this._itemEntry(p)),
        (key) => this._sels.some((p) => pathKey(p) === key),
        h("p", { className: "back" }, back),
        h("p", { className: "help", textContent: `Its ${parts.length} parts: click one on the plan to select it.` })
      );
    }
    // The item at `path` as an entry of a folded list: its kind and name, and its properties form.
    _itemEntry(p) {
      const data = this.model.data, group = itemGroups(data).find((g) => samePath2(g.path, p.slice(0, -1)));
      const label = group?.items.find((it) => samePath2(it.path, p))?.label ?? p.join(".");
      return {
        key: pathKey(p),
        title: `${group ? `${group.title}: ` : ""}${label}`,
        render: (b) => renderProperties(b, data, p, { ...this._ctx, data, states: this._shown.states, previewing: this._effect })
      };
    }
    // A list of entries ({key, title, render(box)}) folded in `box`, after `head`: unfolded when `wanted` says so (what's
    // selected), unless folded by hand (until the selection changes), or when unfolded by hand. A form is built when it's unfolded.
    _folds(box2, entries, wanted, ...head) {
      const opened = this._unfolded || (this._unfolded = /* @__PURE__ */ new Set()), closed = this._folded || (this._folded = /* @__PURE__ */ new Set());
      box2.textContent = "";
      box2.append(...head);
      for (const entry of entries) {
        const auto = wanted(entry.key), body = h("div", { className: "body" });
        const fold = h("details", { className: "multi", open: auto ? !closed.has(entry.key) : opened.has(entry.key) }, h("summary", { textContent: entry.title }), body);
        const fill = () => {
          if (fold.open && !body.childElementCount) entry.render(body);
        };
        fold.ontoggle = () => {
          const set2 = auto ? closed : opened;
          if (fold.open === auto) set2.delete(entry.key);
          else set2.add(entry.key);
          fill();
        };
        fill();
        box2.append(fold);
      }
    }
    // Several things selected: each of them, folded (a click unfolds it, and it stays so while it's selected). In the
    // Build view, an object selected whole is one of them, with its settings; anything else has its properties.
    _multiDetails(box2) {
      const data = this.model.data, entries = [], seen = /* @__PURE__ */ new Set();
      for (const p of this._sels) {
        const id = this._view === "build" && this._group === null && this._inside === null ? this._objectAt(p) : void 0;
        if (id && partsOf(data, id).every((q) => this._sels.some((r) => samePath2(q, r)))) {
          if (!seen.has(id)) {
            seen.add(id);
            entries.push({ key: `object:${id}`, title: `${this._groupKind(id)}: ${this._groupName(id)}`, render: (b) => this._groupDetails(b, id, { single: false }) });
          }
        } else entries.push(this._itemEntry(p));
      }
      this._folds(box2, entries, () => false, h("p", { className: "help", textContent: `${entries.length} selected: they move together, and Delete deletes them all.` }));
    }
    // With nothing selected: what the tool does, and its choices (the catalogue, the devices, a room's name, a cut's
    // kind and width); in Build's Select, the home's settings.
    _toolDetails(box2) {
      box2.textContent = "";
      const tool = this._tool, build = this._view === "build", data = this.model?.data;
      const title = {
        select: build ? "Your home" : "The home",
        "build-room": "Rooms",
        "build-cut": "Windows and doors",
        "build-piece": "Furniture",
        "build-device": "Lamps and devices",
        "build-north": "North"
      }[tool] || TOOLS.find((t) => t[0] === tool)?.[2].replace(/ \(.\)$/, "");
      box2.append(h("h2", { textContent: title }), h("p", { className: "help", textContent: (build ? BUILD_HELP[tool] : null) || HINTS[tool] }));
      const options = h("div", { className: "options" });
      options.innerHTML = this._optionsHtml();
      if (options.innerHTML) {
        box2.append(options);
        this._wireOptions(options);
      }
      if (build && tool === "select" && data) {
        const adopt = this.model.home ? adoptOps(data) : [];
        if (adopt.length) {
          const b = h("button", { type: "button", textContent: "Find them" });
          b.onclick = () => this._edit(() => this.model.batch(adoptOps(this.model.data)));
          box2.append(h("p", { className: "adopt" }, `This home has rooms, windows, doors or lamps not made in Build (${adopt.length} parts): find them, so that Build picks each as one. `, b));
        }
        const rooms = Object.keys(data.rooms || {}).length, cuts = (data.openings || []).length;
        box2.append(h("p", { className: "help", textContent: `${rooms} room${rooms === 1 ? "" : "s"}, ${cuts} window${cuts === 1 ? "" : "s"} and glass door${cuts === 1 ? "" : "s"} so far.` }));
      }
      if (tool === "build-device") this._renderDevices(box2);
      if (tool !== "build-piece") return;
      for (const group of Object.values(PREFABS)) {
        box2.append(h("h3", { textContent: group.title }));
        const grid = h("div", { className: "catalogue" });
        for (const [id, item] of Object.entries(group.items)) {
          const b = h("button", { type: "button", draggable: true, title: `${item.name}: ${item.w} \xD7 ${item.d} m${item.height ? `, ${item.height} m high` : ""}` });
          b.innerHTML = `${prefabSvg(id)}<span></span>`;
          b.querySelector("span").textContent = item.name;
          b.setAttribute("aria-pressed", this._opts.prefab === id);
          b.onclick = () => {
            this._opts.prefab = id;
            this._renderDetails();
          };
          b.ondragstart = (e) => {
            this._opts.prefab = id;
            e.dataTransfer.setData("text/x-lightwell-prefab", id);
            e.dataTransfer.effectAllowed = "copy";
          };
          grid.append(b);
        }
        box2.append(grid);
      }
    }
    // A Build object selected whole: what it is, and its settings. A lamp: which light it is. A window or door: its width
    // and heights. Furniture from the catalogue: which piece it is (another replaces it, in its place), and a turn. A
    // room: its name and size. Its parts are a double-click (or Enter) away.
    // (`single`: it's all that's selected; otherwise it's one of several, in their list, and they stay selected.)
    _groupDetails(box2, id, { single = true } = {}) {
      box2.textContent = "";
      const data = this.model.data, parts = partsOf(data, id), u = data.units_per_metre || 100, metres = (v) => +(v / u).toFixed(2);
      const room = data.rooms?.[id] !== void 0, lamp = parts.some((p) => p[0] === "lights"), cut = !room && this._isCut(id);
      const found = !room && !lamp && !cut && parts.every((p) => p[0] === "furniture") ? prefabOf(data, id) : null;
      const kind = this._groupKind(id), keep = () => {
        if (single) this._selectObject(id);
      };
      const enter = h("button", { type: "button", textContent: "Its parts", title: "Change its parts one by one (double-click it, or Enter)" });
      enter.onclick = () => this._enterGroup(id, [parts.at(-1)]);
      const del = h("button", { type: "button", className: "delete", textContent: "Delete", title: "Delete it (Delete)" });
      del.onclick = () => this._remove(partsOf(this.model.data, id));
      box2.append(h("div", { className: "title" }, single ? h("h2", { textContent: `${kind}: ${this._groupName(id)}` }) : h("span", { className: "grow" }), enter, del));
      const row2 = (label, ...kids) => h("div", { className: "row" }, h("span", { className: "key", textContent: label }), h("span", { className: "value" }, ...kids));
      const number = (value, onchange, attrs2 = {}) => {
        const i = h("input", { type: "number", value, step: 0.05, min: 0, ...attrs2 });
        i.onchange = () => {
          const v = +i.value;
          if (i.value !== "" && Number.isFinite(v)) onchange(v);
        };
        return i;
      };
      const unit = (text2) => h("span", { className: "unit", textContent: text2 });
      if (lamp) box2.append(this._lampPicker(id, keep));
      if (room) {
        const label = parts.find((p) => p[1] === "labels"), name = h("input", { type: "text", value: label && itemAt(data, label)?.text || "", placeholder: "none: no label", spellcheck: false });
        name.onchange = () => this._setRoomName(id, name.value.trim());
        box2.append(row2("Name", name));
        const r = data.rooms[id];
        if (r.length === 1 && Array.isArray(r[0]) && !Array.isArray(r[0][0])) {
          const resize = (w2, d2) => {
            const made = moveRoomOps(this.model.data, id, 0, 0, 0, [tidy(w2 * u), tidy(d2 * u)]);
            if (made) this._edit(() => this.model.batch(made.ops));
            keep();
          };
          const [w, d] = [metres(r[0][2]), metres(r[0][3])];
          box2.append(row2("Size", number(w, (v) => resize(v, d), { min: 0.5 }), unit("\xD7"), number(d, (v) => resize(w, v), { min: 0.5 }), unit("m")));
        } else box2.append(h("p", { className: "help", textContent: "A room of several rectangles, or a polygon: its shape is changed in the Edit view." }));
      }
      if (cut) {
        const found2 = cutRunOf(data, id);
        if (found2) {
          const { bounds, cuts } = found2.run, i = found2.index;
          const width = number(metres(bounds[i + 1] - bounds[i]), (v) => {
            if (v * u >= 0.3 * u) this._edit(() => this.model.batch(resizeCutOps(this.model.data, id, v * u)));
            keep();
          }, { min: 0.3 });
          box2.append(row2("Width", width, unit("m")));
          if (cuts.length > 1) box2.append(h("p", { className: "help", textContent: `Side by side with ${cuts.filter((c) => c.id !== id).map((c) => this._groupName(c.id)).join(", ")}: they slide together, and the end they share moves both.` }));
          const split = h("button", { type: "button", textContent: "Split in two", title: "Two side by side in its place: a two-pane window, or a door beside a door" });
          split.onclick = () => {
            const made = splitCutOps(this.model.data, id);
            if (!made) return this._message("Too narrow to split: each needs 30 cm at least.", "info");
            this._edit(() => this.model.batch(made.ops));
            this._selectObject(made.part);
          };
          box2.append(row2("", split));
        } else box2.append(h("p", { className: "help", textContent: "Not in a gap in the wall that it and its neighbours fill side by side (drawn by hand): its size is changed in the Edit view." }));
        const opening = parts.find((p) => p[0] === "openings"), o = opening && itemAt(data, opening);
        if (o) {
          const set2 = (key, v) => {
            this._edit(() => this.model.set([...opening, key], v));
            keep();
          };
          box2.append(row2("From", number(o.lo ?? 0, (v) => set2("lo", v)), unit("m above the floor")), row2("To", number(o.hi ?? 2.2, (v) => set2("hi", v)), unit("m")));
        }
      }
      if (kind === "Furniture") {
        const select = h("select", { disabled: !found, title: found ? "Another piece in its place" : "Its pieces were changed since it was placed: delete it and place another" });
        for (const group of Object.values(PREFABS)) {
          const og = h("optgroup", { label: group.title });
          for (const [pid, item] of Object.entries(group.items)) if (!item.lamp) og.append(h("option", { value: pid, textContent: item.name, selected: found?.id === pid }));
          if (og.children.length) select.append(og);
        }
        if (!found) select.prepend(h("option", { value: "", textContent: "Changed since it was placed", selected: true }));
        select.onchange = () => this._replacePrefab(id, select.value);
        const turn2 = h("button", { type: "button", textContent: "Turn \u21BB", title: "Turn it a quarter (R)" });
        turn2.onclick = () => this._turnPieces(90, parts);
        box2.append(row2("Which", select), row2("", turn2));
      }
    }
    // In the Build view, the home's objects for the list: [{id, kind, name, parts}], in the order their items come.
    _objects() {
      const data = this.model?.data;
      if (this._view !== "build" || !data) return null;
      const ids = [...new Set(itemGroups(data).flatMap((g) => g.items.map((it) => partOf2(data, it.path))).filter(Boolean))];
      return ids.map((id) => ({ id, parts: partsOf(data, id) })).filter((o) => o.parts.length).map((o) => ({ ...o, kind: this._groupKind(o.id), name: this._groupName(o.id) }));
    }
    // What kind of Build object `id` is, in words.
    _groupKind(id) {
      const data = this.model.data, parts = partsOf(data, id);
      if (data.rooms?.[id] !== void 0) return "Room";
      if (parts.some((p) => p[0] === "lights")) return "Lamp";
      if (this._isCut(id)) return { window: "Window", glass_door: "Glass door", door: "Door", doorway: "Doorway" }[id.replace(/_\d+$/, "")] || "Window or door";
      return parts.every((p) => p[0] === "furniture") ? "Furniture" : "Object";
    }
    // The catalogue's object `id` replaced by the prefab `with`, where it is and turned as it is.
    _replacePrefab(id, other) {
      const data = this.model.data, found = prefabOf(data, id);
      if (!found || !other) return;
      const del = deleteOps(data, id), made = placePrefab(applyOps(data, del), other, found.at, found.turn);
      if (!made) return;
      this._edit(() => this.model.batch([...del, ...made.ops]));
      this._selectObject(made.part);
    }
    // A room's name: its label's text (a label added in its middle when it has none; none when emptied).
    _setRoomName(room, text2) {
      const data = this.model.data, label = partsOf(data, room).find((p) => p[0] === "drawing" && p[1] === "labels"), shape = label && itemAt(data, label);
      if (text2 === (shape?.text ?? "")) return;
      const r = data.rooms[room][0], spot = shape?.at || (Array.isArray(r?.[0]) ? r[0] : [r[0] + r[2] / 2, r[1] + r[3] / 2]);
      this._edit(() => this.model.batch(!text2 ? [{ remove: label }] : label ? [{ set: [...label, "text"], value: text2 }] : [{ insert: ["drawing", "labels"], value: { text: text2, at: spot.map(tidy), class: "room", part: room } }]));
      this._selectObject(room);
    }
    // The prefab about to be placed turned a quarter.
    _turnPrefab() {
      this._opts.turn = (this._opts.turn + 90) % 360;
      if (this._lastAt) this._prefabPreview(this._lastAt);
    }
    // Which light the selected lamp (object `id`) is: an entity of the states in use, or none (lit always, while the sun
    // is down, or never). Its marker follows its entity; without one it has none.
    _lampPicker(id, keep = () => this._selectObject(id)) {
      const data = this.model.data, paths = partsOf(data, id), lightPath = paths.find((p) => p[0] === "lights"), light = itemAt(data, lightPath);
      const markers = paths.filter((p) => p[0] === "markers"), current = light?.entities?.[0] ?? `lit:${light?.lit || "dark"}`;
      const choices2 = devicesIn(this._shown.states).filter((d) => ["light", "switch", "fan", "media_player"].includes(d.domain));
      const row2 = Object.assign(document.createElement("p"), { className: "lamp" });
      const select = document.createElement("select");
      const option = (value, text2) => Object.assign(document.createElement("option"), { value, textContent: text2, selected: value === current });
      const none = Object.assign(document.createElement("optgroup"), { label: "Not in Home Assistant" });
      none.append(option("lit:always", "No entity: always lit"), option("lit:dark", "No entity: lit after dark"), option("lit:never", "No entity: never lit"));
      const known = Object.assign(document.createElement("optgroup"), { label: "Your devices" });
      known.append(...choices2.map((d) => option(d.id, `${d.name} (${d.id})`)));
      if (!current.startsWith("lit:") && !choices2.some((d) => d.id === current)) known.prepend(option(current, current));
      select.append(known, none);
      select.onchange = () => {
        const v = select.value, x = light.pool?.x ?? lightCentre(light)[0], y = light.pool?.y ?? lightCentre(light)[1];
        const ops = [];
        if (v.startsWith("lit:")) {
          const { entities: _, states: __, ...rest } = light;
          ops.push({ set: lightPath, value: { ...rest, lit: v.slice(4) } });
          for (const m2 of [...markers].reverse()) ops.push({ remove: m2 });
        } else {
          const { lit: _, ...rest } = light;
          ops.push({ set: lightPath, value: { ...rest, entities: [v] } });
          if (markers.length) for (const m2 of markers) ops.push({ set: [...m2, "entity"], value: v });
          else ops.push({ insert: ["markers"], value: { entity: v, x, y, icon: iconOf2(v, this._shown.states?.[v]), tap: "toggle", small: true, part: id } });
        }
        this._edit(() => this.model.batch(ops));
        keep();
      };
      row2.append(Object.assign(document.createElement("strong"), { textContent: "This light is " }), select);
      return row2;
    }
    // The Build panel's devices: a search, and the entities in use by domain, those on the plan ticked.
    _renderDevices(box2) {
      const search = Object.assign(document.createElement("input"), { type: "search", placeholder: "Search your devices", value: this._opts.search });
      const list = Object.assign(document.createElement("div"), { className: "devices" });
      const fill = () => {
        const placed = placedIn(this.model.data), found = devicesIn(this._shown.states, this._opts.search);
        list.innerHTML = "";
        if (!found.length) list.append(Object.assign(document.createElement("p"), { className: "muted", textContent: Object.keys(this._shown.states || {}).length ? "Nothing found." : "No devices: connect to Home Assistant for yours." }));
        for (const d of found.slice(0, 200)) {
          const b = Object.assign(document.createElement("button"), { type: "button", draggable: true, title: d.id });
          b.innerHTML = `<ha-icon></ha-icon><span class="dn"></span><span class="tick">${placed.has(d.id) ? "\u2713" : ""}</span>`;
          b.querySelector("ha-icon").setAttribute("icon", d.icon);
          b.querySelector(".dn").textContent = d.name;
          b.setAttribute("aria-pressed", this._opts.device === d.id);
          b.onclick = () => {
            this._opts.device = d.id;
            fill();
          };
          b.ondragstart = (e) => {
            this._opts.device = d.id;
            e.dataTransfer.setData("text/x-lightwell-device", d.id);
            e.dataTransfer.effectAllowed = "copy";
          };
          list.append(b);
        }
      };
      search.oninput = () => {
        this._opts.search = search.value;
        fill();
      };
      fill();
      box2.append(search, list);
    }
    // Places the entity `id` (the one chosen) at `p`: a lamp, a shutter, or a marker; selects what it made.
    _placeDevice(p, tol, id = this._opts.device) {
      if (!id) return this._message("Choose a lamp or device in the details first.", "info");
      if (!this.model.home) return this._message("Fix the mistakes listed here first: the plan shows the last version without them.");
      const g = this._grid(), at = p.map((v) => tidy(Math.round(v / g) * g));
      const made = placeDevice(this.model.data, id, this._shown.states?.[id], at, Math.max(tol, 0.3 * (this._data?.units_per_metre || 100)));
      this._edit(() => this.model.batch(made.ops));
      this._selectObject(made.part);
      if (made.what === "shutter") this._message(`${id} is that window's shutter now: the window darkens as it closes.`, "info");
    }
    // North: the bearing the top of the plan faces, from a click in north's direction (from the middle of the view).
    _northFrom(p) {
      const v = this._home.view, c = [v.x + v.w / 2, v.y + v.h / 2];
      const towards = Math.atan2(p[0] - c[0], -(p[1] - c[1])) * 180 / Math.PI;
      return Math.round(((360 - towards) % 360 + 360) % 360);
    }
    // An arrow from the middle of the view towards north, at `north` (the bearing the top faces).
    _northArrow(north) {
      const v = this._home?.view;
      if (!v) return;
      const c = [v.x + v.w / 2, v.y + v.h / 2], len = Math.min(v.w, v.h) * 0.35, a = (360 - north) * Math.PI / 180;
      const tip = [c[0] + Math.sin(a) * len, c[1] - Math.cos(a) * len], f = (q) => q.map((n2) => +n2.toFixed(1)).join(",");
      const side = (s) => [tip[0] - Math.sin(a + s) * len * 0.12, tip[1] + Math.cos(a + s) * len * 0.12];
      this._el.draft.innerHTML = `<g class="north"><line x1="${c[0]}" y1="${c[1]}" x2="${tip[0]}" y2="${tip[1]}"/><polyline points="${f(side(0.5))} ${f(tip)} ${f(side(-0.5))}"/><text x="${tip[0]}" y="${tip[1]}" dy="-0.6em">N</text></g>`;
    }
    // The chosen prefab placed with its middle at `p` (snapped to the grid), as it would be: {ops, keys}.
    _prefabAt(p, snap = true) {
      const g = this._grid(), at = snap ? p.map((v) => tidy(Math.round(v / g) * g)) : p;
      return placePrefab(this.model.data, this._opts.prefab, at, this._opts.turn, { entity: this._freeLight() });
    }
    // The chosen prefab's outline under the pointer.
    _prefabPreview(p) {
      const made = this._prefabAt(p), f = (v) => +v.toFixed(1);
      const svg = (sh) => sh.poly ? `<polygon points="${sh.poly.map((q) => q.map(f).join(",")).join(" ")}"/>` : sh.circle ? `<circle cx="${f(sh.circle[0])}" cy="${f(sh.circle[1])}" r="${f(sh.circle[2])}"/>` : sh.path ? `<path d="${sh.path}"/>` : sh.rect ? `<rect x="${f(sh.rect[0])}" y="${f(sh.rect[1])}" width="${f(sh.rect[2])}" height="${f(sh.rect[3])}"${sh.rx ? ` rx="${sh.rx}"` : ""}/>` : "";
      this._el.draft.innerHTML = made ? made.ops.flatMap(({ value: v }) => v?.shape && !Array.isArray(v.shape) ? [v.shape] : Array.isArray(v?.shape) ? v.shape : []).map(svg).join("") : "";
    }
    // Places the chosen prefab at `p`, selecting what it made.
    _placePrefab(p) {
      if (!this.model.home) return this._message("Fix the mistakes listed here first: the plan shows the last version without them.");
      const made = this._prefabAt(p);
      if (!made) return;
      this._edit(() => this.model.batch(made.ops));
      if (made.part) this._selectObject(made.part);
      else this._selectAll(made.keys.map((k) => ["furniture", k]));
    }
    // A light for a new lamp: the first in the states in use that isn't on the plan yet.
    _freeLight() {
      const placed = placedIn(this.model.data);
      return devicesIn(this._shown.states).find((d) => d.domain === "light" && !placed.has(d.id))?.id || "light.new_light";
    }
    // The tool in use: 'select', or one that draws (wall, room, opening, piece, light, marker, label, scale).
    // Inside a piece of furniture, only those that draw its insides (piece, label) and the scale.
    setTool(tool) {
      if (!HINTS[tool] || this._inside !== null && !INSIDE_HINTS[tool]) return;
      this._tool = tool;
      this._poly = null;
      this._el.overlay.classList.remove("grab", "grab-x", "grab-y");
      this._cancelDrag();
      this._el.draft.innerHTML = "";
      if (tool === "build-north") this._northArrow(this.model?.data?.sun?.north ?? 0);
      if (this._ha && tool !== "select" && !this._sels.length) this._tab("props");
      this._renderTools();
      this._renderOverlay();
    }
    // The tools' buttons, options and hint, for the tool in use and whether a piece is being edited.
    _renderTools() {
      const inside = this._inside !== null, tool = this._tool;
      for (const b of this._el.toolbar.querySelectorAll("[data-tool]")) {
        b.setAttribute("aria-pressed", b.dataset.tool === tool || tool === "build-north" && b.dataset.tool === "select");
        b.disabled = inside && !INSIDE_HINTS[b.dataset.tool] || this._group !== null && b.dataset.tool !== "select";
      }
      const piece = this._el.toolbar.querySelector('[data-tool="piece"]');
      piece.title = inside ? `Shapes on ${this._inside} (F)` : "Furniture (F)";
      this._el.overlay.classList.toggle("drawing", tool !== "select");
      this._el.hint.textContent = this._el.hint.title = inside ? INSIDE_HINTS[tool].replace("{name}", this._inside) : this._group !== null ? GROUP_HINT.replace("{name}", this._groupName(this._group)) : HINTS[tool];
      this._renderDetails();
    }
    // The selected pieces turned by `deg` (a quarter): each around its middle, or a Build object's around the middle of
    // them all, so that a table keeps its chairs round it.
    _turnPieces(deg, among = this._sels) {
      const data = this.model.data, paths = among.filter((p) => p[0] === "furniture" && p.length === 2);
      const middle = (it) => {
        const sh = it.shape;
        return sh.circle?.slice(0, 2) || (sh.rect ? [sh.rect[0] + sh.rect[2] / 2, sh.rect[1] + sh.rect[3] / 2] : boundsOf(sh.poly).reduce((a2, v, i) => (a2[i % 2] += v / 2, a2), [0, 0]));
      };
      const whole = paths.length > 1 && this._objectOf(paths);
      const [x0, y0, x1, y1] = whole ? boundsOf(paths.map((p) => middle(itemAt(data, p)))) : [0, 0, 0, 0], c = [(x0 + x1) / 2, (y0 + y1) / 2];
      const a = deg * Math.PI / 180, [cos, sin] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
      this._edit(() => this.model.batch(paths.map((p) => {
        const item = itemAt(data, p), turned2 = turnedPiece(item, deg);
        if (!whole) return { set: p, value: turned2 };
        const [mx, my] = middle(item), [dx, dy] = [mx - c[0], my - c[1]], to = [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
        return { set: p, value: moveItem(p, turned2, tidy(to[0] - mx), tidy(to[1] - my)) };
      })));
    }
    // The tool's choices changed (or what they show): the details show them again, when they're showing.
    _renderOptions() {
      if (!this._sels.length) this._renderDetails();
    }
    // The tool's choices, as HTML (wired by _wireOptions): a room's name, a cut's kind and width, the piece about to be
    // placed, the shapes the Edit tools draw; in Build's Select, north.
    _optionsHtml() {
      const o = this._opts;
      const select = (key, values) => `<label>${{ wall: "Kind", kind: "Kind", piece: "Shape", extra: "Shape", cut: "Kind" }[key] || ""} <select data-opt="${key}">${Object.entries(values).map(([v, t]) => `<option value="${v}"${o[key] === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;
      const check = (key, text2) => `<label><input type="checkbox" data-opt="${key}"${o[key] ? " checked" : ""}> ${text2}</label>`;
      const esc2 = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const north = `<label>The top of the plan faces <input type="number" data-north value="${this.model?.data?.sun?.north ?? 0}" min="0" max="359" step="1" style="width: 4.5em">\xB0 from north</label>`;
      return {
        select: this._view === "build" ? `${north}<span><button type="button" data-point-north title="Click on the plan towards north">Point to north on the plan</button></span>` : "",
        "build-north": north,
        "build-room": `<label>The new room's name <input type="text" data-opt="roomName" value="${esc2(o.roomName)}" placeholder="none: no label" size="14"></label>` + check("outdoor", "outdoors (a terrace, a balcony)"),
        "build-piece": `<span>${esc2(prefab(o.prefab)?.name || "")}: Shift+click on the plan to place it <button type="button" data-turn title="Turn it a quarter (R)">Turn \u21BB</button></span>`,
        "build-cut": select("cut", CUTS) + `<label>Width <input type="number" data-opt="cutWidth" value="${o.cutWidth}" min="0.3" step="0.1" style="width: 4.5em"> m</label>`,
        wall: select("wall", { auto: "Outer or inner, by where", outer: "Outer wall", inner: "Inner wall" }),
        room: check("floor", "with its floor"),
        opening: select("kind", { window: "Window", door: "Door" }) + check("glass", "with its glass"),
        piece: this._inside !== null ? select("extra", { rect: "Rectangle", circle: "Circle", line: "Line" }) : select("piece", { rect: "Rectangle", circle: "Circle", poly: "Polygon" })
      }[this._tool] || "";
    }
    _wireOptions(box2) {
      const o = this._opts, north = box2.querySelector("[data-north]");
      if (north) north.onchange = () => {
        const v = (+north.value % 360 + 360) % 360;
        if (Number.isFinite(v)) this._edit(() => this.model.set(["sun", "north"], v));
      };
      const turn2 = box2.querySelector("[data-turn]");
      if (turn2) turn2.onclick = () => this._turnPrefab();
      const point = box2.querySelector("[data-point-north]");
      if (point) point.onclick = () => this.setTool("build-north");
      for (const input2 of box2.querySelectorAll("[data-opt]")) {
        input2.onchange = () => {
          o[input2.dataset.opt] = input2.type === "checkbox" ? input2.checked : input2.type === "number" ? +input2.value > 0 ? +input2.value : o[input2.dataset.opt] : input2.value;
          this._poly = null;
          this._el.draft.innerHTML = "";
        };
      }
    }
    // A pointer position snapped for drawing: to the other items and the grid (Shift: along an axis from `from`; Alt:
    // not at all), with the guides shown.
    // Inside a piece of furniture, in its frame: snapped to its outline and its shapes.
    _snap(e, at, from) {
      const inside = this._inside !== null, q = inside ? this._toFrame(at.p) : at.p;
      if (e.altKey || !this._data) {
        this._showGuides();
        return q;
      }
      const key = `${this._inside}:${this.model.text}`, k = this._home.view.w / 1145;
      if (this._targets?.key !== key) this._targets = { key, ...inside ? insideTargets(this._piece(), [], k) : snapTargets(this._items(this._data), [], k) };
      const { p, guides } = snapPoint(q, { ...this._targets, tol: at.tol, grid: this._grid(), axis: e.shiftKey && !!from, from });
      this._showGuides(guides);
      return p;
    }
    // What's being drawn, in the overlay: a box, a line, a circle or a polygon so far; the ruler with its size.
    _drawDraft(p, press, e) {
      const f = (v) => +v.toFixed(1), a = press?.start, tool = this._tool, m2 = this._data?.units_per_metre || 100;
      let svg = "", ruler = null;
      if (this._poly) {
        const pts = [...this._poly.points, p];
        svg = `<polyline points="${pts.map((q) => q.map(f).join(",")).join(" ")}"/>` + this._poly.points.map((q) => `<circle class="point" cx="${f(q[0])}" cy="${f(q[1])}" r="${f(3 * this._px())}"/>`).join("");
        ruler = { length: Math.hypot(p[0] - pts.at(-2)[0], p[1] - pts.at(-2)[1]) };
      } else if (a && (tool === "scale" || tool === "opening" || tool === "piece" && this._inside !== null && this._opts.extra === "line")) {
        svg = `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(p[0])}" y2="${f(p[1])}"/>`;
        ruler = { length: Math.hypot(p[0] - a[0], p[1] - a[1]) };
      } else if (a && (tool === "light" || tool === "piece" && (this._inside !== null ? this._opts.extra : this._opts.piece) === "circle")) {
        const r = Math.hypot(p[0] - a[0], p[1] - a[1]);
        svg = `<circle cx="${f(a[0])}" cy="${f(a[1])}" r="${f(r)}"/>`;
        ruler = { radius: r };
      } else if (press && tool === "build-cut") {
        const cut = this._cutRect(press.at, p), r = cut?.rect;
        if (r) svg = `<rect class="cut" x="${f(r[0])}" y="${f(r[1])}" width="${f(r[2])}" height="${f(r[3])}"/>`;
        if (r) ruler = { length: cut.length };
      } else if (a && tool === "build-room") {
        const rect = this._buildRoomRect(a, p);
        svg = `<rect x="${f(rect[0])}" y="${f(rect[1])}" width="${f(rect[2])}" height="${f(rect[3])}"/>`;
        ruler = { size: [rect[2], rect[3]] };
      } else if (a && tool === "wall") {
        const { rect } = wallFrom(this._data, a, p, this._wallOpts());
        svg = `<rect x="${rect[0]}" y="${rect[1]}" width="${rect[2]}" height="${rect[3]}"/>`;
        ruler = { size: [rect[2], rect[3]] };
      } else if (a) {
        const [x0, y0, x1, y1] = boundsOf([a, p]);
        svg = `<rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}"/>`;
        ruler = { size: [x1 - x0, y1 - y0] };
      }
      this._el.draft.innerHTML = svg;
      if (e) {
        const [fx, fy] = this._inFrame(e.clientX, e.clientY);
        Object.assign(this._el.ruler.style, { left: `${fx + 16}px`, top: `${fy + 16}px` });
      }
      this._el.ruler.textContent = rulerText(ruler, m2);
    }
    // A room dragged from `a` to `b` in the Build view: its rectangle, against the walls near its sides (30 cm).
    _buildRoomRect(a, b) {
      const [x0, y0, x1, y1] = boundsOf([a, b]);
      return snapRoom(this.model.data, [x0, y0, x1 - x0, y1 - y0], 0.3 * (this._data?.units_per_metre || 100));
    }
    _wallOpts() {
      return { inner: this._opts.wall === "auto" ? void 0 : this._opts.wall === "inner" };
    }
    _drawTo(e, press) {
      if (!press.drag) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG) return;
        press.drag = { kind: "draw" };
      }
      const at = this._at(e);
      if (at && press.gapEnd) this._resizeGap(e, at, press);
      else if (at) this._drawDraft(this._snap(e, at, press.start), press, e);
    }
    // The end of a window, door or doorway dragged along its wall (to the grid; Alt: not): the card follows, with the
    // wall, the glass and the opening.
    // (In a row of them, where two meet: both follow.) The ruler shows the widths either side of it.
    _resizeGap(e, at, press) {
      const data = this.model.data, { run: run2, k } = press.gapEnd, ax = run2.gap.axis, grid = this._grid(), [lo, hi] = boundaryRange(data, run2, k);
      const v = Math.min(Math.max(e.altKey ? at.p[ax] : Math.round(at.p[ax] / grid) * grid, lo), hi), b = run2.bounds;
      press.gapOps = moveBoundaryOps(data, run2, k, v);
      this._showPreview(press.gapOps.map((op) => [op.set, op.value]));
      const sides = [k > 0 ? v - b[k - 1] : 0, k < b.length - 1 ? b[k + 1] - v : 0].filter((x) => x > 0);
      const [fx, fy] = this._inFrame(e.clientX, e.clientY);
      Object.assign(this._el.ruler.style, { left: `${fx + 16}px`, top: `${fy + 16}px` });
      this._el.ruler.textContent = sides.map((x) => rulerText({ length: x }, data.units_per_metre || 100)).join(" | ");
    }
    // The pointer was let go while drawing: the new item, from the drag (or the click).
    _drawEnd(e, press) {
      const at = this._at(e), moved = !!press.drag, a = press.start, b = at && this._snap(e, at, a);
      this._el.draft.innerHTML = "";
      this._el.ruler.textContent = "";
      this._showGuides();
      if (!b || !this._data) return;
      if (!this.model.home && this._tool !== "scale") return this._message("Fix the mistakes listed here first: the plan shows the last version without them.");
      const data = this.model.data, m2 = data.units_per_metre || 100, tool = this._tool, r = (v) => tidy(v);
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const box2 = () => {
        const [x0, y0, x1, y1] = boundsOf([a, b]);
        return [x0, y0, x1 - x0, y1 - y0].map(r);
      };
      if (this._inside !== null && tool !== "scale") return this._drawInside(a, b, moved);
      if ((tool === "room" || tool === "piece" && this._opts.piece === "poly") && (!moved || this._poly)) return this._addCorner(moved ? b : a);
      if (tool === "build-room") {
        if (!moved) {
          const room = this._hitsAt(press.at).hits.map((h2) => this._objectAt(h2)).find((id) => id && data.rooms?.[id] !== void 0);
          return room ? this._selectObject(room) : this.select(null);
        }
        const rect = this._buildRoomRect(a, b);
        if (rect[2] < 0.5 * m2 || rect[3] < 0.5 * m2) return this._message("A room needs to be at least 50 cm each way: drag out its rectangle.", "info");
        const { key, ops } = roomOps(data, this._opts.roomName, rect, { outdoor: this._opts.outdoor });
        this._opts.roomName = "";
        this._create(ops, ["rooms", key]);
        this._renderOptions();
      } else if (tool === "build-piece") {
        if (!moved) this._placePrefab(press.at.p);
      } else if (tool === "build-device") {
        if (!moved) this._placeDevice(press.at.p, press.at.tol);
      } else if (tool === "build-north") {
        const north = this._northFrom(press.at.p);
        this._edit(() => this.model.set(["sun", "north"], north));
        this._northArrow(north);
        this._renderOptions();
      } else if (tool === "build-cut") {
        if (press.gapEnd) {
          const ops = press.gapOps;
          this._clearDrag();
          if (ops) this._edit(() => this.model.batch(ops));
          return;
        }
        const made = cutOps(data, press.at.p, { kind: this._opts.cut, metres: this._opts.cutWidth, tol: press.at.tol, until: moved ? at.p : void 0 });
        if (!made) return this._message(wallAt(data, press.at.p, press.at.tol) ? `That wall is shorter than ${this._opts.cutWidth} m.` : "Click on a wall.", "info");
        this._create(made.ops, made.opening ? ["openings", (data.openings || []).length] : null);
      } else if (tool === "wall") {
        if (!moved) return;
        this._create([{ insert: ["drawing", "walls"], value: wallFrom(data, a, b, this._wallOpts()) }], ["drawing", "walls", (data.drawing?.walls || []).length]);
      } else if (tool === "room") {
        this._newRoom([box2()], { rect: box2() });
      } else if (tool === "opening") {
        if (!moved) return;
        const made = openingFrom(data, a, b, { tol: at.tol, kind: this._opts.kind });
        if (!made) return this._message("Drag along an outer wall: a rectangle in the walls (of class wall), from one end of the opening to the other.");
        const ops = [{ insert: ["openings"], value: made.opening }];
        if (this._opts.glass) ops.push({ insert: ["drawing", "glazing"], value: made.glass });
        this._create(ops, ["openings", (data.openings || []).length]);
        if (!made.opening.room) this._message("This opening is in no room yet: choose its room.", "info");
      } else if (tool === "piece") {
        const kind = this._opts.piece;
        const shape = kind === "circle" ? { circle: [r(a[0]), r(a[1]), r(moved ? d : 0.3 * m2)] } : { rect: moved ? box2() : [r(a[0] - 0.5 * m2), r(a[1] - 0.3 * m2), r(m2), r(0.6 * m2)] };
        this._newPiece(shape);
      } else if (tool === "light") {
        this._create([{ insert: ["lights"], value: lightFrom(data, a, moved ? d : 0) }], ["lights", (data.lights || []).length]);
      } else if (tool === "marker") {
        if (moved) return;
        this._create([{ insert: ["markers"], value: { entity: "light.new_light", x: r(a[0]), y: r(a[1]), icon: "mdi:lightbulb", tap: "toggle" } }], ["markers", (data.markers || []).length]);
      } else if (tool === "label") {
        if (moved) return;
        const text2 = prompt("The label:", "Room")?.trim();
        if (!text2) return;
        this._create([{ insert: ["drawing", "labels"], value: { text: text2, at: [r(a[0]), r(a[1])], class: "room" } }], ["drawing", "labels", (data.drawing?.labels || []).length]);
      } else if (tool === "scale") {
        if (!moved) return;
        const now = `${(d / m2).toFixed(2)} m at the scale now`;
        const answer = prompt(`That line is ${now}. How long is it really, in metres? (Cancel just measures.)`, (d / m2).toFixed(2));
        const metres = parseFloat(String(answer ?? "").replace(",", "."));
        if (!(metres > 0)) return this._message(`Measured: ${now}.`, "info");
        const scale = scaleFrom(a, b, metres);
        this._edit(() => this.model.set(["units_per_metre"], scale));
        this._message(`The scale is ${scale} units a metre now. Lengths in metres (heights, the ruler, shadows) follow it.`, "info");
      }
    }
    // A shape drawn inside the piece being edited (from `a` to `b`, in its frame), with the usual class for it: a
    // rectangle (furn2), a circle (dev), a line, a label (lbl).
    _drawInside(a, b, moved) {
      const data = this.model.data, m2 = data.units_per_metre || 100, r = (v) => tidy(v), name = this._inside;
      const list = data.furniture[name].extra;
      if (list !== void 0 && !Array.isArray(list)) return this._message(`${name}'s extra is raw SVG: edit it in the YAML`);
      const [x0, y0, x1, y1] = boundsOf([a, b]);
      let value;
      if (this._tool === "label") {
        if (moved) return;
        const text2 = prompt("The label:", "Label")?.trim();
        if (!text2) return;
        value = { text: text2, at: [r(a[0]), r(a[1])], class: "lbl" };
      } else if (this._opts.extra === "circle") {
        value = { circle: [r(a[0]), r(a[1]), r(moved ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0.1 * m2)], class: "dev" };
      } else if (this._opts.extra === "line") {
        if (!moved) return;
        value = { path: `M${r(a[0])},${r(a[1])} L${r(b[0])},${r(b[1])}`, class: "line" };
      } else {
        value = { rect: moved ? [x0, y0, x1 - x0, y1 - y0].map(r) : [r(a[0] - 0.2 * m2), r(a[1] - 0.1 * m2), r(0.4 * m2), r(0.2 * m2)], class: "furn2" };
      }
      this._create([{ insert: ["furniture", name, "extra"], value }], ["furniture", name, "extra", (list || []).length]);
    }
    // Adds ops as one edit and selects `path`, staying in the tool.
    _create(ops, path) {
      this._edit(() => this.model.batch(ops));
      this.select(path);
    }
    _newRoom(region, floor) {
      const name = this._newName(["rooms"], "room");
      if (!name) return;
      const ops = [{ set: ["rooms", name], value: region }];
      if (this._opts.floor) ops.push({ insert: ["drawing", "floors"], value: { ...floor, class: "floor" } });
      this._create(ops, ["rooms", name]);
    }
    _newPiece(shape) {
      const name = this._newName(["furniture"], "piece");
      if (name) this._create([{ set: ["furniture", name], value: pieceFrom(this.model.data, name, shape) }], ["furniture", name]);
    }
    // A polygon drawn by clicks: a corner more, or the polygon finished by clicking its first corner again.
    _addCorner(p) {
      const poly = this._poly ?? (this._poly = { points: [] }), pts = poly.points, px = this._px();
      if (pts.length >= 3 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= (REACH + 2) * px) return this._finishPoly();
      const last = pts.at(-1);
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > px) pts.push(p.map(tidy));
      this._drawDraft(p);
    }
    _finishPoly() {
      const pts = this._poly?.points || [];
      this._poly = null;
      this._el.draft.innerHTML = "";
      this._el.ruler.textContent = "";
      if (pts.length < 3) return this._message("A polygon needs three corners at least", "info");
      if (this._tool === "room") this._newRoom([pts], { poly: pts });
      else this._newPiece({ poly: pts });
    }
    // Moves the selection by (dx, dy), as one edit.
    _moveBy(dx, dy) {
      if (!this._sels.length) return;
      if (!this.model.home) return this._message("Fix the mistakes listed here first: the plan shows the last version without them.");
      const data = this.model.data, id = this._view === "build" && this._group === null ? this._objectOf(this._sels) : void 0;
      if (id && data.rooms?.[id] !== void 0) {
        const made = moveRoomOps(data, id, dx, dy);
        if (made) {
          this._edit(() => this.model.batch(made.ops));
          this._selectObject(id);
        }
        return;
      }
      const gap = id && gapOf(data, id);
      if (gap) {
        const d = gap.axis === 0 ? dx : dy;
        if (d) this._edit(() => this.model.batch(slideOps(data, gap, d)));
        this._selectObject(id);
        return;
      }
      const ops = this._sels.map((p) => ({ set: p, value: moveItem(p, itemAt(data, p), dx, dy, this._withPiece(p)) }));
      if (this._view === "build") ops.push(...regroupOps(applyOps(data, ops), this._sels));
      this._edit(() => this.model.batch(ops));
    }
    // Copies of the selected items, a little down and to the right, selected: pieces and rooms under a new name, the
    // others at the end of their list.
    _duplicate() {
      if (!this._sels.length) return;
      if (!this.model.home) return this._message("Fix the mistakes listed here first: the plan shows the last version without them.");
      const data = this.model.data, off = 4 * this._grid(), ops = [], made = [], ends2 = {};
      for (const path of this._sels) {
        const value = moveItem(path, structuredClone(itemAt(data, path)), off, off, this._withPiece(path, data));
        if (path.length === 2 && (path[0] === "furniture" || path[0] === "rooms")) {
          const base = String(path[1]).replace(/\d+$/, "");
          let k = 2;
          while (data[path[0]][`${base}${k}`] !== void 0 || made.some((p) => p[0] === path[0] && p[1] === `${base}${k}`)) k++;
          ops.push({ set: [path[0], `${base}${k}`], value });
          made.push([path[0], `${base}${k}`]);
        } else {
          const list = path.slice(0, -1), key = pathKey(list);
          ends2[key] ?? (ends2[key] = itemAt(data, list).length);
          ops.push({ insert: list, value });
          made.push([...list, ends2[key]++]);
        }
      }
      this._edit(() => this.model.batch(ops));
      this._selectAll(made);
    }
    // The next item under the last click.
    _cycle(step = 1) {
      if (!this._hits?.length) return;
      const i = this._hits.findIndex((h2) => samePath2(h2, this._sel));
      this.select(this._hits[(i + step + this._hits.length) % this._hits.length]);
    }
    // The view's centre and a metre, for new items.
    _frame() {
      const v = this._data?.view || { x: 0, y: 0, w: 1e3, h: 1e3 }, m2 = this._data?.units_per_metre || 100;
      return { cx: v.x + v.w / 2, cy: v.y + v.h / 2, m: m2, v };
    }
    // The room under a point, or the first one.
    _roomAt(x, y) {
      const hit = this._home && hitTest(this._home, [x, y]).find((h2) => h2[0] === "rooms");
      return hit?.[1] ?? Object.keys(this._data?.rooms || {})[0];
    }
    // A name for a new item in the map at `path`: asked for, suggested `base` (made unique).
    _newName(path, base) {
      const taken = this.model.get(path) || {};
      let suggestion = base, k = 2;
      while (taken[suggestion] !== void 0) suggestion = `${base}${k++}`;
      const name = prompt(`A name for the new ${base}:`, suggestion)?.trim();
      if (!name) return null;
      if (taken[name] !== void 0) {
        this._message(`There's already a ${name}`);
        return null;
      }
      return name;
    }
    // Adds a new item to a group of the list, with values that work before they're edited, and selects it.
    _add(group) {
      const { cx, cy, m: m2, v } = this._frame(), r = round2, room = this._roomAt(cx, cy);
      const kind = group.add, list = this.model.get(group.path);
      let path, value;
      if (kind === "extra") return this._addInside(group.path[1]);
      if (kind === "rect") return this._addRect(group.path);
      if (kind === "room" || kind === "piece") {
        const name = this._newName(group.path, kind === "room" ? "room" : "piece");
        if (!name) return;
        path = [...group.path, name];
        value = kind === "room" ? [[r(cx - m2), r(cy - m2), r(2 * m2), r(2 * m2)]] : { shape: { rect: [r(cx - m2 / 2), r(cy - 0.3 * m2), r(m2), r(0.6 * m2)] }, height: 0.75, ...room ? { shadow_room: room } : {} };
      } else {
        path = [...group.path, Array.isArray(list) ? list.length : 0];
        if (kind === "shape") value = this._shapeTemplate(group.path[1] === "labels" ? "text" : "rect", null, group.path[1]);
        else if (kind === "opening") value = { wall: "top", at: r(v.y), depth: r(0.25 * m2), x: r(cx - 0.6 * m2), w: r(1.2 * m2), lo: 0.9, hi: 2.2, ...room ? { room } : {} };
        else if (kind === "light") value = { entities: ["light.new_light"], shape: [{ circle: [r(cx), r(cy), r(0.4 * m2)] }], ...room ? { clip: room } : {} };
        else if (kind === "marker") value = { entity: "light.new_light", x: r(cx), y: r(cy), icon: "mdi:lightbulb", tap: "toggle" };
        else if (kind === "spill") value = { cx: r(cx), cy: r(cy), rx: r(2 * m2), ry: r(2 * m2), ...room ? { clip: room } : {}, from: [], k: 0.5 };
        else if (kind === "blocker") value = { rect: [r(cx - m2 / 2), r(cy - m2 / 2), r(m2), r(m2)], height: 3 };
      }
      this._edit(() => kind === "room" || kind === "piece" ? this.model.set(path, value) : this.model.insert(group.path, value));
      this.select(path);
    }
    // A rectangle added to the room at `path`, next to its last one (to its right, as tall), selected.
    _addRect(path) {
      const region = this.model.get(path), { cx, cy, m: m2 } = this._frame(), r = round2;
      if (!Array.isArray(region) || Array.isArray(region[0]?.[0])) return this._message("A polygon room is one shape: drag its corners instead");
      const last = region.at(-1);
      const value = last?.length === 4 ? [r(last[0] + last[2]), last[1], r(m2), last[3]] : [r(cx - m2), r(cy - m2), r(2 * m2), r(2 * m2)];
      this._edit(() => this.model.insert(path, value));
      this.select([...path, region.length]);
    }
    // A shape added in the middle of the piece `name` (in its frame), selected: inside it.
    _addInside(name) {
      const piece = this.model.data?.furniture?.[name], { m: m2 } = this._frame(), r = round2;
      if (!piece) return;
      if (piece.extra !== void 0 && !Array.isArray(piece.extra)) return this._message(`${name}'s extra is raw SVG: edit it in the YAML`);
      const { rect, circle, poly } = piece.shape || {};
      const c = rect ? [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2] : circle ? circle.slice(0, 2) : (poly || [[0, 0]]).reduce((a, q, _, all) => [a[0] + q[0] / all.length, a[1] + q[1] / all.length], [0, 0]);
      const value = { rect: [r(c[0] - 0.2 * m2), r(c[1] - 0.1 * m2), r(0.4 * m2), r(0.2 * m2)], class: "furn2" };
      this._edit(() => this.model.insert(["furniture", name, "extra"], value));
      this.select(["furniture", name, "extra", (piece.extra || []).length]);
    }
    // A shape of `kind` where `old` was (or in the middle of the view), with the slot's usual class.
    _shapeTemplate(kind, old, slot) {
      const { cx, cy, m: m2 } = this._frame(), r = round2;
      const c = old?.rect ? [old.rect[0] + old.rect[2] / 2, old.rect[1] + old.rect[3] / 2] : old?.circle || old?.ellipse || old?.at || [cx, cy];
      const [x, y] = [r(c[0]), r(c[1])], h2 = r(m2 / 2);
      const cls = { floors: "floor", walls: "wall", glazing: "glass", fittings: "fix", under_furniture: "furn2", on_furniture: "dev", labels: "room" }[slot];
      const geometry = {
        rect: { rect: [x - h2, y - h2, 2 * h2, 2 * h2] },
        circle: { circle: [x, y, h2] },
        ellipse: { ellipse: [x, y, h2, r(h2 / 2)] },
        poly: { poly: [[x - h2, y + h2], [x + h2, y + h2], [x, y - h2]] },
        path: { path: `M${x - h2},${y} H${x + h2}`, class: "line" },
        text: { text: "Label", at: [x, y] },
        svg: { svg: "<g></g>" }
      }[kind];
      return { ...geometry, ...cls && !geometry.class ? { class: cls } : {} };
    }
    // The value an absent object field starts with.
    _template(path) {
      const { m: m2 } = this._frame(), key = path.at(-1);
      if (key === "pool" && path[0] === "lights") {
        const c = lightCentre(itemAt(this.model.data, path.slice(0, 2))) || [this._frame().cx, this._frame().cy];
        return { x: round2(c[0]), y: round2(c[1]), r: round2(2.5 * m2), height: 1.5, shadows: [] };
      }
      if (key === "repeat") return { count: 2, step: [round2(m2), 0] };
      if (key === "trees") return { from: 240, to: 300, top: 10, through: 0.5 };
      if (key === "background") return { image: "/local/plan.png" };
      if (key === "label") return { attribute: "friendly_name" };
      if (key === "view") return { x: 0, y: 0, w: 1e3, h: 800 };
      return {};
    }
    // Where the home names the room or piece `name`: the paths of fields of `type` ('room' or 'furniture') holding it.
    _references(type, name) {
      const out = [];
      const walk = (v, path) => {
        if (path.length && fieldAt(path)?.type === type && v === name) out.push(path);
        if (v && typeof v === "object") for (const [k, c] of Object.entries(v)) walk(c, [...path, Array.isArray(v) ? +k : k]);
      };
      walk(this.model.data, []);
      return out;
    }
    // Deletes items, as one edit; a piece of furniture leaves the lights' shadows too. A room keeps one rectangle.
    _remove(paths) {
      const object = this._objectOf(paths);
      if (object) {
        this._edit(() => this.model.batch(deleteOps(this.model.data, object)));
        this.select(null);
        return;
      }
      const parts = paths.filter((p) => p[0] === "rooms" && p.length === 3);
      for (const name of new Set(parts.map((p) => p[1]))) {
        if (parts.filter((p) => p[1] === name).length >= (this.model.get(["rooms", name]) || []).length) {
          return this._message(`${name} needs a rectangle at least: delete the room itself instead`);
        }
      }
      const refs = paths.flatMap((p) => p[0] === "furniture" && p.length === 2 ? this._references("furniture", p[1]) : []);
      const all = [...paths, ...refs].sort(byPathDescending).filter((p, i, a) => !i || !samePath2(p, a[i - 1]));
      this._edit(() => this.model.edit((doc) => {
        for (const p of all) if (!doc.deleteIn(p) && paths.includes(p)) throw new Error(`Nothing at ${p.join(".")}`);
      }));
      if (this._inside !== null && paths.every(isExtra)) this._selectAll([]);
      else this.select(null);
    }
    // Renames a room or a piece of furniture; the fields naming it follow.
    _rename(path, name) {
      const refs = this._references(path[0] === "rooms" ? "room" : "furniture", path[1]);
      this._edit(() => this.model.edit((doc) => {
        renameIn(doc, path, name);
        for (const p of refs) doc.setIn(p, name);
      }));
      if (this.model.get([path[0], name]) !== void 0) this.select([path[0], name]);
    }
    // Moves an item within its list (or map); the selection follows it.
    _move(path, from, to) {
      this._edit(() => this.model.move(path, from, to));
      const sel = this._sel;
      if (sel && sel.length === path.length + 1 && samePath2(sel.slice(0, -1), path) && typeof sel.at(-1) === "number") {
        const i = sel.at(-1), j = i === from ? to : from < i && i <= to ? i - 1 : to <= i && i < from ? i + 1 : i;
        this.select([...path, j]);
      }
    }
    _message(text2, kind = "") {
      return this._el.footer.appendChild(Object.assign(document.createElement("p"), { textContent: text2, className: kind }));
    }
    _updateButtons() {
      const b = this._el.buttons;
      b.undo.disabled = !this.model.canUndo;
      b.redo.disabled = !this.model.canRedo;
      b["save-json"].disabled = !this.model.data;
      b.dark.setAttribute("aria-pressed", this._dark);
      b.grid.setAttribute("aria-pressed", this._showGrid);
      this._el.name.textContent = this._file.name;
      this._el.name.title = this._file.handle ? "Saves back to this file" : hasFileAccess() ? "Save asks where to save it" : "Saving downloads it";
      this._el.name.classList.toggle("unsaved", this.model.text !== this._file.saved);
    }
    _textChanged() {
      clearTimeout(this._typing);
      if (this.model.setText(this._el.text.value)) this._changed({ text: false });
    }
    async _act(act) {
      try {
        if (act === "undo" || act === "redo") {
          this._textChanged();
          if (this.model[act]()) this._changed({ text: true });
        } else if (act === "ha") {
          this._haDialog();
        } else if (act === "grid") {
          this._showGrid = !this._showGrid;
          this._renderGrid();
          this._updateButtons();
        } else if (act === "dark") {
          this._dark = !this._dark;
          this._el.preview.classList.toggle("dark", this._dark);
          this._renderCard();
          this._updateButtons();
        } else if (act === "new") {
          this._el.start.returnValue = "";
          this._el.start.showModal();
        } else if (act === "open") {
          if (this._unsaved() && !confirm("Open another file? The changes not saved are lost.")) return;
          const file = await pickFile();
          if (file) this._open(file);
        } else if (act === "save") await this.save();
        else if (act === "save-yaml") await this.save({ as: "yaml" });
        else if (act === "save-json") await this.save({ as: "json" });
      } catch (e) {
        this._message(e.message);
      }
    }
    // The start dialog closed: a new home from the example, an empty one, or a picture of a plan.
    async _started() {
      const how = this._el.start.returnValue, form = this._el.start.querySelector("form");
      if (!["example", "empty", "picture"].includes(how)) return;
      try {
        if (how === "picture") {
          const file = await new Promise((resolve) => {
            const input2 = Object.assign(document.createElement("input"), { type: "file", accept: "image/*" });
            input2.onchange = () => resolve(input2.files[0]);
            input2.oncancel = () => resolve(null);
            input2.click();
          });
          if (file) await this._picture(file);
          return;
        }
        if (!this._ha && this._unsaved() && !confirm("Start a new home? The changes not saved are lost.")) return;
        if (how === "example") this._open({ name: "home.yaml", text: this.example, handle: null });
        else {
          const [w, h2, scale] = ["w", "h", "scale"].map((k) => +form.elements[k].value);
          if (!(w > 0 && h2 > 0 && scale > 0)) throw new Error("An empty home needs a size and a scale above 0");
          if (this._ha) this._restart(emptyHome(w, h2, scale));
          else this._open({ name: "home.yaml", text: emptyHome(w, h2, scale), handle: null });
          this._opts.floor = true;
          this.setView("build");
          this.setTool("build-room");
        }
      } catch (e) {
        this._message(e.message);
      }
    }
    // The home replaced by the one in `text` (HA's shell), as one step in the history: nothing selected, nothing entered.
    _restart(text2) {
      this._inside = null;
      this._group = null;
      this._sels = [];
      this._sel = null;
      if (this.model.setText(text2)) this._changed({ text: true });
    }
    // A picture of a plan: the background of the open home if it names it (/local/<its name>), or else a new home
    // drawn over it, in its pixels, with the scale tool ready to measure a known length on it.
    async _picture(file) {
      const path = `/local/${file.name}`, url = URL.createObjectURL(file);
      const own = this._data?.drawing?.background?.image;
      if (own === path || own?.split("/").pop() === file.name) {
        this._pictures[own] = url;
        savePicture(own, file);
        this._renderCard();
        return;
      }
      const { w, h: h2 } = await imageSize(url);
      if (this._unsaved() && !confirm("Start a new home over this picture? The changes not saved are lost.")) return;
      this._pictures[path] = url;
      savePicture(path, file);
      this._open({ name: `${file.name.replace(/\.[^.]+$/, "")}.yaml`, text: pictureHome(path, w, h2), handle: null });
      this._opts.floor = false;
      this.setTool("scale");
      this._message(`Now drag along something on the picture whose length you know (a wall, a door), and type its length: that sets the scale. In Home Assistant, put ${file.name} in /config/www/.`, "info");
    }
    // A picture kept in the browser, for a background the home names (false when there's none: the home's own URL).
    _loadPicture(path) {
      this._pictures[path] = null;
      loadPicture(path).then((blob) => {
        this._pictures[path] = blob ? URL.createObjectURL(blob) : false;
        this._renderCard();
      });
    }
    _unsaved() {
      return this.model.text !== this._file.saved;
    }
    // Opens a file ({name, text, handle}): a JSON file is edited as YAML, and saved back as JSON.
    _open({ name, text: text2, handle }) {
      if (formatOf(name) === "json") {
        try {
          text2 = yamlOf(JSON.parse(text2));
        } catch (e) {
          this._message(`${name}: ${e.message}`);
          return;
        }
      }
      this.model.open(text2);
      this._file = { name, handle, saved: this.model.text };
      this._inside = null;
      this._renderTools();
      this._data = null;
      this._home = null;
      this._sel = null;
      this._sels = [];
      this._changed({ text: true });
    }
    // Saves the home: back to its file (where the browser can; otherwise it asks where, or downloads it), or with `as`
    // ('yaml' or 'json') as a new file. Saving a YAML home as JSON is an export: the editor goes on with the YAML.
    async save({ as } = {}) {
      this._textChanged();
      const format = as || formatOf(this._file.name);
      const text2 = format === "json" ? this.model.toJSON() : this.model.text;
      let saved;
      if (!as && this._file.handle) {
        await writeFile(this._file.handle, text2);
        saved = { name: this._file.name, handle: this._file.handle };
      } else {
        saved = await saveFileAs(text2, format, renamed(this._file.name, format));
        if (!saved) return;
      }
      if (format === formatOf(this._file.name) || format === "yaml") this._file = { ...saved, saved: this.model.text };
      this._changed({ text: false });
    }
    // A key pressed: what it does, if anything (true when it did something).
    _key(e) {
      const target = e.composedPath()[0], typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName);
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "s" && !this._ha) {
          e.preventDefault();
          this._act(e.shiftKey ? "save-yaml" : "save");
        } else if ((key === "z" || key === "y") && !typing) {
          e.preventDefault();
          this._act(key === "y" || e.shiftKey ? "redo" : "undo");
        } else if (key === "d" && !typing && this._sels.length) {
          e.preventDefault();
          this._duplicate();
        } else return false;
        return true;
      }
      if (typing || !this._root.contains(target) && target !== this && !this._layer?.contains(target)) return false;
      const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (this._poly && (e.key === "Enter" || e.key === "Backspace")) {
        e.preventDefault();
        if (e.key === "Enter") this._finishPoly();
        else if (this._poly.points.pop() && !this._poly.points.length) {
          this._poly = null;
          this._el.draft.innerHTML = "";
        }
        return true;
      }
      if (e.key === "Escape") {
        if (this._press) this._cancelDrag();
        else if (this._poly) {
          this._poly = null;
          this._el.draft.innerHTML = "";
          this._el.ruler.textContent = "";
        } else if (this._sels.length && this._tool.startsWith("build-") && this._group === null) this.select(null);
        else if (this._tool !== "select") this.setTool("select");
        else if (this._inside !== null) this._leave();
        else if (this._group !== null) this._leaveGroup();
        else if (this._sels.length) this.select(null);
        else return false;
      } else if (e.key === "Enter" && this._view === "build" && this._group === null && this._objectOf(this._sels)) {
        e.preventDefault();
        this._enterGroup(this._objectOf(this._sels), [this._sel]);
      } else if (e.key === "Enter" && this._tool === "select" && this._sels.length === 1 && this._sel[0] === "furniture" && this._sel.length === 2) {
        e.preventDefault();
        this._enter(this._sel[1]);
      } else if (this._tool === "build-piece" && e.key.toLowerCase() === "r" && !this._sels.some((p) => p[0] === "furniture")) {
        this._turnPrefab();
      } else if (this._view === "build" && e.key.toLowerCase() === "r" && this._sels.some((p) => p[0] === "furniture" && p.length === 2)) {
        this._turnPieces(e.shiftKey ? -90 : 90);
      } else if ((this._view !== "build" || e.key.toLowerCase() === "v") && !e.altKey && !e.shiftKey && TOOL_KEYS[e.key.toLowerCase()] && e.key.length === 1) this.setTool(TOOL_KEYS[e.key.toLowerCase()]);
      else if ((e.key === "Delete" || e.key === "Backspace") && this._sels.length) {
        e.preventDefault();
        this._remove(this._sels);
      } else if (arrow && this._sels.length && !e.altKey) {
        e.preventDefault();
        const step = this._grid() * (e.shiftKey ? 10 : 1);
        this._moveBy(arrow[0] * step, arrow[1] * step);
      } else if (e.key === "Tab" && (target === this._el.preview || target === this._layer) && this._hits?.length > 1) {
        e.preventDefault();
        this._cycle(e.shiftKey ? -1 : 1);
      } else return false;
      return true;
    }
  };

  // example/home.yaml
  var home_default = "# An example home for Lightwell: a made-up flat with a living room (and a kitchen corner), a bedroom and a terrace.\n# Every field is described in the README; the engine checks them all (src/home.js).\n#\n# Units: 100 per metre, so the flat is 8.5 \xD7 6.5 m. x grows to the right, y downwards. The top of the plan faces\n# north, so the terrace door (bottom wall) faces south and the bedroom window (right wall) east.\n\nview: {x: -20, y: -20, w: 890, h: 840}\nunits_per_metre: 100\n\n# Light stays inside its room: rectangles [x, y, w, h], or one polygon.\nrooms:\n  living: [[25, 25, 475, 600]]\n  bedroom: [[515, 25, 310, 600]]\n  terrace: [[25, 650, 800, 150]]\n\n# The static drawing, slot by slot. Lightwell's own layers (daylight, lamps, shadows, shutters) go between the slots.\ndrawing:\n  # Each room's floor (both reaching under the wall between them, so that no edge of theirs shows along it), and the\n  # floor through the doorway between them. `part` (on these and on the walls, the glass, the lamps and the markers)\n  # is the object the editor's Build view picks as one: a room, a window, a lamp.\n  floors:\n    - {rect: [25, 25, 490, 600], class: floor, part: living}\n    - {rect: [500, 25, 325, 600], class: floor, part: bedroom}\n    - {rect: [500, 250, 15, 90], class: floor, part: doorway_1}\n    - {rect: [25, 650, 800, 150], class: terrace, part: terrace}\n    - {path: 'M25,790 H825', class: line}\n  # Each room's walls, as the Build view makes them; the one between the rooms is the bedroom's. The living room's top\n  # and bottom walls reach over the bedroom's ends a little (again, so that no edge shows where they meet).\n  walls:\n    - {rect: [0, 0, 515, 25], class: wall, part: living}\n    - {rect: [0, 0, 25, 650], class: wall, part: living}\n    # The bottom wall, with the terrace door (x 140\u2013360).\n    - {rect: [0, 625, 140, 25], class: wall, part: living}\n    - {rect: [360, 625, 155, 25], class: wall, part: living}\n    - {rect: [500, 0, 350, 25], class: wall, part: bedroom}\n    - {rect: [500, 625, 350, 25], class: wall, part: bedroom}\n    # The right wall, with the bedroom window (y 230\u2013410).\n    - {rect: [825, 0, 25, 230], class: wall, part: bedroom}\n    - {rect: [825, 410, 25, 240], class: wall, part: bedroom}\n    # Between the rooms, with a doorway (y 250\u2013340).\n    - {rect: [500, 25, 15, 225], class: iwall, part: bedroom}\n    - {rect: [500, 340, 15, 285], class: iwall, part: bedroom}\n  glazing:\n    - {rect: [140, 632, 220, 10], class: glass, part: glass_door_1}\n    - {rect: [832, 230, 10, 180], class: glass, part: window_1}\n  # The kitchen counter, with the sink and the hob.\n  fittings:\n    - {rect: [25, 25, 260, 60], class: fix}\n    - {rect: [60, 35, 70, 40], class: fix2, rx: 6}\n    - {rect: [170, 35, 80, 40], class: fix2}\n  labels:\n    - {text: Living room, at: [300, 600], class: room, part: living}\n    - {text: Bedroom, at: [670, 300], class: room, part: bedroom}\n    - {text: Terrace, at: [600, 735], class: room, part: terrace}\n\n# Windows and doors: where the sun and daylight come in. `at` is the wall's outer face, `depth` its thickness.\nopenings:\n  - {wall: bottom, at: 650, depth: 25, x: 140, w: 220, lo: 0, hi: 2.3, shutter: cover.living_room_blind, room: living, sky: living, part: glass_door_1}\n  - {wall: right, at: 850, depth: 25, y: 230, h: 180, lo: 0.8, hi: 2.2, shutter: cover.bedroom_blind, room: bedroom, sky: bedroom, part: window_1}\n\n# Each piece once: its drawing, the shadows it casts (with a height, in metres) and the daylight on its top.\nfurniture:\n  sofa:\n    shape: {rect: [40, 380, 90, 200], rx: 8}\n    height: 0.8\n    shadow_room: living\n    extra:\n      - {rect: [40, 380, 25, 200], class: furn2, rx: 6}\n  coffeeTable: {shape: {rect: [190, 430, 90, 60], rx: 6, turn: 20}, height: 0.45, shadow_room: living}\n  tvStand:\n    shape: {rect: [440, 400, 50, 160]}\n    height: 0.5\n    shadow_room: living\n    extra:\n      - {rect: [478, 410, 8, 140], class: dev}\n  diningTable: {shape: {rect: [300, 150, 140, 90], rx: 8}, height: 0.75, shadow_room: living}\n  floorLamp: {shape: {circle: [70, 340, 15]}, class: furn2}\n  wardrobe:\n    shape: {rect: [530, 40, 60, 160]}\n    height: 2\n    shadow_room: bedroom\n    extra:\n      - {path: 'M530,120 h60', class: line}\n  desk: {shape: {rect: [700, 40, 120, 60]}, height: 0.75, shadow_room: bedroom}\n  deskChair: {shape: {circle: [760, 130, 25]}, class: furn2, height: 0.9, shadow_room: bedroom}\n  bed:\n    shape: {rect: [600, 420, 200, 180], rx: 10}\n    height: 0.55\n    shadow_room: bedroom\n    extra:\n      - {rect: [615, 560, 80, 30], class: furn2, rx: 10}\n      - {rect: [705, 560, 80, 30], class: furn2, rx: 10}\n  bedsideTable: {shape: {rect: [530, 540, 50, 50]}, class: furn2, height: 0.5, shadow_room: bedroom}\n\n# Lights glow in their entity's colour and brightness. A pool lights the floor around a lamp `height` metres up,\n# and the furniture named in `shadows` casts shadows away from it.\nlights:\n  - entities: [light.living_room_lamp]\n    shape: [{circle: [70, 340, 60]}]\n    over: true\n    clip: living\n    pool: {x: 70, y: 340, r: 380, height: 1.6, shadows: [sofa, coffeeTable, diningTable]}\n    part: lamp_1\n  # The TV only reports whether it's on: cool light that flickers while it is.\n  - entities: [media_player.tv]\n    states: ['on', playing, paused]\n    color: [170, 200, 255]\n    effect: flicker\n    shape: [{ellipse: [478, 480, 25, 70]}]\n    over: true\n    clip: living\n    pool: {x: 470, y: 480, r: 350, height: 1, shadows: [coffeeTable, sofa]}\n    part: lamp_2\n  - entities: [light.kitchen_strip]\n    shape: [{path: 'M35,90 H275', stroke_width: 20, fill: none}]\n    top: true\n    clip: living\n    part: lamp_3\n  - entities: [light.bedroom_lamp]\n    shape: [{circle: [555, 565, 50]}]\n    over: true\n    clip: bedroom\n    pool: {x: 555, y: 565, r: 330, height: 0.9, shadows: [bed, wardrobe, desk]}\n    part: lamp_4\n  # On/off string lights: bulbs in a repeating set of colours, each with a faint pool, fading out by day.\n  - entities: [light.terrace_lights]\n    multi: true\n    outdoor: true\n    clip: terrace\n    shape:\n      - {circle: [60, 775, 60], repeat: {count: 12, step: [65, 0]}, fill: ['#ff5a5a', '#ffd23b', '#5aff8a', '#5ac8ff'], fill_opacity: 0.08}\n      - {circle: [60, 775, 10], repeat: {count: 12, step: [65, 0]}, fill: ['#ff5a5a', '#ffd23b', '#5aff8a', '#5ac8ff']}\n    part: lamp_5\n\n# Effects by name, played while a light reports them: steps of [hue, saturation, brightness %, hold ms]. `flicker`\n# (the TV's) is built in.\neffects:\n  Sunset glow: [[25, 90, 90, 5000], [10, 85, 70, 5000], [40, 80, 100, 5000]]\n\nmarkers:\n  - {entity: light.living_room_lamp, x: 110, y: 330, icon: 'mdi:floor-lamp', tap: toggle, part: lamp_1}\n  - {entity: light.kitchen_strip, x: 150, y: 120, icon: 'mdi:led-strip-variant', tap: toggle, part: lamp_3}\n  - {entity: climate.living_room, x: 400, y: 60, icon: 'mdi:air-conditioner', label: {attribute: temperature, round: 0, unit: '\xB0'}}\n  - {entity: media_player.tv, x: 440, y: 480, icon: 'mdi:television', label: {attribute: source, when: ['on']}, part: lamp_2}\n  - {entity: light.bedroom_lamp, x: 555, y: 565, icon: 'mdi:lamp', tap: toggle, part: lamp_4}\n  - {entity: sensor.bedroom_temperature, x: 760, y: 200, icon: 'mdi:thermometer', small: true, side: true, label: {round: 1, unit: '\xB0'}}\n  - {entity: cover.bedroom_blind, x: 790, y: 320, icon: 'mdi:blinds', small: true, label: {attribute: current_position, unit: '%'}, part: window_1}\n  - {entity: cover.living_room_blind, x: 250, y: 690, icon: 'mdi:blinds', small: true, label: {attribute: current_position, unit: '%'}, part: glass_door_1}\n  - {entity: weather.home, x: 100, y: 720, icon: 'mdi:weather-partly-cloudy', label: {attribute: temperature, round: 0, unit: '\xB0'}}\n  - {entity: light.terrace_lights, x: 760, y: 720, icon: 'mdi:string-lights', tap: toggle, part: lamp_5}\n\nsun:\n  # The compass bearing of the top of the plan.\n  north: 0\n  # A garden wall at the end of the terrace, 2 m high, that shades the door in the late afternoon.\n  blockers:\n    - {rect: [825, 650, 25, 150], height: 2}\n  # Trees to the west: they dim the sun behind them (azimuth 250\u2013290\xB0, up to 10\xB0 high) to 40%.\n  trees: {from: 250, to: 290, top: 10, through: 0.4}\n  # Daylight from the living room carrying on through the door into the bedroom, dimmed by the terrace door's blind.\n  spill:\n    - {cx: 507, cy: 295, rx: 200, ry: 160, clip: bedroom, from: [0], k: 0.4}\n  # Always in the sun when it's out.\n  outdoor:\n    - {rect: [25, 650, 800, 150], fill_opacity: 0.35}\n\n# The terrace's colour, on top of Lightwell's own; tinted with the time of day like the floors.\npalette:\n  light: {terrace: '#d9cfc0'}\n  dark: {terrace: '#3a352e'}\n  tinted: [terrace]\n\n# For the simulator's time presets (tools/simulator): what is on at that time of day; blinds not named are open.\nsimulator:\n  scenes:\n    Night: {lights: 'off', media: 'off', shutters: {cover.bedroom_blind: 0, cover.living_room_blind: 0}}\n    Dawn: Night\n    Sunrise: Night\n    Morning: {lights: 'off', media: 'off'}\n    Noon: Morning\n    Afternoon: Morning\n    Golden hour: {lights: 'off', media: 'on'}\n    Sunset: {lights: 'on', media: 'on', shutters: {cover.living_room_blind: 40}}\n    Dusk: Sunset\n    Evening: Sunset\n";

  // src/editor/index.js
  if (!customElements.get("ha-card")) customElements.define("ha-card", class extends HTMLElement {
  });
  if (!customElements.get("ha-icon")) {
    customElements.define("ha-icon", class extends HTMLElement {
      connectedCallback() {
        const name = this.getAttribute("icon").replace("mdi:", "");
        this.style.display = "inline-block";
        const d = document.createElement("div");
        d.style.cssText = `width: var(--mdc-icon-size); height: var(--mdc-icon-size); background: currentColor;
        -webkit-mask: url(https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${name}.svg) center/contain no-repeat`;
        this.appendChild(d);
      }
    });
  }
  if (!customElements.get("lightwell-card")) defineFloorplanCard("lightwell-card", void 0, { name: "Lightwell" });
  var Editor = class extends LightwellEditor {
    constructor() {
      super();
      this.example = home_default;
    }
  };
  if (!customElements.get("lightwell-editor")) customElements.define("lightwell-editor", Editor);
})();
