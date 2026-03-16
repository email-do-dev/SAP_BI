# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project

**SAP BI Platform** — operational management platform for Mata Norte Alimentos Ltda, a sardine canning and fish processing company in Pernambuco, Brazil (~250 employees, ~R$100M/year revenue). Integrates with SAP Business One v10 (MSSQL, on-premise) to provide dashboards, KPIs, task management, production tracking, quality control, and financial visibility.

All UI text is in **Brazilian Portuguese (pt-BR)**. Currency is BRL. Dates use `date-fns` with `ptBR` locale.

## Branch por Usuário

No início de cada conversa, execute `whoami` para identificar o usuário do servidor e aplique as regras abaixo:

| Usuário do servidor | Regra |
|---------------------|-------|
| andre               | Pode trabalhar em qualquer branch. **Pergunte** em qual branch deseja trabalhar antes de prosseguir. |
| bruno               | Pode trabalhar em qualquer branch. **Pergunte** em qual branch deseja trabalhar antes de prosseguir. |
| eduardo             | Branch fixa: `features`. Faça `git checkout features` automaticamente. |

Se a branch escolhida/designada não existir, crie-a a partir de `main` com `git checkout -b <branch>`.

**Restrição para usuário `eduardo`:** Quando o usuário do servidor for `eduardo`, é PROIBIDO editar arquivos, fazer commits ou push em qualquer branch que não seja `features`. Se `eduardo` solicitar alterações e a branch atual não for `features`, recuse a operação e informe que ele só pode trabalhar na branch `features`.

## Commands

```bash
npm run dev        # Start Vite dev server (localhost:5173)
npm run build      # TypeScript check (tsc -b) + Vite production build
npm run lint       # ESLint (flat config, v9)
npm run preview    # Preview production build locally
```

No test runner is installed. There are no tests.

## Environment

