// One undo slot, shown as a snackbar. A new action replaces the old offer:
// the snackbar is for "oops, wrong card", not a history.

class Undo {
  current = $state<{ id: number; text: string; run: () => void } | null>(null)
  #timer: ReturnType<typeof setTimeout> | undefined
  #id = 0

  offer(text: string, run: () => void, ms = 5000) {
    clearTimeout(this.#timer)
    const id = ++this.#id
    this.current = { id, text, run }
    this.#timer = setTimeout(() => this.dismiss(id), ms)
  }

  run() {
    const c = this.current
    if (!c) return
    this.dismiss(c.id)
    c.run()
  }

  dismiss(id?: number) {
    if (id !== undefined && this.current?.id !== id) return
    clearTimeout(this.#timer)
    this.current = null
  }
}

export const undo = new Undo()
