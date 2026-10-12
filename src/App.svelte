<script lang="ts">
  import TopBar from '$shared/ui/TopBar.svelte'
  import Drawer from '$shared/ui/Drawer.svelte'
  import ResetButton from '$shared/ui/ResetButton.svelte'
  import Toast from '$shared/ui/Toast.svelte'
  import { isDark, setDarkMode } from '$shared/lib/theme'
  import Icon from './components/Icon.svelte'
  import HabitCard from './components/HabitCard.svelte'
  import AddHabit from './components/AddHabit.svelte'
  import HabitDetail from './components/HabitDetail.svelte'
  import About from './components/About.svelte'
  import Snackbar from './components/Snackbar.svelte'
  import { habits } from './lib/habits.svelte'
  import { router } from './lib/router.svelte'
  import { account, login } from './lib/account.svelte'
  import { sync } from './lib/sync.svelte'

  router.start()

  let menuOpen = $state(false)
  let dark = $state(isDark())
  router.onChange(() => (menuOpen = false))

  const route = $derived(router.route)
  const habit = $derived(route.view === 'habit' ? habits.byId(route.id) : undefined)
  // A dead link (deleted habit) goes home.
  $effect(() => { if (route.view === 'habit' && !habit) router.replace('/') })

  const entries = $derived([
    { label: 'Habits', hash: '/', current: route.view === 'home' },
    { label: 'The idea', hash: '/about', current: route.view === 'about' },
  ])
  const title = $derived(route.view === 'about' ? 'The idea' : habit ? habit.name : '100 Shots')

  const syncLabel = $derived({ off: '', syncing: 'Syncing…', ok: 'Synced', error: "Offline, will sync later" }[sync.status])

  function toggleDark() {
    dark = !dark
    setDarkMode(dark)
  }
</script>

<div class="shell">
  {#if route.view === 'habit'}
    <TopBar leading="back" {title} onleading={() => router.back()} />
  {:else}
    <TopBar leading="menu" {title} onleading={() => (menuOpen = true)} />
  {/if}

  <main class="body">
    {#if route.view === 'about'}
      <About />
    {:else if habit}
      <HabitDetail {habit} />
    {:else}
      <div class="list">
        {#if habits.list.length === 0}
          <div class="intro">
            <p class="big">Expect 100 bad attempts.</p>
            <p>Pick something you're bad at. Your first attempt is number 100, the next is 99, and so on down. Every bad one is part of the plan.</p>
          </div>
        {/if}
        {#each habits.list as h (h.id)}
          <HabitCard habit={h} />
        {/each}
        <AddHabit autofocus={habits.list.length === 0} />
      </div>
    {/if}
  </main>
</div>

<Drawer open={menuOpen} onclose={() => (menuOpen = false)} {entries}>
  {#snippet brand()}
    <div class="brand"><span class="mark">100</span><strong>Shots</strong></div>
  {/snippet}
  {#snippet footer()}
    {#if account.user}
      <div class="account">
        <div class="who">
          <strong>{account.user.name}</strong>
          <span>{account.user.email}</span>
          <span class="status" class:error={sync.status === 'error'}>{syncLabel}</span>
        </div>
        <button class="link" onclick={() => sync.signOut()} tabindex={menuOpen ? 0 : -1}>Sign out</button>
      </div>
    {:else}
      <button class="signin" onclick={() => login.signIn()} tabindex={menuOpen ? 0 : -1}>
        <Icon name="cloud" size={20} />
        Sign in to sync
      </button>
      <p class="hint">Keep your shots on every device. Your shots stay here either way.</p>
    {/if}
    <button class="mode" onclick={toggleDark} tabindex={menuOpen ? 0 : -1}>
      <Icon name={dark ? 'light_mode' : 'dark_mode'} size={20} />
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
    <!-- The reload icon is the always-there escape hatch (forget the cached
         app, load it fresh); it lights up when a new version is waiting. -->
    <p class="build">
      <span>Version {__BUILD__}</span>
      <ResetButton tabindex={menuOpen ? 0 : -1} />
    </p>
  {/snippet}
</Drawer>

<Snackbar />
<Toast />

<style>
  .shell { display: flex; flex-direction: column; height: 100%; }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
  @media (min-width: 768px) {
    .shell { margin-inline-start: min(78vw, 300px); }
  }
  .list {
    max-width: 620px;
    margin: 0 auto;
    padding: 16px 14px calc(var(--safe-bottom) + 96px);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .intro { padding: 12px 6px 4px; line-height: 1.55; color: var(--text-secondary); }
  .intro .big { font-family: var(--font-num); font-size: 1.6rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; line-height: 1.2; }

  .brand { display: flex; align-items: baseline; gap: 6px; font-size: 1.2rem; }
  .mark { font-family: var(--font-num); font-weight: 700; color: var(--accent); }
  .brand strong { font-weight: 500; }
  .account { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 4px 0 10px; }
  .who { display: flex; flex-direction: column; min-width: 0; font-size: 0.85rem; }
  .who strong { font-weight: 500; }
  .who span { color: var(--text-secondary); font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; }
  .who .status.error { color: var(--accent); }
  .link { font-size: 0.8rem; color: var(--accent); padding: 2px 0; white-space: nowrap; }
  .signin { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; color: var(--accent); padding: 8px 0 2px; }
  .hint { font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 8px; }
  .mode { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-secondary); padding: 8px 0; }
  .build { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: var(--text-secondary); margin-top: 8px; }
  .build span { opacity: 0.6; }
</style>
