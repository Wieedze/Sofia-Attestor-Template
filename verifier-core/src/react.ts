/**
 * React exports for Sofia Verifier SDK
 *
 * Usage:
 * import { useVerification } from '@sofia/verifier-sdk/react'
 */

export { useVerification } from './hooks/useVerification'
export type { UseVerificationConfig, UseVerificationResult } from './hooks/useVerification'

// Backwards compatibility
export { useAttestation } from './hooks/useVerification'
export type { UseAttestationConfig, UseAttestationResult } from './hooks/useVerification'
