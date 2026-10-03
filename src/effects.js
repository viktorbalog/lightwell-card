// Light effects a glow can play, and the colours of lights.
//
// A home's `effects` (see home.js) are flows by name: a list of steps [hue, saturation, brightness %, hold ms], each
// faded into in 666 ms, or {fade, steps} with a fade of its own. The flow repeats. They add to (or replace) PRESETS.

// The effects every home has.
export const PRESETS = {
  // A TV's flickering light: cool and restless, with quick fades.
  flicker: {fade: 250, steps: [[215, 25, 85, 700], [225, 15, 100, 400], [205, 35, 70, 900], [220, 20, 95, 500],
    [230, 30, 80, 1100], [210, 10, 100, 350]]},
};

// How often a playing effect is redrawn while it fades (ms). Each redraw repaints the plan, so not every frame.
export const TICK = 100;

// An effect as a repeating timeline: points [t (ms), [r, g, b], opacity, eased], with straight (or eased) fades
// between them, over `total` ms. A flow from `effects` fades into each step and holds it; anything else pulses in
// `color` ([r, g, b]) over 3 s.
export function timeline(effect, color, effects = {}) {
  const def = effects[effect] || PRESETS[effect], steps = def?.steps || def;
  if (!steps) return {total: 3000, points: [[0, color, 1, true], [1500, color, 0.35, true], [3000, color, 1]]};
  const fade = def.fade || 666, at = ([h, s, v]) => [hsvRgb(h, s), Math.max(v, 1) / 100];
  const points = [[0, ...at(steps.at(-1))]];
  let t = 0;
  for (const st of steps) {
    points.push([t + fade, ...at(st)]);
    t += fade + st[3];
    points.push([t, ...at(st)]);
  }
  return {total: t, points};
}

// An effect's colour and opacity `t` ms after it started, and how long that holds (`next`, ms): until the end of a
// hold, or TICK during a fade.
export function frameAt({total, points}, t) {
  t %= total;
  const k = points.findIndex((p, i) => i + 1 < points.length && points[i + 1][0] > t);
  const [t0, c0, o0, eased] = points[k], [t1, c1, o1] = points[k + 1];
  const still = o0 === o1 && c0.every((v, i) => v === c1[i]);
  if (still) return {color: c0, opacity: o0, next: t1 - t};
  let f = (t - t0) / (t1 - t0);
  if (eased) f = f * f * (3 - 2 * f);
  return {color: c0.map((v, i) => Math.round(v + (c1[i] - v) * f)), opacity: +(o0 + (o1 - o0) * f).toFixed(3),
    next: Math.min(TICK, t1 - t)};
}

// HSV (hue 0–360, saturation 0–100, full value) as [r, g, b].
export function hsvRgb(h, s) {
  const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - s / 100 * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
}

// A light's colour; lights without one (plain dimmers, on/off) glow warm white.
export const lightRgb = s => s.attributes.rgb_color || [255, 214, 140];
export const lightColor = s => `rgb(${lightRgb(s).join(', ')})`;
export const rgb = c => `rgb(${c.join(', ')})`;
