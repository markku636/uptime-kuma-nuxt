<script setup lang="ts">
import type { AssertionSet,AssertionSource,AssertionOperator } from '../../shared/types/assertions'
const props=defineProps<{modelValue?:AssertionSet|null,disabled?:boolean}>()
const emit=defineEmits<{ 'update:modelValue':[value:AssertionSet|null],validity:[valid:boolean] }>()
type Draft={id:string,source:AssertionSource,path:string,operator:AssertionOperator,expectedText:string}
const mode=ref<'all'|'any'>(props.modelValue?.mode||'all')
const rules=ref<Draft[]>((props.modelValue?.rules||[]).map(rule=>({...rule,path:rule.path||'',expectedText:JSON.stringify(rule.expected)??''})))
const error=ref('')
const sources:AssertionSource[]=['status','responseTime','header','text','json']
const operators:AssertionOperator[]=['equals','notEquals','contains','notContains','gt','gte','lt','lte','exists','notExists','isNull','isNotNull']
const needsValue=(operator:string)=>!['exists','notExists','isNull','isNotNull'].includes(operator)
function update(){
  try{
    const parsed=rules.value.map(rule=>{
      const result:any={id:rule.id,source:rule.source,operator:rule.operator}
      if(['header','json'].includes(rule.source))result.path=rule.path
      if(needsValue(rule.operator)){
        if(!rule.expectedText.trim())throw new Error('Enter a JSON value, for example true, 200, null or "ready".')
        result.expected=JSON.parse(rule.expectedText)
        if(['gt','gte','lt','lte'].includes(rule.operator)&&typeof result.expected!=='number')throw new Error('Numeric comparisons require a JSON number.')
      }
      return result
    })
    error.value='';emit('validity',true);emit('update:modelValue',parsed.length?{version:1,mode:mode.value,rules:parsed}:null)
  }catch(cause){error.value=cause instanceof SyntaxError?'Expected value must be valid JSON.':(cause as Error).message;emit('validity',false)}
}
function add(){rules.value.push({id:`rule-${Date.now()}-${rules.value.length}`,source:'json',path:'$.success',operator:'equals',expectedText:'true'});update()}
function remove(index:number){rules.value.splice(index,1);update()}
</script>
<template>
  <fieldset class="space-y-4" :disabled="disabled">
    <legend class="text-lg font-semibold">Response assertions</legend>
    <p class="text-sm text-gray-400">Typed values use JSON. Missing properties differ from null. JSON paths support properties and array indexes.</p>
    <label class="block">Pass when
      <select v-model="mode" class="select-field mt-1" @change="update"><option value="all">All rules pass</option><option value="any">Any rule passes</option></select>
    </label>
    <div v-for="(rule,index) in rules" :key="rule.id" class="rounded border border-gray-700 p-3 space-y-2">
      <div class="flex gap-2 items-center"><span class="text-sm">{{ rule.id }}</span><button type="button" class="ml-auto text-red-400" @click="remove(index)">Remove rule</button></div>
      <label class="block">Source<select v-model="rule.source" class="select-field" @change="update"><option v-for="source in sources" :key="source" :value="source">{{ source }}</option></select></label>
      <label v-if="['header','json'].includes(rule.source)" class="block">{{ rule.source==='json'?'JSON path':'Header name' }}<input v-model="rule.path" class="input-field" :placeholder="rule.source==='json'?'$.success':'content-type'" @input="update"></label>
      <label class="block">Operator<select v-model="rule.operator" class="select-field" @change="update"><option v-for="operator in operators" :key="operator" :value="operator">{{ operator }}</option></select></label>
      <label v-if="needsValue(rule.operator)" class="block">Expected JSON value<textarea v-model="rule.expectedText" class="input-field font-mono" rows="2" @input="update" /></label>
    </div>
    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <button type="button" class="btn btn-secondary" :disabled="rules.length>=20" @click="add">Add assertion ({{ rules.length }}/20)</button>
  </fieldset>
</template>
