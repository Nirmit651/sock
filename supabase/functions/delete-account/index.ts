import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: Record<string, string | boolean>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "no-store" },
  });
}

function readKeyMap(name: string, legacyName: string) {
  const encoded = Deno.env.get(name);
  if (encoded) {
    try {
      const value = (JSON.parse(encoded) as Record<string, unknown>).default;
      if (typeof value === "string" && value) return value;
    } catch {
      return null;
    }
  }
  return Deno.env.get(legacyName) ?? null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = readKeyMap("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = readKeyMap("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !secretKey || !authorization) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Storage objects are not removed by the database foreign-key cascade.
  const avatarPrefix = `${userData.user.id}/`;
  const { data: avatars, error: listError } = await admin.storage.from("avatars").list(avatarPrefix, {
    limit: 1000,
  });
  if (listError) return json({ error: "Could not prepare account deletion" }, 500);

  const avatarPaths = (avatars ?? [])
    .filter((object) => object.name && object.name !== ".emptyFolderPlaceholder")
    .map((object) => `${avatarPrefix}${object.name}`);
  if (avatarPaths.length) {
    const { error: removeError } = await admin.storage.from("avatars").remove(avatarPaths);
    if (removeError) return json({ error: "Could not remove account files" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) return json({ error: "Could not delete account" }, 500);

  return json({ deleted: true });
});
