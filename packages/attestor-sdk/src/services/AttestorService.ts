/**
 * AttestorService
 *
 * Core service for creating on-chain attestations.
 * This is framework-agnostic and can be used in any JS/TS environment.
 *
 * Supports two modes:
 * 1. Direct MultiVault writes (no proxy) - no platform fees
 * 2. Proxy writes - with optional platform fee collection
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  stringToHex,
  type PublicClient,
  type WalletClient,
  type Address,
} from 'viem'
import { type ChainConfiguration, GAS_CONFIG } from '../config/chainConfig'
import { DEPOSIT_CONFIG, APPROVAL_TYPE } from '../config/constants'
import { SofiaFeeProxyAbi } from '../abi/SofiaFeeProxy'
import { MultiVaultAbi } from '../abi/MultiVault'

// ============================================================
// Types
// ============================================================

export interface AttestorConfig {
  /** Mastra API URL */
  mastraUrl: string
  /** Workflow ID to call for verification */
  workflowId: string
  /** Predicate atom ID (e.g., "is_human") */
  predicateId: `0x${string}`
  /** Object atom ID (e.g., "verified") */
  objectId: `0x${string}`
  /** Chain configuration */
  chainConfig: ChainConfiguration
  /** Optional: Custom deposit amount */
  depositAmount?: bigint
}

export interface AttestationRequest {
  /** User's wallet address */
  walletAddress: `0x${string}`
  /** Custom data to send to the verification workflow */
  verificationData?: Record<string, unknown>
  /** Optional: Wallet client (if not using browser wallet) */
  walletClient?: WalletClient
}

export interface AttestationResult {
  success: boolean
  txHash?: string
  error?: string
  blockNumber?: bigint
}

export interface VerificationResult {
  success: boolean
  canCreateAttestation: boolean
  verified?: Record<string, boolean>
  error?: string
}

// ============================================================
// Service Implementation
// ============================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

export class AttestorService {
  private config: AttestorConfig
  private publicClient: PublicClient
  private useProxy: boolean

  constructor(config: AttestorConfig) {
    // Validate required IDs - reject zero addresses
    if (config.predicateId === ZERO_ADDRESS) {
      throw new Error('predicateId cannot be zero address - please configure ATTESTOR_CONFIG.PREDICATE_ID')
    }
    if (config.objectId === ZERO_ADDRESS) {
      throw new Error('objectId cannot be zero address - please configure ATTESTOR_CONFIG.OBJECT_ID')
    }

    this.config = config
    this.publicClient = createPublicClient({
      chain: config.chainConfig.chain,
      transport: http(config.chainConfig.rpcUrl),
    })
    // Use proxy if configured, otherwise write directly to MultiVault
    this.useProxy = !!config.chainConfig.proxyAddress
  }

  /**
   * Create an on-chain attestation
   */
  async createAttestation(request: AttestationRequest): Promise<AttestationResult> {
    const { walletAddress, verificationData, walletClient: providedWalletClient } = request

    try {
      // Step 1: Verify via Mastra API
      console.log('[AttestorService] Verifying via Mastra API...')
      const verification = await this.verify(walletAddress, verificationData)

      if (!verification.canCreateAttestation) {
        return {
          success: false,
          error: verification.error || 'Verification failed',
        }
      }

      console.log('[AttestorService] Verification passed!')

      // Step 2: Get wallet client
      const walletClient = providedWalletClient || await this.getWalletClient()
      if (!walletClient) {
        return { success: false, error: 'No wallet client available' }
      }

      // Step 3: Check and request proxy approval if using proxy
      if (this.useProxy) {
        const isApproved = await this.checkProxyApproval(walletAddress)
        if (!isApproved) {
          console.log('[AttestorService] Requesting proxy approval...')
          const approvalResult = await this.requestProxyApproval(walletClient, walletAddress)
          if (!approvalResult.success) {
            return { success: false, error: 'Proxy approval failed' }
          }
        }
      }

      // Step 4: Calculate user atom ID
      const userAtomData = stringToHex(walletAddress)
      const userAtomId = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateAtomId',
        args: [userAtomData],
      }) as Address

