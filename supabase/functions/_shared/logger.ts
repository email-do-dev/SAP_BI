/**
 * Edge Function logger — writes to edge_function_logs and audit_logs.
 * Usage:
 *   const logger = createLogger("sap-query", req);
 *   // ... do work ...
 *   await logger.save(supabase, { status: "ok", responseStatus: 200, userId: user.id });
 */

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

interface SaveOptions {
  status: "ok" | "error";
  responseStatus: number;
  errorMessage?: string;
  errorStack?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface AuditOptions {
  userId: string;
  userEmail: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export function createLogger(functionName: string, req: Request) {
  const startTime = Date.now();

  // Capture a short summary of the request body (max 500 chars)
  let bodySummary: string | null = null;

  return {
    /** Store a truncated copy of the request body for logging. Call after parsing. */
    setBody(parsed: unknown) {
      try {
        const json = JSON.stringify(parsed);
        bodySummary = json.length > 500 ? json.slice(0, 500) + "..." : json;
      } catch {
        bodySummary = null;
      }
    },

    /** Start a sub-timer (returns epoch ms). */
    startTimer(): number {
      return Date.now();
    },

    /** Elapsed ms since a sub-timer. */
    elapsed(timerStart: number): number {
      return Date.now() - timerStart;
    },

    /** Total ms since logger creation. */
    totalDuration(): number {
      return Date.now() - startTime;
    },

    /** Persist a row in edge_function_logs. Fire-and-forget (errors are swallowed). */
    async save(supabase: AnySupabaseClient, opts: SaveOptions) {
      try {
        await supabase.from("edge_function_logs").insert({
          function_name: functionName,
          status: opts.status,
          duration_ms: Date.now() - startTime,
          request_method: req.method,
          request_path: new URL(req.url).pathname,
          request_body_summary: bodySummary,
          response_status: opts.responseStatus,
          error_message: opts.errorMessage ?? null,
          error_stack: opts.errorStack ?? null,
          user_id: opts.userId ?? null,
          metadata: opts.metadata ?? null,
        });
      } catch (e) {
        console.error(`[logger] save failed (${functionName}):`, e);
      }
    },

    /** Insert an audit_logs entry (user actions like CRUD, role changes). */
    async audit(supabase: AnySupabaseClient, opts: AuditOptions) {
      try {
        await supabase.from("audit_logs").insert({
          user_id: opts.userId,
          user_email: opts.userEmail,
          action: opts.action,
          resource: opts.resource ?? null,
          resource_id: opts.resourceId ?? null,
          metadata: opts.metadata ?? null,
          ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          user_agent: req.headers.get("user-agent") ?? null,
        });
      } catch (e) {
        console.error(`[logger] audit failed (${functionName}):`, e);
      }
    },
  };
}
