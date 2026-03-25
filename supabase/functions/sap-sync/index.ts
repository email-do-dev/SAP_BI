import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/auth.ts";
import { getPool, querySap, resolveQuery } from "../_shared/sap-connection.ts";
import { createLogger } from "../_shared/logger.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof getServiceClient>;

/** Upsert rows in 500-row chunks, then delete stale rows not refreshed in this cycle. Returns { upserted, deleted } counts. */
async function upsertAndClean(
  supabase: SupabaseClient,
  table: string,
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
  onConflict: string,
  now: string,
): Promise<{ upserted: number; deleted: number }> {
  const batch = rows.map((r) => ({ ...r, refreshed_at: now }));
  for (let i = 0; i < batch.length; i += 500) {
    // deno-lint-ignore no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table) as any).upsert(batch.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`upsert ${table} batch ${i}: ${error.message}`);
  }
  // Remove rows not updated in this sync cycle (cancelled/deleted in SAP)
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deletedRows } = await (supabase.from(table) as any).delete().lt("refreshed_at", now).select();
  const deleted = deletedRows?.length ?? 0;
  return { upserted: rows.length, deleted };
}

/** Delete all + insert fresh for single-row tables with no unique index. */
async function replaceAll(
  supabase: SupabaseClient,
  table: string,
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>,
  now: string,
) {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from(table) as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from(table) as any).insert({ ...row, refreshed_at: now });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  // Verify CRON_SECRET — only pg_cron and authorized callers can trigger sync
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== cronSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or missing x-cron-secret header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const logger = createLogger("sap-sync", req);

  // Parse request body for triggered_by
  let body: { triggered_by?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    // No body or invalid JSON — default to pg_cron
  }
  logger.setBody(body);

  const supabase = getServiceClient();
  const logId = crypto.randomUUID();
  const triggeredBy = body?.triggered_by ?? "pg_cron";

  // Insert sync log (status = 'running')
  await supabase.from("sap_sync_log").insert({
    id: logId,
    triggered_by: triggeredBy,
  });

  // Cleanup logs older than 7 days
  await supabase
    .from("sap_sync_log")
    .delete()
    .lt("started_at", new Date(Date.now() - 7 * 86400000).toISOString());

  try {
    // Early SAP connection check — catch credential issues immediately
    try {
      await getPool();
    } catch (connErr) {
      const errMsg = connErr instanceof Error ? connErr.message : String(connErr);
      await supabase
        .from("sap_sync_log")
        .update({
          completed_at: new Date().toISOString(),
          status: "error",
          error_count: 1,
          errors: [{ step: "connection", message: errMsg }],
        })
        .eq("id", logId);
      return new Response(
        JSON.stringify({ status: "error", error: "SAP connection failed: " + errMsg }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date().toISOString();
    const errors: string[] = [];
    const synced: string[] = [];
    const tableDetails: { table: string; upserted: number; deleted: number; duration_ms: number; error?: string }[] = [];

    /** Helper: run a sync block with timing and table_details tracking. */
    async function syncBlock(table: string, fn: () => Promise<{ upserted: number; deleted: number }>) {
      const t0 = logger.startTimer();
      try {
        const result = await fn();
        tableDetails.push({ table, upserted: result.upserted, deleted: result.deleted, duration_ms: logger.elapsed(t0) });
        synced.push(table);
      } catch (e) {
        const dur = logger.elapsed(t0);
        tableDetails.push({ table, upserted: 0, deleted: 0, duration_ms: dur, error: String(e) });
        errors.push(`${table}: ${e}`);
      }
    }

    // 1. Sync Dashboard KPIs (single row, no unique index — replace)
    await syncBlock("dashboard_kpis", async () => {
      const [kpi] = await querySap<Record<string, unknown>>(resolveQuery("dashboard_kpis"));
      await replaceAll(supabase, "sap_cache_dashboard_kpis", kpi, now);
      return { upserted: 1, deleted: 0 };
    });

    // 2. Sync Monthly Revenue (upsert on mes)
    await syncBlock("faturamento_mensal", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("faturamento_mensal"));
      return await upsertAndClean(supabase, "sap_cache_faturamento_mensal", rows, "mes", now);
    });

    // 3. Sync Orders — unified PV + NF + EN (upsert on doc_entry,origem)
    await syncBlock("pedidos", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("pedidos"));
      return await upsertAndClean(supabase, "sap_cache_pedidos", rows, "doc_entry,origem", now);
    });

    // 4. Sync Deliveries (upsert on doc_entry)
    await syncBlock("entregas", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("entregas"));
      return await upsertAndClean(supabase, "sap_cache_entregas", rows, "doc_entry", now);
    });

    // 5. Sync Returns + Credit Memos (upsert on doc_entry,doc_type)
    await syncBlock("devolucoes", async () => {
      const returns = await querySap<Record<string, unknown>>(resolveQuery("devolucoes_returns"));
      const credits = await querySap<Record<string, unknown>>(resolveQuery("devolucoes_credit_memos"));
      const all = [...returns, ...credits];
      return await upsertAndClean(supabase, "sap_cache_devolucoes", all, "doc_entry,doc_type", now);
    });

    // 6. Sync Logistics Cost Summary (from Supabase logistics_costs table, upsert on mes)
    await syncBlock("custo_logistico", async () => {
      const { data: costs } = await supabase.from("logistics_costs").select("*");
      if (costs && costs.length > 0) {
        const monthly: Record<string, { frete_proprio: number; frete_terceiro: number; descarga: number }> = {};
        for (const c of costs) {
          const mes = c.created_at.substring(0, 7);
          if (!monthly[mes]) monthly[mes] = { frete_proprio: 0, frete_terceiro: 0, descarga: 0 };
          monthly[mes][c.cost_type as keyof typeof monthly[typeof mes]] += Number(c.amount);
        }
        const rows = Object.entries(monthly).map(([mes, v]) => ({
          mes,
          custo_total: v.frete_proprio + v.frete_terceiro + v.descarga,
          frete_proprio: v.frete_proprio,
          frete_terceiro: v.frete_terceiro,
          descarga: v.descarga,
        }));
        return await upsertAndClean(supabase, "sap_cache_custo_logistico", rows, "mes", now);
      }
      return { upserted: 0, deleted: 0 };
    });

    // 7. Sync Financeiro — CR Aging (upsert on tipo)
    await syncBlock("cr_aging", async () => {
      const [cr] = await querySap<Record<string, unknown>>(resolveQuery("cr_aging"));
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("sap_cache_financeiro_aging") as any)
        .upsert({ tipo: "CR", ...cr, refreshed_at: now }, { onConflict: "tipo" });
      return { upserted: 1, deleted: 0 };
    });

    // 8. Sync Financeiro — CP Aging (upsert on tipo)
    await syncBlock("cp_aging", async () => {
      const [cp] = await querySap<Record<string, unknown>>(resolveQuery("cp_aging"));
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("sap_cache_financeiro_aging") as any)
        .upsert({ tipo: "CP", ...cp, refreshed_at: now }, { onConflict: "tipo" });
      return { upserted: 1, deleted: 0 };
    });

    // 9. Sync Financeiro — Cashflow projection (upsert on due_date)
    await syncBlock("cashflow_projection", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("cashflow_projection"));
      return await upsertAndClean(supabase, "sap_cache_financeiro_cashflow", rows, "due_date", now);
    });

    // 10. Sync Financeiro — Margem mensal (upsert on mes)
    await syncBlock("margem_mensal", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("margem_mensal"));
      return await upsertAndClean(supabase, "sap_cache_financeiro_margem", rows, "mes", now);
    });

    // 11. Sync Financeiro — Vendas por canal (upsert on canal,mes)
    await syncBlock("vendas_por_canal", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("vendas_por_canal"));
      return await upsertAndClean(supabase, "sap_cache_financeiro_canal", rows, "canal,mes", now);
    });

    // 12. Sync Financeiro — Top clientes (upsert on card_code,mes)
    await syncBlock("top_clientes", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("top_clientes"));
      return await upsertAndClean(supabase, "sap_cache_financeiro_top_clientes", rows, "card_code,mes", now);
    });

    // 13. Sync Financeiro — Ciclo de caixa (single row, no unique index — replace)
    await syncBlock("ciclo_caixa", async () => {
      const [row] = await querySap<{ pmr: number; pme: number; pmp: number }>(resolveQuery("ciclo_caixa"));
      const ciclo = Number(row.pmr) + Number(row.pme) - Number(row.pmp);
      await replaceAll(supabase, "sap_cache_financeiro_ciclo", {
        pmr: row.pmr,
        pme: row.pme,
        pmp: row.pmp,
        ciclo,
      }, now);
      return { upserted: 1, deleted: 0 };
    });

    // 14. Sync Estoque — Por deposito (upsert on deposito)
    await syncBlock("estoque_por_deposito", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_por_deposito"));
      return await upsertAndClean(supabase, "sap_cache_estoque_deposito", rows, "deposito", now);
    });

    // 15. Sync Estoque — Valorizacao por grupo (upsert on grupo)
    await syncBlock("estoque_valorizacao", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_valorizacao"));
      return await upsertAndClean(supabase, "sap_cache_estoque_valorizacao", rows, "grupo", now);
    });

    // 16. Sync Estoque — Abaixo do minimo (upsert on item_code)
    await syncBlock("estoque_abaixo_minimo", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_abaixo_minimo"));
      return await upsertAndClean(supabase, "sap_cache_estoque_abaixo_minimo", rows, "item_code", now);
    });

    // 17. Sync Estoque — Giro (upsert on item_code)
    await syncBlock("estoque_giro", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_giro"));
      return await upsertAndClean(supabase, "sap_cache_estoque_giro", rows, "item_code", now);
    });

    // 18. Sync Producao — Ordens (upsert on status)
    await syncBlock("producao_ordens", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_ordens"));
      return await upsertAndClean(supabase, "sap_cache_producao_ordens", rows, "status", now);
    });

    // 19. Sync Producao — Consumo MP (upsert on item_code)
    await syncBlock("producao_consumo_mp", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_consumo_mp"));
      return await upsertAndClean(supabase, "sap_cache_producao_consumo_mp", rows, "item_code", now);
    });

    // 20. Sync Producao — Planejado vs Real (upsert on mes)
    await syncBlock("producao_planejado_vs_real", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_planejado_vs_real"));
      return await upsertAndClean(supabase, "sap_cache_producao_planejado_vs_real", rows, "mes", now);
    });

    // 21. Sync Compras — Abertas (single row, no unique index — replace)
    await syncBlock("compras_abertas", async () => {
      const [row] = await querySap<Record<string, unknown>>(resolveQuery("compras_abertas"));
      await replaceAll(supabase, "sap_cache_compras_abertas", row, now);
      return { upserted: 1, deleted: 0 };
    });

    // 22. Sync Compras — Mensal (upsert on mes)
    await syncBlock("compras_mes", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("compras_mes"));
      return await upsertAndClean(supabase, "sap_cache_compras_mes", rows, "mes", now);
    });

    // 23. Sync Compras — Lead time (upsert on fornecedor)
    await syncBlock("compras_lead_time", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("compras_lead_time"));
      return await upsertAndClean(supabase, "sap_cache_compras_lead_time", rows, "fornecedor", now);
    });

    // 24. Sync Dashboard KPIs Mensal (upsert on mes,metric)
    await syncBlock("dashboard_kpis_mensal", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("dashboard_kpis_mensal"));
      return await upsertAndClean(supabase, "sap_cache_dashboard_kpis_mensal", rows, "mes,metric", now);
    });

    // 25. Sync Pedido Linhas — line items for PV/NF/EN (upsert on doc_entry,origem,line_num)
    await syncBlock("pedido_linhas", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("pedido_linhas_sync"));
      return await upsertAndClean(supabase, "sap_cache_pedido_linhas", rows, "doc_entry,origem,line_num", now);
    });

    // 26. Sync Item Packaging from OITM (upsert on item_code)
    await syncBlock("item_packaging", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("item_packaging"));
      return await upsertAndClean(supabase, "sap_cache_item_packaging", rows, "item_code", now);
    });

    // 27. Sync Comercial — Grupo SKU (upsert on mes,grupo_sku)
    await syncBlock("comercial_grupo_sku", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("comercial_grupo_sku"));
      return await upsertAndClean(supabase, "sap_cache_comercial_grupo_sku", rows, "mes,grupo_sku", now);
    });

    // 28. Sync Producao — Ordens Lista (upsert on doc_entry)
    await syncBlock("producao_ordens_lista", async () => {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_ordens_lista"));
      return await upsertAndClean(supabase, "sap_cache_producao_ordens_lista", rows, "doc_entry", now);
    });

    // Update sync log with final results (including table_details and duration_ms)
    const status = errors.length > 0 ? "partial" : "ok";
    await supabase
      .from("sap_sync_log")
      .update({
        completed_at: now,
        status,
        synced_count: synced.length,
        error_count: errors.length,
        duration_ms: logger.totalDuration(),
        table_details: tableDetails,
        errors: errors.map((e) => {
          const colonIdx = e.indexOf(":");
          return {
            step: colonIdx > 0 ? e.substring(0, colonIdx) : "unknown",
            message: e,
          };
        }),
      })
      .eq("id", logId);

    // Log to edge_function_logs
    await logger.save(supabase, {
      status: errors.length > 0 ? "error" : "ok",
      responseStatus: 200,
      metadata: {
        triggered_by: triggeredBy,
        synced_count: synced.length,
        error_count: errors.length,
        total_rows: tableDetails.reduce((sum, t) => sum + t.upserted, 0),
      },
    });

    return new Response(
      JSON.stringify({ status, synced, errors, synced_at: now }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("sap-sync error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal error";
    const errStack = err instanceof Error ? err.stack : undefined;

    // Update sync log on catastrophic failure
    await supabase
      .from("sap_sync_log")
      .update({
        completed_at: new Date().toISOString(),
        status: "error",
        error_count: 1,
        duration_ms: logger.totalDuration(),
        errors: [{ step: "fatal", message: errMsg }],
      })
      .eq("id", logId);

    // Log to edge_function_logs
    await logger.save(supabase, {
      status: "error",
      responseStatus: 500,
      errorMessage: errMsg,
      errorStack: errStack,
    });

    return new Response(
      JSON.stringify({ error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
