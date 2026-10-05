// The card's editor in Home Assistant (the dashboard's "Edit card"), bundled on its own into
// dist/lightwell-card-editor.js, which the card loads when HA asks for its editor (card.js, loader.js): registers
// <lightwell-card-editor>, HA's config element, and the shared editor it shows (<lightwell-editor shell="ha">,
// opening in its Build view). HA gives it the card's config (setConfig) and `hass`; every edit goes back to HA as
// `config-changed` with the home in the config, which the dashboard keeps.
//
// A card whose home is a file (home_url) can't be saved from here (the frontend can't write /config/www/), so it says
// so and offers both ways on: the home moved into the card, or the file edited in the standalone editor.
import {LightwellEditor} from './editor.js';
import {stubHome} from '../stub.js';

// The standalone editor, online.
const HOSTED = 'https://viktorbalog.github.io/lightwell-card/editor/';

if (!customElements.get('lightwell-editor')) customElements.define('lightwell-editor', LightwellEditor);

const STYLE = `
  :host { display: block; }
  .file p { margin: 0 0 12px; line-height: 1.5; }
  .file .way { margin: 0 0 16px; padding: 12px 14px; border: 1px solid var(--divider-color, #ddd); border-radius: 8px; }
  .file .way p { margin: 8px 0 0; color: var(--secondary-text-color, #666); }
  .file h3 { margin: 0; font-size: 1em; font-weight: 600; }
  .file code { font-size: 0.95em; }
  .file .why { color: var(--error-color, #db4437); }
  .file button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 0; cursor: pointer;
    background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  .file a { color: var(--primary-color, #03a9f4); }
`;

class LightwellCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'}).innerHTML = `<style>${STYLE}</style><div class="box"></div>`;
    this._box = this.shadowRoot.querySelector('.box');
  }

  setConfig(config) {
    this._config = config;
    if (config.home_url && !config.home) this._showFile(config.home_url);
    else this._showEditor(config.home);
  }

  set hass(hass) {
    this._hass = hass;
    if (this._editor) this._editor.hass = hass;
  }

  // The editor, with the card's home (or, without one, a small home to start from, which the card then gets).
  _showEditor(home) {
    if (!this._editor) {
      this._box.textContent = '';
      const editor = this._editor = document.createElement('lightwell-editor');
      editor.setAttribute('shell', 'ha');
      if (this._hass) editor.hass = this._hass;
      editor.addEventListener('value-changed', e => this._send({...this._config, home: e.detail.value}));
      this._box.append(editor);
    }
    if (home && typeof home === 'object') this._editor.value = home;
    else {
      this._editor.value = stubHome(this._hass?.states);
      this._send({...this._config, home: this._editor.value});
    }
  }

  // A home kept in a file: what can be done with it.
  _showFile(url) {
    if (this._shown === url) return;
    this._shown = url;
    this._editor = null;
    const file = url.replace(/^\/local\//, '/config/www/'), name = url.split('/').pop().split('?')[0];
    this._box.innerHTML = `<div class="file">
      <p>This card's home is kept in a file, <code class="url"></code>, and Home Assistant's card editor can't save files.</p>
      <div class="way"><button type="button">Edit it here</button>
        <p>The home moves into the card: the dashboard keeps it from then on, and the file stays as it is, no longer
          used.</p></div>
      <div class="way"><h3>Or keep the file</h3>
        <p>Edit it in the <a class="hosted" target="_blank" rel="noopener">Lightwell editor</a>: <a class="download">download
          it</a>, open it there (connect the editor to this Home Assistant for your devices), save it as JSON, and put it
          back as <code class="path"></code>.</p></div>
      <p class="why"></p></div>`;
    const $ = s => this._box.querySelector(s);
    $('.url').textContent = url;
    $('.path').textContent = file;
    $('.hosted').href = HOSTED;
    Object.assign($('.download'), {href: url, download: name});
    $('button').onclick = async () => {
      try {
        const r = await fetch(url, {cache: 'no-cache'});
        if (!r.ok) throw new Error(`${url}: ${r.status} ${r.statusText}`);
        const home = await r.json(), {home_url: _, ...rest} = this._config;
        this._shown = null;
        this._config = {...rest, home};
        this._showEditor(home);
        this._send(this._config);
      } catch (e) {
        $('.why').textContent = `Couldn't read it: ${e.message}`;
      }
    };
  }

  _send(config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', {detail: {config}, bubbles: true, composed: true}));
  }
}

if (!customElements.get('lightwell-card-editor')) customElements.define('lightwell-card-editor', LightwellCardEditor);
