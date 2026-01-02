// types/monitor.ts

export enum MonitorType {
  HTTP = 'http',
  TCP = 'tcp',
  PING = 'ping',
  DNS = 'dns',
  PUSH = 'push',
  DOCKER = 'docker',
  KEYWORD = 'keyword',
  JSON_QUERY = 'json-query',
  GRPC_KEYWORD = 'grpc-keyword',
  MONGODB = 'mongodb',
  MYSQL = 'mysql',
  POSTGRES = 'postgres',
  SQLSERVER = 'sqlserver',
  REDIS = 'redis',
  STEAM = 'steam',
  GAMEDIG = 'gamedig',
  MQTT = 'mqtt',
  KAFKA = 'kafka',
  RABBITMQ = 'rabbitmq',
  RADIUS = 'radius',
  TAILSCALE_PING = 'tailscale-ping',
  REAL_BROWSER = 'real-browser',
  GROUP = 'group',
}

export enum MonitorStatus {
  DOWN = 0,
  UP = 1,
  PENDING = 2,
  MAINTENANCE = 3,
}

export interface Monitor {
  id: number
  name: string
  description?: string
  active: boolean
  userId: number
  interval: number
  retryInterval: number
  maxretries: number
  timeout: number
  type: MonitorType
  url?: string
  hostname?: string
  port?: number
  method: string
  body?: string
  headers?: Record<string, string>
  keyword?: string
  invertKeyword: boolean
  ignoreTls: boolean
  upsideDown: boolean
  authMethod?: string
  basicAuthUser?: string
  basicAuthPass?: string
  pushToken?: string
  proxyId?: number
  weight: number
  createdAt: Date
  
  // JSON Query specific
  jsonPath?: string
  expectedValue?: string
  
  // gRPC specific
  grpcUrl?: string
  grpcProtoContent?: string
  grpcMethod?: string
  grpcServiceName?: string
  grpcEnableTls?: boolean
  grpcBody?: string
  grpcMetadata?: string
  
  // Database specific
  databaseConnectionString?: string
  databaseQuery?: string
  
  // Docker specific
  dockerHost?: string
  dockerDaemon?: string
  dockerContainer?: string
  
  // MQTT specific
  mqttTopic?: string
  mqttUsername?: string
  mqttPassword?: string
  mqttSuccessMessage?: string
  
  // Kafka specific
  kafkaBrokers?: string[]
  kafkaTopic?: string
  kafkaSaslMechanism?: string
  kafkaUsername?: string
  kafkaPassword?: string
  
  // RabbitMQ specific
  rabbitmqNodes?: string[]
  rabbitmqUsername?: string
  rabbitmqPassword?: string
  
  // Redis specific
  redisConnectionString?: string
  
  // Radius specific
  radiusSecret?: string
  radiusCalledStationId?: string
  radiusCallingStationId?: string
  
  // Game server specific
  game?: string
  
  // Group specific
  parent?: number
  childrenIds?: number[]
  
  // Real Browser specific
  remoteBrowserId?: number
}

export interface CreateMonitorInput {
  name: string
  type: MonitorType
  url?: string
  hostname?: string
  port?: number
  interval?: number
  timeout?: number
  method?: string
  body?: string
  headers?: Record<string, string>
  keyword?: string
  invertKeyword?: boolean
  ignoreTls?: boolean
  upsideDown?: boolean
  authMethod?: string
  basicAuthUser?: string
  basicAuthPass?: string
  description?: string
  
  // JSON Query specific
  jsonPath?: string
  expectedValue?: string
  
  // gRPC specific
  grpcUrl?: string
  grpcProtoContent?: string
  grpcMethod?: string
  grpcServiceName?: string
  grpcEnableTls?: boolean
  grpcBody?: string
  grpcMetadata?: string
  
  // Database specific
  databaseConnectionString?: string
  databaseQuery?: string
  
  // Docker specific
  dockerHost?: string
  dockerDaemon?: string
  dockerContainer?: string
  
  // MQTT specific
  mqttTopic?: string
  mqttUsername?: string
  mqttPassword?: string
  mqttSuccessMessage?: string
  
  // Kafka specific
  kafkaBrokers?: string[]
  kafkaTopic?: string
  kafkaSaslMechanism?: string
  kafkaUsername?: string
  kafkaPassword?: string
  
  // RabbitMQ specific
  rabbitmqNodes?: string[]
  rabbitmqUsername?: string
  rabbitmqPassword?: string
  
  // Redis specific
  redisConnectionString?: string
  
  // Radius specific
  radiusSecret?: string
  radiusCalledStationId?: string
  radiusCallingStationId?: string
  
  // Game server specific
  game?: string
  
  // Group specific
  parent?: number
  childrenIds?: number[]
  
  // Real Browser specific
  remoteBrowserId?: number
}

export interface UpdateMonitorInput extends Partial<CreateMonitorInput> {
  active?: boolean
  weight?: number
}
