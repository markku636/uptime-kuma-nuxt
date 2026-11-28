import { z } from 'zod'
import { SECURITY_RULE_SOURCES, SECURITY_SCAN_SEVERITIES } from '../../shared/types/security-scan'

export const securityRuleSchema = z.object({
  key: z.string().regex(/^[a-z0-9._-]{1,120}$/),
  source: z.enum(SECURITY_RULE_SOURCES),
  sourceUrl: z.string().url().max(512),
  product: z.string().min(1).max(120),
  signature: z.string().min(1).max(160),
  maxVersion: z.string().regex(/^\d+(?:\.\d+){1,3}[a-z]?$/).optional(),
  severity: z.enum(SECURITY_SCAN_SEVERITIES),
  title: z.string().min(1).max(300),
  detail: z.string().min(1).max(4000),
  recommendation: z.string().max(4000),
  refs: z.array(z.string().url().max(512)).max(20).default([]),
  cwe: z.array(z.string().regex(/^CWE-\d+$/)).max(20).default([]),
  active: z.boolean().optional(),
}).strict()

export type SecurityRuleInput = z.infer<typeof securityRuleSchema>

export function toRuleRow(input: SecurityRuleInput, workspaceId: number) {
  return {
    workspaceId, key: input.key, source: input.source, sourceUrl: input.sourceUrl,
    product: input.product, signature: input.signature, maxVersion: input.maxVersion || null,
    severity: input.severity, title: input.title, detail: input.detail,
    recommendation: input.recommendation, refs: input.refs, cwe: input.cwe,
    active: input.active ?? true,
  }
}
