import {processClearHistory} from './clear-history'
import {rollupBatch} from './rollup'
import {retainHistory} from './retention'
/** No per-monitor timers. A bounded transaction and PG lock coordinate every replica. */
export class HistoryMaintenance {
 private timer?:NodeJS.Timeout
 private pending?:Promise<void>
 private stopped=false
 start(){this.timer=setInterval(()=>void this.tick(),5000);this.timer.unref()}
 async tick(){if(this.pending||this.stopped)return;return this.pending=(async()=>{try{const started=performance.now();for(let n=0;n<32&&!this.stopped&&performance.now()-started<2000;n++){const result=await processClearHistory();if(result.idle||result.busy)break}if(!this.stopped)await rollupBatch();if(!this.stopped)await retainHistory()}catch{/* transport retries on the next finite tick */}finally{this.pending=undefined}})()}
 async stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);await this.pending}
}
