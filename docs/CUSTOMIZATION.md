# Customization Guide

This guide explains how to customize the Sofia Verifier Template for your specific use case.

## Adding a New Platform

To add support for a new social platform:

### 1. Add Predicate Name

In `mastra/src/mastra/workflows/verifier.ts`, add the predicate:

```typescript
const PREDICATE_NAMES: Record<string, string> = {
  discord: 'has verified discord id',
  youtube: 'has verified youtube id',
  spotify: 'has verified spotify id',
  twitch: 'has verified twitch id',
  twitter: 'has verified twitter id',
  // Add your new platform
  github: 'has verified github id',
}
```

### 2. Add Verification Logic

Add a case in the `verifyAndGetUserId` function:

```typescript
async function verifyAndGetUserId(
  platform: string,
  token: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  switch (platform) {
    // ... existing cases ...

    case 'github':
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        })
        if (!response.ok) {
          return { valid: false, error: 'Invalid GitHub token' }
        }
        const data = await response.json()
        return { valid: true, userId: String(data.id) }
      } catch (error) {
        return { valid: false, error: `GitHub verification failed: ${error}` }
      }

    default:
      return { valid: false, error: `Unsupported platform: ${platform}` }
  }
}
```

### 3. Update Input Schema

Update the Zod schema to accept the new platform:

```typescript
const inputSchema = z.object({
  walletAddress: z.string(),
  platform: z.enum([
    'discord',
    'youtube',
    'spotify',
    'twitch',
    'twitter',
    'github'  // Add here
  ]),
  oauthToken: z.string(),
})
```

## Changing Predicate Names

To use different predicate names:

```typescript
const PREDICATE_NAMES: Record<string, string> = {
  // Change to your preferred format
  discord: 'verified on discord',
  youtube: 'connected youtube account',
  // etc.
}
```

Note: Changing predicates will create new atoms. Existing triples with old predicates remain unchanged.

## Modifying Deposit Amounts

Adjust the deposit constants:

```typescript
// Minimum deposit for creating atoms
const ATOM_DEPOSIT = 500000000000000000n  // 0.5 TRUST

// Additional deposit for triple creation
const TRIPLE_EXTRA = 500000000000000000n  // 0.5 TRUST
```


## Custom IPFS Metadata

Customize the metadata pinned to IPFS:

```typescript
async function pinToIPFS(
  userId: string,
  platform: string
): Promise<string | null> {
  const mutation = `
    mutation PinThing($thing: PinThingInput!) {
      pinThing(thing: $thing) {
        uri
      }
    }
  `

  const response = await fetch(INTUITION_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: mutation,
      variables: {
        thing: {
          // Customize these fields
          name: userId,
          description: `Verified ${platform} account - ${new Date().toISOString()}`,
          image: `https://your-domain.com/icons/${platform}.png`,
          url: `https://${platform}.com/user/${userId}`,
        },
      },
    }),
  })

  const result = await response.json()
  return result.data?.pinThing?.uri || null
}
```

## Using Username Instead of User ID

If you want to store usernames instead of IDs:

Warning: Usernames can change, IDs are permanent. Consider your use case carefully.

```typescript
case 'discord':
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()

  // Use username instead of ID
  return {
    valid: true,
    userId: `${data.username}#${data.discriminator}`
  }
```

Warning: Usernames can change, IDs are permanent. Consider your use case carefully.

## Custom Verification Logic

Add additional verification requirements:

```typescript
async function verifyAndGetUserId(
  platform: string,
  token: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  // Example: Require minimum account age
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()

  // Check account creation date
  const createdAt = new Date(
    Number(BigInt(data.id) >> 22n) + 1420070400000
  )
  const accountAge = Date.now() - createdAt.getTime()
  const minAge = 30 * 24 * 60 * 60 * 1000 // 30 days

  if (accountAge < minAge) {
    return {
      valid: false,
      error: 'Account must be at least 30 days old'
    }
  }

  return { valid: true, userId: data.id }
}
```


## Custom Response Format

Modify the output schema and response:

```typescript
const outputSchema = z.object({
  success: z.boolean(),
  platform: z.string().optional(),
  userId: z.string().optional(),
  username: z.string().optional(),  // Add new field
  txHash: z.string().optional(),
  tripleId: z.string().optional(),
  explorerUrl: z.string().optional(),
  verifiedAt: z.string().optional(),  // Add timestamp
  error: z.string().optional(),
})

// In the workflow return
return {
  success: true,
  platform,
  userId,
  username: userData.username,
  txHash: receipt.transactionHash,
  tripleId: String(tripleId),
  explorerUrl: `${EXPLORER_URL}/triple/${tripleId}`,
  verifiedAt: new Date().toISOString(),
}
```

