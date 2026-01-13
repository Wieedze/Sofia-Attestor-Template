# Sofia Attestor Template

Build your own on-chain attestation system on Sofia/Intuition.

## What is an Attestor?

An **attestor** verifies off-chain data and creates on-chain attestations (triples) on the Intuition protocol.

**Example**: "Proof of Human" attestor verifies OAuth tokens from 5 platforms, then creates a triple:
```
[user_wallet] [is_human] [verified]
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                          │
│         (React App, Chrome Extension, Mobile, etc.)          │
│                                                              │
│  ┌─────────────────┐                                        │
│  │  attestor-sdk   │ ─── Handles blockchain + verification   │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐     ┌─────────────────┐                │
│  │ Verify via API  │────▶│  Mastra Backend │                │
│  └────────┬────────┘     │  (Workflow)     │                │
│           │              └─────────────────┘                │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │ User signs TX   │ ─── Creates triple on-chain            │
│  └────────┬────────┘                                        │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                      BLOCKCHAIN                              │
│  ┌─────────────────┐     ┌─────────────────┐                │
│  │ Sofia Fee Proxy │────▶│   MultiVault    │                │
│  │ (fee handling)  │     │ (atom/triple)   │                │
│  └─────────────────┘     └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
sofia-attestor-template/
├── packages/
│   ├── attestor-sdk/           # Core SDK (framework-agnostic)
│   │   ├── src/
│   │   │   ├── hooks/          # React hooks (optional)
│   │   │   ├── services/       # Blockchain service
│   │   │   ├── config/         # Chain configuration
│   │   │   └── abi/            # Contract ABIs
│   │   └── package.json
│   │
│   └── example-app/            # Example React app
│       └── ...
│
├── mastra/                     # Backend Workflow
│   └── src/
│       └── workflows/
│           └── attestor.ts     # Verification logic
│
└── docs/                       # Documentation
```

## Quick Start

### 1. Clone this template

```bash
git clone https://github.com/YOUR_USERNAME/sofia-attestor-template.git
cd sofia-attestor-template
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure your attestor

1. **Define your verification logic** in `mastra/src/workflows/attestor.ts`
2. **Update term IDs** in `packages/attestor-sdk/src/config/constants.ts`
3. **Configure environment** - copy `.env.example` to `.env` and fill in values

### 4. Run locally

```bash
# Terminal 1: Start Mastra backend
cd mastra
pnpm dev

# Terminal 2: Start example app
cd packages/example-app
pnpm dev
```

## SDK Usage

### Installation

```bash
pnpm add @sofia/attestor-sdk viem
```

### Basic Usage (Vanilla JS/TS)

```typescript
import { AttestorService, ChainConfig } from '@sofia/attestor-sdk'

// Initialize
const attestor = new AttestorService({
  mastraUrl: 'http://localhost:4111',
  workflowId: 'my-attestor-workflow',
  predicateId: '0x...', // Your predicate term ID
  objectId: '0x...',    // Your object term ID
  chainConfig: ChainConfig.testnet,
})

// Create attestation
const result = await attestor.createAttestation({
  walletAddress: '0x...',
  verificationData: {
    // Your custom data for verification
  },
})

if (result.success) {
  console.log('Attestation created:', result.txHash)
}
```

### React Hook Usage

```tsx
import { useAttestation } from '@sofia/attestor-sdk/react'

function MyComponent() {
  const {
    isAttested,
    canAttest,
    isAttesting,
    createAttestation,
  } = useAttestation({
    mastraUrl: 'http://localhost:4111',
    workflowId: 'my-attestor-workflow',
    predicateId: '0x...',
    objectId: '0x...',
  })

  return (
    <button
      onClick={createAttestation}
      disabled={!canAttest || isAttesting}
    >
      {isAttesting ? 'Creating...' : 'Create Attestation'}
    </button>
  )
}
```

## Customization Guide

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for a step-by-step guide.

### Key files to customize:

| File | Purpose |
|------|---------|
| `mastra/src/workflows/attestor.ts` | Your verification logic |
| `packages/attestor-sdk/src/config/constants.ts` | Your term IDs |
| `.env` | API keys, contract addresses |

## Deployment

### Mastra Backend

Deploy to any Node.js hosting:
- **Phala Network** (TEE) - see `mastra/Dockerfile`
- **Vercel**, **Railway**, **Fly.io**, etc.

### SDK

Publish to npm or use locally in your app.

## Requirements

- Node.js 18+
- pnpm
- Wallet (MetaMask, WalletConnect, etc.)
- ETH on Base Sepolia (testnet) or Base Mainnet

## Resources

- [Intuition Protocol Docs](https://docs.intuition.systems/)
- [Mastra Docs](https://mastra.ai/docs)
- [Viem Docs](https://viem.sh/)

## License

MIT
