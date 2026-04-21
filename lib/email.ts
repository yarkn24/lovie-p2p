import { Resend } from 'resend';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lovie-p2p-gules.vercel.app';
const FROM = 'Lovie <onboarding@resend.dev>';

// Lazy init — avoids "Missing API key" crash at build time
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

// ─── Lovie brand palette ──────────────────────────────────────────────────────
// Dark navy: #0a0f1e  |  Brand blue: #2563eb  |  Cyan: #06b6d4
// Gradient:  linear-gradient(135deg, #2563eb, #06b6d4)

const fmtUSD = (c: number) =>
  (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LOGO_IMG = `<img src="${BASE_URL}/lovie-logo.png" width="36" height="36" alt="Lovie" style="display:inline-block;vertical-align:middle;margin-right:10px;" />`;

// ─── Shared primitives ────────────────────────────────────────────────────────

function shell(statusColor: string, statusLabel: string, title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

    <!-- Header -->
    <tr><td style="background:#0a0f1e;border-radius:12px 12px 0 0;padding:22px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            ${LOGO_IMG}
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.4px;vertical-align:middle;">lovie</span>
          </td>
          <td align="right">
            <span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:${statusColor};border:1px solid ${statusColor};">
              ${statusLabel}
            </span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Card -->
    <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
      <div style="height:3px;background:linear-gradient(90deg,#2563eb,#06b6d4);"></div>
      <div style="padding:32px 36px;">
        <h1 style="margin:0 0 8px;font-size:21px;font-weight:700;color:#0a0f1e;letter-spacing:-0.4px;">${title}</h1>
        ${body}
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #f1f5f9;padding:18px 36px;background:#f8fafc;">
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
          Lovie · Agent-Native Banking ·
          <a href="mailto:support@lovie.co" style="color:#94a3b8;text-decoration:underline;">support@lovie.co</a>
        </p>
      </div>
    </td></tr>

  </table>
  </td></tr>
  </table>

</body>
</html>`;
}

function divider() {
  return `<div style="height:1px;background:#f1f5f9;margin:24px 0;"></div>`;
}

function amountHero(amount: number, sub: string, gradient = 'linear-gradient(135deg,#2563eb,#06b6d4)') {
  return `<div style="margin:24px 0;padding:24px 28px;background:${gradient};border-radius:10px;">
    <p style="margin:0;font-size:34px;font-weight:800;color:#ffffff;letter-spacing:-1.5px;">${fmtUSD(amount)}</p>
    <p style="margin:5px 0 0;font-size:13px;color:rgba(255,255,255,0.75);font-weight:500;">${sub}</p>
  </div>`;
}

function noteQuote(note: string | null) {
  if (!note) return '';
  return `<p style="margin:16px 0;padding:12px 16px;border-left:3px solid #2563eb;color:#475569;font-size:14px;font-style:italic;background:#f8fafc;border-radius:0 6px 6px 0;">"${esc(note)}"</p>`;
}

function cta(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:13px 28px;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">${label} →</a>`;
}

function metaRow(label: string, value: string) {
  return `<tr>
    <td style="padding:7px 0;font-size:12px;color:#94a3b8;width:130px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;vertical-align:top;">${label}</td>
    <td style="padding:7px 0;font-size:13px;color:#1e293b;font-weight:500;">${value}</td>
  </tr>`;
}

function metaTable(rows: string) {
  return `${divider()}<table cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>`;
}

function body(text: string) {
  return `<p style="margin:12px 0 0;font-size:15px;color:#475569;line-height:1.65;">${text}</p>`;
}

async function send(to: string, subject: string, html: string) {
  try {
    const { error } = await getResend().emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[email] delivery failed', { to, subject, error: error.message });
      throw new Error(`Email send failed: ${error.message}`);
    }
  } catch (err) {
    console.error('[email] send threw', { to, subject, err: err instanceof Error ? err.message : err });
    throw err;
  }
}

// ─── 1. New request — unregistered recipient ─────────────────────────────────

export async function sendNewRequestEmail(args: {
  recipientEmail: string;
  senderName: string;
  amount: number;
  note: string | null;
  requestId: string;
}) {
  const url = `${BASE_URL}/requests/${args.requestId}/share?e=${encodeURIComponent(args.recipientEmail)}`;
  const safeSender = esc(args.senderName);
  const html = shell('#06b6d4', 'Action Required', `${safeSender} sent you a payment request`, `
    ${body(`<strong style="color:#0a0f1e;">${safeSender}</strong> is requesting money from you via Lovie. Create a free account to pay, decline, or schedule.`)}
    ${amountHero(args.amount, 'amount requested')}
    ${noteQuote(args.note)}
    ${metaTable(
      metaRow('From', safeSender) +
      metaRow('Expires', '7 days') +
      metaRow('Account', 'Sign up free on Lovie')
    )}
    ${cta(url, 'View & respond to request')}
  `);
  await send(args.recipientEmail, `${args.senderName} is requesting ${fmtUSD(args.amount)} from you`, html);
}

// ─── 2. New request — registered recipient ────────────────────────────────────

