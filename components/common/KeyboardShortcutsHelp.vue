<template>
  <Teleport to="body">
    <Transition name="fade">
      <div 
        v-if="showHelp" 
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        @click.self="close"
      >
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-command-line" class="w-6 h-6" />
              Keyboard Shortcuts
            </h2>
            <button 
              @click="close"
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
                <span class="text-gray-700 dark:text-gray-300">
                  {{ shortcut.description }}
                </span>
                <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600">
                  {{ formatShortcut(shortcut) }}
                </kbd>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 text-center text-sm text-gray-500 dark:text-gray-400">
            Press <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd> to close
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
