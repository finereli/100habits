<script lang="ts">
  import Icon from './Icon.svelte'
  import { habits, shotLabel, shotsToday, TARGET, type Habit } from '../lib/habits.svelte'
  import { undo } from '../lib/undo.svelte'
  import { router } from '../lib/router.svelte'

  let { habit }: { habit: Habit } = $props()

  const n = $derived(habit.shots.length)
  // The big number is the shot you're about to take: 100 before the first.
  const next = $derived(shotLabel(n))
  const done = $derived(n >= TARGET)
  const today = $derived(shotsToday(habit))
  let pop = $state(0)
  let lastTap = 0

  function shoot(e: MouseEvent) {
    e.stopPropagation()
    // A double tap is almost always a bounce, not two attempts.
    const now = Date.now()
    if (now - lastTap < 700) return
    lastTap = now
    const label = shotLabel(n)
    const s = habits.shoot(habit.id)
    if (!s) return
    pop++
    navigator.vibrate?.(12)
    undo.offer(`${habit.name}: shot ${label} logged`, () => habits.removeShot(habit.id, s.id))
  }

  function undoLast(e: MouseEvent) {
    e.stopPropagation()
    const r = habits.undoLast(habit.id)
    if (r) undo.offer(`Shot ${shotLabel(r.index)} removed`, () => habits.restoreShot(habit.id, r.shot))
  }
</script>

<article class="card" class:done>
  <button class="open" onclick={() => router.go(`/h/${habit.id}`)} aria-label="Open {habit.name}"></button>

  <header>
    <h2>{habit.name}</h2>
    {#if today}<span class="today">{today} today</span>{/if}
  </header>

  <div class="main">
    <div class="count">
      {#key pop}<span class="num" class:popped={pop > 0}>{next}</span>{/key}
      <span class="label">
        {#if n === 0}first shot
        {:else if n < TARGET}{TARGET - n === 1 ? 'last bad shot' : 'next shot'}
        {:else if n === TARGET}100 bad shots, done
        {:else}past 100{/if}
      </span>
    </div>
    <button class="shoot" onclick={shoot} aria-label="Log shot {next}">
      <Icon name="check" size={40} />
    </button>
  </div>

  <div class="dots" aria-hidden="true">
    {#each { length: TARGET } as _, i}
      <span class:on={i < n}></span>
    {/each}
  </div>

  <footer>
    <span class="meta">{n} of {TARGET}{n > TARGET ? ` (+${n - TARGET})` : ''}</span>
    {#if n > 0}
      <button class="undo" onclick={undoLast} aria-label="Undo last shot">
        <Icon name="undo" size={16} /> Undo
      </button>
    {/if}
  </footer>
</article>

<style>
  .card {
    position: relative;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 16px 18px 10px;
    box-shadow: var(--shadow-card);
    transition: border-color 0.15s, transform 0.12s;
  }
  @media (hover: hover) { .card:hover { border-color: var(--accent-light); } }
  .card:has(.open:active) { transform: scale(0.99); }
  /* The whole card opens the habit; the buttons sit above this layer. */
  .open { position: absolute; inset: 0; border-radius: inherit; z-index: 0; }
  header, .main, footer { position: relative; z-index: 1; pointer-events: none; }
  .shoot, .undo { pointer-events: auto; }

  header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  h2 {
    font-size: 1.05rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .today {
    flex: none;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--accent);
    background: var(--accent-soft);
    padding: 2px 9px;
    border-radius: 99px;
  }

  .main { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 12px; }
  .count { display: flex; flex-direction: column; }
  .num {
    font-family: var(--font-num);
    font-size: 3.2rem;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
    display: inline-block;
    transform-origin: left center;
  }
  .popped { animation: pop 0.28s cubic-bezier(0.3, 1.6, 0.6, 1); }
  @keyframes pop { from { transform: scale(0.8); opacity: 0.4; } to { transform: scale(1); opacity: 1; } }
  .label { font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px; letter-spacing: 0.02em; }
  .done .num { color: var(--accent); }

  .shoot {
    width: 68px;
    height: 68px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #fff;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent);
    transition: transform 0.12s, background 0.15s;
  }
  .shoot:hover { background: var(--accent-deep); }
  .shoot:active { transform: scale(0.92); }

  .dots {
    display: grid;
    grid-template-columns: repeat(25, 1fr);
    gap: 3px;
  }
  .dots span {
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--dot-empty);
    transition: background 0.2s;
  }
  .dots span.on { background: var(--accent); }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    margin-top: 6px;
  }
  .meta { font-size: 0.75rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .undo {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding: 10px 4px 10px 12px;
    margin-right: -4px;
    border-radius: 8px;
  }
  .undo:hover { color: var(--accent-deep); }
</style>
