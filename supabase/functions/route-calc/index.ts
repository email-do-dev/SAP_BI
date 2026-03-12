import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getSupabaseClient, getServiceClient } from "../_shared/auth.ts";
import { querySap, resolveQuery } from "../_shared/sap-connection.ts";

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

    const { delivery_doc_entry } = await req.json();
    if (!delivery_doc_entry) {
      return new Response(
        JSON.stringify({ error: "Missing delivery_doc_entry" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceClient = getServiceClient();

    // Get warehouse address from settings
    const { data: settings } = await serviceClient
      .from("app_settings")
      .select("value")
      .eq("key", "warehouse_address")
      .single();

    const warehouseAddress = settings?.value;
    if (!warehouseAddress) {
      return new Response(
        JSON.stringify({ error: "Warehouse address not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get custo_km rate
    const { data: rateSetting } = await serviceClient
      .from("app_settings")
      .select("value")
      .eq("key", "custo_km")
      .single();

    const custoKm = parseFloat(rateSetting?.value ?? "3.50");

    // Get delivery customer addresses from SAP
    const addresses = await querySap<{
      CardCode: string;
      CardName: string;
      delivery_address: string;
    }>(resolveQuery("delivery_addresses", { docEntry: delivery_doc_entry }));

    if (!addresses.length) {
      return new Response(
        JSON.stringify({ error: "No delivery addresses found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build route: warehouse → customers → warehouse
    const destinations = addresses.map((a) => a.delivery_address).filter(Boolean);
    const routePoints = [warehouseAddress, ...destinations, warehouseAddress];

    // Call Google Maps Distance Matrix API
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalKm = 0;

    // Calculate distance for each leg of the journey
    for (let i = 0; i < routePoints.length - 1; i++) {
      const origin = encodeURIComponent(routePoints[i]);
      const destination = encodeURIComponent(routePoints[i + 1]);

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (
        data.status === "OK" &&
        data.rows[0]?.elements[0]?.status === "OK"
      ) {
        totalKm += data.rows[0].elements[0].distance.value / 1000;
      } else {
        console.warn(
          `Distance Matrix failed for leg ${i}: ${routePoints[i]} → ${routePoints[i + 1]}`
        );
      }
    }

    totalKm = Math.round(totalKm * 100) / 100;
    const totalCost = Math.round(totalKm * custoKm * 100) / 100;

    // Store the route
    await serviceClient.from("delivery_routes").upsert(
      {
        delivery_doc_entry,
        total_km: totalKm,
        route_points: routePoints,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "delivery_doc_entry" }
    );

    // Store the cost
    await serviceClient.from("logistics_costs").insert({
      delivery_doc_entry,
      cost_type: "frete_proprio",
      amount: totalCost,
      description: `Rota calculada: ${totalKm} km × R$ ${custoKm}/km`,
      source: "calculated",
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({
        total_km: totalKm,
        custo_km: custoKm,
        total_cost: totalCost,
        route_points: routePoints,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("route-calc error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
