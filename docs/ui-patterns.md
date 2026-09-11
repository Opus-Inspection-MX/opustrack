# OpusTrack UI patterns

The design system reference for anyone touching the interface. The plan that
built it lives in `docs/plans/ui-revamp.md`; this document describes the
system as it stands, not the journey.

## Themes and tokens (`src/app/globals.css`)

Two Opus-branded themes, one token surface:

| Theme | Class | Look |
|-------|-------|------|
| Claro | (default, `:root`) | Teal-gray surfaces, navy text, teal sidebar, brand hero gradient |
| Oscuro | `.dark` | Brand navy (`#141e29`) surfaces with teal accents, deep-teal sidebar — stays on `.dark` so every existing `dark:` variant keeps working |

The selector (`ThemeToggle`, dropdown: Claro / Oscuro / Sistema) lives
in the global header, reachable on every viewport. `next-themes` with
`themes={["light","dark"]}`, `enableSystem`, `attribute="class"`. A stored
`"opus"` preference (the removed third theme) migrates to Claro on load
(`OpusThemeMigration` in `src/components/theme-provider.tsx`).

Token families (all three themes define all of them):

- **Base**: `--background`, `--foreground`, `--card`, `--primary` (teal),
  `--accent`/`--ring` (`#00968f`), `--muted`, `--border`, `--radius: 0.75rem`,
  `--shadow-card`, `--shadow-elevated`.
- **Semantic feedback**: `--success` (Opus green `#4c9c2e`), `--warning`
  (`#f18006`), `--info` (`#00a0e0`), `--danger` — each with `-foreground`
  (text on the solid) and `-muted`/`-muted-foreground` (tinted fill + its
  text). Badges pair `-muted` fills with `-muted-foreground` text, never
  with the base token.
- **Status**: `--status-open`, `--status-progress`, `--status-done`,
  `--status-cancelled` (+ `-muted` fills). Text on a muted fill uses a
  dedicated `-foreground` where the base token fails AA — today that is
  `--status-open-foreground` (the base blue only reaches ~4.3:1 on its
  fill). Rule: if you add a status tone, check the pair with axe
  (`e2e/accessibility.spec.ts`) before assuming the base token reads on
  its tint.
- **SLA**: `--sla-ok`, `--sla-risk`, `--sla-breach` (+ `-muted`).
- **Charts**: `--chart-1..5` (teal, blue, green, orange, gray) — actually
  used by the report charts, not decoration.
- **Sidebar**: `--sidebar-*` — teal in both themes (deep teal in Oscuro)
  with light text; content inside must use sidebar tokens, never the global
  muted ones. Secondary text uses `--sidebar-muted-foreground`, the avatar
  circle `bg-sidebar-accent` + `text-sidebar-accent-foreground` (the global
  `text-muted-foreground`/`bg-muted` fail AA on teal).
- **Hero/brand**: `--hero-from`/`--hero-to` (the `/inicio` + login gradient,
  same dark ramp in both themes), `--hero-foreground` /
  `--hero-muted-foreground` (AA-safe on both ramp ends) and the constant
  `--brand-navy` (the Oscuro swatch in the theme selector). `.bg-opus-hero`
  keeps its name — "Opus" is the brand, not a theme.
- **Typography**: Roboto (`--font-sans`) + Outfit (`--font-display`) via
  `next/font`. Dates via `src/lib/utils/datetime.ts` (`formatMX…`) — no new
  `moment` or `toLocaleString` calls.

Adding a token: declare it in `:root` and `.dark`, then map it in
the `@theme inline` block (`--color-…: var(…)`) so the Tailwind utility
(`bg-…`, `text-…`) exists. All theme colors are 6-digit hex (no `oklch`):
`src/test/theme-contrast.test.ts` parses them and fails otherwise. Raw hex and palette classes
(`text-red-500`, `bg-green-100`) outside `ui/` fail
`src/test/ui-style.test.ts` — the allowlist in
`src/test/ui-style-allowlist.json` covers legacy only and shrinks per area.

## Shared components

Page primitives (`src/components/common/`, `src/components/ui/`):

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Single `<h1>`, description, actions (stack on mobile). Never render a second heading — e2e asserts on them. |
| `PageContainer` | Gutter + max width (`full`/`wide`/`narrow`). |
| `SectionCard` | Titled section with description + actions. |
| `StatCard` | KPI: number (spring counter) or string, tone, optional link. **Server Component on purpose** — see RSC rule below. |
| `EmptyState` | Icon + title + description + CTA. |
| `StatusBadge` / `SlaBadge` | Token-driven badges. Replaces local `getStatusColor` helpers. |
| `ResponsiveTable` / `CatalogTable` | Table on desktop, cards on mobile (`mobileCard` render prop). |
| `FilterBar` | Inline filters on desktop, "Filtros (n)" bottom sheet on mobile. |
| `SubnavTabs` | Area sub-navigation (reports, settings) replacing link-card grids. |
| `ResponsiveDialog` | Dialog on desktop, drawer on mobile. Default choice. |
| `skeletons.tsx` | `PageSkeleton`, `TableSkeleton`, `CardGridSkeleton`, `WidgetSkeleton` — every `loading.tsx` renders a real one. |
| `pagination.tsx` | The one pagination (the old `common/table-pagination.tsx` is gone). |