      // Step 5: Create user atom if needed
      const userAtomExists = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [userAtomId],
      }) as boolean

      if (!userAtomExists) {
        console.log('[AttestorService] Creating user atom...')
        const atomResult = await this.createUserAtom(walletClient, walletAddress, userAtomData)
        if (!atomResult.success) {
          return { success: false, error: 'Failed to create user atom' }
        }
      }

      // Step 6: Create the triple
      console.log('[AttestorService] Creating triple...')
      return await this.createTriple(walletClient, walletAddress, userAtomId)

    } catch (error) {
      console.error('[AttestorService] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Verify off-chain data via Mastra workflow
   */
  async verify(
    walletAddress: string,
    verificationData?: Record<string, unknown>
  ): Promise<VerificationResult> {
    try {
      const response = await fetch(
        `${this.config.mastraUrl}/api/workflows/${this.config.workflowId}/start-async`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputData: {
              walletAddress,
              ...verificationData,
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          canCreateAttestation: false,
          error: `API error: ${response.status} - ${errorText}`,
        }
      }

      const result = await response.json()

      // Extract data from workflow result
      const data = result?.result ||
        result?.steps?.['verify-attestation']?.output ||
        result

      return {
        success: data.success ?? true,
        canCreateAttestation: data.canCreateAttestation ?? false,
        verified: data.verified,
        error: data.error,
      }
    } catch (error) {
      return {
        success: false,
        canCreateAttestation: false,
        error: error instanceof Error ? error.message : 'Network error',
      }
    }
  }

  /**
   * Check if proxy is approved for deposits (only when using proxy)
   */
  async checkProxyApproval(walletAddress: string): Promise<boolean> {
    if (!this.useProxy || !this.config.chainConfig.proxyAddress) {
      return true // No approval needed for direct MultiVault writes
    }

    try {
      const approval = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'approvals',
        args: [walletAddress as Address, this.config.chainConfig.proxyAddress],
      }) as number

      return approval >= APPROVAL_TYPE.DEPOSIT
    } catch {
      // If the function doesn't exist or fails, assume not approved
      return false
    }
  }

  /**
   * Request proxy approval from user
   */
  private async requestProxyApproval(
    walletClient: WalletClient,
    walletAddress: `0x${string}`
  ): Promise<{ success: boolean; txHash?: string }> {
    if (!this.config.chainConfig.proxyAddress) {
      return { success: true } // No approval needed
    }

    try {
      const txHash = await walletClient.writeContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'approve',
        args: [this.config.chainConfig.proxyAddress, APPROVAL_TYPE.DEPOSIT],
        chain: this.config.chainConfig.chain,
        account: walletAddress,
      })

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })
      return {
        success: receipt.status === 'success',
        txHash,
      }
    } catch (error) {
      console.error('[AttestorService] Approval error:', error)
      return { success: false }
    }
  }

  /**
   * Create user atom on-chain
   */
  private async createUserAtom(
    walletClient: WalletClient,
    walletAddress: `0x${string}`,
    atomData: `0x${string}`
  ): Promise<{ success: boolean; txHash?: string }> {
    const depositAmount = this.config.depositAmount || DEPOSIT_CONFIG.MIN_DEPOSIT
    const atomCost = await this.getAtomCost()

    return this.executeContractWrite(walletClient, walletAddress, {
      functionName: 'createAtoms',
      proxyArgs: [walletAddress, [atomData], [depositAmount], DEPOSIT_CONFIG.CURVE_ID],
      directArgs: [[atomData], [depositAmount]],
      baseCost: atomCost,
      depositAmount,
    })
  }

  /**
   * Create the attestation triple on-chain
   */
  private async createTriple(
    walletClient: WalletClient,
    walletAddress: `0x${string}`,
    subjectId: Address
  ): Promise<AttestationResult> {
    const depositAmount = this.config.depositAmount || DEPOSIT_CONFIG.MIN_DEPOSIT
    const tripleCost = await this.getTripleCost()

    return this.executeContractWrite(walletClient, walletAddress, {
      functionName: 'createTriples',
      proxyArgs: [
        walletAddress,
        [subjectId],
        [this.config.predicateId],
        [this.config.objectId],
        [depositAmount],
        DEPOSIT_CONFIG.CURVE_ID,
      ],
      directArgs: [
        [subjectId],
        [this.config.predicateId],
        [this.config.objectId],
        [depositAmount],
      ],
      baseCost: tripleCost,
      depositAmount,
    })
  }

  // ============================================================
  // Generic Contract Write Helper
  // ============================================================

  /**
   * Execute a contract write with simulation
   * Handles both proxy and direct MultiVault writes
   */
  private async executeContractWrite(
    walletClient: WalletClient,
    walletAddress: `0x${string}`,
    params: {
      functionName: 'createAtoms' | 'createTriples'
      proxyArgs: readonly unknown[]
      directArgs: readonly unknown[]
      baseCost: bigint
      depositAmount: bigint
    }
  ): Promise<{ success: boolean; txHash?: `0x${string}`; error?: string }> {
    const { functionName, proxyArgs, directArgs, baseCost, depositAmount } = params

    try {
      let txHash: `0x${string}`

      if (this.useProxy && this.config.chainConfig.proxyAddress) {
        const totalCost = await this.getProxyTotalCost(1, depositAmount, baseCost + depositAmount)

        // Simulate first
        await this.publicClient.simulateContract({
          address: this.config.chainConfig.proxyAddress,
          abi: SofiaFeeProxyAbi,
          functionName,
          args: proxyArgs as never,
          value: totalCost,
          account: walletAddress,
        })

        txHash = await walletClient.writeContract({
          address: this.config.chainConfig.proxyAddress,
          abi: SofiaFeeProxyAbi,
          functionName,
          args: proxyArgs as never,
          value: totalCost,
          chain: this.config.chainConfig.chain,
          account: walletAddress,
          ...GAS_CONFIG,
        })
      } else {
        const totalCost = baseCost + depositAmount

        // Simulate first
        await this.publicClient.simulateContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName,
          args: directArgs as never,
          value: totalCost,
          account: walletAddress,
        })

        txHash = await walletClient.writeContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName,
          args: directArgs as never,
          value: totalCost,
          chain: this.config.chainConfig.chain,
          account: walletAddress,
          ...GAS_CONFIG,
        })
      }

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })

      if (receipt.status !== 'success') {
        return { success: false, txHash, error: 'Transaction reverted on-chain' }
      }

      return { success: true, txHash }
    } catch (error) {
      console.error(`[AttestorService] ${functionName} error:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================
  // Cost Calculation Helpers
  // ============================================================

  private async getAtomCost(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.config.chainConfig.multivaultAddress,
      abi: MultiVaultAbi,
      functionName: 'getAtomCost',
    }) as bigint
  }

  private async getTripleCost(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.config.chainConfig.multivaultAddress,
      abi: MultiVaultAbi,
      functionName: 'getTripleCost',
    }) as bigint
  }

  /**
   * Get total cost when using proxy (includes proxy fees)
   */
  private async getProxyTotalCost(
    depositCount: number,
    totalDeposit: bigint,
    multiVaultCost: bigint
  ): Promise<bigint> {
    if (!this.config.chainConfig.proxyAddress) {
      return multiVaultCost
    }

    const depositFee = await this.publicClient.readContract({
      address: this.config.chainConfig.proxyAddress,
      abi: SofiaFeeProxyAbi,
      functionName: 'calculateDepositFee',
      args: [BigInt(depositCount), totalDeposit],
    }) as bigint

    const creationFee = await this.publicClient.readContract({
      address: this.config.chainConfig.proxyAddress,
      abi: SofiaFeeProxyAbi,
      functionName: 'creationFixedFee',
    }) as bigint

    return multiVaultCost + depositFee + creationFee
  }

  // ============================================================
  // Wallet Client Helper
  // ============================================================

  private async getWalletClient(): Promise<WalletClient | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null
    }

    try {
      const [address] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[]

      return createWalletClient({
        account: address as Address,
        chain: this.config.chainConfig.chain,
        transport: custom(window.ethereum),
      })
    } catch {
      return null
    }
  }
}

// TypeScript: Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}
