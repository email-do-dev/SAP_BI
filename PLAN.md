# PLAN.md — SAP BI Platform

## Visão Geral

Plataforma de gestão operacional integrada para a Mata Norte Alimentos Ltda. Iniciou como dashboard de BI para SAP Business One e está evoluindo para uma plataforma completa cobrindo produção, qualidade, estoque, logística, comercial e financeiro.

**Stack:** React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS v4 + Supabase Pro (Edge Functions + PostgreSQL)
**Deploy:** Frontend no Vercel, Backend no Supabase
**SAP:** Business One v10, SQL Server, on-premise

---

## Organização por Branch

| Branch | Responsável | Foco |
|--------|------------|------|
| `main` | Bruno / Andre | Produção. Só recebe merges de `develop` quando estável. |
| `develop` | Bruno / Andre | Sistema de Logs, páginas dedicadas, melhorias gerais. |
| `features` | Eduardo | Módulo Logístico (Sprint 3+), Módulo Comercial expandido. |

---

## 🔵 Branch `main` — Produção

Recebe merges de `develop` e `features` quando as funcionalidades estão estáveis e testadas. Nenhum desenvolvimento direto acontece aqui.

**Último estado:** Fases 1–8B completas + Logística Sprint 1–2 + Importações (Fase 8D).

---

## 🟢 Branch `develop` — Bruno / Andre

### Sistema de Logs e Observabilidade (Fase 2 do Roadmap)

> **Meta:** 5 camadas de logging com página unificada `/logs` (diretoria only).
> **E-mail:** Resend (domínio `matanorteltda.com.br` verificado, região sa-east-1). Remetente: `SAP BI <noreply@matanorteltda.com.br>`.

#### Etapa 1 — Database + Types + Email ✅ (2026-03-20)

- [x] Migration `00035_create_logging_system.sql` — 4 tabelas novas:
  - `audit_logs` — Quem fez o quê (login, CRUD, export, navegação)
  - `frontend_error_logs` — Erros JS/React em produção
  - `edge_function_logs` — Performance e erros das Edge Functions
  - `security_logs` — Login/logout, falhas, acessos negados
- [x] ALTER `sap_sync_log` — adicionar `duration_ms integer` e `table_details jsonb`
- [x] SQL functions: `count_old_logs(retention_days)` e `delete_old_logs(retention_days)`
- [x] Atualizar `src/types/database.ts` com tipos das 4 tabelas novas + campos extras no sap_sync_log
- [x] Migration aplicada no Supabase (tabelas já existem no banco)
- [x] Helper de email `supabase/functions/_shared/email.ts` — Resend API via fetch
- [x] Edge Function `log-cleanup` — deployed (v1), `verify_jwt: false`
  - `?action=preview&days=30` → conta logs antigos + envia email de aviso
  - `?action=delete&days=30` → deleta logs > 31 dias (1 dia de grace após notificação)
- [x] pg_cron configurado — 2 jobs:
  - `log-cleanup-preview` → `0 0 * * *` (00:00 UTC / 21:00 BRT)
  - `log-cleanup-delete` → `0 2 * * *` (02:00 UTC / 23:00 BRT)
- [x] Resend: DNS verificado, API Key gerada, secrets `RESEND_API_KEY` e `ALERT_EMAIL_TO` no Supabase
- [x] Commit `1fcd2ba` na branch `dev-1/logging-system`

> **Nota:** O secret `ALERT_EMAIL_TO` pode estar com formato inválido (erro 422 no teste). Verificar no dashboard do Supabase — deve ser `email@example.com` sem aspas ou espaços extras.

#### Etapa 2 — Edge Function Logger

- [ ] Criar `supabase/functions/_shared/logger.ts` — `createLogger(functionName, req)`
- [ ] Modificar `sap-sync` — timing por tabela, popular `table_details` e `duration_ms`
- [ ] Modificar `sap-query` — adicionar `createLogger`
- [ ] Modificar `manage-users` — adicionar `createLogger` + audit_log
- [ ] Modificar `create-user` — adicionar `createLogger`
- [ ] Deploy das 4 Edge Functions + `log-cleanup`

#### Etapa 3 — Frontend Hooks + Integrações

- [ ] Criar `src/hooks/use-activity-log.ts` — `logActivity(action, resource?, resourceId?, metadata?)`
- [ ] Criar `src/hooks/use-error-logger.ts` — `logError(errorType, message, extra?)`
- [ ] `auth-context.tsx` — log login/logout em `security_logs`
- [ ] `protected-route.tsx` — log `access_denied` em `security_logs`
- [ ] `main.tsx` — `window.onerror` + `onunhandledrejection` → `frontend_error_logs`
- [ ] `App.tsx` — ErrorBoundary + lazyRetry logging

