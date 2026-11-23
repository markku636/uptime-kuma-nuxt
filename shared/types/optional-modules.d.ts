declare module 'gamedig' {
  export function query(options: any): Promise<any>
  const GameDig: { query: typeof query }
  export default GameDig
}
declare module 'snmp-native' {
  export class Session {
    constructor(options?: any)
    get(oids: any, callback: (error: any, data: any) => void): void
    close(): void
  }
  const snmp: { Session: typeof Session }
  export default snmp
}
