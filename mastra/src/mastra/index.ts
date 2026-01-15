/**
 * Mastra Entry Point
 *
 * Register your workflows here to expose them via the Mastra API.
 */

import { Mastra } from '@mastra/core'
import { verifierWorkflow } from './workflows/verifier'

export const mastra = new Mastra({
  workflows: {
    verifierWorkflow,
  },
})
