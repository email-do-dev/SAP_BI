# PLAN.md — SAP BI Platform

## Visão Geral

Plataforma de gestão operacional integrada para a Mata Norte Alimentos Ltda. Iniciou como dashboard de BI para SAP Business One e está evoluindo para uma plataforma completa cobrindo produção, qualidade, estoque, logística, comercial e financeiro.

**Stack:** React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS v4 + Supabase Pro (Edge Functions + PostgreSQL)
**Deploy:** Frontend no Vercel, Backend no Supabase
**SAP:** Business One v10, SQL Server, on-premise

---

## Fases Concluídas

### Fase 1 — Infraestrutura e Auth ✅

- [x] Scaffold (Vite + React + TS)
- [x] Supabase: projeto, env vars, client JS
- [x] Tabela `profiles` com trigger `on_auth_user_created`
- [x] Sistema de roles (`app_role` enum, `user_roles` table)
- [x] Funções DB `get_user_roles()` e `has_role()`
- [x] `AuthProvider` com `onAuthStateChange` (sem `getSession` — deadlock Web Locks)
- [x] `ProtectedRoute`, `Sidebar` com filtro por role
- [x] Página de login (`/login`)

### Fase 2 — Cache Híbrido e Sync ✅

- [x] 6 tabelas de cache (`sap_cache_*`) com RLS
- [x] Edge Function `sap-sync` (delete-then-insert, chunks de 500)
- [x] pg_cron job a cada 10 min
- [x] Hooks `useCacheQuery` e `useSapQuery`
- [x] Registry de queries SAP whitelisted

### Fase 3 — Páginas de Dados ✅

- [x] Dashboard (`/`) — KPIs + gráficos faturamento mensal (bar, line, pie real)
- [x] Comercial (`/comercial`) — Visão unificada PV+NF+EN, 4 KPIs, 7 filtros, detail dialog com print
- [x] Logística (`/logistica`) — Entregas + drill-down
- [x] Devoluções (`/devolucoes`) — Tabs devoluções/crédito + drill-down
- [x] Custo Logístico (`/custo-logistico`) — Engine completo (frete próprio/terceiro/descarga)
- [x] Usuários (`/usuarios`) — Criação, listagem, gestão de roles (diretoria only)

### Fase 4 — Componentes Compartilhados ✅

- [x] `DataTable` (search, sort, pagination, row click, CSV export)
- [x] `KpiCard`, `Dialog`, `StatusBadge` (Pedido/Faturado/Entregue/Cancelado/Venda/Bonificacao)
- [x] `RefreshIndicator`, `LoadingSkeleton` (Kpi, Chart, Table)
- [x] `ErrorBoundary` + `lazyRetry`
- [x] CSV export (semicolon sep, UTF-8 BOM) — wired em comercial, logística, devoluções
- [x] `printContent()` utility — "Imprimir" em PedidoDetalheDialog

### Fase 5 — Custo Logístico ✅

- [x] Tabelas `logistics_costs`, `delivery_routes`, `app_settings`
- [x] Edge Function `route-calc` (Google Maps → frete próprio)
- [x] NF fornecedor (OPCH) como frete terceiro
- [x] Registro manual de descarga
- [x] Configurações (custo/km, endereço armazém) — diretoria only

### Fase 6 — Deploy e Estabilização ✅

- [x] Vercel deploy com SPA rewrites
- [x] Auth deadlock resolvido (fetch direto com access token)
- [x] verify_jwt=false em todas as Edge Functions (gateway JWT broken)
- [x] 5 Edge Functions: sap-query v5, sap-sync v5, create-user v3, manage-users v2, route-calc v3

### Fase 7 — Enhanced Features ✅

- [x] P1: Cancellation filtering (`CANCELED <> 'C'`) em todas as queries SAP
- [x] P2: Unified comercial (3 CTEs ORDR+OINV+ODLN, vendedor OSLP, UF CRD1, multi-recordset detail)
- [x] P3: CSV export utility + DataTable onExport
- [x] P4: Pie chart real (sap_cache_entregas)
- [x] P5: Print utility + botão no PedidoDetalheDialog
- [x] P6: manage-users Edge Function + página de usuários com DataTable + role management

