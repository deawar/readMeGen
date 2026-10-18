// src/gui/sanitize.js
// Sanitize markdown-it output before it is injected via innerHTML. The strict
// CSP (script-src 'self', no unsafe-inline) already blocks script/inline-handler
// execution; DOMPurify is belt-and-suspenders against a CSP gap. Runs in MAIN
// at the render-markdown IPC choke point, so the renderer can never receive
// unsanitized HTML. The DOM is injected (jsdom in Node) to keep this module
// pure and unit-testable without pulling jsdom into src/.

import createDOMPurify from 'dompurify'

// READMEs are HTML-rich, so markdown-it runs with {html:true}. We keep the
// legitimate structural/formatting HTML a README uses and forbid the sinks that
// could execute code or rewrite the page. DOMPurify already drops `on*`
// handlers and javascript: URLs by default; these are the explicit extras.
export const SANITIZE_CONFIG = {
  FORBID_TAGS: ['script', 'style', 'meta', 'form', 'base', 'link'],
  FORBID_ATTR: ['style']
}

/**
 * Build a sanitizer bound to the given DOM window.
 * @param {object} windowLike  a DOM window (jsdom's `.window` in main)
 * @returns {(html:string) => string} sanitize fn applying SANITIZE_CONFIG
 */
export function createSanitize (windowLike) {
  const purify = createDOMPurify(windowLike)
  return (html) => purify.sanitize(html, SANITIZE_CONFIG)
}
