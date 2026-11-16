<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()
const { user } = useAuth()

const loading = ref(false)
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)

const form = reactive({
  username: '',
  email: '',
  displayName: '',
  avatar: ''
})

onMounted(async () => {
  await fetchProfile()
})

async function fetchProfile() {
  try {
    const profile = await $fetch('/api/auth/profile') as any
    if (profile) {
      form.username = profile.username || ''
      form.email = profile.email || ''
      form.displayName = profile.displayName || ''
      form.avatar = profile.avatar || ''
      avatarPreview.value = profile.avatar || null
    }
  } catch (error) {
    // Use auth user data as fallback
    if (user.value) {
      form.username = user.value.username || ''
      form.email = user.value.email || ''
    }
  }
}

function handleAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    avatarFile.value = target.files[0]
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(target.files[0])
  }
}

function removeAvatar() {
  avatarFile.value = null
  avatarPreview.value = null
  form.avatar = ''
}

async function saveProfile() {
  loading.value = true
  try {
    const formData = new FormData()
    formData.append('displayName', form.displayName)
    formData.append('email', form.email)
    
    if (avatarFile.value) {
      formData.append('avatar', avatarFile.value)
    } else if (!avatarPreview.value) {
      formData.append('removeAvatar', 'true')
    }
    
    await $fetch('/api/auth/profile', {
      method: 'PUT',
      body: formData
    })
    
    toast.add({ title: 'Success', description: 'Profile updated successfully', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to update profile', color: 'error' })
  } finally {
    loading.value = false
  }
}

// Generate initials for avatar fallback
const initials = computed(() => {
  const name = form.displayName || form.username || 'U'
  return name.charAt(0).toUpperCase()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Profile Card -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-highlighted mb-6">Profile</h4>

      <form @submit.prevent="saveProfile" class="space-y-6">
        <!-- Avatar Section -->
        <div class="flex items-center gap-6">
          <div class="relative">
            <div 
              v-if="avatarPreview" 
              class="w-24 h-24 rounded-full overflow-hidden bg-accented"
            >
              <img :src="avatarPreview" alt="Avatar" class="w-full h-full object-cover" />
            </div>
            <div 
              v-else 
              class="w-24 h-24 rounded-full bg-up/20 flex items-center justify-center text-3xl font-bold text-up-fg"
            >
              {{ initials }}
            </div>
            
            <!-- Remove Avatar Button -->
            <button 
              v-if="avatarPreview"
              type="button"
              class="absolute -top-1 -right-1 w-6 h-6 bg-down rounded-full flex items-center justify-center hover:bg-down/90 transition-colors"
              @click="removeAvatar"
            >
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4 text-white" />
            </button>
          </div>
          
          <div>
            <label class="btn btn-secondary cursor-pointer">
              <UIcon name="i-heroicons-camera" class="w-4 h-4 mr-2" />
              Change Avatar
              <input 
                type="file" 
                accept="image/*" 
                class="hidden" 
                @change="handleAvatarChange"
              />
            </label>
            <p class="text-sm text-muted mt-2">JPG, PNG or GIF. Max 2MB.</p>
          </div>
        </div>

        <!-- Username (Read-only) -->
        <div>
          <label class="block text-sm font-medium text-default mb-2">Username</label>
          <input 
            v-model="form.username" 
            type="text" 
            class="input-field bg-elevated" 
            disabled 
          />
          <p class="text-sm text-muted mt-1">Username cannot be changed</p>
        </div>

        <!-- Display Name -->
        <div>
          <label class="block text-sm font-medium text-default mb-2">Display Name</label>
          <input 
            v-model="form.displayName" 
            type="text" 
            class="input-field" 
            placeholder="Your display name"
          />
          <p class="text-sm text-muted mt-1">This name will be shown in the UI</p>
        </div>

        <!-- Email -->
        <div>
          <label class="block text-sm font-medium text-default mb-2">Email</label>
          <input 
            v-model="form.email" 
            type="email" 
            class="input-field" 
            placeholder="your@email.com"
          />
          <p class="text-sm text-muted mt-1">Used for notifications (optional)</p>
        </div>

        <!-- Submit -->
        <div class="pt-4">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading" class="flex items-center gap-2">
              <span class="spinner w-4 h-4"></span>
              Saving...
            </span>
            <span v-else>Save Profile</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Account Info -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-highlighted mb-4">Account Information</h4>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 bg-elevated rounded-lg">
          <span class="text-sm text-toned block mb-1">Account Type</span>
          <span class="text-highlighted font-medium">Administrator</span>
        </div>
        <div class="p-4 bg-elevated rounded-lg">
          <span class="text-sm text-toned block mb-1">Member Since</span>
          <span class="text-highlighted font-medium">{{ new Date().toLocaleDateString() }}</span>
        </div>
      </div>
    </div>

    <!-- Quick Links -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-highlighted mb-4">Quick Links</h4>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NuxtLink 
          to="/settings/security" 
          class="flex items-center gap-3 p-3 bg-elevated rounded-lg hover:bg-accented transition-colors"
        >
          <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-up-fg" />
          <div>
            <span class="text-highlighted block">Security Settings</span>
            <span class="text-toned text-sm">Change password, 2FA</span>
          </div>
        </NuxtLink>
        
        <NuxtLink 
          to="/settings/appearance" 
          class="flex items-center gap-3 p-3 bg-elevated rounded-lg hover:bg-accented transition-colors"
        >
          <UIcon name="i-heroicons-paint-brush" class="w-5 h-5 text-purple-500 dark:text-purple-400" />
          <div>
            <span class="text-highlighted block">Appearance</span>
            <span class="text-toned text-sm">Theme, language</span>
          </div>
        </NuxtLink>
        
        <NuxtLink 
          to="/settings/notifications" 
          class="flex items-center gap-3 p-3 bg-elevated rounded-lg hover:bg-accented transition-colors"
        >
          <UIcon name="i-heroicons-bell" class="w-5 h-5 text-pending-fg" />
          <div>
            <span class="text-highlighted block">Notifications</span>
            <span class="text-toned text-sm">Setup notification channels</span>
          </div>
        </NuxtLink>
        
        <NuxtLink 
          to="/settings/api-keys" 
          class="flex items-center gap-3 p-3 bg-elevated rounded-lg hover:bg-accented transition-colors"
        >
          <UIcon name="i-heroicons-key" class="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <div>
            <span class="text-highlighted block">API Keys</span>
            <span class="text-toned text-sm">Manage API access</span>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
