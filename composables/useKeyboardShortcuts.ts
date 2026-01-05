/**
 * Keyboard Shortcuts Composable
 * Provides global keyboard shortcuts for the application
 */

interface Shortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  description: string
  action: () => void
}

const shortcuts = ref<Shortcut[]>([])
const showHelp = ref(false)

export function useKeyboardShortcuts() {
  const router = useRouter()

  // Default shortcuts
  const defaultShortcuts: Shortcut[] = [
    {
      key: '/',
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]')
        searchInput?.focus()
      }
    },
    {
      key: 'n',
      description: 'Add new monitor',
      action: () => router.push('/monitors/add')
    },
    {
      key: 'd',
      description: 'Go to dashboard',
      action: () => router.push('/dashboard')
    },
    {
      key: 'm',
      description: 'Go to monitors',
      action: () => router.push('/monitors')
    },
    {
      key: 's',
      description: 'Go to settings',
      action: () => router.push('/settings')
    },
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      action: () => { showHelp.value = !showHelp.value }
    },
    {
      key: 'Escape',
      description: 'Close modal / Clear focus',
      action: () => {
        showHelp.value = false
        const activeElement = document.activeElement as HTMLElement
        activeElement?.blur()
      }
    }
  ]

  // Register shortcuts on mount
  onMounted(() => {
    shortcuts.value = [...defaultShortcuts]
    
    const handleKeydown = (event: KeyboardEvent) => {
      // Skip if typing in an input
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only allow Escape in inputs
        if (event.key !== 'Escape') return
      }

      for (const shortcut of shortcuts.value) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          event.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeydown)

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })
  })

  // Add custom shortcut
  function addShortcut(shortcut: Shortcut) {
    shortcuts.value.push(shortcut)
  }

  // Remove shortcut by key
  function removeShortcut(key: string) {
    shortcuts.value = shortcuts.value.filter(s => s.key !== key)
  }

  // Get formatted shortcut display
  function formatShortcut(shortcut: Shortcut): string {
    const parts: string[] = []
    if (shortcut.ctrl) parts.push('Ctrl')
    if (shortcut.alt) parts.push('Alt')
    if (shortcut.shift) parts.push('Shift')
    parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase())
    return parts.join(' + ')
  }

  return {
    shortcuts: computed(() => shortcuts.value),
    showHelp,
    addShortcut,
    removeShortcut,
    formatShortcut,
    toggleHelp: () => { showHelp.value = !showHelp.value }
  }
}
