// server/services/monitor/checkers/docker-checker.ts
import type { CheckResult } from '../checker'
import axios from 'axios'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { prisma } from '../../../utils/prisma'

/**
 * Where to reach Docker: the monitor stores a Docker host's id (forms) or a
 * socket path / URL directly (imports, API). Plain http:// is kept as is.
 */
async function resolveDockerEndpoint(monitor: any): Promise<string> {
  const value = String(monitor.dockerHost ?? '').trim()
  if (/^\d+$/.test(value)) {
    const host = await prisma.dockerHost.findFirst({ where: { id: Number(value), userId: monitor.userId } })
    if (!host) throw new Error('Docker host not found')
    if (!host.active) throw new Error(`Docker host "${host.name}" is disabled`)
    const endpoint = (host.dockerType === 'tcp' ? host.connectionUrl : host.dockerDaemon) || host.dockerDaemon || host.connectionUrl
    if (!endpoint) throw new Error(`Docker host "${host.name}" has no socket or URL`)
    return endpoint
  }
  return value || '/var/run/docker.sock'
}

export async function checkDocker(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    if (!monitor.dockerContainer) {
      return {
        status: 0,
        ping: 0,
        msg: 'Docker container name/ID is required'
      }
    }

    const dockerHost = await resolveDockerEndpoint(monitor)
    const container = monitor.dockerContainer

    let containerInfo: any

    if (dockerHost.startsWith('/') || dockerHost.startsWith('unix://')) {
      // Unix socket connection
      const socketPath = dockerHost.replace('unix://', '')
      
      const response = await axios.get(`/containers/${container}/json`, {
        socketPath,
        timeout: (monitor.timeout || 48) * 1000
      })
      containerInfo = response.data
    } else if (dockerHost.startsWith('tcp://') || dockerHost.startsWith('https://')) {
      // TCP/TLS connection
      const url = dockerHost.replace('tcp://', 'https://').replace(/\/$/, '')
      
      const config: any = {
        timeout: (monitor.timeout || 48) * 1000
      }

      // TLS configuration
      if (monitor.dockerDaemon === 'tls') {
        const certPath = process.env.DOCKER_CERT_PATH || '/etc/docker/certs'
        config.httpsAgent = new https.Agent({
          cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
          key: fs.readFileSync(path.join(certPath, 'key.pem')),
          ca: fs.readFileSync(path.join(certPath, 'ca.pem')),
        })
      }

      const response = await axios.get(`${url}/containers/${container}/json`, config)
      containerInfo = response.data
    } else {
      return {
        status: 0,
        ping: 0,
        msg: 'Invalid Docker host format'
      }
    }

    const ping = Date.now() - startTime

    // Check if container is running
    const isRunning = containerInfo.State?.Running === true
    const status = containerInfo.State?.Status

    if (monitor.upsideDown) {
      return {
        status: isRunning ? 0 : 1,
        ping,
        msg: `Container status: ${status}`
      }
    }

    return {
      status: isRunning ? 1 : 0,
      ping,
      msg: `Container status: ${status}`
    }
  } catch (error: any) {
    const ping = Date.now() - startTime
    
    if (error.response?.status === 404) {
      return {
        status: monitor.upsideDown ? 1 : 0,
        ping,
        msg: 'Container not found'
      }
    }

    return {
      status: monitor.upsideDown ? 1 : 0,
      ping,
      msg: error.message || 'Docker check failed'
    }
  }
}
