import { createFileRoute } from "@tanstack/react-router";

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
        const secret = process.env.FEEDBACK_WEBHOOK_SECRET?.trim();
        const resendApiKey = process.env.RESEND_API_KEY;

        if (!secret) {
          return new Response("Webhook secret not configured", { status: 500 });
        }
        const provided = request.headers.get("x-webhook-secret")?.trim();
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
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
