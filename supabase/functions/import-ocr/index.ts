import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getSupabaseClient, getServiceClient } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = getSupabaseClient(authHeader);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const { data: roles } = await supabase.rpc("get_user_roles", { _user_id: user.id });
    const hasRole = (roles as string[] ?? []).some((r: string) => ["diretoria", "importacao"].includes(r));
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = getServiceClient();

    // Fetch document metadata
    const { data: doc, error: docErr } = await serviceClient
      .from("import_documents")
      .select("*")
      .eq("id", document_id)
      .single();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await serviceClient
      .from("import_documents")
      .update({ ocr_status: "processing" })
      .eq("id", document_id);

    // Download file from storage
    const { data: fileData, error: downloadErr } = await serviceClient.storage
      .from("import-documents")
      .download(doc.storage_path);
    if (downloadErr || !fileData) {
      await serviceClient
        .from("import_documents")
        .update({ ocr_status: "error" })
        .eq("id", document_id);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to base64
    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const isPdf = doc.file_name.toLowerCase().endsWith(".pdf");
    const mediaType = isPdf ? "application/pdf" : doc.file_name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    // Call Anthropic API
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      await serviceClient
        .from("import_documents")
        .update({ ocr_status: "error" })
        .eq("id", document_id);
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a document data extraction specialist for import/export trade documents.
Analyze this document and extract the following fields as JSON.
Return ONLY valid JSON, no markdown or explanation.

Fields to extract:
- supplier_name: string (the exporter/seller company name)
- invoice_number: string
- invoice_date: string (format: YYYY-MM-DD)
- currency: string (USD, EUR, BRL, etc)
- total_value: number
- items: array of { description: string, quantity: number, unit_price: number, total: number }
- container_number: string (if present)
- vessel_name: string (if present)
- bl_number: string (Bill of Lading number, if present)
- net_weight: number (in kg, if present)
- gross_weight: number (in kg, if present)

If a field is not found in the document, omit it from the JSON.
Return the JSON object directly.`;

    const content = isPdf
      ? [{ type: "document", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: prompt }]
      : [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: prompt }];

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", errText);
      await serviceClient
        .from("import_documents")
        .update({ ocr_status: "error" })
        .eq("id", document_id);
      return new Response(JSON.stringify({ error: "OCR extraction failed", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicData = await anthropicRes.json();
    const textContent = anthropicData.content?.find((c: { type: string }) => c.type === "text")?.text ?? "{}";

    // Parse extracted data (strip possible markdown fences)
    let extractedData;
    try {
      const cleaned = textContent.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
      extractedData = JSON.parse(cleaned);
    } catch {
      extractedData = { raw_text: textContent };
    }

    // Update document with extracted data
    await serviceClient
      .from("import_documents")
      .update({ extracted_data: extractedData, ocr_status: "done" })
      .eq("id", document_id);

    return new Response(JSON.stringify({ success: true, extracted_data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("import-ocr error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
