import pg from 'pg'
import {workerPrisma as prisma} from '../../utils/worker-prisma'
// pg's idle graceful end waits for the peer; this dedicated listener must close even during a blackhole.
async function closeListener(client:pg.Client){const ended=client.end();(client as any).connection?.stream?.destroy();try{await ended}catch{}}
import {localStateSubscriptions,stateNeedsDelivery,deliverMonitorStates} from '../socket'
export class StateBridge {
  readonly metrics={scans:0,rows:0,delivered:0,hints:0,reconnects:0,connected:false}
  private client:pg.Client|undefined;private timer:NodeJS.Timeout|undefined;private reconnect:NodeJS.Timeout|undefined;private scanning=false;private stopped=false;private dirty=true;private lastScan=0;private retryMs=1000
  start(){this.timer=setInterval(()=>{if(this.dirty||performance.now()-this.lastScan>=1000)void this.resync()},250);this.timer.unref();void this.connect()}
  private async connect(){
    if(this.stopped)return
    const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000,query_timeout:3000,application_name:'uptime-state-listener'})
    this.client=client
    const failed=()=>{
      if(this.client!==client)return
      this.metrics.connected=false;this.client=undefined;void closeListener(client)
      if(!this.stopped&&!this.reconnect){this.metrics.reconnects++;this.reconnect=setTimeout(()=>{this.reconnect=undefined;void this.connect()},this.retryMs);this.reconnect.unref();this.retryMs=Math.min(30000,this.retryMs*2)}
    }
    client.on('error',failed);client.on('end',failed)
    client.on('notification',message=>{if(message.channel==='uptime_monitor_state'){this.metrics.hints++;this.dirty=true}})
    try{await client.connect();if(this.stopped){await closeListener(client);return}await client.query('LISTEN uptime_monitor_state');this.metrics.connected=true;this.retryMs=1000;this.dirty=true}catch{failed()}
  }
  async resync(){
    if(this.scanning||this.stopped)return
    this.scanning=true;this.dirty=false;this.lastScan=performance.now();this.metrics.scans++
    try{
      for(const scope of localStateSubscriptions()){
        let after=0
        for(;;){
          if(this.stopped)return
          const states=await prisma.monitorState.findMany({where:{workspaceId:scope.workspaceId,environmentId:scope.environmentId,monitorId:{gt:after,...(!scope.all?{in:[...scope.ids]}:{})}},orderBy:{monitorId:'asc'},take:200})
          if(!states.length)break;this.metrics.rows+=states.length
          const changed=states.filter(stateNeedsDelivery)
          if(changed.length)this.metrics.delivered+=await deliverMonitorStates(changed,[])
          after=states.at(-1)!.monitorId
          if(states.length<200)break
        }
      }
    }catch{this.dirty=true}
    finally{this.scanning=false}
  }
  async stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);if(this.reconnect)clearTimeout(this.reconnect);const client=this.client;this.client=undefined;if(client)await closeListener(client)}
}
