<template>
  <div class="toggle-section">
    <!-- Header -->
    <button
      type="button"
      class="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
      :class="[
        isOpen 
          ? 'bg-elevated' 
          : 'hover:bg-muted',
        { 'cursor-not-allowed opacity-50': disabled }
      ]"
      :disabled="disabled"
      @click="toggle"
    >
      <div class="flex items-center gap-3">
        <UIcon
          v-if="icon"
          :name="icon"
          class="w-5 h-5 text-muted"
        />
        <div class="text-left">
          <h3 class="font-medium text-highlighted">
            {{ title }}
          </h3>
          <p v-if="subtitle" class="text-sm text-muted">
            {{ subtitle }}
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- Optional badge -->
        <UBadge v-if="badge" :color="badgeColor" size="xs">
          {{ badge }}
        </UBadge>
        
        <!-- Chevron -->
        <UIcon
          name="i-heroicons-chevron-down"
          class="w-5 h-5 text-dimmed transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        />
      </div>
    </button>

    <!-- Content -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="isOpen" class="pt-3">
        <div 
          class="pl-4 border-l-2 border-default"
          :class="contentClass"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  icon?: string
  badge?: string | number
  badgeColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  defaultOpen?: boolean
  disabled?: boolean
  contentClass?: string
}>(), {
  defaultOpen: false,
  disabled: false,
  badgeColor: 'primary',
})

const emit = defineEmits<{
  (e: 'toggle', isOpen: boolean): void
}>()

const isOpen = ref(props.defaultOpen)

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  emit('toggle', isOpen.value)
}

// Allow programmatic control
defineExpose({
  open: () => { isOpen.value = true },
  close: () => { isOpen.value = false },
  toggle,
})
</script>
