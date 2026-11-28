<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
const { data: profile, pending, error, refresh } = await useFetch<any>('/api/auth/profile', { headers: useRequestHeaders(['cookie']) })
const timezone = ref('UTC'), saving = ref(false), saveError = ref(''), saved = ref(false)
watch(profile, value => { if (value) timezone.value = value.timezone || 'UTC' }, { immediate: true })
const createdLabel = ref(''), interactive = ref(false)
onMounted(() => {
  interactive.value = true
  if (profile.value?.createdAt) createdLabel.value = new Date(profile.value.createdAt).toLocaleString()
})
const commonTimezones = ['UTC', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Shanghai', 'Europe/London', 'America/Los_Angeles', 'America/New_York']

function useBrowserTimezone() {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) timezone.value = detected
  } catch { /* keep the current value */ }
}

async function save() {
  if (!interactive.value || saving.value) return
  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    await $fetch('/api/auth/profile', { method: 'PUT', body: { timezone: timezone.value } })
    await refresh()
    saved.value = true
  } catch (e: any) {
    saveError.value = e.data?.message || 'Unable to save profile'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-6xl space-y-6">
    <p v-if="pending" role="status">Loading profile…</p>
    <div v-else-if="error" role="alert" class="section-card space-y-3">
      <p>Unable to load your profile.</p>
      <button class="btn btn-secondary" @click="refresh()">Retry</button>
    </div>
    <template v-else-if="profile">
      <section class="section-card">
        <div class="flex items-center gap-4 mb-6">
          <div class="rounded-full bg-emerald-500/15 text-emerald-400 w-14 h-14 flex items-center justify-center text-xl font-semibold" aria-hidden="true">{{ profile.username.charAt(0).toUpperCase() }}</div>
          <div class="min-w-0">
            <h3 class="text-xl font-semibold break-words">{{ profile.username }}</h3>
            <p class="text-sm text-gray-400">Your account</p>
          </div>
        </div>

        <form class="space-y-6" @submit.prevent="save">
          <div class="grid gap-5 sm:grid-cols-2">
            <div>
              <label for="profile-username" class="block text-sm font-medium mb-1">Username</label>
              <input
                id="profile-username"
                :value="profile.username"
                readonly
                aria-label="Profile username"
                class="input-field w-full cursor-default opacity-80"
              />
              <p class="text-xs text-gray-400 mt-1">Username cannot be changed here.</p>
            </div>
            <div>
              <label for="profile-timezone" class="block text-sm font-medium mb-1">Timezone <span class="text-red-400">*</span></label>
              <input
                id="profile-timezone"
                v-model="timezone"
                :disabled="!interactive || saving"
                aria-label="Profile timezone"
                class="input-field w-full"
                list="profile-timezones"
                maxlength="100"
                placeholder="UTC or Asia/Taipei"
                required
              />
              <datalist id="profile-timezones">
                <option v-for="zone in commonTimezones" :key="zone" :value="zone"></option>
              </datalist>
              <p class="text-xs text-gray-400 mt-1">Use an IANA timezone name, e.g. <code>Asia/Taipei</code>.</p>
              <button type="button" class="btn btn-secondary btn-sm mt-2" :disabled="!interactive || saving" @click="useBrowserTimezone">Use my browser timezone</button>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button class="btn btn-primary" :disabled="!interactive || saving">{{ saving ? 'Saving…' : 'Save profile' }}</button>
            <p v-if="saveError" role="alert" class="text-sm text-red-400">{{ saveError }}</p>
            <p v-else-if="saved" role="status" class="text-sm text-emerald-400">Profile saved.</p>
          </div>
        </form>
      </section>

      <section class="section-card">
        <h3 class="font-semibold mb-2">Member since</h3>
        <time :datetime="profile.createdAt">{{ createdLabel || profile.createdAt.slice(0, 10) }}</time>
      </section>
    </template>

    <section class="section-card">
      <h3 class="font-semibold mb-4">Account settings</h3>
      <div class="grid sm:grid-cols-2 gap-3">
        <NuxtLink
          v-for="link in [
            { to: '/settings/security', name: 'Security and two-factor authentication' },
            { to: '/settings/appearance', name: 'Appearance' },
            { to: '/settings/notifications', name: 'Notifications' },
            { to: '/settings/api-keys', name: 'API keys' },
          ]"
          :key="link.to"
          :to="link.to"
          class="rounded-lg border border-current/10 p-3 hover:bg-gray-500/10"
        >{{ link.name }}</NuxtLink>
      </div>
    </section>
  </div>
</template>
