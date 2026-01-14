/**
 * OAuth Endpoints for Token Verification
 *
 * These are the API endpoints used to verify OAuth tokens from each platform.
 * Each endpoint returns user information when called with a valid access token.
 */

export const OAUTH_ENDPOINTS = {
  youtube: {
    url: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    authHeader: (token: string) => `Bearer ${token}`,
  },
  spotify: {
    url: 'https://api.spotify.com/v1/me',
    authHeader: (token: string) => `Bearer ${token}`,
  },
  discord: {
    url: 'https://discord.com/api/users/@me',
    authHeader: (token: string) => `Bearer ${token}`,
  },
  twitch: {
    url: 'https://api.twitch.tv/helix/users',
    authHeader: (token: string) => `Bearer ${token}`,
    requiresClientId: true,
  },
  twitter: {
    url: 'https://api.twitter.com/2/users/me',
    authHeader: (token: string) => `Bearer ${token}`,
  },
} as const

export type OAuthPlatform = keyof typeof OAUTH_ENDPOINTS

/**
 * Verify a single OAuth token against its platform API
 */
export async function verifyOAuthToken(
  platform: OAuthPlatform,
  token: string,
  clientId?: string
): Promise<boolean> {
  const endpoint = OAUTH_ENDPOINTS[platform]

  try {
    const headers: Record<string, string> = {
      Authorization: endpoint.authHeader(token),
    }

    // Twitch requires Client-Id header
    if (platform === 'twitch') {
      if (!clientId) {
        console.warn(`[OAuth] ${platform}: Client ID required but not provided`)
        return false
      }
      headers['Client-Id'] = clientId
    }

    const response = await fetch(endpoint.url, { headers })
    return response.ok
  } catch (error) {
    console.error(`[OAuth] ${platform}: Verification failed:`, error)
    return false
  }
}

/**
 * Verify multiple OAuth tokens in parallel
 */
export async function verifyAllTokens(
  tokens: Partial<Record<OAuthPlatform, string>>,
  twitchClientId?: string
): Promise<Record<OAuthPlatform, boolean>> {
  const results = await Promise.all([
    tokens.youtube ? verifyOAuthToken('youtube', tokens.youtube) : false,
    tokens.spotify ? verifyOAuthToken('spotify', tokens.spotify) : false,
    tokens.discord ? verifyOAuthToken('discord', tokens.discord) : false,
    tokens.twitch ? verifyOAuthToken('twitch', tokens.twitch, twitchClientId) : false,
    tokens.twitter ? verifyOAuthToken('twitter', tokens.twitter) : false,
  ])

  return {
    youtube: results[0],
    spotify: results[1],
    discord: results[2],
    twitch: results[3],
    twitter: results[4],
  }
}
