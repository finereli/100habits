// The API. Everything else is static assets. One route: POST /api/sync takes
// a device's whole dataset, merges it with the stored copy, stores and
// returns the merge. Who you are comes from a login.finereli.com token.

import { verifyLogin } from './verify-login'
import { merge, type Data } from '../src/lib/merge'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  // Only for local testing against a stand-in login service.
  LOGIN_ISSUER?: string
}

const AUDIENCE = ['https://100shots.finereli.com', 'http://localhost:5173']
const MAX_BYTES = 2_000_000

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname !== '/api/sync') return url.pathname.startsWith('/api/') ? new Response('Not found', { status: 404 }) : env.ASSETS.fetch(req)
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

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
  },
} satisfies ExportedHandler<Env>
