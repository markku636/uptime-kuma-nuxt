// stores/monitor.ts
import { defineStore } from 'pinia'

interface Heartbeat {
  id: string
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
    page:null as null|{hasMore:boolean;nextCursor:string|null;limit:number},
    summary:{total:0,up:0,down:0,pending:0,maintenance:0,paused:0,stale:0},
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
    
    stats:(state)=>state.summary,
  },

  actions: {
    async fetchMonitors(query:Record<string,any>={}) {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<{ ok: boolean; data: Monitor[];page:any }>('/api/v1/monitors',{query})
        if (response.ok) {
          this.monitors = response.data;this.page=response.page
          const summary=await $fetch<any>('/api/v1/monitors/summary');this.summary=summary.data
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
        // New records outside this page are available after refresh/search.
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
