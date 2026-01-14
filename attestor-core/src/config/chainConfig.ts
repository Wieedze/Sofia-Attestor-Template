/**
 * Chain Configuration
 *
 * Defines network configurations for Intuition testnet and mainnet.
 */

import { defineChain, type Chain } from 'viem'

// ============================================================
// Intuition Chain Definitions
// ============================================================

/**
 * Intuition Testnet (Chain ID: 13579)
 */
export const intuitionTestnet = defineChain({
  id: 13579,
  name: 'Intuition Testnet',
  network: 'intuition-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Trust',
    symbol: 'TRUST',
  },
  rpcUrls: {
    public: { http: ['https://testnet.rpc.intuition.systems'] },
    default: { http: ['https://testnet.rpc.intuition.systems'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://testnet.explorer.intuition.systems' },
  },
})

/**
 * Intuition Mainnet (Chain ID: 1155)
 */
export const intuitionMainnet = defineChain({
  id: 1155,
  name: 'Intuition Mainnet',
  network: 'intuition-mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Trust',
    symbol: 'TRUST',
  },
  rpcUrls: {
    public: { http: ['https://rpc.intuition.systems'] },
    default: { http: ['https://rpc.intuition.systems'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.intuition.systems' },
  },
})

// ============================================================
// Chain Configuration Interface
// ============================================================

export interface ChainConfiguration {
  chain: Chain
  /** MultiVault contract address */
  multivaultAddress: `0x${string}`
  rpcUrl: string
  explorerUrl: string
  graphqlEndpoint: string
}

// ============================================================
// Pre-configured Chain Configs
// ============================================================

/**
 * Testnet Configuration (Intuition Testnet - Chain ID: 13579)
 */
export const testnetConfig: ChainConfiguration = {
  chain: intuitionTestnet,
  multivaultAddress: '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91' as `0x${string}`,
  rpcUrl: 'https://testnet.rpc.intuition.systems',
  explorerUrl: 'https://testnet.explorer.intuition.systems',
  graphqlEndpoint: 'https://testnet.intuition.sh/v1/graphql',
}

/**
 * Mainnet Configuration (Intuition Mainnet - Chain ID: 1155)
 */
export const mainnetConfig: ChainConfiguration = {
  chain: intuitionMainnet,
  multivaultAddress: '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e' as `0x${string}`,
  rpcUrl: 'https://rpc.intuition.systems',
  explorerUrl: 'https://explorer.intuition.systems',
  graphqlEndpoint: 'https://mainnet.intuition.sh/v1/graphql',
}

/**
 * Pre-configured chain configs
 */
export const ChainConfig = {
  testnet: testnetConfig,
  mainnet: mainnetConfig,
} as const

/**
 * Gas configuration
 */
export const GAS_CONFIG = {
  maxFeePerGas: 1000000000n,         // 1 gwei
  maxPriorityFeePerGas: 100000000n,  // 0.1 gwei
}

/**
 * Helper to get explorer URL for a transaction
 */
export const getExplorerTxUrl = (config: ChainConfiguration, txHash: string): string => {
  return `${config.explorerUrl}/tx/${txHash}`
}

/**
 * Helper to get explorer URL for an address
 */
export const getExplorerAddressUrl = (config: ChainConfiguration, address: string): string => {
  return `${config.explorerUrl}/address/${address}`
}
