// Nightly reminders. The push carries no payload, so nothing needs encrypting
// and the server never sees habit names: the service worker (public/push-sw.js)
// writes the text from the habits on the device. What the server does: sign a
// VAPID JWT, POST an empty message to the subscription's endpoint, and decide
// once per local day whether it's time.

export interface PushRow {
  endpoint: string
  minutes: number
  tz: string
  last_shot_day: string | null
  last_sent_day: string | null
}

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))

let keyCache: { jwk: string; key: CryptoKey } | null = null
async function signingKey(jwk: string) {
  if (keyCache?.jwk !== jwk) {
    const key = await crypto.subtle.importKey('jwk', JSON.parse(jwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
    keyCache = { jwk, key }
  }
  return keyCache.key
}

export async function vapidJwt(endpoint: string, privateJwk: string, subject: string, now = Date.now()) {
  const head = enc({ typ: 'JWT', alg: 'ES256' })
  const body = enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })
  // WebCrypto's ECDSA signature is already raw r||s, which is what JWS wants.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(privateJwk), new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${b64url(sig)}`
}

// Returns the push service's status: 201 sent, 404/410 the subscription is gone.
export async function sendPush(endpoint: string, publicKey: string, privateJwk: string): Promise<number> {
  const jwt = await vapidJwt(endpoint, privateJwk, 'https://100shots.finereli.com')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `vapid t=${jwt}, k=${publicKey}`, TTL: String(4 * 3600), Urgency: 'normal', 'Content-Length': '0' },
  })
  return res.status
}

// The wall clock in a time zone: local date (YYYY-MM-DD) and minutes after midnight.
export function localNow(tz: string, now = new Date()): { day: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  } catch {
    return localNow('UTC', now)
  }
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

// The cron runs every 5 minutes; a reminder is due from its minute until 30
// minutes later (so a missed run still catches it), once per local day.
export const WINDOW = 30

export type Decision = 'send' | 'skip' | 'wait'
export function decide(row: PushRow, now = new Date()): { decision: Decision; day: string } {
  const { day, minutes } = localNow(row.tz, now)
  if (row.last_sent_day === day) return { decision: 'wait', day }
  if (minutes < row.minutes || minutes >= row.minutes + WINDOW) return { decision: 'wait', day }
  // Logged a shot today already: nothing to remind about.
  if (row.last_shot_day === day) return { decision: 'skip', day }
  return { decision: 'send', day }
}
