// Nuxt UI theme. Colour values come from assets/css/tokens.css.
// `primary` is switched at runtime by useAppearanceSettings (Appearance → primary colour).
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'kuma',
      neutral: 'slate',
      success: 'kuma',
      info: 'blue',
      warning: 'amber',
      error: 'red',
    },
    // The brand green is light; solid fills use dark text (upstream does the same in dark mode)
    button: {
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'text-on-primary hover:bg-primary/85 disabled:bg-primary aria-disabled:bg-primary' },
        { color: 'success', variant: 'solid', class: 'text-on-primary' },
        { color: 'warning', variant: 'solid', class: 'text-on-primary' },
      ],
    },
    badge: {
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'text-on-primary' },
        { color: 'success', variant: 'solid', class: 'text-on-primary' },
        { color: 'warning', variant: 'solid', class: 'text-on-primary' },
      ],
    },
  },
})
