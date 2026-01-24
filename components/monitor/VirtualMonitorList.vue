<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import type { Monitor } from '~/types'

interface Props {
  monitors: Monitor[]
  loading?: boolean
  itemHeight?: number
  containerHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  itemHeight: 72,        // 每個項目高度 (px)
  containerHeight: 600   // 容器高度 (px)
})

const emit = defineEmits<{
  (e: 'select', monitor: Monitor): void
  (e: 'pause', monitor: Monitor): void
  (e: 'resume', monitor: Monitor): void
  (e: 'delete', monitor: Monitor): void
}>()

const selectedId = defineModel<number | null>('selectedId', { default: null })

// 使用 VueUse 的虛擬列表
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(
  computed(() => props.monitors),
  {
    itemHeight: props.itemHeight,
    overscan: 5  // 預先渲染上下各 5 個項目
  }
)

// 計算容器樣式
const containerStyle = computed(() => ({
  height: `${props.containerHeight}px`,
  overflow: 'auto'
}))

function getStatusColor(monitor: Monitor): string {
  if (!monitor.active) return 'gray'
  // 根據最新的 heartbeat 判斷狀態
  return 'green'
}

function getStatusText(monitor: Monitor): string {
  if (!monitor.active) return 'Paused'
  return 'Up'
}

function handleSelect(monitor: Monitor) {
  selectedId.value = monitor.id
  emit('select', monitor)
}

// 捲動到選中的項目
function scrollToSelected() {
  if (selectedId.value) {
    const index = props.monitors.findIndex(m => m.id === selectedId.value)
    if (index >= 0) {
      scrollTo(index)
    }
  }
}

// 暴露方法給父組件使用
defineExpose({
  scrollTo,
  scrollToSelected
})
</script>

<template>
  <div class="virtual-monitor-list">
    <!-- Loading State -->
    <div v-if="loading" class="space-y-2 p-2">
      <div
        v-for="i in 8"
        :key="i"
        class="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
      ></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="monitors.length === 0"
      class="text-center py-12 text-gray-500"
    >
      <UIcon name="i-heroicons-server" class="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <p>No monitors found</p>
    </div>

    <!-- Virtual List -->
    <template v-else>
      <!-- 列表統計 -->
      <div class="flex items-center justify-between px-3 py-2 text-sm text-secondary border-b border-default">
        <span>{{ monitors.length }} monitors</span>
        <span class="text-xs text-tertiary">Virtual scroll enabled</span>
      </div>

      <!-- 虛擬捲軸容器 -->
      <div
        v-bind="containerProps"
        :style="containerStyle"
        class="virtual-container"
      >
        <div v-bind="wrapperProps">
          <div
            v-for="{ data: monitor, index } in list"
            :key="monitor.id"
            :style="{ height: `${itemHeight}px` }"
            :class="[
              'flex items-center gap-3 px-3 cursor-pointer transition-colors border-b border-default',
              selectedId === monitor.id
                ? 'bg-primary-50 dark:bg-primary-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            ]"
            @click="handleSelect(monitor)"
          >
            <!-- Status Indicator -->
            <span
              :class="[
                'w-3 h-3 rounded-full flex-shrink-0',
                getStatusColor(monitor) === 'green' ? 'bg-green-500' :
                getStatusColor(monitor) === 'red' ? 'bg-red-500' : 'bg-gray-400'
              ]"
            ></span>

            <!-- Monitor Info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate text-primary">{{ monitor.name }}</p>
              <p class="text-xs text-tertiary truncate">
                <span class="uppercase font-medium mr-2">{{ monitor.type }}</span>
                {{ monitor.url || monitor.hostname || monitor.keyword }}
              </p>
            </div>

            <!-- Status Badge -->
            <UBadge
              :color="getStatusColor(monitor) === 'green' ? 'success' :
                     getStatusColor(monitor) === 'red' ? 'error' : 'neutral'"
              size="xs"
            >
              {{ getStatusText(monitor) }}
            </UBadge>

            <!-- Actions Dropdown -->
            <UDropdownMenu
              :items="[
                [{
                  label: monitor.active ? 'Pause' : 'Resume',
                  icon: monitor.active ? 'i-heroicons-pause' : 'i-heroicons-play',
                  onSelect: () => monitor.active ? emit('pause', monitor) : emit('resume', monitor)
                },
                {
                  label: 'Edit',
                  icon: 'i-heroicons-pencil',
                  to: `/monitors/${monitor.id}/edit`
                }],
                [{
                  label: 'Delete',
                  icon: 'i-heroicons-trash',
                  color: 'error',
                  onSelect: () => emit('delete', monitor)
                }]
              ]"
            >
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                variant="ghost"
                size="xs"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.virtual-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.virtual-container::-webkit-scrollbar {
  width: 6px;
}

.virtual-container::-webkit-scrollbar-track {
  background: transparent;
}

.virtual-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.virtual-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.7);
}

:root.dark .virtual-container {
  scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
}

:root.dark .virtual-container::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

:root.dark .virtual-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(75, 85, 99, 0.7);
}
</style>
