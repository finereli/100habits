<script lang="ts">
  // The pwa skill's confirmation (reference/behavior.md, Save model): inline
  // two-step, in place. The first tap arms the same button, which turns solid
  // and says what a second tap does; it disarms itself after a few seconds or
  // when focus leaves. Never confirm(): the native dialog speaks the
  // browser's language, not the app's.
  import type { Snippet } from 'svelte'

  let { onconfirm, confirmLabel, children, ms = 3000, class: cls = '' }: {
    onconfirm: () => void; confirmLabel: string; children: Snippet; ms?: number; class?: string
  } = $props()

  let armed = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function tap(e: MouseEvent) {
    e.stopPropagation()
    clearTimeout(timer)
    if (armed) { armed = false; onconfirm(); return }
    armed = true
    timer = setTimeout(() => (armed = false), ms)
  }

  $effect(() => () => clearTimeout(timer))
</script>

<button class="confirm {cls}" class:armed onclick={tap} onblur={() => (armed = false)} aria-live="polite">
  {#if armed}{confirmLabel}{:else}{@render children()}{/if}
</button>

<style>
  .confirm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 10px;
    color: var(--danger);
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
  }
  .confirm:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); }
  .confirm.armed { background: var(--danger); color: #fff; }
</style>
