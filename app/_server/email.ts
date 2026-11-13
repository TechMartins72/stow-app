import "server-only";

/**
 * Sends the sign-in link through Resend's HTTP API. In mock mode the link is
 * also printed to the server console, so any address works while developing
 * (Resend's test sender only delivers to the account owner).
 */
export async function sendSignInEmail(to: string, url: string): Promise<{ ok: boolean }> {
  const practice = process.env.GATEWAY_MODE !== "live";
  if (practice) console.info(`\n[sign-in] Link for ${to} (practice mode):\n  ${url}\n`);

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: practice };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Stow sign-in link",
      text: `Sign in to Stow:\n\n${url}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
      html: signInHtml(url),
    }),
  }).catch(() => null);

  if (!res?.ok) {
    // Never log the key; the status is enough to debug.
    console.warn(`[sign-in] Resend did not accept the email (status ${res?.status ?? "network error"}).`);
    return { ok: practice };
  }
  return { ok: true };
}

function signInHtml(url: string): string {
  const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!doctype html><html><body style="margin:0;background:#f0f5fc;font-family:Arial,Helvetica,sans-serif;color:#122231">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#060f21;padding:20px 28px;color:#f0f5fc;font-size:18px;font-weight:800">Stow</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 8px;font-size:24px">Sign in</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#3d4f60">Tap the button to sign in. It works once and expires in 15 minutes.</p>
<a href="${safe}" style="display:inline-block;background:#0935d1;color:#ffffff;text-decoration:none;font-weight:700;padding:15px 22px;border-radius:12px">Sign in to Stow</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#3d4f60">If you didn't ask for this, you can ignore this email. Nobody can sign in without the link.</p>
</td></tr></table></td></tr></table></body></html>`;
}
