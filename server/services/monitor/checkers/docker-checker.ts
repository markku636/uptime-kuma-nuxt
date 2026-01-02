// server/services/monitor/checkers/docker-checker.ts
import type { CheckResult } from '../checker'
import axios from 'axios'
import https from 'https'
import fs from 'fs'
import path from 'path'

export async function checkDocker(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    if (!monitor.dockerContainer) {
      return {
        status: 0,
        ping: 0,
        msg: 'Docker container name/ID is required'
      }
    }

    const dockerHost = monitor.dockerHost || '/var/run/docker.sock'
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
