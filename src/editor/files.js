// Opening and saving home files in the browser. Where there's the File System Access API (Chrome, Edge) a file is
// opened with a handle and saved back to the same file; elsewhere (Firefox, Safari) it's opened from a file input
// and saved as a download.

const TYPES = {
  yaml: {description: 'Home (YAML)', accept: {'text/yaml': ['.yaml', '.yml']}, mime: 'text/yaml'},
  json: {description: 'Home (JSON, for home_url)', accept: {'application/json': ['.json']}, mime: 'application/json'},
};
export const hasFileAccess = () => typeof window.showOpenFilePicker === 'function';

// The format of a file, from its name: 'json' or 'yaml'.
export const formatOf = name => (/\.json$/i.test(name || '') ? 'json' : 'yaml');
// The file's name with the other format's extension.
export const renamed = (name, format) => `${(name || 'home').replace(/\.(ya?ml|json)$/i, '')}.${format === 'json' ? 'json' : 'yaml'}`;

// Asks for a home file: {name, text, handle} (handle null without the API), or null when cancelled.
export async function pickFile() {
  if (hasFileAccess()) {
    try {
      const [handle] = await window.showOpenFilePicker({types: [{description: 'Home (YAML or JSON)',
        accept: {'text/yaml': ['.yaml', '.yml'], 'application/json': ['.json']}}]});
      const file = await handle.getFile();
      return {name: file.name, text: await file.text(), handle};
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  }
  return new Promise(resolve => {
    const input = Object.assign(document.createElement('input'), {type: 'file', accept: '.yaml,.yml,.json'});
    input.onchange = async () => {
      const file = input.files[0];
      resolve(file ? {name: file.name, text: await file.text(), handle: null} : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// A file dropped on the page: {name, text, handle} (with a handle where the browser gives one), or null.
export async function droppedFile(dataTransfer) {
  const item = [...dataTransfer.items].find(i => i.kind === 'file');
  if (!item) return null;
  const handle = await item.getAsFileSystemHandle?.().catch(() => null);
  const file = handle?.kind === 'file' ? await handle.getFile() : item.getAsFile();
  return file && {name: file.name, text: await file.text(), handle: handle?.kind === 'file' ? handle : null};
}

// Writes `text` to the file `handle`; asks for permission first if the browser needs it.
export async function writeFile(handle, text) {
  if ((await handle.queryPermission?.({mode: 'readwrite'})) === 'prompt') await handle.requestPermission({mode: 'readwrite'});
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

// Asks where to save `text` as `format` ('yaml' or 'json'), suggesting `name`, and saves it there: {name, handle},
// or null when cancelled. Without the API it downloads the file ({name, handle: null}).
export async function saveFileAs(text, format, name) {
  const type = TYPES[format];
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({suggestedName: name, types: [{description: type.description, accept: type.accept}]});
      await writeFile(handle, text);
      return {name: handle.name, handle};
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  }
  const a = Object.assign(document.createElement('a'), {download: name,
    href: URL.createObjectURL(new Blob([text], {type: type.mime}))});
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return {name, handle: null};
}
