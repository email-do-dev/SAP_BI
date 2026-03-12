# SKILLS.md — Implementation Patterns

Concrete, copy-paste-ready patterns for every type of task in this project. Find the matching skill and follow it exactly.

---

## Skill 1: Add a New SAP Cache Query

**When:** You need to expose new SAP data in the dashboard or a page.

### Step 1 — Write SQL and add to registry

File: `supabase/functions/_shared/sap-connection.ts`

```typescript
// Static query (no parameters)
query_name: `
  SELECT
    column1,
    SUM(column2) as total
  FROM SAP_TABLE T0
  WHERE T0.DocDate >= DATEADD(MONTH, -12, GETDATE())
    AND T0.CANCELED <> 'C'
  GROUP BY column1
  ORDER BY column1
`,

// Parameterized query
query_detail: (params) => `
  SELECT T0.Field1, T0.Field2
  FROM SAP_TABLE T0
  WHERE T0.DocEntry = ${Number(params.docEntry)}
    AND T0.CANCELED <> 'C'
`,

// String parameter (sanitize!)
query_by_code: (params) => `
  SELECT T0.*
  FROM OCRD T0
  WHERE T0.CardCode = '${String(params.cardCode).replace(/'/g, "''")}'
`,
```

**Rules:**
- `Number()` for integer params, `.replace(/'/g, "''")` for strings
- Always `CANCELED <> 'C'` (or `CANCELED = 'N'` depending on table)
- Always `TOP N` or date filters — never full table scans
- Test in SSMS before adding to registry

### Step 2 — Create cache table migration

File: `supabase/migrations/NNNNN_create_sap_cache_XXXXX.sql`

```sql
create table public.sap_cache_XXXXX (
  id uuid default gen_random_uuid() primary key,
  some_key text not null,
  some_value numeric(18,2) default 0 not null,
  refreshed_at timestamptz default now() not null
);

alter table public.sap_cache_XXXXX enable row level security;

create policy "Authenticated users can read sap_cache_XXXXX"
  on public.sap_cache_XXXXX for select
  using (auth.role() = 'authenticated');

create policy "Service role can write sap_cache_XXXXX"
  on public.sap_cache_XXXXX for all
  using (auth.jwt() ->> 'role' = 'service_role');

create unique index idx_cache_XXXXX_key on public.sap_cache_XXXXX (some_key);
```

### Step 3 — Add sync logic (upsert + stale cleanup)

File: `supabase/functions/sap-sync/index.ts`

```typescript
// For tables with unique index: use upsertAndClean helper
try {
  const rows = await querySap<SomeType>(resolveQuery("query_name"));
  await upsertAndClean(supabase, "sap_cache_XXXXX", rows, "some_key", now);
  synced.push("XXXXX");
} catch (e) {
  errors.push(`XXXXX: ${e}`);
}

// For single-row tables without unique index: use replaceAll helper
try {
  const [row] = await querySap<SomeType>(resolveQuery("query_name"));
  await replaceAll(supabase, "sap_cache_XXXXX", row, now);
  synced.push("XXXXX");
} catch (e) {
  errors.push(`XXXXX: ${e}`);
}
```

**upsertAndClean:** Upserts in 500-row chunks, then deletes rows where `refreshed_at < now` (stale cleanup).
**replaceAll:** Deletes all rows, inserts fresh (for tables with no unique index, e.g. single-row summaries).

### Step 4 — Update TypeScript types

File: `src/types/database.ts`

```typescript
sap_cache_XXXXX: {
  Row: {
    id: string
    some_key: string
    some_value: number
    refreshed_at: string
  }
  Insert: Record<string, never>
  Update: Record<string, never>
}
```

### Step 5 — Use in UI

```typescript
const { data, isLoading, error } = useCacheQuery<Array<{
  some_key: string
  some_value: number
  refreshed_at: string
}>>('sap_cache_XXXXX', { order: 'some_key', ascending: true })
```

---

## Skill 2: Add a New Page

### Step 1 — Create page file

File: `src/pages/new-page.tsx`

```tsx
import { useState } from 'react'
import { SomeIcon } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { RefreshIndicator } from '@/components/shared/refresh-indicator'
import { DataTable } from '@/components/shared/data-table'
import { Dialog } from '@/components/shared/dialog'
import { useCacheQuery, useSapQuery } from '@/hooks/use-sap-query'
import { formatCurrency } from '@/lib/utils'

export default function NewPage() {
  const { data, isLoading, error } = useCacheQuery<SomeType[]>('sap_cache_table')
  const [selected, setSelected] = useState<SomeType | null>(null)
  const { data: detail } = useSapQuery<DetailType[]>({
    queryName: 'detail_query',
    params: { docEntry: selected?.doc_entry ?? 0 },
    enabled: !!selected,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Título da Página</h1>
        <RefreshIndicator refreshedAt={data?.[0]?.refreshed_at} />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar dados: {error.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <KpiCard title="KPI" value={formatCurrency(0)} icon={<SomeIcon size={20} />} />
        )}
      </div>

      {isLoading ? <TableSkeleton /> : (
        <DataTable
          data={data ?? []}
          columns={columns}
          searchPlaceholder="Buscar..."
          searchColumn="card_name"
          onRowClick={setSelected}
          onExport={/* CSV export callback */}
        />
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} title="Detalhe">
        {/* detail content */}
      </Dialog>
    </div>
  )
}
```

