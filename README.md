# Sofia Attestor Template

A template for building on-chain attestation systems on the Intuition protocol. This repo enables you to verify off-chain data (OAuth tokens, API credentials, etc.) and create on-chain attestations (triples) when verification passes.

## How it works

1. Your app handles OAuth authentication (Twitter, GitHub, etc.)
2. Send OAuth tokens to the Mastra workflow for verification
3. Workflow validates tokens against provider APIs
4. If verified → creates an on-chain triple: `[user] → [predicate] → [object]`

## Features

- Framework-agnostic core service + React hook
- Direct MultiVault writes or proxy-based (with fee collection)
- Pre-configured for Intuition testnet & mainnet
- Transaction simulation before execution

## Customize

1. Set your `PREDICATE_ID` and `OBJECT_ID` in `constants.ts`
2. Implement OAuth verification logic in `mastra/workflows/attestor.ts`
3. Optionally deploy a fee proxy contract

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR APPLICATION                                │
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────┐                         │
│   │   OAuth Flow     │         │  useAttestation  │                         │
│   │ (Twitter/GitHub) │────────▶│   React Hook     │                         │
│   └──────────────────┘         └────────┬─────────┘                         │
│         User authenticates              │                                    │
│         with providers                  │ tokens + wallet                    │
└─────────────────────────────────────────┼───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TEE (Trusted Execution Environment)                   │
│                           e.g. Phala Network                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         MASTRA BACKEND                                 │  │
│  │                                                                        │  │
│  │   ┌──────────────────┐      ┌──────────────────┐                      │  │
│  │   │  Receive tokens  │─────▶│  Verify via APIs │                      │  │
│  │   │  + wallet addr   │      │  (Twitter, etc.) │                      │  │
│  │   └──────────────────┘      └────────┬─────────┘                      │  │
│  │                                      │                                 │  │
│  │                                      ▼                                 │  │
│  │                           ┌──────────────────┐                        │  │
│  │                           │ canCreateAttest: │                        │  │
│  │                           │   true / false   │                        │  │
│  │                           └──────────────────┘                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          │ verification result
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR APPLICATION                                │
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────┐                         │
│   │ AttestorService  │────────▶│   User signs TX  │                         │
│   │ (if verified)    │         │   via wallet     │                         │
│   └──────────────────┘         └────────┬─────────┘                         │
└─────────────────────────────────────────┼───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTUITION BLOCKCHAIN                                │
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────┐                         │
│   │  Sofia Fee Proxy │────────▶│    MultiVault    │                         │
│   │   (optional)     │         │                  │                         │
│   └──────────────────┘         └────────┬─────────┘                         │
│                                         │                                    │
│                                         ▼                                    │
│                          ┌──────────────────────────┐                       │
│                          │  Triple Created:         │                       │
│                          │  [user] [predicate] [obj]│                       │
│                          └──────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
sofia-attestor-template/
├── attestor-core/                 # Core library
│   ├── src/
│   │   ├── services/
│   │   │   └── AttestorService.ts   # Main service
│   │   ├── hooks/
│   │   │   └── useAttestation.ts    # React hook
│   │   ├── config/
│   │   │   ├── chainConfig.ts       # Network configs
│   │   │   └── constants.ts         # Term IDs (CUSTOMIZE)
│   │   └── abi/                     # Contract ABIs
│   └── package.json
│
├── mastra/                        # Backend (deploy to TEE)
│   └── src/
│       └── workflows/
│           └── attestor.ts        # Verification logic (CUSTOMIZE)
│
└── docs/                          # Documentation
```

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure your attestor

**`attestor-core/src/config/constants.ts`**
```typescript
export const ATTESTOR_CONFIG = {
  PREDICATE_ID: '0x...', // Your predicate atom ID (e.g., "is_human")
  OBJECT_ID: '0x...',    // Your object atom ID (e.g., "verified")
}
```

**`mastra/src/workflows/attestor.ts`**
```typescript
// Implement your OAuth token verification
const verified = await verifyTwitterToken(inputData.tokens.twitter)
```

### 3. Run locally

```bash
# Terminal 1: Start Mastra backend
cd mastra && pnpm dev

# Terminal 2: Use attestor-core in your app
```

## Deployment

### Mastra Backend (TEE)

Deploy to a Trusted Execution Environment for secure token verification:

```bash
cd mastra
docker build -t attestor-backend .
# Deploy to Phala Network or other TEE provider
```

### Core Library

Publish to npm or use locally in your application.

## License

MIT
