<script setup lang="ts">
import type { AssertionEvaluation } from '../../shared/types/assertions'
defineProps<{result?:AssertionEvaluation|null}>()
</script>
<template>
  <div v-if="result" class="space-y-2" aria-live="polite">
    <p class="font-medium">Assertions: {{ result.passed ? 'Passed' : 'Failed' }}</p>
    <p v-if="result.error" class="text-red-400">{{ result.error }}</p>
    <ul class="space-y-1 text-sm">
      <li v-for="rule in result.rules" :key="rule.ruleId" :class="rule.passed ? 'text-green-400' : 'text-red-400'">
        {{ rule.passed ? '✓' : '✕' }} {{ rule.ruleId }} · {{ rule.source }} · {{ rule.operator }} · {{ rule.reason }}
      </li>
    </ul>
  </div>
</template>
