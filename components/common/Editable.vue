<template>
  <component
    :is="tag"
    ref="editableEl"
    :contenteditable="contenteditable"
    class="editable"
    :class="{ 'editable-active': contenteditable }"
    @input="onInput"
    @keydown="onKeydown"
    @blur="onBlur"
    @paste="onPaste"
  >
    {{ modelValue }}
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string
  tag?: string
  contenteditable?: boolean
  noNL?: boolean // No New Line - prevent Enter key
  placeholder?: string
}>(), {
  tag: 'div',
  contenteditable: false,
  noNL: false,
  placeholder: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editableEl = ref<HTMLElement | null>(null)

// Handle input event
function onInput(event: Event) {
  const target = event.target as HTMLElement
  const text = target.innerText || ''
  emit('update:modelValue', text)
}

// Handle keydown for preventing new lines if needed
function onKeydown(event: KeyboardEvent) {
  if (props.noNL && event.key === 'Enter') {
    event.preventDefault()
  }
}

// Handle blur event
function onBlur(event: FocusEvent) {
  const target = event.target as HTMLElement
  const text = target.innerText || ''
  emit('update:modelValue', text)
}

// Handle paste - strip formatting
function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') || ''
  
  // Insert plain text
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
  
  // Emit update
  if (editableEl.value) {
    emit('update:modelValue', editableEl.value.innerText || '')
  }
}

// Watch for external value changes
watch(() => props.modelValue, (newValue) => {
  if (editableEl.value && editableEl.value.innerText !== newValue) {
    editableEl.value.innerText = newValue
  }
})

// Set initial value on mount
onMounted(() => {
  if (editableEl.value) {
    editableEl.value.innerText = props.modelValue
  }
})
</script>

<style scoped>
.editable {
  outline: none;
  transition: background-color 0.2s, box-shadow 0.2s;
  min-height: 1em;
}

.editable-active {
  background-color: rgba(16, 185, 129, 0.05);
  box-shadow: inset 0 0 0 2px rgba(16, 185, 129, 0.3);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: text;
}

.editable-active:focus {
  box-shadow: inset 0 0 0 2px rgba(16, 185, 129, 0.5);
}

.editable:empty::before {
  content: attr(data-placeholder);
  color: var(--uk-text-muted);
}
</style>
