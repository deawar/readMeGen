// src/gui/registerHandlers.js
// Pure wiring helper: registers one ipcMain.handle per channel.
// Kept data-driven so it is easy to test without launching Electron.

/** @type {Array<[string, string]>} [channel, handlerFnName] */
const CHANNEL_MAP = [
  ['open-readme', 'openReadme'],
  ['save-readme', 'saveReadme'],
  ['new-readme', 'newReadme'],
  ['apply-manifest', 'applyManifest'],
  ['apply-author', 'applyAuthor'],
  ['apply-license', 'applyLicense'],
  ['set-header', 'setHeader'],
  ['serialize-doc', 'serializeDoc'],
  ['lookup-user', 'lookupUser'],
  ['render-markdown', 'renderMarkdown']
]

/**
 * Register one ipcMain.handle per channel, forwarding (deps, payload) to
 * the matching handler function.
 *
 * @param {object} ipcMain  - Electron ipcMain (or a test double)
 * @param {object} handlers - Module object with the handler functions
 * @param {object} deps     - Real (or fake) dependency bag
 */
export function registerHandlers (ipcMain, handlers, deps) {
  for (const [channel, fnName] of CHANNEL_MAP) {
    ipcMain.handle(channel, (_event, payload) => handlers[fnName](deps, payload))
  }
}

export { CHANNEL_MAP }
