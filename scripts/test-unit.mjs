import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(name=>name.endsWith('.test.ts')&&!name.endsWith('.integration.test.ts')).sort().map(name=>'tests/'+name)
const result=spawnSync(process.execPath,['--import','tsx','--test',...files],{stdio:'inherit'})
process.exitCode=result.status??1
