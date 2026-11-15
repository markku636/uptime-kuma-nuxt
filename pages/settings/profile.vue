<script setup lang="ts">
definePageMeta({middleware:['auth']})
const {data:profile,pending,error,refresh}=await useFetch<any>('/api/auth/profile',{headers:useRequestHeaders(['cookie'])})
const timezone=ref('UTC'),saving=ref(false),saveError=ref(''),saved=ref(false)
watch(profile,value=>{if(value)timezone.value=value.timezone||'UTC'},{immediate:true})
const createdLabel=ref(''),interactive=ref(false)
onMounted(()=>{interactive.value=true;if(profile.value?.createdAt)createdLabel.value=new Date(profile.value.createdAt).toLocaleString()})
async function save(){if(!interactive.value||saving.value)return;saving.value=true;saveError.value='';saved.value=false;try{await $fetch('/api/auth/profile',{method:'PUT',body:{timezone:timezone.value}});await refresh();saved.value=true}catch(e:any){saveError.value=e.data?.message||'Unable to save profile'}finally{saving.value=false}}
</script>
<template>
 <div class="max-w-3xl space-y-6">
  <p v-if="pending" role="status">Loading profile…</p>
  <div v-else-if="error" role="alert" class="section-card space-y-3"><p>Unable to load your profile.</p><button class="btn btn-secondary" @click="refresh()">Retry</button></div>
  <template v-else-if="profile">
   <section class="section-card"><div class="flex items-center gap-4 mb-6"><div class="rounded-full bg-emerald-500/15 text-emerald-400 w-14 h-14 flex items-center justify-center text-xl font-semibold" aria-hidden="true">{{profile.username.charAt(0).toUpperCase()}}</div><div class="min-w-0"><h3 class="text-xl font-semibold break-words">{{profile.username}}</h3><p class="text-sm text-gray-400">Your account</p></div></div>
    <form class="space-y-5" @submit.prevent="save">
     <label class="block">Username<input :value="profile.username" readonly aria-label="Profile username" class="form-control mt-2" /></label>
     <label class="block">Timezone<input v-model="timezone" :disabled="!interactive||saving" aria-label="Profile timezone" class="form-control mt-2" maxlength="100" placeholder="UTC or Asia/Taipei" required /><span class="text-sm text-gray-400">Use an IANA timezone name.</span></label>
     <p v-if="saveError" role="alert" class="text-red-400">{{saveError}}</p><p v-if="saved" role="status" class="text-emerald-400">Profile saved.</p>
     <button class="btn btn-primary" :disabled="!interactive||saving">{{saving?'Saving…':'Save profile'}}</button>
    </form>
   </section>
   <section class="section-card"><h3 class="font-semibold mb-2">Member since</h3><time :datetime="profile.createdAt">{{createdLabel||profile.createdAt.slice(0,10)}}</time></section>
  </template>
  <section class="section-card"><h3 class="font-semibold mb-4">Account settings</h3><div class="grid sm:grid-cols-2 gap-3"><NuxtLink v-for="link in [{to:'/settings/security',name:'Security and two-factor authentication'},{to:'/settings/appearance',name:'Appearance'},{to:'/settings/notifications',name:'Notifications'},{to:'/settings/api-keys',name:'API keys'}]" :key="link.to" :to="link.to" class="rounded-lg border border-current/10 p-3 hover:bg-gray-500/10">{{link.name}}</NuxtLink></div></section>
 </div>
</template>
