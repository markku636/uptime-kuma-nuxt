import {z} from 'zod'
import {validVariableName} from './variables'
const variables=z.record(z.string().refine(validVariableName),z.string().max(65536)).refine(value=>Object.keys(value).length<=200)
export const brunoInputSchema=z.object({collectionId:z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),sourceEnvironment:z.string().max(256).optional(),
  files:z.array(z.object({path:z.string().min(1).max(256),content:z.string().max(131072)}).strict()).min(1).max(4500),
  mode:z.enum(['create','replace','skip']).default('create'),variables:variables.optional(),secrets:variables.optional(),digest:z.string().max(128).optional(),
  targetGroup:z.union([z.literal('collection'),z.literal('none'),z.number().int().positive()]).optional()}).strict()
