// The editor's model: a home file kept as a `yaml` Document, so its comments and layout survive every edit. Edits are
// changes at a path (['furniture', 'sofa', 'shape', 'rect']); the home the card gets is derived from the document
// after each one. Undo and redo keep the text of each version (a home file is a few kilobytes).
//
// The text given back is the document stringified with the options below, which give the file back byte for byte as
// long as it's in the usual style (flow collections without padding, as in the example homes and the README).
import YAML from 'yaml';
import {defineHome} from '../home.js';

const TO_STRING = {lineWidth: 0, flowCollectionPadding: false};
// Versions kept for undo.
const HISTORY = 200;

const isCollection = node => YAML.isMap(node) || YAML.isSeq(node);

// The home in `text`: {data, home, errors}. `data`: the plain object (null when the YAML doesn't parse); `home`: it
// checked by defineHome (null with errors); `errors`: the parser's or defineHome's messages, one per mistake.
export function deriveHome(doc) {
  if (doc.errors.length) return {data: null, home: null, errors: doc.errors.map(e => e.message.split('\n')[0])};
  const data = doc.toJS();
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {data, home: null, errors: ['The file needs to be a home: a map of fields (view, units_per_metre, rooms, …)']};
  try {
    return {data, home: defineHome(data), errors: []};
  } catch (e) {
    return {data, home: null, errors: e.message.replace(/^Invalid home:\n/, '').split('\n')};
  }
}

// Sets `node` (a document node) to `value`, keeping what it can of the node: a number in a list stays where it is
// with its comments, a list stays a flow list. Returns the node to put in its place (the same one when it could).
function merge(doc, node, value, flow) {
  if (YAML.isScalar(node) && (value === null || typeof value !== 'object')) {
    node.value = value;
    return node;
  }
  if (YAML.isSeq(node) && Array.isArray(value)) {
    value.forEach((v, i) => { node.items[i] = i < node.items.length ? merge(doc, node.items[i], v, node.flow) : create(doc, v, node.flow); });
    node.items.length = value.length;
    return node;
  }
  if (YAML.isMap(node) && value && typeof value === 'object' && !Array.isArray(value)) {
    for (const pair of [...node.items]) if (!(String(pair.key?.value ?? pair.key) in value)) node.delete(pair.key);
    for (const [k, v] of Object.entries(value)) {
      const pair = node.items.find(p => String(p.key?.value ?? p.key) === k);
      if (pair) pair.value = merge(doc, pair.value, v, node.flow);
      else node.add(doc.createPair(k, create(doc, v, node.flow)));
    }
    return node;
  }
  const fresh = create(doc, value, flow || (isCollection(node) && node.flow));
  if (node?.commentBefore) fresh.commentBefore = node.commentBefore;
  if (node?.comment) fresh.comment = node.comment;
  return fresh;
}
// A new node for `value`, in the style of the example homes: inside a flow collection everything is flow; otherwise
// a collection is flow when it fits on a short line ({shape: {circle: [100, 100, 20]}, height: 0.5}), or is a list
// of numbers (or of lists of them, a polygon).
const SHORT = 80;
function create(doc, value, flow) {
  const node = doc.createNode(value);
  const children = n => n.items.map(i => (YAML.isPair(i) ? i.value : i));
  const flowAll = n => { if (isCollection(n)) { n.flow = true; children(n).forEach(flowAll); } };
  const numbers = n => YAML.isSeq(n) && n.items.every(i => (YAML.isScalar(i) && typeof i.value === 'number') || numbers(i));
  const style = n => {
    if (!isCollection(n)) return;
    children(n).forEach(style);
    const flat = n.clone();
    flowAll(flat);
    if (numbers(n) || new YAML.Document(flat).toString(TO_STRING).trimEnd().length <= SHORT) flowAll(n);
  };
  if (flow) flowAll(node);
  else style(node);
  return node;
}

// Sets the value at `path` in `doc`, creating the maps on the way; numbers and lists already there are changed in place.
function setIn(doc, path, value) {
  const node = doc.getIn(path, true);
  if (node === undefined) {
    const parent = path.length > 1 ? doc.getIn(path.slice(0, -1), true) : doc.contents;
    doc.setIn(path, create(doc, value, isCollection(parent) && parent.flow));
  } else {
    const fresh = merge(doc, node, value, false);
    if (fresh !== node) doc.setIn(path, fresh);
  }
}
// Inserts `value` into the list at `path` in `doc`, before `index` (at the end when it's left out); creates the list.
function insertIn(doc, path, value, index) {
  let seq = doc.getIn(path, true);
  if (seq === undefined) {
    doc.setIn(path, doc.createNode([]));
    seq = doc.getIn(path, true);
  }
  if (!YAML.isSeq(seq)) throw new Error(`${path.join('.')} isn't a list`);
  seq.items.splice(index ?? seq.items.length, 0, create(doc, value, seq.flow));
}

