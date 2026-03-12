import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getSupabaseClient, getServiceClient } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // Verify the caller has diretoria role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = getSupabaseClient(authHeader);
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = getServiceClient();
    const { data: hasRole } = await serviceClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "diretoria",
    });

    if (!hasRole) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Requires diretoria role." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { action, ...params } = await req.json();

    // LIST: return all users with their roles
    if (action === "list") {
      const { data: authUsers, error: listError } =
        await serviceClient.auth.admin.listUsers({ perPage: 1000 });

      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: allRoles } = await serviceClient
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string[]> = {};
      for (const r of allRoles ?? []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      }

      const users = authUsers.users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name:
          u.user_metadata?.full_name ?? u.user_metadata?.name ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: roleMap[u.id] ?? [],
      }));

      return new Response(JSON.stringify(users), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD_ROLE: add a role to a user
    if (action === "add_role") {
      const { user_id, role } = params;
      if (!user_id || !role) {
        return new Response(
          JSON.stringify({ error: "Missing user_id or role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already has this role
      const { data: existing } = await serviceClient
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .eq("role", role)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, message: "Role already assigned" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertError } = await serviceClient
        .from("user_roles")
        .insert({ user_id, role });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REMOVE_ROLE: remove a role from a user
    if (action === "remove_role") {
      const { user_id, role } = params;
      if (!user_id || !role) {
        return new Response(
          JSON.stringify({ error: "Missing user_id or role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await serviceClient
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", role);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("manage-users error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
