<script setup lang="ts">
/**
 * Shared select-menu shell: consistent popup background, stacking, trigger
 * padding (so the chevron never overlaps the label) and clickable items.
 * All USelectMenu props, v-model and slots pass through.
 */
const attrs = useAttrs()
const content = computed<any>(() => ({
  side: 'bottom', sideOffset: 6, collisionPadding: 12,
  ...((attrs.content as Record<string, unknown>) || {}),
}))
const ui = computed<any>(() => ({
  base: 'w-full pr-10',
  content: 'z-[100] bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black/10 dark:ring-white/10 max-h-72 overflow-y-auto w-[var(--reka-select-trigger-width)]',
  item: 'cursor-pointer',
  ...((attrs.ui as Record<string, unknown>) || {}),
}))
</script>

<template>
  <USelectMenu v-bind="$attrs" :content="content" :ui="ui">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </USelectMenu>
</template>
