/**
 * useAttestation React Hook
 *
 * Optional React hook for using the AttestorService in React applications.
 */

import { useState, useCallback, useEffect } from 'react'
import { AttestorService, type AttestorConfig, type AttestationResult } from '../services/AttestorService'

export interface UseAttestationConfig extends Omit<AttestorConfig, 'chainConfig'> {
  /** Chain config - use ChainConfig.testnet or ChainConfig.mainnet */
  chainConfig: AttestorConfig['chainConfig']
  /** Wallet address (optional - will prompt for connection if not provided) */
  walletAddress?: `0x${string}`
  /** Storage key for persisting attestation (optional) */
  storageKey?: string
}

export interface UseAttestationResult {
  /** Whether the user has already created an attestation */
  isAttested: boolean
  /** Whether the user can create an attestation (prerequisites met) */
  canAttest: boolean
  /** Whether an attestation is currently being created */
  isAttesting: boolean
  /** Error message if something went wrong */
  error: string | null
  /** Create the attestation */
  createAttestation: (verificationData?: Record<string, unknown>) => Promise<AttestationResult>
  /** Reset the attestation state */
  reset: () => void
}

export const useAttestation = (config: UseAttestationConfig): UseAttestationResult => {
  const [isAttested, setIsAttested] = useState(false)
  const [canAttest, setCanAttest] = useState(false)
  const [isAttesting, setIsAttesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [service] = useState(() => new AttestorService(config))

  // Check if user can attest
  useEffect(() => {
    setCanAttest(!!config.walletAddress)
  }, [config.walletAddress])

  // Load existing attestation from storage
  useEffect(() => {
    if (!config.storageKey || typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(config.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.walletAddress?.toLowerCase() === config.walletAddress?.toLowerCase()) {
          setIsAttested(true)
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [config.storageKey, config.walletAddress])

  const createAttestation = useCallback(async (
    verificationData?: Record<string, unknown>
  ): Promise<AttestationResult> => {
    if (!config.walletAddress) {
      return { success: false, error: 'No wallet address provided' }
    }

    if (isAttested) {
      return { success: false, error: 'Already attested' }
    }

    setIsAttesting(true)
    setError(null)

    try {
      const result = await service.createAttestation({
        walletAddress: config.walletAddress,
        verificationData,
      })

      if (result.success) {
        setIsAttested(true)

        // Save to storage if configured
        if (config.storageKey && typeof window !== 'undefined') {
          localStorage.setItem(config.storageKey, JSON.stringify({
            txHash: result.txHash,
            walletAddress: config.walletAddress,
            createdAt: Date.now(),
          }))
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
      setIsAttesting(false)
    }
  }, [config.walletAddress, config.storageKey, isAttested, service])

  const reset = useCallback(() => {
    setIsAttested(false)
    setError(null)

    if (config.storageKey && typeof window !== 'undefined') {
      localStorage.removeItem(config.storageKey)
    }
  }, [config.storageKey])

  return {
    isAttested,
    canAttest,
    isAttesting,
    error,
    createAttestation,
    reset,
  }
}
