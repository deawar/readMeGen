import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createSanitize } from '../src/gui/sanitize.js'

// A sanitizer built on the real DOMPurify, exercised against the exact threats
// the strict CSP is meant to backstop: injected <script>, inline event
// handlers, and HTML sinks that could rewrite the page (meta/form/base/link).

test('createSanitize strips script tags', () => {
  const sanitize = createSanitize(new JSDOM('').window)
  const clean = sanitize('<p>hi</p><script>alert(1)</script>')
  assert.ok(!clean.includes('<script'), 'script tag removed')
  assert.ok(clean.includes('hi'), 'legitimate text preserved')
})

test('createSanitize strips inline on* event handlers', () => {
  const sanitize = createSanitize(new JSDOM('').window)
  const clean = sanitize('<p onclick="evil()">click</p>')
  assert.ok(!/onclick/i.test(clean), 'onclick attribute removed')
  assert.ok(clean.includes('click'), 'element text preserved')
})

test('createSanitize strips page-rewriting sinks (meta/form/base/link)', () => {
  const sanitize = createSanitize(new JSDOM('').window)
  const clean = sanitize(
    '<base href="http://evil/"><meta http-equiv="refresh" content="0;url=http://evil/">' +
    '<form action="http://evil/"></form><link rel="stylesheet" href="http://evil/">'
  )
  assert.ok(!/<base/i.test(clean), 'base removed')
  assert.ok(!/<meta/i.test(clean), 'meta removed')
  assert.ok(!/<form/i.test(clean), 'form removed')
  assert.ok(!/<link/i.test(clean), 'link removed')
})

test('createSanitize preserves legitimate README HTML (a/img/details/headings)', () => {
  const sanitize = createSanitize(new JSDOM('').window)
  const dirty =
    '<h1>Title</h1><a href="https://github.com/deawar">repo</a>' +
    '<img src="logo.png" alt="logo"><details><summary>More</summary><p>body</p></details>'
  const clean = sanitize(dirty)
  assert.ok(clean.includes('<h1>'), 'heading kept')
  assert.ok(clean.includes('href="https://github.com/deawar"'), 'link kept')
  assert.ok(clean.includes('<img'), 'image kept')
  assert.ok(clean.includes('<details>'), 'details kept')
  assert.ok(clean.includes('<summary>'), 'summary kept')
})
