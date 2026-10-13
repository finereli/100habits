// pwa-kit: shell/src/main.ts v9
import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { updates } from '$shared/lib/updates.svelte'
import { login } from './lib/account.svelte'
import { sync } from './lib/sync.svelte'
import { reminders } from './lib/reminders.svelte'

// A new version never reloads a live session. Pass a veto for the moments a
// silent reload would hurt (audio playing, upload in flight):
//   updates.init({ canReload: () => !player.playing })
updates.init()

// Finish a sign-in that came back by redirect, then start syncing.
login.handleRedirect().finally(() => sync.start())
reminders.start()

export default mount(App, { target: document.getElementById('app')! })
