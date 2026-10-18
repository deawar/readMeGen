/**
 * renderer.js — block-editor UI for ReadMeGen GUI.
 * ESM module; runs in the Electron renderer (browser context).
 * No Node APIs, no require. All IPC via window.api.
 */

import {
  moveBlock,
  insertBlock,
  deleteBlock,
  updateBlockBody
} from './documentStore.js'

// ── Module state ──────────────────────────────────────────────────────────────

let currentDoc = null
let blockIdCounter = 0

// Track which block (by id) is currently in edit mode
let editingId = null

// For drag-reorder
let dragSourceId = null

// ── DOM refs ──────────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas')
const previewPane = document.getElementById('preview-pane')
const markdownPane = document.getElementById('markdown-pane')
const markdownPre = document.getElementById('markdown-pre')
const statusEl = document.getElementById('status')
const dropHint = document.getElementById('drop-hint')
const tabEdit = document.getElementById('tab-edit')
const tabPreview = document.getElementById('tab-preview')
const tabMarkdown = document.getElementById('tab-markdown')
const btnNew = document.getElementById('btn-new')
const btnOpen = document.getElementById('btn-open')
const btnSave = document.getElementById('btn-save')
const btnAuthor = document.getElementById('btn-author')
const licenseSelect = document.getElementById('license-select')

// ── Status helper ─────────────────────────────────────────────────────────────

/**
 * Write a message to the status bar.
 * @param {string} msg
 * @param {''|'ok'|'error'} kind
 */
function setStatus (msg, kind) {
  statusEl.textContent = msg
  statusEl.className = kind || ''
}

// ── Unique block id ───────────────────────────────────────────────────────────

function nextBlockId () {
  blockIdCounter += 1
  return 'block-' + blockIdCounter
}

// ── Debounce ──────────────────────────────────────────────────────────────────

function debounce (fn, ms) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), ms)
  }
}

// ── Header form ───────────────────────────────────────────────────────────────

/**
 * Build a structured .header-form element for the header block.
 * @param {object} block
 * @returns {HTMLElement}
 */
function buildHeaderForm (block) {
  // Try to parse existing field values from body
  const fields = { projectTitle: '', tagline: '', logoPath: '', docsUrl: '', demoUrl: '', projectUrl: '' }
  try {
    const m = {
      projectTitle: /<h3 align="center">([^<]*)<\/h3>/.exec(block.body),
      tagline: /<p align="center">\n[ \t]+([^\n<][^\n]*)/.exec(block.body),
      logoPath: /<img src="([^"]*)" alt="Logo"/.exec(block.body),
      docsUrl: /<a href="([^"]*)"><strong>Explore the docs/.exec(block.body),
      demoUrl: /<a href="([^"]*)">View Demo/.exec(block.body),
      projectUrl: /<div align="center">\s*<a href="([^"]*)"/.exec(block.body)
    }
    if (m.projectTitle) fields.projectTitle = m.projectTitle[1]
    if (m.tagline) fields.tagline = m.tagline[1].trim()
    if (m.logoPath) fields.logoPath = m.logoPath[1]
    if (m.docsUrl) fields.docsUrl = m.docsUrl[1]
    if (m.demoUrl) fields.demoUrl = m.demoUrl[1]
    if (m.projectUrl) fields.projectUrl = m.projectUrl[1]
  } catch (_) {}

  const form = document.createElement('div')
  form.className = 'header-form'

  const fieldDefs = [
    { key: 'projectTitle', label: 'Project Title', fullWidth: true },
    { key: 'tagline', label: 'Tagline', fullWidth: true },
    { key: 'projectUrl', label: 'Project URL' },
    { key: 'logoPath', label: 'Logo Path / URL' },
    { key: 'docsUrl', label: 'Docs URL' },
    { key: 'demoUrl', label: 'Demo URL' }
  ]

  const inputs = {}
  for (const def of fieldDefs) {
    const lbl = document.createElement('label')
    if (def.fullWidth) lbl.className = 'full-width'
    lbl.textContent = def.label
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.value = fields[def.key] || ''
    inp.dataset.field = def.key
    lbl.appendChild(inp)
    form.appendChild(lbl)
    inputs[def.key] = inp
  }

  const saveBtn = document.createElement('button')
  saveBtn.className = 'btn-save-header'
  saveBtn.textContent = 'Save Header'
  form.appendChild(saveBtn)

  saveBtn.addEventListener('click', async () => {
    const collected = {}
    for (const [k, inp] of Object.entries(inputs)) {
      collected[k] = inp.value
    }
    try {
      const result = await window.api.setHeader({ document: currentDoc, fields: collected })
      currentDoc = result.document
      renderCanvas()
      setStatus('Header saved.', 'ok')
    } catch (err) {
      setStatus('Header save failed: ' + err.message, 'error')
    }
  })

  return form
}

