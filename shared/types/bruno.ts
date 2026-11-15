export interface BrunoFile {path:string;content:string}
/** targetGroup: 'collection' creates/reuses a group named after the collection, 'none' leaves the root ungrouped, a number roots the import in that group. */
export interface BrunoManifest {collectionId:string;sourceEnvironment?:string;files:BrunoFile[];mode:'create'|'replace'|'skip';variables?:Record<string,string>;secrets?:Record<string,string>;targetGroup?:'collection'|'none'|number}
export interface BrunoIssue {file:string;code:string;field?:string}
/** folder is the request's directory ('' at the collection root); skipped lists Bruno blocks that are imported but never executed. */
export interface BrunoRequest {path:string;name:string;config:Record<string,any>;folder:string;skipped:string[];seq?:number}
export interface BrunoFolder {path:string;name:string;seq?:number}
export interface BrunoParsed {requests:BrunoRequest[];environments:string[];issues:BrunoIssue[];variables:Record<string,string>;secrets:Record<string,string>;missingSecrets:string[];collectionName?:string;folders:BrunoFolder[]}
