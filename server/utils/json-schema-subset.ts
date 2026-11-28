// 小型、非執行式的 JSON Schema 子集（Checkly API check 的 schema 驗證高等教育版）。
// 只接受明確列舉的關鍵字；未知關鍵字一律拒絕，避免_eval／$ref 等風險。
import { z } from 'zod'
import { safePatternMatch } from './safe-pattern'

const typeSchema = z.enum(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'])
export interface SchemaNode {
  type?: z.infer<typeof typeSchema>
  required?: string[]
  properties?: Record<string, SchemaNode>
  items?: SchemaNode
  enum?: unknown[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
}

export const schemaNodeSchema: z.ZodType<SchemaNode> = z.lazy(() => z.object({
  type: typeSchema.optional(),
  required: z.array(z.string().max(128)).max(64).optional(),
  properties: z.record(z.string().max(128), schemaNodeSchema).refine(value => Object.keys(value).length <= 64).optional(),
  items: schemaNodeSchema.optional(),
  enum: z.array(z.unknown()).min(1).max(64).optional(),
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional(),
  minLength: z.number().int().min(0).max(65536).optional(),
  maxLength: z.number().int().min(0).max(65536).optional(),
  pattern: z.string().max(256).optional(),
}).strict())

interface Budget { nodes: number }

function matchesType(value: unknown, type: SchemaNode['type']): boolean {
  switch (type) {
    case 'object': return !!value && typeof value === 'object' && !Array.isArray(value)
    case 'array': return Array.isArray(value)
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'boolean': return typeof value === 'boolean'
    case 'null': return value === null
    default: return true
  }
}

/** 回傳人類可讀的錯誤陣列；空陣列代表通過。 */
export function validateSchemaSubset(value: unknown, schema: SchemaNode, path = '$', budget: Budget = { nodes: 0 }): string[] {
  if (++budget.nodes > 5000 || path.length > 256) return [`${path}: schema too complex`]
  const errors: string[] = []
  if (schema.type && !matchesType(value, schema.type)) errors.push(`${path}: expected ${schema.type}`)
  if (schema.enum && !schema.enum.some(option => JSON.stringify(option) === JSON.stringify(value))) errors.push(`${path}: not in enum`)
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum`)
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum`)
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: too short`)
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: too long`)
    if (schema.pattern && safePatternMatch(value, schema.pattern) !== true) errors.push(`${path}: pattern mismatch`)
  }
  if (Array.isArray(value) && schema.items) {
    for (const [index, item] of value.entries()) errors.push(...validateSchemaSubset(item, schema.items, `${path}[${index}]`, budget))
  }
  if (matchesType(value, 'object') && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of schema.required || []) if (!Object.hasOwn(record, key)) errors.push(`${path}.${key}: required`)
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(record, key)) errors.push(...validateSchemaSubset(record[key], child, `${path}.${key}`, budget))
    }
  }
  return errors.slice(0, 20)
}
