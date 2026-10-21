# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

Trading-journal application modeled on https://tradermake.money/ — trade logging, P&L analytics, statistics, equity curve, calendar view, tagging, filters by instrument/strategy/timeframe.

Implemented today on the **real platform API** (docs: `~/PycharmProjects/trade-journal/DevOps/docs/backend/`): login / register (invite-only) / email verification / password reset, exchange key connection (Binance USDⓈ-M Futures only — Bybit/OKX shown as «скоро»), trades from `/journal/trades` (all pages of the ≤183-day history, filtered client-side), trade detail with chart-engine candle chart (real fills, candles from the exchange, history loaded on scroll, live candle over WebSocket; ruler / level / Fibonacci drawings saved per symbol), widget dashboard (angular-gridster2; layout saved to `/config/widgets/overview`, localStorage is a cache) with onboarding for users without a key, daily journal built from trades, settings (exchange first, account with password change, theme, CSV export), live journal events (`/ws/events`). Features the API does not support yet show an «скоро» card (`shared/ui/soon.ts`) instead of fake data: trade review (notes/tags/mistakes/strategy), risk & R-metrics (no stop-loss in exchange data), daily notes/mood. **No mocks anywhere** — do not reintroduce them.

**API layer:** `core/http/api-interceptor.ts` adds `X-FROM: BROWSER` + `withCredentials` only to platform prefixes (`/account|exchange|journal|stats|payment|config`) and does a single-flight `/account/refresh` on 401 (`SKIP_REFRESH` context for public auth calls). Error texts come in English → `core/http/api-error.ts` translates them. Session: `core/auth/auth-store.ts` (state from `/account/info`, httpOnly cookies are invisible to JS), guards in `core/auth/auth-guards.ts`. Money/qty are decimal strings → parsed once in the API mappers. API calls are written as relative paths; the interceptor prefixes them with `environment.apiOrigin` (`src/environments/`): production build → `https://165.245.248.24` directly (also `/ws/events` via `apiSocketUrl`), development build → `''`, and `npm start` proxies the API prefixes to the gateway (`proxy.conf.mjs`, default `https://165.245.248.24`, override with `API_TARGET=…`). App routes must never start with an API prefix (edge proxy routes those to the gateway) — that is why the daily journal lives at `/diary`.

