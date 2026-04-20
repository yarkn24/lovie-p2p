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

  // Check payer balance
  const { data: payerProfile, error: balErr } = await admin
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (balErr || !payerProfile) return internalError('Could not fetch balance.');

  if (payerProfile.balance < paymentReq.amount) {
    return badRequest(
      'INSUFFICIENT_BALANCE',
      'Your balance is insufficient to complete this payment.'
    );
  }

  // Deduct from payer
  const { error: deductErr } = await admin
    .from('users')
    .update({ balance: payerProfile.balance - paymentReq.amount, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (deductErr) return internalError(deductErr.message);

  // Credit sender
  const { data: senderProfile } = await admin
    .from('users')
    .select('balance')
    .eq('id', paymentReq.sender_id)
    .single();

  if (senderProfile) {
    await admin
      .from('users')
      .update({ balance: senderProfile.balance + paymentReq.amount, updated_at: new Date().toISOString() })
      .eq('id', paymentReq.sender_id);
  }

  // Record transaction
  await admin.from('payment_transactions').insert({
    request_id: id,
    from_user_id: user.id,
    to_user_id: paymentReq.sender_id,
    amount: paymentReq.amount,
    transaction_type: 'manual_pay',
    status: 'success',
    paid_at: new Date().toISOString(),
  });

  // Mark request as paid
  const { data: updated, error: updateErr } = await admin
    .from('payment_requests')
    .update({ status: 2, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) return internalError(updateErr.message);

  // Notify sender (fire-and-forget)
  ;(async () => {
    const { data: sender } = await admin.from('users').select('email, first_name, last_name').eq('id', paymentReq.sender_id).single();
    const { data: payer } = await admin.from('users').select('first_name, last_name').eq('id', user.id).single();
    if (sender?.email && payer) {
      await sendPaymentReceivedEmail({
        senderEmail: sender.email,
        payerName: `${payer.first_name} ${payer.last_name}`,
        amount: paymentReq.amount,
        requestId: id,
      });
    }
  })().catch(() => {});

  return NextResponse.json(updated);
}
