// types/httpntlm.d.ts
declare module 'httpntlm' {
  interface NtlmOptions {
    url: string
    username: string
    password: string
    domain?: string
    workstation?: string
    /** Sent with the final (authenticated) request; Connection / Authorization are reserved */
    headers?: Record<string, string>
    body?: string
    /** Milliseconds, per request of the handshake */
    timeout?: number
    agent?: import('node:http').Agent
    [option: string]: unknown
  }

  interface NtlmResponse {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  type Send = (options: NtlmOptions, callback: (err: Error | null, response: NtlmResponse) => void) => void

  export const get: Send
  export const post: Send
  export const put: Send
  export const patch: Send
  // `delete` is a reserved word: exported under that name by the library
  const del: Send
  export { del as delete }
  export const options: Send
}
