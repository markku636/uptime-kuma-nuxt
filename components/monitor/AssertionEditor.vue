<script setup lang="ts">
import type { AssertionSet,AssertionSource,AssertionOperator } from '../../shared/types/assertions'
const props=defineProps<{modelValue?:AssertionSet|null,disabled?:boolean}>()
const emit=defineEmits<{ 'update:modelValue':[value:AssertionSet|null],validity:[valid:boolean] }>()
type Draft={id:string,source:AssertionSource,path:string,operator:AssertionOperator,expectedText:string}
const mode=ref<'all'|'any'>(props.modelValue?.mode||'all')
const rules=ref<Draft[]>((props.modelValue?.rules||[]).map((rule,index)=>({id:rule.id||`rule-${index+1}`,source:rule.source,path:rule.path||'',operator:rule.operator,expectedText:JSON.stringify(rule.expected)??''})))
const error=ref('')
const sources:AssertionSource[]=['status','responseTime','header','text','json','jsonSchema']
const unaryOperators:AssertionOperator[]=['exists','notExists','isNull','isNotNull','isEmpty','isNotEmpty','isJson','isNumber','isString','isBoolean','isArray','isDefined','isUndefined','isTruthy','isFalsy']
const operators:AssertionOperator[]=['equals','notEquals','contains','notContains','gt','gte','lt','lte','in','notIn','startsWith','endsWith','length','between','matches','notMatches','schemaValid',...unaryOperators]
const sourceLabels:Record<AssertionSource,string>={status:'HTTP status',responseTime:'Response time (ms)',header:'Response header',text:'Response body text',json:'JSON body',jsonSchema:'JSON Schema (subset)'}
const operatorLabels:Record<AssertionOperator,string>={equals:'=',notEquals:'≠',contains:'contains',notContains:'does not contain',gt:'>',gte:'≥',lt:'<',lte:'≤',in:'in',notIn:'not in',startsWith:'starts with',endsWith:'ends with',length:'length',between:'between',matches:'matches',notMatches:'does not match',exists:'exists',notExists:'does not exist',isNull:'is null',isNotNull:'is not null',isEmpty:'is empty',isNotEmpty:'is not empty',isJson:'is JSON',isNumber:'is number',isString:'is string',isBoolean:'is boolean',isArray:'is array',isDefined:'is defined',isUndefined:'is undefined',isTruthy:'is truthy',isFalsy:'is falsy',schemaValid:'matches schema'}
const presets:{label:string;rule:Omit<Draft,'id'>}[]=[
  {label:'Status is 200',rule:{source:'status',path:'',operator:'equals',expectedText:'200'}},
  {label:'Status is 2xx (200-299)',rule:{source:'status',path:'',operator:'gte',expectedText:'200'}},
  {label:'Response time under 500 ms',rule:{source:'responseTime',path:'',operator:'lt',expectedText:'500'}},
  {label:'Content-Type contains json',rule:{source:'header',path:'content-type',operator:'contains',expectedText:'"json"'}},
  {label:'JSON field success is true',rule:{source:'json',path:'$.success',operator:'equals',expectedText:'true'}},
  {label:'JSON field exists',rule:{source:'json',path:'$.data',operator:'exists',expectedText:''}},
  {label:'JSON matches schema',rule:{source:'jsonSchema',path:'',operator:'schemaValid',expectedText:'{"type":"object","required":["success"],"properties":{"success":{"type":"boolean"}}}'}},
]
const preset=ref('')
const needsValue=(operator:string)=>!unaryOperators.includes(operator as AssertionOperator)
function ruleLabel(rule:Draft,index:number){
  const value=needsValue(rule.operator)?` ${rule.expectedText||''}`:''
  const path=['header','json'].includes(rule.source)&&rule.path?` ${rule.path}`:''
  return `Rule ${index+1}: ${sourceLabels[rule.source]||rule.source}${path} ${operatorLabels[rule.operator]||rule.operator}${value}`
}
function update(){
  try{
    const parsed=rules.value.map(rule=>{
      const result:any={id:rule.id,source:rule.source,operator:rule.operator}
      if(['header','json'].includes(rule.source))result.path=rule.path
      if(needsValue(rule.operator)){
        if(!rule.expectedText.trim())throw new Error('Enter a JSON value, for example true, 200, null or "ready".')
        result.expected=JSON.parse(rule.expectedText)
        if(['gt','gte','lt','lte','length'].includes(rule.operator)&&typeof result.expected!=='number')throw new Error('Numeric comparisons require a JSON number.')
        if(['in','notIn'].includes(rule.operator)&&!Array.isArray(result.expected))throw new Error('List comparisons require a JSON array.')
        if(['startsWith','endsWith'].includes(rule.operator)&&typeof result.expected!=='string')throw new Error('Text comparisons require a JSON string.')
        if(rule.operator==='between'&&(!Array.isArray(result.expected)||result.expected.length!==2||result.expected.some(value=>typeof value!=='number')))throw new Error('Between requires a JSON array of two numbers.')
      }
      return result
    })
    error.value='';emit('validity',true);emit('update:modelValue',parsed.length?{version:1,mode:mode.value,rules:parsed}:null)
  }catch(cause){error.value=cause instanceof SyntaxError?'Expected value must be valid JSON.':(cause as Error).message;emit('validity',false)}
}
function add(){rules.value.push({id:`rule-${Date.now()}-${rules.value.length}`,source:'json',path:'$.success',operator:'equals',expectedText:'true'});update()}
function addPreset(){
  const found=presets.find(p=>p.label===preset.value)
  if(found&&rules.value.length<20)rules.value.push({...found.rule,id:`rule-${Date.now()}-${rules.value.length}`})
  preset.value=''
  update()
}
function remove(index:number){rules.value.splice(index,1);update()}
watch([mode,rules],()=>update(),{deep:true})
</script>
<template>
  <fieldset class="space-y-4" :disabled="disabled">
    <legend class="text-lg font-semibold">Response assertions</legend>
    <p class="text-sm text-secondary">Add checks on status, response time, headers, body text or JSON. Values use JSON syntax (true, 200, "ready"). JSON paths support properties and array indexes.</p>
    <div class="flex flex-wrap gap-2 items-center">
      <label class="block min-w-48">Pass when
        <select v-model="mode" class="select-field mt-1"><option value="all">All rules pass</option><option value="any">Any rule passes</option></select>
      </label>
      <label class="block min-w-64">Quick add
        <select v-model="preset" class="select-field mt-1" @change="addPreset">
          <option value="">Choose a preset…</option>
          <option v-for="item in presets" :key="item.label" :value="item.label">{{ item.label }}</option>
        </select>
      </label>
    </div>
    <div v-for="(rule,index) in rules" :key="rule.id" class="rounded border border-default p-3 space-y-2">
      <div class="flex gap-2 items-center">
        <span class="text-sm font-medium text-highlighted">{{ ruleLabel(rule,index) }}</span>
        <button type="button" class="ml-auto text-red-400 text-sm" @click="remove(index)">Remove</button>
      </div>
      <div class="grid gap-2 md:grid-cols-2">
        <label class="block">Source
          <select v-model="rule.source" class="select-field mt-1"><option v-for="source in sources" :key="source" :value="source">{{ sourceLabels[source] }}</option></select>
        </label>
        <label class="block">Operator
          <select v-model="rule.operator" class="select-field mt-1"><option v-for="operator in rule.source==='jsonSchema'?['schemaValid']:operators" :key="operator" :value="operator">{{ operatorLabels[operator] }} ({{ operator }})</option></select>
        </label>
      </div>
      <label v-if="['header','json'].includes(rule.source)" class="block">{{ rule.source==='json'?'JSON path':'Header name' }}
        <input v-model="rule.path" class="input-field mt-1" :placeholder="rule.source==='json'?'$.success':'content-type'">
      </label>
      <label v-if="needsValue(rule.operator)" class="block">{{ rule.source==='jsonSchema'?'JSON Schema (subset) Values use a bounded subset: type, required, properties, items, enum, minimum, maximum, minLength, maxLength, pattern.':'Expected JSON value' }}
        <textarea v-model="rule.expectedText" class="input-field font-mono mt-1" rows="2" />
      </label>
    </div>
    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <div class="flex gap-2">
      <button type="button" class="btn btn-secondary" :disabled="rules.length>=20" @click="add">Add custom rule ({{ rules.length }}/20)</button>
    </div>
  </fieldset>
</template>
