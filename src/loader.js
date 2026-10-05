// Loads the card's editor for Home Assistant (dist/lightwell-card-editor.js, src/editor/ha.js) when HA asks for it,
// so that the card's own bundle stays small: from next to the card (HACS installs it there), or else from jsDelivr
// for the card's version.
//
// The card's address is worked out as it loads: HA loads its resources as modules, which have no currentScript, so
// it's read from a stack trace, whose first line names the file running.
const EDITOR = 'lightwell-card-editor.js';
// The card's version, set by the build (scripts/build.mjs).
const VERSION = typeof LIGHTWELL_VERSION === 'string' ? LIGHTWELL_VERSION : undefined; // eslint-disable-line no-undef

// The first script address in a stack trace (with its query, without the line and column), or undefined.
export function scriptUrl(stack) {
  const m = String(stack || '').match(/(https?:\/\/[^\s()'"@]+?\.js)(\?[^\s():'"]*)?/);
  return m ? m[1] + (m[2] || '') : undefined;
}

// Where to look for the editor: next to the card at `self` (its query kept, for HACS's cache tag), then jsDelivr for
// `version`.
export function editorUrls(self, version) {
  const urls = [];
  if (self) {
    const u = new URL(self);
    u.pathname = u.pathname.replace(/[^/]*$/, EDITOR);
    urls.push(u.href);
  }
  if (version) urls.push(`https://cdn.jsdelivr.net/gh/viktorbalog/lightwell-card@v${version}/dist/${EDITOR}`);
  return urls;
}

const SELF = (() => {
  try {
    return document.currentScript?.src || scriptUrl(new Error().stack);
  } catch {
    return undefined;
  }
})();

const script = url => new Promise((resolve, reject) => {
  const s = Object.assign(document.createElement('script'), {src: url});
  s.onload = resolve;
  s.onerror = () => { s.remove(); reject(new Error(`${url} didn't load`)); };
  document.head.append(s);
});

let loading;
// Resolves once <lightwell-card-editor> is defined.
export function loadEditor() {
  if (customElements.get('lightwell-card-editor')) return Promise.resolve();
  loading ??= editorUrls(SELF, VERSION).reduce((p, url) => p.catch(() => script(url)), Promise.reject(new Error('no address')))
    .then(() => customElements.whenDefined('lightwell-card-editor'))
    .catch(e => {
      loading = null;
      throw new Error(`Lightwell's editor couldn't be loaded (${e.message}): edit the card in YAML instead.`);
    });
  return loading;
}
