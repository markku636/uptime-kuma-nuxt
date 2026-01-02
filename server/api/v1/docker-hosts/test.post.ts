import { z } from 'zod'
import Docker from 'dockerode'

const testSchema = z.object({
  dockerType: z.enum(['socket', 'tcp']),
  dockerDaemon: z.string().optional(),
  connectionUrl: z.string().optional()
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readBody(event)

  const data = testSchema.parse(body)

  try {
    let docker: Docker

    if (data.dockerType === 'socket') {
      docker = new Docker({ socketPath: data.dockerDaemon })
    } else {
      // Parse TCP URL
      const url = new URL(data.connectionUrl!)
      docker = new Docker({
        host: url.hostname,
        port: parseInt(url.port) || 2375,
        protocol: url.protocol.replace(':', '') as 'http' | 'https'
      })
    }

    // Test connection by listing containers
    const containers = await docker.listContainers({ all: true })
    
    return {
      success: true,
      message: `Connected successfully. Found ${containers.length} containers.`
    }
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: `Connection failed: ${error.message}`
    })
  }
})
