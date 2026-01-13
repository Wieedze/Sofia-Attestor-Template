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
│                    USER BROWSER EXTENSION                    │
│  ┌─────────────────┐                                        │
│  │ useAttestation  │ ─── Orchestrates the full flow         │
│  └────────┬────────┘                                        │
└───────────┼─────────────────────────────────────────────────┘
            │
            │
 ───────────┼─────────────────────────────────────────────────          ▼                                                  │
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

## Quick Start

### 1. Clone this template

```bash
git clone https://github.com/YOUR_USERNAME/sofia-attestor-template.git
cd sofia-attestor-template
```

### 2. Install dependencies

```bash
# Extension (browser)
cd extension
pnpm install

# Mastra (backend)
cd ../mastra
pnpm install
```

### 3. Configure your attestor

1. **Define your verification logic** in `mastra/src/workflows/attestor.ts`
2. **Update term IDs** in `extension/lib/config/constants.ts`
3. **Configure environment** - copy `.env.example` to `.env` and fill in values

### 4. Run locally

```bash
# Terminal 1: Start Mastra backend
cd mastra
pnpm dev

# Terminal 2: Start extension dev server
cd extension
pnpm dev
```

### 5. Load extension in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `extension/build/chrome-mv3-dev`

## Project Structure

```
sofia-attestor-template/
├── extension/                   # Chrome Extension (Plasmo)
│   ├── hooks/
│   │   └── useAttestation.ts    # Main hook - CUSTOMIZE THIS
│   ├── lib/
│   │   ├── config/
│   │   │   ├── chainConfig.ts   # Network selector
│   │   │   └── constants.ts     # Term IDs - CUSTOMIZE THIS
│   │   ├── services/
│   │   │   └── blockchain.ts    # Blockchain operations
│   │   └── clients/
│   │       └── viem.ts          # Viem + MetaMask setup
│   └── ABI/                     # Contract ABIs
│
├── mastra/                      # Backend Workflow
│   └── src/
│       └── workflows/
│           └── attestor.ts      # Verification logic - CUSTOMIZE THIS
│
└── docs/                        # Documentation
    ├── ARCHITECTURE.md
    └── CUSTOMIZATION.md
```

## Customization Guide

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for a step-by-step guide on creating your own attestor.

### Key files to customize:

| File | Purpose |
|------|---------|
| `mastra/src/workflows/attestor.ts` | Your verification logic (API calls, checks, etc.) |
| `extension/lib/config/constants.ts` | Your predicate and object term IDs |
| `extension/hooks/useAttestation.ts` | Storage keys, UI states, API endpoint |

## Deployment

### Mastra Backend

The Mastra workflow can be deployed to:
- **Phala Network** (TEE environment) - see `mastra/Dockerfile`
- **Any Node.js hosting** (Vercel, Railway, etc.)

### Extension

1. Build: `cd extension && pnpm build`
2. Package: Create a ZIP of `extension/build/chrome-mv3-prod`
3. Submit to Chrome Web Store

## Requirements

- Node.js 18+
- pnpm
- MetaMask wallet
- ETH on Base Sepolia (testnet) or Base Mainnet

## Resources

- [Intuition Protocol Docs](https://docs.intuition.systems/)
- [Sofia Extension](https://github.com/anthropics/sofia-core)
- [Mastra Docs](https://mastra.ai/docs)
- [Plasmo Docs](https://docs.plasmo.com/)

## License

MIT