### Step 2 — Add route in App.tsx

```typescript
const NewPage = lazyRetry(() => import('@/pages/new-page'))

// Inside authenticated layout routes:
<Route
  path="new-page"
  element={
    <ProtectedRoute requiredRoles={['diretoria', 'relevant_role']}>
      <NewPage />
    </ProtectedRoute>
  }
/>
```

### Step 3 — Add to sidebar

File: `src/components/layout/sidebar.tsx`

```typescript
{ label: 'Nome', href: '/new-page', icon: <Icon size={20} />, roles: ['diretoria', 'role'] },
```

---

## Skill 3: Add a New Module (own tables, not SAP)

### Migration pattern

```sql
create table public.module_records (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'blocked')),
  assigned_to uuid references auth.users,
  created_by uuid references auth.users not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.module_records enable row level security;

create policy "Authenticated read" on public.module_records
  for select using (auth.role() = 'authenticated');

create policy "Authenticated insert" on public.module_records
  for insert with check (auth.role() = 'authenticated');

create policy "Owner or diretoria update" on public.module_records
  for update using (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'diretoria')
  );

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger set_updated_at before update on public.module_records
  for each row execute function public.update_updated_at();

create index idx_module_status on public.module_records (status);
create index idx_module_assigned on public.module_records (assigned_to);
```

### Hook pattern

File: `src/hooks/use-module.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useModuleRecords(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['module_records', filters],
    queryFn: async () => {
      let query = supabase.from('module_records').select('*').order('created_at', { ascending: false })
      if (filters?.status) query = query.eq('status', filters.status)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('module_records')
        .insert({ ...input, created_by: user.id })
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module_records'] }),
  })
}

export function useUpdateRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string }) => {
      const { data, error } = await supabase
        .from('module_records').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module_records'] }),
  })
}
```

Then: update types → create page (Skill 2) → add route → add nav item.

---

## Skill 4: Dashboard Charts

```tsx
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
         XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartSkeleton } from '@/components/shared/loading-skeleton'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

// Bar chart
<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
  <h2 className="mb-4 text-sm font-medium text-muted-foreground">Título</h2>
  {isLoading ? <ChartSkeleton /> : (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        <Bar dataKey="value" fill="#1e40af" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )}
</div>

// Pie chart (real data — not hardcoded)
<PieChart>
  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
       label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
  </Pie>
  <Tooltip />
</PieChart>
```

---

