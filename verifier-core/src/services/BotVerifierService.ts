/**
 * BotVerifierService
 *
 * Verifier service where the BOT pays and signs transactions.
 * The bot verifies OAuth tokens and creates on-chain triples
 * on behalf of users, paying for gas from its own wallet.
 *
 * Methodology (from sofia-core):
 * - Uses IPFS pinning 
 * - Creates triples: [wallet] [has verified {platform} id] [userId]
 * - Each platform has its own predicate atom
 * - Social atom uses IPFS URI with name=userId for correct label
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
import {
  PREDICATE_NAMES,
  INTUITION_GRAPHQL_ENDPOINT,
  BOT_DEPOSIT_CONFIG,
  GAS_LIMITS,
  type SocialPlatform,
} from '../config/constants'
import { verifyAndGetUserId, type OAuthPlatform } from '../config/oauthEndpoints'

// ============================================================
// Types
// ============================================================

export interface BotVerifierConfig {
  /** Bot's private key (from environment) */
  botPrivateKey: `0x${string}`
  /** Chain configuration */
  chainConfig: ChainConfiguration
  /** Twitch Client ID for OAuth verification */
  twitchClientId?: string
  /** Use mainnet GraphQL endpoint (default: true) */
  useMainnet?: boolean
}

export interface OAuthTokens {
  youtube?: string
  spotify?: string
  discord?: string
  twitch?: string
  twitter?: string
}

export interface BotVerificationRequest {
  /** User's wallet address to receive the verification */
  walletAddress: `0x${string}`
  /** OAuth tokens to verify */
  tokens: OAuthTokens
}

export interface BotVerificationResult {
  success: boolean
  verified: {
    youtube: boolean
    spotify: boolean
    discord: boolean
    twitch: boolean
    twitter: boolean
  }
  verifiedCount: number
  txHashes?: string[]
  blockNumber?: number
  error?: string
}

export interface LinkSocialResult {
  success: boolean
  platform?: SocialPlatform
  userId?: string
  username?: string
  txHash?: string
  walletAtomCreated?: boolean
  predicateAtomCreated?: boolean
  socialAtomCreated?: boolean
  error?: string
}

// ============================================================
// IPFS Pinning
// ============================================================

/**
 * Pin data to IPFS via Intuition's pinThing mutation
 * Returns the IPFS URI that will be used as the atom data
 * The `name` parameter becomes the atom's label on-chain
 */
async function pinToIPFS(
  name: string,
  description: string,
  graphqlEndpoint: string
): Promise<string> {
  const mutation = `
    mutation PinThing($thing: PinThingInput!) {
      pinThing(thing: $thing) {
        uri
      }
    }
  `

  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        thing: {
          name,
          description,
          image: '',
          url: ''
        }
      }
    })
  })

  if (!response.ok) {
    throw new Error(`IPFS pinning failed: ${response.status}`)
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(`IPFS pinning error: ${result.errors[0].message}`)
  }

  const uri = result.data?.pinThing?.uri
  if (!uri) {
    throw new Error('No IPFS URI returned from pinThing')
  }

  return uri
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
    console.warn('[BotVerifierService] TWITCH_CLIENT_ID not provided')
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

export class BotVerifierService {
  private config: BotVerifierConfig
  private publicClient: PublicClient
  private walletClient: WalletClient
  private account: PrivateKeyAccount
  private graphqlEndpoint: string

