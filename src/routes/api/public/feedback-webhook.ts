import { createFileRoute } from "@tanstack/react-router";

// Constant-time string comparison so secret checks don't leak timing info.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const Route = createFileRoute("/api/public/feedback-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-webhook-secret")?.trim() ?? "";

        // Verify against the configured secret with a constant-time compare.
        // No database/admin client is involved, so this route never depends on
        // SUPABASE_SERVICE_ROLE_KEY being present in the runtime environment.
        const envSecret = process.env.FEEDBACK_WEBHOOK_SECRET?.trim() ?? "";
        const authorized = !!provided && !!envSecret && safeEqual(provided, envSecret);

        if (!authorized) {
          return new Response("Unauthorized", { status: 401 });
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          return new Response("Resend API key not configured", { status: 500 });
        }

        let payload: { record?: Record<string, unknown> } | null = null;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }


        const record = (payload?.record ?? {}) as Record<string, unknown>;
        const ratingValue = typeof record.rating === "number" ? record.rating : null;
        const ratingLabel = ratingValue !== null ? `${ratingValue}` : "—";
        const text = record.text ? String(record.text) : "(no comment)";
        const createdAt = record.created_at ? String(record.created_at) : new Date().toISOString();
        const stars =
          ratingValue !== null
            ? "★".repeat(ratingValue) + "☆".repeat(Math.max(0, 5 - ratingValue))
            : "";

        const html = `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
            <h2 style="margin-bottom: 4px;">New MockMate feedback</h2>
            <p style="color:#666; margin-top:0;">${escapeHtml(createdAt)}</p>
            <p style="font-size:18px;">Rating: <strong>${ratingLabel} / 5</strong> ${stars}</p>
            <p style="white-space:pre-wrap; background:#f5f5f5; padding:12px 16px; border-radius:8px;">${escapeHtml(text)}</p>
          </div>
        `;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "MockMate Feedback <onboarding@resend.dev>",
            to: ["r3810891@gmail.com"],
            subject: `New MockMate feedback — ${ratingLabel}/5`,
            html,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          console.error("Resend send failed", res.status, body);
          return new Response(`Email send failed: ${res.status}`, { status: 502 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
