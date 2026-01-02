<script setup lang="ts">
interface Props {
  title: string
  defaultOpen?: boolean
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: false,
  icon: ''
})

const isOpen = ref(props.defaultOpen)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <button
      class="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      @click="toggle"
    >
      <div class="flex items-center gap-2">
        <UIcon v-if="icon" :name="icon" class="w-5 h-5 text-gray-500" />
        <span class="font-medium text-gray-900 dark:text-white">{{ title }}</span>
      </div>
      <UIcon
        name="i-heroicons-chevron-down"
        class="w-5 h-5 text-gray-500 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- Content -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[1000px]"
      leave-from-class="opacity-100 max-h-[1000px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-show="isOpen" class="overflow-hidden">
        <div class="p-4 border-t border-gray-200 dark:border-gray-700">
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>
