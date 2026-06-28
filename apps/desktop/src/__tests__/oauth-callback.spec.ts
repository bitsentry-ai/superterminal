import { describe, expect, it } from 'vitest'

import {
  extractDeepLinkFromArgv,
  parseOAuthCallbackUrl,
} from '../main/platform/app/electron/oauth-callback'

describe('oauth callback deep links', () => {
  it('accepts the desktop oauth callback format with code and state', () => {
    expect(
      parseOAuthCallbackUrl(
        'bitsentry-desktop-ce://oauth/callback?code=abc123&state=state-1',
        '2026-05-06T00:00:00.000Z',
      ),
    ).toEqual({
      url: 'bitsentry-desktop-ce://oauth/callback?code=abc123&state=state-1',
      code: 'abc123',
      state: 'state-1',
      valid: true,
      receivedAt: '2026-05-06T00:00:00.000Z',
    })
  })

  it('rejects unsupported protocols and malformed callback payloads', () => {
    expect(
      parseOAuthCallbackUrl('https://example.com/oauth/callback?code=abc&state=def'),
    ).toMatchObject({
      valid: false,
      error: 'Unsupported protocol: https:',
    })

    expect(
      parseOAuthCallbackUrl('bitsentry-desktop-ce://oauth/callback?code=abc'),
    ).toMatchObject({
      valid: false,
      code: 'abc',
      state: null,
      error: 'OAuth callback is missing code or state query parameter',
    })

    expect(parseOAuthCallbackUrl('not-a-url')).toMatchObject({
      valid: false,
      error: 'Malformed callback URL',
    })
  })

  it('extracts the first desktop deep link from argv', () => {
    expect(
      extractDeepLinkFromArgv([
        'electron',
        '--flag',
        'bitsentry-desktop-ce://oauth/callback?code=abc123&state=state-1',
        'bitsentry-desktop-ce://oauth/callback?code=ignored&state=ignored',
      ]),
    ).toBe('bitsentry-desktop-ce://oauth/callback?code=abc123&state=state-1')

    expect(extractDeepLinkFromArgv(['electron', '--flag'])).toBeNull()
  })
})
