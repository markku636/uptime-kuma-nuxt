<template>
  <Teleport to="body">
    <Transition name="fade">
      <div 
        v-if="showHelp" 
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        @click.self="close"
      >
        <div class="bg-default rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-default flex justify-between items-center">
            <h2 class="text-xl font-bold text-highlighted flex items-center gap-2">
              <UIcon name="i-heroicons-command-line" class="w-6 h-6" />
              Keyboard Shortcuts
            </h2>
            <button 
              @click="close"
              class="text-muted hover:text-default"
            >
              <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
            </button>
          </div>

          <!-- Shortcuts List -->
          <div class="px-6 py-4 max-h-96 overflow-y-auto">
            <div class="space-y-3">
              <div 
                v-for="shortcut in shortcuts" 
                :key="shortcut.key + (shortcut.shift ? '-shift' : '')"
                class="flex justify-between items-center"
              >
                <span class="text-default">
                  {{ shortcut.description }}
                </span>
                <kbd class="px-2 py-1 bg-elevated rounded text-sm font-mono text-highlighted border border-accented">
                  {{ formatShortcut(shortcut) }}
                </kbd>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 bg-muted text-center text-sm text-muted">
            Press <kbd class="px-1 py-0.5 bg-accented rounded text-xs">Esc</kbd> to close
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { shortcuts, showHelp, formatShortcut } = useKeyboardShortcuts()

function close() {
  showHelp.value = false
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
