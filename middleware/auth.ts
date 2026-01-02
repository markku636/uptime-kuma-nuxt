// middleware/auth.ts

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()

  // If not logged in, redirect to login page
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
