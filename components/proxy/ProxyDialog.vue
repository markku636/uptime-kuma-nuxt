<script setup lang="ts">
const props=defineProps<{proxy?:any}>()
const emit=defineEmits<{save:[data:any];delete:[id:number]}>()
const isOpen=defineModel<boolean>('open',{default:false})
function save(input:any){emit('save',{...input,...(props.proxy?.id?{id:props.proxy.id}:{})});isOpen.value=false}
</script>
<template><UModal v-model:open="isOpen" title="Proxy"><template #body><SettingsResourceEditor :key="proxy?.id||'new'" kind="proxy" :resource="proxy" @save="save" @cancel="isOpen=false" /></template></UModal></template>
