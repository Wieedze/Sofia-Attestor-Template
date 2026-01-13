/**
 * Attestor Workflow Template
 *
 * This workflow verifies OAuth tokens and returns whether the user
 * can create an on-chain attestation.
 *
 * ============================================================
 * HOW IT WORKS:
 * 1. Your frontend app handles OAuth flow (Twitter, GitHub, etc.)
 * 2. Frontend sends the OAuth tokens + wallet address to this workflow
 * 3. This workflow verifies tokens against the respective APIs
 * 4. If verified → returns canCreateAttestation: true
 * 5. AttestorService then creates the triple on-chain
 *
 * CUSTOMIZE THIS FILE:
 * 1. Update inputSchema with your OAuth token fields
 * 2. Implement verification logic in execute() to call the APIs
 * 3. Return canCreateAttestation: true if verification passes
 * ============================================================
 */

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// ============================================================
// Input Schema - Define OAuth tokens your app will send
// ============================================================

const inputSchema = z.object({
  /** User's wallet address */
  walletAddress: z.string().describe('User wallet address'),

  /**
   * OAuth tokens from your frontend app
   * Customize based on which providers you support
   *
   * Example:
   * tokens: z.object({
   *   twitter: z.string().optional(),  // Twitter OAuth 2.0 access token
   *   github: z.string().optional(),   // GitHub OAuth access token
   * }),
   */
})

// ============================================================
// Output Schema - What the workflow returns
// ============================================================

const outputSchema = z.object({
  /** Whether the verification succeeded */
  success: z.boolean(),

  /** Detailed verification status (optional) */
  verified: z.record(z.string(), z.boolean()).optional(),

  /** Number of items verified */
  verifiedCount: z.number(),

  /** Whether the user can create the attestation */
  canCreateAttestation: z.boolean(),

  /** Error message if verification failed */
  error: z.string().optional(),
})

// ============================================================
// Workflow Step - Implement your OAuth verification here
// ============================================================

const verifyAttestation = createStep({
  id: 'verify-attestation',
  description: 'Verify off-chain data for attestation',
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    // Validate input
    if (!inputData?.walletAddress) {
      return {
        success: false,
        verifiedCount: 0,
        canCreateAttestation: false,
        error: 'walletAddress is required',
      }
    }

    const { walletAddress } = inputData

    console.log(`[AttestorWorkflow] Starting verification for ${walletAddress}`)

    // ========================================================
    // IMPLEMENT YOUR OAUTH VERIFICATION HERE
    //
    // Example for Twitter + GitHub:
    //
    // async function verifyTwitter(token: string): Promise<boolean> {
    //   const res = await fetch('https://api.twitter.com/2/users/me', {
    //     headers: { Authorization: `Bearer ${token}` },
    //   })
    //   return res.ok
    // }
    //
    // const [twitter, github] = await Promise.all([
    //   inputData.tokens?.twitter ? verifyTwitter(inputData.tokens.twitter) : false,
    //   inputData.tokens?.github ? verifyGitHub(inputData.tokens.github) : false,
    // ])
    //
    // const verified = { twitter, github }
    // const verifiedCount = Object.values(verified).filter(Boolean).length
    // ========================================================

    // Placeholder - replace with your verification logic
    const verified: Record<string, boolean> = {}
    const verifiedCount = 0
    const requiredCount = 0 // Set minimum required verifications

    console.log(`[AttestorWorkflow] Verified ${verifiedCount}/${requiredCount} items`)

    // Check if enough verifications passed
    if (verifiedCount < requiredCount) {
      return {
        success: false,
        verified,
        verifiedCount,
        canCreateAttestation: false,
        error: `Only ${verifiedCount}/${requiredCount} verifications passed`,
      }
    }

    // All verifications passed!
    console.log(`[AttestorWorkflow] All verifications passed!`)

    return {
      success: true,
      verified,
      verifiedCount,
      canCreateAttestation: true,
    }
  },
})

// ============================================================
// Create and export the workflow
// ============================================================

const attestorWorkflow = createWorkflow({
  id: 'attestor-workflow',
  inputSchema,
  outputSchema,
}).then(verifyAttestation)

attestorWorkflow.commit()

export { attestorWorkflow }
