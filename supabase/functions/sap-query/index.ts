import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/auth.ts";
import { querySap, querySapMulti, querySapTriple, resolveQuery, QUERIES, readNFeXml } from "../_shared/sap-connection.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, params } = await req.json();

    // Special handler: read NFe XML from SAP filesystem
    if (query === "nfe_xml") {
      if (!params?.docEntry) {
        return new Response(
          JSON.stringify({ error: "docEntry is required for nfe_xml" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const xmlContent = await readNFeXml(Number(params.docEntry));
      return new Response(
        JSON.stringify({ xml_content: xmlContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow whitelisted queries
    if (!query || !QUERIES[query]) {
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

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sap-query error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
