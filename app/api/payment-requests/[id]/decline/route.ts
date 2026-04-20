import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendRequestDeclinedEmail } from '@/lib/email';
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

  const admin = createAdminClient();
  const { data: updated, error: updateError } = await admin
    .from('payment_requests')
    .update({ status: 3, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return internalError(updateError.message);

  ;(async () => {
    const { data: sender } = await supabase.from('users').select('email').eq('id', paymentReq.sender_id).single();
    const { data: decliner } = await supabase.from('users').select('first_name, last_name').eq('id', user.id).single();
    if (sender?.email && decliner) {
      await sendRequestDeclinedEmail({
        senderEmail: sender.email,
        recipientName: `${decliner.first_name} ${decliner.last_name}`,
        amount: paymentReq.amount,
        requestId: id,
      });
    }
  })().catch(() => {});

  return NextResponse.json(updated);
}
