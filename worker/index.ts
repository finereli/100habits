// The API. Everything else is static assets.
//   POST /api/sync  takes a device's whole dataset, merges it with the stored
//                   copy, stores and returns the merge. Who you are comes from
//                   a login.finereli.com token.
//   POST /api/push/{subscribe,update,unsubscribe,test}  nightly reminders,
//                   per device, no account needed (see push.ts).
// The cron (every 5 minutes) sends the reminders that are due.

import { verifyLogin } from './verify-login'
import { merge, type Data } from '../src/lib/merge'
import { VAPID_PUBLIC } from '../src/lib/vapid'
import { decide, sendPush, type PushRow } from './push'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  VAPID_PRIVATE_JWK: string
  // Only for local testing against a stand-in login service.
  LOGIN_ISSUER?: string
}

const AUDIENCE = ['https://100shots.finereli.com', 'http://localhost:5173']
const MAX_BYTES = 2_000_000

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    if (url.pathname === '/api/sync') return sync(req, env)
    const push = url.pathname.match(/^\/api\/push\/(subscribe|update|unsubscribe|test)$/)
    if (push) return pushRoute(push[1], req, env)
    return new Response('Not found', { status: 404 })
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sendDue(env))
  },
} satisfies ExportedHandler<Env>

async function sync(req: Request, env: Env): Promise<Response> {
  const user = await verifyLogin(req, { audience: AUDIENCE, issuer: env.LOGIN_ISSUER || undefined })
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.text()
  if (body.length > MAX_BYTES) return new Response('Too large', { status: 413 })
  let incoming: Data
  try {
    incoming = JSON.parse(body) as Data
    if (incoming.version !== 1 || !Array.isArray(incoming.habits)) throw new Error('shape')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const row = await env.DB.prepare('SELECT data FROM docs WHERE sub = ?').bind(user.sub).first<{ data: string }>()
  const stored: Data = row ? JSON.parse(row.data) : { version: 1, habits: [], tombstones: {} }
  const merged = merge(stored, incoming)
  const out = JSON.stringify(merged)
  if (out !== row?.data) {
    await env.DB.prepare(
      'INSERT INTO docs (sub, email, data, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(sub) DO UPDATE SET email = ?2, data = ?3, updated_at = ?4',
    ).bind(user.sub, user.email, out, Date.now()).run()
  }
  return new Response(out, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

interface PushBody { endpoint?: string; minutes?: number; tz?: string; lastShotDay?: string | null }

async function pushRoute(action: string, req: Request, env: Env): Promise<Response> {
  let b: PushBody
  try { b = (await req.json()) as PushBody } catch { return new Response('Bad request', { status: 400 }) }
  // Only real push services: an https URL, and not one of ours.
  let endpoint: URL
  try { endpoint = new URL(b.endpoint ?? '') } catch { return new Response('Bad request', { status: 400 }) }
  if (endpoint.protocol !== 'https:' || endpoint.hostname.endsWith('finereli.com') || endpoint.href.length > 1000) return new Response('Bad request', { status: 400 })
  const ep = endpoint.href
  const minutes = Number.isInteger(b.minutes) && b.minutes! >= 0 && b.minutes! < 1440 ? b.minutes! : null
  const tz = typeof b.tz === 'string' && b.tz.length < 64 ? b.tz : null
  const shotDay = typeof b.lastShotDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.lastShotDay) ? b.lastShotDay : null
  const now = Date.now()

  if (action === 'subscribe') {
    if (minutes === null || !tz) return new Response('Bad request', { status: 400 })
    await env.DB.prepare(
      `INSERT INTO push_subs (endpoint, minutes, tz, last_shot_day, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(endpoint) DO UPDATE SET minutes = ?2, tz = ?3, last_shot_day = ?4, updated_at = ?5`,
    ).bind(ep, minutes, tz, shotDay, now).run()
    return json({ ok: true })
  }
  if (action === 'update') {
    const r = await env.DB.prepare(
      `UPDATE push_subs SET minutes = COALESCE(?2, minutes), tz = COALESCE(?3, tz), last_shot_day = COALESCE(?4, last_shot_day), updated_at = ?5 WHERE endpoint = ?1`,
    ).bind(ep, minutes, tz, shotDay, now).run()
    // Unknown here (the row was cleaned up): the app subscribes again.
    return json({ ok: r.meta.changes > 0 }, r.meta.changes > 0 ? 200 : 404)
  }
  if (action === 'unsubscribe') {
    await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(ep).run()
    return json({ ok: true })
  }
  // test: only for a subscribed device, at most one every 10 seconds.
  const row = await env.DB.prepare('SELECT last_test_at FROM push_subs WHERE endpoint = ?').bind(ep).first<{ last_test_at: number | null }>()
  if (!row) return json({ ok: false, error: 'not subscribed' }, 404)
  if (row.last_test_at && now - row.last_test_at < 10_000) return json({ ok: false, error: 'too soon' }, 429)
  await env.DB.prepare('UPDATE push_subs SET last_test_at = ? WHERE endpoint = ?').bind(now, ep).run()
  const status = await sendPush(ep, VAPID_PUBLIC, env.VAPID_PRIVATE_JWK).catch(() => 0)
  if (status === 404 || status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(ep).run()
  const ok = status >= 200 && status < 300
  return json({ ok, status }, ok ? 200 : 502)
}

async function sendDue(env: Env) {
  const { results } = await env.DB.prepare('SELECT endpoint, minutes, tz, last_shot_day, last_sent_day FROM push_subs').all<PushRow>()
  const now = new Date()
  await Promise.all(
    results.map(async (row) => {
      const { decision, day } = decide(row, now)
      if (decision === 'wait') return
      if (decision === 'send') {
        const status = await sendPush(row.endpoint, VAPID_PUBLIC, env.VAPID_PRIVATE_JWK).catch(() => 0)
        if (status === 404 || status === 410) {
          await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(row.endpoint).run()
          return
        }
        if (status < 200 || status >= 300) return // try again on the next run, inside the window
      }
      await env.DB.prepare('UPDATE push_subs SET last_sent_day = ? WHERE endpoint = ?').bind(day, row.endpoint).run()
    }),
  )
}
