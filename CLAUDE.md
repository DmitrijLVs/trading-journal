# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

Trading-journal application modeled on https://tradermake.money/ — trade logging, P&L analytics, statistics, equity curve, calendar view, tagging, filters by instrument/strategy/timeframe.

Implemented today (all data mocked via `core/mock/*` + `mockApiInterceptor`): widget dashboard with workspaces (angular-gridster2, drag/resize/maximize/lock, templates, per-widget settings), 16 widget types (ECharts + DOM), trades table with filters/sorting, trade detail with night-vision candle chart (`trade-journal.navy`: entry/exit/SL/TP markup), Signal Forms account dialog (trades are NOT entered manually — they arrive via exchange sync only; analysis fields are edited inline on trade detail), daily journal with notes/mood, accounts page with API keys, settings with CSV export. Shared UI kit in `shared/ui` (CDK overlay select/menu/dialog/tooltip/toast). Key gotcha: night-vision auto-range includes the volume column — custom `.navy` overlays must not derive `yRange` from the incoming hi/lo.

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
