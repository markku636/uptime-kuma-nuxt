// shared/types/auth.d.ts (included by both the app and the server type checks)
// What the login session holds (nuxt-auth-utils), so session.user.id is typed.
declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    timezone?: string
  }

  interface UserSession {
    /** When this login happened (ms): compared with the user's "sessions valid after" */
    loggedInAt?: number
    /** Set for requests authenticated with an API key */
    apiKeyId?: number
  }
}

export {}
