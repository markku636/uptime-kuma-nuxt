import { z } from 'zod'
import { validVariableName } from './variables'

const variables = z.record(z.string().refine(validVariableName), z.string().max(65536)).refine(value => Object.keys(value).length <= 200)

export const brunoTestInputSchema = z.object({
  collectionId: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  name: z.string().min(1).max(200).optional(),
  sourceEnvironment: z.string().max(256).optional(),
  files: z.array(z.object({ path: z.string().min(1).max(256), content: z.string().max(131072) }).strict()).min(1).max(4500),
  variables: variables.optional(),
  secrets: variables.optional(),
  digest: z.string().max(128).optional(),
  failFast: z.boolean().optional(),
  timeoutSec: z.number().int().min(30).max(180).optional(),
}).strict()

export const brunoTestUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  failFast: z.boolean().optional(),
  timeoutSec: z.number().int().min(30).max(180).optional(),
  scheduleIntervalSec: z.number().int().refine(value => [0, 300, 900, 3600].includes(value), 'Unsupported schedule interval').optional(),
  stepSources: z.record(z.string().max(256), z.string().max(131072)).refine(value => Object.keys(value).length <= 20).optional(),
  stepExtract: z.record(z.string().max(256), z.array(z.object({
    name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(128),
    source: z.enum(['status', 'responseTime', 'header', 'json']),
    path: z.string().max(256).optional(),
  }).strict()).max(32)).refine(value => Object.keys(value).length <= 20).optional(),
}).strict()
