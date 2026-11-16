<template>
  <div class="logo-uploader">
    <!-- Logo Preview -->
    <div 
      class="logo-preview"
      :class="{ 'editable': editMode }"
      @click="openUploader"
    >
      <img
        v-if="logoUrl"
        :src="logoUrl"
        alt="Logo"
        class="logo-image"
      />
      <div v-else class="logo-placeholder">
        <UIcon name="i-heroicons-photo" />
      </div>
      
      <!-- Upload overlay in edit mode -->
      <div v-if="editMode" class="upload-overlay">
        <UIcon name="i-heroicons-arrow-up-tray" />
        <span>Upload</span>
      </div>
    </div>

    <!-- File Input (hidden) -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Crop Modal -->
    <UModal 
      v-model:open="showCropModal"
      title="Crop Image"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div v-if="previewImage" class="crop-container">
          <img
            ref="cropImage"
            :src="previewImage"
            alt="Crop preview"
            class="crop-image"
          />
        </div>
      </template>

      <template #footer="{ close }">
        <UButton variant="ghost" @click="close">
          Cancel
        </UButton>
        <UButton color="primary" @click="confirmCrop">
          <UIcon name="i-heroicons-check" class="me-1" />
          Apply
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string
  editMode?: boolean
  width?: number
  height?: number
}>(), {
  modelValue: '',
  editMode: false,
  width: 128,
  height: 128
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'crop-success': [dataUrl: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const cropImage = ref<HTMLImageElement | null>(null)
const showCropModal = ref(false)
const previewImage = ref<string | null>(null)

const logoUrl = computed(() => {
  if (props.modelValue) {
    // If it's a data URL or absolute URL, use as is
    if (props.modelValue.startsWith('data:') || props.modelValue.startsWith('http')) {
      return props.modelValue
    }
    // Otherwise assume it's a relative path
    return props.modelValue
  }
  return ''
})

function openUploader() {
  if (props.editMode && fileInput.value) {
    fileInput.value.click()
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    console.error('Please select an image file')
    return
  }
  
  // Read file and show crop modal
  const reader = new FileReader()
  reader.onload = (e) => {
    previewImage.value = e.target?.result as string
    showCropModal.value = true
  }
  reader.readAsDataURL(file)
  
  // Reset input
  target.value = ''
}

function confirmCrop() {
  if (!previewImage.value) return
  
  // Create canvas for cropping
  const canvas = document.createElement('canvas')
  canvas.width = props.width
  canvas.height = props.height
  const ctx = canvas.getContext('2d')
  
  if (!ctx) return
  
  const img = new Image()
  img.onload = () => {
    // Calculate crop dimensions (center crop to square)
    const size = Math.min(img.width, img.height)
    const x = (img.width - size) / 2
    const y = (img.height - size) / 2
    
    // Draw cropped and resized image
    ctx.drawImage(img, x, y, size, size, 0, 0, props.width, props.height)
    
    // Get data URL
    const dataUrl = canvas.toDataURL('image/png')
    
    emit('update:modelValue', dataUrl)
    emit('crop-success', dataUrl)
    showCropModal.value = false
    previewImage.value = null
  }
  img.src = previewImage.value
}
</script>

<style scoped>
.logo-uploader {
  display: inline-block;
}

.logo-preview {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background: var(--uk-bg-raised, #f3f4f6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-preview.editable {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.logo-preview.editable:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-placeholder {
  font-size: 2rem;
  color: var(--uk-text-muted, #9ca3af);
}

.upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.logo-preview.editable:hover .upload-overlay {
  opacity: 1;
}

.upload-overlay svg {
  font-size: 1.5rem;
  margin-bottom: 4px;
}

.hidden {
  display: none;
}

.crop-modal {
  padding: 0;
}

.crop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--uk-border, var(--uk-border));
}

.crop-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--uk-text-muted);
  padding: 4px;
}

.btn-close:hover {
  color: var(--uk-text);
}

.crop-body {
  padding: 20px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crop-container {
  max-width: 100%;
  max-height: 400px;
}

.crop-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
}

.crop-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--uk-border, var(--uk-border));
}

.btn {
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.btn-primary {
  background: var(--color-primary, #10b981);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: var(--uk-primary-fg, #059669);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--uk-border, var(--uk-border-strong));
  color: var(--uk-text);
}

.btn-outline:hover {
  background: var(--uk-bg-raised, #f3f4f6);
}

.me-1 {
  margin-right: 4px;
}
</style>
