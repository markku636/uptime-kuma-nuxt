import 'pinia'

declare module 'pinia' {
  // Provided by pinia-plugin-persistedstate at runtime.
  export interface DefineStoreOptionsBase<S, Store> {
    persist?: boolean | { key?: string; storage?: any; paths?: string[] }
  }
}
