/**
 * Verifier Workflow
 *
 * Links a social account to a wallet by creating a triple on-chain:
 * [wallet] [has verified {platform} id] [userId]
 *
 * ============================================================
 * HOW IT WORKS:
 * 1. Frontend sends OAuth token + wallet address + platform
 * 2. This workflow verifies the token and extracts userId
 * 3. Creates atoms (wallet, predicate, social) if needed
 * 4. Creates the triple on-chain
 * 5. Returns txHash on success
 *
 * IPFS Pinning:
 * - Social atom uses IPFS pinning 
 * ============================================================
 */

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { createPublicClient, createWalletClient, http, stringToHex, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'

// ============================================================
// Chain Configuration (supports NETWORK=testnet or NETWORK=mainnet)
// ============================================================

const isTestnet = process.env.NETWORK === 'testnet'

const intuitionMainnet = defineChain({
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

const intuitionTestnet = defineChain({
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

// Select chain based on NETWORK env var
const SELECTED_CHAIN = isTestnet ? intuitionTestnet : intuitionMainnet
const RPC_URL = isTestnet
  ? 'https://testnet.rpc.intuition.systems'
  : 'https://rpc.intuition.systems'
const MULTIVAULT_ADDRESS = isTestnet
  ? '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91' as const  // Testnet
  : '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e' as const  // Mainnet
const INTUITION_GRAPHQL_ENDPOINT = isTestnet
  ? 'https://testnet.intuition.sh/v1/graphql'
  : 'https://mainnet.intuition.sh/v1/graphql'
const EXPLORER_URL = isTestnet
  ? 'https://testnet.explorer.intuition.systems'
  : 'https://explorer.intuition.systems'

// ============================================================
// MultiVault ABI (minimal)
// ============================================================

const MultiVaultAbi = [
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'calculateAtomId',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'isTermCreated',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAtomCost',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTripleCost',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'atomsData', type: 'bytes[]' },
      { name: 'assets', type: 'uint256[]' },
    ],
    name: 'createAtoms',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'subjectIds', type: 'bytes32[]' },
      { name: 'predicateIds', type: 'bytes32[]' },
      { name: 'objectIds', type: 'bytes32[]' },
      { name: 'assets', type: 'uint256[]' },
    ],
    name: 'createTriples',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

// ============================================================
// Predicate names for each platform
// ============================================================

type Platform = 'discord' | 'youtube' | 'spotify' | 'twitch' | 'twitter'

const PREDICATE_NAMES: Record<Platform, string> = {
  discord: 'has verified discord id',
  youtube: 'has verified youtube id',
  spotify: 'has verified spotify id',
  twitch: 'has verified twitch id',
  twitter: 'has verified twitter id',
}

// ============================================================
// IPFS Pinning
// ============================================================

/**
 * Pin data to IPFS via Intuition's pinThing mutation
 * Returns the IPFS URI that will be used as the atom data
 * The `name` parameter becomes the atom's label on-chain
 */
async function pinToIPFS(name: string, description: string): Promise<string> {
  const mutation = `
    mutation PinThing($thing: PinThingInput!) {
      pinThing(thing: $thing) {
        uri
      }
    }
  `

  const response = await fetch(INTUITION_GRAPHQL_ENDPOINT, {
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
// OAuth Verification
// ============================================================

interface OAuthVerificationResult {
  valid: boolean
  userId?: string
  username?: string
  error?: string
}

const OAUTH_ENDPOINTS = {
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

async function verifyAndGetUserId(
  platform: Platform,
  token: string,
  clientId?: string
): Promise<OAuthVerificationResult> {
  const endpoint = OAUTH_ENDPOINTS[platform]

  try {
    const headers: Record<string, string> = {
      Authorization: endpoint.authHeader(token),
    }

    if (platform === 'twitch') {
      const twitchClientId = clientId || process.env.TWITCH_CLIENT_ID
      if (!twitchClientId) {
        return { valid: false, error: 'Twitch Client ID required' }
      }
      headers['Client-Id'] = twitchClientId
    }

    const response = await fetch(endpoint.url, { headers })

    if (!response.ok) {
      return { valid: false, error: `API returned ${response.status}` }
    }

    const data = await response.json()

    console.log(`[VerifierWorkflow] ${platform} API response:`, JSON.stringify(data).substring(0, 500))

    // Extract userId based on platform
    let userId: string | undefined
    let username: string | undefined

    switch (platform) {
      case 'discord':
        userId = data.id ? String(data.id) : undefined
        username = data.username ? String(data.username) : undefined
        break
      case 'youtube':
        userId = data.items?.[0]?.id ? String(data.items[0].id) : undefined
        username = data.items?.[0]?.snippet?.title ? String(data.items[0].snippet.title) : undefined
        break
      case 'spotify':
        userId = data.id ? String(data.id) : undefined
        username = data.display_name ? String(data.display_name) : undefined
        break
      case 'twitch':
        userId = data.data?.[0]?.id ? String(data.data[0].id) : undefined
        username = data.data?.[0]?.login ? String(data.data[0].login) : undefined
        break
      case 'twitter':
        userId = data.data?.id ? String(data.data.id) : undefined
        username = data.data?.username ? String(data.data.username) : undefined
        break
    }

    console.log(`[VerifierWorkflow] ${platform} extracted userId: ${userId}, username: ${username}`)

    if (!userId) {
      return { valid: false, error: `Could not extract user ID from ${platform} response` }
    }

    return { valid: true, userId, username }
  } catch (error) {
    console.error(`[VerifierWorkflow] ${platform}: Verification failed:`, error)
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ============================================================
// Schemas
// ============================================================

const inputSchema = z.object({
  walletAddress: z.string().describe('User wallet address'),
  platform: z.enum(['discord', 'youtube', 'spotify', 'twitch', 'twitter']).describe('Social platform'),
  oauthToken: z.string().describe('OAuth access token'),
})

const outputSchema = z.object({
  success: z.boolean(),
  platform: z.string().optional(),
  userId: z.string().optional(),
  username: z.string().optional(),
  txHash: z.string().optional(),
  blockNumber: z.number().optional(),
  walletAtomCreated: z.boolean().optional(),
  predicateAtomCreated: z.boolean().optional(),
  socialAtomCreated: z.boolean().optional(),
  error: z.string().optional(),
})

// ============================================================
// Workflow Step
// ============================================================

const executeLinkSocial = createStep({
  id: 'execute-link-social',
  description: 'Verify OAuth token and link social account to wallet on-chain',
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    if (!inputData?.walletAddress) {
      return { success: false, error: 'walletAddress is required' }
    }
    if (!inputData?.platform) {
      return { success: false, error: 'platform is required' }
    }
    if (!inputData?.oauthToken) {
      return { success: false, error: 'oauthToken is required' }
    }

    const { walletAddress, platform, oauthToken } = inputData

    console.log(`[VerifierWorkflow] Starting for ${walletAddress} on ${platform}`)
    console.log(`[VerifierWorkflow] Network: ${isTestnet ? 'TESTNET' : 'MAINNET'} (Chain ID: ${SELECTED_CHAIN.id})`)

    // Step 1: Verify OAuth token and get userId
    const verification = await verifyAndGetUserId(platform, oauthToken)

    if (!verification.valid || !verification.userId) {
      return {
        success: false,
        platform,
        error: verification.error || 'OAuth verification failed',
      }
    }

    console.log(`[VerifierWorkflow] Verified ${platform} user: ${verification.userId} (${verification.username})`)

    // Check for BOT_PRIVATE_KEY
    const botPrivateKey = process.env.BOT_PRIVATE_KEY
    if (!botPrivateKey) {
      return {
        success: false,
        platform,
        userId: verification.userId,
        username: verification.username,
        error: 'BOT_PRIVATE_KEY not configured on server',
      }
    }

    try {
      // Create viem clients
      const account = privateKeyToAccount(botPrivateKey as `0x${string}`)
      const publicClient = createPublicClient({
        chain: SELECTED_CHAIN,
        transport: http(RPC_URL),
      })
      const walletClient = createWalletClient({
        account,
        chain: SELECTED_CHAIN,
        transport: http(RPC_URL),
      })

      console.log(`[VerifierWorkflow] Bot address: ${account.address}`)

      // Step 2: Pin social atom to IPFS (name=userId for correct label)
      const userId = verification.userId
      const socialDescription = `Verified ${platform} account ID`

      console.log(`[VerifierWorkflow] Pinning social atom to IPFS: name=${userId}`)
      const socialIpfsUri = await pinToIPFS(userId, socialDescription)
      console.log(`[VerifierWorkflow] Social atom IPFS URI: ${socialIpfsUri}`)

      const socialAtomDataHex = stringToHex(socialIpfsUri)

      // Predicate atom = "has verified {platform} id"
      const predicateName = PREDICATE_NAMES[platform]
      const predicateDataHex = stringToHex(predicateName)

      console.log(`[VerifierWorkflow] Predicate: ${predicateName}`)

      // Calculate atom IDs
      const walletAtomData = stringToHex(walletAddress)
      const [walletAtomId, socialAtomId, predicateAtomId] = await Promise.all([
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'calculateAtomId',
          args: [walletAtomData],
        }),
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'calculateAtomId',
          args: [socialAtomDataHex],
        }),
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'calculateAtomId',
          args: [predicateDataHex],
        }),
      ])

      console.log(`[VerifierWorkflow] Wallet atom ID: ${walletAtomId}`)
      console.log(`[VerifierWorkflow] Social atom ID: ${socialAtomId}`)
      console.log(`[VerifierWorkflow] Predicate atom ID: ${predicateAtomId}`)

      // Check if atoms exist
      const [walletAtomExists, socialAtomExists, predicateAtomExists] = await Promise.all([
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'isTermCreated',
          args: [walletAtomId],
        }),
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'isTermCreated',
          args: [socialAtomId],
        }),
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'isTermCreated',
          args: [predicateAtomId],
        }),
      ])

      console.log(`[VerifierWorkflow] Wallet atom exists: ${walletAtomExists}`)
      console.log(`[VerifierWorkflow] Social atom exists: ${socialAtomExists}`)
      console.log(`[VerifierWorkflow] Predicate atom exists: ${predicateAtomExists}`)

      // Get costs from contract
      const [atomCost, tripleCost] = await Promise.all([
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'getAtomCost',
        }) as Promise<bigint>,
        publicClient.readContract({
          address: MULTIVAULT_ADDRESS,
          abi: MultiVaultAbi,
          functionName: 'getTripleCost',
        }) as Promise<bigint>,
      ])

      console.log(`[VerifierWorkflow] atomCost: ${atomCost}, tripleCost: ${tripleCost}`)

      // Deposit amounts
      const atomDeposit = 500000000000000000n // 0.5 TRUST
      const tripleExtraDeposit = 500000000000000000n // 0.5 TRUST extra

      let walletAtomCreated = false
      let socialAtomCreated = false
      let predicateAtomCreated = false

      // Step 3: Create wallet atom if needed
      if (!walletAtomExists) {
        console.log(`[VerifierWorkflow] Creating wallet atom...`)

        const atomTotalValue = atomCost + atomDeposit

        const atomCallData = encodeFunctionData({
          abi: MultiVaultAbi,
          functionName: 'createAtoms',
          args: [[walletAtomData], [atomTotalValue]],
        })

        const createAtomHash = await walletClient.sendTransaction({
          to: MULTIVAULT_ADDRESS,
          data: atomCallData,
          value: atomTotalValue,
          gas: 500000n,
        })

        console.log(`[VerifierWorkflow] Wallet atom TX: ${createAtomHash}`)
        const atomReceipt = await publicClient.waitForTransactionReceipt({ hash: createAtomHash })

        if (atomReceipt.status !== 'success') {
          return {
            success: false,
            platform,
            userId: verification.userId,
            username: verification.username,
            error: `Wallet atom creation failed. TX: ${createAtomHash}`,
          }
        }

        console.log(`[VerifierWorkflow] Wallet atom created in block ${atomReceipt.blockNumber}`)
        walletAtomCreated = true
      }

      // Step 4: Create predicate atom if needed
      if (!predicateAtomExists) {
        console.log(`[VerifierWorkflow] Creating predicate atom: ${predicateName}`)

        const predicateAtomTotalValue = atomCost + atomDeposit

        const predicateAtomCallData = encodeFunctionData({
          abi: MultiVaultAbi,
          functionName: 'createAtoms',
          args: [[predicateDataHex], [predicateAtomTotalValue]],
        })

        const createPredicateHash = await walletClient.sendTransaction({
          to: MULTIVAULT_ADDRESS,
          data: predicateAtomCallData,
          value: predicateAtomTotalValue,
          gas: 500000n,
        })

        console.log(`[VerifierWorkflow] Predicate atom TX: ${createPredicateHash}`)
        const predicateReceipt = await publicClient.waitForTransactionReceipt({ hash: createPredicateHash })

        if (predicateReceipt.status !== 'success') {
          return {
            success: false,
            platform,
            userId: verification.userId,
            username: verification.username,
            walletAtomCreated,
            error: `Predicate atom creation failed. TX: ${createPredicateHash}`,
          }
        }

        console.log(`[VerifierWorkflow] Predicate atom created in block ${predicateReceipt.blockNumber}`)
        predicateAtomCreated = true
      }

      // Step 5: Create social atom if needed
      if (!socialAtomExists) {
        console.log(`[VerifierWorkflow] Creating social atom: ${userId} (IPFS: ${socialIpfsUri})`)

        const socialAtomTotalValue = atomCost + atomDeposit

        const socialAtomCallData = encodeFunctionData({
          abi: MultiVaultAbi,
          functionName: 'createAtoms',
          args: [[socialAtomDataHex], [socialAtomTotalValue]],
        })

        const createSocialAtomHash = await walletClient.sendTransaction({
          to: MULTIVAULT_ADDRESS,
          data: socialAtomCallData,
          value: socialAtomTotalValue,
          gas: 500000n,
        })

        console.log(`[VerifierWorkflow] Social atom TX: ${createSocialAtomHash}`)
        const socialAtomReceipt = await publicClient.waitForTransactionReceipt({ hash: createSocialAtomHash })

        if (socialAtomReceipt.status !== 'success') {
          return {
            success: false,
            platform,
            userId: verification.userId,
            username: verification.username,
            walletAtomCreated,
            predicateAtomCreated,
            error: `Social atom creation failed. TX: ${createSocialAtomHash}`,
          }
        }

        console.log(`[VerifierWorkflow] Social atom created in block ${socialAtomReceipt.blockNumber}`)
        socialAtomCreated = true
      }

      // Step 6: Create triple [wallet] [has verified {platform} id] [userId]
      console.log(`[VerifierWorkflow] Creating triple: [${walletAddress}] [${predicateName}] [${userId}]`)

      const tripleDepositAmount = tripleCost + tripleExtraDeposit

      const tripleCallData = encodeFunctionData({
        abi: MultiVaultAbi,
        functionName: 'createTriples',
        args: [
          [walletAtomId as `0x${string}`],
          [predicateAtomId as `0x${string}`],
          [socialAtomId as `0x${string}`],
          [tripleDepositAmount],
        ],
      })

      const tripleTxHash = await walletClient.sendTransaction({
        to: MULTIVAULT_ADDRESS,
        data: tripleCallData,
        value: tripleDepositAmount,
        gas: 800000n,
      })

      console.log(`[VerifierWorkflow] Triple TX: ${tripleTxHash}`)
      const tripleReceipt = await publicClient.waitForTransactionReceipt({ hash: tripleTxHash })

      if (tripleReceipt.status !== 'success') {
        return {
          success: false,
          platform,
          userId: verification.userId,
          username: verification.username,
          walletAtomCreated,
          predicateAtomCreated,
          socialAtomCreated,
          error: `Triple creation failed. TX: ${tripleTxHash}`,
        }
      }

      console.log(`[VerifierWorkflow] Triple created in block ${tripleReceipt.blockNumber}`)

      return {
        success: true,
        platform,
        userId: verification.userId,
        username: verification.username,
        txHash: tripleTxHash,
        blockNumber: Number(tripleReceipt.blockNumber),
        walletAtomCreated,
        predicateAtomCreated,
        socialAtomCreated,
      }
    } catch (error) {
      console.error('[VerifierWorkflow] Blockchain error:', error)
      return {
        success: false,
        platform,
        userId: verification.userId,
        username: verification.username,
        error: error instanceof Error ? error.message : 'Blockchain transaction failed',
      }
    }
  },
})

// ============================================================
// Create and export the workflow
// ============================================================

const verifierWorkflow = createWorkflow({
  id: 'verifier-workflow',
  inputSchema,
  outputSchema,
}).then(executeLinkSocial)

verifierWorkflow.commit()

export { verifierWorkflow }

// Backwards compatibility
export const attestorWorkflow = verifierWorkflow
