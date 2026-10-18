// main.cjs
'use strict'

require('dotenv').config()

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { readFile, writeFile } = require('node:fs/promises')
const { execFileSync } = require('node:child_process')

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

  win.loadFile('index.html')
  return win
}

async function onReady () {
  createWindow()

  // Dynamic import of ESM modules from CJS
  const handlers = await import('./src/gui/handlers.js')
  const { registerHandlers } = await import('./src/gui/registerHandlers.js')

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
      return execFileSync('git', ['config', key], { encoding: 'utf8' }).trim()
    },
    md: new (require('markdown-it'))({ html: true, linkify: true }),
    token: process.env.TOKEN
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