export async function sendNewRequestRegisteredEmail(args: {
  recipientEmail: string;
  senderName: string;
  amount: number;
  note: string | null;
  requestId: string;
}) {
  const url = `${BASE_URL}/requests/${args.requestId}`;
  const safeSender = esc(args.senderName);
  const html = shell('#06b6d4', 'Action Required', `${safeSender} sent you a payment request`, `
    ${body(`<strong style="color:#0a0f1e;">${safeSender}</strong> sent you a payment request on Lovie. Pay now, decline, or schedule a future payment.`)}
    ${amountHero(args.amount, 'amount requested')}
    ${noteQuote(args.note)}
    ${metaTable(
      metaRow('From', safeSender) +
      metaRow('Expires', '7 days from now')
    )}
    ${cta(url, 'Pay, decline or schedule')}
  `);
  await send(args.recipientEmail, `${args.senderName} is requesting ${fmtUSD(args.amount)} from you`, html);
}

// ─── 3. Payment received — notify sender ─────────────────────────────────────

export async function sendPaymentReceivedEmail(args: {
  senderEmail: string;
  payerName: string;
  amount: number;
  requestId: string;
}) {
  const url = `${BASE_URL}/requests/${args.requestId}`;
  const safePayer = esc(args.payerName);
  const html = shell('#10b981', 'Paid', `You received ${fmtUSD(args.amount)}`, `
    ${body(`<strong style="color:#0a0f1e;">${safePayer}</strong> paid your request. The amount has been added to your Lovie balance.`)}
    ${amountHero(args.amount, 'received · balance updated', 'linear-gradient(135deg,#059669,#10b981)')}
    ${metaTable(
      metaRow('Paid by', safePayer) +
      metaRow('Status', 'Paid — balance updated')
    )}
    ${cta(url, 'View transaction')}
  `);
  await send(args.senderEmail, `${args.payerName} paid your request — ${fmtUSD(args.amount)} received`, html);
}

// ─── 4. Request declined — notify sender ─────────────────────────────────────

export async function sendRequestDeclinedEmail(args: {
  senderEmail: string;
  recipientName: string;
  amount: number;
  requestId: string;
}) {
  const url = `${BASE_URL}/requests/${args.requestId}`;
  const safeRecipient = esc(args.recipientName);
  const html = shell('#f43f5e', 'Declined', `${safeRecipient} declined your request`, `
    ${body(`<strong style="color:#0a0f1e;">${safeRecipient}</strong> declined your payment request. You can send a new request once from the request detail page.`)}
    ${amountHero(args.amount, 'declined', 'linear-gradient(135deg,#e11d48,#f43f5e)')}
    ${metaTable(
      metaRow('Declined by', safeRecipient) +
      metaRow('Next step', 'Send a new request (one-time)')
    )}
    ${cta(url, 'View request')}
  `);
  await send(args.senderEmail, `${args.recipientName} declined your ${fmtUSD(args.amount)} request`, html);
}

// ─── 5. Payment scheduled — notify sender ────────────────────────────────────

export async function sendPaymentScheduledEmail(args: {
  senderEmail: string;
  payerName: string;
  amount: number;
  scheduledDate: string;
  requestId: string;
}) {
  const url = `${BASE_URL}/requests/${args.requestId}`;
  const dateStr = new Date(args.scheduledDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const safePayer = esc(args.payerName);
  const html = shell('#2563eb', 'Scheduled', `Payment scheduled for ${fmtUSD(args.amount)}`, `
    ${body(`<strong style="color:#0a0f1e;">${safePayer}</strong> scheduled your payment. It will be processed automatically on the scheduled date.`)}
    ${amountHero(args.amount, 'scheduled')}
    ${metaTable(
      metaRow('Scheduled by', safePayer) +
      metaRow('Date', esc(dateStr)) +
      metaRow('Status', 'Will auto-process on schedule')
    )}
    ${cta(url, 'View request')}
  `);
  await send(args.senderEmail, `${args.payerName} scheduled your ${fmtUSD(args.amount)} request`, html);
}

// ─── 6. Request cancelled — notify recipient ─────────────────────────────────

export async function sendRequestCancelledEmail(args: {
  recipientEmail: string;
  senderName: string;
  amount: number;
}) {
  const safeSender = esc(args.senderName);
  const html = shell('#64748b', 'Cancelled', `${safeSender} cancelled their request`, `
    ${body(`<strong style="color:#0a0f1e;">${safeSender}</strong> cancelled their payment request. No action is needed from you.`)}
    ${amountHero(args.amount, 'cancelled', 'linear-gradient(135deg,#475569,#64748b)')}
    ${metaTable(metaRow('Cancelled by', safeSender))}
  `);
  await send(args.recipientEmail, `${args.senderName} cancelled their ${fmtUSD(args.amount)} request`, html);
}

// ─── 7. Scheduled payment failed — notify payer ──────────────────────────────

export async function sendScheduledPaymentFailedEmail(args: {
  payerEmail: string;
  senderName: string;
  amount: number;
  requestId: string;
}) {
  const url = `${BASE_URL}/requests/${args.requestId}`;
  const safeSender = esc(args.senderName);
  const html = shell('#f43f5e', 'Action Required', `Scheduled payment of ${fmtUSD(args.amount)} failed`, `
    ${body(`Your scheduled payment to <strong style="color:#0a0f1e;">${safeSender}</strong> couldn't be processed — your Lovie balance was insufficient. Please top up and retry.`)}
    ${amountHero(args.amount, 'payment failed', 'linear-gradient(135deg,#e11d48,#f43f5e)')}
    ${metaTable(
      metaRow('Reason', 'Insufficient balance') +
      metaRow('To', safeSender) +
      metaRow('Next step', 'Top up balance, then retry or reschedule')
    )}
    ${cta(url, 'Retry or reschedule')}
  `);
  await send(args.payerEmail, `Action needed: scheduled payment of ${fmtUSD(args.amount)} to ${args.senderName} failed`, html);
}
