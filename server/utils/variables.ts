import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function encryptionKey() {
  const value = process.env.APP_ENCRYPTION_KEY
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) throw new Error('APP_ENCRYPTION_KEY must be 64 hex characters to use secrets')
  return Buffer.from(value, 'hex')
}
export function encryptSecret(value: string, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(context))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['enc', 'v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':')
}
export function decryptSecret(value: string, context: string) {
  const [prefix, version, iv, tag, ciphertext, extra] = value.split(':')
  if (prefix !== 'enc' || version !== 'v1' || !iv || !tag || ciphertext === undefined || extra) throw new Error('Invalid secret envelope')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
}
export function environmentDTO(environment: any) {
  return { id: environment.id, workspaceId: environment.workspaceId, name: environment.name,
    variables: environment.variables, secretNames: Object.keys(environment.secrets || {}) }
}
export function validVariableName(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(name)
    && !name.split('.').some(part => ['__proto__','prototype','constructor'].includes(part))
    && !name.startsWith('process.env.')
}
export function resolveVariables(template: string, variables: Record<string, string>) {
  const expression = /\{\{\s*([^{}]+?)\s*\}\}/g
  if (/\{\{|\}\}/.test(template.replace(expression, ''))) throw new Error('Malformed variable expression')
  return template.replace(expression, (_match, name) => {
    if (!validVariableName(name) || !Object.hasOwn(variables, name)) throw new Error('Missing or unsupported variable')
    return variables[name]!
  })
}