// ── renderBlockBody — swap rendered/editor views ──────────────────────────────

/**
 * Populate the .block-body element for a block.
 * For the header block: inject a .header-form.
 * For other blocks: inject a .block-rendered div (async markdown render).
 * @param {HTMLElement} bodyEl - the .block-body container
 * @param {object} block
 */
async function populateBlockBody (bodyEl, block) {
  bodyEl.innerHTML = ''

  if (block.type === 'header') {
    bodyEl.appendChild(buildHeaderForm(block))
    return
  }

  if (editingId === block.id) {
    // Show textarea editor
    const editorWrap = document.createElement('div')
    editorWrap.className = 'block-editor'

    const ta = document.createElement('textarea')
    ta.value = block.body || ''
    editorWrap.appendChild(ta)

    const hint = document.createElement('div')
    hint.className = 'edit-hint'
    hint.textContent = 'Press Escape or click outside to close editor'
    editorWrap.appendChild(hint)

    bodyEl.appendChild(editorWrap)

    // Focus the textarea
    requestAnimationFrame(() => ta.focus())

    // Debounced update — updates body and re-renders preview portion
    const onInput = debounce((id, value) => {
      currentDoc = updateBlockBody(currentDoc, id, value)
      // Re-render only the rendered view of this block (if it exists)
      // Since we're in edit mode, there's no rendered view, so just keep doc in sync
    }, 150)

    ta.addEventListener('input', () => {
      onInput(block.id, ta.value)
    })

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Commit final value, then leave edit mode
        currentDoc = updateBlockBody(currentDoc, block.id, ta.value)
        editingId = null
        renderCanvas()
      }
    })

    ta.addEventListener('blur', () => {
      // Commit final value, leave edit mode
      currentDoc = updateBlockBody(currentDoc, block.id, ta.value)
      editingId = null
      renderCanvas()
    })

    return
  }

  // Rendered view
  const rendered = document.createElement('div')
  rendered.className = 'block-rendered'

  try {
    const result = await window.api.renderMarkdown({ markdown: block.body || '' })
    rendered.innerHTML = result.html
  } catch (_) {
    rendered.textContent = block.body || ''
  }

  rendered.addEventListener('click', () => {
    editingId = block.id
    renderCanvas()
  })

  bodyEl.appendChild(rendered)
}

// ── buildBlockCard ─────────────────────────────────────────────────────────────

/**
 * Create the DOM card element for a block (without the body content).
 * @param {object} block
 * @param {number} index - position in blocks array
 * @returns {HTMLElement}
 */
