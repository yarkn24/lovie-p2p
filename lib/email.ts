import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lovie-p2p-gules.vercel.app';
const FROM = 'Lovie <onboarding@resend.dev>';

const fmtUSD = (c: number) =>
  (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// ─── Shared primitives ────────────────────────────────────────────────────────

function shell(accentColor: string, icon: string, title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:24px;">
          <span style="font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">lovie</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">

          <!-- Accent bar -->
          <div style="height:4px;background:${accentColor};"></div>

          <!-- Body -->
          <div style="padding:32px 36px;">
            <!-- Icon + heading -->
            <p style="margin:0 0 4px;font-size:28px;">${icon}</p>
            <h1 style="margin:8px 0 0;font-size:20px;font-weight:600;color:#18181b;letter-spacing:-0.3px;">${title}</h1>

            ${body}
          </div>

          <!-- Footer rule -->
          <div style="height:1px;background:#f4f4f5;margin:0 36px;"></div>
          <div style="padding:20px 36px;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
              You're receiving this because you have a Lovie account.
              Questions? <a href="mailto:support@lovie.co" style="color:#a1a1aa;">support@lovie.co</a>
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
  return `<div style="height:1px;background:#f4f4f5;margin:24px 0;"></div>`;
}

function amountHero(amount: number, sub: string) {
  return `<div style="margin:24px 0;padding:20px 24px;background:#fafafa;border-radius:8px;border:1px solid #f4f4f5;">
    <p style="margin:0;font-size:32px;font-weight:700;color:#18181b;letter-spacing:-1px;">${fmtUSD(amount)}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#71717a;">${sub}</p>
  </div>`;
}

function noteQuote(note: string | null) {
  if (!note) return '';
  return `<p style="margin:16px 0;padding:12px 16px;border-left:3px solid #e4e4e7;color:#52525b;font-size:14px;font-style:italic;background:#fafafa;border-radius:0 6px 6px 0;">"${note}"</p>`;
}

function cta(href: string, label: string, color = '#18181b') {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:${color};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:7px;letter-spacing:0.1px;">${label} →</a>`;
}

function metaRow(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#71717a;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;font-size:13px;color:#18181b;font-weight:500;">${value}</td>
  </tr>`;
}

function metaTable(rows: string) {
  return `${divider()}<table cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>`;
}

async function send(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Email send failed: ${error.message}`);
}

// ─── 1. New request — unregistered recipient ─────────────────────────────────

export async function sendNewRequestEmail(args: {
  recipientEmail: string;
  senderName: string;
  amount: number;
  note: string | null;
  requestId: string;
}) {
  const url = `${BASE_URL}/requests/${args.requestId}/share`;
  const body = `
    <p style="margin:16px 0 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong style="color:#18181b;">${args.senderName}</strong> sent you a payment request.
      Review it and choose to pay, decline, or schedule.
    </p>
    ${amountHero(args.amount, 'amount requested')}
    ${noteQuote(args.note)}
    ${metaTable(
      metaRow('From', args.senderName) +
      metaRow('Expires', '7 days from now') +
      metaRow('Account', 'Sign up free on Lovie')
    )}
    ${cta(url, 'View request')}
  `;
  const html = shell('#18181b', '💸', `${args.senderName} sent you a payment request`, body);
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
  const body = `
    <p style="margin:16px 0 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong style="color:#18181b;">${args.senderName}</strong> sent you a payment request.
    </p>
    ${amountHero(args.amount, 'amount requested')}
    ${noteQuote(args.note)}
    ${metaTable(
      metaRow('From', args.senderName) +
      metaRow('Expires', '7 days from now')
    )}
    ${cta(url, 'Pay, decline or schedule')}
  `;
  const html = shell('#18181b', '💸', `${args.senderName} sent you a payment request`, body);
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
  const body = `
    <p style="margin:16px 0 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong style="color:#18181b;">${args.payerName}</strong> paid your request.
      The amount has been added to your Lovie balance.
    </p>
    ${amountHero(args.amount, 'received')}
    ${metaTable(
      metaRow('Paid by', args.payerName) +
      metaRow('Status', 'Paid · balance updated')
    )}
    ${cta(url, 'View transaction', '#16a34a')}
  `;
  const html = shell('#16a34a', '✅', `You received ${fmtUSD(args.amount)}`, body);
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
  const body = `
    <p style="margin:16px 0 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong style="color:#18181b;">${args.recipientName}</strong> declined your payment request.
      You can send a new request from the request detail page.
    </p>
    ${amountHero(args.amount, 'declined')}
    ${metaTable(
      metaRow('Declined by', args.recipientName) +
      metaRow('Next step', 'Send a new request (one-time)')
    )}
    ${cta(url, 'View request')}
  `;
  const html = shell('#dc2626', '❌', `${args.recipientName} declined your request`, body);
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
  const body = `
    <p style="margin:16px 0 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong style="color:#18181b;">${args.payerName}</strong> scheduled your payment.
      You'll be notified once it's processed.
    </p>
    ${amountHero(args.amount, 'scheduled')}
    ${metaTable(
      metaRow('Scheduled by', args.payerName) +
      metaRow('Date', dateStr)
    )}
    ${cta(url, 'View request', '#2563eb')}
  `;
  const html = shell('#2563eb', '📅', `Payment scheduled for ${fmtUSD(args.amount)}`, body);
  await send(args.senderEmail, `${args.payerName} scheduled your ${fmtUSD(args.amount)} request`, html);
}

// ─── 6. Request cancelled — notify recipient ─────────────────────────────────

export async function sendRequestCancelledEmail(args: {
  recipientEmail: string;
  senderName: string;
  amount: number;
}) {
  const body = `
    <p style="margin:16px 0 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong style="color:#18181b;">${args.senderName}</strong> cancelled their payment request.
      No action is needed from you.
    </p>
    ${amountHero(args.amount, 'cancelled')}
    ${metaTable(metaRow('Cancelled by', args.senderName))}
  `;
  const html = shell('#71717a', '🚫', `${args.senderName} cancelled their request`, body);
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
  const body = `
    <p style="margin:16px 0 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Your scheduled payment to <strong style="color:#18181b;">${args.senderName}</strong> failed
      due to insufficient balance. Please top up your balance and retry.
    </p>
    ${amountHero(args.amount, 'payment failed')}
    ${metaTable(
      metaRow('Reason', 'Insufficient balance') +
      metaRow('Next step', 'Top up balance, then retry or reschedule')
    )}
    ${cta(url, 'Retry payment', '#dc2626')}
  `;
  const html = shell('#dc2626', '⚠️', `Scheduled payment of ${fmtUSD(args.amount)} failed`, body);
  await send(args.payerEmail, `Action needed: scheduled payment of ${fmtUSD(args.amount)} to ${args.senderName} failed`, html);
}
