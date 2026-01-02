<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="font-medium">Monitor Conditions</h4>
      <UButton 
        icon="i-heroicons-plus" 
        size="sm"
        @click="addCondition"
      >
        Add Condition
      </UButton>
    </div>

    <div v-if="conditions.length === 0" class="text-center py-4 text-gray-500">
      No conditions defined. Monitor will use default status detection.
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="(condition, index) in conditions"
        :key="index"
        class="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <!-- Variable -->
        <USelectMenu
          v-model="condition.variable"
          :items="variables"
          value-key="value"
          label-key="label"
          placeholder="Select variable"
          class="w-40"
        />

        <!-- Operator -->
        <USelectMenu
          v-model="condition.operator"
          :items="getOperatorsForVariable(condition.variable)"
          value-key="value"
          label-key="label"
          placeholder="Operator"
          class="w-32"
        />

        <!-- Value -->
        <UInput 
          v-model="condition.value"
          :placeholder="getPlaceholder(condition.variable)"
          class="flex-1"
        />

        <!-- Result -->
        <USelectMenu
          v-model="condition.result"
          :items="results"
          value-key="value"
          label-key="label"
          placeholder="Result"
          class="w-28"
        />

        <!-- Remove -->
        <UButton 
          icon="i-heroicons-trash" 
          variant="ghost" 
          color="red"
          size="sm"
          @click="removeCondition(index)"
        />
      </div>
    </div>

    <div class="text-sm text-gray-500 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <p class="font-medium mb-1">How conditions work:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>Conditions are evaluated in order</li>
        <li>The first matching condition determines the status</li>
        <li>If no condition matches, the monitor uses default detection</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Condition {
  variable: string
  operator: string
  value: string
  result: string
}

const props = defineProps<{
  modelValue: Condition[]
}>()

const emit = defineEmits<{
  'update:modelValue': [conditions: Condition[]]
}>()

const conditions = computed({
  get: () => props.modelValue || [],
  set: (value) => emit('update:modelValue', value)
})

const variables = [
  { value: 'status_code', label: 'Status Code' },
  { value: 'response_time', label: 'Response Time (ms)' },
  { value: 'body', label: 'Response Body' },
  { value: 'header', label: 'Response Header' },
  { value: 'certificate_days', label: 'Certificate Days' }
]

const operators = {
  numeric: [
    { value: 'eq', label: '=' },
    { value: 'ne', label: '≠' },
    { value: 'lt', label: '<' },
    { value: 'le', label: '≤' },
    { value: 'gt', label: '>' },
    { value: 'ge', label: '≥' }
  ],
  string: [
    { value: 'eq', label: 'equals' },
    { value: 'ne', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'regex', label: 'matches regex' },
    { value: 'not_regex', label: 'not matches regex' }
  ]
}

const results = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'pending', label: 'Pending' }
]

function getOperatorsForVariable(variable: string) {
  if (['status_code', 'response_time', 'certificate_days'].includes(variable)) {
    return operators.numeric
  }
  return operators.string
}

function getPlaceholder(variable: string) {
  const placeholders: Record<string, string> = {
    status_code: '200',
    response_time: '1000',
    body: 'search text',
    header: 'Header-Name: value',
    certificate_days: '30'
  }
  return placeholders[variable] || 'value'
}

function addCondition() {
  const newConditions = [...conditions.value, {
    variable: 'status_code',
    operator: 'eq',
    value: '200',
    result: 'up'
  }]
  emit('update:modelValue', newConditions)
}

function removeCondition(index: number) {
  const newConditions = [...conditions.value]
  newConditions.splice(index, 1)
  emit('update:modelValue', newConditions)
}
</script>
