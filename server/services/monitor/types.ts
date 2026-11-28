/**
 * Monitor Types Definition
 * 
 * Defines all monitor types with their condition support and variables
 * This is the Nuxt.js equivalent of the original server/monitor-types/*.js
 */

// =====================
// Operator Definitions
// =====================

export interface ConditionOperator {
  id: string
  caption: string
}

// String operators
export const stringOperators: ConditionOperator[] = [
  { id: 'equals', caption: 'equals' },
  { id: 'not_equals', caption: 'not equals' },
  { id: 'contains', caption: 'contains' },
  { id: 'not_contains', caption: 'not contains' },
  { id: 'starts_with', caption: 'starts with' },
  { id: 'not_starts_with', caption: 'not starts with' },
  { id: 'ends_with', caption: 'ends with' },
  { id: 'not_ends_with', caption: 'not ends with' }
]

// Numeric operators
export const numericOperators: ConditionOperator[] = [
  { id: 'num_equals', caption: 'equals' },
  { id: 'num_not_equals', caption: 'not equals' },
  { id: 'lt', caption: '<' },
  { id: 'gt', caption: '>' },
  { id: 'lte', caption: '<=' },
  { id: 'gte', caption: '>=' }
]

// Combined operators (string + numeric)
export const allOperators: ConditionOperator[] = [
  ...stringOperators,
  ...numericOperators
]

// =====================
// Variable Definitions
// =====================

export interface ConditionVariable {
  id: string
  operators: ConditionOperator[]
}

// =====================
// Monitor Type Interface
// =====================

export interface MonitorType {
  supportsConditions: boolean
  conditionVariables: ConditionVariable[]
}

// =====================
// Monitor Type Definitions
// =====================

/**
 * HTTP Monitor Type
 * Supports: response code, response body, header, response time
 */
const httpMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_code', operators: numericOperators },
    { id: 'response_body', operators: stringOperators },
    { id: 'response_header', operators: stringOperators },
    { id: 'response_time', operators: numericOperators }
  ]
}

/**
 * Keyword Monitor Type
 * Same as HTTP, just a variation
 */
const keywordMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_code', operators: numericOperators },
    { id: 'response_body', operators: stringOperators },
    { id: 'response_header', operators: stringOperators },
    { id: 'response_time', operators: numericOperators }
  ]
}

/**
 * JSON Query Monitor Type
 * Supports: JSON query result
 */
const jsonQueryMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_code', operators: numericOperators },
    { id: 'response_body', operators: stringOperators },
    { id: 'response_header', operators: stringOperators },
    { id: 'response_time', operators: numericOperators },
    { id: 'json_value', operators: allOperators }
  ]
}

/**
 * gRPC (keyword) Monitor Type
 */
const grpcKeywordMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_body', operators: stringOperators },
    { id: 'response_time', operators: numericOperators }
  ]
}

/**
 * DNS Monitor Type
 * Supports: DNS record value
 */
const dnsMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'record', operators: stringOperators }
  ]
}

/**
 * TCP / Ping / Port Monitor Type
 * Supports: response time only
 */
const tcpMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_time', operators: numericOperators }
  ]
}

/**
 * MQTT Monitor Type
 * Supports: message content
 */
const mqttMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'message', operators: stringOperators }
  ]
}

/**
 * SNMP Monitor Type
 * Supports: SNMP value
 */
const snmpMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'snmp_value', operators: allOperators }
  ]
}

/**
 * Database Monitor Types (MongoDB, MySQL, PostgreSQL, etc.)
 * Supports: query result
 */
const databaseMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'query_result', operators: allOperators }
  ]
}

/**
 * Docker / Container Monitor Type
 * Supports: container state
 */
const dockerMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'container_state', operators: stringOperators }
  ]
}

/**
 * Steam Game Server Monitor
 * Supports: player count, map name
 */
const steamMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'player_count', operators: numericOperators },
    { id: 'map', operators: stringOperators }
  ]
}

/**
 * Gamedig Monitor Type
 * Supports: various game server stats
 */
const gamedigMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'player_count', operators: numericOperators },
    { id: 'max_players', operators: numericOperators },
    { id: 'map', operators: stringOperators },
    { id: 'name', operators: stringOperators }
  ]
}

/**
 * SMTP Monitor Type
 */
const smtpMonitorType: MonitorType = {
  supportsConditions: false,
  conditionVariables: []
}

/**
 * Push Monitor Type
 * No conditions - just receives pushes
 */
const pushMonitorType: MonitorType = {
  supportsConditions: false,
  conditionVariables: []
}

/**
 * Real Browser Monitor Type
 */
const realBrowserMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_time', operators: numericOperators }
  ]
}

/**
 * Visual Diff Monitor Type（網頁跑版）
 */
const visualDiffMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_time', operators: numericOperators }
  ]
}

/**
 * Tailscale Ping Monitor Type
 */
/** 合成瀏覽器流程（宣告式步驟，不執行任意 JS） */
const browserFlowMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_time', operators: numericOperators }
  ]
}

const siteAuditMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [{ id: 'response_time', operators: numericOperators }]
}

const securityScanMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [{ id: 'response_time', operators: numericOperators }]
}

const tailscalePingMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'response_time', operators: numericOperators }
  ]
}

/**
 * Group Monitor Type
 */
const groupMonitorType: MonitorType = {
  supportsConditions: false,
  conditionVariables: []
}

/**
 * Manual Monitor Type
 */
const manualMonitorType: MonitorType = {
  supportsConditions: false,
  conditionVariables: []
}

/**
 * RabbitMQ Monitor Type
 */
const rabbitmqMonitorType: MonitorType = {
  supportsConditions: true,
  conditionVariables: [
    { id: 'message_count', operators: numericOperators }
  ]
}

/**
 * Kafka Producer Monitor Type
 */
const kafkaProducerMonitorType: MonitorType = {
  supportsConditions: false,
  conditionVariables: []
}

/**
 * Default/basic monitor type (no conditions)
 */
const basicMonitorType: MonitorType = {
  supportsConditions: false,
  conditionVariables: []
}

// =====================
// Monitor Type Registry
// =====================

export const monitorTypeList: Record<string, MonitorType> = {
  // HTTP-based
  'http': httpMonitorType,
  'keyword': keywordMonitorType,
  'json-query': jsonQueryMonitorType,
  'grpc-keyword': grpcKeywordMonitorType,
  
  // Network
  'tcp': tcpMonitorType,
  'ping': tcpMonitorType,
  'port': tcpMonitorType,
  'dns': dnsMonitorType,
  'mqtt': mqttMonitorType,
  'snmp': snmpMonitorType,
  'smtp': smtpMonitorType,
  
  // Database
  'mongodb': databaseMonitorType,
  'mysql': databaseMonitorType,
  'postgres': databaseMonitorType,
  'sqlserver': databaseMonitorType,
  'redis': databaseMonitorType,
  
  // Container
  'docker': dockerMonitorType,
  
  // Game
  'steam': steamMonitorType,
  'gamedig': gamedigMonitorType,
  
  // Special
  'push': pushMonitorType,
  'real-browser': realBrowserMonitorType,
  'visual-diff': visualDiffMonitorType,
  'browser-flow': browserFlowMonitorType,
  'site-audit': siteAuditMonitorType,
  'security-scan': securityScanMonitorType,
  'tailscale-ping': tailscalePingMonitorType,
  'group': groupMonitorType,
  'manual': manualMonitorType,
  'rabbitmq': rabbitmqMonitorType,
  'kafka-producer': kafkaProducerMonitorType,
  
  // Radius
  'radius': basicMonitorType
}

/**
 * Get monitor type info
 * Returns the type if found, or a basic type with no conditions
 */
export function getMonitorType(type: string): MonitorType {
  return monitorTypeList[type] || basicMonitorType
}

/**
 * Get all monitor types for client
 * This is sent to the frontend via socket event
 */
export function getMonitorTypeListForClient(): Record<string, MonitorType> {
  return monitorTypeList
}