## Skill 5: Edge Functions (Deno)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    // ... business logic ...

    return new Response(JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("fn error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
```

**Deploy:** `supabase functions deploy function-name` — always with `verify_jwt: false` (handle auth internally).

---

## Skill 6: Multi-Recordset SAP Detail Query

**When:** Drill-down needs header + lines in a single call (like PedidoDetalheDialog).

In the QUERIES registry, return multiple result sets:
```typescript
pedido_detalhe_xx: (params) => `
  -- Recordset 1: Header
  SELECT T0.DocEntry, T0.DocNum, T0.CardName, T0.DocDate, T0.DocTotal
  FROM ORDR T0 WHERE T0.DocEntry = ${Number(params.docEntry)};

  -- Recordset 2: Lines
  SELECT T1.ItemCode, T1.Dscription, T1.Quantity, T1.Price, T1.LineTotal
  FROM RDR1 T1 WHERE T1.DocEntry = ${Number(params.docEntry)};
`,
```

In `sap-query` Edge Function, handle multiple recordsets:
```typescript
const result = await db.request().query(sql);
// result.recordsets[0] = header, result.recordsets[1] = lines
return { header: result.recordsets[0], lines: result.recordsets[1] };
```

---

## Skill 7: CSV Export

Pattern already implemented. To wire into a new page:

```typescript
// In your page:
import { exportToCsv } from '@/lib/utils'  // or wherever the utility lives

const handleExport = () => {
  if (!data) return
  exportToCsv(data, columns, 'filename.csv')
}

// Pass to DataTable:
<DataTable data={data} columns={columns} onExport={handleExport} />
```

CSV uses semicolon separator (`;`) for Brazilian Excel and UTF-8 BOM (`\uFEFF`).

---

## Skill 8: Print from Dialog

```typescript
import { printContent } from '@/lib/utils'

// Inside a dialog, render HTML content and call:
<button onClick={() => printContent(htmlString, 'Título do Documento')}>
  Imprimir
</button>
```

`printContent()` opens a new window with formatted HTML and triggers `window.print()`.

---

## Skill 9: Mobile-First Form (factory floor)

```tsx
export function ProductionForm() {
  const [form, setForm] = useState({ field1: '', field2: 0 })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const { error } = await supabase.from('production_records').insert(form)
      if (error) throw error
      setSuccess(true)
      setForm({ field1: '', field2: 0 })
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error(err)
      // TODO: queue for offline sync
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <h1 className="text-xl font-bold">Registro de Produção</h1>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">Campo</label>
        <input
          type="text" value={form.field1}
          onChange={(e) => setForm(prev => ({ ...prev, field1: e.target.value }))}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base"
        />
      </div>
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✅ Salvo!</div>
      )}
      <button onClick={handleSubmit} disabled={submitting}
        className="w-full rounded-lg bg-primary py-4 text-base font-medium text-primary-foreground disabled:opacity-50">
        {submitting ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}
```

- Min 44px touch targets
- Offline-capable: queue in localStorage, sync when online
- Internet has intermittency at the factory — forms must not lose data

---

## Skill 10: Data Hooks Reference

### useCacheQuery — cached SAP data (fast)

```typescript
const { data, isLoading, error } = useCacheQuery<MyType[]>('sap_cache_table', {
  select: 'field1, field2',
  order: 'field1',
  ascending: true,
  limit: 100,
})
```

### useSapQuery — live SAP drill-down (slower, fresh)

```typescript
const { data, isLoading } = useSapQuery<DetailType[]>({
  queryName: 'registered_query',
  params: { docEntry: id },
  enabled: !!id,  // only run when user selects
})
```

### Direct Supabase — app-owned tables

```typescript
// Read
const { data, error } = await supabase.from('tasks').select('*').eq('status', 'open')
// Insert
const { data, error } = await supabase.from('tasks').insert({ ... }).select().single()
// Update
const { data, error } = await supabase.from('tasks').update({ ... }).eq('id', id).select().single()
// Delete
const { error } = await supabase.from('tasks').delete().eq('id', id)
```

---

## Skill 11: Formatting Reference

```typescript
import { formatCurrency, formatNumber, formatPercent, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

formatCurrency(150000)   // "R$ 150.000,00"
formatNumber(95000)      // "95.000"
formatPercent(23.5)      // "23,5%"
cn('base', active && 'active-class')

format(new Date(), "dd/MM/yyyy", { locale: ptBR })            // "02/03/2026"
format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) // "02/03/2026 às 14:30"
format(new Date(), "MMM yyyy", { locale: ptBR })               // "mar 2026"
```

---

## Skill 12: Migration Numbering

**Local files:** `00001` through `00018` in `supabase/migrations/`.
**Supabase remote:** Timestamp format `YYYYMMDDHHMMSS_name` (30 migrations).

Local format: `NNNNN_short_description.sql` — next local: `00019`.

Apply via Supabase MCP tool `apply_migration` (creates timestamp-based migration remotely) or local SQL file.

---

## Skill 13: Adding a New Role

1. Migration: `ALTER TYPE public.app_role ADD VALUE 'new_role';`
2. Update `AppRole` type in `src/types/database.ts`
3. Add route `requiredRoles` in `App.tsx`
4. Add nav item `roles` filter in `sidebar.tsx`
5. Existing roles: `diretoria`, `comercial`, `logistica`, `financeiro`, `importacao`
6. Plan roles: `producao`, `qualidade`, `manutencao`, `compras`

---

## Skill 14: StatusBadge Variants

Current variants in `StatusBadge`:
- Document status: `O` (Open), `C` (Closed), `L` (Cancelled)
- Custom: `Pedido`, `Faturado`, `Entregue`, `Cancelado`, `Venda`, `Bonificacao`

To add new variant: update the color/label map in `src/components/shared/status-badge.tsx`.

---

## Skill 15: Cache Table onConflict Reference

When adding upsert logic in `sap-sync`, use the correct `onConflict` key:

| Table | onConflict |
|-------|-----------|
| sap_cache_pedidos | `doc_entry,origem` |
| sap_cache_entregas | `doc_entry` |
| sap_cache_devolucoes | `doc_entry,doc_type` |
| sap_cache_faturamento_mensal | `mes` |
| sap_cache_dashboard_kpis_mensal | `mes,metric` |
| sap_cache_financeiro_aging | `tipo` |
| sap_cache_financeiro_cashflow | `due_date` |
| sap_cache_financeiro_margem | `mes` |
| sap_cache_financeiro_canal | `canal,mes` |
| sap_cache_financeiro_top_clientes | `card_code,mes` |
| sap_cache_custo_logistico | `mes` |
| sap_cache_estoque_deposito | `deposito` |
| sap_cache_estoque_valorizacao | `grupo` |
| sap_cache_estoque_abaixo_minimo | `item_code` |
| sap_cache_estoque_giro | `item_code` |
| sap_cache_producao_ordens | `status` |
| sap_cache_producao_consumo_mp | `item_code` |
| sap_cache_producao_planejado_vs_real | `mes` |
| sap_cache_compras_mes | `mes` |
| sap_cache_compras_lead_time | `fornecedor` |

**No unique index (use `replaceAll`):** `sap_cache_dashboard_kpis`, `sap_cache_compras_abertas`, `sap_cache_financeiro_ciclo`
