// composables/useUptime.ts
import { HeartbeatStatus } from '~/types/heartbeat'

export const useUptime = () => {
  const calculateUptime = (heartbeats: any[], period?: '24h' | '7d' | '30d') => {
    if (!heartbeats || heartbeats.length === 0) return 0

    let filteredHeartbeats = heartbeats

    if (period) {
      const now = new Date()
      const cutoff = new Date()
      
      switch (period) {
        case '24h':
          cutoff.setHours(now.getHours() - 24)
          break
        case '7d':
          cutoff.setDate(now.getDate() - 7)
          break
        case '30d':
          cutoff.setDate(now.getDate() - 30)
          break
      }

      filteredHeartbeats = heartbeats.filter(h => new Date(h.time) >= cutoff)
    }

    if (filteredHeartbeats.length === 0) return 0

    const upCount = filteredHeartbeats.filter(h => h.status === HeartbeatStatus.UP).length
    return (upCount / filteredHeartbeats.length) * 100
  }

  const calculateAveragePing = (heartbeats: any[]) => {
    if (!heartbeats || heartbeats.length === 0) return 0

    const pings = heartbeats
      .filter(h => h.ping != null && h.status === HeartbeatStatus.UP)
      .map(h => h.ping)

    if (pings.length === 0) return 0

    return pings.reduce((sum, ping) => sum + ping, 0) / pings.length
  }

  const getStatusText = (status: number) => {
    switch (status) {
      case HeartbeatStatus.UP:
        return 'Up'
      case HeartbeatStatus.DOWN:
        return 'Down'
      case HeartbeatStatus.PENDING:
        return 'Pending'
      case HeartbeatStatus.MAINTENANCE:
        return 'Maintenance'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: number) => {
    switch (status) {
      case HeartbeatStatus.UP:
        return 'green'
      case HeartbeatStatus.DOWN:
        return 'red'
      case HeartbeatStatus.PENDING:
        return 'yellow'
      case HeartbeatStatus.MAINTENANCE:
        return 'blue'
      default:
        return 'gray'
    }
  }

  return {
    calculateUptime,
    calculateAveragePing,
    getStatusText,
    getStatusColor,
  }
}