function buildBlockCard (block, index) {
  const card = document.createElement('div')
  card.className = 'block-card'
  card.dataset.id = block.id
  card.dataset.index = String(index)

  // ── Block header ─────────────────────────────────────────────────────────────
  const header = document.createElement('div')
  header.className = 'block-header'

  const handle = document.createElement('span')
  handle.className = 'drag-handle'
  handle.textContent = '⠿'
  handle.setAttribute('draggable', 'true')
  handle.title = 'Drag to reorder'

  const badge = document.createElement('span')
  badge.className = 'block-type-badge'
  badge.textContent = block.type || 'custom'

  const heading = document.createElement('span')
  heading.className = 'block-heading'
  heading.textContent = block.heading || ''

  const delBtn = document.createElement('button')
  delBtn.className = 'btn-delete'
  delBtn.textContent = '×'
  delBtn.title = 'Delete block'

  header.appendChild(handle)
  header.appendChild(badge)
  header.appendChild(heading)
  header.appendChild(delBtn)

  // ── Block body ────────────────────────────────────────────────────────────────
  const body = document.createElement('div')
  body.className = 'block-body'

  card.appendChild(header)
  card.appendChild(body)

  // ── Delete handler ────────────────────────────────────────────────────────────
  delBtn.addEventListener('click', () => {
    if (editingId === block.id) editingId = null
    currentDoc = deleteBlock(currentDoc, block.id)
    renderCanvas()
  })

  // ── Drag-reorder on handle ────────────────────────────────────────────────────
  handle.addEventListener('dragstart', (e) => {
    dragSourceId = block.id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', block.id)
    card.style.opacity = '0.5'
  })

  handle.addEventListener('dragend', () => {
    card.style.opacity = ''
  })

  card.addEventListener('dragover', (e) => {
    // Only respond to block reorder drags (not file drops)
    if (dragSourceId !== null) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      card.classList.add('drag-over')
    }
  })

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over')
  })

  card.addEventListener('drop', (e) => {
    card.classList.remove('drag-over')
    if (dragSourceId === null) return
    if (dragSourceId === block.id) {
      dragSourceId = null
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const toIndex = Number(card.dataset.index)
    currentDoc = moveBlock(currentDoc, dragSourceId, toIndex)
    dragSourceId = null
    renderCanvas()
  })

  return { card, bodyEl: body }
}

// ── renderCanvas ──────────────────────────────────────────────────────────────

/**
 * Re-render the entire edit canvas from currentDoc.
 */
function renderCanvas () {
  // Remove everything except the add-section button (we re-add it)
  canvas.innerHTML = ''

  if (!currentDoc || !currentDoc.blocks) {
    appendAddSection()
    return
  }

  const promises = []
  currentDoc.blocks.forEach((block, index) => {
    const { card, bodyEl } = buildBlockCard(block, index)
    canvas.appendChild(card)
    promises.push(populateBlockBody(bodyEl, block))
  })

  appendAddSection()

  // Wait for all async renders (non-blocking — canvas already in DOM)
  Promise.all(promises).catch((err) => setStatus('Render error: ' + err.message, 'error'))
}

// ── Add-section button ────────────────────────────────────────────────────────

