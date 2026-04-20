import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lovie-p2p-gules.vercel.app';

export async function sendPaymentRequestEmail({
  recipientEmail,
  senderName,
  amount,
  note,
  requestId,
}: {
  recipientEmail: string;
  senderName: string;
  amount: number; // in cents
  note: string | null;
  requestId: string;
}) {
  const fmtUSD = (c: number) =>
    (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const shareUrl = `${BASE_URL}/requests/${requestId}/share`;
  const amountFormatted = fmtUSD(amount);

  const noteHtml = note
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid #e5e7eb;border-radius:4px;color:#374151;font-style:italic;">"${note}"</p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#18181b;padding:24px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:600;letter-spacing:-0.5px;">Lovie</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#18181b;">You have a payment request</h1>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
        <strong style="color:#18181b;">${senderName}</strong> is requesting money from you.
      </p>

      <div style="background:#f9fafb;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;font-weight:700;color:#18181b;letter-spacing:-1px;">${amountFormatted}</div>
        <div style="font-size:13px;color:#9ca3af;margin-top:4px;">requested by ${senderName}</div>
      </div>

      ${noteHtml}

      <a href="${shareUrl}" style="display:block;background:#18181b;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:24px 0 0;">
        View &amp; Pay Request
      </a>

      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        This request expires in 7 days. If you don't have a Lovie account, you'll be prompted to create one.
      </p>
    </div>
  </div>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: 'Lovie <onboarding@resend.dev>',
    to: recipientEmail,
    subject: `${senderName} requested ${amountFormatted} from you`,
    html,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
}
