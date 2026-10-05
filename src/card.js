// The floor plan card: a home (home.js) drawn to scale, with its furniture. Lights glow in their own colour and
// brightness, shutters darken their opening by how far they're closed, the sun and the daylight come in through the
// openings, and each device has a marker: tap toggles lights and switches, wakes a device that is off (`wake`), and
// opens the details of everything else. `defineFloorplanCard(tag, home)` registers it as a custom element.
// Card config: `home` (the home itself, as YAML in the dashboard) or `home_url` (a JSON file with it, e.g. under
// /local/), unless the element was registered with a home of its own; optional `north`, the compass bearing of the
// top of the drawing, overriding the home's `sun.north`. Its visual editor in HA is loaded when it's opened.
//
// HA sets `hass` whenever anything in the house changes, and every write to the SVG can repaint all of it, with its
// many blurs. So the card renders only when one of its home's entities changed, and writes only values that differ
// (attr, css, text below).
import {clipShapes, shadowOf} from './geometry.js';
import {caster, furnitureClip, furnitureSvg} from './furniture.js';
import {shutterRect, skyEllipse} from './openings.js';
import {shapesSvg} from './shapes.js';
import {frameAt, lightColor, lightRgb, rgb, timeline} from './effects.js';
import {defineHome, entitiesOf} from './home.js';
import {daylight, labelColors, sunScene, sunShadows} from './sun.js';
import {iconOf, isActive, labelOf} from './markers.js';
import {loadEditor} from './loader.js';
import {stubHome} from './stub.js';

const NS = 'http://www.w3.org/2000/svg';
// Effects hold still (on their first colour) for people who ask for less motion.
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

// The theme's colours, as classes the drawing uses (a home's palette adds to them, home.js). Those in `tinted` take on
// the time of day's tint (sun.js floorTint), so they need #rrggbb colours. Every class but the ones with rules of
// their own (STYLE) fills its shapes with its colour.
const PALETTE = {
  light: {floor: '#ece06a', wall: '#000', iwall: '#525252', fix: '#b5b5b5', fix2: '#808080', glass: '#4dbdbd',
    furn: '#fbf6d6', furn2: '#e4dba2', stroke: '#77704a', dev: '#3a3a3a',
    room: 'rgba(110, 100, 40, 0.45)', chip: 'rgba(255, 255, 255, 0.85)', 'chip-text': '#333'},
  dark: {floor: '#3d3a2a', wall: '#0a0a0a', iwall: '#1c1c1c', fix: '#5a5a5a', fix2: '#474747', glass: '#4dbdbd',
    furn: '#57533e', furn2: '#6b6648', stroke: '#26241a', dev: '#111',
    room: 'rgba(230, 220, 170, 0.3)', chip: 'rgba(20, 20, 20, 0.75)', 'chip-text': '#eee'},
  tinted: ['floor', 'furn', 'furn2', 'fix', 'fix2'],
};
const OWN_RULES = ['stroke', 'room', 'chip', 'chip-text', 'furn', 'furn2'];
const rgbOf = hex => [0, 2, 4].map(i => parseInt(hex.slice(1 + i, 3 + i), 16));
const vars = palette => Object.entries(palette).map(([k, v]) => `--${k}: ${v};`).join(' ');

// The card's palette with a home's added.
const paletteOf = home => ({light: {...PALETTE.light, ...home.palette.light}, dark: {...PALETTE.dark, ...home.palette.dark},
  tinted: [...new Set([...PALETTE.tinted, ...home.palette.tinted])]});

