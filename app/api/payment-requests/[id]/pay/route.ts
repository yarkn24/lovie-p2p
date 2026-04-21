import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentReceivedEmail } from '@/lib/email';
import {
  unauthorized,
  forbidden,
  notFound,
  badRequest,
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
      'Only the recipient can pay this request.'
    );
  }

  if (paymentReq.status !== 1) {
    return conflict(
      'INVALID_STATUS',
      `Request is not pending (current status: ${paymentReq.status}).`
    );
  }

  if (
    paymentReq.expired === 1 ||
    new Date(paymentReq.expires_at) < new Date()
  ) {
    return badRequest('REQUEST_EXPIRED', 'This payment request has expired.');
  }

  const admin = createAdminClient();

  // Atomic: deduct payer, credit sender, insert transaction, flip status.
  // Runs in a single Postgres transaction inside execute_payment_v2 — partial
  // failure states (money deducted but status unchanged, etc.) are impossible.
  const { error: rpcErr } = await admin.rpc('execute_payment_v2', {
    p_request_id: id,
    p_payer_id: user.id,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('INSUFFICIENT_BALANCE')) {
      return badRequest('INSUFFICIENT_BALANCE', 'Your balance is insufficient to complete this payment.');
    }
    if (msg.includes('INVALID_STATUS')) {
      return conflict('INVALID_STATUS', 'Request is no longer pending.');
    }
    if (msg.includes('REQUEST_EXPIRED')) {
      return badRequest('REQUEST_EXPIRED', 'This payment request has expired.');
    }
    if (msg.includes('REQUEST_NOT_FOUND')) {
      return notFound('REQUEST_NOT_FOUND', 'Payment request not found.');
    }
    if (msg.includes('FORBIDDEN_NOT_RECIPIENT')) {
      return forbidden('FORBIDDEN_NOT_RECIPIENT', 'Only the recipient can pay this request.');
    }
    return internalError(msg || 'Payment failed.');
  }

  const { data: updated } = await admin
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  // Notify sender (fire-and-forget)
  ;(async () => {
    const { data: profiles } = await admin
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', [paymentReq.sender_id, user.id]);
    const sender = profiles?.find((p) => p.id === paymentReq.sender_id);
    const payer = profiles?.find((p) => p.id === user.id);
    if (sender?.email && payer) {
      await sendPaymentReceivedEmail({
        senderEmail: sender.email,
        payerName: `${payer.first_name} ${payer.last_name}`,
        amount: paymentReq.amount,
        requestId: id,
      });
    }
  })().catch((err) => console.error("[email] fire-and-forget failed", err));

  return NextResponse.json(updated);
}