### Fase 8A — Dashboard Completo (Semanas 1–4) ✅

> **Meta:** Dashboard de ~30 KPIs cobrindo finanças, estoque, produção e compras. Tudo do SAP.

#### Semana 1: Date Filters + Dados Financeiros

- [x] Componente `DateRangePicker` reutilizável
- [x] Filtros de data no Dashboard e todas as páginas
- [x] Novas queries SAP financeiras:
  - [x] `cr_aging` — Contas a Receber por faixa (a vencer, 1-30, 31-60, 61-90, >90 dias)
  - [x] `cp_aging` — Contas a Pagar por faixa
  - [x] `cashflow_projection` — Parcelas futuras CR (INV6) + CP (PCH6)
  - [x] `margem_mensal` — GrssProfit/DocTotal de OINV por mês
  - [x] `vendas_por_canal` — Faturamento por GroupCode do OCRD
  - [x] `top_clientes` — Top 20 clientes YTD
  - [x] `ciclo_caixa` — PMR + PME - PMP
- [x] Migration: `sap_cache_financeiro`
- [x] Extend `sap-sync` com bloco financeiro
- [x] Dashboard seção "Financeiro": aging charts, margem, fluxo de caixa

#### Semana 2–3: Estoque + Produção + Compras

- [x] Queries estoque: `estoque_por_deposito`, `estoque_valorizacao`, `estoque_abaixo_minimo`, `estoque_giro`
- [x] Queries produção: `producao_ordens`, `producao_consumo_mp`, `producao_planejado_vs_real`
- [x] Queries compras: `compras_abertas`, `compras_mes`, `compras_lead_time`
- [x] Migrations: `sap_cache_estoque`, `sap_cache_producao`, `sap_cache_compras`
- [x] Extend `sap-sync` com 3 novos blocos
- [x] Dashboard seções: "Estoque", "Produção", "Compras"

#### Semana 3–4: Dashboard v2 Layout

- [x] Reorganizar dashboard em seções visuais
- [x] Novos gráficos: margem trend (line), aging breakdown (stacked bar), estoque por grupo (bar)
- [x] Metas vs realizado (metas via `app_settings`)
- [x] Exportação do dashboard (implementado como **CSV**, não PDF/Excel)

### Fase 8B — Dashboard Overhaul (Tabs + Filtros + Sparklines) ✅

> **Meta:** Reestruturar dashboard monolítico em componentes por área com filtros de período, comparação temporal e sparklines inline.

- [x] Dashboard reestruturado: orchestrator fino (~50 linhas) + 7 area components
- [x] 7 abas filtradas por role: Geral, Comercial, Financeiro, Produção, Logística, Estoque, Compras
- [x] `DashboardHeader` com date inputs, presets de período (Este mês, Trimestre, YTD, Últimos 12m/24m), comparison dropdown, CSV, refresh
- [x] `AreaTabs` — tabs filtrados por role (diretoria vê tudo, comercial vê Geral+Comercial, etc.)
- [x] `useDashboardFilters` hook — state management com sessionStorage persistence
- [x] Filtro de período aplicado a todas as áreas (exceto Estoque — snapshot)
- [x] Comparação temporal: vs período anterior / vs mesmo período ano passado
- [x] SVG sparklines inline nos KPI cards (sem dependência Recharts)
- [x] Trend indicators (▲/▼ com % de variação) nos KPIs filtrados
- [x] Nova query `dashboard_kpis_mensal` — breakdown mensal pedidos/faturamento/devoluções/entregas (UNION ALL, 24mo)
- [x] Nova cache table `sap_cache_dashboard_kpis_mensal`
- [x] Queries SAP expandidas: janelas de 24 meses, removidos TOP artificiais em dados transacionais
- [x] Edge Functions atualizadas: sap-query v5, sap-sync v5 (24 sync blocks)
- [x] **Comercial revamp:** removidos pie/line charts → 2 bar charts (fat/ped/ent mensal + status stacked) + tabela por canal; "Ticket Médio" → "Vlr Médio/Und"

---

