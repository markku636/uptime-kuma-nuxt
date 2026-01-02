<template>
  <div class="space-y-4">
    <UFormField label="Authentication Type">
      <USelectMenu
        v-model="formData.authMethod"
        :items="authMethods"
        value-key="value"
        label-key="label"
        class="w-full"
        @update:model-value="emitUpdate"
      />
    </UFormField>

    <!-- Basic Auth -->
    <template v-if="formData.authMethod === 'basic'">
      <UFormField label="Username">
        <UInput 
          v-model="formData.basicAuthUser"
          placeholder="Username"
          class="w-full"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Password">
        <HiddenInput 
          v-model="formData.basicAuthPass"
          placeholder="Password"
          @blur="emitUpdate"
        />
      </UFormField>
    </template>

    <!-- NTLM Auth -->
    <template v-if="formData.authMethod === 'ntlm'">
      <UFormField label="Domain">
        <UInput 
          v-model="formData.authDomain"
          placeholder="DOMAIN"
          class="w-full"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Workstation">
        <UInput 
          v-model="formData.authWorkstation"
          placeholder="WORKSTATION"
          class="w-full"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Username">
        <UInput 
          v-model="formData.basicAuthUser"
          placeholder="Username"
          class="w-full"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Password">
        <HiddenInput 
          v-model="formData.basicAuthPass"
          placeholder="Password"
          @blur="emitUpdate"
        />
      </UFormField>
    </template>

    <!-- mTLS -->
    <template v-if="formData.authMethod === 'mtls'">
      <UFormField label="PFX/P12 Certificate (Base64)">
        <UTextarea 
          v-model="formData.tlsCert"
          placeholder="Paste base64-encoded certificate..."
          :rows="3"
          class="w-full font-mono text-sm"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Certificate Password">
        <HiddenInput 
          v-model="formData.tlsCertPassword"
          placeholder="Certificate password (if any)"
          @blur="emitUpdate"
        />
      </UFormField>
      <p class="text-sm text-gray-500">
        You can also provide PEM certificates:
      </p>
      <UFormField label="CA Certificate (PEM)">
        <UTextarea 
          v-model="formData.tlsCa"
          placeholder="-----BEGIN CERTIFICATE-----"
          :rows="3"
          class="w-full font-mono text-sm"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Client Key (PEM)">
        <UTextarea 
          v-model="formData.tlsKey"
          placeholder="-----BEGIN PRIVATE KEY-----"
          :rows="3"
          class="w-full font-mono text-sm"
          @blur="emitUpdate"
        />
      </UFormField>
    </template>

    <!-- OAuth2 CC -->
    <template v-if="formData.authMethod === 'oauth2-cc'">
      <UFormField label="OAuth2 Token URL">
        <UInput 
          v-model="formData.oauth2TokenUrl"
          placeholder="https://auth.example.com/oauth/token"
          class="w-full"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Client ID">
        <UInput 
          v-model="formData.oauth2ClientId"
          placeholder="client_id"
          class="w-full"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Client Secret">
        <HiddenInput 
          v-model="formData.oauth2ClientSecret"
          placeholder="client_secret"
          @blur="emitUpdate"
        />
      </UFormField>
      <UFormField label="Scopes">
        <UInput 
          v-model="formData.oauth2Scopes"
          placeholder="scope1 scope2"
          class="w-full"
          @blur="emitUpdate"
        />
        <template #hint>
          Space-separated list of scopes
        </template>
      </UFormField>
    </template>
  </div>
</template>

<script setup lang="ts">
interface AuthData {
  authMethod?: string | null
  basicAuthUser?: string
  basicAuthPass?: string
  authDomain?: string
  authWorkstation?: string
  tlsCert?: string
  tlsCertPassword?: string
  tlsCa?: string
  tlsKey?: string
  oauth2TokenUrl?: string
  oauth2ClientId?: string
  oauth2ClientSecret?: string
  oauth2Scopes?: string
}

const props = defineProps<{
  modelValue: AuthData
}>()

const emit = defineEmits<{
  'update:modelValue': [data: AuthData]
}>()

const formData = ref<AuthData>({})

// Sync with props
watch(() => props.modelValue, (newVal) => {
  formData.value = { ...newVal }
}, { immediate: true, deep: true })

const authMethods = [
  { value: null, label: 'None' },
  { value: 'basic', label: 'Basic Authentication' },
  { value: 'ntlm', label: 'NTLM' },
  { value: 'mtls', label: 'mTLS (Client Certificate)' },
  { value: 'oauth2-cc', label: 'OAuth2 Client Credentials' }
]

function emitUpdate() {
  emit('update:modelValue', { ...formData.value })
}
</script>
