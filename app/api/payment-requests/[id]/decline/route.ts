import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendRequestDeclinedEmail } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import {
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
} from '@/lib/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const { data: paymentReq, error: reqError } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (reqError || !paymentReq) {
    return notFound('REQUEST_NOT_FOUND', 'Payment request not found.');
  }

  const isRecipient =
    paymentReq.recipient_id === user.id ||
    paymentReq.recipient_email === user.email;

  if (!isRecipient) {
    return forbidden(
      'FORBIDDEN_NOT_RECIPIENT',
      'Only the recipient can decline this request.'
    );
  }

  if (paymentReq.status !== 1) {
    return conflict(
      'INVALID_STATUS',
      `Request is not pending (current status: ${paymentReq.status}).`
    );
  }

  // RLS policy "Recipients can decline" allows this with status=3 + recipient check,
  // so defense-in-depth: use user-scoped client for the UPDATE.
  const { data: updated, error: updateError } = await supabase
    .from('payment_requests')
    .update({ status: 3, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return internalError(updateError.message);

  const admin = createAdminClient();
  ;(async () => {
    const { data: profiles } = await admin
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', [paymentReq.sender_id, user.id]);
    const sender = profiles?.find((p) => p.id === paymentReq.sender_id);
    const decliner = profiles?.find((p) => p.id === user.id);
    if (sender && decliner) {
      const declinerName = `${decliner.first_name} ${decliner.last_name}`;
      const senderName = `${sender.first_name} ${sender.last_name}`;
      const amt = (paymentReq.amount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      await createNotification(paymentReq.sender_id, `${declinerName} declined your ${amt} request.`, id);
      if (sender.email) {
        await sendRequestDeclinedEmail({ senderEmail: sender.email, recipientName: declinerName, amount: paymentReq.amount, requestId: id })
          .catch((err) => console.error('[email] decline notification failed', err));
      }
    }
  })().catch((err) => console.error("[email] fire-and-forget failed", err));

  return NextResponse.json(updated);
}