## Módulo Logístico Expandido — `/logistica` (6 tabs)

> **Meta:** Cobrir ciclo completo: do pedido ao fechamento do custo logístico. Prioridade #1 do roadmap.

### Sprint 1 — Infraestrutura + Programação de Pedidos ✅

- [x] Migration 00025: 8 tabelas (vehicles, drivers, logistics_operators, item_packaging, shipments, shipment_items, return_requests, shipment_tracking_events), 2 enums, RLS, storage buckets, auto-reference triggers
- [x] Migration 00026: total_weight_kg + total_volume_m3 em sap_cache_pedidos
- [x] Constants file: `src/lib/logistics-constants.ts` (tipos veículo, capacidades, status labels/cores)
- [x] Tipos TS: 8 tabelas em `src/types/database.ts`
- [x] SAP sync estendido: peso/volume via OITM.SWeight1/SVolume em todas 4 CTEs do pedidos
- [x] Tab shell logístico: `logistics-tabs.tsx` com 6 tabs
- [x] Cadastros CRUD: veículos, motoristas, operadores, paletização (`cadastros-logistica.tsx`)
- [x] Tab 1 - Programação de Pedidos: calendário visual (semana/mês), seleção de pedidos com filtros, capacity gauge (peso/paletes), criação de cargas 2-step
- [x] Bug fixes: checkbox double-toggle, select-all respeita filtros, staleTime 5min, calendário semana/mês toggle
- [x] Volume (m³) removido de toda UI (colunas DB mantidas)
- [x] Deploy: commit `85c7b51` → Vercel

### Sprint 2 — Melhorias na Programação de Pedidos ✅

- [x] **Fase A — Pallets decimal:** Migration 00030 (numeric(10,1)), CEILING→ROUND(1) em 4 queries SAP, formatação 1 decimal em toda UI
- [x] **Fase B — Tabela SKU semanal:** RPC `get_weekly_sku_totals` (shipment_items→shipments→pedido_linhas), hook `useWeeklySkuTotals`, componente `SkuWeeklyTable` com colunas Seg-Dom, highlight do dia atual, totais no rodapé
- [x] **Fase B+ — Agrupamento por produto:** Migration 00032 (grupo_expedicao via ILIKE: SARDINHA 125g, ATUM 140g, ATUM 400g, OUTROS), headers coloridos por grupo, subtotais por grupo, total geral
- [x] **Fase C — Calendário:** Botão "Hoje", cells ricos com pills de status + placa, resumo semanal (cargas/peso/pallets/valor), semana começa segunda-feira (weekStartsOn: 1)
- [x] **Fase D — Filtros/Ordenação:** Sort dropdown (6 opções), age dots (verde/amarelo/vermelho), chips UF rápidos, filtro maxAgeDays (default 30d), exclusão de pedidos estornados/cancelados
- [x] **Fase E — Dialogs:** Capacity warning banners (>90% amarelo, >100% vermelho), destination summary badges, vehicle conflict warning, valid status transitions, campo `origem` no insert de shipment_items

### Sprint 3 — Romaneio + Descarrego (próximo)

- [ ] Tab 2 - Romaneio de Saída
  - [ ] Lista de cargas `programada`
  - [ ] Checklist de conferência por item (marca como verificado, registra lote)
  - [ ] Foto obrigatória do carregamento (camera do tablet) → Storage `shipment-photos`
  - [ ] Foto obrigatória do caminhão (placa visível)
  - [ ] Status `programada` → `expedida` (só libera com fotos)
  - [ ] Impressão de romaneio via `printContent()`
  - [ ] Interface tablet-friendly (botões 44px+, checklist visual)
- [ ] Tab 4 - Descarrego (Confirmação de Entrega)
  - [ ] Foto de canhoto assinado → Storage `delivery-proofs`
  - [ ] Vinculação CTE do operador logístico
  - [ ] Registro de custo de descarrego
  - [ ] Para 2 pernas: marca entrega ao operador + prazo esperado
  - [ ] Todas NFs entregues → status `entregue`
