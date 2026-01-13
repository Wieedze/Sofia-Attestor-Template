/**
 * Mastra Entry Point
 *
 * Register your workflows here to expose them via the Mastra API.
 */

import { Mastra } from '@mastra/core'
import { attestorWorkflow } from './workflows/attestor'

export const mastra = new Mastra({
  workflows: {
    attestorWorkflow,
  },
})
