/** Resolves the configured display timezone with a fallback to the signed-in user's profile. */
export function useDisplayTimezone() {
  const { user } = useUserSession()
  const configured = useState<string>('display-timezone', () => 'auto')
  const loaded = useState<boolean>('display-timezone-loaded', () => false)

  if (import.meta.client && !loaded.value) {
    loaded.value = true
    $fetch<any>('/api/settings/general')
      .then(settings => { configured.value = settings?.displayTimezone || 'auto' })
      .catch(() => {})
  }

  const timezone = computed(() => {
    if (configured.value && configured.value !== 'auto') return configured.value
    const profileZone = (user.value as any)?.timezone
    return typeof profileZone === 'string' && profileZone ? profileZone : undefined
  })

  function format(value: string | Date | number, withSeconds = true) {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone.value,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
      hourCycle: 'h23',
    }).formatToParts(date)
    const part = (type: string) => parts.find(item => item.type === type)?.value || ''
    const stamp = `${part('hour')}:${part('minute')}${withSeconds ? `:${part('second')}` : ''}`
    return `${part('year')}-${part('month')}-${part('day')} ${stamp}`
  }

  return { timezone, format }
}
