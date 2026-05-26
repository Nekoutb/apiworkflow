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

/**
 * Outbound response email — sent by Bureau Départ after a DG decision.
 * Wraps the cover-letter body the agent typed in our editorial template,
 * cites the reference, and links to the signed PDF (when Vercel Blob is
 * configured; otherwise the operator transmits the file manually).
 */
export function responseEmail(args: {
  recipientName: string;
  reference: string;
  originalSubject: string;
  coverLetterBody: string;
  attachmentUrl?: string;
}) {
  const { recipientName, reference, originalSubject, coverLetterBody, attachmentUrl } = args;
  const bodyHtml = coverLetterBody
    .split(/\n{2,}/)
    .map((para) => `<p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 12px;">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0a0a0a; max-width: 560px; margin: 0 auto;">
      <div style="border-top: 4px solid #006b3a; padding: 32px 28px 8px;">
        <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6b6b; font-weight: 700;">Réponse officielle · API Cameroun</div>
        <h1 style="font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px; color: #0a0a0a;">Réponse à votre dossier</h1>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">Bonjour ${escapeHtml(recipientName)},</p>
        <div style="border: 1px solid #d4d4d4; padding: 14px 16px; margin: 16px 0; background: #fafafa;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; font-weight: 700; margin-bottom: 6px;">Référence du dossier</div>
          <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #006b3a; font-weight: 700;">${escapeHtml(reference)}</div>
          <div style="font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #5a5a5a; margin-top: 6px;">« ${escapeHtml(originalSubject)} »</div>
        </div>

        <div style="margin: 18px 0;">
          ${bodyHtml}
        </div>

        ${attachmentUrl ? `
        <div style="border-left: 3px solid #c1973f; background: #fbf8f1; padding: 12px 14px; margin: 18px 0;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; font-weight: 700; margin-bottom: 6px;">Pièce jointe officielle</div>
          <a href="${attachmentUrl}" style="font-family: 'Courier New', monospace; font-size: 13px; color: #006b3a; word-break: break-all; text-decoration: underline;">
            Réponse signée (PDF)
          </a>
        </div>` : `
        <div style="border-left: 3px solid #c1973f; background: #fbf8f1; padding: 12px 14px; margin: 18px 0; font-size: 12px; color: #5a5a5a;">
          La réponse officielle signée vous parviendra par voie séparée (la pièce jointe sera intégrée au email une fois Vercel Blob configuré sur la plateforme).
        </div>`}

        <p style="font-size: 12px; color: #6b6b6b; line-height: 1.6; margin-top: 18px;">
          Pour toute question relative à ce dossier, citez la référence
          <strong style="font-family: 'Courier New', monospace;">${escapeHtml(reference)}</strong>
          dans votre réponse.
        </p>
      </div>
      <div style="border-top: 1px solid #e5e5e5; padding: 18px 28px; font-size: 11px; color: #8a8a8a;">
        ⚜ API Cameroun · Agence de Promotion des Investissements<br>
        Service du Courrier · Bureau Départ
      </div>
    </div>
  `;
  return { subject: `Réponse · ${reference}`, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Acknowledgement of receipt — sent the moment Bureau Arrivée registers
 * an incoming document (per the law: récépissé must precede the 10-day
 * countdown for AGREMENT_REQUEST decisions).
 */
export function acknowledgementEmail(args: {
  recipientName: string;
  reference: string;
  subject: string;
  registeredAt: Date;
  trackingUrl?: string;
}) {
  const { recipientName, reference, subject, registeredAt, trackingUrl } = args;
  const trackUrl = trackingUrl ?? `https://cmipaportal.com/track?ref=${encodeURIComponent(reference)}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0a0a0a; max-width: 560px; margin: 0 auto;">
      <div style="border-top: 4px solid #006b3a; padding: 32px 28px 8px;">
        <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6b6b; font-weight: 700;">Accusé de réception · API Cameroun</div>
        <h1 style="font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px; color: #0a0a0a;">Votre dossier a été enregistré</h1>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">Bonjour ${escapeHtml(recipientName)},</p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Le Service du Courrier de l'Agence de Promotion des Investissements
          confirme la réception de votre dossier intitulé&nbsp;:
        </p>
        <div style="font-family: Georgia, serif; font-style: italic; font-size: 15px; padding: 12px 16px; border-left: 3px solid #c1973f; background: #fbf8f1; margin: 14px 0; color: #0a0a0a;">
          « ${escapeHtml(subject)} »
        </div>
        <div style="border: 1px solid #d4d4d4; padding: 16px 18px; margin: 18px 0; background: #fafafa;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; font-weight: 700; margin-bottom: 8px;">Référence officielle</div>
          <div style="font-family: 'Courier New', monospace; font-size: 18px; color: #006b3a; font-weight: 700;">${escapeHtml(reference)}</div>
          <div style="font-size: 12px; color: #6b6b6b; margin-top: 8px;">
            Enregistré le ${registeredAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
          </div>
        </div>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Le Directeur Général prendra connaissance de votre dossier et l'orientera
          vers l'unité compétente. Vous recevrez la réponse officielle de l'Agence
          par retour à cette adresse.
        </p>
        <div style="margin: 18px 0;">
          <a href="${trackUrl}" style="display: inline-block; background: #0a1820; color: #ffffff; text-decoration: none; padding: 11px 18px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">
            Suivre mon dossier →
          </a>
        </div>
        <p style="font-size: 12px; color: #6b6b6b; line-height: 1.6;">
          Conservez la référence <strong style="font-family: 'Courier New', monospace;">${escapeHtml(reference)}</strong>
          pour toute correspondance ultérieure avec nos services.
        </p>
      </div>
      <div style="border-top: 1px solid #e5e5e5; padding: 18px 28px; font-size: 11px; color: #8a8a8a;">
        ⚜ API Cameroun · Agence de Promotion des Investissements<br>
        Connexion chiffrée TLS 1.3 · Loi 2010/012 sur la protection des données personnelles
      </div>
    </div>
  `;
  return { subject: `Accusé de réception · ${reference}`, html };
}