function appendAddSection () {
  const btn = document.createElement('button')
  btn.id = 'add-section'
  btn.textContent = '+ Add Section'
  btn.addEventListener('click', () => {
    const id = nextBlockId()
    const block = { id, type: 'custom', heading: 'New Section', level: 2, body: '' }
    const atIndex = currentDoc ? currentDoc.blocks.length : 0
    currentDoc = insertBlock(currentDoc || { meta: {}, blocks: [] }, block, atIndex)
    editingId = id
    renderCanvas()
  })
  canvas.appendChild(btn)
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function showPane (which) {
  // which: 'edit' | 'preview' | 'markdown'
  canvas.style.display = which === 'edit' ? '' : 'none'
  previewPane.style.display = which === 'preview' ? '' : 'none'
  markdownPane.style.display = which === 'markdown' ? '' : 'none'

  tabEdit.classList.toggle('active', which === 'edit')
  tabPreview.classList.toggle('active', which === 'preview')
  tabMarkdown.classList.toggle('active', which === 'markdown')
}

tabEdit.addEventListener('click', () => {
  showPane('edit')
})

tabPreview.addEventListener('click', async () => {
  showPane('preview')
  if (!currentDoc) return
  try {
    const { text } = await window.api.serializeDoc({ document: currentDoc })
    const { html } = await window.api.renderMarkdown({ markdown: text })
    previewPane.innerHTML = html
  } catch (err) {
    setStatus('Preview error: ' + err.message, 'error')
  }
})

tabMarkdown.addEventListener('click', async () => {
  showPane('markdown')
  if (!currentDoc) return
  try {
    const { text } = await window.api.serializeDoc({ document: currentDoc })
    markdownPre.textContent = text
  } catch (err) {
    setStatus('Markdown error: ' + err.message, 'error')
  }
})

// ── Toolbar actions ───────────────────────────────────────────────────────────

btnNew.addEventListener('click', async () => {
  try {
    const result = await window.api.newReadme()
    currentDoc = result.document
    editingId = null
    showPane('edit')
    renderCanvas()
    setStatus('New document created.', 'ok')
  } catch (err) {
    setStatus('New failed: ' + err.message, 'error')
  }
})

btnOpen.addEventListener('click', async () => {
  try {
    const result = await window.api.openReadme()
    if (result.canceled) return
    currentDoc = result.document
    editingId = null
    showPane('edit')
    renderCanvas()
    setStatus('Opened: ' + result.path, 'ok')
  } catch (err) {
    setStatus('Open failed: ' + err.message, 'error')
  }
})

btnSave.addEventListener('click', async () => {
  if (!currentDoc) {
    setStatus('Nothing to save.', 'error')
    return
  }
  try {
    const result = await window.api.saveReadme({ document: currentDoc })
    if (result.canceled) return
    setStatus('Saved: ' + result.path, 'ok')
  } catch (err) {
    setStatus('Save failed: ' + err.message, 'error')
  }
})

btnAuthor.addEventListener('click', async () => {
  if (!currentDoc) return
  try {
    const result = await window.api.applyAuthor({ document: currentDoc })
    currentDoc = result.document
    renderCanvas()
    const name = result.user ? result.user.name || result.user.login : '(unknown)'
    setStatus('Author applied: ' + name, 'ok')
  } catch (err) {
    setStatus('Author fill failed: ' + err.message, 'error')
  }
})

licenseSelect.addEventListener('change', async () => {
  const key = licenseSelect.value
  if (!key || !currentDoc) return
  try {
    const result = await window.api.applyLicense({ document: currentDoc, key })
    currentDoc = result.document
    renderCanvas()
    setStatus('License set: ' + key, 'ok')
  } catch (err) {
    setStatus('License failed: ' + err.message, 'error')
  }
})

// ── Manifest drop on canvas ───────────────────────────────────────────────────

let dragLeaveTimer = null

canvas.addEventListener('dragover', (e) => {
  // File drag (not a block reorder)
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    clearTimeout(dragLeaveTimer)
    dropHint.classList.add('visible')
    canvas.classList.add('dragover')
  }
})

canvas.addEventListener('dragleave', () => {
  dragLeaveTimer = setTimeout(() => {
    dropHint.classList.remove('visible')
    canvas.classList.remove('dragover')
  }, 80)
})

canvas.addEventListener('drop', (e) => {
  dropHint.classList.remove('visible')
  canvas.classList.remove('dragover')

  // If this was a block reorder, let the card handler take it
  if (dragSourceId !== null) return

  const files = e.dataTransfer.files
  if (!files || files.length === 0) return
  e.preventDefault()

  const file = files[0]
  const reader = new FileReader()
  reader.addEventListener('load', async (evt) => {
    const contents = evt.target.result
    try {
      const result = await window.api.applyManifest({
        document: currentDoc,
        filename: file.name,
        contents
      })
      if (result.error) {
        setStatus('Manifest error: ' + result.error, 'error')
      } else {
        currentDoc = result.document
        renderCanvas()
        setStatus('Manifest applied: ' + file.name, 'ok')
      }
    } catch (err) {
      setStatus('Manifest drop failed: ' + err.message, 'error')
    }
  })
  reader.readAsText(file)
})

// ── Initialisation ────────────────────────────────────────────────────────────

async function init () {
  try {
    const result = await window.api.newReadme()
    currentDoc = result.document
    showPane('edit')
    renderCanvas()
  } catch (err) {
    setStatus('Init failed: ' + err.message, 'error')
  }
}

init()
