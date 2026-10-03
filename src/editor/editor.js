// <lightwell-editor>: an editor for homes. The card in the middle (light or dark), with the simulator's controls
// (controls.js) on the left and the home's YAML on the right; every change re-derives the home and redraws the card,
// or lists the check's messages at the bottom while it doesn't pass. The file is opened and saved as YAML (comments
// kept, model.js) or JSON (for the card's home_url), and the work in progress is kept in the browser's storage.
//
// Properties: `states` (the states in use, by entity id) and `location` ({latitude, longitude}, where the sun is
// worked out for), set before it's connected; `example` (the YAML a new home starts from).
import {HomeModel, yamlOf} from './model.js';
import {simulatorControls} from './controls.js';
import {droppedFile, formatOf, hasFileAccess, pickFile, renamed, saveFileAs, writeFile} from './files.js';

// The work in progress, in the browser's storage: {text, name, saved} (saved: the text as last opened or saved).
const DRAFT = 'lightwell-editor:draft';
// How long the text view waits after typing before the card follows (ms).
const TYPING = 250;

const STYLE = `
  :host { display: grid; grid-template-rows: auto 1fr auto; height: 100%; font: 14px system-ui, sans-serif;
    color: #222; background: #f6f6f4; --line: #ddd; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; background: #fff;
    border-bottom: 1px solid var(--line); }
  header h1 { font-size: 15px; margin: 0 10px 0 0; }
  header .name { color: #666; margin-right: auto; }
  header .name.unsaved::after { content: ' •'; color: #e65100; }
  button { font: inherit; padding: 4px 10px; border: 1px solid #ccc; border-radius: 6px; background: #fafafa;
    color: inherit; cursor: pointer; }
  button:hover:not(:disabled) { background: #eee; } button:disabled { opacity: 0.45; cursor: default; }
  button[aria-pressed="true"] { background: #1e88e5; border-color: #1e88e5; color: #fff; }
  main { display: grid; grid-template-columns: 340px minmax(320px, 1fr) minmax(300px, 0.8fr); min-height: 0; }
  main > * { overflow: auto; min-height: 0; }
  .controls { padding: 12px; border-right: 1px solid var(--line); background: #fff; }
  .controls form { width: auto; }
  .preview { padding: 16px; display: flex; justify-content: center; align-items: flex-start; }
  .preview.dark { background: #111; }
  .preview > div { width: 100%; max-width: 900px; }
  ha-card { display: block; border-radius: 12px; background: var(--card-background-color, #fff); }
  .preview.dark ha-card { --card-background-color: #1c1c1c; }
  .text { display: flex; border-left: 1px solid var(--line); }
  textarea { flex: 1; border: 0; padding: 10px 12px; resize: none; font: 12.5px/1.5 ui-monospace, Menlo, Consolas, monospace;
    tab-size: 2; white-space: pre; outline: none; background: #fff; color: #222; }
  footer { max-height: 30vh; overflow: auto; border-top: 1px solid var(--line); background: #fff; }
  footer:empty { display: none; }
  footer p { margin: 0; padding: 4px 12px; font: 12.5px ui-monospace, Menlo, Consolas, monospace; color: #b00020; }
  footer p.info { color: #555; font-family: inherit; }
  .drop { position: absolute; inset: 0; display: none; place-items: center; background: rgba(30, 136, 229, 0.12);
    border: 3px dashed #1e88e5; font-size: 18px; pointer-events: none; }
  :host(.dragging) .drop { display: grid; }
  @media (max-width: 1000px) {
    main { grid-template-columns: 1fr; grid-auto-rows: auto; overflow: auto; }
    main > * { overflow: visible; }
    .text textarea { min-height: 50vh; }
  }
`;

