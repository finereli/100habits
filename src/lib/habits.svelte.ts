// The habits store. Local-first: the whole dataset lives in localStorage and
// every read is synchronous. Sync (sync.svelte.ts) sends the whole thing and
// takes back the merge (merge.ts), so every edit here records what merging
// needs: deletes leave tombstones, undo marks the item alive again (`t`), and
// a rename stamps `nameAt`.

import { toasts } from '$shared/lib/toast.svelte'
import type { Data, Habit, Shot } from './merge'
export type { Habit, Shot } from './merge'

export const TARGET = 100
const KEY = '100shots.data.v1'


const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

// Shot i (0-based, chronological) is number TARGET - i: the first is 100.
// Past the hundredth the count goes up again as +1, +2...
export function shotLabel(i: number): string {
  const n = TARGET - i
  return n >= 1 ? String(n) : `+${1 - n}`
}

class Habits {
  list = $state<Habit[]>([])
  #tombstones: Record<string, number> = {}
  // Called after every local edit (sync schedules itself here).
  onEdit: () => void = () => {}
  // Called after every write, edits and merges alike (reminders mirror the list).
  onWrite: () => void = () => {}

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
      this.#tombstones = data?.tombstones ?? {}
    } catch {
      this.list = []
      this.#tombstones = {}
    }
  }

  #write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data()))
    } catch {
      toasts.error("Couldn't save on this device")
    }
    this.onWrite()
  }

  #save() {
    this.#write()
    this.onEdit()
  }

  data(): Data {
    return { version: 1, habits: $state.snapshot(this.list), tombstones: { ...this.#tombstones } }
  }

  // Take a merged copy from sync. Not an edit, so it doesn't sync again.
  replace(data: Data) {
    this.list = data.habits
    this.#tombstones = data.tombstones ?? {}
    this.#write()
  }

  // Signing out: this device forgets everything (it's on the server).
  clear() {
    this.list = []
    this.#tombstones = {}
    this.#write()
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
    h.nameAt = Date.now()
    this.#save()
  }

  remove(id: string): Habit | undefined {
    const i = this.list.findIndex((h) => h.id === id)
    if (i < 0) return
    const [h] = this.list.splice(i, 1)
    this.#tombstones[h.id] = Date.now()
    this.#save()
    return h
  }

  // Put a deleted habit back where it was (undo).
  restore(h: Habit, index: number) {
    if (this.byId(h.id)) return
    this.list.splice(Math.min(index, this.list.length), 0, { ...h, t: Date.now() })
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
    this.#tombstones[shot.id] = Date.now()
    this.#save()
    return { shot, index: i }
  }

  restoreShot(id: string, shot: Shot) {
    const h = this.byId(id)
    if (!h || h.shots.some((s) => s.id === shot.id)) return
    h.shots.push({ ...shot, t: Date.now() })
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
