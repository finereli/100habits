<script lang="ts">
  // The second onboarding step, after the install banner and in its style: a
  // lower-third offer to turn on the nightly reminder. Tap turns it on (the
  // browser asks for permission); close hides the offer for a week.
  import Icon from './Icon.svelte'
  import { reminders, formatTime } from '../lib/reminders.svelte'
  import { undo } from '../lib/undo.svelte'
  import { toasts } from '$shared/lib/toast.svelte'

  let { bottom = '16px' }: { bottom?: string } = $props()

  async function turnOn() {
    if (await reminders.enable()) {
      undo.offer(`Reminders on at ${formatTime(reminders.time)}`, () => reminders.disable())
    } else if (reminders.permission === 'denied') {
      reminders.hideOffer()
    } else if (reminders.error) {
      toasts.error(reminders.error)
    }
  }
</script>

<div class="banner" role="alert" style:bottom>
  <button class="tip" onclick={turnOn} disabled={reminders.busy}>
    <span class="lead"><Icon name="notifications" size={20} /></span>
    <span class="text">Remind me at {formatTime(reminders.time)} to log my shots</span>
  </button>
  <button class="close" onclick={() => reminders.hideOffer()} aria-label="Not now">
    <Icon name="close" size={18} />
  </button>
</div>

<style>
  /* Same look as the kit's InstallBanner, so the two read as one flow. */
  .banner {
    --highlight: #ecc65a;
    position: absolute;
    inset-inline-start: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: min(84vw, 340px);
    padding: 9px 12px 9px 14px;
    background: color-mix(in srgb, var(--accent-deep) 94%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #fff;
    border-radius: 12px;
    border-inline-end: 3px solid var(--highlight);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
    animation: chyron-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .tip { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; text-align: start; line-height: 1.35; color: #fff; }
  .tip:disabled { opacity: 0.7; }
  .lead { flex: none; display: inline-flex; color: var(--highlight); }
  .text { font-size: 0.86rem; font-weight: 500; }
  .close { flex: none; display: grid; place-items: center; color: #fff; opacity: 0.55; transition: opacity 0.15s; }
  .close:hover { opacity: 1; }
  @keyframes chyron-in {
    from { transform: translateX(-115%); opacity: 0; }
    60% { opacity: 1; }
    to { transform: translateX(0); opacity: 1; }
  }
</style>
