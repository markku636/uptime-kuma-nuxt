import {test} from 'node:test'
import assert from 'node:assert/strict'
import {generateBadge} from '../server/services/badge/generator'
import {badgeStyles,badgeText,parseBadgeQuery,parseBadgeDuration,parseBadgeId} from '../server/utils/badge-input'
import {projectTLSCache,cachedCertificateDays} from '../server/utils/tls-cache'
import {withoutMonitorLease} from '../server/utils/monitor-mutation'
test('all badge styles escape titles and text, remove invalid XML and bound text',()=>{
 for(const style of badgeStyles){const svg=generateBadge({label:'</title><script>bad</script>\u0000&',message:'"\'><img onload="bad">',style});assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('<img'));assert.ok(!svg.includes('\u0000'));assert.ok(svg.includes('&lt;/title&gt;'));assert.ok(svg.includes('&amp;'));assert.ok(!svg.includes('<title></title>'))}
 assert.equal(Array.from(badgeText('😀'.repeat(200))).length,128);assert.equal(badgeText('a\ud800b'),'ab')
 for(const value of ['red','url(https://example.test)','" onload="bad'])assert.throws(()=>generateBadge({label:'safe',message:'safe',color:value}))
 assert.throws(()=>generateBadge({label:'safe',message:'safe',style:'social' as 'flat'}))
})
test('badge query and duration enforce finite scalar whitelists',()=>{
 assert.equal(parseBadgeQuery({label:'😀'.repeat(128),color:'#aBc',style:'plastic'}).label?.length,256)
 for(const query of [{label:['a','b']},{label:'x'.repeat(129)},{color:'url(x)'},{style:'social'},{hours:['1','2']},{unknown:'x'},{hours:'24'}])assert.throws(()=>parseBadgeQuery(query),error=>(error as {statusCode:number}).statusCode===400)
 assert.equal(parseBadgeQuery({hours:'9600'},true).hours,9600)
 for(const [input,expected]of [['24',24],['24h',24],['7d',168],['30d',720],['1y',8760],['400d',9600]] as const)assert.equal(parseBadgeDuration(input),expected)
 for(const input of ['0','-1','1.5','401d','9601','1hfoo','infinity',['24']])assert.throws(()=>parseBadgeDuration(input))
 assert.equal(parseBadgeId('12'),12);for(const id of ['0','12tail','9007199254740992'])assert.throws(()=>parseBadgeId(id))
})
test('TLS cache projection binds observation to version and DB time without preserving arbitrary payload',()=>{
 const now=new Date('2030-01-01T00:00:00.000Z'),cache=projectTLSCache({valid:false,validTo:new Date(now.getTime()+2*86400000),issuer:'i'.repeat(400),url:'CACHE_SECRET',arbitrary:'CACHE_SECRET'},3,now)!
 assert.equal(cache.checkedAt,now.toISOString());assert.equal(cache.configVersion,3);assert.equal(cache.issuer.length,256);assert.ok(!JSON.stringify(cache).includes('CACHE_SECRET'));assert.equal(cachedCertificateDays(cache,3,60,2,now),2)
 assert.equal(cachedCertificateDays({...cache,validTo:'2029-12-31T00:00:00.000Z'},3,60,2,now),-1)
 for(const input of [null,{}, {...cache,configVersion:2},{...cache,validTo:'invalid'},{...cache,validTo:'2030-02-30T00:00:00.000Z'},{...cache,checkedAt:'2029-12-31T23:54:59.000Z'},{...cache,checkedAt:'2030-01-01T00:00:06.000Z'}])assert.equal(cachedCertificateDays(input,3,60,2,now),null)
 assert.equal(projectTLSCache({validTo:'invalid'},3,now),null)
 assert.equal(withoutMonitorLease({id:1,tlsInfo:cache}).tlsInfo,undefined)
})
