
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

export interface OAuthVerificationResult {
  valid: boolean
  userId?: string
  username?: string
  error?: string
}

/**
 * Verify OAuth token and retrieve user ID
 */
export async function verifyAndGetUserId(
  platform: OAuthPlatform,
  token: string,
  clientId?: string
): Promise<OAuthVerificationResult> {
  const endpoint = OAUTH_ENDPOINTS[platform]

  try {
    const headers: Record<string, string> = {
      Authorization: endpoint.authHeader(token),
    }

    if (platform === 'twitch') {
      if (!clientId) {
        return { valid: false, error: 'Twitch Client ID required' }
      }
      headers['Client-Id'] = clientId
    }

    const response = await fetch(endpoint.url, { headers })

    if (!response.ok) {
      return { valid: false, error: `API returned ${response.status}` }
    }

    const data = await response.json()

    // Extract userId based on platform
    let userId: string | undefined
    let username: string | undefined

    switch (platform) {
      case 'discord':
        // Discord: { id: "123456789", username: "user" }
        userId = data.id
        username = data.username
        break
      case 'youtube':
        // YouTube: { items: [{ id: "UCxxxxx", snippet: { title: "Channel Name" } }] }
        userId = data.items?.[0]?.id
        username = data.items?.[0]?.snippet?.title
        break
      case 'spotify':
        // Spotify: { id: "user123", display_name: "User Name" }
        userId = data.id
        username = data.display_name
        break
      case 'twitch':
        // Twitch: { data: [{ id: "123456", login: "username" }] }
        userId = data.data?.[0]?.id
        username = data.data?.[0]?.login
        break
      case 'twitter':
        // Twitter: { data: { id: "123456789", username: "user" } }
        userId = data.data?.id
        username = data.data?.username
        break
    }

    if (!userId) {
      return { valid: false, error: 'Could not extract user ID from response' }
    }

    return { valid: true, userId, username }
  } catch (error) {
    console.error(`[OAuth] ${platform}: Verification failed:`, error)
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Verify a single OAuth token (simple boolean check)
 */
export async function verifyOAuthToken(
  platform: OAuthPlatform,
  token: string,
  clientId?: string
): Promise<boolean> {
  const result = await verifyAndGetUserId(platform, token, clientId)
  return result.valid
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
