const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

/** Pure preview of {{variables}}; secret values are masked and never reach the browser. */
export function previewEnvironmentVariables(text: string, variables: Record<string, string>, secretNames: string[]) {
  const secrets = new Set(secretNames)
  const missing: string[] = []
  const preview = text.replace(PLACEHOLDER, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return secrets.has(name) ? '••••••' : variables[name]
    }
    missing.push(name)
    return match
  })
  return { preview, missing: [...new Set(missing)] }
}
