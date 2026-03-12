# STATUS.md — SAP BI Platform

**Última atualização:** 2026-03-08

---

## Estado Atual

Fases 1–8D + **Sprint 1 e Sprint 2 (melhorias) do Módulo Logístico Expandido** + **Módulo de Produção (MVP — Fase 1)** concluídos. Sprint 2 implementou 5 fases de melhorias: (A) Cálculo de pallets corrigido de CEILING→ROUND com 1 decimal, (B) Tabela totalizadora de SKU por dia da semana via RPC com agrupamento por produto (SARDINHA 125g, ATUM 140g, ATUM 400g, OUTROS) e subtotais por grupo, (C) Calendário com botão "Hoje", cells ricos com pills de carga e resumo semanal, semana começando na segunda-feira, (D) Ordenação de pedidos, dots de idade, chips UF rápidos, filtro de aging (máx dias), exclusão de pedidos estornados/cancelados, (E) Warnings de capacidade, transições de status válidas, alerta de veículo já alocado, campo `origem` no insert de shipment_items.

---

## O Que Funciona

- ✅ Auth com 6 roles (diretoria, comercial, logistica, financeiro, importacao, producao), deploy no Vercel
- ✅ Cache híbrido: pg_cron → sap-sync → cache tables (10min)
- ✅ 7 Edge Functions (sap-query v20, sap-sync v19, create-user v3, manage-users v3, route-calc v3, import-ocr v1, diag-chain v7)
- ✅ Todas queries SAP filtram documentos cancelados (`CANCELED <> 'C'`)
- ✅ Comercial unificado (PV+NF+EN), 4 KPIs com valor monetário em destaque, filtros temporais (presets + comparação) + 4 filtros de negócio, detail com print
- ✅ **DANFE completa via SQL** — Query `danfe_completo` (3 recordsets: header+lines+installments) com dados fiscais do SAP. CNPJ/IE destinatário via CRD7 (tabela fiscal brasileira). Layout A4 com 2 linhas de impostos, seção de volumes/peso, protocolo de autorização. TaxOne não armazena XML no MSSQL (gerencia externamente).
- ✅ CSV export em comercial, logística, devoluções, dashboard
- ✅ User management completo (listar, criar, add/remove roles)
- ✅ Engine de custo logístico (frete próprio/terceiro/descarga + Google Maps)
- ✅ **Dashboard com 7 abas: Visão Geral, Comercial, Financeiro, Produção, Logística, Estoque, Compras**
- ✅ **Filtro de período com presets (Este mês, Trimestre, YTD, Últimos 12m/24m)**
- ✅ **Comparação temporal: vs período anterior / vs mesmo período ano passado**
- ✅ **Sparklines inline nos KPI cards (SVG, sem dependência Recharts)**
- ✅ **Trend indicators (▲/▼ com % de variação) nos KPIs filtrados**
- ✅ **Abas filtradas por role (diretoria vê tudo, comercial vê Geral+Comercial, etc.)**
- ✅ **Queries SAP expandidas: histórico completo (sem limite de 24 meses)**
- ✅ **Sync migrado de delete-then-insert para upsert incremental + stale cleanup**
- ✅ **Metas via app_settings com barras de progresso nos KPI cards**
- ✅ **ErrorCard + EmptyState — componentes reutilizáveis para erros e dados vazios**
- ✅ **Todas 7 abas: isError com retry, isEmpty com mensagem, isLoading checa TODOS os queries**
- ✅ **ChartCard compartilhado — eliminou duplicação (era ChartCard local em cada area)**
- ✅ **compras_mes: agora inclui OPCH (AP Invoices) além de OPOR (POs)**
- ✅ **compras_lead_time: relaxado para HAVING >= 1, janela 24 meses**
- ✅ **Sync feedback: mostra "N blocos sincronizados" ou lista de erros parciais**
- ✅ Build + lint: 0 erros
- ✅ **Módulo Logístico Expandido (Sprint 1):** 8 tabelas (vehicles, drivers, logistics_operators, item_packaging, shipments, shipment_items, return_requests, shipment_tracking_events), 2 enums, RLS, storage buckets, auto-reference triggers
- ✅ **Tab 1 - Programação de Pedidos:** calendário visual (semana/mês toggle), seleção de pedidos com filtros (UF, busca), capacity gauge (peso/paletes), criação de cargas com 2 steps
- ✅ **Cadastros CRUD:** 4 entidades (veículos, motoristas, operadores logísticos, paletização de itens) com soft delete, CPF mask, regiões NE, staleTime 5min
- ✅ **SAP peso/volume:** query pedidos estendida com OUTER APPLY para OITM.SWeight1/SVolume em todas 4 CTEs
- ✅ **Bug fixes Sprint 1:** checkbox double-toggle fix (stopPropagation), select-all respeita filtros ativos, calendário semana/mês toggle, staleTime 5min em todas queries (calendário + cadastros), coluna vendedor removida da tabela de pedidos
- ✅ **Volume (m³) removido da UI:** capacity gauge mostra apenas peso+paletes, cadastros sem campos m³, tabelas sem coluna m³. Colunas DB mantidas para compatibilidade futura
- ✅ **Shipment Detail Fix (2026-03-08):** pallets sum corrigido (era hardcoded 0), coluna Pallets adicionada na tabela do edit dialog, funcionalidade "Adicionar Pedidos" no edit dialog (busca inline, badge "novo", recalcula totais). Verificado via E2E test no Playwright.
- ✅ **Sprint 2 Melhorias (2026-03-08):** Pallet CEILING→ROUND(1), SKU weekly table com RPC + agrupamento por produto (SARDINHA 125g, ATUM 140g, ATUM 400g, OUTROS) via ILIKE pattern matching no SQL, subtotais por grupo com cores, calendário segunda-feira first, filtro aging pedidos (30d default), sort/dots/chips UF, capacity warnings, status transitions, vehicle conflict detection

