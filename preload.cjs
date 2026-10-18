// preload.cjs
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openReadme: () => ipcRenderer.invoke('open-readme'),
  saveReadme: (payload) => ipcRenderer.invoke('save-readme', payload),
  newReadme: () => ipcRenderer.invoke('new-readme'),
  applyManifest: (payload) => ipcRenderer.invoke('apply-manifest', payload),
  applyAuthor: (payload) => ipcRenderer.invoke('apply-author', payload),
  applyLicense: (payload) => ipcRenderer.invoke('apply-license', payload),
  setHeader: (payload) => ipcRenderer.invoke('set-header', payload),
  serializeDoc: (payload) => ipcRenderer.invoke('serialize-doc', payload),
  lookupUser: (payload) => ipcRenderer.invoke('lookup-user', payload),
  renderMarkdown: (payload) => ipcRenderer.invoke('render-markdown', payload)
})
