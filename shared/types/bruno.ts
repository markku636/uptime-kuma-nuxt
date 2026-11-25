export interface BrunoFile {path:string;content:string}
/** targetGroup: 'collection' creates/reuses a group named after the collection, 'none' leaves the root ungrouped, a number roots the import in that group. */
export interface BrunoManifest {collectionId:string;sourceEnvironment?:string;files:BrunoFile[];mode:'create'|'replace'|'skip';variables?:Record<string,string>;secrets?:Record<string,string>;targetGroup?:'collection'|'none'|number}
export interface BrunoIssue {file:string;code:string;field?:string}
/** folder is the request's directory ('' at the collection root); skipped lists Bruno blocks that are imported but never executed. */
export interface BrunoRequest {path:string;name:string;config:Record<string,any>;folder:string;skipped:string[];seq?:number}
export interface BrunoFolder {path:string;name:string;seq?:number}
export interface BrunoParsed {requests:BrunoRequest[];environments:string[];issues:BrunoIssue[];variables:Record<string,string>;secrets:Record<string,string>;missingSecrets:string[];collectionName?:string;folders:BrunoFolder[]}
/** Declarative view of a single .bru request used by the UI editor. Values keep {{variable}} placeholders verbatim; secrets are never materialised here. */
export interface BrunoRequestModel {
  name: string
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'
  url: string
  params: Array<{ name: string; value: string; enabled: boolean; type?: 'query' | 'path' }>
  headers: Array<{ name: string; value: string; enabled: boolean }>
  auth: { mode: 'none' | 'inherit' | 'basic' | 'bearer'; username?: string; password?: string; token?: string }
  body: { mode: 'none' | 'json' | 'text'; content: string }
  vars: Array<{ name: string; value: string; enabled: boolean }>
  assertions: Array<{ expression: string; operator: string; value: string; enabled: boolean; description?: string }>
  ignoredBlocks: string[]
}
