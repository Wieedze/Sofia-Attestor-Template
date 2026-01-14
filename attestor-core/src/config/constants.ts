/**
 * Attestor Constants
 *
 * ============================================================
 * TODO: Update these values for your attestor
 * ============================================================
 */

/**
 * Your attestor's term IDs
 * These are the on-chain atom IDs that represent your predicate and object
 *
 * Example for "Proof of Human":
 * - PREDICATE_ID = "socials_platform" atom ID
 * - OBJECT_ID = "verified" atom ID
 *
 * You can create these atoms using the Intuition API or directly on-chain
 */
export const ATTESTOR_CONFIG = {
  // TODO: Replace with your predicate atom ID
  // This represents what you're attesting (e.g., "is_human", "has_influence", etc.)
  PREDICATE_ID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,

  // TODO: Replace with your object atom ID
  // This represents the value (e.g., "verified", "true", etc.)
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
  // Deposit when creating user atom (2 TRUST)
  ATOM_DEPOSIT: 2000000000000000000n,
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