- [ ] Tab 3 - Acompanhamento de Entrega
  - [ ] Board de status por carga (manual)
  - [ ] Cards com veículo, motorista, destinos, % entregue
  - [ ] Formulário de registro de eventos (saída, chegada, entrega, problema)
  - [ ] Mobile-friendly

### Sprint 4 — Devoluções + Custo + Cutover

- [ ] Tab 5 - Devoluções (migrar `/devolucoes` + workflow)
  - [ ] Kanban por status (solicitada → em_aprovacao → aprovada → nf_emitida → retornada/descartada → fechada)
  - [ ] Formulário de solicitação (motorista ou cliente)
  - [ ] Workflow de aprovação
  - [ ] DataTable com histórico (manter funcionalidade atual)
- [ ] Tab 6 - Custo Logístico por NF (migrar `/custo-logistico` + rateio)
  - [ ] Cálculo: Frete Próprio + CTE Operador (rateio por peso) + Descarrego
  - [ ] KPI: Custo por Caixa Entregue
  - [ ] Reutiliza Edge Function `route-calc`
- [ ] Cutover: remover rotas `/devolucoes` e `/custo-logistico`, atualizar sidebar

---

## Módulo Comercial Expandido — `/comercial` (5 tabs)

> **Meta:** Análise comercial completa: gestão de pedidos, análises IA, verbas, trade marketing, DRE por margem de contribuição.

### Sprint 4 — Shell + Verbas + Análises

- [ ] Migration: commercial_budgets, commercial_credits, ai_usage_log
- [ ] Tab shell comercial (orchestrator com 5 tabs)
- [ ] Tab 1 - Gestão de Pedidos (migrar conteúdo atual, zero mudança funcional)
- [ ] Tab 3 - Verbas Comerciais (1% faturamento, 3 tipos de verba, workflow aprovação)
- [ ] Tab 2 - Análises Comerciais + Edge Function `commercial-ai-analysis` (Claude Sonnet, so diretoria)

### Sprint 5 — DRE + Trade Marketing

- [ ] Migrations: sap_cache_dre_comercial, trade_visits, trade_costs, trade_indicators
- [ ] Investigar campos SAP para DRE (VatSum, GrosProfit, CommisionSum)
- [ ] Novas queries SAP DRE + sync blocks
- [ ] Tab 5 - DRE Comercial (margem de contribuição, detalhamento por dimensão)
- [ ] Tab 4 - Trade Marketing (DGMP: Distribuição, Gôndola, Merchandising, Ponto Extra)

---

## Roadmap Ativo

### Fase 8C — Gestão do Dia a Dia (Semanas 5–8)

> **Meta:** Tarefas, agenda e alertas — o workflow diário que Eduardo descreveu como ideal.

#### Semana 5–6: Módulo de Tarefas

- [ ] Migration: `tasks`, `task_comments`, `task_attachments`
- [ ] Kanban board (A fazer, Em andamento, Concluído, Bloqueado)
- [ ] CRUD: título, responsável, prioridade, prazo, área
- [ ] Visão "Meu dia" (tarefas do usuário logado)
- [ ] Fluxo de aprovação simples (tipo 'aprovação')
- [ ] Badge de notificação no sidebar
- [ ] Página `/tarefas`

#### Semana 6–7: Agenda + Atas

- [ ] Migration: `meetings`, `meeting_items`, `meeting_actions`
- [ ] Calendário semanal (manual inicialmente)
- [ ] Atas com participantes, itens, decisões
- [ ] Itens de ação → criam tarefas automaticamente
- [ ] Export de ata em PDF
- [ ] Página `/agenda`

#### Semana 7–8: Alertas + Notificações

- [ ] Migration: `alerts`, `alert_rules`, `user_notifications`
- [ ] Engine de regras: estoque baixo, CP vencendo, OP atrasada
- [ ] Badge de notificação no sidebar
- [ ] Seção de alertas no dashboard
- [ ] Configuração de regras pelo admin

#### Semana 8: Roles Expandidos

- [ ] Listagem/edição de usuários (melhoria sobre P6)
- [ ] Novos roles: `producao`, `qualidade`, `manutencao`, `compras`
- [ ] Audit log básico

---

