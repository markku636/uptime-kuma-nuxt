// types/httpntlm.d.ts
declare module 'httpntlm' {
  interface NtlmOptions {
    url: string
    username: string
    password: string
    domain?: string
    workstation?: string
    request?: any
  }

  interface NtlmResponse {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  export function get(options: NtlmOptions, callback: (err: Error | null, response: NtlmResponse) => void): void
  export function post(options: NtlmOptions & { body?: string }, callback: (err: Error | null, response: NtlmResponse) => void): void
  export function put(options: NtlmOptions & { body?: string }, callback: (err: Error | null, response: NtlmResponse) => void): void
  export function del(options: NtlmOptions, callback: (err: Error | null, response: NtlmResponse) => void): void
  export function patch(options: NtlmOptions & { body?: string }, callback: (err: Error | null, response: NtlmResponse) => void): void
}