const style = palette => `
  :host { ${vars(palette.light)} }
  :host([dark]) { ${vars(palette.dark)} }
  ha-card { overflow: hidden; }
  .plan { position: relative; container-type: inline-size; }
  svg { display: block; width: 100%; height: auto; }
  /* A picture of the plan doesn't take the theme's colours: dimmed in the dark theme instead. */
  :host([dark]) .background { filter: brightness(0.42) saturate(0.8); }
  ${Object.keys(palette.light).filter(k => !OWN_RULES.includes(k)).map(k => `.${k} { fill: var(--${k}); }`).join(' ')}
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

// The home's drawing (its slots) with the card's layers between them, in the order home.js describes.
function planSvg(home) {
  const d = home.drawing, slot = k => shapesSvg(d[k]), bg = d.background;
  const [bx, by, bw, bh] = bg?.rect || [home.view.x, home.view.y, home.view.w, home.view.h];
  return `
  ${bg ? `<image class="background" href="${bg.image.replace(/"/g, '&quot;')}" x="${bx}" y="${by}" width="${bw}" height="${bh}" preserveAspectRatio="none"/>
    <rect id="background-tint" x="${bx}" y="${by}" width="${bw}" height="${bh}" opacity="0"/>` : ''}
  ${slot('floors')}
  <g id="skylight"></g>
  <g id="sun" mask="url(#sun-mask)" filter="url(#sunblur)"><g id="sun-light">${shapesSvg(home.sun.outdoor)}</g></g>
  <g id="glows"></g>
  ${slot('walls')}
  ${slot('glazing')}
  <g id="shutters"></g>
  ${slot('fittings')}
  <g id="glows-top"></g>
  <g id="cast"></g>
  ${slot('under_furniture')}
  ${furnitureSvg(home.furniture)}
  ${slot('on_furniture')}
  <g clip-path="url(#furn-clip)" opacity="0.4"><use href="#skylight"/><use id="sun-on-furn" href="#sun-light" filter="url(#sunblur)" mask="url(#sun-mask-walls)"/></g>
  <g id="glows-over"></g>
  ${slot('labels')}
`;
}

// A filter or mask over the whole view: blurred straight lines (a zero-height bounding box) need user-space units.
const overView = v => `filterUnits="userSpaceOnUse" x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}"`;
const blur = (v, id, sd) => `<filter id="${id}" ${overView(v)}><feGaussianBlur stdDeviation="${sd}"/></filter>`;
const maskOverView = (v, id) => `<mask id="${id}" ${overView(v).replace('filterUnits', 'maskUnits')}>`;

// Writes that skip values already there (see the top).
const written = new WeakMap();
function put(el, key, value, write) {
  let m = written.get(el);
  if (!m) written.set(el, m = new Map());
  if (m.get(key) === value) return;
  m.set(key, value);
  write();
}
const attr = (el, name, v) => put(el, name, String(v), () => el.setAttribute(name, v));
const css = (el, prop, v) => put(el, `style:${prop}`, String(v), () => el.style.setProperty(prop, String(v)));
const text = (el, v) => put(el, 'text', v, () => { el.textContent = v; });
const svgEl = (tag, attrs = {}, html = '') => {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  el.innerHTML = html;
  return el;
};
// Glows fill their shapes, except lines, which are stroked.
const paintProp = sh => (sh.tagName === 'path' ? 'stroke' : 'fill');

// In HA's card editor, the card HA shows as the preview offers itself to the editor (src/editor/ha.js), which then
// edits the home on it rather than on a copy of its own: `lightwell-preview` events on window, with the card, when it
// becomes a preview and whenever an editor opens (`lightwell-editor-open`). The editor gives it `editLayer`, an
// element the card keeps over its plan, also when it rebuilds. HA rebuilds a preview card on every change, so each
// new one offers itself again.
const previews = new Set();
window.addEventListener('lightwell-editor-open', () => previews.forEach(card => card._offer()));

// The card, for the home on its class (`home`, set by defineFloorplanCard) or in its config.
class FloorplanCard extends HTMLElement {
  set preview(on) {
    this._isPreview = !!on;
    if (on) { previews.add(this); this._offer(); } else previews.delete(this);
  }

  get preview() { return !!this._isPreview; }

  _offer() {
    window.dispatchEvent(new CustomEvent('lightwell-preview', {detail: this}));
  }

  // An editor's layer over the card (selection, handles, drawing), kept there through rebuilds; null removes it.
  // While it's there, taps on the markers do nothing (they'd act on the house while the home is being edited).
  set editLayer(layer) {
    if (this._editLayer && this._editLayer !== layer) this._editLayer.remove();
    this._editLayer = layer;
    // Over the card's own box: a block (an element is inline otherwise), positioned.
    if (layer) Object.assign(this.style, {display: 'block', position: 'relative'});
    if (layer && this.shadowRoot && layer.parentNode !== this.shadowRoot) this.shadowRoot.append(layer);
  }

  get editLayer() { return this._editLayer; }

  setConfig(config) {
    this._config = config;
    this._seen = null;
    const source = this.constructor.home || config.home || config.home_url;
    if (!source) throw new Error('The card needs a home: home (the home itself) or home_url (a JSON file with it)');
    if (source === this._source) return;
    this._source = source;
    // A mistake in an inline home throws here, which HA shows as an error card.
    if (typeof source === 'string') this._load(source);
    else this._build(source === this.constructor.home ? source : defineHome(source));
  }

