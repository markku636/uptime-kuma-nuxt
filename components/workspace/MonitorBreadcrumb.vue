<script setup lang="ts">
// "Workspace › Group › Subgroup" for a monitor. Clicking the workspace or a
// group opens the monitor list in that workspace.

const props = defineProps<{
  monitor: { id: number; parent?: number | null; workspaceId?: number | null }
}>()

const { t } = useI18n()
const { workspaces, groups, current } = useWorkspaces()

const workspace = computed(() => workspaces.value.find(w => w.id === props.monitor.workspaceId) ?? null)

// Parent chain, outermost first (guarded against corrupted, cyclic data)
const chain = computed(() => {
  const byId = new Map(groups.value.map(g => [g.id, g]))
  const result = []
  let parent = props.monitor.parent != null ? byId.get(props.monitor.parent) : undefined
  for (let i = 0; parent && i < 10; i++) {
    result.unshift(parent)
    parent = parent.parent != null ? byId.get(parent.parent) : undefined
  }
  return result
})

function open() {
  current.value = workspace.value?.id ?? 'all'
  return navigateTo('/monitors')
}
</script>

<template>
  <nav v-if="workspace || chain.length" :aria-label="t('Workspace & Group')" class="flex flex-wrap items-center gap-1.5 text-sm text-muted">
    <button v-if="workspace" type="button" class="inline-flex items-center gap-1.5 hover:text-highlighted" @click="open">
      <span class="size-2.5 rounded-full" :style="{ backgroundColor: workspace.color }" aria-hidden="true" />
      {{ workspace.name }}
    </button>
    <template v-for="(group, index) in chain" :key="group.id">
      <UIcon v-if="workspace || index > 0" name="i-heroicons-chevron-right" class="size-3.5 text-dimmed" aria-hidden="true" />
      <NuxtLink :to="`/monitors/${group.id}`" class="inline-flex items-center gap-1 hover:text-highlighted">
        <UIcon name="i-heroicons-folder" class="size-3.5" aria-hidden="true" />
        {{ group.name }}
      </NuxtLink>
    </template>
  </nav>
</template>
