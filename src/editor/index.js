// The editor's bundle (dist/lightwell-editor.js): registers <lightwell-editor>, with the card it shows (unless the
// page already has it) and, outside Home Assistant, stand-ins for HA's ha-card and ha-icon (icons from the Material
// Design Icons CDN). New homes start from the example home.
import {defineFloorplanCard} from '../card.js';
import {LightwellEditor} from './editor.js';
import EXAMPLE from '../../example/home.yaml';

if (!customElements.get('ha-card')) customElements.define('ha-card', class extends HTMLElement {});
if (!customElements.get('ha-icon')) {
  customElements.define('ha-icon', class extends HTMLElement {
    connectedCallback() {
      const name = this.getAttribute('icon').replace('mdi:', '');
      this.style.display = 'inline-block';
      const d = document.createElement('div');
      d.style.cssText = `width: var(--mdc-icon-size); height: var(--mdc-icon-size); background: currentColor;
        -webkit-mask: url(https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${name}.svg) center/contain no-repeat`;
      this.appendChild(d);
    }
  });
}
if (!customElements.get('lightwell-card')) defineFloorplanCard('lightwell-card', undefined, {name: 'Lightwell'});

class Editor extends LightwellEditor {
  constructor() {
    super();
    this.example = EXAMPLE;
  }
}
if (!customElements.get('lightwell-editor')) customElements.define('lightwell-editor', Editor);
