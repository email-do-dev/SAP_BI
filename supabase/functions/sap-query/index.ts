import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getSupabaseClient, getServiceClient } from "../_shared/auth.ts";
import { querySap, querySapMulti, querySapTriple, resolveQuery, QUERIES, readNFeXml } from "../_shared/sap-connection.ts";
import { createLogger } from "../_shared/logger.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  const logger = createLogger("sap-query", req);
  const serviceClient = getServiceClient();

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await logger.save(serviceClient, { status: "error", responseStatus: 401, errorMessage: "Missing authorization" });
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      await logger.save(serviceClient, { status: "error", responseStatus: 401, errorMessage: "Unauthorized" });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { query, params } = body;
    logger.setBody({ query, params });

    // Special handler: read NFe XML from SAP filesystem
    if (query === "nfe_xml") {
      if (!params?.docEntry) {
        await logger.save(serviceClient, { status: "error", responseStatus: 400, errorMessage: "docEntry required", userId: user.id });
        return new Response(
          JSON.stringify({ error: "docEntry is required for nfe_xml" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const xmlContent = await readNFeXml(Number(params.docEntry));
      await logger.save(serviceClient, { status: "ok", responseStatus: 200, userId: user.id, metadata: { query: "nfe_xml" } });
      return new Response(
        JSON.stringify({ xml_content: xmlContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow whitelisted queries
    if (!query || !QUERIES[query]) {
      await logger.save(serviceClient, { status: "error", responseStatus: 400, errorMessage: `Unknown query: ${query}`, userId: user.id });
      return new Response(
        JSON.stringify({ error: `Unknown query: ${query}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sql = resolveQuery(query, params);
    const isDetailQuery = query.startsWith("pedido_detalhe_") || query === "producao_ordem_detalhe";
    const isTripleQuery = query === "danfe_completo";

    const data = isTripleQuery
      ? await querySapTriple(sql)
      : isDetailQuery
        ? await querySapMulti(sql)
        : await querySap(sql);

    await logger.save(serviceClient, {
      status: "ok",
      responseStatus: 200,
      userId: user.id,
      metadata: { query, rowCount: Array.isArray(data) ? data.length : undefined },
    });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sap-query error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal error";
    await logger.save(serviceClient, {
      status: "error",
      responseStatus: 500,
      errorMessage: errMsg,
      errorStack: err instanceof Error ? err.stack : undefined,
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
