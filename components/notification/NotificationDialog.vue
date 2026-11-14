<script setup lang="ts">
const props=defineProps<{notification?:any}>()
const emit=defineEmits<{saved:[data:any];closed:[]}>()
const isOpen=defineModel<boolean>('open',{default:false}),saving=ref(false),message=ref('')
function close(){isOpen.value=false;emit('closed')}
async function save(input:any){saving.value=true;try{const endpoint:string='/api/v1/notifications'+(props.notification?.id?'/'+props.notification.id:'');const response:any=await $fetch<any>(endpoint,{method:props.notification?.id?'PUT':'POST',body:input});emit('saved',response.data);close()}catch(error:any){message.value=error.data?.message||'Unable to save'}finally{saving.value=false}}
</script>
<template><UModal v-model:open="isOpen" title="Notification"><template #body><p v-if="message" role="status">{{message}}</p><NotificationForm :key="notification?.id||'new'" :notification="notification" :loading="saving" @submit="save" @cancel="close" /></template></UModal></template>
