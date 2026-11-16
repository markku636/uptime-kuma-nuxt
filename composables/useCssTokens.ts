// Resolve design tokens (CSS custom properties) to concrete colour strings for
// canvas-based charts, which cannot use var(). Re-reads when the colour mode
// or primary palette changes.
export function useCssTokens<T extends Record<string, string>>(tokens: T) {
  const colorMode = useColorMode()
  const appConfig = useAppConfig()
  const values = ref({}) as Ref<Record<keyof T, string>>

  function read() {
    if (!import.meta.client) return
    const style = getComputedStyle(document.documentElement)
    values.value = Object.fromEntries(
      Object.entries(tokens).map(([key, name]) => [key, style.getPropertyValue(name).trim()]),
    ) as Record<keyof T, string>
  }

  onMounted(read)
  watch(() => [colorMode.value, appConfig.ui?.colors?.primary], () => nextTick(read))

  return values
}

/** `#rrggbb` + alpha (0–1) → `#rrggbbaa`; other formats are returned unchanged */
export function withAlpha(color: string, alpha: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color + Math.round(alpha * 255).toString(16).padStart(2, '0')
  }
  return color
}
