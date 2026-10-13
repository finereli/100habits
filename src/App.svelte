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
  import Settings from './components/Settings.svelte'
  import InstallBanner from './components/InstallBanner.svelte'
  import ReminderBanner from './components/ReminderBanner.svelte'
  import { reminders, isIOS, isStandalone } from './lib/reminders.svelte'
  import { habits } from './lib/habits.svelte'
  import { router } from './lib/router.svelte'

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
    { label: 'Settings', hash: '/settings', current: route.view === 'settings' },
    { label: 'The idea', hash: '/about', current: route.view === 'about' },
  ])
  const title = $derived(route.view === 'about' ? 'The idea' : route.view === 'settings' ? 'Settings' : habit ? habit.name : '100 Shots')

  // Onboarding, once there's a first habit: install the app, then turn on
  // the nightly reminder. One banner at a time, on the home screen only.
  let installable = $state(!!window.__pwaInstallPrompt)
  let installDone = $state(false) // installed, or dismissed for this session
  $effect(() => {
    const ready = () => (installable = true)
    addEventListener('beforeinstallprompt', ready)
    return () => removeEventListener('beforeinstallprompt', ready)
  })
  const onboarding = $derived(route.view === 'home' && habits.list.length > 0)
  const offerInstall = $derived(onboarding && !isStandalone && !installDone && (isIOS || installable))
  const offerReminder = $derived(onboarding && !offerInstall && reminders.canOffer)

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
    {:else if route.view === 'settings'}
      <Settings />
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

  {#if offerInstall}
    <InstallBanner when text="Install the app to get a nightly reminder" bottom="calc(var(--safe-bottom) + 16px)" ondismiss={() => (installDone = true)} />
  {:else if offerReminder}
    <ReminderBanner bottom="calc(var(--safe-bottom) + 16px)" />
  {/if}
</div>

<Drawer open={menuOpen} onclose={() => (menuOpen = false)} {entries}>
  {#snippet brand()}
    <div class="brand"><span class="mark">100</span><strong>Shots</strong></div>
  {/snippet}
  {#snippet footer()}
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
  .shell { position: relative; display: flex; flex-direction: column; height: 100%; }
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
  .mode { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-secondary); padding: 8px 0; }
  .build { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: var(--text-secondary); margin-top: 8px; }
  .build span { opacity: 0.6; }
</style>
