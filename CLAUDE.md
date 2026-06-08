# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Quasar dev server (Vite + HMR). In dev, API/socket point to `localhost:3015`.
- `npm run build` — production build in **PWA mode** (`quasar build -m pwa`). Plain `quasar build` is not configured; always build PWA.
- `npm run lint` — ESLint over `.js,.ts,.vue`. Build also runs `vite-plugin-checker` with `vue-tsc` (via `tsconfig.vue-tsc.json`) and eslint, so type errors fail the build.
- No test runner is configured.
- `deploy.sh` is the server-side deploy (runs on the production host: `git pull && npm ci && npm run build` in `/home/clients/notes`). Do not invoke locally.

## Architecture

This is the client for "Elven Notes" — a Quasar 2 (Vue 3 + Vite + Pinia + TypeScript) PWA that talks to a backend at `api-notes.pavlo.ru` over REST (axios) and socket.io. It supports full offline use via LocalStorage, with reconciliation when connectivity returns.

### Online/offline duality (the central design idea)

Every mutating API call goes through `src/services/api/api.ts` (`ApiService`), which fans out to **two** implementations:

- `OnlineApiService` (`src/services/api/online-api.ts`) — wraps axios; only called when `useGlobalStore().isOnline` is true.
- `OfflineApiService` (`src/services/api/offline-api.ts`) — reads/writes a single LocalStorage blob keyed by `BaseService.OFFLINE_STORE_NAME` (`'offline-data'`).

The offline store is **always** updated. When online, the online call runs first; the server-assigned id is then threaded into the offline write so the two stores stay aligned. Entities created offline get string ids prefixed `offline-<timestamp>` and are reconciled later.

Reconciliation lives in `src/services/sync.ts` (`SyncService.synchronizeOfflineData`), triggered by:
- the browser `online` event,
- `windowFocused` (polled every 100ms via `document.hasFocus()` in `src/boot/init.ts`),
- and on init when offline data already exists.

It walks offline notes/list-items, compares `updated` timestamps to the server snapshot, and decides per-entity whether to push, pull, or delete. When editing this logic, preserve the invariants: (1) `offline-*` ids must be promoted to numeric server ids before clearing, (2) entities with `statusId === inactive` are tombstones to be deleted from both sides, (3) `clearRemovedOfflineNotesAndListItems` only purges tombstones older than 15s (`tombstoneExpirationMs`) to give sync time to complete on slow networks before racing the UI.

`SyncService.handleApplicationUpdate(isUpdating)` is the entry point that coordinates a re-sync: it no-ops when offline or on the sign route, sets `globalStore.isUpdating`, runs `InitService.initApplication(...)`, and always resets `isUpdating` / `isSocketErrorOnce` in a `finally`. It's called from the window `online` event and from `HealthService.check` when connectivity is regained.

Two cleanup methods on `SyncService` are easy to confuse — keep them separate:
- `clearRemovedOfflineNotesAndListItems()` — purges `offline-*` tombstones from the LocalStorage offline blob (the 15s rule above).
- `removeRemovedEntities()` — resets the in-memory UI removal queues (`NotesService.removingNotes` / `ListItemsService.removingListItems`); called from the focus-poll interval when the window loses focus.

### Realtime updates

`SocketIOService` (`src/services/socket-io.ts`) is initialized once during boot and listens for `EVENT_NOTE_*` / `EVENT_LIST_ITEM_*` events. Each handler updates the in-memory Vue refs **and** the offline store. The current socket id is injected into every axios request via the `socket-io-id` header (see `src/boot/api.ts`) so the server can skip echoing the originating client's own writes. The socket `disconnect` handler also flips `globalStore.isOnline` to `false` — online/offline detection is socket- and event-driven, not HTTP-polled.

### Connectivity detection (HealthService)

`HealthService` (`src/services/health.ts`) is **not** a background poller — there is no timer. `HealthService.check(timeoutMs, isReloadRequired)` runs a single `api.checkStatus` probe (abortable, with `SHORT_TIMEOUT_MS` 1000 / `LONG_TIMEOUT_MS` 5000), guarded so only the most recent in-flight check wins (`currentAbortController`). It's invoked at three moments: app boot (short timeout), on `windowFocused` (long timeout, `isReloadRequired=true`), and implicitly via the socket lifecycle. On a successful probe it sets `isOnline=true` and, if connectivity was just regained (or a reload is forced) and a user is signed in off the sign route, calls `SyncService.handleApplicationUpdate(true)`. New connectivity logic should call `HealthService.check`, not add its own polling loop.

### Service layer pattern

There are two distinct kinds of "services":

- `src/services/*` — static-class singletons that all extend `BaseService`. `BaseService` owns global wiring: the `api` instance, `router`, an `mitt` event bus (`eventBus`), `showError`, and constants (`API_URL`, `OFFLINE_STORE_NAME`). Add cross-cutting concerns here, not in components.
- `src/composables/services/*` — module-scoped Vue `ref`/`computed` stores (e.g. `NotesService`, `ListItemsService`, `TypesService`, `StatusesService`). They hold the live reactive state the UI binds to. They are *not* Pinia stores — only `useGlobalStore` in `src/stores/global.ts` is.

