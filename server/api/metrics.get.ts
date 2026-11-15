import {exportMetrics} from '../utils/metrics-exporter'
export default defineEventHandler(async event=>{await requirePlatformAdmin(event);setHeader(event,'content-type','text/plain; version=0.0.4; charset=utf-8');return exportMetrics()})
