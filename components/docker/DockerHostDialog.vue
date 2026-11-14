<script setup lang="ts">
const props=defineProps<{dockerHost?:any}>()
const emit=defineEmits<{save:[data:any];delete:[id:number]}>()
const isOpen=defineModel<boolean>('open',{default:false})
function save(input:any){emit('save',{...input,...(props.dockerHost?.id?{id:props.dockerHost.id}:{})});isOpen.value=false}
</script>
<template><UModal v-model:open="isOpen" title="Docker Host"><template #body><SettingsResourceEditor :key="dockerHost?.id||'new'" kind="dockerHost" :resource="dockerHost" @save="save" @cancel="isOpen=false" /></template></UModal></template>
