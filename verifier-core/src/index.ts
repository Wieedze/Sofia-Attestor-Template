/**
 * Sofia Verifier
 *
 * Build your own on-chain social verification system
 *
 * Bot model: The bot signs and pays for TX, includes OAuth verification.
 * Uses IPFS pinning 
 */

// Core service (bot-pays model)
export { BotVerifierService } from './services/BotVerifierService'
export type {
  BotVerifierConfig,
  BotVerificationRequest,
  BotVerificationResult,
  OAuthTokens,
  LinkSocialResult,
} from './services/BotVerifierService'

// Backwards compatibility exports
export {
  BotAttestorService,
  type BotAttestorConfig,
  type BotAttestationRequest,
  type BotAttestationResult,
} from './services/BotVerifierService'

// Configuration
export {
  ChainConfig,
  testnetConfig,
  mainnetConfig,
  intuitionTestnet,
  intuitionMainnet,
  GAS_CONFIG,
  getExplorerTxUrl,
  getExplorerAddressUrl,
} from './config/chainConfig'
export type { ChainConfiguration } from './config/chainConfig'

export {
  VERIFIER_CONFIG,
  ATTESTOR_CONFIG, // backwards compatibility
  DEPOSIT_CONFIG,
  APPROVAL_TYPE,
  GAS_LIMITS,
  BOT_DEPOSIT_CONFIG,
  OAUTH_CONFIG,
  TERM_ID_VERIFIED,
  PREDICATE_NAMES,
  INTUITION_GRAPHQL_ENDPOINT,
} from './config/constants'
export type { SocialPlatform } from './config/constants'

// OAuth utilities
export {
  OAUTH_ENDPOINTS,
  verifyOAuthToken,
  verifyAllTokens,
  verifyAndGetUserId,
} from './config/oauthEndpoints'
export type { OAuthPlatform, OAuthVerificationResult } from './config/oauthEndpoints'

// ABIs (for advanced usage)
export { MultiVaultAbi } from './abi/MultiVault'