- **Platform:** Windows 11, bash shell
- **Git:** LFS enabled, main branch: `main`
- **Frontend:** Deployed to Vercel (SPA rewrites in `vercel.json`)
- **Backend:** Supabase Pro tier (Edge Functions on Deno, PostgreSQL)
- **SAP:** Business One v10, SQL Server, on-premise
- **Required env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`)
- **Edge Function secrets** (set in Supabase dashboard): `SAP_MSSQL_HOST`, `SAP_MSSQL_PORT`, `SAP_MSSQL_DATABASE`, `SAP_MSSQL_USER`, `SAP_MSSQL_PASSWORD`, `GOOGLE_MAPS_API_KEY`, `ALLOWED_ORIGIN`

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Build | Vite | 7 |
| Language | TypeScript | 5.9 (strict, `erasableSyntaxOnly`) |
| CSS | Tailwind CSS | v4 via `@tailwindcss/vite` plugin |
| State/Fetch | TanStack React Query | v5 |
| Tables | TanStack React Table | v8 |
| Charts | Recharts | v3 |
| Routing | React Router | v7 |
| Backend | Supabase JS | v2 |
| Dates | date-fns | v4 |
| Icons | Lucide React | latest |
| Path alias | `@/` → `src/` | |

**Tailwind v4 note:** Theme is defined in `src/index.css` using `@theme {}` block. There is NO `tailwind.config` file.

---

## Architecture

### Data Flow (Hybrid Caching)

```
pg_cron (every 10min) → sap-sync Edge Function → SAP B1 MSSQL → sap_cache_* tables (Supabase)
Browser list views   → useCacheQuery()         → sap_cache_* tables (fast reads from Supabase)
Browser drill-down   → useSapQuery()           → sap-query Edge Function → SAP B1 MSSQL (live)
```

**Why hybrid:** SAP MSSQL is on-premise behind a firewall. Edge Functions bridge the gap. Cache tables provide fast reads for dashboards and lists. Live queries provide fresh drill-down data on demand.

**Cache refresh:** pg_cron calls `sap-sync` every 10 minutes. The sync uses **upsert incremental** with 500-row chunks + stale cleanup (`DELETE WHERE refreshed_at < now`). No date limits — full SAP history is synced. Single-row tables (dashboard_kpis, compras_abertas, financeiro_ciclo) use delete+insert.

**Cancellation filtering:** ALL SAP queries filter out cancelled documents with `CANCELED <> 'C'`. This was applied globally in Phase 7.

### Role-Based Access (3 layers)

**Roles:** `diretoria`, `comercial`, `logistica`, `financeiro`, `importacao`

1. **Sidebar** — filters nav items by user roles at render time
2. **ProtectedRoute** — redirects to `/` if role missing (routes define `requiredRoles` in `App.tsx`)
3. **Edge Functions** — server-side `has_role()` DB function check for mutations

| Role | Pages |
|------|-------|
| `diretoria` | All + user management + logistics cost config |
| `comercial` | Dashboard, Comercial, Devoluções |
| `logistica` | Dashboard, Logística, Custo Logístico |
| `financeiro` | Dashboard, Devoluções, Custo Logístico |
| `importacao` | Dashboard, Importações |

### Edge Functions (7 total)

| Function | Version | verify_jwt | Purpose |
|----------|---------|------------|---------|
| `sap-query` | v19 | false | Live SAP query (whitelist + multi-recordset detail) |
| `sap-sync` | v19 | false | Upsert incremental cache refresh + stale cleanup |
| `create-user` | v3 | false | Diretoria-only user creation + role assignment |
| `manage-users` | v3 | false | Diretoria-only user listing + role add/remove |
| `route-calc` | v3 | false | Google Maps distance → logistics cost |
| `import-ocr` | v1 | false | Claude Sonnet OCR for import document extraction |
| `diag-chain` | v7 | false | SAP document chain diagnostics |

**IMPORTANT:** All Edge Functions use `verify_jwt: false` because the Supabase gateway JWT verification was returning 401 despite valid tokens. Auth is handled internally via `getUser()` in each function.

All functions use shared `_shared/` for CORS, auth helpers, and SAP MSSQL connection pool (`npm:mssql@11`).

### Key Files

| Area | Path |
|------|------|
| Entry + providers | `src/main.tsx` (QueryClient, Router, AuthProvider) |
| Routes + lazy loading | `src/App.tsx` (ErrorBoundary, lazyRetry, route→role map) |
| Auth + roles | `src/contexts/auth-context.tsx` |
| Data hooks | `src/hooks/use-sap-query.ts` (useSapQuery, useCacheQuery) |
| Supabase client | `src/lib/supabase.ts` |
| Utilities | `src/lib/utils.ts` (cn, formatCurrency, formatNumber, formatPercent) |
| DB types | `src/types/database.ts` (hand-maintained, NOT auto-generated) |
| Env validation | `src/config/env.ts` |
| Theme / colors | `src/index.css` (@theme block) |
| Edge Function shared | `supabase/functions/_shared/` (cors, auth, sap-connection) |
| SAP query registry | `supabase/functions/_shared/sap-connection.ts` (`QUERIES` map) |
| Supabase migrations | `supabase/migrations/` (numbered SQL files) |

### Page Pattern

All list pages follow: `useCacheQuery` for table data → `DataTable` with `onRowClick` → `Dialog` with `useSapQuery` (live drill-down, `enabled: !!selected`). KPI cards and `RefreshIndicator` sit above the table. Skeleton components during loading.

**Comercial page** is the most advanced: unified view (PV+NF+EN via 3 CTEs), 4 KPI cards, 7 client-side filters (date, vendedor, tipo, status, UF), detail dialog with origin-based drill-down (pedido_detalhe_pv/nf/en), print support.

### Cache Tables (24 total)

| Table | Unique Index (onConflict) | Rows |
|-------|--------------------------|------|
| sap_cache_pedidos | `doc_entry,origem` | ~4000 |
| sap_cache_entregas | `doc_entry` | ~1100 |
| sap_cache_devolucoes | `doc_entry,doc_type` | ~760 |
| sap_cache_financeiro_canal | `canal,mes` | ~185 |
| sap_cache_estoque_giro | `item_code` | ~100 |
| sap_cache_financeiro_cashflow | `due_date` | ~83 |
| sap_cache_dashboard_kpis_mensal | `mes,metric` | ~76 |
| sap_cache_producao_consumo_mp | `item_code` | ~50 |
| sap_cache_financeiro_top_clientes | `card_code,mes` | ~50 |
| sap_cache_faturamento_mensal | `mes` | ~25 |
| sap_cache_compras_mes | `mes` | ~25 |
| sap_cache_producao_planejado_vs_real | `mes` | ~25 |
| sap_cache_financeiro_margem | `mes` | ~25 |
| sap_cache_estoque_valorizacao | `grupo` | ~13 |
| sap_cache_estoque_deposito | `deposito` | ~10 |
| sap_cache_producao_ordens | `status` | ~3 |
| sap_cache_financeiro_aging | `tipo` | 2 |
| sap_cache_custo_logistico | `mes` | varies |
| sap_cache_compras_lead_time | `fornecedor` | ~30 |
| sap_cache_estoque_abaixo_minimo | `item_code` | varies |
| sap_cache_dashboard_kpis | PK only (1 row) | 1 |
| sap_cache_compras_abertas | PK only (1 row) | 1 |
| sap_cache_financeiro_ciclo | PK only (1 row) | 1 |

### Import Module (Phase 8D)

6 tables: `import_processes`, `import_items`, `import_costs`, `import_documents`, `import_tracking_events`, `import_timeline`. Role: `importacao`. Edge Function: `import-ocr` (Claude Sonnet OCR). 15-status workflow from `aguardando_documentos` to `concluido`.

### Features Already Built

- CSV export utility (semicolon separator, UTF-8 BOM) — wired in comercial, logistica, devolucoes via `DataTable` `onExport` prop
- Print utility (`printContent()`) — "Imprimir" button in PedidoDetalheDialog
- Real pie chart from `sap_cache_entregas` (Entregue vs Pendente)
- Full user management: list users, add/remove roles (diretoria only)

---

## Patterns and Conventions

### Adding a New SAP KPI or Data View (most common task)

Follow this exact sequence:

1. **Write the SQL query** — Test against SAP MSSQL (SSMS). Add to `QUERIES` map in `supabase/functions/_shared/sap-connection.ts`. Static queries = strings. Parameterized queries = functions. Always include `CANCELED <> 'C'` filter.

2. **Create or extend a cache table** — New migration in `supabase/migrations/` with next sequence number. Include RLS (read for `authenticated`, write for `service_role`). Add unique indexes for upserts.

3. **Add sync logic** — In `sap-sync/index.ts`, add try/catch block. Use `upsertAndClean()` helper with the table's `onConflict` key. For single-row tables without unique index, use `replaceAll()`. Follow existing blocks.

4. **Update TypeScript types** — Add new table to `src/types/database.ts`. Cache tables: `Insert: Record<string, never>`, `Update: Record<string, never>`.

5. **Create the UI** — `useCacheQuery()` for list/dashboard data. `useSapQuery()` only for drill-down. Follow page pattern.

### Adding a New Page

1. Create page file in `src/pages/` with `export default` (for lazy loading)
2. Add lazy import + route in `App.tsx` with `requiredRoles`
3. Add nav item in `src/components/layout/sidebar.tsx` with role filter

### Adding a New Module with Own Tables

1. Write migration with RLS, triggers, indexes
2. Update `src/types/database.ts`
3. Create custom hooks in `src/hooks/` using TanStack React Query
4. Create page, add route, add nav item
5. Add new role if needed: migration `ALTER TYPE public.app_role ADD VALUE 'new_role'` + update `AppRole` type

### Adding a New Role

1. Migration: `ALTER TYPE public.app_role ADD VALUE 'new_role';`
2. Update `AppRole` type in `src/types/database.ts`
3. Add route permissions in `App.tsx`
4. Add nav item visibility in `sidebar.tsx`

---

## Coding Conventions

### TypeScript

- **Strict mode** with `erasableSyntaxOnly`
- `as any` casts allowed ONLY with `eslint-disable` comments in these cases:
  - `supabase.rpc()` for custom DB functions not in generated types
  - `supabase.from()` for dynamic cache table names in `useCacheQuery`
  - `ColumnDef<T, any>` in DataTable for TanStack accessor type variance
- DB types in `src/types/database.ts` are **hand-written** — update manually when schema changes
- Cache tables: `Insert: Record<string, never>`, `Update: Record<string, never>`
- Use `interface` for object shapes, `type` for unions and aliases
- Pages use `export default` for lazy loading. Other components use named exports.

### React

- Functional components only (except ErrorBoundary)
- TanStack React Query for all server state (no useState for fetched data)
- Lazy load all pages via `lazyRetry()` in `App.tsx`
- Skeleton components during loading (`KpiSkeleton`, `ChartSkeleton`, `TableSkeleton`)

### Styling

- **Tailwind CSS v4** — utility classes exclusively
- Combine classes with `cn()` (clsx + tailwind-merge)
- Theme in `src/index.css` `@theme {}`:
  - `primary` = `#1e40af` (blue)
  - `background` = `#f8fafc` (light gray)
  - `card` = `#ffffff` (white)
  - `destructive` = `#dc2626` (red)
  - `muted-foreground` = `#64748b` (gray text)
  - `border` = `#e2e8f0`
