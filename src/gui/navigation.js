// src/gui/navigation.js
// Decide whether an off-origin URL from the renderer may be opened in the
// system browser. Only an explicit scheme allowlist (http, https, mailto) is
// permitted — handing arbitrary protocols (file:, smb:, javascript:, OS custom
// handlers like ms-msdt:) to shell.openExternal is a protocol-handler-abuse /
// RCE risk. mailto is included because README Contact sections use it.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * @param {string} url
 * @returns {string|null} the normalized href if safe to open externally, else null
 */
export function safeExternalUrl (url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : null
}
