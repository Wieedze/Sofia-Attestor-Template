/**
 * BotAttestorService
 *
 * Attestor service where the BOT pays and signs transactions.
 * The bot verifies OAuth tokens and creates
 * attestations on behalf of users, paying for gas from its own wallet.
 *
 * Key differences from AttestorService:
 * - Bot private key is used for signing (not user's browser wallet)
 * - Bot pays for all gas fees
 * - OAuth verification is integrated (no external Mastra call)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  stringToHex,
  encodeFunctionData,
  type PublicClient,
  type WalletClient,
  type Address,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { type ChainConfiguration } from '../config/chainConfig'
import { MultiVaultAbi } from '../abi/MultiVault'

// ============================================================
// Types
// ============================================================

export interface BotAttestorConfig {
  /** Bot's private key (from environment) */
  botPrivateKey: `0x${string}`
  /** Predicate atom ID (e.g., "socials_platform") */
  predicateId: `0x${string}`
  /** Object atom ID (e.g., "verified") */
  objectId: `0x${string}`
  /** Chain configuration */
  chainConfig: ChainConfiguration
  /** Verification threshold (default: 5) */
  verificationThreshold?: number
  /** Twitch Client ID for OAuth verification */
  twitchClientId?: string
}

export interface OAuthTokens {
  youtube?: string
  spotify?: string
  discord?: string
  twitch?: string
  twitter?: string
}

export interface BotAttestationRequest {
  /** User's wallet address to receive the attestation */
  walletAddress: `0x${string}`
  /** OAuth tokens to verify */
  tokens: OAuthTokens
}

export interface BotAttestationResult {
  success: boolean
  verified: {
    youtube: boolean
    spotify: boolean
    discord: boolean
    twitch: boolean
    twitter: boolean
  }
  verifiedCount: number
  txHash?: string
  blockNumber?: number
  atomCreated?: boolean
  tripleAlreadyExists?: boolean
  error?: string
}

// ============================================================
// Gas and Deposit Configuration
// ============================================================

const GAS_CONFIG = {
  ATOM_CREATION: 500000n,
  TRIPLE_CREATION: 800000n,
}

const DEPOSIT_CONFIG = {
  ATOM_DEPOSIT: 2000000000000000000n,    // 2 TRUST
  TRIPLE_EXTRA: 500000000000000000n,      // 0.5 TRUST extra for fees
}

// ============================================================
// OAuth Verification Functions
// ============================================================

async function verifyYouTubeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

async function verifySpotifyToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

async function verifyDiscordToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

async function verifyTwitchToken(token: string, clientId?: string): Promise<boolean> {
  if (!clientId) {
    console.warn('[BotAttestorService] TWITCH_CLIENT_ID not provided')
    return false
  }
  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
      },
    })
    return res.ok
  } catch {
    return false
  }
}

async function verifyTwitterToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

// ============================================================
// Service Implementation
// ============================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

export class BotAttestorService {
  private config: BotAttestorConfig
  private publicClient: PublicClient
  private walletClient: WalletClient
  private account: PrivateKeyAccount

  constructor(config: BotAttestorConfig) {
    // Validate required IDs
    if (config.predicateId === ZERO_ADDRESS) {
      throw new Error('predicateId cannot be zero address - please configure your predicate atom ID')
    }
    if (config.objectId === ZERO_ADDRESS) {
      throw new Error('objectId cannot be zero address - please configure your object atom ID')
    }
    if (!config.botPrivateKey) {
      throw new Error('botPrivateKey is required')
    }

    this.config = config
    this.account = privateKeyToAccount(config.botPrivateKey)

    this.publicClient = createPublicClient({
      chain: config.chainConfig.chain,
      transport: http(config.chainConfig.rpcUrl),
    })

    this.walletClient = createWalletClient({
      account: this.account,
      chain: config.chainConfig.chain,
      transport: http(config.chainConfig.rpcUrl),
    })

    console.log(`[BotAttestorService] Initialized with bot address: ${this.account.address}`)
  }

  /**
   * Get the bot's wallet address
   */
  getBotAddress(): Address {
    return this.account.address
  }

  /**
   * Get the bot's current balance
   */
  async getBotBalance(): Promise<bigint> {
    return await this.publicClient.getBalance({ address: this.account.address })
  }

