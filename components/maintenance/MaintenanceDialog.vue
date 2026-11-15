<script setup lang="ts">
const props=defineProps<{maintenance?:any;monitors?:any[]}>(),emit=defineEmits<{saved:[data:any];closed:[]}>(),open=defineModel<boolean>('open',{default:false})
function close(){open.value=false;emit('closed')}
function saved(data:any){emit('saved',data);close()}
</script>
<template><div v-if="open" role="dialog" aria-modal="true" aria-label="Maintenance window" class="fixed inset-0 z-50 bg-black/70 p-3 sm:p-8 overflow-y-auto" @click.self="close"><div class="max-w-3xl mx-auto rounded-2xl bg-white dark:bg-gray-900 p-5 sm:p-7"><div class="flex justify-between items-center mb-5"><h2 class="text-xl font-semibold">{{props.maintenance?'Edit maintenance':'Schedule maintenance'}}</h2><button aria-label="Close maintenance dialog" @click="close">×</button></div><MaintenanceForm :maintenance="props.maintenance" @saved="saved" @cancel="close" /></div></div></template>
