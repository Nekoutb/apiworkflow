import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { roleLabel } from '@/lib/roles';
import type { NotificationKind, StaffRole } from '@prisma/client';

// ============================================================================
//  /api/cron/tick — Background job runner (B18 + B19)
//
//  Called hourly by an external cron (VPS crontab installed by deploy script).
//  Does two things on each tick:
//
//    1. EMAIL PUMP (B18) — find Notifications where emailed=false AND kind is
//       a "critical" kind that warrants an individual email. Send via Resend
//       and mark emailed=true. Non-critical kinds (COMMENT_ADDED) accumulate
//       and could be sent as a daily digest in a future tick variant.
//
//    2. 50H REMINDER (B19) — find documents whose current holder has had it
//       for >50h (anticipatory early warning before the 72h gov SLA) AND that
//       have NOT received a REMINDER_NUDGE in the last 12h. Auto-create a
//       REMINDER_NUDGE notification for each recipient (same fan-out as the
//       manual /secretariat reminder button).
//
//  Auth: requires X-Cron-Secret header matching CRON_SECRET env var.
//  If CRON_SECRET is not set, the endpoint refuses to run.
// ============================================================================

// Notifications that should fire an individual email (vs aggregate in daily digest)
const EMAIL_KINDS: NotificationKind[] = [
  'DOCUMENT_ASSIGNED',
  'DOCUMENT_TO_DG',
  'DG_DECISION_MADE',
  'EXTERNAL_AVIS_RECEIVED',
  'REMINDER_NUDGE',
];

// Doc statuses where a holder might need a reminder
const REMINDABLE_STATUSES = [
  'ASSIGNED',
  'IN_TREATMENT',
  'AWAITING_DG_ANALYSIS',
  'AWAITING_DG_DECISION',
  'AWAITING_EXTERNAL_AVIS',
] as const;

const SLA_REMINDER_HOURS = 50;          // anticipatory threshold (before 72h SLA)
const REMINDER_COOLDOWN_HOURS = 12;     // don't spam the same doc

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  // -------- Auth --------
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured on server.' },
      { status: 503 },
    );
  }
  const provided = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }

  const startedAt = Date.now();

  // -------- B18 · Email pump --------
  const emailReport = await runEmailPump();

  // -------- B19 · 50h SLA reminders --------
  const reminderReport = await runSlaReminders();

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    email: emailReport,
    reminder: reminderReport,
  });
}

// ============================================================================
//  B18 · Email pump
// ============================================================================

async function runEmailPump() {
  const pending = await db.notification.findMany({
    where: { emailed: false, kind: { in: EMAIL_KINDS } },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      link: true,
      createdAt: true,
      forUser: { select: { email: true, name: true } },
    },
  });

  if (pending.length === 0) {
    return { processed: 0, sent: 0, errors: 0 };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://cmipaportal.com';
  let sent = 0;
  let errors = 0;

  for (const n of pending) {
    if (!n.forUser?.email) continue;
    const html = buildEmailHtml({
      recipientName: n.forUser.name,
      title: n.title,
      body: n.body,
      link: n.link ? `${baseUrl}${n.link.startsWith('/') ? '' : '/'}${n.link}` : null,
    });
    const result = await sendEmail({
      to: n.forUser.email,
      subject: `[API Cameroun] ${n.title}`,
      html,
    });
    if (result.ok) {
      await db.notification.update({
        where: { id: n.id },
        data: { emailed: true, emailedAt: new Date() },
      });
      sent++;
    } else {
      errors++;
    }
  }

  return { processed: pending.length, sent, errors };
}