`src/composables/models/*` are factory functions that wrap a plain `TNote`/`TListItem`/etc. DTO in `ref`s and methods (`save`, `removeListItem`, `completeAllChecked`, …). The wrapped type is exported as `TNoteModel = UnwrapRef<ReturnType<typeof noteModel>>`. Models call `BaseService.api` directly and emit errors via `BaseService.showError`; components should call model methods rather than the api service.

### Boot sequence

`quasar.config.js` declares two boot files in order: `api` then `init`.

1. `boot/api.ts` — creates the axios instance (dev → `localhost:3015`, prod → `BaseService.API_URL`), attaches the auth-token + socket-id request interceptor, assigns `OnlineApi.axiosApi`.
2. `boot/init.ts` — instantiates `ApiService`, wires `showError`, registers all `src/components/**/*.vue` globally (via `import.meta.globEager`, so component tags don't need explicit imports), also registers `zhyswan-vuedraggable` as the global `<Draggable>` component, starts `SocketIOService`, then calls `InitService.initApplication()` which fetches config (online) or hydrates from LocalStorage (offline) and seeds `TypesService` / `StatusesService` / `NotesService`.

The same boot file installs a 100ms `setInterval` that watches `document.hasFocus()`. On focus gain it emits `windowFocused`; the listener posts `requestUpdate` to the service-worker BroadcastChannel and (unless in watch mode) runs `HealthService.check(LONG_TIMEOUT_MS, true)` to re-probe connectivity and trigger a re-sync. On focus loss it calls `SyncService.removeRemovedEntities()` to drop the UI removal queues. New auto-refresh / background code should hook into this lifecycle rather than installing its own timers.

### Routing & watch mode

Routes in `src/router/routes.ts` use named constants (`ROUTE_NOTES`, `ROUTE_EXISTED_NOTE`, `ROUTE_NEW`, `ROUTE_SIGN`) — reuse those rather than string literals when navigating from services. `vueRouterMode` is `history`.

A `?is-watch=1` query parameter puts the app into "watch mode" (`globalStore.isWatchMode`), which suppresses focus-driven re-syncs in `boot/init.ts`. Toggle it via `BaseService.switchWatchMode()` — it flips the flag and rewrites the `is-watch` query parameter in one step, so don't mutate the store flag and the URL separately. Keep this guard in mind when adding new auto-refresh behavior.

### PWA / service worker

PWA build uses Workbox `generateSW`. The custom integration in `src-pwa/register-service-worker.ts` posts `updateReady` over a `BroadcastChannel('elven-keep-service-worker')` when new content is cached; `boot/init.ts` listens on the same channel and sets `globalStore.isNewVersionAvailable`. On window focus the app also posts `requestUpdate` to force the SW to check for updates.

## Conventions

- Path alias `~/*` → `src/*` (configured in both `tsconfig.json` and `quasar.config.js`). Always use it for cross-directory imports; never use deep `../../..` paths.
- TypeScript: `tsconfig.json` is the editor/IDE config, but the **build-time** type-check uses `tsconfig.vue-tsc.json` (via `vite-plugin-checker` → `vue-tsc`). When type errors slip past the IDE but break the build, that second config is where to look.
- Vue components: a mix of HTML and Pug templates (`<template lang="pug">`) — match the existing file's style when editing. `eslint-plugin-vue-pug` is enabled.
- ESLint extends `airbnb-base` + `@typescript-eslint/recommended` + `plugin:vue/vue3-essential`. Notable rules: **no semicolons** (`semi: ['error', 'never']`), single quotes, `max-len: 350`. Several airbnb rules are off (`no-plusplus`, `no-param-reassign`, `class-methods-use-this`, `no-use-before-define`) — match the surrounding code rather than fighting the linter.
- Quasar plugins enabled globally: `LocalStorage`, `Meta`, `Notify` (see `quasar.config.js` `framework.plugins`). Prefer `LocalStorage` via `StorageService` rather than calling Quasar directly — `StorageService` namespaces everything under the `__ELVEN-NOTES__` key and merges on write. It keeps an in-memory `cache` and writes are **throttled** (leading-edge, `PERSIST_THROTTLE_MS` 300): the first write after a quiet window persists immediately, subsequent writes coalesce into one trailing persist. Durability on close is guaranteed by a synchronous `flush()` wired to `pagehide` / `beforeunload` / `visibilitychange→hidden`. Call `StorageService.flush()` if you need an immediate synchronous write.
- Errors: throw or pass to `BaseService.showError(error)`. It normalizes `AxiosError` into `TGlobalError` and emits `showGlobalError` on the event bus; a global error handler in `MainLayout` displays it.
- Auth token lives in LocalStorage under `UsersService.AUTH_TOKEN_NAME` (`'auth-token'`). 401 responses during init trigger `UsersService.signOut()` which clears storage and routes to `/sign`.
