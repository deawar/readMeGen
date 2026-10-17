import axios from 'axios'

/**
 * Fetch the authenticated GitHub user via the /user endpoint.
 *
 * Returns a tagged result — never throws:
 *  - no token → { ok: false, reason: 'no_token' } (no request is made)
 *  - success   → { ok: true, user: { login, name, email, html_url, avatar_url, bio } }
 *  - any error → { ok: false, reason: 'unreachable' }
 *
 * @param {{token?: string, client?: Function}} [options] `client` is an
 *   axios-compatible callable, injectable for tests.
 * @returns {Promise<{ok: true, user: object} | {ok: false, reason: 'no_token'|'unreachable'}>}
 */
export async function fetchAuthenticatedUser ({ token, client = axios } = {}) {
  if (!token) return { ok: false, reason: 'no_token' }

  try {
    const response = await client({
      method: 'get',
      url: 'https://api.github.com/user',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`
      }
    })
    const { login, name, email, html_url: htmlUrl, avatar_url: avatarUrl, bio } = response.data
    return {
      ok: true,
      user: { login, name, email, html_url: htmlUrl, avatar_url: avatarUrl, bio }
    }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}
