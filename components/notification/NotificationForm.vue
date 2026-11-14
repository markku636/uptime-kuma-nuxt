<script setup lang="ts">
const props=defineProps<{notification?:any;loading?:boolean}>()
const emit=defineEmits<{submit:[data:any];cancel:[]}>()
</script>
<template><SettingsResourceEditor kind="notification" :resource="props.notification" :loading="props.loading" @save="emit('submit',$event)" @cancel="emit('cancel')" /></template>
