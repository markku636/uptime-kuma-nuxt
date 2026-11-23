declare module '@usebruno/lang' {
  const brunoLang: {
    bruToJsonV2(source: string): any
    jsonToBruV2(value: any): string
    bruToEnvJsonV2(source: string): any
    envJsonToBruV2(value: any): string
    collectionBruToJson(source: string): any
    jsonToCollectionBru(value: any, root?: boolean): string
    dotenvToJson(source: string): any
  }
  export default brunoLang
}
