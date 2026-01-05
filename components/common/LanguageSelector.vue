<script setup lang="ts">
/**
 * Language Selector Component
 * Allows users to switch between available languages
 */

const { locale, locales, setLocale } = useI18n()

const availableLocales = computed(() => {
  return (locales.value as Array<{ code: string; name: string }>).map(l => ({
    label: l.name,
    value: l.code
  }))
})

const currentLocale = computed({
  get: () => locale.value,
  set: (value: string) => setLocale(value)
})
</script>

<template>
  <USelect
    v-model="currentLocale"
    :items="availableLocales"
    class="w-40"
  />
</template>
