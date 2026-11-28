import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdirSync,writeFileSync,createReadStream,readFileSync,lstatSync,readdirSync,readlinkSync,statSync} from 'node:fs'
import path from 'node:path'
async function hashArchive(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')}
const root=process.cwd(),destination=path.resolve(process.env.ARTIFACT_OUTPUT_DIR||'.data/artifacts');mkdirSync(destination,{recursive:true})
const allow=['.output','node_modules','.playwright','prisma','scripts/migrate.mjs','scripts/check-runtime.mjs','scripts/create-demos.ts','scripts/demo-fixture.mjs','package.json','package-lock.json']
function validate(file){const full=path.join(root,file),info=lstatSync(full);if(info.isSymbolicLink()){const target=path.resolve(path.dirname(full),readlinkSync(full));if(!target.startsWith(root+path.sep))throw Error('Archive symlink escapes source')}else if(info.isDirectory())for(const name of readdirSync(full))validate(path.join(file,name));else if(!info.isFile())throw Error('Unsupported archive member')}
for(const file of allow)validate(file)
const git=(...args)=>{const result=spawnSync('git',args,{encoding:'utf8',maxBuffer:32*1024**2});if(result.status)throw Error('Git manifest failed');return result.stdout.trim()}
const sourcePaths=[...new Set([...git('ls-files').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')])].filter(file=>file&&!file.startsWith('.data/')&&!file.split('/').some(part=>part.startsWith('.env'))).sort()
const sourceHash=createHash('sha256');for(const file of sourcePaths){try{if(lstatSync(file).isFile()){sourceHash.update(file+'\0');sourceHash.update(readFileSync(file))}}catch{}}
const manifest={workingTreeSha256:sourceHash.digest('hex'),sourceFileCount:sourcePaths.length,createdAt:new Date().toISOString(),sourceCommit:git('rev-parse','HEAD'),dirtyDiffSha256:createHash('sha256').update(git('diff','--binary','HEAD')).digest('hex'),packageLockSha256:createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),node:process.version,platform:process.platform,arch:process.arch,allowlist:allow}
writeFileSync(path.join(destination,'runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
const archive=path.join(destination,'runtime-bundle.tgz'),result=spawnSync('tar',['--exclude=.env*','--exclude=.git','--exclude=*.log','--exclude=.cache','-czf',archive,...allow,'-C',destination,'runtime-manifest.json'],{stdio:'inherit'})
if(result.status)throw Error('Artifact archive failed')
// 並行 build 可能在 tar 讀取時重寫 .output；封裝後立刻核對 loader 要求的檔案，
// 避免產生一個 SHA 正確但沒有 server entrypoint 的 artifact。
const listed=spawnSync('tar',['-tzf',archive],{encoding:'utf8',maxBuffer:64*1024**2})
if(listed.status)throw Error('Artifact listing failed')
const names=new Set(listed.stdout.split('\n'))
for(const required of ['.output/server/index.mjs','scripts/migrate.mjs','prisma/schema.prisma','node_modules/prisma/build/index.js'])if(!names.has(required))throw Error(`Artifact missing ${required}`)
const sha256=await hashArchive(archive),report={...manifest,archive,sha256,bytes:statSync(archive).size}
writeFileSync(path.join(destination,'artifact.json'),JSON.stringify(report,null,2)+'\n');console.info(JSON.stringify(report))
