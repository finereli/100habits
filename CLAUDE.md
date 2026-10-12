# 100 Shots

Habit tracker built on one idea: when you're bad at something, count your attempts backwards from 100. The first attempt is 100, the second 99. Live at https://100shots.finereli.com.

## Stack

Svelte 5 + Vite + TypeScript PWA from the pwa skill kit (`shared/` holds the vendored kit files, keep their `pwa-kit:` headers). Deployed as a Cloudflare Worker with static assets only (`wrangler.jsonc`, custom domain 100shots.finereli.com). No backend yet.

## Data

Local-first. Everything lives in localStorage under `100shots.data.v1` (`src/lib/habits.svelte.ts`): habits with UUIDs and a list of shots (`{id, at}` in epoch ms). Shot i (0-based) is number `100 - i`; past 100 it reads +1, +2... Planned next: Google sign-in (kit `auth/`) with D1 sync, merging by id. Deletes are hard right now; sync will need tombstones.

## Commands

- `npm run dev` - local dev
- `npm run build` - svelte-check + build to dist/
- `npm run deploy` - build and `wrangler deploy` (needs CLOUDFLARE_API_TOKEN)
- `npm run icon <name>` - add a Material Symbols icon to src/lib/icons.ts
- `node scripts/make-icons.mjs` - re-render the app icons from scripts/icon.svg (needs playwright)