#### Etapa 4 — Página `/logs`

- [ ] Criar `src/pages/logs.tsx` — 5 abas (Atividades, Erros, Sync, Edge Functions, Segurança)
- [ ] Componentes: `sync-detail-dialog.tsx`, `error-detail-dialog.tsx`, `log-kpis.tsx`
- [ ] Rota `/logs` com `requiredRoles={['diretoria']}`
- [ ] Item "Logs" no sidebar (ícone `ScrollText`)

### DANFE — Impressão de NFe no Comercial

> **Meta:** Permitir impressão do DANFE diretamente na página Comercial quando o pedido está com status Faturado.

#### Script de Sync (servidor SAP → Supabase Storage)

- [ ] Script (PowerShell ou Node) no servidor SAP que monitora a pasta de XMLs
- [ ] Upload automático para Supabase Storage (bucket `nfe-xml`)
- [ ] Padrão de arquivo: `chaveNFe.xml` (44 dígitos)
- [ ] Rodar como serviço do Windows ou Task Scheduler

#### Frontend

- [ ] Instalar `danfe-js` (ou lib equivalente para renderizar DANFE de XML)
- [ ] Vincular XML ao pedido via número da NF (`Serial` da OINV → `sap_cache_pedidos`)
- [ ] Botão "DANFE" no dialog de detalhe do pedido (visível apenas quando status = Faturado)
- [ ] Buscar XML no Supabase Storage → renderizar PDF → imprimir/download

### Páginas Dedicadas (Fase 3 do Roadmap)

- [ ] Página Financeiro (`/financeiro`)
- [ ] Página Estoque (`/estoque`)
- [ ] Página Compras (`/compras`)
- [ ] Relatórios/Exportações avançadas
- [ ] Notificações (estoque mínimo, pedidos atrasados)

### Evolução (Fase 4 do Roadmap)

- [ ] Testes automatizados (Vitest + Testing Library)
- [ ] PWA / Mobile (chão de fábrica)
- [ ] Integração com sensores (Rockwell)
- [ ] Dashboard de Qualidade

---

## 🟡 Branch `features` — Eduardo

### Módulo Logístico — Sprint 3: Romaneio + Descarrego

> **Meta:** Completar o ciclo logístico: conferência de saída, acompanhamento e confirmação de entrega.

#### Tab 2 — Romaneio de Saída

- [ ] Lista de cargas `programada`
- [ ] Checklist de conferência por item (marca como verificado, registra lote)
- [ ] Foto obrigatória do carregamento (camera do tablet) → Storage `shipment-photos`
- [ ] Foto obrigatória do caminhão (placa visível)
- [ ] Status `programada` → `expedida` (só libera com fotos)
- [ ] Impressão de romaneio via `printContent()`
- [ ] Interface tablet-friendly (botões 44px+, checklist visual)

#### Tab 3 — Acompanhamento de Entrega

- [ ] Board de status por carga (manual)
- [ ] Cards com veículo, motorista, destinos, % entregue
- [ ] Formulário de registro de eventos (saída, chegada, entrega, problema)
- [ ] Mobile-friendly

#### Tab 4 — Descarrego (Confirmação de Entrega)

- [ ] Foto de canhoto assinado → Storage `delivery-proofs`
- [ ] Vinculação CTE do operador logístico
- [ ] Registro de custo de descarrego
- [ ] Para 2 pernas: marca entrega ao operador + prazo esperado
- [ ] Todas NFs entregues → status `entregue`

### Módulo Logístico — Sprint 4: Devoluções + Custo + Cutover

#### Tab 5 — Devoluções (migrar `/devolucoes` + workflow)

- [ ] Kanban por status (solicitada → em_aprovacao → aprovada → nf_emitida → retornada/descartada → fechada)
- [ ] Formulário de solicitação (motorista ou cliente)
- [ ] Workflow de aprovação
- [ ] DataTable com histórico (manter funcionalidade atual)

#### Tab 6 — Custo Logístico por NF (migrar `/custo-logistico` + rateio)

- [ ] Cálculo: Frete Próprio + CTE Operador (rateio por peso) + Descarrego
- [ ] KPI: Custo por Caixa Entregue
- [ ] Reutiliza Edge Function `route-calc`

#### Cutover

- [ ] Remover rotas `/devolucoes` e `/custo-logistico`
- [ ] Atualizar sidebar

### Módulo Comercial Expandido — `/comercial` (5 tabs)

> **Meta:** Análise comercial completa: gestão de pedidos, análises IA, verbas, trade marketing, DRE.

#### Sprint 4 — Shell + Verbas + Análises

