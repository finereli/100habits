<script lang="ts">
  import Icon from './Icon.svelte'
  import { reminders, formatTime } from '../lib/reminders.svelte'
  import { account, login } from '../lib/account.svelte'
  import { sync } from '../lib/sync.svelte'

  let tested = $state(false)
  let confirmingSignOut = $state(false)
  const syncLabel = $derived({ off: '', syncing: 'Syncing…', ok: 'Synced', error: 'Offline, will sync later' }[sync.status])

  async function test() {
    tested = false
    if (await reminders.test()) {
      tested = true
      setTimeout(() => (tested = false), 5000)
    }
  }
</script>

<div class="settings">
  <section>
    <h3>Reminders</h3>
    <div class="card">
      {#if reminders.needsInstall}
        <p>Add 100 Shots to your Home Screen to get reminders: tap <span class="inline"><Icon name="ios_share" size={16} /></span>, then “Add to Home Screen”, and open it from there.</p>
      {:else if !reminders.supported}
        <p>This browser can't show reminders. Try Chrome, Edge or Firefox, or install the app on your phone.</p>
      {:else}
        <p class="lead">
          {#if reminders.on}
            A reminder at <strong>{formatTime(reminders.time)}</strong> every day you haven't logged a shot yet.
          {:else}
            Get a nudge in the evening to log any shots you took. Skipped on days you already have.
          {/if}
        </p>

        <label class="row">
          <span>Remind me at</span>
          <input type="time" step="300" value={reminders.time} onchange={(e) => reminders.setTime((e.currentTarget as HTMLInputElement).value)} />
        </label>

        {#if reminders.permission === 'denied' && !reminders.on}
          <p class="note">Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.</p>
        {/if}

        <div class="actions">
          {#if reminders.on}
            <button class="btn" onclick={test} disabled={reminders.busy}>Send a test</button>
            <button class="btn ghost" onclick={() => reminders.disable()} disabled={reminders.busy}>Turn off</button>
          {:else}
            <button class="btn primary" onclick={() => reminders.enable()} disabled={reminders.busy || reminders.permission === 'denied'}>
              <Icon name="notifications" size={20} /> Turn on reminders
            </button>
          {/if}
        </div>
        {#if tested}<p class="ok">Sent. It should arrive in a few seconds.</p>{/if}
        {#if reminders.error}<p class="err">{reminders.error}</p>{/if}
      {/if}
    </div>
  </section>

  <section>
    <h3>Account</h3>
    <div class="card">
      {#if account.user}
        <div class="who">
          <strong>{account.user.name}</strong>
          <span>{account.user.email}</span>
          {#if syncLabel}<span class="status" class:error={sync.status === 'error'}>{syncLabel}</span>{/if}
        </div>
        {#if confirmingSignOut}
          <p class="note">Signing out removes your shots from this device. They stay in your account.</p>
          <div class="actions">
            <button class="btn ghost" onclick={() => (confirmingSignOut = false)}>Cancel</button>
            <button class="btn primary" onclick={async () => { await sync.signOut(); confirmingSignOut = false }}>
              <Icon name="logout" size={20} /> Sign out
            </button>
          </div>
        {:else}
          <div class="actions">
            <button class="btn" onclick={() => (confirmingSignOut = true)}><Icon name="logout" size={20} /> Sign out</button>
          </div>
        {/if}
      {:else}
        <p class="lead">Sign in to keep your shots on every device. Without an account they stay on this one.</p>
        <div class="actions">
          <button class="btn primary" onclick={() => login.signIn()}><Icon name="cloud" size={20} /> Sign in with Google</button>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  .settings { max-width: 620px; margin: 0 auto; padding: 18px 16px calc(var(--safe-bottom) + 40px); display: flex; flex-direction: column; gap: 24px; }
  h3 {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    margin: 0 2px 8px;
  }
  .card {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    line-height: 1.5;
    font-size: 0.92rem;
  }
  .lead strong { font-weight: 600; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .row input {
    font-size: 1rem;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-surface);
    min-height: 44px;
  }
  .row input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 500;
    border: 1px solid var(--border);
    color: var(--text-primary);
  }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn.ghost { color: var(--text-secondary); }
  .btn:disabled { opacity: 0.5; }
  .note { font-size: 0.85rem; color: var(--text-secondary); }
  .ok { font-size: 0.85rem; color: var(--ok); }
  .err { font-size: 0.85rem; color: var(--danger); }
  .inline { display: inline-flex; vertical-align: -3px; }
  .who { display: flex; flex-direction: column; }
  .who strong { font-weight: 500; }
  .who span { color: var(--text-secondary); font-size: 0.85rem; }
  .who .status.error { color: var(--accent); }
</style>
