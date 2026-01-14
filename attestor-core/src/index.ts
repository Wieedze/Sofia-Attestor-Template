/**
 * Sofia Verifier
 *
 * Build your own on-chain attestation system
 *
 * Bot model: The bot signs and pays for TX, includes OAuth verification.
 */

// Core service (bot-pays model)
export { BotAttestorService } from './services/BotAttestorService'
export type {
  BotAttestorConfig,
  BotAttestationRequest,
  BotAttestationResult,
  OAuthTokens,
} from './services/BotAttestorService'

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
  ATTESTOR_CONFIG,
  DEPOSIT_CONFIG,
  APPROVAL_TYPE,
  GAS_LIMITS,
  BOT_DEPOSIT_CONFIG,
  OAUTH_CONFIG,
} from './config/constants'

// OAuth utilities
export {
  OAUTH_ENDPOINTS,
  verifyOAuthToken,
  verifyAllTokens,
} from './config/oauthEndpoints'
export type { OAuthPlatform } from './config/oauthEndpoints'

// ABIs (for advanced usage)
export { MultiVaultAbi } from './abi/MultiVault'
