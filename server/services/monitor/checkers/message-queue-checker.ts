// server/services/monitor/checkers/message-queue-checker.ts
import type { CheckResult } from '../checker'

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
    const protocol = monitor.ignoreTls ? 'mqtt' : 'mqtts'
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
  try {
    const { Kafka } = await import('kafkajs')
    
    const brokers = monitor.kafkaBrokers || []
    if (brokers.length === 0 && monitor.hostname) {
      brokers.push(`${monitor.hostname}:${monitor.port || 9092}`)
    }

    if (brokers.length === 0) {
      return {
        status: 0,
        ping: 0,
        msg: 'Kafka brokers are required'
      }
    }

    const kafkaConfig: any = {
      clientId: 'uptime-kuma-monitor',
      brokers,
      connectionTimeout: (monitor.timeout || 48) * 1000,
    }

    // SASL authentication
    if (monitor.kafkaUsername && monitor.kafkaPassword) {
      kafkaConfig.sasl = {
        mechanism: monitor.kafkaSaslMechanism || 'plain',
        username: monitor.kafkaUsername,
        password: monitor.kafkaPassword
      }
      kafkaConfig.ssl = true
    }

    const kafka = new Kafka(kafkaConfig)
    const admin = kafka.admin()

    await admin.connect()
    
    // Check topic if specified
    if (monitor.kafkaTopic) {
      const topics = await admin.listTopics()
      if (!topics.includes(monitor.kafkaTopic)) {
        await admin.disconnect()
        return {
          status: monitor.upsideDown ? 1 : 0,
          ping: Date.now() - startTime,
          msg: `Topic '${monitor.kafkaTopic}' not found`
        }
      }
    }

    const ping = Date.now() - startTime
    await admin.disconnect()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'Kafka connection successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'Kafka check failed'
    }
  }
}

export async function checkRabbitMQ(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const amqplib = await import('amqplib')
    
    let connectionUrl: string
    
    if (monitor.databaseConnectionString) {
      connectionUrl = monitor.databaseConnectionString
    } else if (monitor.hostname) {
      const protocol = monitor.ignoreTls ? 'amqp' : 'amqps'
      const auth = monitor.rabbitmqUsername 
        ? `${monitor.rabbitmqUsername}:${monitor.rabbitmqPassword || ''}@`
        : ''
      connectionUrl = `${protocol}://${auth}${monitor.hostname}:${monitor.port || 5672}`
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
