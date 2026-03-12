import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/auth.ts";
import { getPool, querySap, resolveQuery } from "../_shared/sap-connection.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof getServiceClient>;

/** Upsert rows in 500-row chunks, then delete stale rows not refreshed in this cycle. */
async function upsertAndClean(
  supabase: SupabaseClient,
  table: string,
  // deno-lint-ignore no-explicit-any
  rows: Record<string, any>[],
  onConflict: string,
  now: string,
) {
  const batch = rows.map((r) => ({ ...r, refreshed_at: now }));
  for (let i = 0; i < batch.length; i += 500) {
    // deno-lint-ignore no-explicit-any
    const { error } = await (supabase.from(table) as any).upsert(batch.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`upsert ${table} batch ${i}: ${error.message}`);
  }
  // Remove rows not updated in this sync cycle (cancelled/deleted in SAP)
  // deno-lint-ignore no-explicit-any
  await (supabase.from(table) as any).delete().lt("refreshed_at", now);
}

/** Delete all + insert fresh for single-row tables with no unique index. */
async function replaceAll(
  supabase: SupabaseClient,
  table: string,
  // deno-lint-ignore no-explicit-any
  row: Record<string, any>,
  now: string,
) {
  // deno-lint-ignore no-explicit-any
  await (supabase.from(table) as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // deno-lint-ignore no-explicit-any
  await (supabase.from(table) as any).insert({ ...row, refreshed_at: now });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  // Parse request body for triggered_by
  let body: { triggered_by?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    // No body or invalid JSON — default to pg_cron
  }

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

    // 1. Sync Dashboard KPIs (single row, no unique index — replace)
    try {
      const [kpi] = await querySap<Record<string, unknown>>(resolveQuery("dashboard_kpis"));
      await replaceAll(supabase, "sap_cache_dashboard_kpis", kpi, now);
      synced.push("dashboard_kpis");
    } catch (e) {
      errors.push(`dashboard_kpis: ${e}`);
    }

    // 2. Sync Monthly Revenue (upsert on mes)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("faturamento_mensal"));
      await upsertAndClean(supabase, "sap_cache_faturamento_mensal", rows, "mes", now);
      synced.push("faturamento_mensal");
    } catch (e) {
      errors.push(`faturamento_mensal: ${e}`);
    }

    // 3. Sync Orders — unified PV + NF + EN (upsert on doc_entry,origem)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("pedidos"));
      await upsertAndClean(supabase, "sap_cache_pedidos", rows, "doc_entry,origem", now);
      synced.push("pedidos");
    } catch (e) {
      errors.push(`pedidos: ${e}`);
    }

    // 4. Sync Deliveries (upsert on doc_entry)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("entregas"));
      await upsertAndClean(supabase, "sap_cache_entregas", rows, "doc_entry", now);
      synced.push("entregas");
    } catch (e) {
      errors.push(`entregas: ${e}`);
    }

    // 5. Sync Returns + Credit Memos (upsert on doc_entry,doc_type)
    try {
      const returns = await querySap<Record<string, unknown>>(resolveQuery("devolucoes_returns"));
      const credits = await querySap<Record<string, unknown>>(resolveQuery("devolucoes_credit_memos"));
      const all = [...returns, ...credits];
      await upsertAndClean(supabase, "sap_cache_devolucoes", all, "doc_entry,doc_type", now);
      synced.push("devolucoes");
    } catch (e) {
      errors.push(`devolucoes: ${e}`);
    }

    // 6. Sync Logistics Cost Summary (from Supabase logistics_costs table, upsert on mes)
    try {
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
        await upsertAndClean(supabase, "sap_cache_custo_logistico", rows, "mes", now);
      }
      synced.push("custo_logistico");
    } catch (e) {
      errors.push(`custo_logistico: ${e}`);
    }

    // 7. Sync Financeiro — CR Aging (upsert on tipo)
    try {
      const [cr] = await querySap<Record<string, unknown>>(resolveQuery("cr_aging"));
      // deno-lint-ignore no-explicit-any
      await (supabase.from("sap_cache_financeiro_aging") as any)
        .upsert({ tipo: "CR", ...cr, refreshed_at: now }, { onConflict: "tipo" });
      synced.push("cr_aging");
    } catch (e) {
      errors.push(`cr_aging: ${e}`);
    }

    // 8. Sync Financeiro — CP Aging (upsert on tipo)
    try {
      const [cp] = await querySap<Record<string, unknown>>(resolveQuery("cp_aging"));
      // deno-lint-ignore no-explicit-any
      await (supabase.from("sap_cache_financeiro_aging") as any)
        .upsert({ tipo: "CP", ...cp, refreshed_at: now }, { onConflict: "tipo" });
      synced.push("cp_aging");
    } catch (e) {
      errors.push(`cp_aging: ${e}`);
    }

    // 9. Sync Financeiro — Cashflow projection (upsert on due_date)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("cashflow_projection"));
      await upsertAndClean(supabase, "sap_cache_financeiro_cashflow", rows, "due_date", now);
      synced.push("cashflow_projection");
    } catch (e) {
      errors.push(`cashflow_projection: ${e}`);
    }

    // 10. Sync Financeiro — Margem mensal (upsert on mes)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("margem_mensal"));
      await upsertAndClean(supabase, "sap_cache_financeiro_margem", rows, "mes", now);
      synced.push("margem_mensal");
    } catch (e) {
      errors.push(`margem_mensal: ${e}`);
    }

    // 11. Sync Financeiro — Vendas por canal (upsert on canal,mes)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("vendas_por_canal"));
      await upsertAndClean(supabase, "sap_cache_financeiro_canal", rows, "canal,mes", now);
      synced.push("vendas_por_canal");
    } catch (e) {
      errors.push(`vendas_por_canal: ${e}`);
    }

    // 12. Sync Financeiro — Top clientes (upsert on card_code,mes)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("top_clientes"));
      await upsertAndClean(supabase, "sap_cache_financeiro_top_clientes", rows, "card_code,mes", now);
      synced.push("top_clientes");
    } catch (e) {
      errors.push(`top_clientes: ${e}`);
    }

    // 13. Sync Financeiro — Ciclo de caixa (single row, no unique index — replace)
    try {
      const [row] = await querySap<{ pmr: number; pme: number; pmp: number }>(resolveQuery("ciclo_caixa"));
      const ciclo = Number(row.pmr) + Number(row.pme) - Number(row.pmp);
      await replaceAll(supabase, "sap_cache_financeiro_ciclo", {
        pmr: row.pmr,
        pme: row.pme,
        pmp: row.pmp,
        ciclo,
      }, now);
      synced.push("ciclo_caixa");
    } catch (e) {
      errors.push(`ciclo_caixa: ${e}`);
    }

    // 14. Sync Estoque — Por deposito (upsert on deposito)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_por_deposito"));
      await upsertAndClean(supabase, "sap_cache_estoque_deposito", rows, "deposito", now);
      synced.push("estoque_por_deposito");
    } catch (e) {
      errors.push(`estoque_por_deposito: ${e}`);
    }

    // 15. Sync Estoque — Valorizacao por grupo (upsert on grupo)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_valorizacao"));
      await upsertAndClean(supabase, "sap_cache_estoque_valorizacao", rows, "grupo", now);
      synced.push("estoque_valorizacao");
    } catch (e) {
      errors.push(`estoque_valorizacao: ${e}`);
    }

    // 16. Sync Estoque — Abaixo do minimo (upsert on item_code)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_abaixo_minimo"));
      await upsertAndClean(supabase, "sap_cache_estoque_abaixo_minimo", rows, "item_code", now);
      synced.push("estoque_abaixo_minimo");
    } catch (e) {
      errors.push(`estoque_abaixo_minimo: ${e}`);
    }

    // 17. Sync Estoque — Giro (upsert on item_code)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("estoque_giro"));
      await upsertAndClean(supabase, "sap_cache_estoque_giro", rows, "item_code", now);
      synced.push("estoque_giro");
    } catch (e) {
      errors.push(`estoque_giro: ${e}`);
    }

    // 18. Sync Producao — Ordens (upsert on status)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_ordens"));
      await upsertAndClean(supabase, "sap_cache_producao_ordens", rows, "status", now);
      synced.push("producao_ordens");
    } catch (e) {
      errors.push(`producao_ordens: ${e}`);
    }

    // 19. Sync Producao — Consumo MP (upsert on item_code)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_consumo_mp"));
      await upsertAndClean(supabase, "sap_cache_producao_consumo_mp", rows, "item_code", now);
      synced.push("producao_consumo_mp");
    } catch (e) {
      errors.push(`producao_consumo_mp: ${e}`);
    }

    // 20. Sync Producao — Planejado vs Real (upsert on mes)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_planejado_vs_real"));
      await upsertAndClean(supabase, "sap_cache_producao_planejado_vs_real", rows, "mes", now);
      synced.push("producao_planejado_vs_real");
    } catch (e) {
      errors.push(`producao_planejado_vs_real: ${e}`);
    }

    // 21. Sync Compras — Abertas (single row, no unique index — replace)
    try {
      const [row] = await querySap<Record<string, unknown>>(resolveQuery("compras_abertas"));
      await replaceAll(supabase, "sap_cache_compras_abertas", row, now);
      synced.push("compras_abertas");
    } catch (e) {
      errors.push(`compras_abertas: ${e}`);
    }

    // 22. Sync Compras — Mensal (upsert on mes)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("compras_mes"));
      await upsertAndClean(supabase, "sap_cache_compras_mes", rows, "mes", now);
      synced.push("compras_mes");
    } catch (e) {
      errors.push(`compras_mes: ${e}`);
    }

    // 23. Sync Compras — Lead time (upsert on fornecedor)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("compras_lead_time"));
      await upsertAndClean(supabase, "sap_cache_compras_lead_time", rows, "fornecedor", now);
      synced.push("compras_lead_time");
    } catch (e) {
      errors.push(`compras_lead_time: ${e}`);
    }

    // 24. Sync Dashboard KPIs Mensal (upsert on mes,metric)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("dashboard_kpis_mensal"));
      await upsertAndClean(supabase, "sap_cache_dashboard_kpis_mensal", rows, "mes,metric", now);
      synced.push("dashboard_kpis_mensal");
    } catch (e) {
      errors.push(`dashboard_kpis_mensal: ${e}`);
    }

    // 25. Sync Pedido Linhas — line items for PV/NF/EN (upsert on doc_entry,origem,line_num)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("pedido_linhas_sync"));
      await upsertAndClean(supabase, "sap_cache_pedido_linhas", rows, "doc_entry,origem,line_num", now);
      synced.push("pedido_linhas");
    } catch (e) {
      errors.push(`pedido_linhas: ${e}`);
    }

    // 26. Sync Item Packaging from OITM (upsert on item_code)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("item_packaging"));
      await upsertAndClean(supabase, "sap_cache_item_packaging", rows, "item_code", now);
      synced.push("item_packaging");
    } catch (e) {
      errors.push(`item_packaging: ${e}`);
    }

    // 27. Sync Comercial — Grupo SKU (upsert on mes,grupo_sku)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("comercial_grupo_sku"));
      await upsertAndClean(supabase, "sap_cache_comercial_grupo_sku", rows, "mes,grupo_sku", now);
      synced.push("comercial_grupo_sku");
    } catch (e) {
      errors.push(`comercial_grupo_sku: ${e}`);
    }

    // 28. Sync Producao — Ordens Lista (upsert on doc_entry)
    try {
      const rows = await querySap<Record<string, unknown>>(resolveQuery("producao_ordens_lista"));
      await upsertAndClean(supabase, "sap_cache_producao_ordens_lista", rows, "doc_entry", now);
      synced.push("producao_ordens_lista");
    } catch (e) {
      errors.push(`producao_ordens_lista: ${e}`);
    }

    // Update sync log with final results
    const status = errors.length > 0 ? "partial" : "ok";
    await supabase
      .from("sap_sync_log")
      .update({
        completed_at: now,
        status,
        synced_count: synced.length,
        error_count: errors.length,
        errors: errors.map((e) => {
          const colonIdx = e.indexOf(":");
          return {
            step: colonIdx > 0 ? e.substring(0, colonIdx) : "unknown",
            message: e,
          };
        }),
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({ status, synced, errors, synced_at: now }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("sap-sync error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal error";

    // Update sync log on catastrophic failure
    await supabase
      .from("sap_sync_log")
      .update({
        completed_at: new Date().toISOString(),
        status: "error",
        error_count: 1,
        errors: [{ step: "fatal", message: errMsg }],
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({ error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
