declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    timezone: string
    sessionVersion?: number
  }
}
export {}
