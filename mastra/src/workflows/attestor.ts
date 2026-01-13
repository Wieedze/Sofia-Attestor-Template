/**
 * Attestor Workflow Template
 *
 * This workflow verifies off-chain data and returns whether the user
 * can create an on-chain attestation.
 *
 * ============================================================
 * CUSTOMIZE THIS FILE:
 * 1. Update inputSchema with your verification data
 * 2. Implement verification logic in execute()
 * 3. Return canCreateAttestation: true if verification passes
 * ============================================================
 */

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// ============================================================
// Input Schema - Define what data you need to verify
// ============================================================

const inputSchema = z.object({
  /** User's wallet address */
  walletAddress: z.string().describe('User wallet address'),

  // TODO: Add your verification data fields here
  // Examples:
  // tokens: z.object({
  //   twitter: z.string().optional(),
  //   github: z.string().optional(),
  // }),
  // socialHandles: z.object({
  //   twitter: z.string().optional(),
  // }),
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
// Verification Functions
// TODO: Implement your verification logic here
// ============================================================

/**
 * Example: Verify a Twitter OAuth token
 */
async function verifyTwitterToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Example: Verify a GitHub OAuth token
 */
async function verifyGitHubToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

// ============================================================
// Workflow Step
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
    // TODO: Implement your verification logic here
    // ========================================================

    // Example: Verify tokens in parallel
    // const [twitter, github] = await Promise.all([
    //   inputData.tokens?.twitter ? verifyTwitterToken(inputData.tokens.twitter) : false,
    //   inputData.tokens?.github ? verifyGitHubToken(inputData.tokens.github) : false,
    // ])
    //
    // const verified = { twitter, github }
    // const verifiedCount = Object.values(verified).filter(Boolean).length

    // For now, just return success (replace with real verification)
    const verified: Record<string, boolean> = {}
    const verifiedCount = 0
    const requiredCount = 0 // TODO: Set your required verification count

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
