// server/services/monitor/checkers/message-queue-checker.ts
import type { CheckResult } from '../checker'

/** TLS on the protocol's TLS port, plain on its plain port, else TLS unless ignoreTls */
export function useTls(port: number, tlsPort: number, plainPort: number, ignoreTls: unknown): boolean {
  if (port === tlsPort) return true
  if (port === plainPort) return false
  return !ignoreTls
}

export async function checkMqtt(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const mqtt = await import('mqtt')
    
    if (!monitor.hostname) {
      return {
        status: 0,
        ping: 0,
        msg: 'MQTT broker hostname is required'
      }
    }

    const port = monitor.port || 1883
    // The standard ports decide (8883 TLS, 1883 plain); on any other port TLS
    // is used unless "ignore TLS" is set, so credentials are not sent in clear
    const protocol = useTls(port, 8883, 1883, monitor.ignoreTls) ? 'mqtts' : 'mqtt'
    const url = `${protocol}://${monitor.hostname}:${port}`

    return new Promise((resolve) => {
      const timeout = (monitor.timeout || 48) * 1000
      const timeoutId = setTimeout(() => {
        client.end(true)
        resolve({
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: 'MQTT connection timeout'
        })
      }, timeout)

      const options: any = {
        connectTimeout: timeout,
        username: monitor.mqttUsername,
        password: monitor.mqttPassword,
        rejectUnauthorized: !monitor.ignoreTls
      }

      const client = mqtt.connect(url, options)

      client.on('connect', () => {
        clearTimeout(timeoutId)
        const ping = Date.now() - startTime

        if (monitor.mqttTopic) {
          // Subscribe to topic and wait for message
          client.subscribe(monitor.mqttTopic, (err) => {
            if (err) {
              client.end()
              resolve({
                status: monitor.upsideDown ? 1 : 0,
                ping,
                msg: `Subscribe failed: ${err.message}`
              })
              return
            }

            // Set up message handler with timeout
            const msgTimeout = setTimeout(() => {
              client.end()
              resolve({
                status: monitor.upsideDown ? 1 : 0,
                ping,
                msg: 'No message received within timeout'
              })
            }, Math.min(timeout, 10000))

            client.on('message', (topic, message) => {
              clearTimeout(msgTimeout)
              client.end()
              
              const msgStr = message.toString()
              
              // Check for expected message if specified
              if (monitor.mqttSuccessMessage) {
                const matches = msgStr.includes(monitor.mqttSuccessMessage)
                resolve({
                  status: (monitor.upsideDown ? !matches : matches) ? 1 : 0,
                  ping,
                  msg: matches ? 'Expected message received' : 'Unexpected message content'
                })
              } else {
                resolve({
                  status: monitor.upsideDown ? 0 : 1,
                  ping,
                  msg: `Message received: ${msgStr.substring(0, 100)}`
                })
              }
            })
          })
        } else {
          // No topic specified, just check connection
          client.end()
          resolve({
            status: monitor.upsideDown ? 0 : 1,
            ping,
            msg: 'MQTT connection successful'
          })
        }
      })

      client.on('error', (err) => {
        clearTimeout(timeoutId)
        client.end()
        resolve({
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: err.message || 'MQTT connection failed'
        })
      })
    })
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'MQTT check failed'
    }
  }
}

export async function checkKafka(monitor: any, startTime: number): Promise<CheckResult> {
  let admin: any = null
  try {
    const { Kafka, logLevel } = await import('kafkajs')

    // A copy: the scheduler reuses the monitor object between checks
    const brokers: string[] = Array.isArray(monitor.kafkaBrokers) ? [...monitor.kafkaBrokers] : []
    if (brokers.length === 0 && monitor.hostname) {
      brokers.push(`${monitor.hostname}:${monitor.port || 9092}`)
    }
    if (brokers.length === 0) {
      return { status: 0, ping: 0, msg: 'Kafka brokers are required' }
    }

    const timeout = (monitor.timeout || 48) * 1000
    const kafkaConfig: any = {
      clientId: 'uptime-kuma-monitor',
      brokers,
      connectionTimeout: timeout,
      requestTimeout: timeout,
      retry: { retries: 1 },
      logLevel: logLevel.NOTHING,
    }

    // SASL authentication
    if (monitor.kafkaUsername && monitor.kafkaPassword) {
      kafkaConfig.sasl = {
        mechanism: monitor.kafkaSaslMechanism || 'plain',
        username: monitor.kafkaUsername,
        password: monitor.kafkaPassword,
      }
      kafkaConfig.ssl = true
    }

    admin = new Kafka(kafkaConfig).admin()
    await admin.connect()

    if (monitor.kafkaTopic) {
      const topics: string[] = await admin.listTopics()
      if (!topics.includes(monitor.kafkaTopic)) {
        return { status: monitor.upsideDown ? 1 : 0, ping: Date.now() - startTime, msg: `Topic '${monitor.kafkaTopic}' not found` }
      }
    }

    return { status: monitor.upsideDown ? 0 : 1, ping: Date.now() - startTime, msg: 'Kafka connection successful' }
  } catch (error: any) {
    return { status: monitor.upsideDown ? 1 : 0, ping: Date.now() - startTime, msg: error.message || 'Kafka check failed' }
  } finally {
    // Also after errors: connections must not pile up across checks
    if (admin) await admin.disconnect().catch(() => {})
  }
}

export async function checkRabbitMQ(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const amqplib = await import('amqplib')
    
    let connectionUrl: string
    
    if (monitor.databaseConnectionString) {
      connectionUrl = monitor.databaseConnectionString
    } else if (monitor.hostname) {
      // Standard ports decide (5671 TLS, 5672 plain); other ports use TLS unless "ignore TLS"
      const port = monitor.port || 5672
      const protocol = useTls(port, 5671, 5672, monitor.ignoreTls) ? 'amqps' : 'amqp'
      const auth = monitor.rabbitmqUsername
        ? `${encodeURIComponent(monitor.rabbitmqUsername)}:${encodeURIComponent(monitor.rabbitmqPassword || '')}@`
        : ''
      connectionUrl = `${protocol}://${auth}${monitor.hostname}:${port}`
    } else {
      return {
        status: 0,
        ping: 0,
        msg: 'RabbitMQ connection details are required'
      }
    }

    const connection = await amqplib.connect(connectionUrl, {
      timeout: (monitor.timeout || 48) * 1000
    })
    
    const ping = Date.now() - startTime
    await connection.close()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'RabbitMQ connection successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'RabbitMQ check failed'
    }
  }
}