- [ ] Migration: commercial_budgets, commercial_credits, ai_usage_log
- [ ] Tab shell comercial (orchestrator com 5 tabs)
- [ ] Tab 1 - Gestão de Pedidos (migrar conteúdo atual, zero mudança funcional)
- [ ] Tab 3 - Verbas Comerciais (1% faturamento, 3 tipos de verba, workflow aprovação)
- [ ] Tab 2 - Análises Comerciais + Edge Function `commercial-ai-analysis` (Claude Sonnet, só diretoria)

#### Sprint 5 — DRE + Trade Marketing

- [ ] Migrations: sap_cache_dre_comercial, trade_visits, trade_costs, trade_indicators
- [ ] Investigar campos SAP para DRE (VatSum, GrosProfit, CommisionSum)
- [ ] Novas queries SAP DRE + sync blocks
- [ ] Tab 5 - DRE Comercial (margem de contribuição, detalhamento por dimensão)
- [ ] Tab 4 - Trade Marketing (DGMP: Distribuição, Gôndola, Merchandising, Ponto Extra)

---

## Backlog (sem branch definida)

### Fase 8C — Gestão do Dia a Dia

> **Meta:** Tarefas, agenda e alertas — o workflow diário.

#### Módulo de Tarefas

- [ ] Migration: `tasks`, `task_comments`, `task_attachments`
- [ ] Kanban board (A fazer, Em andamento, Concluído, Bloqueado)
- [ ] CRUD: título, responsável, prioridade, prazo, área
- [ ] Visão "Meu dia" (tarefas do usuário logado)
- [ ] Página `/tarefas`

#### Agenda + Atas

- [ ] Migration: `meetings`, `meeting_items`, `meeting_actions`
- [ ] Calendário semanal
- [ ] Atas com participantes, itens, decisões
- [ ] Itens de ação → criam tarefas automaticamente
- [ ] Página `/agenda`

#### Alertas + Notificações

- [ ] Migration: `alerts`, `alert_rules`, `user_notifications`
- [ ] Engine de regras: estoque baixo, CP vencendo, OP atrasada
- [ ] Badge de notificação no sidebar
- [ ] Configuração de regras pelo admin

#### Roles Expandidos

- [ ] Novos roles: `producao`, `qualidade`, `manutencao`, `compras`

### Fase 8D — Importações

> **Meta:** Substituir planilha Excel por módulo completo de importações com tracking de containers, OCR de documentos, controle de custos e integração SAP.

- [ ] 6 tabelas: import_processes, import_items, import_costs, import_documents, import_tracking_events, import_timeline
- [ ] Páginas: `/importacao`, `/importacao/novo`, `/importacao/:id`
- [ ] Edge Functions: `import-ocr` (Claude Sonnet), `import-tracking` (JSONCargo API)
- [ ] 15 status workflow: negociacao → ... → fechado
- [ ] Calculadora de free time + alertas
- [ ] Integração SAP: PO, NF, Landed Cost
- [ ] Role: `importacao`

### Fase 9 — Chão de Fábrica Digital

- [ ] PWA com offline
- [ ] Produção (MES leve): formulário mobile, lotes, paradas, rastreabilidade
- [ ] Qualidade: templates, autoclave, seaming, não-conformidades, laudos
- [ ] Estoque inteligente: FEFO, inventário cíclico, reconciliação SAP

### Fase 10 — Comercial e Financeiro Avançado

- [ ] Logística v2, Comercial expandido, Toll Processing, Financeiro avançado (DRE, margem, fluxo)

### Fase 11 — Otimização

- [ ] Compras / PCP, Manutenção, IoT (Rockwell), AI Agents

---

## Histórico Concluído

<details>
<summary>Fases 1–8B (clique para expandir)</summary>

### Fase 1 — Infraestrutura e Auth ✅

- [x] Scaffold (Vite + React + TS)
- [x] Supabase: projeto, env vars, client JS
- [x] Tabela `profiles` com trigger `on_auth_user_created`
- [x] Sistema de roles (`app_role` enum, `user_roles` table)
- [x] `AuthProvider` com `onAuthStateChange`
- [x] `ProtectedRoute`, `Sidebar` com filtro por role
- [x] Página de login

### Fase 2 — Cache Híbrido e Sync ✅

- [x] 6 tabelas de cache com RLS
- [x] Edge Function `sap-sync` + pg_cron a cada 10 min
- [x] Hooks `useCacheQuery` e `useSapQuery`

### Fase 3 — Páginas de Dados ✅

- [x] Dashboard, Comercial, Logística, Devoluções, Custo Logístico, Usuários

### Fase 4 — Componentes Compartilhados ✅

- [x] DataTable, KpiCard, Dialog, StatusBadge, RefreshIndicator, Skeletons, ErrorBoundary, CSV export, Print

### Fase 5 — Custo Logístico ✅

