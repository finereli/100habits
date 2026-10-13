// Nightly reminders, per device, no account needed. The device subscribes to
// push and tells the server when to remind (local time + time zone) and the
// local date of its last shot, so a day with a shot already logged stays
// quiet. The server sends an empty push; the service worker (public/push-sw.js)
// writes the text from a random habit, read from the snapshot mirrored here.

import { localDateStr } from '$shared/lib/format'
import { habits } from './habits.svelte'
import { VAPID_PUBLIC } from './vapid'

const KEY = '100shots.reminders.v1'
const OFFER_KEY = '100shots.reminderOffer.v1'
const SNAPSHOT_CACHE = '100shots-reminder'
const SNAPSHOT_URL = '/__reminder.json'
const OFFER_AGAIN = 7 * 24 * 3600 * 1000

export const DEFAULT_TIME = '21:00'

export const isStandalone =
  typeof window !== 'undefined' &&
  (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)
export const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function keyBytes(b64url: string) {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

function lastShotDay(): string | null {
  let last = 0
  for (const h of habits.list) for (const s of h.shots) if (s.at > last) last = s.at
  return last ? localDateStr(new Date(last)) : null
}

async function post(path: string, body: object) {
  const res = await fetch(`/api/push/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res
}

class Reminders {
  on = $state(false)
  time = $state(DEFAULT_TIME)
  busy = $state(false)
  error = $state('')
  permission = $state<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  // On iPhone, push only works in the app added to the Home Screen.
  readonly needsInstall = isIOS && !isStandalone
  readonly supported = !this.needsInstall && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
  offerHiddenUntil = $state(0)
  #reportTimer: ReturnType<typeof setTimeout> | undefined
  #lastReported = ''

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      if (s) { this.on = !!s.on; this.time = s.time || DEFAULT_TIME }
      this.offerHiddenUntil = Number(localStorage.getItem(OFFER_KEY)) || 0
    } catch {}
  }

  #persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ on: this.on, time: this.time })) } catch {}
  }

  get canOffer() {
    return this.supported && !this.on && this.permission !== 'denied' && Date.now() > this.offerHiddenUntil
  }

  hideOffer() {
    this.offerHiddenUntil = Date.now() + OFFER_AGAIN
    try { localStorage.setItem(OFFER_KEY, String(this.offerHiddenUntil)) } catch {}
  }

  async #subscription(create: boolean): Promise<PushSubscription | null> {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing || !create) return existing
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) })
  }

  async #register(sub: PushSubscription) {
    const res = await post('subscribe', { endpoint: sub.endpoint, minutes: toMinutes(this.time), tz: tz(), lastShotDay: lastShotDay() })
    if (!res.ok) throw new Error(`subscribe ${res.status}`)
  }

  start() {
    habits.onWrite = () => { this.#snapshot(); this.#scheduleReport() }
    this.#snapshot()
    if (!this.on || !this.supported) return
    // Re-check on launch: permission may have been revoked, or the server may
    // have dropped the row. Re-subscribing is idempotent.
    if (Notification.permission !== 'granted') { this.on = false; this.#persist(); return }
    this.#subscription(true).then((s) => s && this.#register(s)).catch(() => {})
  }

  async enable(): Promise<boolean> {
    if (this.busy || !this.supported) return false
    this.busy = true
    this.error = ''
    try {
      this.permission = await Notification.requestPermission()
      if (this.permission !== 'granted') {
        this.error = this.permission === 'denied' ? 'Notifications are blocked for this site.' : ''
        return false
      }
      await this.#register((await this.#subscription(true))!)
      this.on = true
      this.#persist()
      this.#snapshot()
      return true
    } catch {
      this.error = "Couldn't turn reminders on. Check your connection and try again."
      return false
    } finally {
      this.busy = false
    }
  }

  async disable() {
    if (this.busy) return
    this.busy = true
    this.error = ''
    try {
      const sub = await this.#subscription(false)
      if (sub) {
        await post('unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
    } finally {
      this.on = false
      this.#persist()
      this.busy = false
    }
  }

  async setTime(t: string) {
    if (!/^\d{2}:\d{2}$/.test(t) || t === this.time) return
    this.time = t
    this.#persist()
    if (this.on) await this.#report(true)
  }

  async test(): Promise<boolean> {
    this.error = ''
    const sub = await this.#subscription(false).catch(() => null)
    if (!sub) { this.error = 'Not subscribed on this device. Turn reminders off and on again.'; return false }
    const res = await post('test', { endpoint: sub.endpoint }).catch(() => null)
    if (res?.status === 429) { this.error = 'One test at a time. Try again in a few seconds.'; return false }
    if (!res?.ok) { this.error = "The test didn't go through. Turn reminders off and on again."; return false }
    return true
  }

  // Tell the server the time, zone and last-shot day, when they change.
  #scheduleReport() {
    if (!this.on) return
    clearTimeout(this.#reportTimer)
    this.#reportTimer = setTimeout(() => this.#report(), 2000)
  }

  async #report(force = false) {
    const body = { minutes: toMinutes(this.time), tz: tz(), lastShotDay: lastShotDay() }
    const key = JSON.stringify(body)
    if (!force && key === this.#lastReported) return
    const sub = await this.#subscription(false).catch(() => null)
    if (!sub) return
    const res = await post('update', { endpoint: sub.endpoint, ...body }).catch(() => null)
    if (res?.status === 404) await this.#register(sub).catch(() => {})
    if (res?.ok || res?.status === 404) this.#lastReported = key
  }

  // The habit names the service worker picks from. Local only.
  #snapshot() {
    if (typeof caches === 'undefined') return
    const names = habits.list.map((h) => h.name)
    caches.open(SNAPSHOT_CACHE)
      .then((c) => c.put(SNAPSHOT_URL, new Response(JSON.stringify({ names }), { headers: { 'Content-Type': 'application/json' } })))
      .catch(() => {})
  }
}

export const reminders = new Reminders()

export function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d)
}