### Fase 8D — Importações (Semanas 9–12)

> **Meta:** Substituir a planilha Excel manual e pastas SharePoint por um módulo completo de gestão de importações. Tracking automatizado de containers, OCR de documentos, controle de custos e integração SAP — do pedido de compra à NF de entrada.
>
> **Contexto regulatório:** DUIMP tornou-se obrigatório para importações marítimas desde Jan/2026. A plataforma deve ser construída para DUIMP (não DI).
>
> **Pode rodar em paralelo com Fase 9** via git worktrees — arquivos completamente diferentes, sem conflitos.
>
> **Dependências de fases anteriores:**
> - Fase 8A: DateRangePicker component, padrões de filtro de data
> - Fase 8C: Alerts Engine (alertas de free time), role `importacao` no enum user_roles

#### Semana 9: Core Module + Database

- [ ] Migration `import_tables.sql` com 6 novas tabelas:
  - `import_processes` — tabela principal de tracking (substitui planilha Excel)
  - `import_items` — produtos por processo (NCM, quantidade, preço)
  - `import_costs` — custos detalhados (frete, impostos, taxas, demurrage)
  - `import_documents` — arquivos anexados com dados extraídos por OCR
  - `import_tracking_events` — eventos de tracking de container da API
  - `import_timeline` — log de mudanças de status
  - RLS: read para `importacao`, `financeiro`, `diretoria`; write para `importacao`, `diretoria`
- [ ] Nova página: `/importacao` — lista de todos os processos com filtros
  - Visão pipeline/kanban por status
  - Visão tabela com busca, ordenação, status badges
  - KPI resumo: processos ativos, containers em trânsito, alertas de free time
  - DateRangePicker (reutilizar da Fase 8A)
- [ ] Nova página: `/importacao/novo` — criar novo processo de importação
  - Seleção de fornecedor (SAP OCRD via sap-query)
  - Produtos, incoterm, moeda, valores
  - Status: negociação
- [ ] Nova página: `/importacao/:id` — detalhe do processo
  - Header: número do processo, fornecedor, status badge, container, navio
  - Timeline visual (etapas horizontais mostrando posição atual)
  - Tabs: Dados | Documentos | Custos | Tracking | Histórico
- [ ] Item no sidebar: "Importações" com ícone Ship (Lucide)
- [ ] Fluxo de status: negociacao → pedido_emitido → ncm_definida → docs_recebidos → li_obtida → frete_contratado → em_transito → chegou_porto → duimp_registrada → parametrizada → desembaracada → nf_emitida → recebido_fabrica → container_devolvido → fechado

#### Semana 10: Documentos + OCR + Custos

- [ ] Upload de documentos com drag-and-drop (Supabase Storage)
  - Tipos: invoice, packing_list, bl, cert_origin, li, duimp, nf_importacao, comprovante
  - Preview inline (visualizador PDF/imagem)
- [ ] Edge Function `import-ocr`:
  - Recebe PDF uploaded (base64), chama Claude API (Sonnet 4.5)
  - Retorna: fornecedor, número da invoice, valores, quantidades, pesos, container, navio
  - Usuário confirma/corrige antes de salvar
  - Dados extraídos armazenados em `import_documents.extracted_data` (JSONB)
- [ ] Tab de gestão de custos:
  - Tipos de custo pré-definidos: frete_internacional, seguro, ii, ipi, pis, cofins, icms, taxa_siscomex, armazenagem, capatazia, frete_interno, despachante, demurrage, outros
  - Para cada: valor planejado, valor real, moeda, taxa de câmbio, status de pagamento
  - Auto-soma totais: planejado vs real (desvio %)
  - Upload de comprovante de pagamento por item de custo
- [ ] Calculadora de free time:
  - `free_time_end = arrival_date + free_time_days`
  - Badge de contagem regressiva no card do processo
  - Alerta 5 dias antes do vencimento (integra com Alerts Engine da Fase 8C)
  - Custo de demurrage auto-adicionado se `container_return_date > free_time_end`

#### Semana 11: API de Tracking de Container

