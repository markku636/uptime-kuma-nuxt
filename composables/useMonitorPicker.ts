/** Searchable, bounded options; selected values are never replaced by a page. */
export function useMonitorPicker(selected:Ref<number[]>){
 const page=useMonitorPage(),known=shallowRef<Map<number,any>>(new Map()),loadingSelected=ref(false)
 watch(page.monitors,rows=>{const cache=new Map(known.value);for(const row of rows)cache.set(row.id,row);known.value=cache},{immediate:true})
 watch(selected,async ids=>{
   const missing=[...new Set(ids)].filter(id=>!known.value.has(id));if(!missing.length)return
   loadingSelected.value=true
   try{for(let i=0;i<missing.length;i+=200){const response=await $fetch<any>('/api/v1/monitors/lookup',{query:{ids:missing.slice(i,i+200).join(',')}});const cache=new Map(known.value);for(const row of response.data)cache.set(row.id,row);known.value=cache}}
   finally{loadingSelected.value=false}
 },{immediate:true,deep:true})
 return {...page,selectedMonitors:computed(()=>selected.value.map(id=>known.value.get(id)||{id,name:`Monitor ${id}`})),loadingSelected}
}
