import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import { getSupabaseClient, getServiceClient } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  const logger = createLogger("create-user", req);
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
    const { email, password, full_name, roles } = body;
    logger.setBody({ email, full_name, roles }); // Never log password

    if (!email || !password || !roles || !Array.isArray(roles)) {
      await logger.save(serviceClient, { status: "error", responseStatus: 400, errorMessage: "Missing required fields", userId: caller.id });
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, roles" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create the user via admin API
    const { data: newUser, error: createError } =
      await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (createError) {
      await logger.save(serviceClient, { status: "error", responseStatus: 400, errorMessage: createError.message, userId: caller.id });
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign roles
    for (const role of roles) {
      await serviceClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role,
      });
    }

    // Audit log: user created
    await logger.audit(serviceClient, {
      userId: caller.id,
      userEmail: caller.email ?? "",
      action: "create_user",
      resource: "users",
      resourceId: newUser.user.id,
      metadata: { email, full_name, roles },
    });

    await logger.save(serviceClient, {
      status: "ok",
      responseStatus: 200,
      userId: caller.id,
      metadata: { action: "create_user", new_user_id: newUser.user.id, email },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        email: newUser.user.email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-user error:", err);
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
