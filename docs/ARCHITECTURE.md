# Architecture

This document explains the technical architecture of the Sofia Verifier Template.

## Overview

The verifier system consists of two main components:

1. **Mastra Backend** - Server-side workflow that verifies OAuth tokens and creates on-chain triples
2. **Verifier SDK** - Client library for frontend integration (optional)

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Mastra    │────▶│    IPFS     │────▶│  Intuition  │
│   (OAuth)   │     │  Workflow   │     │   Pinning   │     │  MultiVault │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      │ 1. OAuth token    │ 2. Verify token   │ 3. Pin userId     │ 4. Create
      │    + wallet       │    via API        │    to IPFS        │    triple
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
   User auth          Extract userId      Get IPFS URI        On-chain
   with Discord       from response       for label           attestation
```

## Triple Structure

Each verification creates an Intuition triple:

```
Subject:   [Wallet Address]
Predicate: [has verified {platform} id]
Object:    [Social User ID]
```

### Atom Creation

The workflow creates up to 3 atoms if they don't exist:

1. **Wallet Atom**
   - Data: Wallet address as lowercase hex bytes
   - Example: `0x1234...abcd`

2. **Predicate Atom**
   - Data: String like "has verified discord id"
   - Created once per platform, reused for all users

3. **Social Atom**
   - Data: IPFS URI from pinning
   - The `name` field in IPFS metadata becomes the visible label
   - This ensures the atom shows the userId, not "json object"

### IPFS Pinning

Social atoms use IPFS pinning to ensure correct labels:

```typescript
// Pin to IPFS with userId as the name
const mutation = `
  mutation PinThing($thing: PinThingInput!) {
    pinThing(thing: $thing) {
      uri
    }
  }
`;

const variables = {
  thing: {
    name: userId,           // This becomes the visible label
    description: "Verified discord account ID",
    image: "",
    url: ""
  }
};
```

The returned IPFS URI (e.g., `ipfs://Qm...`) is used as the atom data.

## Bot-Pays Model

Unlike traditional attestation systems where users sign transactions:

1. User provides OAuth token + wallet address
2. Bot wallet verifies and creates the triple
3. Bot pays all gas fees
4. User's wallet is recorded but never signs

This improves UX by removing wallet signature requirements.

## Deposit Amounts

Each atom and triple requires a deposit:

```typescript
const ATOM_DEPOSIT = 500000000000000000n  // 0.5 TRUST
const TRIPLE_EXTRA = 500000000000000000n  // 0.5 TRUST additional
```

For a new verification with all new atoms:
- Wallet atom: 0.5 TRUST
- Predicate atom: 0.5 TRUST (or 0 if exists)
- Social atom: 0.5 TRUST
- Triple creation: 0.5 TRUST extra
- **Total**: Up to 2 TRUST per verification

## Network Configuration

The workflow supports both testnet and mainnet via environment variable:

```typescript
const isTestnet = process.env.NETWORK === 'testnet'

// Testnet
Chain ID: 13579
RPC: https://testnet.rpc.intuition.systems
MultiVault: 0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91
GraphQL: https://testnet.intuition.sh/v1/graphql

// Mainnet
Chain ID: 1155
RPC: https://rpc.intuition.systems
MultiVault: 0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e
GraphQL: https://mainnet.intuition.sh/v1/graphql
```

## Security Considerations

### TEE Deployment

The Mastra backend should be deployed in a Trusted Execution Environment (TEE) like Phala Network:

- OAuth tokens are sensitive and should not be exposed
- Bot private key must be protected
- TEE provides hardware-level isolation

### Token Validation

Each platform's OAuth token is validated against its official API:

```typescript
// Discord example
const response = await fetch('https://discord.com/api/users/@me', {
  headers: { Authorization: `Bearer ${token}` }
})
```

Invalid or expired tokens are rejected before any on-chain action.

## Verifier SDK (Optional)

The `verifier-core` package provides:

### BotVerifierService

A service class for calling the Mastra workflow:

```typescript
import { BotVerifierService } from '@sofia/verifier-core'

const service = new BotVerifierService({
  apiEndpoint: 'https://your-mastra-server.com'
})

const result = await service.createVerification({
  walletAddress: '0x...',
  platform: 'discord',
  oauthToken: 'token...'
})
```

### useVerification Hook (React)

A React hook for frontend integration:

```typescript
import { useVerification } from '@sofia/verifier-core/react'

function VerifyButton() {
  const { isVerifying, createVerification } = useVerification({
    apiEndpoint: 'https://your-mastra-server.com'
  })

  return (
    <button
      onClick={() => createVerification({
        walletAddress: '0x...',
        platform: 'discord',
        oauthToken: 'token...'
      })}
      disabled={isVerifying}
    >
      {isVerifying ? 'Verifying...' : 'Verify Discord'}
    </button>
  )
}
```

## Error Handling

The workflow returns structured errors:

```typescript
// Success
{
  success: true,
  platform: "discord",
  userId: "123456789",
  txHash: "0x...",
  explorerUrl: "https://explorer.intuition.systems/triple/42"
}

// OAuth failure
{
  success: false,
  platform: "discord",
  error: "OAuth verification failed: Invalid token"
}

// Transaction failure
{
  success: false,
  platform: "discord",
  userId: "123456789",
  error: "Transaction failed: insufficient funds"
}
```
