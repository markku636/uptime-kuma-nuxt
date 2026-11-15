import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {base,user,workspace,cleanup,prisma,type Identity,type Scope} from './helpers/http'
test('runtime UI shows real worker diagnostics to platform admin and hides cluster actions from workspace owner',{timeout:60000},async()=>{
  let admin:Identity|undefined,owner:Identity|undefined,scope:Scope|undefined,ownerScope:Scope|undefined
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
  async function page(identity:Identity,scope:Scope){const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addCookies([...identity.cookie.split('; ').map(part=>{const i=part.indexOf('=');return{name:part.slice(0,i),value:part.slice(i+1),url:base}}),{name:'workspace_id',value:String(scope.workspaceId),url:base},{name:'environment_id',value:String(scope.environmentId),url:base}]);await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());return context.newPage()}
  try{
    admin=await user('runtime-ui-admin');owner=await user('runtime-ui-owner');scope=await workspace(admin,'Runtime admin');ownerScope=await workspace(owner,'Runtime owner')
    await prisma.user.update({where:{id:admin.id},data:{platformAdmin:true}})
    const adminPage=await page(admin,scope),errors:string[]=[];adminPage.on('pageerror',error=>errors.push(error.message));await adminPage.goto(base+'/settings/nodes')
    await adminPage.getByRole('heading',{name:'Runtime topology',exact:true}).waitFor();await adminPage.getByText(/Single-process mode|Workers are not tied to an API instance/).waitFor()
    assert.ok(await adminPage.getByText('API + worker',{exact:true}).count()>0)
    await adminPage.screenshot({path:'/tmp/uptime-runtime-browser.png',fullPage:true})
    const ownerPage=await page(owner,ownerScope);await ownerPage.goto(base+'/settings/nodes');await ownerPage.getByRole('status').filter({hasText:'Platform administrator permission required.'}).waitFor()
    assert.equal(await ownerPage.getByRole('button',{name:/Add legacy metadata|^Refresh$/}).count(),0);assert.deepEqual(errors,[])
  }finally{await browser.close();if(admin&&owner&&scope&&ownerScope)await cleanup([admin,owner],[scope,ownerScope])}
})
