<template>
  <UModal v-model:open="isOpen" :title="isEditing ? $t('Edit Docker Host') : $t('Add Docker Host')">
    <template #body>
      <UForm :state="form" :schema="schema" @submit="handleSubmit" class="space-y-4">
        <!-- Name -->
        <UFormField name="name" :label="$t('Friendly Name')" required>
          <UInput
            v-model="form.name"
            :placeholder="$t('My Docker Host')"
          />
        </UFormField>

        <!-- Connection Type -->
        <UFormField name="connectionType" :label="$t('Connection Type')" required>
          <USelect
            v-model="form.connectionType"
            :items="connectionTypes"
            value-key="value"
            label-key="label"
          />
        </UFormField>

        <!-- Socket Path (for socket connection) -->
        <UFormField 
          v-if="form.connectionType === 'socket'" 
          name="dockerDaemon" 
          :label="$t('Docker Daemon')"
          required
        >
          <UInput
            v-model="form.dockerDaemon"
            placeholder="/var/run/docker.sock"
          />
          <template #hint>
            <span class="text-xs text-gray-500">
              {{ $t('Unix socket path to Docker daemon') }}
            </span>
          </template>
        </UFormField>

        <!-- Docker Host (for TCP connection) -->
        <UFormField 
          v-if="form.connectionType === 'tcp'" 
          name="dockerHost" 
          :label="$t('Docker Host')"
          required
        >
          <UInput
            v-model="form.dockerHost"
            placeholder="tcp://192.168.1.100:2375"
          />
          <template #hint>
            <span class="text-xs text-gray-500">
              {{ $t('TCP endpoint for Docker daemon (e.g., tcp://host:2375)') }}
            </span>
          </template>
        </UFormField>

        <!-- TLS Settings (for TCP connection) -->
        <div v-if="form.connectionType === 'tcp'" class="space-y-4 p-4 border rounded-lg">
          <h4 class="font-medium">{{ $t('TLS Configuration') }}</h4>
          
          <UFormField name="tlsEnabled" :label="$t('Enable TLS')">
            <USwitch v-model="form.tlsEnabled" />
          </UFormField>

          <template v-if="form.tlsEnabled">
            <UFormField name="tlsCA" :label="$t('CA Certificate')">
              <UTextarea
                v-model="form.tlsCA"
                :placeholder="$t('Paste CA certificate content')"
                :rows="4"
              />
            </UFormField>

            <UFormField name="tlsCert" :label="$t('Client Certificate')">
              <UTextarea
                v-model="form.tlsCert"
                :placeholder="$t('Paste client certificate content')"
                :rows="4"
              />
            </UFormField>

            <UFormField name="tlsKey" :label="$t('Client Key')">
              <UTextarea
                v-model="form.tlsKey"
                :placeholder="$t('Paste client key content')"
                :rows="4"
              />
            </UFormField>
          </template>
        </div>

        <!-- Test Connection -->
        <div class="flex items-center gap-2">
          <UButton
            variant="outline"
            @click="testConnection"
            :loading="isTesting"
          >
            <UIcon name="i-heroicons-signal" class="mr-1" />
            {{ $t('Test Connection') }}
          </UButton>
          
          <span v-if="testResult" class="text-sm" :class="testResult.success ? 'text-green-500' : 'text-red-500'">
            {{ testResult.message }}
          </span>
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

interface DockerHost {
  id?: number
  name: string
  connectionType: 'socket' | 'tcp'
  dockerDaemon?: string
  dockerHost?: string
  tlsEnabled?: boolean
  tlsCA?: string
  tlsCert?: string
  tlsKey?: string
}

const props = defineProps<{
  dockerHost?: DockerHost
}>()

const emit = defineEmits<{
  (e: 'save', host: DockerHost): void
  (e: 'delete', hostId: number): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const isEditing = computed(() => !!props.dockerHost?.id)
const isSubmitting = ref(false)
const isTesting = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const schema = z.object({
  name: z.string().min(1, t('Name is required')),
  connectionType: z.enum(['socket', 'tcp']),
  dockerDaemon: z.string().optional(),
  dockerHost: z.string().optional(),
  tlsEnabled: z.boolean().optional(),
  tlsCA: z.string().optional(),
  tlsCert: z.string().optional(),
  tlsKey: z.string().optional(),
})

const defaultForm: DockerHost = {
  name: '',
  connectionType: 'socket',
  dockerDaemon: '/var/run/docker.sock',
  dockerHost: '',
  tlsEnabled: false,
  tlsCA: '',
  tlsCert: '',
  tlsKey: '',
}

const form = reactive<DockerHost>({ ...defaultForm })

const connectionTypes = [
  { value: 'socket', label: t('Unix Socket') },
  { value: 'tcp', label: t('TCP') },
]

// Reset form when opening
watch(isOpen, (open) => {
  if (open) {
    if (props.dockerHost) {
      Object.assign(form, props.dockerHost)
    } else {
      Object.assign(form, defaultForm)
    }
    testResult.value = null
  }
})

// Update form when dockerHost changes
watch(() => props.dockerHost, (host) => {
  if (host && isOpen.value) {
    Object.assign(form, host)
  }
}, { deep: true })

async function testConnection() {
  try {
    isTesting.value = true
    testResult.value = null
    
    // Call API to test Docker connection
    const response = await $fetch('/api/v1/docker-hosts/test', {
      method: 'POST',
      body: form
    })
    
    testResult.value = {
      success: true,
      message: t('Connection successful')
    }
  } catch (error: any) {
    testResult.value = {
      success: false,
      message: error.message || t('Connection failed')
    }
  } finally {
    isTesting.value = false
  }
}

async function handleSubmit() {
  try {
    isSubmitting.value = true
    
    const hostData: DockerHost = {
      ...form,
      id: props.dockerHost?.id,
    }
    
    // Clear irrelevant fields based on connection type
    if (hostData.connectionType === 'socket') {
      hostData.dockerHost = undefined
      hostData.tlsEnabled = undefined
      hostData.tlsCA = undefined
      hostData.tlsCert = undefined
      hostData.tlsKey = undefined
    } else {
      hostData.dockerDaemon = undefined
      if (!hostData.tlsEnabled) {
        hostData.tlsCA = undefined
        hostData.tlsCert = undefined
        hostData.tlsKey = undefined
      }
    }
    
    emit('save', hostData)
    isOpen.value = false
  } catch (error) {
    console.error('Failed to save Docker host:', error)
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete() {
  if (!props.dockerHost?.id) return
  
  const confirmed = confirm(t('Are you sure you want to delete this Docker host?'))
  if (confirmed) {
    emit('delete', props.dockerHost.id)
    isOpen.value = false
  }
}
</script>
