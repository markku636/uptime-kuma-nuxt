/** Preserve receive order before starting asynchronous authorization or mutation. */
export class SerialQueue {
 private tail=Promise.resolve();private count=0
 constructor(private readonly limit=32){}
 get pending(){return this.count}
 enqueue(task:()=>Promise<void>|void){
  if(this.count>=this.limit)return Promise.reject(new Error('QUEUE_FULL'))
  this.count++
  const result=this.tail.then(task)
  this.tail=result.catch(()=>{}).finally(()=>{this.count--})
  return result
 }
}