Shell (`src/components/layout/`): one `AppShell` everywhere — sticky global
`AppHeader` (sidebar trigger below `lg`, parent-only breadcrumbs on mobile,
"Búsqueda rápida" palette button, bell, theme, account), collapsible
`AppSidebar` (5 groups, state in a cookie, collapsed content stays mounted
for e2e), `TabBar` below `lg` (Inicio / Búsqueda / priority destination /
Más, `env(safe-area-inset-bottom)`), `CommandPalette` (`⌘K`, `cmdk`, route
search + quick actions). Menu registry in `src/lib/navigation/menu.ts`
(`visibleMenu`, `flattenMenu`, `breadcrumbsFor` — pure, unit-tested):
groups start expanded, mobile priority via `mobilePriority`.

Motion (`src/components/motion/`, presets in `src/lib/ui/motion.ts`):
`MotionProvider` (`reducedMotion="user"`), `FadeIn`, `StaggerGroup/Item`
(40 ms), `AnimatedNumber` (spring, instant under reduced motion),
`PageTransition` (150–300 ms, ease `[0.2, 0, 0, 1]`). Micro-interactions in
CSS only (`button`, `card/interactive`). **Never animate large tables.**

### Two rules that bite

1. **Client components never receive component *types*.** Passing
   `icon={SomeIcon}` from a server page into a `"use client"` component
   breaks RSC serialization and drops the whole page into the error
   boundary (it took down `/admin/reports`, `/fsr/assignments` and
   `/reporter` in Fase 4). Pre-created elements (`icon={<Icon/>}`,
   children) are fine; instantiating a server-module reference on the
   client is not. That is why `StatCard` is a server component that
   renders the client `AnimatedNumber` inside.
2. **The reduced-motion reset lives outside cascade layers.**
   `globals.css` ends with an unlayered `prefers-reduced-motion` block:
   layered `body *` loses to the base theme cross-fade and to Tailwind
   duration utilities (measured 150 ms surviving). No `!important`
   (Biome bans it) — unlayered author styles beat every layer.

## Responsive patterns

- **One breakpoint: `lg` (1024 px)** — `useIsMobile()` / `use-breakpoint.ts`.
  Sidebar (drawer), tab bar, tables→cards, filter sheet all key off it.
- Page skeleton: `PageHeader` + `PageContainer`, tokens only, badges,
  `EmptyState`, responsive table or catalog cards on mobile, `FilterBar`.
- Forms: single column, `sm:grid-cols-2` where it helps; long forms pin
  actions to a sticky bottom bar on mobile. Keep input ids (`#folio`,
  `#email`, …) and action labels stable — e2e binds to them.
- No fixed widths: `w-[260px]` becomes `w-full sm:w-[260px]`; grids go
  `grid-cols-1 sm:… lg:…`. Tables scroll *inside* their container, never
  the document.
- FSR detail is the mobile-first reference: sticky action bar, accordion
  sections, numeric odometer inputs, `capture="environment"` photo.

## Accessibility and verification

- AA contrast in both themes, visible focus (`:focus-visible` ring),
  touch targets ≥ 44 px, Spanish accessible names on icon-only controls.
- `e2e/accessibility.spec.ts`: axe (WCAG 2A/2AA) over `/inicio`, `/login`,
  tracking, the FSR detail and `/admin/clients` × light/dark. Zero
  exclusions — a failure is fixed in code or recorded here as debt.
  Current debt: none.
- `src/test/theme-contrast.test.ts`: WCAG 2.x contrast over the token
  pairs in both themes, no browser. It covers what axe cannot — text on
  the hero gradient (axe marks gradients `incomplete`, never a violation)
  — and fails on any non-hex value or a reappearing `.opus` selector.
- `e2e/responsive.spec.ts`: one route per area × 360/768/1024/1440 —
  no document horizontal scroll, exactly one bell, header + tab bar in
  their viewport. Plus a `prefers-reduced-motion` sweep.
- Projects: `chromium` + `Mobile Chrome` run everything shippable;
  `catalogs`/`flows` stay Desktop-Chromium serial (shared rows); `iPad
  (gen 7)` joins Firefox/WebKit/Mobile Safari behind `E2E_EXTRA_BROWSERS=1`.
  Navigation, RBAC and inicio specs run on Mobile Chrome and iPad too
  (the RBAC menu spec opens the "Más" drawer below `lg`).
