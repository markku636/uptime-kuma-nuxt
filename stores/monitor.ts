// stores/monitor.ts
import { defineStore } from 'pinia'

interface Heartbeat {
  id: bigint
  monitorId: number
  status: number
  time: string
  msg?: string
  ping?: number
  important: boolean
  duration: number
}

interface Monitor {
  id: number
  name: string
  type: string
  active: boolean
  heartbeats: Heartbeat[]
  [key: string]: any
}

export const useMonitorStore = defineStore('monitor', {
  state: () => ({
    monitors: [] as Monitor[],
    heartbeats: {} as Record<number, Heartbeat[]>,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    getMonitorById: (state) => (id: number) => {
      return state.monitors.find(m => m.id === id)
    },
    
    activeMonitors: (state) => {
      return state.monitors.filter(m => m.active)
    },
    
    monitorCount: (state) => state.monitors.length,
    
    stats: (state) => {
      const monitors = state.monitors
      return {
        total: monitors.length,
        up: monitors.filter(m => m.heartbeats?.[0]?.status === 1).length,
        down: monitors.filter(m => m.heartbeats?.[0]?.status === 0).length,
        pending: monitors.filter(m => m.heartbeats?.[0]?.status === 2).length,
        maintenance: monitors.filter(m => m.heartbeats?.[0]?.status === 3).length,
        paused: monitors.filter(m => !m.active).length,
      }
    },
  },

  actions: {
    async fetchMonitors() {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<{ ok: boolean; data: Monitor[] }>('/api/v1/monitors')
        if (response.ok) {
          this.monitors = response.data
        }
      } catch (e: any) {
        this.error = e.data?.message || 'Failed to fetch monitors'
      } finally {
        this.loading = false
      }
    },

    updateMonitor(monitor: Monitor) {
      const index = this.monitors.findIndex(m => m.id === monitor.id)
      if (index !== -1) {
        this.monitors[index] = monitor
      } else {
        this.monitors.push(monitor)
      }
    },

    removeMonitor(id: number) {
      this.monitors = this.monitors.filter(m => m.id !== id)
    },

    addHeartbeat(monitorId: number, heartbeat: Heartbeat) {
      const monitor = this.monitors.find(m => m.id === monitorId)
      if (monitor) {
        if (!monitor.heartbeats) {
          monitor.heartbeats = []
        }
        monitor.heartbeats.unshift(heartbeat)
        // Keep only last 100 heartbeats
        if (monitor.heartbeats.length > 100) {
          monitor.heartbeats.pop()
        }
      }
    },
  },
})
