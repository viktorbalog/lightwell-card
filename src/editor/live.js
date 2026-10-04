// A live connection to Home Assistant, for the editor's pickers and preview: the states of every entity, kept up to
// date, and HA's location. It signs in through HA's own login page (its OAuth2 flow, as HA's frontend and the
// companion apps do): the page goes to HA's /auth/authorize, the user logs in there, and HA sends them back with a
// code the page swaps for tokens. Nothing is typed or pasted into the page but HA's address. The connection only
// reads: it never calls a service, so taps on the preview still act in the editor alone.
//
// The tokens are kept in the browser's storage (STORE) until the user disconnects, which also revokes them in HA.
// The pure helpers come first (tested); `signIn`, `finishSignIn`, `HaConnection` use the browser.

const STORE = 'lightwell-editor:ha';
const PENDING = 'lightwell-editor:ha-pending';

// HA's address as typed ("homeassistant.local:8123", "https://x.ui.nabu.casa/") as a base URL without the slash, or
// null when it isn't one.
export function haUrl(input) {
  let v = String(input || '').trim();
  if (!v) return null;
  if (/^[a-z][\w+.-]*:\/\//i.test(v) && !/^https?:\/\//i.test(v)) return null;
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

// The websocket API's address for HA at `base`.
export const wsUrl = base => `${base.replace(/^http/, 'ws')}/api/websocket`;

// Why the page can't reach HA at `base` from `page` (its location), or ''. A page served over https can't reach HA
// over plain http (the browser blocks mixed content); a page opened from the files can't be signed in to (HA sends
// the user back to a web address).
export function cannotReach(base, page) {
  if (!/^https?:$/.test(page.protocol)) return 'The live connection needs the editor served from a web address: the hosted editor, or a local server (npx serve, python3 -m http.server) for an HA on your network.';
  if (page.protocol === 'https:' && base.startsWith('http:') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(base)) {
    return 'This page is served over https, and the browser won\'t let it reach an HA on plain http. Use HA\'s https address (Nabu Casa, or your own certificate), or open the editor from a local server.';
  }
  return '';
}

// The address HA's login sends the user back to, and the app it signs in (HA's client_id: the page's own address,
// whose host the return address must share).
export function clientOf(page) {
  const here = `${page.origin}${page.pathname}`;
  return {clientId: here, redirectUri: here};
}

// HA's login page for the sign-in.
export function authorizeUrl(base, {clientId, redirectUri}, state) {
  const q = new URLSearchParams({response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state});
  return `${base}/auth/authorize?${q}`;
}

// The states after a state_changed event: the entity's new state, or none when it was removed.
export function applyEvent(states, event) {
  const {entity_id: id, new_state: s} = event?.data || {};
  if (!id) return states;
  const next = {...states};
  if (s) next[id] = s;
  else delete next[id];
  return next;
}

// Tokens as kept: HA's answer to /auth/token, with when the access token runs out (ms) and where they're from.
export const tokensOf = (answer, base, clientId, now = Date.now()) => ({base, clientId, access_token: answer.access_token,
  refresh_token: answer.refresh_token, expires: now + (answer.expires_in || 1800) * 1000});

// --- In the browser ---

const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, v) { try { v === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(v)); } catch { /* blocked */ } },
};
export const savedTokens = () => storage.get(STORE);

// Goes to HA's login for `base`, remembering what to check when the user comes back.
export function signIn(base, page = location) {
  const client = clientOf(page), state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  storage.set(PENDING, {base, state, ...client});
  page.assign(authorizeUrl(base, client, state));
}

// After HA's login sent the user back (?code=…&state=…): swaps the code for tokens, keeps them, and takes the code
// out of the address. Null when the page wasn't opened that way.
export async function finishSignIn(page = location) {
  const q = new URLSearchParams(page.search), code = q.get('code'), state = q.get('state');
  if (!code) return null;
  const pending = storage.get(PENDING);
  storage.set(PENDING, null);
  q.delete('code');
  q.delete('state');
  history.replaceState(null, '', `${page.pathname}${q.size ? `?${q}` : ''}${page.hash}`);
  if (!pending || pending.state !== state) throw new Error("That sign-in to Home Assistant didn't come from this page: connect again.");
  const tokens = tokensOf(await tokenRequest(pending.base, {grant_type: 'authorization_code', code, client_id: pending.clientId}), pending.base, pending.clientId);
  storage.set(STORE, tokens);
  return tokens;
}

async function tokenRequest(base, form) {
  const r = await fetch(`${base}/auth/token`, {method: 'POST', body: new URLSearchParams(form)});
  if (!r.ok) throw new Error(`Home Assistant refused the sign-in (${r.status}): connect again.`);
  return r.json();
}

// Fresh tokens when the access token is about to run out (and kept).
export async function freshTokens(tokens) {
  if (tokens.expires - Date.now() > 60_000) return tokens;
  const answer = await tokenRequest(tokens.base, {grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: tokens.clientId});
  const next = tokensOf({...answer, refresh_token: tokens.refresh_token}, tokens.base, tokens.clientId);
  storage.set(STORE, next);
  return next;
}

// Disconnects for good: revokes the tokens in HA (as far as it can) and forgets them.
export async function signOut(tokens = savedTokens()) {
  storage.set(STORE, null);
  if (tokens?.refresh_token) await fetch(`${tokens.base}/auth/revoke`, {method: 'POST', body: new URLSearchParams({token: tokens.refresh_token})}).catch(() => {});
}

// A connection to HA's websocket API: the states (onStates(states), at most a few times a second while things
// change), HA's location (onConfig({latitude, longitude, name})), and onStatus(text, ok) as it connects, drops and
// comes back. close() ends it.
export class HaConnection {
  constructor(tokens, {onStates, onConfig, onStatus, WebSocketImpl = globalThis.WebSocket}) {
    Object.assign(this, {tokens, onStates, onConfig, onStatus, WebSocketImpl, states: {}, closed: false, retry: 1000});
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
    const send = msg => { ws.send(JSON.stringify({id: ++id, ...msg})); return id; };
    const asked = {};
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'auth_required') ws.send(JSON.stringify({type: 'auth', access_token: this.tokens.access_token}));
      else if (msg.type === 'auth_invalid') {
        this.onStatus?.(`Home Assistant refused the connection: ${msg.message}. Connect again.`, false);
        this.close();
      } else if (msg.type === 'auth_ok') {
        this.retry = 1000;
        asked.states = send({type: 'get_states'});
        asked.config = send({type: 'get_config'});
        send({type: 'subscribe_events', event_type: 'state_changed'});
        this.onStatus?.(`Connected to Home Assistant ${msg.ha_version}`, true);
      } else if (msg.type === 'result' && msg.id === asked.states && msg.success) {
        this.states = Object.fromEntries(msg.result.map(s => [s.entity_id, s]));
        this._tell();
      } else if (msg.type === 'result' && msg.id === asked.config && msg.success) {
        const {latitude, longitude, location_name: name} = msg.result;
        this.onConfig?.({latitude, longitude, name});
      } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
        this.states = applyEvent(this.states, msg.event);
        this._tell();
      }
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.onStatus?.('The connection to Home Assistant dropped: trying again…', false);
      setTimeout(() => this._open(), this.retry);
      this.retry = Math.min(this.retry * 2, 30_000);
    };
  }

  // The states, at most every 250 ms.
  _tell() {
    this._timer ||= setTimeout(() => { this._timer = 0; this.onStates?.(this.states); }, 250);
  }

  close() {
    this.closed = true;
    clearTimeout(this._timer);
    this.ws?.close();
  }
}
