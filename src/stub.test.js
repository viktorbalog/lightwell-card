import test from 'node:test';
import assert from 'node:assert/strict';
import {defineHome} from './home.js';
import {stubHome} from './stub.js';
import {editorUrls, scriptUrl} from './loader.js';

test('a new card\'s home works, with a light of the house when there is one', () => {
  assert.doesNotThrow(() => defineHome(stubHome()));
  const home = stubHome({'sensor.x': {}, 'light.kitchen': {}, 'light.bedroom': {}});
  defineHome(home);
  assert.deepEqual(home.lights[0].entities, ['light.bedroom']);
  assert.equal(home.markers[0].entity, 'light.bedroom');
});

test('the new card\'s window is a Build object: its gap found, its parts tagged', async () => {
  const {gapOf, partsOf} = await import('./editor/build.js');
  const home = stubHome();
  assert.deepEqual([gapOf(home, 'window_1').from, gapOf(home, 'window_1').to], [175, 375]);
  assert.equal(partsOf(home, 'room').length, 8);
  assert.equal(partsOf(home, 'lamp_1').length, 2);
});

test('the editor is looked for next to the card, then on jsDelivr for its version', () => {
  const chrome = 'Error\n    at http://ha.local:8123/hacsfiles/lightwell-card/lightwell-card.js?hacstag=123:12:34\n    at foo';
  const firefox = '@https://x.ui.nabu.casa/hacsfiles/lightwell-card/lightwell-card.js?hacstag=123:12:34\n';
  assert.equal(scriptUrl(chrome), 'http://ha.local:8123/hacsfiles/lightwell-card/lightwell-card.js?hacstag=123');
  assert.equal(scriptUrl(firefox), 'https://x.ui.nabu.casa/hacsfiles/lightwell-card/lightwell-card.js?hacstag=123');
  assert.equal(scriptUrl('no url'), undefined);
  assert.deepEqual(editorUrls('http://ha.local:8123/hacsfiles/lightwell-card/lightwell-card.js?hacstag=123', '0.3.0'), [
    'http://ha.local:8123/hacsfiles/lightwell-card/lightwell-card-editor.js?hacstag=123',
    'https://cdn.jsdelivr.net/gh/viktorbalog/lightwell-card@v0.3.0/dist/lightwell-card-editor.js']);
  assert.deepEqual(editorUrls(undefined, undefined), []);
});