  constructor(config: BotVerifierConfig) {
    if (!config.botPrivateKey) {
      throw new Error('botPrivateKey is required')
    }

    this.config = config
    this.account = privateKeyToAccount(config.botPrivateKey)
    this.graphqlEndpoint = config.useMainnet !== false
      ? INTUITION_GRAPHQL_ENDPOINT.mainnet
      : INTUITION_GRAPHQL_ENDPOINT.testnet

    this.publicClient = createPublicClient({
      chain: config.chainConfig.chain,
      transport: http(config.chainConfig.rpcUrl),
    })

    this.walletClient = createWalletClient({
      account: this.account,
      chain: config.chainConfig.chain,
      transport: http(config.chainConfig.rpcUrl),
    })

    console.log(`[BotVerifierService] Initialized with bot address: ${this.account.address}`)
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
   * Verify OAuth tokens (simple boolean check)
   */
  async verifyTokens(tokens: OAuthTokens): Promise<{
    verified: BotVerificationResult['verified']
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
   * Link a single social account to a wallet
   * Creates triple: [wallet] [has verified {platform} id] [userId]
   *
   * Uses IPFS pinning for proper atom labels.
   */
  async linkSocialAccount(
    platform: SocialPlatform,
    walletAddress: `0x${string}`,
    oauthToken: string
  ): Promise<LinkSocialResult> {
    console.log(`[BotVerifierService] Linking ${platform} account to ${walletAddress}`)

    // Step 1: Verify token and get userId
    const verification = await verifyAndGetUserId(platform as OAuthPlatform, oauthToken, this.config.twitchClientId)

    if (!verification.valid || !verification.userId) {
      return {
        success: false,
        error: verification.error || 'Invalid OAuth token',
      }
    }

    const { userId, username } = verification
    console.log(`[BotVerifierService] Verified ${platform} account: ${username} (${userId})`)

    try {
      // Step 2: Pin social atom to IPFS (name=userId for correct label)
      const socialDescription = `Verified ${platform} account ID`
      console.log(`[BotVerifierService] Pinning social atom to IPFS: name=${userId}`)
      const socialIpfsUri = await pinToIPFS(userId, socialDescription, this.graphqlEndpoint)
      console.log(`[BotVerifierService] Social atom IPFS URI: ${socialIpfsUri}`)

      // Step 3: Prepare atom data
      const walletAtomData = stringToHex(walletAddress)
      const predicateName = PREDICATE_NAMES[platform]
      const predicateDataHex = stringToHex(predicateName)
      const socialAtomDataHex = stringToHex(socialIpfsUri)

      console.log(`[BotVerifierService] Predicate: ${predicateName}`)

      // Step 4: Calculate atom IDs
      const [walletAtomId, predicateAtomId, socialAtomId] = await Promise.all([
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'calculateAtomId',
          args: [walletAtomData],
        }) as Promise<`0x${string}`>,
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'calculateAtomId',
          args: [predicateDataHex],
        }) as Promise<`0x${string}`>,
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'calculateAtomId',
          args: [socialAtomDataHex],
        }) as Promise<`0x${string}`>,
      ])

      console.log(`[BotVerifierService] Wallet atom ID: ${walletAtomId}`)
      console.log(`[BotVerifierService] Predicate atom ID: ${predicateAtomId}`)
      console.log(`[BotVerifierService] Social atom ID: ${socialAtomId}`)

      // Step 5: Check which atoms exist
      const [walletAtomExists, predicateAtomExists, socialAtomExists] = await Promise.all([
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'isTermCreated',
          args: [walletAtomId],
        }) as Promise<boolean>,
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'isTermCreated',
          args: [predicateAtomId],
        }) as Promise<boolean>,
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'isTermCreated',
          args: [socialAtomId],
        }) as Promise<boolean>,
      ])

      console.log(`[BotVerifierService] Wallet atom exists: ${walletAtomExists}`)
      console.log(`[BotVerifierService] Predicate atom exists: ${predicateAtomExists}`)
      console.log(`[BotVerifierService] Social atom exists: ${socialAtomExists}`)

      // Get costs from contract
      const [atomCost, tripleCost] = await Promise.all([
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'getAtomCost',
        }) as Promise<bigint>,
        this.publicClient.readContract({
          address: this.config.chainConfig.multivaultAddress,
          abi: MultiVaultAbi,
          functionName: 'getTripleCost',
        }) as Promise<bigint>,
      ])

      let walletAtomCreated = false
      let predicateAtomCreated = false
      let socialAtomCreated = false

      // Step 6: Create wallet atom if needed
      if (!walletAtomExists) {
        console.log('[BotVerifierService] Creating wallet atom...')
        await this.createAtomWithData(walletAtomData, atomCost)
        walletAtomCreated = true
      }

      // Step 7: Create predicate atom if needed
      if (!predicateAtomExists) {
        console.log(`[BotVerifierService] Creating predicate atom: ${predicateName}`)
        await this.createAtomWithData(predicateDataHex, atomCost)
        predicateAtomCreated = true
      }

      // Step 8: Create social atom if needed
      if (!socialAtomExists) {
        console.log(`[BotVerifierService] Creating social atom: ${userId}`)
        await this.createAtomWithData(socialAtomDataHex, atomCost)
        socialAtomCreated = true
      }

      // Step 9: Create the triple
      console.log(`[BotVerifierService] Creating triple: [${walletAddress}] [${predicateName}] [${userId}]`)

      const tripleDepositAmount = tripleCost + BOT_DEPOSIT_CONFIG.TRIPLE_EXTRA

      const tripleCallData = encodeFunctionData({
        abi: MultiVaultAbi,
        functionName: 'createTriples',
        args: [
          [walletAtomId],
          [predicateAtomId],
          [socialAtomId],
          [tripleDepositAmount],
        ],
      })

      const txHash = await this.walletClient.sendTransaction({
        to: this.config.chainConfig.multivaultAddress,
        data: tripleCallData,
        value: tripleDepositAmount,
        gas: GAS_LIMITS.TRIPLE_CREATION,
      })

      console.log(`[BotVerifierService] Triple TX: ${txHash}`)
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })

      if (receipt.status !== 'success') {
        return {
          success: false,
          platform,
          userId,
          username,
          walletAtomCreated,
          predicateAtomCreated,
          socialAtomCreated,
          error: `Triple creation failed. TX: ${txHash}`,
        }
      }

      console.log(`[BotVerifierService] Triple created in block ${receipt.blockNumber}`)

      return {
        success: true,
        platform,
        userId,
        username,
        txHash,
        walletAtomCreated,
        predicateAtomCreated,
        socialAtomCreated,
      }
    } catch (error) {
      console.error('[BotVerifierService] Link error:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if atom already exists (account already linked)
      if (errorMessage.includes('AtomExists') || errorMessage.includes('Atom exists')) {
        return {
          success: false,
          error: `This ${platform} account is already linked to another wallet`,
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Create a single atom with given data
   */
  private async createAtomWithData(atomDataHex: `0x${string}`, atomCost: bigint): Promise<string> {
    const atomTotalValue = atomCost + BOT_DEPOSIT_CONFIG.ATOM_DEPOSIT

    const atomCallData = encodeFunctionData({
      abi: MultiVaultAbi,
      functionName: 'createAtoms',
      args: [[atomDataHex], [atomTotalValue]],
    })

    const txHash = await this.walletClient.sendTransaction({
      to: this.config.chainConfig.multivaultAddress,
      data: atomCallData,
      value: atomTotalValue,
      gas: GAS_LIMITS.ATOM_CREATION,
    })

    console.log(`[BotVerifierService] Atom TX: ${txHash}`)
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    if (receipt.status !== 'success') {
      throw new Error(`Atom creation failed: ${txHash}`)
    }

    console.log(`[BotVerifierService] Atom created in block ${receipt.blockNumber}`)
    return txHash
  }

  /**
   * Check if a user has a linked social account for a specific platform
   */
  async hasSocialLink(platform: SocialPlatform, walletAddress: string): Promise<boolean> {
    // This would require querying the GraphQL endpoint to check for triples
    // For now, return false (can be implemented based on your needs)
    console.log(`[BotVerifierService] Checking ${platform} link for ${walletAddress}`)
    return false
  }
}

// Backwards compatibility exports
export type BotAttestorConfig = BotVerifierConfig
export type BotAttestationRequest = BotVerificationRequest
export type BotAttestationResult = BotVerificationResult
export const BotAttestorService = BotVerifierService