  /**
   * Verify OAuth tokens
   */
  async verifyTokens(tokens: OAuthTokens): Promise<{
    verified: BotAttestationResult['verified']
    verifiedCount: number
  }> {
    const [youtube, spotify, discord, twitch, twitter] = await Promise.all([
      tokens.youtube ? verifyYouTubeToken(tokens.youtube) : false,
      tokens.spotify ? verifySpotifyToken(tokens.spotify) : false,
      tokens.discord ? verifyDiscordToken(tokens.discord) : false,
      tokens.twitch ? verifyTwitchToken(tokens.twitch, this.config.twitchClientId) : false,
      tokens.twitter ? verifyTwitterToken(tokens.twitter) : false,
    ])

    const verified = { youtube, spotify, discord, twitch, twitter }
    const verifiedCount = Object.values(verified).filter(Boolean).length

    return { verified, verifiedCount }
  }

  /**
   * Create an on-chain attestation
   * Bot verifies OAuth tokens and creates the triple, paying for gas.
   */
  async createAttestation(request: BotAttestationRequest): Promise<BotAttestationResult> {
    const { walletAddress, tokens } = request
    const threshold = this.config.verificationThreshold ?? 5

    console.log(`[BotAttestorService] Starting attestation for ${walletAddress}`)

    // Step 1: Verify OAuth tokens
    console.log('[BotAttestorService] Verifying OAuth tokens...')
    const { verified, verifiedCount } = await this.verifyTokens(tokens)

    console.log(`[BotAttestorService] Verified ${verifiedCount}/5 platforms:`, verified)

    // Check threshold
    if (verifiedCount < threshold) {
      return {
        success: false,
        verified,
        verifiedCount,
        error: `Only ${verifiedCount}/5 platforms verified. At least ${threshold} platforms must be connected.`,
      }
    }

    console.log('[BotAttestorService] Verification passed! Creating on-chain attestation...')

    try {
      // Step 2: Calculate user's atom ID from their wallet address
      const userAtomData = stringToHex(walletAddress)
      const userAtomId = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateAtomId',
        args: [userAtomData],
      }) as `0x${string}`

      console.log(`[BotAttestorService] User atom ID: ${userAtomId}`)

