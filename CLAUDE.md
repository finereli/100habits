# 100 Shots

Habit tracker built on one idea: when you're bad at something, count your attempts backwards from 100. The first attempt is 100, the second 99. Live at https://100shots.finereli.com.

## Stack

Svelte 5 + Vite + TypeScript PWA from the pwa skill kit (`shared/` holds the vendored kit files, keep their `pwa-kit:` headers). Deployed as a Cloudflare Worker (`wrangler.jsonc`, custom domain 100shots.finereli.com): static assets plus `POST /api/sync` and `POST /api/push/*` (`worker/index.ts`), a cron every 5 minutes for reminders, on D1 `100shots-db`.

## Data

Local-first. Everything lives in localStorage under `100shots.data.v1` (`src/lib/habits.svelte.ts`): habits with UUIDs and a list of shots (`{id, at}` in epoch ms). Shot i (0-based) is number `100 - i`; past 100 it reads +1, +2...

Sign-in is optional and goes through login.finereli.com (finereli/finereli-login), not the kit's `auth/`: the client files are the pwa kit's `login/` item (`shared/lib/finereli-login.ts`, `worker/verify-login.ts`), with `pwa-kit:` headers like the rest. Signed in, sync (`src/lib/sync.svelte.ts`) posts the whole dataset and keeps the merge (`src/lib/merge.ts`, shared with the Worker; one JSON row per Google `sub` in `docs`). Deletes leave tombstones, undo stamps `t` so it beats the delete, renames stamp `nameAt`. Signing out syncs first, then clears the device.

## Reminders

Per device, no account needed (`src/lib/reminders.svelte.ts`, `worker/push.ts`, `public/push-sw.js`). The device subscribes to Web Push and tells the server its reminder time, time zone and the local date of its last shot (`push_subs`). The cron sends once per local day inside a 30-minute window, and skips days with a shot. Pushes carry no payload (no encryption needed): the service worker shows "Did you take any shots today? There's still time." Naming a habit in the reminder is parked until it can get an LLM pass to read well. VAPID: public key in `src/lib/vapid.ts`, private JWK in the Worker secret `VAPID_PRIVATE_JWK` (and `.dev.vars` locally). iPhone gets push only in the Home Screen app. Onboarding on the home screen after the first habit: the kit's InstallBanner, then ReminderBanner (closing it hides the offer for a week). Settings (`#/settings`) holds reminders and the account.

Headless Chromium here has no push service: test the UI with a stubbed `PushManager`, deliver pushes to the service worker with CDP `ServiceWorker.deliverPushMessage`, and run the cron with `wrangler dev --test-scheduled` + `/cdn-cgi/handler/scheduled`.

## Shipping

Commit and push straight to `main`. No feature branches, no pull requests.

## Commands

- `npm run dev` - local dev
- `npm run build` - svelte-check + build to dist/
- `npm test` - merge and reminder-timing tests (vitest)
- `npm run deploy` - test, build, apply D1 migrations, `wrangler deploy` (needs CLOUDFLARE_API_TOKEN)
- `npm run icon <name>` - add a Material Symbols icon to src/lib/icons.ts
- `node scripts/make-icons.mjs` - re-render the app icons from scripts/icon.svg (needs playwright)
