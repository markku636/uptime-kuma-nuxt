// server/services/monitor/checkers/grpc-checker.ts
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import type { CheckResult } from '../checker'

export async function checkGrpcKeyword(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    if (!monitor.grpcUrl) {
      return {
        status: 0,
        ping: 0,
        msg: 'gRPC URL is required'
      }
    }

    if (!monitor.grpcProtoContent) {
      return {
        status: 0,
        ping: 0,
        msg: 'gRPC Proto definition is required'
      }
    }

    // Parse proto content
    const packageDefinition = await protoLoader.loadSync(monitor.grpcProtoContent, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    })

    const proto = grpc.loadPackageDefinition(packageDefinition)

    // Get service and method
    const serviceName = monitor.grpcServiceName || ''
    const methodName = monitor.grpcMethod || ''

    if (!serviceName || !methodName) {
      return {
        status: 0,
        ping: 0,
        msg: 'gRPC service name and method are required'
      }
    }

    // Create credentials
    const credentials = monitor.grpcEnableTls 
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure()

    // Create client
    const ServiceClient = getNestedValue(proto, serviceName)
    if (!ServiceClient) {
      return {
        status: 0,
        ping: 0,
        msg: `Service ${serviceName} not found in proto definition`
      }
    }

    const client = new ServiceClient(monitor.grpcUrl, credentials)

    // Parse request body
    let requestBody = {}
    if (monitor.grpcBody) {
      try {
        requestBody = JSON.parse(monitor.grpcBody)
      } catch {
        return {
          status: 0,
          ping: 0,
          msg: 'Invalid gRPC request body JSON'
        }
      }
    }

    // Parse metadata
    const metadata = new grpc.Metadata()
    if (monitor.grpcMetadata) {
      try {
        const metadataObj = JSON.parse(monitor.grpcMetadata)
        for (const [key, value] of Object.entries(metadataObj)) {
          metadata.add(key, String(value))
        }
      } catch {
        // Ignore metadata parse errors
      }
    }

    // Make gRPC call
    return new Promise((resolve) => {
      const timeout = (monitor.timeout || 48) * 1000
      const deadline = new Date(Date.now() + timeout)

      client[methodName](requestBody, metadata, { deadline }, (error: any, response: any) => {
        const ping = Date.now() - startTime
        client.close()

        if (error) {
          resolve({
            status: monitor.upsideDown ? 1 : 0,
            ping,
            msg: `gRPC Error: ${error.message}`
          })
          return
        }

        // Check for keyword in response
        if (monitor.keyword) {
          const responseStr = JSON.stringify(response)
          const found = responseStr.includes(monitor.keyword)
          
          if (monitor.invertKeyword ? found : !found) {
            resolve({
              status: monitor.upsideDown ? 1 : 0,
              ping,
              msg: monitor.invertKeyword ? 'Keyword found (inverted)' : 'Keyword not found'
            })
            return
          }
        }

        resolve({
          status: monitor.upsideDown ? 0 : 1,
          ping,
          msg: 'gRPC call successful'
        })
      })
    })
  } catch (error: any) {
    return {
      status: 0,
      ping: Date.now() - startTime,
      msg: error.message || 'gRPC check failed'
    }
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}
