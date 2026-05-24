/**
 * Minimal email helper.
 *
 * During the build phase we don't require a Resend account: if RESEND_API_KEY
 * is absent we simply log the payload and return ok.  This lets the rest of
 * the app proceed without an OAuth signup mid-build, and switches to real
 * delivery the moment the key is provisioned (A20-ish).
 */

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendResult =
  | { ok: true; id: string | null; mode: 'sent' | 'logged' }
  | { ok: false; error: string };

const FROM = process.env.EMAIL_FROM ?? 'API Cameroun <noreply@api.cm>';

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.info(`[email:logged] to=${to} subject=${subject}`);
    return { ok: true, id: null, mode: 'logged' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html,
        text: text ?? stripTags(html),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email:error] ${res.status} ${body}`);
      return { ok: false, error: `Resend ${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? null, mode: 'sent' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error(`[email:throw] ${msg}`);
    return { ok: false, error: msg };
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Welcome email for a newly created staff account.
 * In build mode (admin/admin everywhere) we just say the password is `admin`.
 * The real password-set link will be wired up at A22.
 */
export function welcomeStaffEmail(args: { name: string; email: string; roleLabel: string }) {
  const { name, email, roleLabel } = args;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0a0a0a; max-width: 560px; margin: 0 auto;">
      <div style="border-top: 4px solid #006b3a; padding: 32px 28px 8px;">
        <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6b6b; font-weight: 700;">Portail interne API Cameroun</div>
        <h1 style="font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px; color: #0a0a0a;">Votre compte a été créé</h1>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">Bonjour ${escapeHtml(name)},</p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Un compte vient d'être créé pour vous sur le portail interne de l'Agence
          de Promotion des Investissements. Vous y accéderez avec le rôle
          <strong>${escapeHtml(roleLabel)}</strong>.
        </p>
        <div style="border: 1px solid #d4d4d4; padding: 16px 18px; margin: 18px 0; background: #fafafa;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; font-weight: 700; margin-bottom: 6px;">Identifiants de connexion</div>
          <div style="font-family: 'Courier New', monospace; font-size: 13px; color: #0a0a0a;">
            Email&nbsp;: <strong>${escapeHtml(email)}</strong><br>
            Mot de passe&nbsp;: <strong>admin</strong>
          </div>
        </div>
        <p style="font-size: 13px; color: #6b6b6b; line-height: 1.6;">
          Phase de construction&nbsp;: tous les mots de passe sont temporairement
          <code>admin</code>. La procédure de définition de mot de passe personnel
          sera activée lors du déploiement officiel.
        </p>
      </div>
      <div style="border-top: 1px solid #e5e5e5; padding: 18px 28px; font-size: 11px; color: #8a8a8a;">
        ⚜ API Cameroun · Agence de Promotion des Investissements
      </div>
    </div>
  `;
  return { subject: 'Votre compte API Cameroun a été créé', html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
