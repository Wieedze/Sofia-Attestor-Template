/**
 * useVerification React Hook
 *
 * Optional React hook for using the BotVerifierService in React applications.
 * Manages verification state and provides methods to link social accounts.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  BotVerifierService,
  type BotVerifierConfig,
  type LinkSocialResult,
} from '../services/BotVerifierService'
import { type SocialPlatform } from '../config/constants'

export interface UseVerificationConfig extends BotVerifierConfig {
  /** Wallet address (optional - will prompt for connection if not provided) */
  walletAddress?: `0x${string}`
  /** Storage key for persisting verification state (optional) */
  storageKey?: string
}

export interface UseVerificationResult {
  /** Whether the user has completed verification */
  isVerified: boolean
  /** Whether the user can start verification (prerequisites met) */
  canVerify: boolean
  /** Whether a verification is currently in progress */
  isVerifying: boolean
  /** Error message if something went wrong */
  error: string | null
  /** Link a social account */
  linkSocialAccount: (platform: SocialPlatform, oauthToken: string) => Promise<LinkSocialResult>
  /** Reset the verification state */
  reset: () => void
}

export const useVerification = (config: UseVerificationConfig): UseVerificationResult => {
  const [isVerified, setIsVerified] = useState(false)
  const [canVerify, setCanVerify] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [service] = useState(() => new BotVerifierService(config))

  // Check if user can verify
  useEffect(() => {
    setCanVerify(!!config.walletAddress)
  }, [config.walletAddress])

  // Load existing verification from storage
  useEffect(() => {
    if (!config.storageKey || typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(config.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.walletAddress?.toLowerCase() === config.walletAddress?.toLowerCase()) {
          setIsVerified(true)
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [config.storageKey, config.walletAddress])

  const linkSocialAccount = useCallback(async (
    platform: SocialPlatform,
    oauthToken: string
  ): Promise<LinkSocialResult> => {
    if (!config.walletAddress) {
      return { success: false, error: 'No wallet address provided' }
    }

    setIsVerifying(true)
    setError(null)

    try {
      const result = await service.linkSocialAccount(
        platform,
        config.walletAddress,
        oauthToken
      )

      if (result.success) {
        // Save to storage if configured
        if (config.storageKey && typeof window !== 'undefined') {
          const stored = localStorage.getItem(config.storageKey)
          const data = stored ? JSON.parse(stored) : { walletAddress: config.walletAddress, links: {} }
          data.links[platform] = {
            userId: result.userId,
            username: result.username,
            txHash: result.txHash,
            linkedAt: Date.now(),
          }
          localStorage.setItem(config.storageKey, JSON.stringify(data))
        }
      } else {
        setError(result.error || 'Unknown error')
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsVerifying(false)
    }
  }, [config.walletAddress, config.storageKey, service])

  const reset = useCallback(() => {
    setIsVerified(false)
    setError(null)

    if (config.storageKey && typeof window !== 'undefined') {
      localStorage.removeItem(config.storageKey)
    }
  }, [config.storageKey])

  return {
    isVerified,
    canVerify,
    isVerifying,
    error,
    linkSocialAccount,
    reset,
  }
}

// Backwards compatibility exports
export type UseAttestationConfig = UseVerificationConfig
export type UseAttestationResult = UseVerificationResult
export const useAttestation = useVerification