  // A home from a JSON file; a failure shows in the card.
  async _load(url) {
    try {
      const r = await fetch(url, {cache: 'no-cache'});
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
    (this.shadowRoot || this.attachShadow({mode: 'open'})).innerHTML = `<ha-card><pre style="margin: 0; padding: 16px;
      white-space: pre-wrap; color: var(--error-color, #db4437)"></pre></ha-card>`;
    this.shadowRoot.querySelector('pre').textContent = message;
  }

  // Builds the plan for `home` (once per home); every `hass` update then only renders changes.
  _build(home) {
    this._home = home;
    this._seen = null;
    const VB = home.view;
    // Blurs are light spreading, so they scale with the metres (km); strokes and text with the view (--k). The numbers
    // were tuned on a drawing 1145 units wide at 175 units per metre.
    const km = this._km = home.units_per_metre / 175;
    clearTimeout(this._timer);
    this._entities = entitiesOf(home);
    this._palette = paletteOf(home);
    if (!this.shadowRoot) this.attachShadow({mode: 'open'});
    const pos = (x, y) => `left:${((x - VB.x) / VB.w * 100).toFixed(2)}%;top:${((y - VB.y) / VB.h * 100).toFixed(2)}%`;
    // An editor's layer stays where it is through the rebuild (taking it out would drop the pointer it's dragging).
    const layer = this._editLayer?.parentNode === this.shadowRoot ? this._editLayer : null;
    if (layer) for (const n of [...this.shadowRoot.childNodes]) if (n !== layer) n.remove();
    (layer ? html => layer.insertAdjacentHTML('beforebegin', html) : html => { this.shadowRoot.innerHTML = html; })(`<style>${style(this._palette)}</style>
      <ha-card>
        <div class="plan" style="--k: ${+(VB.w / 1145).toFixed(4)}">
          <svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}">
            <defs>${blur(VB, 'blur', 14 * km)}${blur(VB, 'penumbra', 10 * km)}${blur(VB, 'sunblur', 4 * km)}${blur(VB, 'bounceblur', 55 * km)}
              <radialGradient id="sky-fall"><stop offset="0" stop-color="currentColor"/>
              <stop offset="0.6" stop-color="currentColor" stop-opacity="0.8"/>
              <stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>
              ${['sun-mask', 'sun-mask-walls'].map(id => `${maskOverView(VB, id)}
                <rect x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" fill="#fff"/><g fill="#000"></g></mask>`).join('')}
              ${Object.entries(home.rooms).map(([name, region]) => `<clipPath id="room-${name}">${clipShapes(region)}</clipPath>`).join('')}
              <clipPath id="furn-clip">${furnitureClip(home.furniture)}</clipPath>
            </defs>
            ${planSvg(home)}
          </svg>
          ${home.markers.map((m, i) => `<div class="m${m.small ? ' small' : ''}${m.side ? ' side' : ''}" data-i="${i}" style="${pos(m.x, m.y)}">
            <ha-icon icon="${m.icon}"></ha-icon><span></span></div>`).join('')}
        </div>
      </ha-card>`);
    const $ = id => this.shadowRoot.getElementById(id);
    this._el = {plan: this.shadowRoot.querySelector('.plan'), defs: this.shadowRoot.querySelector('defs'),
      sun: $('sun'), sunOnFurn: $('sun-on-furn'), skylight: $('skylight'), skyFall: $('sky-fall'),
      sunBlur: this.shadowRoot.querySelector('#sunblur feGaussianBlur'),
      sunMask: this.shadowRoot.querySelector('#sun-mask g'), sunMaskWalls: this.shadowRoot.querySelector('#sun-mask-walls g')};
    this._glows = home.lights.map((g, i) => this._buildGlow(g, i));
    this._fx = home.lights.map(() => null);
    this._shutters = home.openings.map(o => {
      const [x, y, width, height] = shutterRect(o);
      return $('shutters').appendChild(svgEl('rect', {x, y, width, height}));
    });
    this._buildDaylight();
    this._markers = [...this.shadowRoot.querySelectorAll('.m')];
    if (this._editLayer && !layer) this.shadowRoot.append(this._editLayer);
    this._markers.forEach(el => el.addEventListener('click', () => this._tap(home.markers[el.dataset.i])));
    if (this._io) { this._io.disconnect(); this._io.observe(this._el.plan); }
    if (this._hass) this.hass = this._hass;
  }

  // A glow: its shape in its layer, and for a point light its pool on the floor and the furniture's shadows from it.
  _buildGlow(g, i) {
    const $ = id => this.shadowRoot.getElementById(id);
    const clip = g.clip ? {'clip-path': `url(#room-${g.clip})`} : {};
    const el = svgEl('g', clip, shapesSvg(g.shape));
    const layer = $(g.over ? 'glows-over' : g.top ? 'glows-top' : 'glows');
    if (!g.pool) return {el: layer.appendChild(el), shapes: [...el.children]};
    const {x, y, r, height: h, shadows} = g.pool;
    // A piece h' high, lit from h, throws a shadow h' / (h - h') times its distance from the light (capped).
    const cast = shadows.map(n => caster(this._home.furniture, n)).map(([p, ph]) => shadowOf(p, x, y, ph >= h ? 2.5 : Math.min(ph / (h - ph), 2.5))).join('');
    const v = this._home.view;
    this._el.defs.insertAdjacentHTML('beforeend', `${maskOverView(v, `pool-${i}`)}
      <radialGradient id="falloff-${i}"><stop offset="0" stop-color="#fff"/>
      <stop offset="0.45" stop-color="#999"/><stop offset="1" stop-color="#000"/></radialGradient>
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#falloff-${i})"/>
      <g fill="#000" filter="url(#penumbra)">${cast}</g></mask>
      ${maskOverView(v, `fade-${i}`)}<circle cx="${x}" cy="${y}" r="${r}" fill="url(#falloff-${i})"/></mask>`);
    // The pool lights the floor, under the fittings and furniture, whatever layer the glow itself is in; the
    // shadows fade out with the light, towards the edge of the pool.
    const pool = $('glows').appendChild(svgEl('g', clip,
      `<circle cx="${x}" cy="${y}" r="${r}" fill-opacity="0.75" mask="url(#pool-${i})"/>`));
    const shade = $('cast').appendChild(svgEl('g', clip, `<g mask="url(#fade-${i})">${cast}</g>`));
    layer.appendChild(el);
    return {el, pool, shade, shapes: [...el.children, ...pool.children]};
  }

  // Per opening: the direct sun patch, its glow (the same patch, widely blurred) and the daylight pool through it;
  // then the daylight spilling on through the doors.
  _buildDaylight() {
    const sun = this.shadowRoot.getElementById('sun-light');
    const {openings, sun: {spill}} = this._home;
    this._patches = openings.map(o => ['patch', 'bounce'].map(cls => sun.appendChild(svgEl('polygon', {
      // As attributes, not CSS, so the copy on the furniture (a <use>) gets them too.
      class: cls, 'fill-opacity': cls === 'patch' ? 0.85 : 0.55, 'clip-path': `url(#room-${o.room})`,
      ...(cls === 'bounce' ? {filter: 'url(#bounceblur)'} : {})}))));
    const ellipse = (cx, cy, rx, ry, clip) => this._el.skylight.appendChild(svgEl('ellipse',
      {cx, cy, rx, ry, fill: 'url(#sky-fall)', 'clip-path': `url(#room-${clip})`}));
    this._sky = openings.map(o => ellipse(...skyEllipse(o, this._home.units_per_metre), o.sky));
    this._spills = spill.map(p => ellipse(p.cx, p.cy, p.rx, p.ry, p.clip));
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._home) return;
    const dark = !!hass.themes?.darkMode, states = this._entities.map(id => hass.states[id]);
    const seen = this._seen;
    if (seen && seen.dark === dark && seen.config === this._config && states.every((s, i) => s === seen.states[i])) return;
    this._seen = {dark, config: this._config, states};
    this.toggleAttribute('dark', dark);
    const home = this._home;
    const scene = sunScene(home, hass.states, this._config?.north ?? home.sun.north, dark);
    this._renderGlows(hass, scene);
    this._renderDaylight(scene, dark);
    this._renderSun(scene);
    home.openings.forEach((o, i) => {
      const pos = hass.states[o.shutter]?.attributes.current_position;
      css(this._shutters[i], 'opacity', pos === undefined ? 0 : (100 - pos) / 100 * 0.85);
    });
    this._renderMarkers(hass);
  }

  _renderGlows(hass, scene) {
    const outside = daylight(scene.el);
    this._home.lights.forEach((g, i) => {
      // A light without entities: lit always, while the sun is down, or never, as a state of its own.
      const s = g.entities?.length ? g.entities.map(e => hass.states[e]).find(s => (g.states || ['on']).includes(s?.state))
        : g.lit === 'always' || (g.lit === 'dark' && scene.el < 0) ? {entity_id: `light ${i}`, state: 'on', attributes: {}} : undefined;
      const c = s && (g.color || lightRgb(s)), color = c && rgb(c);
      const {el, pool, shade, shapes} = this._glows[i];
      if (!g.multi) shapes.forEach(sh => attr(sh, paintProp(sh), color || 'transparent'));
      const level = (s?.attributes.brightness ?? 255) / 255;
      const opacity = s ? (0.35 + 0.6 * level) * (g.outdoor ? 1 - 0.85 * outside : 1) : 0;
      css(el, 'opacity', opacity);
      if (pool) css(pool, 'opacity', opacity);
      if (shade) css(shade, 'opacity', s ? 0.2 + 0.35 * level : 0);
      // A running effect (played by _play); restarted only when the effect changes, not on every update.
      const effect = s && g.effect ? g.effect : s && !g.multi && s.attributes.effect && !['Stop', 'None', 'none', 'off'].includes(s.attributes.effect)
        && !!(s.attributes.flowing ?? true) ? s.attributes.effect : null;
      const key = effect && `${s.entity_id}:${effect}:${color}`;
      if (this._fx[i]?.key !== key) {
        // The effect's colour and brightness are set as styles over the plain attributes; stopping removes them.
        // While it plays, will-change gives its shapes layers of their own (in Chrome): each redraw then repaints
        // only them, not the whole plan with all its blurs (measured: a tenth of the work).
        const playing = !!key;
        shapes.forEach(sh => {
          css(sh, 'will-change', playing ? 'opacity' : '');
          if (!playing) { css(sh, paintProp(sh), ''); css(sh, `${paintProp(sh)}-opacity`, ''); }
        });
        this._fx[i] = key ? {key, tl: timeline(effect, c, this._home.effects), start: performance.now(), shapes} : null;
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
      const {color, opacity, next: wait} = frameAt(fx.tl, still ? 0 : now - fx.start);
      // fill-opacity, not opacity: changing opacity (to or from 1 above all) makes Chrome rebuild the plan's layers and
      // raster all of it again, about 20 times as much work per redraw.
      fx.shapes.forEach(sh => {
        const prop = paintProp(sh), base = +(sh.getAttribute(`${prop}-opacity`) ?? 1);
        css(sh, prop, rgb(color));
        css(sh, `${prop}-opacity`, +(base * opacity).toFixed(3));
      });
      next = Math.min(next, wait);
    }
    if (!still) this._timer = setTimeout(() => this._play(), next);
  }

  connectedCallback() {
    if (this._isPreview) { previews.add(this); this._offer(); }
    this._replay ||= () => this._play();
    document.addEventListener('visibilitychange', this._replay);
    this._io ||= new IntersectionObserver(([e]) => { this._offscreen = !e.isIntersecting; this._play(); });
    this._io.observe(this.shadowRoot?.querySelector('.plan') || this);
    this._play();
  }

  disconnectedCallback() {
    previews.delete(this);
    document.removeEventListener('visibilitychange', this._replay);
    this._io?.disconnect();
    clearTimeout(this._timer);
  }

  // The floors tinted for the time of day, mixed into the theme's own colours (so floors, fittings and furniture all
  // change together and the lamps' glows still show on top); the labels' colours to go with them; the daylight pools.
  _renderDaylight({tint, sky, skyThrough, spills}, dark) {
    const tinted = {};
    for (const name of this._palette.tinted) {
      tinted[name] = rgbOf(this._palette[dark ? 'dark' : 'light'][name])
        .map((b, i) => Math.round(b * (1 - tint.opacity) + tint.color[i] * tint.opacity));
      css(this._el.plan, `--${name}`, `rgb(${tinted[name].join(', ')})`);
    }
    // A picture of the plan gets the same tint laid over it (the same mix as the colours above).
    const bgTint = this.shadowRoot.getElementById('background-tint');
    if (bgTint) {
      attr(bgTint, 'fill', `rgb(${tint.color.join(', ')})`);
      attr(bgTint, 'opacity', tint.opacity.toFixed(3));
    }
    for (const [label, under] of [['room', 'floor'], ['lbl', 'furn2']]) {
      const {fill, halo} = labelColors(tinted[under], [sky.color, sky.opacity]);
      css(this._el.plan, `--${label}`, fill);
      css(this._el.plan, `--${label}-halo`, halo);
    }
    css(this._el.skyFall, 'color', `rgb(${sky.color.join(', ')})`);
    css(this._el.skylight, 'opacity', sky.opacity.toFixed(3));
    this._sky.forEach((el, k) => css(el, 'opacity', skyThrough[k]));
    this._spills.forEach((el, k) => css(el, 'opacity', spills[k].toFixed(3)));
  }

  // Direct sunlight: patches on the floor behind the openings, with the shadows of the blockers and the furniture.
  _renderSun(scene) {
    const {sun, sunOnFurn} = this._el;
    css(sun, 'opacity', scene.opacity);
    css(sunOnFurn, 'opacity', scene.opacity);
    if (!scene.lit) return;
    css(sun, 'fill', scene.fill);
    css(sunOnFurn, 'fill', scene.fill);
    attr(this._el.sunBlur, 'stdDeviation', (scene.blur * this._km).toFixed(1));
    // Each patch fainter as the sun grazes its wall.
    this._patches.forEach(([patch, glow], k) => {
      attr(patch, 'points', scene.patches[k]);
      attr(glow, 'points', scene.patches[k]);
      attr(patch, 'fill-opacity', +(0.85 * scene.facing[k]).toFixed(3));
      attr(glow, 'fill-opacity', +(0.55 * scene.facing[k]).toFixed(3));
    });
    // The shadows only change when the sun (or the facing) moves.
    const {walls, rooms} = sunShadows(this._home, scene);
    const all = walls + rooms.map(([clip, svg]) => `<g clip-path="url(#room-${clip})">${svg}</g>`).join('');
    put(this._el.sunMask, 'html', all, () => { this._el.sunMask.innerHTML = all; });
    put(this._el.sunMaskWalls, 'html', walls, () => { this._el.sunMaskWalls.innerHTML = walls; });
  }

  _renderMarkers(hass) {
    this._home.markers.forEach((m, i) => {
      const el = this._markers[i];
      const s = hass.states[m.entity];
      if (!s) { el.classList.add('unavailable'); attr(el, 'title', `${m.entity}: not found`); return; }
      const power = m.power ? hass.states[m.power]?.state === 'on' : true;
      const on = isActive(m, s, power);
      // Always a real boolean: toggle(name, undefined) flips the class on every update.
      el.classList.toggle('on', !!on);
      el.classList.toggle('unavailable', s.state === 'unavailable' || (!!m.power && !power));
      attr(el.firstElementChild, 'icon', iconOf(m, s));
      // A light's own colour, unless it's near white (invisible on the marker's chip).
      const rgb = s.attributes.rgb_color;
      css(el, '--marker-color', rgb && Math.min(...rgb) < 200 ? lightColor(s) : '');
      text(el.lastElementChild, labelOf(m, s, hass.states));
      const name = s.attributes.friendly_name || m.entity;
      attr(el, 'title', `${name}: ${hass.formatEntityState ? hass.formatEntityState(s) : s.state}`);
    });
  }

  _tap(m) {
    if (this._editLayer) return;
    // A device that is off is woken (Wake-on-LAN) instead of showing its details, which are unavailable then.
    if (m.wake && this._hass.states[m.power]?.state !== 'on') this._hass.callService('button', 'press', {entity_id: m.wake});
    else if (m.tap === 'toggle') this._hass.callService('homeassistant', 'toggle', {entity_id: m.entity});
    else this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: m.entity}, bubbles: true, composed: true}));
  }

  getCardSize() { return 9; }
  getGridOptions() { return {columns: 12, min_columns: 6}; }

  // HA's visual editor: loaded on demand (loader.js), so the card's bundle stays small.
  static async getConfigElement() {
    await loadEditor();
    return document.createElement('lightwell-card-editor');
  }

  // A new card from HA's card picker: a small home that works (stub.js), with a light of the house.
  static getStubConfig(hass) {
    return {home: stubHome(hass?.states)};
  }
}

// Registers the card for `home` (from defineHome) as the element `tag`, and in HA's card picker as `name`. The home is
// on the element's class as `home` (`customElements.get(tag).home`), for the simulator and snapshot.sh.
export function defineFloorplanCard(tag, home, {name = tag, description = ''} = {}) {
  const Card = class extends FloorplanCard {};
  Card.home = home;
  customElements.define(tag, Card);
  window.customCards = window.customCards || [];
  window.customCards.push({type: tag, name, description});
  return Card;
}
