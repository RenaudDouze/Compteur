# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This repo has two independent npm projects: the root app and `worker/` (Cloudflare Worker). Run commands from the relevant directory.

**App (root)**
```bash
npm run dev             # Vite dev server
npm run build            # tsc -b && vite build
npm run lint             # oxlint --deny-warnings
npm run typecheck        # tsc -b
npm test                 # vitest run (single run)
npm run test:watch       # vitest watch mode
npm run test:coverage    # vitest run --coverage — 100% threshold (lines/branches/functions/statements), CI-blocking
npm run test:e2e         # playwright test — builds and serves the app itself (webServer in playwright.config.ts)
npm run test:mutation    # stryker run — see scope note below
```
- Single unit test file: `npx vitest run src/foo.test.ts`
- Single e2e file: `npx playwright test e2e/remote-sync.spec.ts` (add `--project=chromium` to skip the `mobile-chrome` project)
- Single mutation target: `npx stryker run --mutate src/foo.ts` (path must already be in `stryker.config.json`'s `mutate` array)

**Worker (`worker/`)**
```bash
npm run dev         # wrangler dev
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run deploy       # wrangler deploy (needs `wrangler login` or CI secrets — see worker/README.md)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit+coverage, e2e, mutation testing, and the worker's own typecheck+tests as separate jobs on every PR — all required for `Build de production` to run.

## Architecture

### Local-first, sync is optional
Counters live in `localStorage` (`+1.counters.v1`) via `useLocalStorage`. The app is fully usable offline with zero backend. Two independent, layered ways to move data between devices — don't conflate them:
1. **One-shot transfer**: share link/QR code (`sync.ts`, `lz-string`-compressed URL param) or JSON backup file (import/export). No network involved beyond copying a link.
2. **Background sync**: `useRemoteSync.ts` + the Cloudflare Worker in `worker/`, gated entirely behind `VITE_SYNC_WORKER_URL` being set at build time (see `worker/README.md`). When unset, `useRemoteSync` is inert — no network calls, feature UI hidden.

### `App.tsx` is the single state owner
All `Counter[]` mutations happen in `App.tsx` and flow down as props/callbacks — there is no separate store. `Counter` (`types.ts`) splits `behavior` (step, target, odds denominator, start date — governs counting logic) from `appearance` (color, display style, background image — purely visual), each independently optional. Keep new fields in the correct half.

Other state owned here worth knowing about before touching `App.tsx`: a LIFO undo stack (`undoStack`, several actions deep, each with a label + full `Counter[]` snapshot), the search/filter and archive-view state that together derive `sortedCounters`, and the sync-notice toast wired to both an in-app toast and `notifications.ts`'s system notification.

### Counter card = 3 modals
Each `CounterCard` opens one of 3 panels (`PanelKind` in `PanelNav.tsx`: `comportement`, `personnalisation`, `actions`), cross-linked via `PanelNav` so switching doesn't require closing back to the card. `CounterCard.tsx` itself composes several extracted hooks (`useHoldToRepeat`, `useTapGesture`, `useCelebration`, `useFillFontSize`, `usePositiveIntField`) rather than owning that logic inline — follow that pattern for new card behavior instead of growing the component.

### Remote sync protocol (worker)
The worker (`worker/src/index.ts`) is a thin KV-backed relay, not a real backend: one JSON blob per 8-character sync code, no auth beyond knowing the code. Optimistic concurrency via a **server-assigned integer `version`** (never a client timestamp — clock drift would otherwise cause legitimate pushes to be rejected or stale ones accepted); a `PUT` only succeeds if its `baseVersion` matches the stored version, otherwise it 409s with the current server state for the client to adopt.

`useRemoteSync.ts` polls every 20s and pushes local changes after a **5s debounce** (`PUSH_DEBOUNCE_MS`) — a true debounce, not a throttle: rapid changes (e.g. holding +/- fires every 100ms) keep resetting the timer and never push mid-hold, only once activity settles. This debounce is deliberately generous: **Cloudflare KV's free tier caps writes at 1000/day for the whole namespace**, and there is intentionally no per-IP rate limiting anymore — one was tried and reverted (see `worker/README.md` and `worker/src/index.ts`'s comment above `KV_TTL_SECONDS`) because it wrote to KV on every single request including reads, exhausting the daily quota from ordinary polling alone within hours. Don't reintroduce a KV-write-based rate limiter; a Durable Object would be the correct primitive (not provisioned here).

The worker's top-level `fetch` wraps routing in a try/catch that always returns JSON with CORS headers on failure (`route()` in `index.ts`) — an uncaught exception otherwise gets replaced by Cloudflare's own error page, which has no CORS headers, which browsers surface to `fetch()` as an opaque `NetworkError`/`Failed to fetch` with zero diagnostic value. Client-side, `remoteSync.ts` reads that error response's `detail` field into the thrown `Error`'s message, and `useRemoteSync`/`SyncPanel` surface it verbatim in the UI — the only diagnostic channel available on a device with no console access (this chain is how a real production bug — the KV quota exhaustion above — got diagnosed without ever reaching a browser devtools session).

A sync error is also surfaced outside the Sync modal: `App.tsx` derives `hasSyncError` from `remoteSync.status === 'error'` and applies an `.icon-btn--alert` badge to the header menu button, so a failure doesn't go unnoticed behind a modal nobody opens.

### Testing conventions
- Coverage threshold is 100% globally (`vitest.config.ts`), enforced in CI — any new code needs tests that actually exercise every branch, not just line coverage.
- Mutation testing (Stryker) is intentionally scoped to pure-logic modules only (`stryker.config.json`'s `mutate` array) — React components/hooks with JSX, animation, or DOM timing are excluded as not realistically mutation-testable. Don't add a component file to that list; do add new pure-logic modules to it.
- E2e worker tests (`e2e/remote-sync.spec.ts`) mock the Cloudflare Worker via `page.route`, replicating its version-based CAS logic in-memory (see `mockWorker` in that file) rather than hitting a real worker — `playwright.config.ts`'s `webServer` sets a bogus `VITE_SYNC_WORKER_URL` purely to make the Sync-code UI section render.
- Assertions that depend on the 5s push debounce need an explicit generous `timeout` (Playwright's default assertion timeout is 5000ms, i.e. no margin against it) — see existing examples in `remote-sync.spec.ts`.