## Edge Functions

| Function | Version | verify_jwt | Status |
|----------|---------|------------|--------|
| `sap-query` | v35 | false | ✅ |
| `sap-sync` | v22 | false | ✅ |
| `create-user` | v3 | false | ✅ |
| `manage-users` | v3 | false | ✅ |
| `route-calc` | v3 | false | ✅ |
| `import-ocr` | v1 | false | ✅ |
| `diag-chain` | v7 | false | ✅ |

---

## Comercial Tab Improvements

### SQL Fix
- Fixed operator precedence bug in `pedidos` query OUTER APPLY for deliveries — `AND` had higher precedence than `OR`, causing cancelled deliveries via NF (BaseType=13 branch) to slip through unfiltered. Added explicit parentheses.

### New Hook
- `use-comercial-filters.ts` — manages dateRange + comparison mode with sessionStorage persistence, reuses `DATE_PRESETS` and `filterByDateRange`/`computeComparison` from dashboard utils.

### UI Changes
- Date preset bar (Este mês, Mês passado, Trimestre, YTD, 12m, 24m) + comparison dropdown above business filters
- KPI cards: currency value (R$) as prominent `value`, document count as `description` (was inverted)
- Comparison trends (▲/▼ %) on KPI cards when comparison mode active

### Delivery Linking Fix (Phase 2 + Phase 3) — 2026-03-04
- **Phase 2** (item-level matching) was insufficient — replaced by **Phase 3** (DLN21/INV21)
- Discovered SAP B1 header-level reference tables: `DLN21` (delivery refs) and `INV21` (NF refs)
- Actual column names: `RefDocEntr` (int), `RefObjType` (nvarchar: '13'=OINV, '17'=ORDR, '15'=ODLN), `RefDocNum` (int)
- EN 1192 → DLN21 has `RefDocEntr=4844, RefObjType='13'` → delivery references NF 4844
- **pedidos_ordem NF OUTER APPLY**: added INV21 path (`RefObjType='17'` for PV refs)
- **pedidos_ordem EN OUTER APPLY**: added DLN21 paths (`RefObjType='13'` for NF, `'17'` for PV)
- **notas_sem_pedido EN OUTER APPLY**: added DLN21 path for NF→EN linking
- **notas_sem_pedido NOT EXISTS**: added INV21 exclusion for NFs linked to PV
- **entregas_sem_pedido NOT EXISTS**: replaced item-level EXCEPT matching with DLN21 exclusions
- Result: PV 3571 shows status="Entregue" with entrega_data=2026-03-02, EN 1192 gone from standalone

