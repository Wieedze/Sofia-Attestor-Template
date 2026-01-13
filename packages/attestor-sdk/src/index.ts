/**
 * Sofia Attestor SDK
 *
 * Build your own on-chain attestation system on Sofia/Intuition.
 */

// Core service
export { AttestorService } from './services/AttestorService'
export type {
  AttestorConfig,
  AttestationRequest,
  AttestationResult,
  VerificationResult,
} from './services/AttestorService'

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
} from './config/constants'

// ABIs (for advanced usage)
export { SofiaFeeProxyAbi } from './abi/SofiaFeeProxy'
export { MultiVaultAbi } from './abi/MultiVault'
