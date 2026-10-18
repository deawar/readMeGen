// main.cjs
'use strict'

require('dotenv').config()

const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { readFile, writeFile } = require('node:fs/promises')
const { execFileSync } = require('node:child_process')

// Must be called before app is ready — registers the scheme as privileged so
// ES modules load over app:// without CORS/CSP issues that block file://.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

// Set in onReady (dynamic import of the ESM helper). Guards which off-origin
// URLs may be handed to the OS: http/https only. Defaults to deny until loaded.
let safeExternalUrl = (_url) => null

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Lock navigation to our own app://local origin. A link in an untrusted
  // README must never navigate the window to a remote page (where rendered
  // HTML would run outside our CSP/origin); open such links externally instead.
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://local/')) return
    e.preventDefault()
    const href = safeExternalUrl(url)
    if (href) shell.openExternal(href).catch(() => {})
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  win.loadURL('app://local/index.html').catch((err) => {
    console.error('loadURL failed:', err)
  })
  return win
}

async function onReady () {
  // Register the app:// protocol handler before creating the window so the
  // first loadURL call resolves correctly.
  const { resolveAppPath } = await import('./src/gui/appProtocol.js')
  safeExternalUrl = (await import('./src/gui/navigation.js')).safeExternalUrl
  const { createSanitize } = await import('./src/gui/sanitize.js')
  protocol.handle('app', (request) => {
    const filePath = resolveAppPath(__dirname, request.url)
    if (!filePath) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(filePath).toString())
  })

  createWindow()

  // Dynamic import of ESM modules from CJS
  const handlers = await import('./src/gui/handlers.js')
  const { registerHandlers } = await import('./src/gui/registerHandlers.js')

  // Main-held mutable path state — the renderer must NOT control the write path.
  const pathState = { current: null }

  // Real dependency bag
  const deps = {
    dialog: {
      showOpen () {
        return dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        })
      },
      showSave () {
        return dialog.showSaveDialog({ defaultPath: 'README.md' })
      }
    },
    readFile: (filePath) => readFile(filePath, 'utf8'),
    writeFile: (filePath, text) => writeFile(filePath, text, 'utf8'),
    exec (key) {
      return execFileSync('git', ['config', key], { encoding: 'utf8', shell: false }).trim()
    },
    md: new (require('markdown-it'))({ html: true, linkify: true }),
    sanitize: createSanitize(new (require('jsdom').JSDOM)('').window),
    token: process.env.TOKEN,
    pathState
  }

  registerHandlers(ipcMain, handlers, deps)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

app.whenReady().then(onReady).catch((err) => {
  console.error('Failed to initialise app:', err)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
