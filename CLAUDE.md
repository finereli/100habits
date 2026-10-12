# 100 Shots

Habit tracker built on one idea: when you're bad at something, count your attempts backwards from 100. The first attempt is 100, the second 99. Live at https://100shots.finereli.com.

## Stack

Svelte 5 + Vite + TypeScript PWA from the pwa skill kit (`shared/` holds the vendored kit files, keep their `pwa-kit:` headers). Deployed as a Cloudflare Worker (`wrangler.jsonc`, custom domain 100shots.finereli.com): static assets plus one route, `POST /api/sync` (`worker/index.ts`), on D1 `100shots-db`.

## Data

Local-first. Everything lives in localStorage under `100shots.data.v1` (`src/lib/habits.svelte.ts`): habits with UUIDs and a list of shots (`{id, at}` in epoch ms). Shot i (0-based) is number `100 - i`; past 100 it reads +1, +2...

Sign-in is optional and goes through login.finereli.com (finereli/finereli-login), not the kit's `auth/`: `shared/lib/finereli-login.ts` and `worker/verify.ts` are vendored from that repo's `client/`, keep their `finereli-login:` headers. Signed in, sync (`src/lib/sync.svelte.ts`) posts the whole dataset and keeps the merge (`src/lib/merge.ts`, shared with the Worker; one JSON row per Google `sub` in `docs`). Deletes leave tombstones, undo stamps `t` so it beats the delete, renames stamp `nameAt`. Signing out syncs first, then clears the device.

## Commands

- `npm run dev` - local dev
- `npm run build` - svelte-check + build to dist/
- `npm test` - merge tests (vitest)
- `npm run deploy` - test, build, apply D1 migrations, `wrangler deploy` (needs CLOUDFLARE_API_TOKEN)
- `npm run icon <name>` - add a Material Symbols icon to src/lib/icons.ts
- `node scripts/make-icons.mjs` - re-render the app icons from scripts/icon.svg (needs playwright)
