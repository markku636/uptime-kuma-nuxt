<template>
  <UModal v-model:open="isOpen" :title="isEditing ? $t('Edit Proxy') : $t('Add Proxy')">
    <template #body>
      <UForm :state="form" :schema="schema" @submit="handleSubmit" class="space-y-4">
        <!-- Active -->
        <UFormField name="active" :label="$t('Active')">
          <USwitch v-model="form.active" />
        </UFormField>

        <!-- Protocol -->
        <UFormField name="protocol" :label="$t('Protocol')" required>
          <USelect
            v-model="form.protocol"
            :items="protocolOptions"
            value-key="value"
            label-key="label"
          />
        </UFormField>

        <!-- Host -->
        <UFormField name="host" :label="$t('Host')" required>
          <UInput
            v-model="form.host"
            placeholder="proxy.example.com"
          />
        </UFormField>

        <!-- Port -->
        <UFormField name="port" :label="$t('Port')" required>
          <UInput
            v-model.number="form.port"
            type="number"
            :min="1"
            :max="65535"
            placeholder="8080"
          />
        </UFormField>

        <!-- Auth Toggle -->
        <UFormField name="auth" :label="$t('Authentication')">
          <USwitch v-model="form.auth" />
        </UFormField>

        <!-- Username -->
        <UFormField v-if="form.auth" name="username" :label="$t('Username')">
          <UInput
            v-model="form.username"
            autocomplete="username"
          />
        </UFormField>

        <!-- Password -->
        <UFormField v-if="form.auth" name="password" :label="$t('Password')">
          <UInput
            v-model="form.password"
            type="password"
            autocomplete="current-password"
          />
        </UFormField>

        <!-- Apply Existing -->
        <div v-if="isEditing" class="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-2">
          <UCheckbox
            v-model="applyExisting"
            :label="$t('Apply to all existing monitors')"
          />
          <p class="text-xs text-gray-500">
            {{ $t('This will update all monitors currently using this proxy.') }}
          </p>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-between">
        <UButton
          v-if="isEditing"
          variant="ghost"
          color="error"
          icon="i-heroicons-trash"
          @click="handleDelete"
        >
          {{ $t('Delete') }}
        </UButton>
        <div class="flex gap-2 ml-auto">
          <UButton variant="ghost" @click="isOpen = false">
            {{ $t('Cancel') }}
          </UButton>
          <UButton @click="handleSubmit" :loading="isSubmitting">
            {{ isEditing ? $t('Update') : $t('Add') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { z } from 'zod'

interface Proxy {
  id?: number
  protocol: string
  host: string
  port: number
  auth: boolean
  username?: string
  password?: string
  active: boolean
}

const props = defineProps<{
  proxy?: Proxy
}>()

const emit = defineEmits<{
  (e: 'save', proxy: Proxy): void
  (e: 'delete', proxyId: number): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const isEditing = computed(() => !!props.proxy?.id)
const isSubmitting = ref(false)
const applyExisting = ref(false)

const schema = z.object({
  protocol: z.string().min(1, t('Protocol is required')),
  host: z.string().min(1, t('Host is required')),
  port: z.number().min(1).max(65535, t('Port must be between 1 and 65535')),
  auth: z.boolean(),
  username: z.string().optional(),
  password: z.string().optional(),
  active: z.boolean(),
})

const defaultForm: Proxy = {
  protocol: 'http',
  host: '',
  port: 8080,
  auth: false,
  username: '',
  password: '',
  active: true,
}

const form = reactive<Proxy>({ ...defaultForm })

const protocolOptions = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks', label: 'SOCKS' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'socks5h', label: 'SOCKS5h' },
  { value: 'socks4', label: 'SOCKS4' },
]

// Reset form when opening
watch(isOpen, (open) => {
  if (open) {
    if (props.proxy) {
      Object.assign(form, props.proxy)
    } else {
      Object.assign(form, defaultForm)
    }
    applyExisting.value = false
  }
})

// Update form when proxy changes
watch(() => props.proxy, (proxy) => {
  if (proxy && isOpen.value) {
    Object.assign(form, proxy)
  }
}, { deep: true })

async function handleSubmit() {
  try {
    isSubmitting.value = true
    
    const proxyData: Proxy = {
      ...form,
      id: props.proxy?.id,
    }
    
    // Clear auth credentials if auth is disabled
    if (!proxyData.auth) {
      proxyData.username = undefined
      proxyData.password = undefined
    }
    
    emit('save', proxyData)
    isOpen.value = false
  } catch (error) {
    console.error('Failed to save proxy:', error)
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete() {
  if (!props.proxy?.id) return
  
  const confirmed = confirm(t('Are you sure you want to delete this proxy?'))
  if (confirmed) {
    emit('delete', props.proxy.id)
    isOpen.value = false
  }
}
</script>
