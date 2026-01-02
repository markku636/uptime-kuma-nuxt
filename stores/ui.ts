// stores/ui.ts
import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    theme: 'auto' as 'light' | 'dark' | 'auto',
    showNotifications: true,
    soundEnabled: true,
  }),

  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },

    setTheme(theme: 'light' | 'dark' | 'auto') {
      this.theme = theme
    },

    toggleNotifications() {
      this.showNotifications = !this.showNotifications
    },

    toggleSound() {
      this.soundEnabled = !this.soundEnabled
    },
  },

  persist: true,
})
