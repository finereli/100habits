<script lang="ts">
  import Icon from './Icon.svelte'
  import { habits, shotLabel, TARGET, type Habit } from '../lib/habits.svelte'
  import { undo } from '../lib/undo.svelte'
  import { router } from '../lib/router.svelte'

  let { habit }: { habit: Habit } = $props()

  let name = $state('')
  let initFor = ''
  $effect.pre(() => {
    // Init the field once per habit, never on a re-render.
    if (initFor !== habit.id) { initFor = habit.id; name = habit.name }
  })
  let confirming = $state(false)

  const n = $derived(habit.shots.length)
  // Newest first, each with its number in the countdown.
  const rows = $derived(habit.shots.map((s, i) => ({ s, label: shotLabel(i) })).reverse())

  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
  const started = $derived(new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(habit.createdAt))

  function save() {
    if (name.trim()) habits.rename(habit.id, name)
    else name = habit.name
  }

  function removeShot(id: string) {
    const r = habits.removeShot(habit.id, id)
    if (r) undo.offer(`Shot ${shotLabel(r.index)} removed`, () => habits.restoreShot(habit.id, r.shot))
  }

  function del() {
    const index = habits.list.indexOf(habit)
    const h = habits.remove(habit.id)
    router.go('/')
    if (h) undo.offer(`Deleted ${h.name}`, () => habits.restore(h, index), 7000)
  }
</script>

<div class="detail">
  <label class="name">
    <span>Name</span>
    <input bind:value={name} onblur={save} onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} maxlength="60" enterkeyhint="done" />
  </label>

  <div class="stats">
    <div><strong>{shotLabel(n)}</strong><span>next shot</span></div>
    <div><strong>{n}</strong><span>taken</span></div>
    <div><strong>{Math.max(TARGET - n, 0)}</strong><span>bad ones left</span></div>
  </div>
  <p class="since">Started {started}</p>

  <h3>Shots</h3>
  {#if rows.length}
    <ul class="shots">
      {#each rows as { s, label } (s.id)}
        <li>
          <span class="no">{label}</span>
          <span class="when">{dayFmt.format(s.at)} · {timeFmt.format(s.at)}</span>
          <button class="x" onclick={() => removeShot(s.id)} aria-label="Remove shot {label}">
            <Icon name="close" size={20} />
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No shots yet. The first one is number 100, and it's allowed to be terrible.</p>
  {/if}

  <div class="danger">
    {#if confirming}
      <span>Delete “{habit.name}” and its {n} shots?</span>
      <div class="row">
        <button class="ghost" onclick={() => (confirming = false)}>Keep</button>
        <button class="red" onclick={del}>Delete</button>
      </div>
    {:else}
      <button class="del" onclick={() => (confirming = true)}>
        <Icon name="delete" size={20} /> Delete habit
      </button>
    {/if}
  </div>
</div>

<style>
  .detail { max-width: 620px; margin: 0 auto; padding: 18px 16px calc(var(--safe-bottom) + 40px); }
  .name { display: flex; flex-direction: column; gap: 6px; }
  .name span, h3 {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
  }
  .name input {
    font-size: 1.15rem;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-raised);
    outline: none;
  }
  .name input:focus { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }

  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
  .stats div {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 6px;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
  .stats strong { font-family: var(--font-num); font-size: 1.8rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stats span { font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px; }
  .since { font-size: 0.78rem; color: var(--text-secondary); margin: 10px 2px 0; }

  h3 { margin: 26px 2px 8px; }
  .shots {
    list-style: none;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
  }
  .shots li { display: flex; align-items: center; gap: 12px; padding: 2px 4px 2px 16px; min-height: 48px; }
  .shots li + li { border-top: 1px solid var(--border); }
  .no { font-family: var(--font-num); font-weight: 600; min-width: 2.4em; font-variant-numeric: tabular-nums; }
  .when { flex: 1; font-size: 0.85rem; color: var(--text-secondary); }
  .x { width: 44px; height: 44px; display: grid; place-items: center; color: var(--text-secondary); border-radius: 50%; opacity: 0.7; }
  .x:hover { color: var(--danger); opacity: 1; background: var(--bg-hover); }
  .empty { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; padding: 4px 2px; }

  .danger { margin-top: 36px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
  .danger span { font-size: 0.9rem; }
  .row { display: flex; gap: 8px; }
  .row button { padding: 10px 20px; border-radius: 10px; font-size: 0.9rem; font-weight: 500; }
  .ghost { color: var(--text-secondary); border: 1px solid var(--border); }
  .red { background: var(--danger); color: #fff; }
  .del { display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.88rem; padding: 12px 16px; border-radius: 10px; }
  .del:hover { color: var(--danger); }
</style>
