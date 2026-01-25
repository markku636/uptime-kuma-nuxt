// Load and apply appearance settings on client start
export default defineNuxtPlugin(async () => {
  const { loadAppearanceSettings } = useAppearanceSettings()

  try {
    await loadAppearanceSettings()
  } catch (error) {
    console.warn('[appearance] Unable to load appearance settings:', error)
  }
})
