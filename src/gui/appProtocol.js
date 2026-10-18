/**
 * appProtocol.js — pure path resolver for the app:// custom scheme.
 * Maps an app:// request URL to an absolute file path under the app root,
 * rejecting path traversal attempts.
 */

import path from 'node:path'

/**
 * Resolve an app:// request URL to an absolute file path under root.
 *
 * @param {string} root - absolute path to the app root directory
 * @param {string} requestUrl - the app:// URL (e.g. 'app://local/index.html')
 * @returns {string|null} absolute file path, or null if outside root
 */
export function resolveAppPath (root, requestUrl) {
  // Reject traversal in the raw URL string before any normalization.
  // Check for literal '..' segments and URL-encoded variants (%2f, %5c).
  // We must inspect the raw string because new URL() normalizes '../../' away.
  const rawPath = requestUrl.replace(/^[^:]+:\/\/[^/]*/, '') // strip scheme+host
  const decodedRaw = decodeURIComponent(rawPath)
  // Split on both forward and back slashes and reject any '..' segment
  const segments = decodedRaw.split(/[/\\]/)
  if (segments.includes('..')) {
    return null
  }

  const url = new URL(requestUrl)
  const decoded = decodeURIComponent(url.pathname)
  // Strip all leading slashes to get a relative path
  const rel = decoded.replace(/^[/\\]+/, '')
  // Default to index.html for empty/root path
  const target = rel === '' ? 'index.html' : rel
  const joined = path.join(root, target)
  const normalized = path.normalize(joined)
  const normalizedRoot = path.normalize(root)
  // Only allow paths that are within root (belt-and-suspenders check)
  if (normalized === normalizedRoot || normalized.startsWith(normalizedRoot + path.sep)) {
    return normalized
  }
  return null
}