// Renames the key at `path` in its map (inside an `edit`), where it is, with its comments.
export function renameIn(doc, path, key) {
  const map = path.length > 1 ? doc.getIn(path.slice(0, -1), true) : doc.contents;
  const pair = YAML.isMap(map) && map.items.find(p => String(p.key?.value ?? p.key) === String(path.at(-1)));
  if (!pair) throw new Error(`Nothing at ${path.join('.')}`);
  if (map.items.some(p => p !== pair && String(p.key?.value ?? p.key) === key)) throw new Error(`There's already a ${key}`);
  if (YAML.isScalar(pair.key)) pair.key.value = key;
  else pair.key = doc.createNode(key);
}

// A home (plain data, say from a JSON file) as YAML text in the example homes' style.
export function yamlOf(data) {
  const doc = new YAML.Document();
  doc.contents = create(doc, data, false);
  if (isCollection(doc.contents)) doc.contents.flow = false;
  return doc.toString(TO_STRING);
}

export class HomeModel {
  constructor(text = '') {
    this.open(text);
  }

  // A new file: its text, with an empty history.
  open(text) {
    this._past = [];
    this._future = [];
    this._load(text);
  }

  _load(text) {
    this._text = text;
    this.doc = YAML.parseDocument(text);
    this.derived = deriveHome(this.doc);
  }

  get text() { return this._text; }
  get data() { return this.derived.data; }
  get home() { return this.derived.home; }
  get errors() { return this.derived.errors; }
  get canUndo() { return this._past.length > 0; }
  get canRedo() { return this._future.length > 0; }

  // A new version of the text (the text view's): one step in the history.
  setText(text) {
    if (text === this._text) return false;
    this._push();
    this._load(text);
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
    const text = this.doc.toString(TO_STRING);
    if (text === this._text) return false;
    this._push();
    this._load(text);
    return true;
  }

  // The value at `path` (plain), or undefined.
  get(path) {
    const node = this.doc.getIn(path, true);
    return YAML.isNode(node) ? node.toJSON() : node;
  }

  // Sets the value at `path`, creating the maps on the way; numbers and lists already there are changed in place.
  set(path, value) {
    return this.edit(doc => setIn(doc, path, value));
  }

  // Inserts `value` into the list at `path`, before `index` (at the end when it's left out); creates the list.
  insert(path, value, index) {
    return this.edit(doc => insertIn(doc, path, value, index));
  }

  // Several changes as one step: [{set: path, value}, {insert: path, value, index}, {remove: path}], in order.
  batch(ops) {
    return this.edit(doc => {
      for (const op of ops) {
        if (op.set) setIn(doc, op.set, op.value);
        else if (op.insert) insertIn(doc, op.insert, op.value, op.index);
        else if (op.remove && !doc.deleteIn(op.remove)) throw new Error(`Nothing at ${op.remove.join('.')}`);
      }
    });
  }

  // Removes the value at `path` (a key from its map, an item from its list).
  remove(path) {
    return this.edit(doc => {
      if (!doc.deleteIn(path)) throw new Error(`Nothing at ${path.join('.')}`);
    });
  }

  // Moves the item at `from` to `to` in the list (or map, keeping the keys) at `path`, with its comments.
  move(path, from, to) {
    return this.edit(doc => {
      const node = path.length ? doc.getIn(path, true) : doc.contents;
      if (!isCollection(node)) throw new Error(`${path.join('.')} isn't a list or a map`);
      const items = node.items;
      if (YAML.isMap(node)) [from, to] = [from, to].map(k => (typeof k === 'number' ? k : items.findIndex(p => String(p.key?.value ?? p.key) === k)));
      if (!(from >= 0 && from < items.length && to >= 0 && to < items.length)) throw new Error(`No item ${from} or ${to} in ${path.join('.')}`);
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
    return `${JSON.stringify(this.data, null, 1)}\n`;
  }
}