**Candles come from the exchange, not from our API** (the platform API has no market data): `core/market/` — `MARKET_SOURCE` = `ExchangeMarketSource` (Binance/Bybit/OKX public klines REST + kline WebSocket, picked by the trade's account exchange). Exchange requests must not get `X-FROM`/credentials (their CORS would reject them).

**Chart engine:** `~/VSCodeProjects/chart-engine` (`@nv/core|gpu|data|tools` from `local_modules/nv-*.tgz`; refresh with `npm run chart-engine:pack` then `npm install`). The data worker is copied to `worker/` (angular.json assets) and the dev server excludes `@nv/*` from prebundling. Integration layer: `shared/nv-chart/` (`NvRuntime` — one lazy runtime per app; `NvCandleChart` — mount, dataset with prepend/append/live update, held view range; `nv-scene` — host overlays drawn with Canvas2D as `SceneLayer`s with autoscale bounds). New trade overlays are new `SceneLayer`s (see `features/trades/trade-layer.ts`), not engine changes.

## Commands

- `npm start` / `ng serve` — dev server at http://localhost:4200/ (development configuration: no optimization, source maps on)
- `ng build` — production build into `dist/` (default `production` with 500 kB/1 MB initial-bundle budgets and 4 kB/8 kB per-component-style budgets)
- `npm run watch` — rebuild on change with the development configuration
- `npm test` / `ng test` — unit tests via Vitest (`@angular/build:unit-test`, not Karma/Jasmine)
- Run a single test: `ng test --test-name-pattern "<name>"`

## Bootstrap

Standalone-component bootstrap — **no NgModules anywhere**.

- `src/main.ts` calls `bootstrapApplication(App, appConfig)`
- `src/app/app.config.ts` is the single composition root for app-wide providers (`provideRouter`, `provideHttpClient`, `provideBrowserGlobalErrorListeners`, …). Add new global providers here.
- `src/app/app.routes.ts` exports the root `Routes`. Wire feature routes via lazy `loadChildren: () => import('./features/X/X.routes').then(m => m.routes)`.
- Component selector prefix is `app` (from `angular.json`).

## Folder layout — feature-based

Per Angular's style guide, organize by feature, **not** by type (no top-level `components/`, `services/`, `directives/` folders):

```
src/app/
  core/                       # singleton app-wide concerns (interceptors, guards, auth store, account store)
  shared/                     # reusable standalone components/directives/pipes used across features
  features/
    trades/
      data/
        trades-api.ts         # HTTP layer: httpResource defs + mutation methods
        trade.model.ts        # Trade type + pure helpers (calculatePnl, …)
      trades-store.ts         # signal-based state, composes data/
      trade-list.ts|.html|.css
      trade-form.ts|.html|.css
      trades.routes.ts
    analytics/
    journal/
    accounts/
    dashboard/
  app.ts | app.html | app.css | app.config.ts | app.routes.ts
```

Use trading-journal domain names (trades, accounts, instruments, strategies, analytics, journal) — not generic placeholders.

## Architecture — four layers

State and logic live **outside** components. Top to bottom:

1. **Component** — presentation only. Injects a store, reads signals, calls store methods. No `HttpClient`, no business logic beyond formatting.
2. **Feature store** (signal-based service) — owns state, orchestrates calls, exposes `signal`/`computed`. All logic that isn't presentation lands here.
3. **API / data-access** — one service per resource (`TradesApi`, `AccountsApi`, `StatisticsApi`) wrapping HTTP. Stateless, returns typed DTOs. Lives in `features/<feature>/data/`; lift to `core/` only if genuinely cross-cutting.
4. **Domain** — plain TS in `*.model.ts`: types + pure functions (`calculatePnl`, `groupByStrategy`). No Angular imports → trivially unit-testable, can run in a Web Worker.

## State management — signal-based, no NgRx

Three tiers by lifetime:

- **Local component state** — `signal()` directly in the component for ephemeral UI (toggles, hover, transient drafts).
- **Feature store** — service holding state for a screen/feature. Route-scoped (`providers: [TradesStore]` on the route) when it should reset on navigation; `providedIn: 'root'` when shared across routes.
- **App-wide** — small set of root-scoped stores: `AuthStore`, `AccountStore` (selected broker account drives trades/analytics/journal), `SettingsStore`.

**Store rules — enforce in every store:**

- **Never expose `WritableSignal`.** Keep writable signals `private` and expose `.asReadonly()` or `computed()`. Mutations go through methods.
- **`computed()` for derived data**, never getter methods that recompute (computeds cache and dedupe).
- **`effect()` sparingly** — only for syncing to outside-world (localStorage, URL/router query params, analytics events). Never for state-to-state derivation; that's `computed`.
- **No `BehaviorSubject` / `switchMap` patterns for new code** — use signals + `httpResource`.

**Cross-feature state:** compose by injecting one store into another and reading its signals in a `computed`. If 3+ features share data, lift it up (typically into `AccountStore` or another root store). No bidirectional dependencies.

**Persistence:**
- URL query params for filters/sort/selected id (refresh + share-link work) — sync via `effect()` ↔ `Router`.
- `localStorage` for UI prefs (theme, column visibility) — same `effect()` pattern.
- Server is source of truth for trades/accounts; `httpResource.reload()` after mutations.

**When to adopt `@ngrx/signals` (SignalStore):** if store boilerplate becomes repetitive, or you need `withEntities()` / `withDevtools()` / `rxMethod()`. Migration is mechanical. **Not now.** Plain NgRx is overkill for this app.

## HTTP — `httpResource` for reads, `HttpClient` for mutations

Angular 21's `httpResource()` is the default for GETs: signal-driven, re-fetches when input signals change, exposes `.value()` / `.status()` / `.error()` / `.reload()`.

- **Reads** in `*-api.ts`: `httpResource(() => buildUrl(filters()))` — store passes its filter signal in.
- **Mutations** (POST/PUT/DELETE): `firstValueFrom(http.post(...))`, then `resource.reload()` in the store to refresh the read.
- **`resource.value()` throws while the resource is in the error state** (`ResourceValueError`) — one failed request then breaks every computed/template that reads it. Always read as `r.hasValue() ? r.value() : fallback`.

## Components

- Standalone; declare deps in the `imports` array on `@Component`.
- DI via `inject()`, **not** constructor parameters.
- Template-only members marked `protected readonly` (style guide rule).
- `input()`, `output()`, `model()`, and query signals are `readonly`.
- Use the new control flow blocks: `@if` / `@for` / `@switch` — **not** `*ngIf` / `*ngFor` / `*ngSwitch`.
- `class` / `style` bindings, **not** `NgClass` / `NgStyle`.
- Lifecycle hooks delegate to named methods — keep the hook bodies one-liners.
- Event handlers named for the action (`saveTrade()`), not the event (`handleClick()`).

## Forms

Use **Signal Forms** (Angular v21+) for all new forms — not Reactive Forms, not Template-driven. See `.agents/skills/angular-developer/references/signal-forms.md` before authoring a form.

## After generating code

Run `ng build` once you finish generating non-trivial Angular code — the strict TS + template flags catch real mistakes that `ng test` will not. Don't skip this for new components/services/routes.

## Reference skills

- **`.agents/skills/angular-developer/`** — official Angular skill with topic-specific references (`signals-overview.md`, `resource.md`, `signal-forms.md`, `components.md`, `di-fundamentals.md`, `route-guards.md`, `testing-fundamentals.md`, `tailwind-css.md`, and ~30 more). Consult the relevant reference before reaching for `https://angular.dev/`.
- **`.agents/skills/frontend-design/`** — Anthropic's frontend-design skill. Triggers on UI/styling work and pushes for bold, distinctive aesthetics (maximalism, brutalism, distinctive fonts, dramatic colors). **Override its defaults for this product:** trading journals require scannable, data-dense, low-distraction UI (see tradermake.money / TradingView). Keep the skill's craft principles (typography care, cohesive theme, motion restraint, real attention to detail) but reject the "BOLD aesthetic direction" framing. Aesthetic target: professional, neutral, high-contrast for data; reserve any flourish for empty states / onboarding.

## File naming (Angular style guide)

- Hyphen-case file names; **no `.component.` / `.service.` / `.directive.` suffixes** (the v20+ style guide dropped them).
- File base name matches the exported identifier: `class TradeList` → `trade-list.ts`, paired with `trade-list.html` / `trade-list.css` / `trade-list.spec.ts`.
- Avoid generic names — no `utils.ts`, `helpers.ts`, `common.ts`. Name by what it does.

## TypeScript / template strictness

`tsconfig.json` is strict beyond defaults — all code must satisfy:

- `strict`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- `noPropertyAccessFromIndexSignature` — index-signature props use `obj['key']`, not `obj.key`
- Angular: `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`

## Style

Prettier: `printWidth: 100`, `singleQuote: true`, Angular parser for `.html`. `.editorconfig`: 2-space indent, single quotes in `.ts`, LF, final newline.
