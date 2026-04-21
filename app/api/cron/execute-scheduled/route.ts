import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { unauthorized, internalError } from '@/lib/errors';
import { sendScheduledPaymentFailedEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const supabase = await createClient();

  // Capture due requests before RPC so we can email on failure
  const { data: dueRequests } = await supabase
    .from('payment_requests')
    .select('id, amount, sender_id, recipient_id, recipient_email')
    .eq('status', 5)
    .lte('scheduled_payment_date', new Date().toISOString());

  const { error } = await supabase.rpc('execute_scheduled_payments');

  if (error) {
    console.error('Error executing scheduled payments:', error);
    return internalError(error.message);
  }

  // Send failure emails for requests that moved to status=7
  if (dueRequests?.length) {
    const ids = dueRequests.map((r) => r.id);
    const { data: failed } = await supabase
      .from('payment_requests')
      .select('id, amount, sender_id, recipient_id, recipient_email')
      .in('id', ids)
      .eq('status', 7);

    for (const req of failed ?? []) {
      ;(async () => {
        const payerId = req.recipient_id;
        if (!payerId) return;
        const { data: payer } = await supabase.from('users').select('email').eq('id', payerId).single();
        const { data: sender } = await supabase.from('users').select('first_name, last_name').eq('id', req.sender_id).single();
        if (payer?.email && sender) {
          await sendScheduledPaymentFailedEmail({
            payerEmail: payer.email,
            senderName: `${sender.first_name} ${sender.last_name}`,
            amount: req.amount,
            requestId: req.id,
          });
        }
      })().catch((err) => console.error("[email] fire-and-forget failed", err));
    }
  }

  return NextResponse.json({ success: true, message: 'Scheduled payments executed' });
}
