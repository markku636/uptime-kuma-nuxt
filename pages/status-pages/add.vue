<script setup lang="ts">
// The edit page handles create mode when there is no :id param
import StatusPageEditor from './[id]/edit.vue'

definePageMeta({
  middleware: ['auth']
})
</script>

<template>
  <StatusPageEditor />
</template>