- [ ] Edge Function `import-tracking`:
  - Integra com JSONCargo API (ou agregador multi-carrier similar)
  - Input: número do container
  - Output: status, localização, ETA, ETD, navio, viagem, eventos portuários
  - Cobertura: MSC, Maersk, CMA CGM, Hapag-Lloyd, ONE
- [ ] pg_cron job: poll a cada 6 horas para processos ativos
  - Salva eventos em `import_tracking_events`
  - Auto-atualiza ETA em `import_processes`
  - Auto-transição: em_transito → chegou_porto quando chegada detectada
- [ ] UI de tracking na página de detalhe do processo:
  - Timeline visual com eventos de tracking (ícones de navio, porto, datas)
  - ETA atual em destaque
  - Entrada manual de eventos como fallback
- [ ] Integração com dashboard:
  - KPI: "Containers em Trânsito" (contagem)
  - KPI: "Chegadas Próximos 7 Dias" (lista)
  - KPI: "Free Time Expirando" (contagem de alertas)
- [ ] Supabase secret: `JSONCARGO_API_KEY`

#### Semana 12: Integração SAP + Fechamento

- [ ] Queries SAP para importações:
  - `import_purchase_orders` — OPOR para fornecedores estrangeiros
  - `import_ap_invoices` — OPCH para fornecedores de importação
  - `import_landed_costs` — registros de landed cost
- [ ] Criação de Pedido de Compra no SAP a partir do processo:
  - Mapeia: supplier → CardCode, items → ItemCode, moeda estrangeira
  - Armazena `sap_po_doc_entry` no processo
- [ ] Assistência para NF de importação:
  - Pré-preenche dados do processo para Vitória confirmar no SAP
  - Após NF: armazena `sap_nf_doc_entry`, transiciona status
- [ ] Reconciliação de Landed Cost: custos da plataforma vs entradas SAP
- [ ] Checklist de fechamento do processo:
  - Todos os documentos uploaded?
  - Todos os custos registrados?
  - PO no SAP fechada?
  - Container devolvido?
  - Desvio % calculado
- [ ] Analytics históricos:
  - Custo médio por container por rota/carrier
  - Lead time médio por carrier
  - Sugestão de NCM baseada em importações anteriores do mesmo produto

#### Futuro (pós Fase 8D): Integrações Avançadas de Importação

Fora do escopo da Fase 8D, planejado para Fase 11:

- [ ] Microsoft Graph API — auto-detecção de emails de fornecedores/agentes
- [ ] Portal Único DUIMP API — consultas diretas de status (requer certificado ICP-Brasil)
- [ ] Portal Único LPCO API — tracking de licenças
- [ ] BCB PTAX API — taxa de câmbio automática
- [ ] Mapa de posição de navios (widget MarineTraffic)

---

### Fase 9 — Chão de Fábrica Digital (Semanas 9–16)

> **Meta:** Produção, qualidade e estoque digitais. Mobile-first com offline.

#### Prep (Semana 8): PWA

- [ ] Service worker no Vite build
- [ ] Modo offline para formulários
- [ ] Estratégia de sync: queue local, push quando online

#### Semana 9–11: Produção (MES Leve) v1

- [ ] Migration: `production_records`, `production_lots`, `production_stops`
- [ ] Formulário mobile: linha, turno, produto, quantidade, lote MP/PA
- [ ] Paradas com motivo
- [ ] Rastreabilidade: lote PA ↔ lotes MP
- [ ] Dashboard produção: realizado vs meta por linha/turno
- [ ] Integração SAP: puxa OP do OWOR
- [ ] Offline via service worker
- [ ] Página `/producao` (roles: `producao`, `diretoria`)

#### Semana 12–13: Qualidade Digital v1

- [ ] Migration: `qa_records`, `qa_templates`, `qa_nonconformities`
- [ ] Templates por etapa (recebimento, processo, PA)
- [ ] Registro autoclave: temp, pressão, tempo, lote
- [ ] Inspeção seaming: parâmetros por lata
- [ ] Não-conformidades com workflow
- [ ] Laudos por lote (PDF para PNAE/SIF)
- [ ] Página `/qualidade` (roles: `qualidade`, `producao`, `diretoria`)

