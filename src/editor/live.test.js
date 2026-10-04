import test from 'node:test';
import assert from 'node:assert/strict';
import {applyEvent, authorizeUrl, cannotReach, clientOf, haUrl, tokensOf, wsUrl} from './live.js';

test("HA's address as typed", () => {
  assert.equal(haUrl('homeassistant.local:8123'), 'http://homeassistant.local:8123');
  assert.equal(haUrl(' https://abc.ui.nabu.casa/ '), 'https://abc.ui.nabu.casa');
  assert.equal(haUrl('http://192.168.0.69:8123/lovelace/0'), 'http://192.168.0.69:8123/lovelace/0');
  assert.equal(haUrl('ftp://x'), null);
  assert.equal(haUrl(''), null);
  assert.equal(wsUrl('https://abc.ui.nabu.casa'), 'wss://abc.ui.nabu.casa/api/websocket');
  assert.equal(wsUrl('http://homeassistant.local:8123'), 'ws://homeassistant.local:8123/api/websocket');
});

test('where the page can reach HA from', () => {
  const pages = new URL('https://viktorbalog.github.io/lightwell-card/tools/editor/?states=x.js#y');
  assert.match(cannotReach('http://homeassistant.local:8123', pages), /https/);
  assert.equal(cannotReach('https://abc.ui.nabu.casa', pages), '');
  assert.equal(cannotReach('http://homeassistant.local:8123', new URL('http://localhost:8000/tools/editor/')), '');
  assert.match(cannotReach('http://homeassistant.local:8123', new URL('file:///Users/me/lightwell-card/tools/editor/index.html')), /web address/);
});

test('the sign-in: the page signs itself in and comes back to itself', () => {
  const client = clientOf(new URL('https://viktorbalog.github.io/lightwell-card/tools/editor/?states=x.js#y'));
  assert.deepEqual(client, {clientId: 'https://viktorbalog.github.io/lightwell-card/tools/editor/', redirectUri: 'https://viktorbalog.github.io/lightwell-card/tools/editor/'});
  const u = new URL(authorizeUrl('https://abc.ui.nabu.casa', client, 's1'));
  assert.equal(u.origin + u.pathname, 'https://abc.ui.nabu.casa/auth/authorize');
  assert.deepEqual(Object.fromEntries(u.searchParams), {response_type: 'code', client_id: client.clientId, redirect_uri: client.redirectUri, state: 's1'});
  assert.deepEqual(tokensOf({access_token: 'a', refresh_token: 'r', expires_in: 1800}, 'b', 'c', 1000), {base: 'b', clientId: 'c', access_token: 'a', refresh_token: 'r', expires: 1801000});
});

test('state changes', () => {
  const states = {'light.a': {state: 'off'}};
  assert.deepEqual(applyEvent(states, {data: {entity_id: 'light.a', new_state: {state: 'on'}}}), {'light.a': {state: 'on'}});
  assert.deepEqual(applyEvent(states, {data: {entity_id: 'light.a', new_state: null}}), {});
  assert.equal(applyEvent(states, {}), states);
});