function buildEmailHtml({
  recipientName,
  title,
  body,
  link,
}: {
  recipientName: string | null;
  title: string;
  body: string | null;
  link: string | null;
}): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4ee;color:#1a1612;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="background:#0d1822;color:#d4a72c;padding:14px 24px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;text-align:center;">
      API Cameroun · Portail interne
    </div>
    <div style="background:#fff;border:1px solid #e8e3d6;border-top:none;padding:32px 28px;">
      <p style="font-size:13px;color:#5b554a;margin:0 0 8px 0;">
        Bonjour${recipientName ? ' ' + escapeHtml(recipientName) : ''},
      </p>
      <h1 style="font-family:'Georgia',serif;font-size:22px;font-weight:600;color:#1a1612;margin:0 0 16px 0;letter-spacing:-0.3px;">
        ${escapeHtml(title)}
      </h1>
      ${body ? `<p style="font-family:'Georgia',serif;font-size:14px;font-style:italic;color:#3c372d;line-height:1.6;margin:0 0 24px 0;">${escapeHtml(body)}</p>` : ''}
      ${link ? `<div style="margin-top:24px;"><a href="${link}" style="display:inline-block;background:#0e6b2e;color:#fff;text-decoration:none;padding:12px 22px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Ouvrir le dossier →</a></div>` : ''}
      <hr style="border:none;border-top:1px solid #e8e3d6;margin:32px 0 16px 0;">
      <p style="font-size:11px;color:#9c9485;margin:0;font-style:italic;">
        Email envoyé automatiquement par le portail interne API Cameroun.
        Pour gérer vos notifications, connectez-vous au portail et cliquez sur la cloche en haut à droite.
      </p>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
//  B19 · 50h SLA reminders
// ============================================================================

async function runSlaReminders() {
  const cooldownCutoff = new Date(Date.now() - REMINDER_COOLDOWN_HOURS * 3600 * 1000);
  const slaCutoff      = new Date(Date.now() - SLA_REMINDER_HOURS    * 3600 * 1000);

  // Find docs currently held by someone (with a role) in a workable state
  const docs = await db.document.findMany({
    where: {
      status: { in: REMINDABLE_STATUSES as unknown as typeof REMINDABLE_STATUSES[number][] },
      currentHolderRole: { not: null },
    },
    take: 500,
    select: {
      id: true,
      reference: true,
      subject: true,
      status: true,
      currentHolderRole: true,
      currentHolderUserId: true,
      // Most recent handoff to compute arrival-with-holder time
      handoffs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { type: true, toRole: true, createdAt: true },
      },
      // Recent REMINDER_NUDGE on this doc for cooldown check
      notifications: {
        where: { kind: 'REMINDER_NUDGE', createdAt: { gt: cooldownCutoff } },
        select: { id: true },
        take: 1,
      },
    },
  });

  let triggered = 0;
  let recipients = 0;
  let skippedCooldown = 0;
  let skippedNotOverdue = 0;

  for (const d of docs) {
    if (d.notifications.length > 0) {
      skippedCooldown++;
      continue;
    }

    // Most recent handoff that landed the doc at the current holder
    const landed = d.handoffs.find((h) => h.toRole === d.currentHolderRole) ?? d.handoffs[0];
    const arrivedAt = landed?.createdAt;
    if (!arrivedAt || arrivedAt > slaCutoff) {
      skippedNotOverdue++;
      continue;
    }

    const role = d.currentHolderRole!;
    const recipientIds = d.currentHolderUserId
      ? [d.currentHolderUserId]
      : (await db.user.findMany({
          where: { staffRole: role, status: 'ACTIVE' },
          select: { id: true },
        })).map((u) => u.id);

    if (recipientIds.length === 0) continue;

    const holderLabel = roleLabel(role);
    const hoursWaited = Math.floor((Date.now() - arrivedAt.getTime()) / 3600 / 1000);
    const link = role === 'DG' || role === 'DGA'
      ? `/dg/parapheur/${d.id}`
      : role === 'CHEF_BUREAU_DEPART'
        ? `/courrier/depart/${d.id}`
        : `/unit/parapheur/${d.id}`;

    const title = `⏳ Rappel automatique · ${d.reference} (${hoursWaited}h chez vous)`;
    const body =
      `Ce dossier vous est affecté depuis ${hoursWaited}h. ` +
      `La politique gouvernementale impose un traitement sous 72h — ce rappel anticipatif ` +
      `vous est envoyé à 50h pour vous laisser le temps d'agir. ` +
      `Objet : ${d.subject.slice(0, 140)}${d.subject.length > 140 ? '…' : ''}`;

    await db.notification.createMany({
      data: recipientIds.map((userId) => ({
        forUserId: userId,
        documentId: d.id,
        kind: 'REMINDER_NUDGE' as const,
        title,
        body,
        link,
      })),
    });
    // Note: no audit Comment for cron-triggered reminders — the Notification
    // itself is the record. (Comments require authorUserId; cron has none.)
    void holderLabel; // touched only for the body string; mark as used

    triggered++;
    recipients += recipientIds.length;
  }

  return {
    scanned: docs.length,
    triggered,
    recipients,
    skippedCooldown,
    skippedNotOverdue,
  };
}
