# Customization Guide

This guide walks you through creating your own attestor using this template.

## Overview

An attestor has 3 main components to customize:

1. **Mastra Workflow** - Your verification logic (what to verify)
2. **Term IDs** - Your predicate and object atoms (what claim to make)
3. **Chain Config** - Contract addresses and optional proxy

## Step 1: Define Your Attestation

First, decide what claim your attestor will make:

```
[Subject]    [Predicate]    [Object]
[user]       [is_human]     [verified]
[user]       [has_github]   [true]
[user]       [has_influence]   [high]
```

## Step 2: Create Your Atoms on Intuition

Before using the SDK, you need to create your predicate and object atoms on-chain if they don't already exist

### Option A: Use Intuition Portal
1. Go to [portal.intuition.systems](https://portal.intuition.systems)
2. Create your predicate atom (e.g., "is_human")
3. Create your object atom (e.g., "verified")
4. Note the atom IDs

### Option B: Create Atoms Programmatically

You can create atoms directly via the MultiVault contract:

```typescript
import { createPublicClient, createWalletClient, http, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { intuitionTestnet, testnetConfig } from '@sofia/attestor-sdk'

const publicClient = createPublicClient({
  chain: intuitionTestnet,
  transport: http(testnetConfig.rpcUrl),
})

const walletClient = createWalletClient({
  chain: intuitionTestnet,
  transport: http(testnetConfig.rpcUrl),
  account: privateKeyToAccount('0x...'), // Your private key
})

// 1. Get the atom creation cost
const atomCost = await publicClient.readContract({
  address: testnetConfig.multivaultAddress,
  abi: MultiVaultAbi,
  functionName: 'getAtomCost',
})

// 2. Create the atom on-chain
const atomData = stringToHex('is_human') // Your atom label
const txHash = await walletClient.writeContract({
  address: testnetConfig.multivaultAddress,
  abi: MultiVaultAbi,
  functionName: 'createAtom',
  args: [atomData],
  value: atomCost,
})

// 3. Wait for receipt and get the atom ID from events
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
// Parse the AtomCreated event to get the atom ID
```

**Note:** `calculateAtomId()` only computes the hash - it does NOT create the atom. You must call `createAtom()` to actually create it on-chain.

## Step 3: Update Constants

Edit `packages/attestor-sdk/src/config/constants.ts`:

```typescript
export const ATTESTOR_CONFIG = {
  // Your predicate atom ID
  PREDICATE_ID: '0x004614d581d091be4b93f4a56321f00b7e187190011b6683b955dcd43a611248' as `0x${string}`,

  // Your object atom ID
  OBJECT_ID: '0xcdffac0eb431ba084e18d5af7c55b4414c153f5c0df693c2d1454079186f975c' as `0x${string}`,
}
```

## Step 4: Implement Verification Logic

Edit `mastra/src/workflows/attestor.ts`:

### Example: Twitter Followers Verification

```typescript
const inputSchema = z.object({
  walletAddress: z.string(),
  twitterToken: z.string().describe('Twitter OAuth access token'),
})

async function verifyTwitterFollowers(token: string): Promise<{ verified: boolean; followers: number }> {
  const res = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return { verified: false, followers: 0 }

  const data = await res.json()
  const followers = data.data?.public_metrics?.followers_count || 0

  return {
    verified: followers >= 1000, // Require 1000+ followers
    followers,
  }
}

const verifyAttestation = createStep({
  id: 'verify-attestation',
  execute: async ({ inputData }) => {
    const result = await verifyTwitterFollowers(inputData.twitterToken)

    return {
      success: result.verified,
      verified: { twitter: result.verified },
      verifiedCount: result.verified ? 1 : 0,
      canCreateAttestation: result.verified,
      error: result.verified ? undefined : 'Need 1000+ Twitter followers',
    }
  },
})
```

### Example: GitHub Contributions

```typescript
const inputSchema = z.object({
  walletAddress: z.string(),
  githubToken: z.string(),
})

async function verifyGitHubContributions(token: string): Promise<boolean> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return false

  const user = await res.json()
  return user.public_repos >= 5 // Require 5+ public repos
}
```

### Example: Multiple Platforms (like Proof of Human)

```typescript
const inputSchema = z.object({
  walletAddress: z.string(),
  tokens: z.object({
    twitter: z.string().optional(),
    github: z.string().optional(),
    discord: z.string().optional(),
  }),
})

const verifyAttestation = createStep({
  id: 'verify-attestation',
  execute: async ({ inputData }) => {
    const [twitter, github, discord] = await Promise.all([
      inputData.tokens?.twitter ? verifyTwitter(inputData.tokens.twitter) : false,
      inputData.tokens?.github ? verifyGitHub(inputData.tokens.github) : false,
      inputData.tokens?.discord ? verifyDiscord(inputData.tokens.discord) : false,
    ])

    const verified = { twitter, github, discord }
    const verifiedCount = Object.values(verified).filter(Boolean).length
    const requiredCount = 2 // Require at least 2 platforms

    return {
      success: verifiedCount >= requiredCount,
      verified,
      verifiedCount,
      canCreateAttestation: verifiedCount >= requiredCount,
    }
  },
})
```

## Step 5: Configure Chain (Optional Proxy)

### Without Proxy (Direct MultiVault)

By default, the SDK writes directly to the MultiVault contract. This is the simplest setup:

```typescript
// packages/attestor-sdk/src/config/chainConfig.ts
export const mainnetConfig: ChainConfiguration = {
  chain: intuitionMainnet,
  chainId: 1155,
  multivaultAddress: '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e' as `0x${string}`,
  // No proxyAddress = direct writes to MultiVault (no platform fees)
  rpcUrl: 'https://rpc.intuition.systems',
  explorerUrl: 'https://explorer.intuition.systems',
  graphqlEndpoint: 'https://mainnet.intuition.sh/v1/graphql',
}
```

### With Proxy (Fee Collection)

If you want to collect platform fees, deploy your own proxy contract and configure it:

```typescript
export const mainnetConfig: ChainConfiguration = {
  chain: intuitionMainnet,
  chainId: 1155,
  multivaultAddress: '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e' as `0x${string}`,
  proxyAddress: '0xYourProxyAddress' as `0x${string}`, // Your deployed proxy
  rpcUrl: 'https://rpc.intuition.systems',
  explorerUrl: 'https://explorer.intuition.systems',
  graphqlEndpoint: 'https://mainnet.intuition.sh/v1/graphql',
}
```

See the [Sofia Fee Proxy Template](https://github.com/0xIntuition/sofia-fee-proxy) for proxy deployment instructions.

## Step 6: Use in Your App

### Vanilla TypeScript

```typescript
import { AttestorService, ChainConfig } from '@sofia/attestor-sdk'

const attestor = new AttestorService({
  mastraUrl: 'https://your-api.com',
  workflowId: 'attestor-workflow',
  predicateId: '0x...', // Your predicate
  objectId: '0x...',    // Your object
  chainConfig: ChainConfig.mainnet,
})

// Create attestation
const result = await attestor.createAttestation({
  walletAddress: '0x...',
  verificationData: {
    tokens: { twitter: '...' },
  },
})
```

### React

```tsx
import { useAttestation } from '@sofia/attestor-sdk/react'
import { ChainConfig } from '@sofia/attestor-sdk'

function AttestButton() {
  const { isAttested, isAttesting, createAttestation } = useAttestation({
    mastraUrl: 'https://your-api.com',
    workflowId: 'attestor-workflow',
    predicateId: '0x...',
    objectId: '0x...',
    chainConfig: ChainConfig.mainnet,
    walletAddress: '0x...', // From your wallet provider
  })

  if (isAttested) return <div>Verified!</div>

  return (
    <button onClick={() => createAttestation({ tokens: { twitter: '...' } })}>
      {isAttesting ? 'Verifying...' : 'Verify'}
    </button>
  )
}
```

## Step 7: Deploy

### Mastra Backend

```bash
cd mastra
docker build -t my-attestor .
docker push my-attestor

# Deploy to your hosting (Phala, Railway, etc.)
```

### Frontend

Build and deploy your app as usual.

## Troubleshooting

### "Verification failed"
- Check your Mastra workflow logs
- Ensure tokens are valid and not expired

### "Proxy approval failed"
- Only needed if using a proxy
- User must approve the proxy on MultiVault first

### "Transaction reverted"
- Check if atoms exist on-chain
- Verify you have enough ETH for gas + deposit
- Check the simulation error for details

## Examples

See the `examples/` directory for complete implementations:
- `proof-of-human/` - Multi-platform OAuth verification
- `proof-of-builder/` - GitHub contributions verification