const HTML = `
  <header>
    <h1>Lightwell editor</h1><span class="name"></span>
    <button data-act="new" title="Start again from the example home">New</button>
    <button data-act="open" title="Open a home file (YAML or JSON), or drop one on the page">Open…</button>
    <button data-act="save" title="Save (Ctrl+S)">Save</button>
    <button data-act="save-yaml" title="Save as a YAML file, comments kept">Save as YAML…</button>
    <button data-act="save-json" title="Save as JSON, for the card's home_url">Save as JSON…</button>
    <button data-act="undo" title="Undo (Ctrl+Z)">Undo</button>
    <button data-act="redo" title="Redo (Ctrl+Shift+Z)">Redo</button>
    <button data-act="dark" aria-pressed="false" title="Show the card in the dark theme">Dark</button>
  </header>
  <main>
    <div class="controls"><form></form></div>
    <div class="preview"><div></div></div>
    <div class="text"><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="The home's YAML"></textarea></div>
  </main>
  <footer aria-live="polite"></footer>
  <div class="drop">Drop a home file (YAML or JSON) to open it</div>
`;

const storage = {
  get() { try { return JSON.parse(localStorage.getItem(DRAFT)); } catch { return null; } },
  set(v) { try { localStorage.setItem(DRAFT, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};

export class LightwellEditor extends HTMLElement {
  constructor() {
    super();
    this.states = {};
    this.location = {latitude: 51.4779, longitude: 0};
    this.example = '';
  }

  connectedCallback() {
    if (this._root) return;
    const root = this._root = this.attachShadow({mode: 'open'});
    root.innerHTML = `<style>${STYLE}</style>${HTML}`;
    this.style.position ||= 'relative';
    const $ = s => root.querySelector(s);
    this._el = {name: $('.name'), text: $('textarea'), footer: $('footer'), preview: $('.preview'),
      buttons: Object.fromEntries([...root.querySelectorAll('[data-act]')].map(b => [b.dataset.act, b]))};

    const draft = storage.get();
    this.model = new HomeModel(draft?.text ?? this.example);
    this._file = {name: draft?.name ?? 'home.yaml', handle: null, saved: draft?.saved ?? this.model.text};
    this._dark = false;
    this._shown = {states: this.states, north: undefined};

    this._card = document.createElement('lightwell-card');
    $('.preview > div').appendChild(this._card);
    this._card.addEventListener('hass-more-info', e => this._controls?.moreInfo(e.detail.entityId));
    const plan = this.model.home || {openings: [], sun: {entity: 'sun.sun', weather: 'weather.home', north: 0}};
    this._controls = simulatorControls($('form'), {plan, states: this.states, location: this.location, help: false,
      onChange: shown => { this._shown = shown; this._renderCard(); }});

    root.addEventListener('click', e => {
      const act = e.target.closest?.('[data-act]')?.dataset.act;
      if (act) this._act(act);
    });
    this._el.text.addEventListener('input', () => {
      clearTimeout(this._typing);
      this._typing = setTimeout(() => this._textChanged(), TYPING);
    });
    this._el.text.addEventListener('keydown', e => {
      // Tab indents (two spaces) instead of leaving the text.
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
      }
    });
    this._keys = e => this._key(e);
    window.addEventListener('keydown', this._keys);
    this.addEventListener('dragover', e => { e.preventDefault(); this.classList.add('dragging'); });
    this.addEventListener('dragleave', e => { if (!this.contains(e.relatedTarget)) this.classList.remove('dragging'); });
    this.addEventListener('drop', async e => {
      e.preventDefault();
      this.classList.remove('dragging');
      const file = await droppedFile(e.dataTransfer);
      if (file) this._open(file);
    });
    this._changed({text: true});
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._keys);
  }

  // After the model changed: the text view (unless it's where the change came from), the card, the messages, the
  // buttons and the draft.
  _changed({text}) {
    if (text) this._el.text.value = this.model.text;
    const {home, data, errors} = this.model;
    if (home) {
      this._data = data;
      this._controls.setPlan(home);
    } else this._renderCard();
    this._el.footer.textContent = '';
    for (const e of errors) this._el.footer.appendChild(Object.assign(document.createElement('p'), {textContent: e}));
    if (errors.length && this._data) this._message('The card shows the last version without mistakes.', 'info');
    this._updateButtons();
    storage.set({text: this.model.text, name: this._file.name, saved: this._file.saved});
  }

  _renderCard() {
    if (!this._data) return;
    try {
      this._card.setConfig({home: this._data, north: this._shown.north});
      this._card.hass = {states: this._shown.states, themes: {darkMode: this._dark}, callService: this._controls.callService};
    } catch (e) {
      this._message(e.message);
    }
  }

  _message(text, kind = '') {
    this._el.footer.appendChild(Object.assign(document.createElement('p'), {textContent: text, className: kind}));
  }

  _updateButtons() {
    const b = this._el.buttons;
    b.undo.disabled = !this.model.canUndo;
    b.redo.disabled = !this.model.canRedo;
    b['save-json'].disabled = !this.model.data;
    b.dark.setAttribute('aria-pressed', this._dark);
    this._el.name.textContent = this._file.name;
    this._el.name.title = this._file.handle ? 'Saves back to this file' : hasFileAccess() ? 'Save asks where to save it' : 'Saving downloads it';
    this._el.name.classList.toggle('unsaved', this.model.text !== this._file.saved);
  }

  _textChanged() {
    clearTimeout(this._typing);
    if (this.model.setText(this._el.text.value)) this._changed({text: false});
  }

  async _act(act) {
    try {
      if (act === 'undo' || act === 'redo') {
        this._textChanged();
        if (this.model[act]()) this._changed({text: true});
      } else if (act === 'dark') {
        this._dark = !this._dark;
        this._el.preview.classList.toggle('dark', this._dark);
        this._renderCard();
        this._updateButtons();
      } else if (act === 'new') {
        if (this._unsaved() && !confirm('Start again from the example? The changes not saved are lost.')) return;
        this._open({name: 'home.yaml', text: this.example, handle: null});
      } else if (act === 'open') {
        if (this._unsaved() && !confirm('Open another file? The changes not saved are lost.')) return;
        const file = await pickFile();
        if (file) this._open(file);
      } else if (act === 'save') await this.save();
      else if (act === 'save-yaml') await this.save({as: 'yaml'});
      else if (act === 'save-json') await this.save({as: 'json'});
    } catch (e) {
      this._message(e.message);
    }
  }

  _unsaved() {
    return this.model.text !== this._file.saved;
  }

  // Opens a file ({name, text, handle}): a JSON file is edited as YAML, and saved back as JSON.
  _open({name, text, handle}) {
    if (formatOf(name) === 'json') {
      try {
        text = yamlOf(JSON.parse(text));
      } catch (e) {
        this._message(`${name}: ${e.message}`);
        return;
      }
    }
    this.model.open(text);
    this._file = {name, handle, saved: this.model.text};
    this._data = null;
    this._changed({text: true});
  }

  // Saves the home: back to its file (where the browser can; otherwise it asks where, or downloads it), or with `as`
  // ('yaml' or 'json') as a new file. Saving a YAML home as JSON is an export: the editor goes on with the YAML.
  async save({as} = {}) {
    this._textChanged();
    const format = as || formatOf(this._file.name);
    const text = format === 'json' ? this.model.toJSON() : this.model.text;
    let saved;
    if (!as && this._file.handle) {
      await writeFile(this._file.handle, text);
      saved = {name: this._file.name, handle: this._file.handle};
    } else {
      saved = await saveFileAs(text, format, renamed(this._file.name, format));
      if (!saved) return;
    }
    if (format === formatOf(this._file.name) || format === 'yaml') this._file = {...saved, saved: this.model.text};
    this._changed({text: false});
  }

  _key(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      this._act(e.shiftKey ? 'save-yaml' : 'save');
    } else if ((key === 'z' || key === 'y') && e.composedPath()[0] !== this._el.text) {
      // In the text view, its own undo; elsewhere the editor's.
      e.preventDefault();
      this._act(key === 'y' || e.shiftKey ? 'redo' : 'undo');
    }
  }
}
