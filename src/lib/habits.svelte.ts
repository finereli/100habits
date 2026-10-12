// The habits store. Local-first: the whole dataset lives in localStorage and
// every read is synchronous. Ids and timestamps are already shaped for a later
// cloud sync (UUIDs, epoch ms), so merging two devices is a union by id.

import { toasts } from '$shared/lib/toast.svelte'

export const TARGET = 100
const KEY = '100shots.data.v1'

export interface Shot { id: string; at: number }
export interface Habit { id: string; name: string; createdAt: number; shots: Shot[] }
interface Data { version: 1; habits: Habit[] }

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

// Shot i (0-based, chronological) is number TARGET - i: the first is 100.
// Past the hundredth the count goes up again as +1, +2...
export function shotLabel(i: number): string {
  const n = TARGET - i
  return n >= 1 ? String(n) : `+${1 - n}`
}

class Habits {
  list = $state<Habit[]>([])

  constructor() {
    this.#load()
    // Another tab wrote: take its copy.
    if (typeof window !== 'undefined') addEventListener('storage', (e) => e.key === KEY && this.#load())
  }

  #load() {
    try {
      const raw = localStorage.getItem(KEY)
      const data = raw ? (JSON.parse(raw) as Data) : null
      this.list = data?.habits ?? []
    } catch {
      this.list = []
    }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, habits: $state.snapshot(this.list) } satisfies Data))
    } catch {
      toasts.error("Couldn't save on this device")
    }
  }

  byId(id: string) { return this.list.find((h) => h.id === id) }

  add(name: string): Habit {
    const h: Habit = { id: uid(), name: name.trim(), createdAt: Date.now(), shots: [] }
    this.list.push(h)
    this.#save()
    return h
  }

  rename(id: string, name: string) {
    const h = this.byId(id)
    if (!h || !name.trim() || h.name === name.trim()) return
    h.name = name.trim()
    this.#save()
  }

  remove(id: string): Habit | undefined {
    const i = this.list.findIndex((h) => h.id === id)
    if (i < 0) return
    const [h] = this.list.splice(i, 1)
    this.#save()
    return h
  }

  // Put a deleted habit back where it was (undo).
  restore(h: Habit, index: number) {
    if (this.byId(h.id)) return
    this.list.splice(Math.min(index, this.list.length), 0, h)
    this.#save()
  }

  shoot(id: string): Shot | undefined {
    const h = this.byId(id)
    if (!h) return
    const s = { id: uid(), at: Date.now() }
    h.shots.push(s)
    this.#save()
    return s
  }

  removeShot(id: string, shotId: string): { shot: Shot; index: number } | undefined {
    const h = this.byId(id)
    const i = h?.shots.findIndex((s) => s.id === shotId) ?? -1
    if (!h || i < 0) return
    const [shot] = h.shots.splice(i, 1)
    this.#save()
    return { shot, index: i }
  }

  restoreShot(id: string, shot: Shot) {
    const h = this.byId(id)
    if (!h || h.shots.some((s) => s.id === shot.id)) return
    h.shots.push(shot)
    h.shots.sort((a, b) => a.at - b.at)
    this.#save()
  }

  undoLast(id: string) {
    const h = this.byId(id)
    const last = h?.shots.at(-1)
    return last ? this.removeShot(id, last.id) : undefined
  }
}

export const habits = new Habits()

export function shotsToday(h: Habit): number {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return h.shots.filter((s) => s.at >= start.getTime()).length
}
