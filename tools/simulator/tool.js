// Shared by the simulator, the bench and the reference page: which card, home and states to show, from the URL.
// - ?card=<script>: the card's bundle (default: this repo's dist/lightwell-card.js);
// - ?tag=<element>: the element it registers (default: lightwell-card);
// - ?home=<script>: a script setting window.FLOORPLAN_HOME (home-tool.mjs js; default: the example home), for a card
//   without a home of its own (pages opened from file:// can't fetch a JSON file);
// - ?states=<script>: a script setting window.STATES and window.HOME (the location), as snapshot.sh writes it
//   (default: the example's made-up states).
// Load this with a plain <script> before the page's own scripts: it writes the script tags for all of them. Scripts
// are taken by path only, on the page's own site (no scheme, no //, no quotes): a link to a published page can't
// make it run someone else's.
const Q = new URLSearchParams(location.search);
const ownScript = (v, fallback) => (v && /^(?!\/\/)[\w ./%~-]+\.js$/.test(v) ? v : fallback);
const TOOL = {card: ownScript(Q.get('card'), '../../dist/lightwell-card.js'), tag: Q.get('tag') || 'lightwell-card',
  home: ownScript(Q.get('home'), '../../example/home.js'), states: ownScript(Q.get('states'), '../../example/states.js')};
document.write([TOOL.states, TOOL.card, TOOL.home].map(src => `<script src="${src}"><\/script>`).join(''));

// A card config: with the home in it, unless the card's class has one of its own.
TOOL.config = (config = {}) => (customElements.get(TOOL.tag).home ? config : {home: window.FLOORPLAN_HOME, ...config});
// A new card element, configured.
TOOL.card$ = (config = {}) => {
  const c = document.createElement(TOOL.tag);
  c.setConfig(TOOL.config(config));
  return c;
};
// The home, with the defaults the pages rely on.
TOOL.plan = () => {
  const h = customElements.get(TOOL.tag).home || window.FLOORPLAN_HOME;
  return {...h, openings: h.openings || [], sun: {entity: 'sun.sun', weather: 'weather.home', north: 0, ...h.sun},
    simulator: h.simulator || {}};
};
