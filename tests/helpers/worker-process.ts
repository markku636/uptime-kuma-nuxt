import {spawn,type ChildProcess} from 'node:child_process'
export const workerChildren=new Set<ChildProcess>()
export class WorkerProcess {
  child:ChildProcess;log='';index=0;waiting=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout}>();ready:Promise<void>
  constructor(url:string,env:Record<string,string>={}){
    this.child=spawn(process.execPath,['--import','tsx','tests/fixtures/worker/process.ts'],{env:{...process.env,DATABASE_URL:url,WORKER_CONCURRENCY:'8',WORKER_PER_ORIGIN:'4',WORKER_CLAIM_BATCH:'4',WORKER_POLL_MS:'25',WORKER_LEASE_MS:'1000',WORKER_RENEW_MS:'200',WORKER_RUN_TIMEOUT_MS:'4000',WORKER_DRAIN_MS:'200',...env},stdio:['ignore','pipe','pipe','ipc']});workerChildren.add(this.child)
    this.child.stdout!.on('data',data=>this.log+=data);this.child.stderr!.on('data',data=>this.log+=data)
    this.ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Worker startup: '+this.log)),10000)
      this.child.on('message',(message:any)=>{
        if(message.ready){clearTimeout(timer);resolve();return}
        const waiter=this.waiting.get(message.id);if(!waiter)return
        clearTimeout(waiter.timer);this.waiting.delete(message.id)
        if(message.error)waiter.reject(Error('Worker fixture action failed: '+this.log));else waiter.resolve(message)
      })
      this.child.once('exit',code=>{
        clearTimeout(timer);workerChildren.delete(this.child)
        for(const waiter of this.waiting.values()){clearTimeout(waiter.timer);waiter.reject(Error('Worker exited'))}this.waiting.clear()
        if(code)reject(Error('Worker exit: '+this.log))
      })
    })
  }
  async call(action:string,input:any={}){
    await this.ready;const id=++this.index
    return new Promise<any>((resolve,reject)=>{
      const timer=setTimeout(()=>{this.waiting.delete(id);reject(Error('Worker IPC timeout: '+action+' '+this.log))},15000)
      this.waiting.set(id,{resolve,reject,timer});this.child.send({id,action,...input})
    })
  }
  async stop(){if(this.child.exitCode!==null||this.child.signalCode)return;await this.call('stop');await new Promise<void>(r=>this.child.once('exit',()=>r()))}
  async kill(){if(this.child.exitCode!==null||this.child.signalCode)return;this.child.kill('SIGKILL');await new Promise<void>(r=>this.child.once('exit',()=>r()))}
}
