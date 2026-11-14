/** A page is an explicit view, never the complete monitor inventory. */
export function useMonitorPage(){
 const search=ref(''),status=ref('all'),type=ref('all'),cursor=ref<string|null>(null),previous=ref<(string|null)[]>([]),querySearch=ref(''),sequence=ref(0)
 let debounce:ReturnType<typeof setTimeout>|undefined
 watch(search,value=>{clearTimeout(debounce);debounce=setTimeout(()=>querySearch.value=value.trim(),250)})
 watch([querySearch,status,type],()=>{cursor.value=null;previous.value=[];sequence.value++})
 const query=computed(()=>({limit:100,search:querySearch.value,status:status.value,type:type.value==='all'?'':type.value,...(cursor.value?{cursor:cursor.value}:{})}))
 const {data,pending,error,refresh}=useFetch<any>('/api/v1/monitors',{query,headers:useRequestHeaders(['cookie'])})
 const {data:summaryData,refresh:refreshSummary}=useFetch<any>('/api/v1/monitors/summary',{headers:useRequestHeaders(['cookie'])})
 const monitors=computed<any[]>(()=>data.value?.data||[]),page=computed(()=>data.value?.page),summary=computed(()=>summaryData.value?.data||{total:0,up:0,down:0,pending:0,unknown:0,paused:0,maintenance:0,stale:0})
 function next(){if(!page.value?.nextCursor)return;previous.value.push(cursor.value);cursor.value=page.value.nextCursor;sequence.value++}
 function back(){if(!previous.value.length)return;cursor.value=previous.value.pop()!;sequence.value++}
 async function reload(){await Promise.all([refresh(),refreshSummary()])}
 onBeforeUnmount(()=>clearTimeout(debounce))
 return {search,status,type,monitors,pending,error,page,summary,next,back,canBack:computed(()=>previous.value.length>0),refresh:reload,sequence}
}
