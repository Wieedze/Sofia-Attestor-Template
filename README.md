# Sofia Verifier Template

A template for building on-chain social verification systems on the Intuition protocol. This repo enables you to verify social accounts (Discord, YouTube, Spotify, Twitch, Twitter) via OAuth and create on-chain triples linking wallets to verified social IDs.

## How it works

1. User authenticates with a social platform (Discord, YouTube, etc.)
2. Frontend sends OAuth token + wallet address to the Mastra workflow
3. Workflow verifies the token and extracts the user's social ID
4. If verified → creates on-chain triple: `[wallet] → [has verified {platform} id] → [userId]`
5. Bot wallet pays all transaction fees (user doesn't need to sign)

## Features

- **Bot-pays model**: Users don't need to sign transactions or pay gas
- **IPFS pinning**: Social IDs are pinned to IPFS for correct atom labels
- **5 platforms supported**: Discord, YouTube, Spotify, Twitch, Twitter
- **Testnet & mainnet**: Environment variable to switch networks
- **Framework-agnostic**: Core SDK + React hooks available

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create `.env` in the `mastra/` directory:

```bash
# Network: "testnet" or "mainnet"
NETWORK=testnet

# Bot wallet private key (this wallet pays for all transactions)
BOT_PRIVATE_KEY=0x...

# Optional: Platform-specific credentials
TWITCH_CLIENT_ID=your_twitch_client_id
```

### 3. Run locally

```bash
cd mastra && pnpm dev
```

### 4. Test the workflow

```bash
curl -X POST http://localhost:4111/api/workflows/verifierWorkflow/start-async \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "walletAddress": "0xYourWalletAddress",
      "platform": "discord",
      "oauthToken": "your_oauth_access_token"
    }
  }'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR APPLICATION                                │
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────┐                         │
│   │   OAuth Flow     │         │  useVerification │                         │
│   │ (Discord/YouTube)│────────▶│   React Hook     │                         │
│   └──────────────────┘         └────────┬─────────┘                         │
│         User authenticates              │                                    │
│         with platform                   │ token + wallet                     │
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
│  │   │  Receive token   │─────▶│  Verify via API  │                      │  │
│  │   │  + wallet addr   │      │  (Discord, etc.) │                      │  │
│  │   └──────────────────┘      └────────┬─────────┘                      │  │
│  │                                      │                                 │  │
│  │                                      ▼                                 │  │
│  │   ┌──────────────────┐      ┌──────────────────┐                      │  │
│  │   │  Pin to IPFS     │─────▶│  Create atoms &  │                      │  │
│  │   │  (userId label)  │      │  triple on-chain │                      │  │
│  │   └──────────────────┘      └────────┬─────────┘                      │  │
│  │                                      │                                 │  │
│  │                           Bot wallet signs & pays                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTUITION BLOCKCHAIN                                │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                           MultiVault                                  │  │
│   │                                                                       │  │
│   │   Triple Created:                                                     │  │
│   │   [0xWallet] [has verified discord id] [userId]                      │  │
│   │                                                                       │  │
│   │   Atoms created (if needed):                                          │  │
│   │   - Wallet atom (address as bytes)                                    │  │
│   │   - Predicate atom ("has verified discord id")                        │  │
│   │   - Social atom (IPFS URI with userId as label)                       │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
sofia-verifier-template/
├── verifier-core/                # SDK/Library for frontend integration
│   ├── src/
│   │   ├── services/
│   │   │   └── BotVerifierService.ts   # Client service
│   │   ├── hooks/
│   │   │   └── useVerification.ts      # React hook
│   │   ├── config/
│   │   │   ├── chainConfig.ts          # Network configs
│   │   │   └── constants.ts            # Predicates & config
│   │   └── index.ts                    # Exports
│   └── package.json
│
├── mastra/                       # Backend server (deploy to TEE)
│   └── src/
│       └── mastra/
│           ├── index.ts              # Mastra entry point
│           └── workflows/
│               └── verifier.ts       # Main verification workflow
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   └── CUSTOMIZATION.md
│
└── README.md
```

## Supported Platforms

| Platform | OAuth Endpoint | User ID Field |
|----------|---------------|---------------|
| Discord | `discord.com/api/users/@me` | `id` |
| YouTube | `youtube.googleapis.com/youtube/v3/channels` | `items[0].id` |
| Spotify | `api.spotify.com/v1/me` | `id` |
| Twitch | `api.twitch.tv/helix/users` | `data[0].id` |
| Twitter | `api.twitter.com/2/users/me` | `data.id` |

## Triple Structure

Each verification creates a triple with this structure:

```
Subject:   Wallet address (as bytes)
Predicate: "has verified {platform} id"
Object:    Social user ID (pinned to IPFS for correct label)
```

Example predicates:
- `has verified discord id`
- `has verified youtube id`
- `has verified spotify id`
- `has verified twitch id`
- `has verified twitter id`

## Customization

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for:
- Adding new platforms
- Changing predicate names
- Modifying deposit amounts
- Custom verification logic

## Deployment

### Mastra Backend (TEE)

Deploy to a Trusted Execution Environment for secure token verification:

```bash
cd mastra
docker build -t verifier-backend .
# Deploy to Phala Network or other TEE provider
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NETWORK` | Yes | `testnet` or `mainnet` |
| `BOT_PRIVATE_KEY` | Yes | Private key for bot wallet |
| `TWITCH_CLIENT_ID` | No | Required for Twitch verification |

## Networks

| Network | Chain ID | RPC | Explorer |
|---------|----------|-----|----------|
| Mainnet | 1155 | `https://rpc.intuition.systems` | `https://explorer.intuition.systems` |
| Testnet | 13579 | `https://testnet.rpc.intuition.systems` | `https://testnet.explorer.intuition.systems` |

## License

MIT