- Card: `rounded-lg border border-border bg-card p-6 shadow-sm`
- Section heading: `text-sm font-medium text-muted-foreground`
- Page title: `text-2xl font-bold`
- No external CSS files per component

### Charts (Recharts)

- Wrap in `<ResponsiveContainer width="100%" height={280}>`
- Colors: `fill="#1e40af"` bars, `stroke="#1e40af"` lines
- Multi-series palette: `['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']`
- Grid: `<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />`
- Currency tooltip: `formatter={(v) => formatCurrency(Number(v))}`

### CSV Export

- Semicolon separator (`;`) for Brazilian Excel compatibility
- UTF-8 BOM (`\uFEFF`) prefix
- Utility in `src/lib/utils.ts` or dedicated export utility
- Wired via `DataTable` `onExport` prop

### Locale and Formatting

```typescript
formatCurrency(150000)  // "R$ 150.000,00"
formatNumber(95000)     // "95.000"
formatPercent(23.5)     // "23,5%"
format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
```

### File Organization

```
src/
├── components/
│   ├── layout/          # Sidebar, ProtectedRoute, AppLayout
│   ├── shared/          # KpiCard, DataTable, Dialog, StatusBadge, skeletons, RefreshIndicator
│   └── [module]/        # Module-specific components
├── contexts/            # Auth context
├── hooks/               # use-sap-query.ts, future module hooks
├── pages/               # One file per page, default export
├── types/               # database.ts, future module types
├── config/              # env.ts
├── lib/                 # utils.ts, supabase.ts
└── index.css            # Tailwind theme

supabase/
├── migrations/          # Timestamp format (YYYYMMDDHHMMSS_name), 30 migrations
└── functions/
    ├── _shared/         # cors.ts, auth.ts, sap-connection.ts
    ├── sap-query/       # Live SAP query (JWT, whitelist, multi-recordset)
    ├── sap-sync/        # Upsert cache refresh (service_role, pg_cron)
    ├── create-user/     # User creation (diretoria)
    ├── manage-users/    # User listing + role management (diretoria)
    ├── route-calc/      # Google Maps route calculation
    ├── import-ocr/      # Claude Sonnet OCR for import docs
    └── diag-chain/      # SAP document chain diagnostics
```

