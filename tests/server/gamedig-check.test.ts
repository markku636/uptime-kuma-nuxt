// GameDig monitors reach the library (gamedig 5 exports { GameDig }); a
// closed port gives the library's own "failed" message, not a TypeError.
import { describe, expect, it } from 'vitest'
import { checkGamedig } from '../../server/services/monitor/checkers/game-checker'

describe('checkGamedig', () => {
  it('queries through GameDig', async () => {
    const r = await checkGamedig({ hostname: '127.0.0.1', port: 9, game: 'minecraft', timeout: 1 }, Date.now())
    expect(r.status).toBe(0)
    expect(r.msg).not.toMatch(/is not a function|not available/)
  }, 20_000)
})
