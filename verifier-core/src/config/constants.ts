/**
 * Verifier Constants
 *
 * ============================================================
 * Configuration for your social verifier
 * ============================================================
 */

/**
 * GraphQL endpoint for IPFS pinning
 * Used to create atoms with proper labels
 */
export const INTUITION_GRAPHQL_ENDPOINT = {
  testnet: 'https://testnet.intuition.sh/v1/graphql',
  mainnet: 'https://mainnet.intuition.sh/v1/graphql',
} as const

/**
 * Predicate names for each social platform
 * These are used to create triples: [wallet] [predicate] [userId]
 */
export const PREDICATE_NAMES = {
  discord: 'has verified discord id',
  youtube: 'has verified youtube id',
  spotify: 'has verified spotify id',
  twitch: 'has verified twitch id',
  twitter: 'has verified twitter id',
} as const

export type SocialPlatform = keyof typeof PREDICATE_NAMES

/**
 * Your verifier's term IDs (optional - for legacy triple format)
 * These are the on-chain atom IDs that represent your predicate and object
 *
 */
export const VERIFIER_CONFIG = {
  // Legacy predicate atom ID (optional)
  PREDICATE_ID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,

  // Legacy object atom ID (optional)
  OBJECT_ID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
}

/**
 * Default deposit amounts
 */
export const DEPOSIT_CONFIG = {
  // Minimum deposit for triple creation (0.01 ETH in wei)
  MIN_DEPOSIT: 10000000000000000n,

  // Curve ID for deposits (1 = linear)
  CURVE_ID: 1n,
}

/**
 * Approval types for MultiVault
 */
export const APPROVAL_TYPE = {
  NONE: 0,
  DEPOSIT: 1,    // Allow deposits on behalf of user
  REDEEM: 2,     // Allow redemptions on behalf of user
  BOTH: 3,       // Allow both
} as const

/**
 * Gas limits for bot-pays model
 * These values are tested and working on Intuition Mainnet
 */
export const GAS_LIMITS = {
  ATOM_CREATION: 500000n,
  TRIPLE_CREATION: 800000n,
} as const

/**
 * Deposit amounts for bot-pays model
 * These values ensure sufficient balance for all fees
 */
export const BOT_DEPOSIT_CONFIG = {
  // Deposit when creating atoms (0.5 TRUST)
  ATOM_DEPOSIT: 500000000000000000n,
  // Extra deposit for triple creation to cover fees (0.5 TRUST)
  TRIPLE_EXTRA: 500000000000000000n,
} as const

/**
 * OAuth verification configuration
 */
export const OAUTH_CONFIG = {
  // Default verification threshold (number of platforms that must be verified)
  DEFAULT_THRESHOLD: 5,
  // Platforms supported
  PLATFORMS: ['youtube', 'spotify', 'discord', 'twitch', 'twitter'] as const,
} as const

/**
 * Pre-existing Term IDs on Intuition Mainnet
 * Used for linking social accounts to wallets (legacy format)
 */
export const TERM_ID_VERIFIED = '0xcdffac0eb431ba084e18d5af7c55b4414c153f5c0df693c2d1454079186f975c' as `0x${string}`

// Backwards compatibility export
export const ATTESTOR_CONFIG = VERIFIER_CONFIG
