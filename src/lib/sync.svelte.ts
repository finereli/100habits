// Sync: send the whole dataset, get back the merge with the server's copy,
// merge that with whatever changed here in the meantime. Runs on start, a
// moment after each edit, when the app comes back to the foreground, and
// when it goes to the background. Signed out, it does nothing.

import { toasts } from '$shared/lib/toast.svelte'
import { habits } from './habits.svelte'
import { account, login } from './account.svelte'
import { merge, type Data } from './merge'

const DELAY = 1500

class Sync {
  status = $state<'off' | 'syncing' | 'ok' | 'error'>(login.user ? 'ok' : 'off')
  #timer: ReturnType<typeof setTimeout> | undefined
  #running: Promise<boolean> | null = null
  #edits = 0

  start() {
    habits.onEdit = () => { this.#edits++; this.schedule() }
    login.onChange((u) => {
      this.status = u ? 'ok' : 'off'
      if (u) this.now()
    })
    document.addEventListener('visibilitychange', () => this.now())
    addEventListener('online', () => this.now())
    if (login.user) this.now()
  }

  schedule() {
    if (!login.user) return
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.now(), DELAY)
  }

  // Resolves true once the server has everything this device had.
  async now(): Promise<boolean> {
    clearTimeout(this.#timer)
    if (!login.token) return false
    if (this.#running) await this.#running.catch(() => {})
    this.#running = this.#once()
    try { return await this.#running } finally { this.#running = null }
  }

  async #once(): Promise<boolean> {
    const edits = this.#edits
    this.status = 'syncing'
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
      body: JSON.stringify(habits.data()),
    }).catch(() => null)
    if (res?.status === 401) {
      login.handleUnauthorized()
      toasts.error('Signed out. Sign in again to keep syncing.')
      return false
    }
    if (!res?.ok) { this.status = 'error'; return false }
    const server = (await res.json()) as Data
    habits.replace(merge(habits.data(), server))
    this.status = 'ok'
    // Edits landed while we were away: they're merged in locally, send them.
    if (this.#edits !== edits) { this.schedule(); return false }
    return true
  }

  // Sign out only once the server has this device's shots, then forget them
  // here, so the next person on this device starts empty.
  async signOut() {
    if (!(await this.now())) {
      toasts.error("Couldn't reach the server. Your shots are still on this device; try again when you're online.")
      return
    }
    login.signOut()
    habits.clear()
  }
}

export const sync = new Sync()
export { account }
