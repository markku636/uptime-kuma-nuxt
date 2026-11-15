import {createHash} from 'node:crypto'
import {createReadStream,readFileSync,readdirSync,lstatSync,readlinkSync,mkdirSync,writeFileSync,statSync,renameSync} from 'node:fs'
import path from 'node:path'
async function hashArchive(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')}
import {spawnSync} from 'node:child_process'
const root=process.cwd(),output=path.resolve('.data/build-context');mkdirSync(output,{recursive:true})
const allow=['Dockerfile','.dockerignore','docker-entrypoint.sh','package.json','package-lock.json','nuxt.config.ts','i18n.config.ts','tsconfig.json','app.vue','error.vue','assets','components','composables','layouts','locales','middleware','pages','plugins','prisma','public','server','shared','stores','types','scripts/migrate.mjs','scripts/check-runtime.mjs','scripts/demo-fixture.mjs']
const files=[]
function walk(file){if(file.split('/').some(name=>name.startsWith('.env')||['.git','.data','node_modules','.nuxt','.output'].includes(name)))throw Error('Forbidden context input');const info=lstatSync(file);if(info.isSymbolicLink()){const destination=path.resolve(path.dirname(file),readlinkSync(file));if(!destination.startsWith(root+path.sep))throw Error('Escaping context link');throw Error('Source context links require an explicit reviewed allowlist')}else if(info.isDirectory())for(const name of readdirSync(file).sort())walk(file+'/'+name);else if(info.isFile())files.push(file);else throw Error('Unsupported context input')}
for(const file of allow)walk(file)
const tree=createHash('sha256');for(const file of files.sort()){tree.update(file+'\0');tree.update(readFileSync(file))}
const revision=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});if(revision.status)throw Error('Cannot identify source revision')
const manifest={createdAt:new Date().toISOString(),sourceCommit:revision.stdout.trim(),sourceTreeSha256:tree.digest('hex'),dockerfileSha256:createHash('sha256').update(readFileSync('Dockerfile')).digest('hex'),packageLockSha256:createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),files}
writeFileSync(path.join(output,'build-context-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
const temporary=path.join(output,'context.tgz'),tar=spawnSync('tar',['--exclude=.env*','--exclude=.data','--exclude=.git','--exclude=node_modules','--exclude=*.log','-czf',temporary,...allow,'-C',output,'build-context-manifest.json'],{stdio:'inherit'});if(tar.status)throw Error('Context archive failed')
const sha256=await hashArchive(temporary),archive=path.join(output,'context-'+sha256+'.tgz');renameSync(temporary,archive)
const report={...manifest,archive,sha256,bytes:statSync(archive).size};writeFileSync(path.join(output,'context.json'),JSON.stringify(report,null,2)+'\n');console.info(JSON.stringify({archive,sha256,bytes:report.bytes,sourceTreeSha256:manifest.sourceTreeSha256}))
