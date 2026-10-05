// A home's furniture (`home.furniture`, see home.js) drawn, as a clip, and as shadow casters: all from the one
// definition of each piece.
//
// A piece: `shape` ({rect: [x, y, w, h], rx, turn}, turned by `turn` degrees around its centre; {circle: [cx, cy, r]};
// or {poly: [[x, y], ...], turn}, turned around the middle of its bounding box); `height` in metres (pieces without one cast no shadows); `shadow_room`, the room
// its shadow in the sun stays in (without one it casts none in the sun); `class`, furn (the default) or furn2 for
// smaller, darker pieces; `extra`, shapes (shapes.js) drawn with it in the piece's own frame, turned with it:
// devices on it, cushions, lines. Pieces are drawn in their order.
import {box, polyMiddle, round, turnPoly} from './geometry.js';
import {shapesSvg} from './shapes.js';

// A piece's outline as an SVG element (with `attrs`, e.g. its class).
function outline({shape: {rect, rx, circle, poly}}, attrs = '') {
  if (rect) return `<rect${attrs} x="${rect[0]}" y="${rect[1]}" width="${rect[2]}" height="${rect[3]}"${rx ? ` rx="${rx}"` : ''}/>`;
  if (circle) return `<circle${attrs} cx="${circle[0]}" cy="${circle[1]}" r="${circle[2]}"/>`;
  return `<path${attrs} d="M${poly.map(p => p.join(',')).join(' L')} Z"/>`;
}

// The transform that turns a piece, if it is turned: around a rectangle's centre, or a polygon's middle.
export const pieceCentre = ({rect, poly}) => (rect ? [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2] : poly ? polyMiddle(poly) : null);
const turn = ({shape}) => {
  const c = shape.turn && pieceCentre(shape);
  return c ? `rotate(${shape.turn} ${c[0]} ${c[1]})` : '';
};

// Every piece, drawn.
export const furnitureSvg = furniture => Object.values(furniture).map(p => {
  const svg = outline(p, ` class="${p.class || 'furn'}"`) + shapesSvg(p.extra);
  return turn(p) ? `<g transform="${turn(p)}">${svg}</g>` : svg;
}).join('\n');

// Every piece's outline, for a clip path (the daylight drawn again on the furniture tops).
export const furnitureClip = furniture => Object.values(furniture)
  .map(p => outline(p, turn(p) ? ` transform="${turn(p)}"` : '')).join('');

// A piece as a shadow caster: [polygon, height in metres].
export function caster(furniture, name) {
  const p = furniture[name];
  if (!p?.height) throw new Error(`no furniture casting shadows called ${name}`);
  const {rect, circle, poly, turn = 0} = p.shape;
  return [rect ? box(...rect, turn) : circle ? round(...circle) : turnPoly(poly, turn), p.height];
}

// The casters whose sun shadows stay in `room`.
export const castersIn = (furniture, room) => Object.keys(furniture)
  .filter(n => furniture[n].shadow_room === room && furniture[n].height).map(n => caster(furniture, n));
