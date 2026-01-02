// plugins/pwa.client.ts
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })
        
        console.log('[PWA] Service Worker registered:', registration.scope)
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('[PWA] New version available')
                // Optionally show update notification
              }
            })
          }
        })
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error)
      }
    })
  }

  // Handle app install prompt
  let deferredPrompt: any = null
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    console.log('[PWA] Install prompt available')
  })

  // Provide install function
  return {
    provide: {
      pwa: {
        canInstall: () => !!deferredPrompt,
        install: async () => {
          if (!deferredPrompt) return false
          
          deferredPrompt.prompt()
          const { outcome } = await deferredPrompt.userChoice
          deferredPrompt = null
          
          return outcome === 'accepted'
        },
        // Push notification support
        requestNotificationPermission: async () => {
          if (!('Notification' in window)) {
            console.warn('[PWA] Notifications not supported')
            return false
          }
          
          const permission = await Notification.requestPermission()
          return permission === 'granted'
        },
        // Subscribe to push notifications
        subscribeToPush: async (vapidPublicKey: string) => {
          const registration = await navigator.serviceWorker.ready
          
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          })
          
          return subscription
        }
      }
    }
  }
})

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
