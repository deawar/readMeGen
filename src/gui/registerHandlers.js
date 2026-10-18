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

// The only origin our privileged channels accept invokes from — the app's own
// renderer window (served over the app:// scheme). Anything else is rejected.
const TRUSTED_PREFIX = 'app://local/'

/**
 * True only when an IPC event originates from our own app://local renderer.
 * Guards the privileged channels so a hypothetical injected/other frame can't
 * drive them.
 * @param {object} event - the ipcMain.handle event (or a test double)
 */
export function isTrustedSender (event) {
  const url = event?.senderFrame?.url
  return typeof url === 'string' && url.startsWith(TRUSTED_PREFIX)
}

/**
 * Register one ipcMain.handle per channel, forwarding (deps, payload) to
 * the matching handler function — but only for invokes from the trusted
 * app://local frame.
 *
 * @param {object} ipcMain  - Electron ipcMain (or a test double)
 * @param {object} handlers - Module object with the handler functions
 * @param {object} deps     - Real (or fake) dependency bag
 */
export function registerHandlers (ipcMain, handlers, deps) {
  for (const [channel, fnName] of CHANNEL_MAP) {
    ipcMain.handle(channel, (event, payload) => {
      if (!isTrustedSender(event)) {
        throw new Error('ipc: rejected invoke from untrusted sender on ' + channel)
      }
      return handlers[fnName](deps, payload)
    })
  }
}

export { CHANNEL_MAP }
