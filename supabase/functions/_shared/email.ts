/**
 * Resend email helper for Edge Functions.
 * Requires RESEND_API_KEY and ALERT_EMAIL_TO secrets in Supabase.
 */

interface SendEmailOptions {
  to: string[];
  subject: string;
  html: string;
}

interface ResendResponse {
  id: string;
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<ResendResponse> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const from =
    Deno.env.get("RESEND_FROM_EMAIL") ||
    "SAP BI <noreply@matanorteltda.com.br>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Returns the alert recipient list from ALERT_EMAIL_TO env var.
 * Expects comma-separated emails: "a@x.com,b@x.com"
 */
export function getAlertRecipients(): string[] {
  const raw = Deno.env.get("ALERT_EMAIL_TO") || "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}