#### Semana 14–16: Estoque Inteligente v1

- [ ] Migration: `inventory_counts`, `inventory_alerts`
- [ ] Dashboard de estoque real-time
- [ ] FEFO com alertas de validade
- [ ] Inventário cíclico: gera contagens, registro mobile
- [ ] Reconciliação com SAP (contagem vs OITW)
- [ ] Dashboard v3 com KPIs de estoque reais

---

### Fase 10 — Comercial e Financeiro (Semanas 17–24)

#### Semana 17–19: Logística v2

- [ ] Checklist digital de expedição, status de entregas, fluxo de devoluções

#### Semana 18–20: Comercial Expandido

- [ ] Carteira de clientes, metas vs realizado, pipeline de contratos, controle PNAE

#### Semana 20–21: Toll Processing (Serviço)

- [ ] Fluxo: receber MP cliente → processar → devolver PA → faturar

#### Semana 22–24: Financeiro Avançado

- [ ] DRE por linha, custo real por lote, margem por canal, fluxo integrado

---

### Fase 11 — Otimização (Meses 7–12)

- [ ] Compras / PCP (sugestão de compra, importações, scorecard fornecedores)
- [ ] Manutenção (cadastro equipamentos, preventiva, OS mobile)
- [ ] IoT (gateway Rockwell → Supabase, sensores câmaras, autoclave contínuo)
- [ ] AI Agents (assistente operacional, resumo diário, alertas proativos)

---

## Banco de Dados

### Tabelas Existentes (36)

| Tabela | Tipo | Status |
|--------|------|--------|
| `profiles` | Auth | ✅ |
| `user_roles` | Auth | ✅ |
| `sap_cache_dashboard_kpis` | Cache | ✅ |
| `sap_cache_faturamento_mensal` | Cache | ✅ |
| `sap_cache_pedidos` | Cache | ✅ (expandida em P2) |
| `sap_cache_entregas` | Cache | ✅ |
| `sap_cache_devolucoes` | Cache | ✅ |
| `sap_cache_custo_logistico` | Cache | ✅ |
| `sap_cache_financeiro_aging` | Cache | ✅ (8A) |
| `sap_cache_financeiro_margem` | Cache | ✅ (8A) |
| `sap_cache_financeiro_cashflow` | Cache | ✅ (8A) |
| `sap_cache_financeiro_canal` | Cache | ✅ (8A) |
| `sap_cache_financeiro_top_clientes` | Cache | ✅ (8A) |
| `sap_cache_financeiro_ciclo` | Cache | ✅ (8A) |
| `sap_cache_estoque_deposito` | Cache | ✅ (8A) |
| `sap_cache_estoque_valorizacao` | Cache | ✅ (8A) |
| `sap_cache_estoque_abaixo_minimo` | Cache | ✅ (8A) |
| `sap_cache_estoque_giro` | Cache | ✅ (8A) |
| `sap_cache_producao_ordens` | Cache | ✅ (8A) |
| `sap_cache_producao_consumo_mp` | Cache | ✅ (8A) |
| `sap_cache_producao_planejado_vs_real` | Cache | ✅ (8A) |
| `sap_cache_compras_abertas` | Cache | ✅ (8A) |
| `sap_cache_compras_mes` | Cache | ✅ (8A) |
| `sap_cache_compras_lead_time` | Cache | ✅ (8A) |
| `sap_cache_dashboard_kpis_mensal` | Cache | ✅ (8B) |
| `logistics_costs` | Negócio | ✅ |
| `delivery_routes` | Negócio | ✅ |
| `app_settings` | Config | ✅ |
| `vehicles` | Logística | ✅ (Sprint 1) |
| `drivers` | Logística | ✅ (Sprint 1) |
| `logistics_operators` | Logística | ✅ (Sprint 1) |
| `item_packaging` | Logística | ✅ (Sprint 1) |
| `shipments` | Logística | ✅ (Sprint 1) |
| `shipment_items` | Logística | ✅ (Sprint 1) |
| `return_requests` | Logística | ✅ (Sprint 1) |
| `shipment_tracking_events` | Logística | ✅ (Sprint 1) |
| `sap_cache_pedido_linhas` | Cache | ✅ |
| `sap_cache_comercial_grupo_sku` | Cache | ✅ |

