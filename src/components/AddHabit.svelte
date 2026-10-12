<script lang="ts">
  import Icon from './Icon.svelte'
  import { habits } from '../lib/habits.svelte'

  let { autofocus = false }: { autofocus?: boolean } = $props()
  let open = $state(false)
  let name = $state('')
  let input = $state<HTMLInputElement>()

  $effect(() => { if (autofocus) open = true })
  $effect(() => { if (open) input?.focus() })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!name.trim()) return
    habits.add(name)
    name = ''
    open = false
  }
</script>

{#if open}
  <form class="add form" onsubmit={submit}>
    <input
      bind:this={input}
      bind:value={name}
      placeholder="What are you practicing?"
      maxlength="60"
      enterkeyhint="done"
      onkeydown={(e) => e.key === 'Escape' && ((open = false), (name = ''))}
    />
    <div class="row">
      <button type="button" class="ghost" onclick={() => ((open = false), (name = ''))}>Cancel</button>
      <button type="submit" class="primary" disabled={!name.trim()}>Start at 100</button>
    </div>
  </form>
{:else}
  <button class="add" onclick={() => (open = true)}>
    <Icon name="add" size={24} /> New habit
  </button>
{/if}

<style>
  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 64px;
    border: 1.5px dashed var(--border);
    border-radius: 18px;
    color: var(--text-secondary);
    font-size: 0.95rem;
    transition: border-color 0.15s, color 0.15s;
  }
  button.add:hover { border-color: var(--accent-light); color: var(--accent-deep); }
  .form {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 14px;
    border-style: solid;
    background: var(--bg-raised);
  }
  input {
    width: 100%;
    font-size: 1rem;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-surface);
    outline: none;
  }
  input:focus { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .row { display: flex; justify-content: flex-end; gap: 8px; }
  .row button { padding: 10px 18px; border-radius: 10px; font-size: 0.9rem; font-weight: 500; }
  .ghost { color: var(--text-secondary); }
  .primary { background: var(--accent); color: #fff; }
  .primary:disabled { opacity: 0.45; }
</style>
