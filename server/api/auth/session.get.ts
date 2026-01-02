// server/api/auth/session.get.ts

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    return {
      ok: false,
      data: null
    }
  }

  return {
    ok: true,
    data: session.user
  }
})
