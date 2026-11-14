export interface BrunoFile {path:string;content:string}
export interface BrunoManifest {collectionId:string;sourceEnvironment?:string;files:BrunoFile[];mode:'create'|'replace'|'skip';variables?:Record<string,string>;secrets?:Record<string,string>}
export interface BrunoIssue {file:string;code:string;field?:string}
export interface BrunoRequest {path:string;name:string;config:Record<string,any>}
export interface BrunoParsed {requests:BrunoRequest[];environments:string[];issues:BrunoIssue[];variables:Record<string,string>;secrets:Record<string,string>;missingSecrets:string[]}