### Edge Functions Redeployed
- `sap-query` v20 and `sap-sync` v19 with upsert incremental + full history

---

## Phase 8C Changes (Dashboard Fix)

### New Shared Components
| Component | Purpose |
|-----------|---------|
| `error-card.tsx` | Card with error icon, message, and "Tentar novamente" button |
| `empty-state.tsx` | Lightweight message for charts/tables with no data |
| `chart-card.tsx` | Unified chart wrapper (loading, empty, render) — replaced 7 duplicated ChartCard functions |

### Dashboard Area Improvements
All 7 areas now have:
- `isError` extracted from every `useCacheQuery` call
- `hasError` combined flag → shows `ErrorCard` with retry for all queries
- `isLoading` checks ALL queries (was only checking 2 of 6 in area-geral)
- Charts show `EmptyState` when data is genuinely empty after filtering
- Contextual empty messages (e.g., "Sem lançamentos de custo logístico")

### SAP Query Fixes
| Query | Before | After |
|-------|--------|-------|
| `compras_mes` | OPOR only (4 rows, 0 in 2026) | OPOR + OPCH UNION ALL (full purchasing view) |
| `compras_lead_time` | 12mo, HAVING >= 2 | 24mo, HAVING >= 1 |

### Sync Improvements
- sap-sync response now includes `synced[]` array listing successful blocks
- Dashboard header shows "N blocos sincronizados" on success
- Partial sync shows error count and first 3 error names
- Error messages include actual error text from Edge Function

---

## Dashboard Architecture (Phase 8B)

| Component | Purpose |
|-----------|---------|
| `dashboard.tsx` | Orchestrator — wires filters, header, tabs, renders selected area |
| `dashboard-header.tsx` | Title + date inputs + presets + comparison dropdown + CSV + refresh |
| `area-tabs.tsx` | 7 role-filtered tabs |
| `area-geral.tsx` | 4 KPIs (faturamento w/ sparkline+trend+goal, pedidos, entregas, devoluções) + 4 charts |
| `area-comercial.tsx` | 6 KPIs + 4 biz filters + 2 horiz bar charts (vendedor/UF) + 2 vert bar charts (fat-ped-ent, status stacked) + 2 tables (mix SKU, canal) |
| `area-financeiro.tsx` | 4 KPIs (CR, CP, ciclo caixa, margem) + 4 charts |
| `area-producao.tsx` | 3 KPIs (OPs, eficiência, produção total) + 2 charts |
| `area-logistica.tsx` | 4 KPIs (pendentes, concluídas, taxa entrega, custo) + 3 charts |
| `area-estoque.tsx` | 3 KPIs + 2 charts + mini-table (snapshot, não filtrado por período) |
| `area-compras.tsx` | 3 KPIs (POs, valor, atrasados) + chart + lead time table |
| `use-dashboard-filters.ts` | State management: area, dateRange, comparison, sessionStorage persistence |

---

## Phase 8D — Importações (MVP)

### New tables (migration 00014 + 00015)
- `import_processes` — 15-status workflow, auto-reference (IMP-YYYY-NNN), free time tracking
- `import_items` — products per process, GENERATED total_price
- `import_costs` — 14 cost types, BRL/USD/EUR, payment status, unique constraint
- `import_documents` — storage metadata, OCR status/extracted_data JSONB
- `import_tracking_events` — container events (manual entry)
- `import_timeline` — status audit log
- RLS: diretoria+importacao = read/write, financeiro = read-only
- Storage bucket: `import-documents` (20MB, PDF/image)

### New role
- `importacao` added to `app_role` enum

### New pages
- `/importacao` — list page with KPIs + table/pipeline toggle
- `/importacao/novo` — create form (supplier, incoterm, currency, items)
- `/importacao/:id` — detail with 5 tabs (Dados, Documentos, Custos, Tracking, Histórico)

