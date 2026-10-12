import { describe, expect, it } from 'vitest'
import { merge, type Data, type Habit } from '../src/lib/merge'

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({ id, name: id, createdAt: 1, shots: [], ...over })
const data = (habits: Habit[], tombstones: Record<string, number> = {}): Data => ({ version: 1, habits, tombstones })
const ids = (d: Data) => d.habits.map((h) => `${h.id}:${h.shots.map((s) => s.id).join(',')}`)

describe('merge', () => {
  it('unions habits and shots from two devices', () => {
    const phone = data([habit('a', { shots: [{ id: 's1', at: 10 }] })])
    const laptop = data([habit('a', { shots: [{ id: 's2', at: 5 }] }), habit('b', { createdAt: 2 })])
    expect(ids(merge(phone, laptop))).toEqual(['a:s2,s1', 'b:'])
    expect(ids(merge(laptop, phone))).toEqual(['a:s2,s1', 'b:'])
  })

  it('a delete on one device removes it everywhere', () => {
    const phone = data([habit('a', { shots: [{ id: 's1', at: 10 }, { id: 's2', at: 11 }] })], { s1: 20 })
    const laptop = data([habit('a', { shots: [{ id: 's1', at: 10 }, { id: 's2', at: 11 }] }), habit('b')], { b: 30 })
    expect(ids(merge(phone, laptop))).toEqual(['a:s2'])
    expect(ids(merge(laptop, phone))).toEqual(['a:s2'])
  })

  it('undo after the delete reached the server wins', () => {
    const server = data([], { a: 100, s1: 100 })
    const device = data([habit('a', { t: 105, shots: [{ id: 's1', at: 10, t: 106 }] })], { a: 100, s1: 100 })
    expect(ids(merge(server, device))).toEqual(['a:s1'])
    // ...and a stale copy from a third device doesn't bring the delete back.
    expect(ids(merge(merge(server, device), data([habit('a', { shots: [{ id: 's1', at: 10 }] })])))).toEqual(['a:s1'])
  })

  it('the later rename wins', () => {
    const a = data([habit('h', { name: 'Old', nameAt: 5 })])
    const b = data([habit('h', { name: 'New', nameAt: 9 })])
    expect(merge(a, b).habits[0].name).toBe('New')
    expect(merge(b, a).habits[0].name).toBe('New')
  })

  it('merging a copy into itself changes nothing', () => {
    const d = data([habit('a', { shots: [{ id: 's1', at: 10 }] }), habit('b', { createdAt: 3 })], { x: 1 })
    expect(merge(d, d)).toEqual(merge(merge(d, d), d))
    expect(ids(merge(d, d))).toEqual(ids(d))
  })
})
