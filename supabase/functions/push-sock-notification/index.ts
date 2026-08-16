import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

type NotificationEvent = "sock_up" | "sock_down";
type ClaimedNotification = { outbox_id: string; recipient_id: string; event: NotificationEvent };
type DeviceToken = { user_id: string; expo_push_token: string };
type PushJob = { outboxId: string; token: string; event: NotificationEvent };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
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

function chunks<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = readKeyMap("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = readKeyMap("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !secretKey || !authorization) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: { sessionId?: unknown; event?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (typeof payload.sessionId !== "string" || !UUID.test(payload.sessionId)) {
    return json({ error: "Invalid sessionId" }, 400);
  }
  const event: NotificationEvent = payload.event === "sock_down" ? "sock_down" : "sock_up";

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: session, error: sessionError } = await admin
    .from("sock_sessions")
    .select("id,ended_at")
    .eq("id", payload.sessionId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (sessionError) return json({ error: "Could not validate session" }, 500);
  if (!session) return json({ error: "Active session not found" }, 404);
  if ((event === "sock_up" && session.ended_at) || (event === "sock_down" && !session.ended_at)) {
    return json({ error: "Sock session state does not match notification event" }, 409);
  }

  const { data: claimedData, error: claimError } = await admin.rpc(
    "claim_sock_notification_batch",
    {
      p_actor_id: userData.user.id,
      p_session_id: payload.sessionId,
      p_event: event,
      p_batch_size: 200,
    },
  );
  if (claimError) return json({ error: "Could not claim notification batch" }, 500);

  const claimed = (claimedData ?? []) as ClaimedNotification[];
  if (!claimed.length) return json({ processed: 0, attempted: 0 });

  const recipientIds = [...new Set(claimed.map((item) => item.recipient_id))];
  const { data: tokenData, error: tokenError } = await admin
    .from("device_tokens")
    .select("user_id,expo_push_token")
    .in("user_id", recipientIds);
  if (tokenError) {
    await admin
      .from("notification_outbox")
      .update({ processing_started_at: null, last_error: "Could not load device tokens" })
      .in("id", claimed.map((item) => item.outbox_id));
    return json({ error: "Could not load device tokens" }, 500);
  }

  const { data: actorProfile } = await admin
    .from("profiles")
    .select("display_name,username")
    .eq("id", userData.user.id)
    .maybeSingle();
  const actorName = actorProfile?.display_name || actorProfile?.username || "A friend";

  const tokensByRecipient = new Map<string, string[]>();
  for (const token of (tokenData ?? []) as DeviceToken[]) {
    const current = tokensByRecipient.get(token.user_id) ?? [];
    current.push(token.expo_push_token);
    tokensByRecipient.set(token.user_id, current);
  }

  const jobs: PushJob[] = [];
  const noDevice: string[] = [];
  for (const item of claimed) {
    const tokens = tokensByRecipient.get(item.recipient_id) ?? [];
    if (!tokens.length) noDevice.push(item.outbox_id);
    for (const token of tokens) jobs.push({ outboxId: item.outbox_id, token, event: item.event });
  }

  if (noDevice.length) {
    await admin
      .from("notification_outbox")
      .update({ processing_started_at: null, last_error: "No registered device" })
      .in("id", noDevice);
  }

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const successfulOutboxes = new Set<string>();
  const failedOutboxes = new Map<string, string>();
  const invalidTokens: string[] = [];

  for (const batch of chunks(jobs, EXPO_BATCH_SIZE)) {
    try {
      const response = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(expoAccessToken ? { authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(
          batch.map((job) => ({
            to: job.token,
            sound: "default",
            title: "Sock",
            body: job.event === "sock_down"
              ? `🧦 ${actorName} took their sock down`
              : `🧦 ${actorName} put a sock up`,
            data: { type: "sock_status", event },
            channelId: "sock-status",
          })),
        ),
      });
      const result = await response.json();
      const tickets = Array.isArray(result?.data) ? result.data : [];

      batch.forEach((job, index) => {
        const ticket = tickets[index];
        if (response.ok && ticket?.status === "ok") {
          successfulOutboxes.add(job.outboxId);
          return;
        }
        const message = String(ticket?.message || `Expo returned HTTP ${response.status}`).slice(0, 500);
        failedOutboxes.set(job.outboxId, message);
        if (ticket?.details?.error === "DeviceNotRegistered") invalidTokens.push(job.token);
      });
    } catch (error) {
      const message = String(error).slice(0, 500);
      batch.forEach((job) => failedOutboxes.set(job.outboxId, message));
    }
  }

  if (invalidTokens.length) {
    await admin.from("device_tokens").delete().in("expo_push_token", [...new Set(invalidTokens)]);
  }

  if (successfulOutboxes.size) {
    await admin
      .from("notification_outbox")
      .update({ sent_at: new Date().toISOString(), processing_started_at: null, last_error: null })
      .in("id", [...successfulOutboxes]);
  }

  const failedOnly = [...failedOutboxes.entries()].filter(
    ([outboxId]) => !successfulOutboxes.has(outboxId),
  );
  await Promise.all(
    failedOnly.map(([outboxId, message]) =>
      admin
        .from("notification_outbox")
        .update({ processing_started_at: null, last_error: message })
        .eq("id", outboxId)
    ),
  );

  return json({
    processed: successfulOutboxes.size,
    attempted: claimed.length,
    devices: jobs.length,
  });
});