- [x] logistics_costs, delivery_routes, app_settings, route-calc Edge Function

### Fase 6 — Deploy e Estabilização ✅

- [x] Vercel, auth deadlock fix, verify_jwt=false

### Fase 7 — Enhanced Features ✅

- [x] Cancellation filtering, Unified comercial, CSV, Pie chart, Print, manage-users

### Fase 8A — Dashboard Completo ✅

- [x] ~30 KPIs: financeiro (aging, margem, cashflow, canal, top clientes, ciclo caixa), estoque, produção, compras
- [x] 17 novas queries SAP, 8 cache tables, sap-sync expandido

### Fase 8B — Dashboard Overhaul ✅

- [x] 7 abas por role, filtros de período, comparação temporal, sparklines, trend indicators
- [x] Comercial revamp: bar charts + tabela por canal

### Logística Sprint 1 — Infraestrutura + Programação ✅

- [x] 8 tabelas, cadastros CRUD, Tab Programação de Pedidos com calendário + capacity gauge

### Logística Sprint 2 — Melhorias na Programação ✅

- [x] Pallets decimal, tabela SKU semanal, agrupamento por produto, calendário melhorado, filtros/ordenação, dialogs

</details>

---

## Referência Técnica

### Banco de Dados — Tabelas Existentes (38)

| Tabela | Tipo | Status |
|--------|------|--------|
| `profiles` | Auth | ✅ |
| `user_roles` | Auth | ✅ |
| `sap_cache_dashboard_kpis` | Cache | ✅ |
| `sap_cache_dashboard_kpis_mensal` | Cache | ✅ |
| `sap_cache_faturamento_mensal` | Cache | ✅ |
| `sap_cache_pedidos` | Cache | ✅ |
| `sap_cache_pedido_linhas` | Cache | ✅ |
| `sap_cache_entregas` | Cache | ✅ |
| `sap_cache_devolucoes` | Cache | ✅ |
| `sap_cache_custo_logistico` | Cache | ✅ |
| `sap_cache_financeiro_aging` | Cache | ✅ |
| `sap_cache_financeiro_margem` | Cache | ✅ |
| `sap_cache_financeiro_cashflow` | Cache | ✅ |
| `sap_cache_financeiro_canal` | Cache | ✅ |
| `sap_cache_financeiro_top_clientes` | Cache | ✅ |
| `sap_cache_financeiro_ciclo` | Cache | ✅ |
| `sap_cache_estoque_deposito` | Cache | ✅ |
| `sap_cache_estoque_valorizacao` | Cache | ✅ |
| `sap_cache_estoque_abaixo_minimo` | Cache | ✅ |
| `sap_cache_estoque_giro` | Cache | ✅ |
| `sap_cache_producao_ordens` | Cache | ✅ |
| `sap_cache_producao_consumo_mp` | Cache | ✅ |
| `sap_cache_producao_planejado_vs_real` | Cache | ✅ |
| `sap_cache_compras_abertas` | Cache | ✅ |
| `sap_cache_compras_mes` | Cache | ✅ |
| `sap_cache_compras_lead_time` | Cache | ✅ |
| `sap_cache_comercial_grupo_sku` | Cache | ✅ |
| `logistics_costs` | Negócio | ✅ |
| `delivery_routes` | Negócio | ✅ |
| `app_settings` | Config | ✅ |
| `vehicles` | Logística | ✅ |
| `drivers` | Logística | ✅ |
| `logistics_operators` | Logística | ✅ |
| `item_packaging` | Logística | ✅ |
| `shipments` | Logística | ✅ |
| `shipment_items` | Logística | ✅ |
| `return_requests` | Logística | ✅ |
| `shipment_tracking_events` | Logística | ✅ |

### SAP Query Registry

**Existentes:** `dashboard_kpis`, `dashboard_kpis_mensal`, `faturamento_mensal`, `pedidos`, `pedido_detalhe_pv`, `pedido_detalhe_nf`, `pedido_detalhe_en`, `entregas`, `entrega_linhas`, `devolucoes_returns`, `devolucoes_credit_memos`, `devolucao_linhas`, `fornecedor_notas`, `customer_address`, `delivery_addresses`, `cr_aging`, `cp_aging`, `cashflow_projection`, `margem_mensal`, `vendas_por_canal`, `top_clientes`, `ciclo_caixa`, `estoque_por_deposito`, `estoque_valorizacao`, `estoque_abaixo_minimo`, `estoque_giro`, `producao_ordens`, `producao_consumo_mp`, `producao_planejado_vs_real`, `compras_abertas`, `compras_mes`, `compras_lead_time`

**Planejadas:** `import_purchase_orders`, `import_ap_invoices`, `import_landed_costs`
