// server/plugins/bigint-json.ts
// Heartbeat ids are BigInt (BIGSERIAL). JSON.stringify throws on BigInt, so any
// response that includes heartbeats without converting them failed with
// "Do not know how to serialize a BigInt". Serialize them as strings, the same
// format the endpoints that convert by hand already return.

declare global {
  interface BigInt {
    toJSON(): string
  }
}

export default defineNitroPlugin(() => {
  if (typeof (BigInt.prototype as any).toJSON !== 'function') {
    BigInt.prototype.toJSON = function toJSON() {
      return this.toString()
    }
  }
})