### Próximas (Fase 8C): `tasks`, `task_comments`, `task_attachments`, `meetings`, `meeting_items`, `meeting_actions`, `alerts`, `alert_rules`, `user_notifications`

### Próximas (Fase 8D): `import_processes`, `import_items`, `import_costs`, `import_documents`, `import_tracking_events`, `import_timeline`

### Próximas (Comercial): `commercial_budgets`, `commercial_credits`, `ai_usage_log`, `sap_cache_dre_comercial`, `trade_visits`, `trade_costs`, `trade_indicators`

---

## SAP Query Registry

### Existentes

Dashboard: `dashboard_kpis`, `faturamento_mensal`
Comercial: `pedidos` (unified 3 CTEs), `pedido_detalhe_pv`, `pedido_detalhe_nf`, `pedido_detalhe_en`
Logística: `entregas`, `entrega_linhas`
Devoluções: `devolucoes_returns`, `devolucoes_credit_memos`, `devolucao_linhas`
Fornecedores: `fornecedor_notas`
Endereços: `customer_address`, `delivery_addresses`

### Adicionadas na Fase 8A (17 queries) ✅

**Financeiro:** `cr_aging`, `cp_aging`, `cashflow_projection`, `margem_mensal`, `vendas_por_canal`, `top_clientes`, `ciclo_caixa`

**Estoque:** `estoque_por_deposito`, `estoque_valorizacao`, `estoque_abaixo_minimo`, `estoque_giro`

**Produção:** `producao_ordens`, `producao_consumo_mp`, `producao_planejado_vs_real`

**Compras:** `compras_abertas`, `compras_mes`, `compras_lead_time`

### Adicionada na Fase 8B (1 query) ✅

**Dashboard:** `dashboard_kpis_mensal` — breakdown mensal de pedidos/faturamento/devoluções/entregas (UNION ALL, 24 meses)

### Planejadas na Fase 8D (3 queries)

**Importação:** `import_purchase_orders`, `import_ap_invoices`, `import_landed_costs`

### Planejadas na Fase 8D — Edge Functions (2)

| Function | Protection | Purpose |
|----------|-----------|---------|
| `import-tracking` | Service role key (pg_cron) | Container tracking via JSONCargo API |
| `import-ocr` | JWT | Document OCR via Claude API |

### Planejada na Fase 8D — Role

| Role | Pages |
|------|-------|
| `importacao` | Dashboard, Importações |

> **Nota:** `diretoria` tem acesso total incluindo Importações. `financeiro` tem acesso de leitura à aba de custos.

### Parâmetros expandidos na Fase 8B

Queries com janelas expandidas para 24 meses e TOP limits removidos/aumentados:

| Query | Antes | Depois |
|-------|-------|--------|
| `entregas` | TOP 500 | 24-month date filter |
| `devolucoes_returns` | TOP 500 | 24-month date filter |
| `devolucoes_credit_memos` | TOP 500 | 24-month date filter |
| `fornecedor_notas` | TOP 100, 3mo | 12 months |
| `estoque_valorizacao` | TOP 20 | No limit |
| `estoque_abaixo_minimo` | TOP 50 | No limit |
| `estoque_giro` | TOP 30 | TOP 100 |
| `producao_consumo_mp` | TOP 20, 3mo | TOP 50, 12mo |
| `producao_ordens` | 3mo | 12mo |
| `producao_planejado_vs_real` | 6mo | 24mo |
| `compras_mes` | 12mo | 24mo |
| `compras_lead_time` | TOP 15, 6mo, HAVING>=3 | TOP 30, 12mo, HAVING>=2 |
| `faturamento_mensal` | 12mo | 24mo |
| `margem_mensal` | 12mo | 24mo |
| `pedidos` (3 CTEs) | 12mo | 24mo |
| `vendas_por_canal` | TOP 10 | No limit + mes column |
| `top_clientes` | TOP 20, YTD | TOP 50 + mes column, 24mo |
