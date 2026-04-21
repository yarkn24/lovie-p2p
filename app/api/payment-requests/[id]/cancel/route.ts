import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendRequestCancelledEmail } from '@/lib/email';
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

  if (paymentReq.sender_id !== user.id) {
    return forbidden(
      'FORBIDDEN_NOT_SENDER',
      'Only the sender can cancel this request.'
    );
  }

  if (paymentReq.status !== 1) {
    return conflict(
      'INVALID_STATUS',
      `Only pending requests can be cancelled (current status: ${paymentReq.status}).`
    );
  }

  // RLS policy "Senders can cancel" allows this with status=6 + sender check,
  // so defense-in-depth: use user-scoped client for the UPDATE.
  const { data: updated, error: updateError } = await supabase
    .from('payment_requests')
    .update({ status: 6, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return internalError(updateError.message);

  ;(async () => {
    const { data: sender } = await supabase.from('users').select('first_name, last_name').eq('id', user.id).single();
    if (sender) {
      await sendRequestCancelledEmail({
        recipientEmail: paymentReq.recipient_email,
        senderName: `${sender.first_name} ${sender.last_name}`,
        amount: paymentReq.amount,
      });
    }
  })().catch((err) => console.error("[email] fire-and-forget failed", err));

  return NextResponse.json(updated);
}
