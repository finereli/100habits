// Merging two copies of the data (this device and the server, or two devices).
// Pure, shared by the app and the Worker, and safe to run in any order: merging
// A into B keeps the same habits and shots as B into A, and merging a copy
// into itself changes nothing. That is what lets sync be "send everything,
// keep the union" with no conflicts to resolve.
//
// Every habit and shot has an id. A delete leaves a tombstone (id -> when).
// An item carries `t`, the last time it was made alive (created or restored
// by undo); it is alive if it was made alive after its tombstone. So an undo
// beats the delete it undoes even if the delete already reached the server.
// A habit's name is last-writer-wins on `nameAt`.

export interface Shot { id: string; at: number; t?: number }
export interface Habit { id: string; name: string; nameAt?: number; createdAt: number; t?: number; shots: Shot[] }
export interface Data { version: 1; habits: Habit[]; tombstones?: Record<string, number> }

const aliveAt = (x: { t?: number }, fallback: number) => x.t ?? fallback

export function merge(a: Data, b: Data): Data {
  const tombstones: Record<string, number> = { ...a.tombstones }
  for (const [id, at] of Object.entries(b.tombstones ?? {})) tombstones[id] = Math.max(tombstones[id] ?? 0, at)
  const alive = (id: string, t: number) => !(id in tombstones) || t > tombstones[id]

  const byId = new Map<string, Habit>()
  const order: string[] = []
  for (const h of [...a.habits, ...b.habits]) {
    const prev = byId.get(h.id)
    if (!prev) { byId.set(h.id, { ...h, shots: [...h.shots] }); order.push(h.id); continue }
    const newerName = (h.nameAt ?? h.createdAt) > (prev.nameAt ?? prev.createdAt)
    byId.set(h.id, {
      id: h.id,
      name: newerName ? h.name : prev.name,
      nameAt: Math.max(h.nameAt ?? h.createdAt, prev.nameAt ?? prev.createdAt),
      createdAt: Math.min(h.createdAt, prev.createdAt),
      t: Math.max(aliveAt(h, h.createdAt), aliveAt(prev, prev.createdAt)),
      shots: mergeShots(prev.shots, h.shots),
    })
  }

  const habits = order
    .map((id) => byId.get(id)!)
    .filter((h) => alive(h.id, aliveAt(h, h.createdAt)))
    .map((h) => ({ ...h, shots: h.shots.filter((s) => alive(s.id, aliveAt(s, s.at))) }))
  // Keep the first copy's order (this device's), with new arrivals by age.
  habits.sort((x, y) => rank(a, x) - rank(a, y) || x.createdAt - y.createdAt)
  return { version: 1, habits, tombstones }
}

function rank(a: Data, h: Habit) {
  const i = a.habits.findIndex((x) => x.id === h.id)
  return i < 0 ? Infinity : i
}

function mergeShots(x: Shot[], y: Shot[]): Shot[] {
  const m = new Map<string, Shot>()
  for (const s of [...x, ...y]) {
    const prev = m.get(s.id)
    m.set(s.id, prev ? { ...prev, t: Math.max(aliveAt(prev, prev.at), aliveAt(s, s.at)) } : s)
  }
  return [...m.values()].sort((p, q) => p.at - q.at)
}
