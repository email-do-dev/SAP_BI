import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/auth.ts";
import { sendEmail, getAlertRecipients } from "../_shared/email.ts";

/**
 * log-cleanup Edge Function
 *
 * Called daily by pg_cron. Two-phase approach:
 *   1. Day 1: Count logs older than 30 days → send email summary
 *   2. Day 2+: Delete logs older than 31 days (1-day grace after notification)
 *
 * Query params:
 *   ?action=preview  → count only, send email (default)
 *   ?action=delete   → actually delete old logs
 *   ?days=30         → retention period (default 30)
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "preview";
    const days = parseInt(url.searchParams.get("days") || "30", 10);

    const supabase = getServiceClient();

    if (action === "preview") {
      // Count old logs and send notification email
      const { data, error } = await supabase.rpc("count_old_logs", {
        retention_days: days,
      });

      if (error) throw error;

      const counts = data as Record<string, number | string>;
      const total =
        Number(counts.audit_logs || 0) +
        Number(counts.frontend_error_logs || 0) +
        Number(counts.edge_function_logs || 0) +
        Number(counts.security_logs || 0) +
        Number(counts.sap_sync_log || 0);

      // Only send email if there are logs to clean
      if (total > 0) {
        const recipients = getAlertRecipients();
        if (recipients.length > 0) {
          const cutoffDate = new Date(
            counts.cutoff_date as string
          ).toLocaleDateString("pt-BR");

          await sendEmail({
            to: recipients,
            subject: `[SAP BI] ${total} logs serão removidos amanhã (anteriores a ${cutoffDate})`,
            html: `
              <h2>Resumo de Limpeza de Logs</h2>
              <p>Os seguintes logs com mais de <strong>${days} dias</strong> serão removidos amanhã:</p>
              <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
                <tr><th>Tabela</th><th>Registros</th></tr>
                <tr><td>Atividades (audit_logs)</td><td>${counts.audit_logs}</td></tr>
                <tr><td>Erros Frontend</td><td>${counts.frontend_error_logs}</td></tr>
                <tr><td>Edge Functions</td><td>${counts.edge_function_logs}</td></tr>
                <tr><td>Segurança</td><td>${counts.security_logs}</td></tr>
                <tr><td>SAP Sync</td><td>${counts.sap_sync_log}</td></tr>
                <tr><td><strong>Total</strong></td><td><strong>${total}</strong></td></tr>
              </table>
              <p style="color:#666;margin-top:16px;">
                Data de corte: ${cutoffDate}<br>
                A exclusão acontecerá automaticamente amanhã via pg_cron.
              </p>
            `,
          });
        }
      }

      return new Response(
        JSON.stringify({ action: "preview", days, counts, total }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      // Delete old logs (retention + 1 day grace period)
      const { data, error } = await supabase.rpc("delete_old_logs", {
        retention_days: days + 1,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ action: "delete", days: days + 1, deleted: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "preview" or "delete".' }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
