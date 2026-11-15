import {exportMetrics} from '../../utils/metrics-exporter'
export default defineEventHandler(async event=>{const scope=await requireWorkspace(event,'viewer');setHeader(event,'content-type','text/plain; version=0.0.4; charset=utf-8');return exportMetrics(scope)})
