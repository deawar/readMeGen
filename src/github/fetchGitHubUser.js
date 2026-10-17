import axios from 'axios'

/**
 * Fetch a GitHub user's public profile.
 *
 * Offline-safe and auth-safe (design §4.3, bugs #5/#6):
 *  - sends `Authorization: Bearer <token>` only when a token is provided;
 *  - returns a tagged result instead of throwing, so callers can tell a
 *    genuine 404 (re-prompt) from an unreachable API (manual fallback).
 *
 * @param {string} username
 * @param {{token?: string, client?: Function}} [options] `client` is an
 *   axios-compatible callable, injectable for tests.
 * @returns {Promise<{ok: true, user: object} | {ok: false, reason: 'not_found'|'unreachable'}>}
 */
export async function fetchGitHubUser (username, { token, client = axios } = {}) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await client({
      method: 'get',
      url: `https://api.github.com/users/${username}`,
      headers
    })
    const { login, name, email, html_url: htmlUrl, avatar_url: avatarUrl, bio } = response.data
    return {
      ok: true,
      user: { login, name, email, html_url: htmlUrl, avatar_url: avatarUrl, bio }
    }
  } catch (err) {
    if (err?.response?.status === 404) return { ok: false, reason: 'not_found' }
    return { ok: false, reason: 'unreachable' }
  }
}