### New components (10)
- `status-stepper.tsx` — 15-step horizontal stepper
- `process-form.tsx` — multi-section create form with items sub-table
- `pipeline-view.tsx` — Kanban by 4 phases (Preparação, Transporte, Porto, Finalização)
- `free-time-badge.tsx` — green/yellow/red countdown
- `documents-tab.tsx` — drag-and-drop upload, preview, OCR trigger
- `ocr-review-dialog.tsx` — side-by-side preview + editable fields
- `costs-tab.tsx` — 14 rows, inline editing, summary with desvio %
- `tracking-tab.tsx` — manual event entry with vertical timeline
- `timeline-tab.tsx` — status change audit log

### Edge Function
- `import-ocr` v1 — downloads doc from Storage, calls Claude Sonnet API, extracts structured data

### Secret needed
- `ANTHROPIC_API_KEY` must be set in Supabase Dashboard for OCR to work

---

## Upsert Migration (2026-03-04)

### Changes
- **sap-sync**: Migrated all 24 sync blocks from delete-then-insert to upsert incremental
  - `upsertAndClean()`: upsert in 500-row chunks + delete stale rows (21 tables)
  - `replaceAll()`: delete + insert for single-row tables without unique index (3 tables)
- **sap-connection.ts**: Removed `DATEADD(MONTH, -24, GETDATE())` from 11 queries — now syncs full history
- **Migration 00018**: Fixed COALESCE indexes on `financeiro_canal` and `financeiro_top_clientes` (NOT NULL DEFAULT '' + direct column index)
- **CLAUDE.md**: Updated edge function versions, added 24 cache tables reference, sync strategy, import module docs
- **SKILLS.md**: Updated upsert pattern, migration numbering, added Skill 15 (cache table onConflict reference)

### Results
- 24/24 blocks synced, 0 errors
- Row counts increased (pedidos 3953→4116, entregas 1135→1149) confirming full history works
- Build passes with 0 errors

---

## Pedido Detail Fix (2026-03-06)

### Problem
Pedido detail dialog showed blank item lines (Total Geral = R$ 0,00). PV lines stopped at doc_entry 3520, but pedidos table went up to 3622.

### Root Cause
`pedido_linhas_sync` query had NO date filter — attempted to return ALL line items from ALL SAP documents (RDR1+INV1+DLN1). The massive result set caused truncation/timeout during sync. `upsertAndClean` then deleted "stale" rows not in the truncated result, wiping valid data. Additionally, upsert batches had no error checking — failures were silent.

### Fix
1. Added `H.DocDate >= DATEADD(MONTH, -12, GETDATE())` to all 3 UNION ALL parts of `pedido_linhas_sync`
2. Added error checking to `upsertAndClean` — failed upserts now throw instead of silently losing data
3. Deployed sap-sync v27, triggered manual sync

### Result
- PV lines now cover doc_entry 1839–3622 (was capped at 3520)
- Total pedido_linhas rows: 8,887 (PV: 3,254 + NF: 3,524 + EN: 2,109)
- Pedido 3622 detail shows items correctly

---

## Dashboard Comercial Revamp (2026-03-06)

### Removed
- Mix por Status pie chart
- Evolução Mensal line chart (usava `sap_cache_faturamento_mensal`)
- Receita por Grupo SKU pie chart
- Evolução Mensal por Grupo SKU line chart
- `faturamento_mensal` cache query (no longer needed in this component)
- `SKU_COLORS` constant