### Naming Conventions

- **Files:** kebab-case (`kpi-card.tsx`, `use-sap-query.ts`)
- **Components:** PascalCase (`KpiCard`, `DataTable`)
- **Hooks:** camelCase with `use` prefix (`useSapQuery`, `useCacheQuery`)
- **Types:** PascalCase (`AppRole`, `Database`)
- **SQL tables:** snake_case (`sap_cache_pedidos`, `logistics_costs`)
- **SQL migrations:** `NNNNN_short_description.sql` (local) / `YYYYMMDDHHMMSS_name` (Supabase remote)
- **Edge Functions:** kebab-case dirs (`sap-query`, `manage-users`)
- **SAP queries in registry:** snake_case (`dashboard_kpis`, `pedido_detalhe_pv`)
- **Cache tables:** `sap_cache_` prefix for SAP data, no prefix for app-owned tables

---

## SAP Business One Reference

### Key Tables

| Category | Table | Description |
|----------|-------|-------------|
| Sales | ORDR / RDR1 | Sales Orders / Lines |
| Sales | OINV / INV1 / INV6 | AR Invoices / Lines / Installments |
| Sales | ODLN / DLN1 | Deliveries / Lines |
| Returns | ORDN / RDN1 | Returns / Lines |
| Returns | ORIN / RIN1 | Credit Memos / Lines |
| Purchasing | OPOR / POR1 | Purchase Orders / Lines |
| Purchasing | OPCH / PCH1 / PCH6 | AP Invoices / Lines / Installments |
| Purchasing | OPDN / PDN1 | Goods Receipt PO / Lines |
| Inventory | OITM | Items Master |
| Inventory | OITW | Item Warehouse (stock per warehouse) |
| Inventory | OWHS | Warehouses |
| Production | OWOR / WOR1 | Production Orders / Components |
| Partners | OCRD / CRD1 | Business Partners / Addresses |
| Partners | OSLP | Sales Employees (vendedores) |
| Finance | JDT1 | Journal Entry Lines |
| Finance | OACT | Chart of Accounts |
| Linking | INV21 / DLN21 | Header-level document references (RefObjType, RefDocEntr) |

