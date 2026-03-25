import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getSupabaseClient, getServiceClient } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  const logger = createLogger("manage-users", req);
  const serviceClient = getServiceClient();

  try {
    // Verify the caller has diretoria role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await logger.save(serviceClient, { status: "error", responseStatus: 401, errorMessage: "Missing authorization" });
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
      await logger.save(serviceClient, { status: "error", responseStatus: 401, errorMessage: "Unauthorized" });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasRole } = await serviceClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "diretoria",
    });

    if (!hasRole) {
      await logger.save(serviceClient, { status: "error", responseStatus: 403, errorMessage: "Insufficient permissions", userId: caller.id });
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Requires diretoria role." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { action, ...params } = body;
    logger.setBody({ action });

    // LIST: return all users with their roles
    if (action === "list") {
      const { data: authUsers, error: listError } =
        await serviceClient.auth.admin.listUsers({ perPage: 1000 });

      if (listError) {
        await logger.save(serviceClient, { status: "error", responseStatus: 500, errorMessage: listError.message, userId: caller.id });
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

      await logger.save(serviceClient, { status: "ok", responseStatus: 200, userId: caller.id, metadata: { action: "list", userCount: users.length } });
      return new Response(JSON.stringify(users), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD_ROLE: add a role to a user
    if (action === "add_role") {
      const { user_id, role } = params;
      if (!user_id || !role) {
        await logger.save(serviceClient, { status: "error", responseStatus: 400, errorMessage: "Missing user_id or role", userId: caller.id });
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
        await logger.save(serviceClient, { status: "ok", responseStatus: 200, userId: caller.id, metadata: { action: "add_role", role, target_user: user_id, already_assigned: true } });
        return new Response(JSON.stringify({ success: true, message: "Role already assigned" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertError } = await serviceClient
        .from("user_roles")
        .insert({ user_id, role });

      if (insertError) {
        await logger.save(serviceClient, { status: "error", responseStatus: 500, errorMessage: insertError.message, userId: caller.id });
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Audit log: role added
      await logger.audit(serviceClient, {
        userId: caller.id,
        userEmail: caller.email ?? "",
        action: "add_role",
        resource: "user_roles",
        resourceId: user_id,
        metadata: { role },
      });

      await logger.save(serviceClient, { status: "ok", responseStatus: 200, userId: caller.id, metadata: { action: "add_role", role, target_user: user_id } });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REMOVE_ROLE: remove a role from a user
    if (action === "remove_role") {
      const { user_id, role } = params;
      if (!user_id || !role) {
        await logger.save(serviceClient, { status: "error", responseStatus: 400, errorMessage: "Missing user_id or role", userId: caller.id });
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
        await logger.save(serviceClient, { status: "error", responseStatus: 500, errorMessage: deleteError.message, userId: caller.id });
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Audit log: role removed
      await logger.audit(serviceClient, {
        userId: caller.id,
        userEmail: caller.email ?? "",
        action: "remove_role",
        resource: "user_roles",
        resourceId: user_id,
        metadata: { role },
      });

      await logger.save(serviceClient, { status: "ok", responseStatus: 200, userId: caller.id, metadata: { action: "remove_role", role, target_user: user_id } });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logger.save(serviceClient, { status: "error", responseStatus: 400, errorMessage: `Unknown action: ${action}`, userId: caller.id });
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("manage-users error:", err);
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