      // Step 3: Check if user atom exists
      const userAtomExists = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [userAtomId],
      }) as boolean

      console.log(`[BotAttestorService] User atom exists: ${userAtomExists}`)

      let atomCreated = false

      // Step 4: Create user atom if needed
      if (!userAtomExists) {
        console.log('[BotAttestorService] Creating user atom...')

        const atomCost = await this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'getAtomCost',
        }) as bigint

        const atomTotalCost = atomCost + DEPOSIT_CONFIG.ATOM_DEPOSIT
        console.log(`[BotAttestorService] Atom cost: ${atomCost}, deposit: ${DEPOSIT_CONFIG.ATOM_DEPOSIT}, total: ${atomTotalCost}`)

        const atomCallData = encodeFunctionData({
          abi: MultiVaultAbi,
          functionName: 'createAtoms',
          args: [[userAtomData], [DEPOSIT_CONFIG.ATOM_DEPOSIT]],
        })

        const createAtomHash = await this.walletClient.sendTransaction({
          to: this.config.chainConfig.multivaultAddress,
          data: atomCallData,
          value: atomTotalCost,
          gas: GAS_CONFIG.ATOM_CREATION,
        })

        console.log(`[BotAttestorService] Atom TX sent: ${createAtomHash}`)
        const atomReceipt = await this.publicClient.waitForTransactionReceipt({ hash: createAtomHash })

        if (atomReceipt.status !== 'success') {
          return {
            success: false,
            verified,
            verifiedCount,
            error: `Atom creation failed. TX: ${createAtomHash}`,
          }
        }

        console.log(`[BotAttestorService] Atom created in block ${atomReceipt.blockNumber}`)
        atomCreated = true
      }

      // Step 5: Check if predicate and object atoms exist
      const predicateExists = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [this.config.predicateId],
      }) as boolean

      const objectExists = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [this.config.objectId],
      }) as boolean

      console.log(`[BotAttestorService] Predicate exists: ${predicateExists}, Object exists: ${objectExists}`)

      if (!predicateExists || !objectExists) {
        return {
          success: false,
          verified,
          verifiedCount,
          atomCreated,
          error: `Required atoms missing. Predicate exists: ${predicateExists}, Object exists: ${objectExists}`,
        }
      }

      // Step 6: Check if triple already exists
      const tripleId = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateTripleId',
        args: [userAtomId, this.config.predicateId, this.config.objectId],
      }) as `0x${string}`

      console.log(`[BotAttestorService] Triple ID: ${tripleId}`)

      const tripleExists = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [tripleId],
      }) as boolean

      if (tripleExists) {
        console.log('[BotAttestorService] Triple already exists!')
        return {
          success: true,
          verified,
          verifiedCount,
          tripleAlreadyExists: true,
          atomCreated,
        }
      }

      // Step 7: Create the triple
      console.log('[BotAttestorService] Creating triple...')

      const tripleCost = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'getTripleCost',
      }) as bigint

      // assets[0] = tripleCost + extra for fees
      const tripleDepositAmount = tripleCost + DEPOSIT_CONFIG.TRIPLE_EXTRA
      const tripleTotalCost = tripleDepositAmount

      console.log(`[BotAttestorService] Triple cost: ${tripleCost}, extra: ${DEPOSIT_CONFIG.TRIPLE_EXTRA}, total: ${tripleTotalCost}`)

      // Check bot balance
      const botBalance = await this.getBotBalance()
      console.log(`[BotAttestorService] Bot balance: ${botBalance} wei (${Number(botBalance) / 1e18} TRUST)`)

      if (botBalance < tripleTotalCost) {
        return {
          success: false,
          verified,
          verifiedCount,
          atomCreated,
          error: `Insufficient bot balance. Need ${tripleTotalCost}, have ${botBalance}`,
        }
      }

      // Verify atoms are actually atoms (not triples)
      const [subjectIsAtom, predicateIsAtom, objectIsAtom] = await Promise.all([
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'isAtom',
          args: [userAtomId],
        }) as Promise<boolean>,
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'isAtom',
          args: [this.config.predicateId],
        }) as Promise<boolean>,
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'isAtom',
          args: [this.config.objectId],
        }) as Promise<boolean>,
      ])

      console.log(`[BotAttestorService] Subject isAtom: ${subjectIsAtom}, Predicate isAtom: ${predicateIsAtom}, Object isAtom: ${objectIsAtom}`)

      if (!subjectIsAtom || !predicateIsAtom || !objectIsAtom) {
        return {
          success: false,
          verified,
          verifiedCount,
          atomCreated,
          error: `One or more IDs are not atoms. Subject: ${subjectIsAtom}, Predicate: ${predicateIsAtom}, Object: ${objectIsAtom}`,
        }
      }

      // Encode and send the triple creation transaction
      const tripleCallData = encodeFunctionData({
        abi: MultiVaultAbi,
        functionName: 'createTriples',
        args: [
          [userAtomId],                    // subjectIds - user's atom
          [this.config.predicateId],       // predicateIds
          [this.config.objectId],          // objectIds
          [tripleDepositAmount],           // assets
        ],
      })

      // Try to estimate gas first
      try {
        const gasEstimate = await this.publicClient.estimateGas({
          account: this.account.address,
          to: this.config.chainConfig.multivaultAddress,
          data: tripleCallData,
          value: tripleTotalCost,
        })
        console.log(`[BotAttestorService] Gas estimate: ${gasEstimate}`)
      } catch (estimateError) {
        console.warn('[BotAttestorService] Gas estimation failed:', estimateError)
      }

      const txHash = await this.walletClient.sendTransaction({
        to: this.config.chainConfig.multivaultAddress,
        data: tripleCallData,
        value: tripleTotalCost,
        gas: GAS_CONFIG.TRIPLE_CREATION,
      })

      console.log(`[BotAttestorService] Triple TX sent: ${txHash}`)

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })

      console.log(`[BotAttestorService] TX status: ${receipt.status}, gas used: ${receipt.gasUsed}`)

      if (receipt.status !== 'success') {
        return {
          success: false,
          verified,
          verifiedCount,
          atomCreated,
          error: `Triple creation failed. TX: ${txHash}. Gas used: ${receipt.gasUsed}`,
        }
      }

      console.log(`[BotAttestorService] Triple created in block ${receipt.blockNumber}`)

      return {
        success: true,
        verified,
        verifiedCount,
        txHash,
        blockNumber: Number(receipt.blockNumber),
        atomCreated,
      }
    } catch (error) {
      console.error('[BotAttestorService] Error:', error)
      return {
        success: false,
        verified,
        verifiedCount,
        error: error instanceof Error ? error.message : 'Unknown blockchain error',
      }
    }
  }

  /**
   * Check if a user already has an attestation
   */
  async hasAttestation(walletAddress: string): Promise<boolean> {
    try {
      const userAtomData = stringToHex(walletAddress)
      const userAtomId = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateAtomId',
        args: [userAtomData],
      }) as `0x${string}`

      const tripleId = await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'calculateTripleId',
        args: [userAtomId, this.config.predicateId, this.config.objectId],
      }) as `0x${string}`

      return await this.publicClient.readContract({
        address: this.config.chainConfig.multivaultAddress,
        abi: MultiVaultAbi,
        functionName: 'isTermCreated',
        args: [tripleId],
      }) as boolean
    } catch {
      return false
    }
  }
}