### Status Codes

- `O` = Open, `C` = Closed, `L` = Cancelled
- Always filter: `CANCELED <> 'C'` (or `CANCELED = 'N'` depending on table)

### Production Orders (OWOR)

- `P` = Planned, `R` = Released, `L` = Closed

### Query Safety

- ALL queries MUST be in the `QUERIES` registry in `sap-connection.ts`
- NEVER accept raw SQL from the frontend
- Sanitize: `Number()` for integers, `.replace(/'/g, "''")` for strings
- Always `TOP N` or date filters to prevent full table scans
- Always exclude cancelled documents

---

## Edge Function Conventions (Deno)

- Import npm: `import mssql from "npm:mssql@11"`
- Import Supabase: `import "jsr:@supabase/functions-js/edge-runtime.d.ts"`
- CORS: `if (req.method === "OPTIONS") return corsResponse()`
- Auth: handle internally via `getUser()` — do NOT rely on `verify_jwt` gateway
- Deploy: use `verify_jwt: false` in function config (gateway JWT verification is broken)
- Max execution: 60s on Supabase Pro
- Multi-recordset support: `sap-query` returns header+lines in a single call for detail views

---

## Auth Notes

- Uses `onAuthStateChange` as **single source of truth** — NOT `getSession()`
- `getSession()` inside callbacks causes Web Locks API deadlock
- Role fetching uses direct `fetch()` to REST API (bypasses lock)
- User set immediately on auth change, roles fetched in background
- Safety timeout: 5s if `INITIAL_SESSION` never fires

---

## Company Context

- **Mata Norte Alimentos Ltda** — ~250 employees, ~R$100M/year
- **Core:** Canned sardines, frozen fish, salted fish, shrimp, fish meal
- **Production:** Manual canning (~95,000 cans/day), 2 shifts sardines (5h-15h, 15h-01h), 1 shift frozen/salted (7h-17h)
- **Clients:** Distributors, wholesalers, retailers, government PNAE (~7% revenue). PE and PB states.
- **SAP B1 v10:** Used for sales, purchasing, inventory, finance. Production module used but no lot tracking / full MRP.
- **Key people:** Eduardo Batista (tech/operations), Marcel Lucena (production), Thiago Feitosa (commercial), Eduardo Augusto (finance/admin)
- **Infrastructure:** On-premise server, factory Wi-Fi available, internet with intermittency. Planned migration: all PLCs from Xinje to Rockwell (Ethernet/IP). Cold chambers have NO digital sensors.
- **External systems:** Domínio (payroll), Secullum (facial time clock), Questor (external accounting firm), Power BI (connected to SAP SQL via DirectQuery)

---

## MCP Tools Available

Claude Code has access to these MCP tools (configured in `.claude/settings.local.json`):

- **Supabase:** apply_migration, deploy_edge_function, execute_sql, get_edge_function, get_logs, list_edge_functions, list_projects, get_project, get_project_url, get_publishable_keys, search_docs, get_advisors
- **Puppeteer:** navigate, screenshot, fill, click, evaluate (for testing deployed app)
- **Web:** WebSearch, WebFetch (github.com, sap-bi-dashboard.vercel.app)
- **CLI:** git, node, npm, npx, gh (GitHub CLI), curl, rm
