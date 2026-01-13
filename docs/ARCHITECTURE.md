# Architecture

## Overview

The Sofia Attestor Template provides a framework for building on-chain attestation systems on the Intuition protocol.

## Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         YOUR APPLICATION                                │
│                  (Web App, Mobile, Extension, etc.)                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      AttestorService / useAttestation            │  │
│  │                                                                  │  │
│  │  1. User initiates attestation                                   │  │
│  │  2. Call Mastra API to verify off-chain data                     │  │
│  │  3. If verified, prompt user to sign transaction                 │  │
│  │  4. Create triple on-chain                                       │  │
│  └────────────────────────────────────────────────────────────────┬─┘  │
│                                                                    │    │
└────────────────────────────────────────────────────────────────────┼────┘
                                                                     │
                    ┌────────────────────────────────────────────────┼────┐
                    │                                                │    │
                    ▼                                                ▼    │
┌─────────────────────────────┐          ┌───────────────────────────────┐
│     MASTRA BACKEND          │          │         BLOCKCHAIN            │
│                             │          │                               │
│  ┌───────────────────────┐  │          │  ┌─────────────────────────┐  │
│  │  attestorWorkflow     │  │          │  │    Sofia Fee Proxy      │  │
│  │                       │  │          │  │                         │  │
│  │  - Verify tokens      │  │          │  │  - Calculate fees       │  │
│  │  - Check APIs         │  │          │  │  - Forward to MultiVault│  │
│  │  - Return result      │  │          │  └───────────┬─────────────┘  │
│  └───────────────────────┘  │          │              │                │
│                             │          │              ▼                │
│  Returns:                   │          │  ┌─────────────────────────┐  │
│  {                          │          │  │      MultiVault         │  │
│    canCreateAttestation,    │          │  │                         │  │
│    verified: {...}          │          │  │  - Create atoms         │  │
│  }                          │          │  │  - Create triples       │  │
│                             │          │  │  - Manage deposits      │  │
└─────────────────────────────┘          │  └─────────────────────────┘  │
                                         │                               │
                                         └───────────────────────────────┘
```

## Components

### 1. AttestorService (SDK)

The core service that orchestrates the attestation flow:

```typescript
const attestor = new AttestorService({
  mastraUrl: 'https://your-api.com',
  workflowId: 'attestor-workflow',
  predicateId: '0x...',
  objectId: '0x...',
  chainConfig: ChainConfig.mainnet,
})
```

**Responsibilities:**
- Call Mastra API for verification
- Check and request proxy approval
- Create user atom if needed
- Create the attestation triple
- Handle errors and retries

### 2. Mastra Workflow (Backend)

The verification logic runs on your backend:

```typescript
const verifyAttestation = createStep({
  id: 'verify-attestation',
  execute: async ({ inputData }) => {
    // Verify OAuth tokens, API keys, etc.
    return { canCreateAttestation: true }
  },
})
```

**Responsibilities:**
- Verify off-chain data (tokens, APIs, etc.)
- Return verification status
- No blockchain interaction (user signs TX)

### 3. Smart Contracts

**Sofia Fee Proxy:**
- Collects platform fees
- Forwards transactions to MultiVault
- User must approve proxy first

**MultiVault:**
- Creates atoms (identities)
- Creates triples (claims)
- Manages share deposits

## Data Flow

### Step 1: User Initiates Attestation

```typescript
const result = await attestor.createAttestation({
  walletAddress: '0x...',
  verificationData: { tokens: { twitter: '...' } },
})
```

### Step 2: Verify via Mastra

```
POST /api/workflows/attestor-workflow/start-async
{
  "inputData": {
    "walletAddress": "0x...",
    "tokens": { "twitter": "..." }
  }
}
```

Response:
```json
{
  "success": true,
  "canCreateAttestation": true,
  "verified": { "twitter": true }
}
```

### Step 3: Request Proxy Approval (if needed)

```solidity
multiVault.approve(proxyAddress, DEPOSIT_TYPE)
```

### Step 4: Create User Atom (if needed)

```solidity
proxy.createAtoms(receiver, [atomData], [deposit], curveId)
```

### Step 5: Create Triple

```solidity
proxy.createTriples(
  receiver,
  [userAtomId],      // Subject: user
  [predicateId],     // Predicate: "is_human", etc.
  [objectId],        // Object: "verified", etc.
  [deposit],
  curveId
)
```

## On-Chain Data Structure

### Atoms

Atoms are identities on the Intuition protocol:
- User atoms (wallet addresses)
- Concept atoms ("is_human", "verified", etc.)

### Triples

Triples are claims in the format:
```
[Subject] [Predicate] [Object]
```

Example:
```
[0x1234...] [is_human] [verified]
```

This creates an on-chain attestation that wallet `0x1234...` is a verified human.

## Fee Structure

### Sofia Fee Proxy
- Base fee: Fixed amount per transaction
- Deposit fee: Percentage of deposit amount

### MultiVault (Intuition)
- Atom creation fee
- Triple creation fee
- Entry/exit fees for deposits

Total cost calculation:
```typescript
const totalCost = multiVaultCost + depositFee + baseFee
```

## Security Considerations

1. **Proxy Approval**: Users must explicitly approve the proxy to deposit on their behalf
2. **Simulation**: All transactions are simulated before execution
3. **Receipt Verification**: TX receipts are checked for success status
4. **Off-chain Verification**: Sensitive data is verified server-side

## Deployment Options

### Mastra Backend
- Phala Network (TEE for sensitive data)
- Vercel/Railway/Fly.io
- Self-hosted Node.js

### Frontend
- Web app (React, Next.js, etc.)
- Chrome extension
- Mobile app (React Native)
