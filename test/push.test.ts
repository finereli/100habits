import { describe, expect, it } from 'vitest'
import { decide, localNow, vapidJwt, WINDOW, type PushRow } from '../worker/push'

const row = (o: Partial<PushRow> = {}): PushRow => ({ endpoint: 'https://push.example/x', minutes: 21 * 60, tz: 'Asia/Jerusalem', last_shot_day: null, last_sent_day: null, ...o })
// 2026-10-13 18:02 UTC is 21:02 in Jerusalem (UTC+3).
const at = (iso: string) => new Date(iso)

describe('localNow', () => {
  it('reads the wall clock in the zone', () => {
    expect(localNow('Asia/Jerusalem', at('2026-10-13T18:02:00Z'))).toEqual({ day: '2026-10-13', minutes: 21 * 60 + 2 })
    expect(localNow('America/Los_Angeles', at('2026-10-13T03:30:00Z'))).toEqual({ day: '2026-10-12', minutes: 20 * 60 + 30 })
  })
  it('falls back to UTC for a zone it does not know', () => {
    expect(localNow('Nowhere/Land', at('2026-10-13T18:02:00Z'))).toEqual({ day: '2026-10-13', minutes: 18 * 60 + 2 })
  })
})

describe('decide', () => {
  it('waits before the minute', () => {
    expect(decide(row(), at('2026-10-13T17:58:00Z')).decision).toBe('wait')
  })
  it('sends inside the window, once a day', () => {
    expect(decide(row(), at('2026-10-13T18:02:00Z'))).toEqual({ decision: 'send', day: '2026-10-13' })
    expect(decide(row({ last_sent_day: '2026-10-13' }), at('2026-10-13T18:07:00Z')).decision).toBe('wait')
    expect(decide(row({ last_sent_day: '2026-10-12' }), at('2026-10-13T18:07:00Z')).decision).toBe('send')
  })
  it('stops after the window', () => {
    expect(decide(row(), at(new Date(Date.parse('2026-10-13T18:00:00Z') + WINDOW * 60_000).toISOString())).decision).toBe('wait')
  })
  it('skips a day with a shot already logged', () => {
    expect(decide(row({ last_shot_day: '2026-10-13' }), at('2026-10-13T18:02:00Z'))).toEqual({ decision: 'skip', day: '2026-10-13' })
    expect(decide(row({ last_shot_day: '2026-10-12' }), at('2026-10-13T18:02:00Z')).decision).toBe('send')
  })
})

describe('vapidJwt', () => {
  it('is an ES256 JWT for the push service origin that verifies with the public key', async () => {
    const k = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
    const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey))
    const jwt = await vapidJwt('https://fcm.googleapis.com/fcm/send/abc', jwk, 'https://100shots.finereli.com', Date.parse('2026-10-13T00:00:00Z'))
    const [h, b, s] = jwt.split('.')
    const dec = (x: string) => JSON.parse(Buffer.from(x, 'base64url').toString())
    expect(dec(h)).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(dec(b)).toMatchObject({ aud: 'https://fcm.googleapis.com', sub: 'https://100shots.finereli.com' })
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${b}`))
    expect(ok).toBe(true)
  })
})
