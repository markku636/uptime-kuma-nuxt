// gRPC monitors against a throwaway local gRPC server built from the same proto text
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkGrpcKeyword } from '../../server/services/monitor/checkers/grpc-checker'

const PROTO = `
syntax = "proto3";
package health;
service Health {
  rpc Check (CheckRequest) returns (CheckReply);
}
message CheckRequest { string service = 1; }
message CheckReply { string status = 1; string service = 2; }
`

let server: grpc.Server
let url = ''

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grpc-test-'))
  const file = join(dir, 'h.proto')
  writeFileSync(file, PROTO)
  const def: any = grpc.loadPackageDefinition(protoLoader.loadSync(file, { keepCase: true }))
  rmSync(dir, { recursive: true, force: true })
  server = new grpc.Server()
  server.addService(def.health.Health.service, {
    Check: (call: any, cb: any) => cb(null, { status: 'SERVING', service: call.request.service }),
  })
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (e, p) => (e ? reject(e) : resolve(p))))
  url = `127.0.0.1:${port}`
})

afterAll(() => server?.forceShutdown())

const monitor = (over: Record<string, unknown> = {}) => ({
  grpcUrl: url, grpcProtoContent: PROTO, grpcServiceName: 'health.Health', grpcMethod: 'Check',
  grpcBody: '{"service":"api"}', timeout: 5, ...over,
})

describe('checkGrpcKeyword', () => {
  it('calls the method from the proto text', async () => {
    const r = await checkGrpcKeyword(monitor({ keyword: 'SERVING' }), Date.now())
    expect(r).toMatchObject({ status: 1 })
  })

  it('is down when the keyword is missing', async () => {
    expect((await checkGrpcKeyword(monitor({ keyword: 'NOT_SERVING_X' }), Date.now())).status).toBe(0)
  })

  it('names an unknown method', async () => {
    const r = await checkGrpcKeyword(monitor({ grpcMethod: 'Nope' }), Date.now())
    expect(r.status).toBe(0)
    expect(r.msg).toMatch(/Nope/)
  })
})