### Added
- **Fat/Ped/Ent mês a mês** — grouped vertical BarChart (3 bars: Faturamento #1e40af, Pedidos #f59e0b, Entregas #10b981) aggregated from `businessFiltered` by month
- **Status por Mês** — stacked BarChart (count per status per month, using `STATUS_COLORS`)
- **Receita por Canal** — HTML table (Canal, Faturado, Estorno, Fat. Líquido, Entregas) with total row, sorted by Faturado DESC

### Changed
- Mix de Produtos table: "Ticket Médio" → "Vlr Médio/Und" (calc: receita/volume instead of receita/num_notas)

### Final Layout
```
[Filters] → [KPI Row 1: 3 cards] → [KPI Row 2: 3 cards]
→ [2-col: Receita por Vendedor | Receita por UF]
→ [2-col: Fat/Ped/Ent mês a mês | Status por Mês]
→ [Análise por Grupo de SKU]
→ [2-col: Mix de Produtos table | Receita por Canal table]
```

---

## DANFE Implementation (2026-03-08)

### Investigation Results
- TaxOne addon has only 3 `TX_ECF_*` tables (SPED/ECF related) — **NO `@TAXONE_NFXML`** table
- No XML columns in any TaxOne table — XML is managed externally by TaxOne's service
- OINV has `U_ChaveAcesso` and `U_XmlServiceStatus` but no XML content field
- **Conclusion:** XML-first approach not viable. SQL fallback is the correct approach.

### CNPJ Fix
- Discovered CNPJ/IE stored in `CRD7` table (Brazilian fiscal tax IDs), not in `OCRD.LicTradNum`
- `CRD7.TaxId0` = CNPJ, `CRD7.TaxId4` = IE
- Updated `danfe_completo` and `pedido_detalhe_nf_fiscal` queries with CRD7 JOIN + OCRD fallback

### Changes
- `DanfeHeader` type extended: +FreteModalidade, PlacaVeiculo, UF_Veiculo, RNTC, VolumesQtd, VolumesEspecie, PesoLiquido, PesoBruto, ICMS_ST_Base, ICMS_ST_Valor, PIS_Total, COFINS_Total, IPI_Total, ProtocoloAutorizacao, DataAutorizacao, InfoComplementar
- `DanfeLinha` type extended: +ICMS_Base, PIS_Valor, PIS_Aliq, COFINS_Valor, COFINS_Aliq, IPI_Valor, IPI_Aliq, ICMS_ST_Valor
- `danfe-template.ts` — full A4 DANFE layout with 2 rows of tax fields, transport, protocolo de autorização
- `pedido-detalhe-dialog.tsx` — simplified to SQL-only DANFE flow (removed XML-first attempt)
- Removed: exploratory queries, `danfe_xml` query, `DanfeXmlResult` type, `parseNFeXml` import
- `nfe-xml-parser.ts` exists but is unused (kept for potential future use if XML becomes available)
- sap-query deployed v35

### Tested End-to-End
- NF 22003 (R$100K): Header OK, CNPJ_Dest=11.179.185/0001-60, 1 line, 3 installments
- NF 19420 (R$9.9K): Header OK, CNPJ_Dest=03.766.525/0003-92
- ChaveNFe empty for tested NFs (not yet transmitted or field not populated by TaxOne)

---

## NFe XML Download Script (2026-03-08)

### Overview
Python script to download all NFe XMLs (emitted and received) from SEFAZ via NFeDistribuicaoDFe SOAP API. Designed to run on the SAP server via Windows Task Scheduler.

### Files Created
- `scripts/nfe_download/nfe_download.py` — Main download script (SEFAZ SOAP client, rate limit handling, crash recovery)
- `scripts/nfe_download/nfe_download.bat` — Task Scheduler wrapper (daily incremental)
- `scripts/nfe_download/nfe_backfill.bat` — One-time full history download
- `scripts/nfe_download/setup.bat` — Initial setup (dirs, deps, state)
- `scripts/nfe_download/test_cert.py` — Certificate validation + SEFAZ test
- `scripts/nfe_download/requirements.txt` — Python deps (requests, cryptography, pyOpenSSL)
- `scripts/nfe_download/.gitignore` — Excludes certificates, keys, state, logs

### Key Features
- **Incremental download**: persists last NSU in `state.json`, resumes from where it stopped
- **Rate limit handling**: 18 queries/hour (SEFAZ limit is 20), auto-sleep on error 656
- **Backfill mode**: continuous download with automatic hourly pauses
- **Classification**: auto-sorts XMLs into `emitidas/` vs `recebidas/` by CNPJ match
- **Organization**: `{emitidas|recebidas}/{year}/{month}/{chave_acesso_44}.xml`
- **Crash recovery**: state saved after each batch
- **Certificate extraction**: PFX → PEM for mTLS with SEFAZ

### Setup Steps (on SAP server)
1. Run `setup.bat` (creates D:\NFe_XMLs\, installs Python deps)
2. Copy e-CNPJ A1 (.pfx) to `D:\NFe_XMLs\config\certificate.pfx`
3. Set `NFE_CERT_PASSWORD` in batch files
4. Test: `python test_cert.py`
5. Run backfill: `nfe_backfill.bat` (runs for 1-2 weeks)
6. Schedule: Task Scheduler → `nfe_download.bat` daily at 03:00

### Future Integration
- `nfe-xml-parser.ts` already exists and works — can parse downloaded XMLs
- Options: (a) read via SAP MSSQL xp_cmdshell, (b) sync to Supabase Storage, (c) intermediate API

---

## Módulo de Produção — MVP (Fase 1) (2026-03-08)

### Database (9 novas tabelas)
- `sap_cache_producao_ordens_lista` — cache de OPs do SAP (unique on doc_entry)
- `production_lines` — 4 tipos (conserva, congelado, salgado, farinha)
- `production_steps` — etapas por linha (unique on line_id+sequence)
- `production_shifts` — turnos configuráveis
- `production_line_shifts` — vínculo linha↔turno
- `production_stop_reasons` — 7 categorias
- `production_teams` — 3 funções (líder, operador, auxiliar)
- `production_team_assignments` — vínculo equipe↔linha↔turno
- `pcp_daily_plans` — planejamento PCP diário

### SAP Queries (+3)
- `producao_ordens_lista` — lista de OPs dos últimos 24 meses
- `producao_ordem_detalhe` — multi-recordset: header + BOM components
- `producao_bom_forecast` — BOM de um item com estoque disponível

### Frontend (10 novos arquivos)
- `/producao` — página principal com 3 tabs (Dashboard, Ordens, PCP)
- Tab Dashboard: 4 KPIs + 4 charts (Planejado vs Real, Consumo MP, OEE Trend, Status donut)
- Tab Ordens: lista com 4 filtros, 4 KPIs, drill-down com componentes BOM
- Tab PCP: Gantt semanal CSS Grid, CRUD de planos diários, painel de materiais
- Cadastros: 5 tabs CRUD (Linhas, Etapas, Turnos, Motivos de Parada, Equipes)

### Role
- Nova role `producao` adicionada ao enum `app_role`
- Sidebar + ProtectedRoute + area-tabs atualizados

### Sync
- sap-sync: step 28 — upsert `sap_cache_producao_ordens_lista` on `doc_entry`
- sap-query: `producao_ordem_detalhe` adicionado ao multi-recordset handler

---

## Próximo Passo

### Módulo de Produção — Fase 2 (MES)
1. Tela tablet para apontamentos de produção (contagem + paradas)
2. Cálculo OEE real (disponibilidade × performance × qualidade)
3. Tabelas `production_records`, `production_stops`

### Módulo Logístico — Sprint 3
1. **Tab 2 - Romaneio de Saída** — conferência de itens, registro de lotes, fotos obrigatórias (carregamento + caminhão), status `programada` → `expedida`, impressão de romaneio
2. **Tab 4 - Descarrego** — foto de canhoto, vinculação CTE, custo de descarrego, status `em_transito` → `entregue`
3. **Tab 3 - Acompanhamento de Entrega** — board de status por carga, atualização manual de eventos

### Módulo Logístico — Sprint 4
4. **Tab 5 - Devoluções** — migrar `/devolucoes` existente + workflow kanban
5. **Tab 6 - Custo Logístico por NF** — migrar `/custo-logistico` + rateio CTE
6. Cutover: remover páginas antigas do sidebar/rotas

### Módulo Comercial — Sprints 5-6
7. Tab shell comercial + migrar gestão de pedidos
8. Verbas Comerciais + Análises IA + DRE + Trade Marketing

### Backlog geral
- Set `ANTHROPIC_API_KEY` secret in Supabase Dashboard (para OCR importações)
- Container tracking API integration
- ~~Coluna de paletes/fração na tabela de pedidos pendentes~~ (pallets implementado no shipment detail)

Ver `PLAN.md` para roadmap completo.

---

## O Que Falta (Backlog)

- 📋 Testes automatizados (Vitest)
- 📋 Paginação server-side para tabelas grandes
- 📋 Dark mode
- 📋 Monitor de tempo de execução do sap-sync (watch for >50s timeout)
