// A home's drawing as data: lists of shapes, turned into SVG.
//
// A shape is one of `rect: [x, y, w, h]`, `circle: [cx, cy, r]`, `ellipse: [cx, cy, rx, ry]`, `poly: [[x, y], ...]`,
// `path: 'M…'` or `text: 'Kitchen'` with `at: [x, y]`, plus any SVG attributes: `class`, `rx`, `fill`, `opacity`,
// `transform`, `style`… (snake_case names are written kebab-case: `stroke_width` → stroke-width). `svg: '<…>'` is
// raw SVG, for anything else. A string instead of a list is raw SVG too.
//
// `repeat: {count, step: [dx, dy]}` draws a shape `count` times, each copy moved on by `step`; an attribute given as a
// list takes its values in turn, copy by copy (`fill: ['#f00', '#0f0']`).

const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const GEOMETRY = ['rect', 'circle', 'ellipse', 'poly', 'path', 'text', 'at', 'svg', 'repeat'];
const attrs = shape => Object.entries(shape).filter(([k, v]) => !GEOMETRY.includes(k) && v !== undefined)
  .map(([k, v]) => ` ${k.replace(/_/g, '-')}="${esc(v)}"`).join('');

export function shapeSvg(s) {
  if (s.svg !== undefined) return s.svg;
  if (s.repeat) return repeated(s);
  const a = attrs(s);
  if (s.rect) { const [x, y, w, h] = s.rect; return `<rect${a} x="${x}" y="${y}" width="${w}" height="${h}"/>`; }
  if (s.circle) { const [cx, cy, r] = s.circle; return `<circle${a} cx="${cx}" cy="${cy}" r="${r}"/>`; }
  if (s.ellipse) { const [cx, cy, rx, ry] = s.ellipse; return `<ellipse${a} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`; }
  if (s.poly) return `<polygon${a} points="${s.poly.map(p => p.join(',')).join(' ')}"/>`;
  if (s.path !== undefined) return `<path${a} d="${esc(s.path)}"/>`;
  if (s.text !== undefined) return `<text${a} x="${s.at[0]}" y="${s.at[1]}">${esc(s.text).replace(/>/g, '&gt;')}</text>`;
  throw new Error(`not a shape: ${JSON.stringify(s)}`);
}

// A repeated shape's copies.
function repeated({repeat: {count, step: [dx, dy]}, ...s}) {
  const move = (v, i) => {
    if (s.rect) return {rect: [s.rect[0] + dx * i, s.rect[1] + dy * i, s.rect[2], s.rect[3]]};
    if (s.circle) return {circle: [s.circle[0] + dx * i, s.circle[1] + dy * i, s.circle[2]]};
    if (s.ellipse) return {ellipse: [s.ellipse[0] + dx * i, s.ellipse[1] + dy * i, s.ellipse[2], s.ellipse[3]]};
    if (s.poly) return {poly: s.poly.map(([x, y]) => [x + dx * i, y + dy * i])};
    if (s.text !== undefined) return {at: [s.at[0] + dx * i, s.at[1] + dy * i]};
    return {transform: `translate(${dx * i} ${dy * i})`};
  };
  return Array.from({length: count}, (_, i) => {
    const copy = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) && !GEOMETRY.includes(k) ? v[i % v.length] : v]));
    return shapeSvg({...copy, ...move(s, i)});
  }).join('');
}

export const shapesSvg = list => (typeof list === 'string' ? list : (list || []).map(shapeSvg).join(''));

// What's wrong with a shape list, if anything (for defineHome).
export function shapeErrors(list) {
  if (list === undefined || typeof list === 'string') return [];
  if (!Array.isArray(list)) return ['needs a list of shapes'];
  return list.flatMap((s, i) => {
    const kinds = GEOMETRY.filter(k => k !== 'at' && k !== 'repeat' && s?.[k] !== undefined);
    if (kinds.length !== 1) return [`[${i}]: needs exactly one of rect, circle, ellipse, poly, path, text or svg`];
    if (kinds[0] === 'text' && !(Array.isArray(s.at) && s.at.length === 2)) return [`[${i}]: a text needs at: [x, y]`];
    const r = s.repeat;
    if (r && !(r.count > 0 && Array.isArray(r.step) && r.step.length === 2)) return [`[${i}]: repeat needs a count and step: [dx, dy]`];
    return [];
  });
}
