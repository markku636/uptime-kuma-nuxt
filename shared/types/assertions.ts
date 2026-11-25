export const assertionSources = ['status','responseTime','header','text','json'] as const
export const assertionOperators = ['equals','notEquals','contains','notContains','gt','gte','lt','lte','in','notIn','startsWith','endsWith','length','between','exists','notExists','isNull','isNotNull','isEmpty','isNotEmpty','isJson','isNumber','isString','isBoolean','isArray','isDefined','isUndefined','isTruthy','isFalsy'] as const
export type AssertionSource = typeof assertionSources[number]
export type AssertionOperator = typeof assertionOperators[number]
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key:string]: JsonValue }
export interface AssertionRule { id:string; source:typeof assertionSources[number]; path?:string; operator:typeof assertionOperators[number]; expected?:JsonValue }
export interface AssertionSet { version:1; mode:'all'|'any'; rules:AssertionRule[] }
export type AssertionReason = 'passed'|'missing'|'type_mismatch'|'value_mismatch'|'unexpected_value'|'not_null'|'is_null'
export interface AssertionRuleResult { ruleId:string; source:AssertionRule['source']; operator:AssertionRule['operator']; passed:boolean; reason:AssertionReason }
export interface AssertionEvaluation { passed:boolean; rules:AssertionRuleResult[]; error?:'INVALID_JSON'|'CONFIG_ERROR' }
