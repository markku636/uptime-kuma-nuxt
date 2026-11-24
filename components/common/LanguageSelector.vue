<script setup lang="ts">
/**
 * Language selector. Uses a searchable menu so 70+ locales stay usable.
 */
const { locale, locales, setLocale } = (useI18n as any)()

const availableLocales = computed(() => {
  const options = (locales.value as Array<{ code: string; name: string }>).map(l => ({
    label: l.name,
    value: l.code,
  }))
  return options.sort((a, b) => a.label.localeCompare(b.label))
})

const currentLocale = computed({
  get: () => locale.value,
  set: (value: string) => setLocale(value as Parameters<typeof setLocale>[0])
})
</script>

<template>
  <USelectMenu
    v-model="currentLocale"
    :items="availableLocales"
    value-key="value"
    label-key="label"
    searchable
    search-placeholder="Search language…"
    placeholder="Select language"
    class="w-full sm:w-56"
    :content="{ side: 'bottom', sideOffset: 6, collisionPadding: 12 }"
    :ui="{ content: 'z-50 max-h-72 overflow-y-auto w-[var(--reka-select-trigger-width)]' }"
  />
</template>
