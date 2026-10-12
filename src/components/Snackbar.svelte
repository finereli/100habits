<script lang="ts">
  import { fly } from 'svelte/transition'
  import { undo } from '../lib/undo.svelte'
</script>

<div class="wrap" aria-live="polite">
  {#if undo.current}
    {#key undo.current.id}
      <div class="bar" transition:fly={{ y: 16, duration: 180 }}>
        <span>{undo.current.text}</span>
        <button onclick={() => undo.run()}>Undo</button>
      </div>
    {/key}
  {/if}
</div>

<style>
  .wrap {
    position: fixed;
    inset-inline: 0;
    bottom: calc(var(--safe-bottom) + 16px);
    display: flex;
    justify-content: center;
    padding: 0 12px;
    z-index: 90;
    pointer-events: none;
  }
  .bar {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 480px;
    width: 100%;
    padding: 4px 4px 4px 16px;
    border-radius: 14px;
    background: #2c1810;
    color: #faf6f0;
    font-size: 0.88rem;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  }
  :global(.dark) .bar { background: #cdd6f4; color: #1e1e2e; }
  span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { color: var(--accent-light); font-weight: 600; padding: 12px 14px; border-radius: 10px; }
  :global(.dark) button { color: var(--accent-deep); }
</style>
