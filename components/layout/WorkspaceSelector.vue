<template>
  <div v-if="current" class="flex items-center gap-2 text-sm">
    <select aria-label="Workspace" class="max-w-44 rounded border border-current/20 bg-transparent px-2 py-1" :value="current.id" @change="change(Number(($event.target as HTMLSelectElement).value))">
      <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">{{ workspace.name }}</option>
    </select>
    <select aria-label="Environment" class="max-w-32 rounded border border-current/20 bg-transparent px-2 py-1" :value="environment?.id" @change="change(current.id, Number(($event.target as HTMLSelectElement).value))">
      <option v-for="item in current.environments" :key="item.id" :value="item.id">{{ item.name }}</option>
    </select>
    <NuxtLink to="/settings/workspaces" aria-label="Manage workspace" class="text-muted hover:text-primary"><UIcon name="i-heroicons-cog-6-tooth" /></NuxtLink>
  </div>
</template>
<script setup lang="ts">
const { workspaces, current, environment, load, change } = useWorkspace()
onMounted(() => load().catch(() => {}))
</script>
