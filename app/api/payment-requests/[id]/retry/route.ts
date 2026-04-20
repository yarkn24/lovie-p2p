import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
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

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const scheduled_payment_date = body?.scheduled_payment_date;

  if (!action || !['pay_now', 'reschedule'].includes(action)) {
    return badRequest(
      'MISSING_FIELD',
      'action must be "pay_now" or "reschedule".',
      [{ field: 'action', issue: 'must be "pay_now" or "reschedule"' }]
    );
  }

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
      'Only the recipient can retry this request.'
    );
  }

  if (paymentReq.status !== 7) {
    return conflict(
      'INVALID_STATUS',
      `Only failed requests can be retried (current status: ${paymentReq.status}).`
    );
  }

  if (
    paymentReq.expired === 1 ||
    new Date(paymentReq.expires_at) < new Date()
  ) {
    return badRequest('REQUEST_EXPIRED', 'This payment request has expired.');
  }

  const admin = createAdminClient();

  if (action === 'pay_now') {
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

    const { data: updated, error: updateErr } = await admin
      .from('payment_requests')
      .update({ status: 2, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return internalError(updateErr.message);

    return NextResponse.json(updated);
  }

  // reschedule
  if (!scheduled_payment_date) {
    return badRequest(
      'MISSING_FIELD',
      'scheduled_payment_date is required for reschedule.',
      [{ field: 'scheduled_payment_date', issue: 'required' }]
    );
  }

  const scheduledDate = new Date(scheduled_payment_date);
  if (Number.isNaN(scheduledDate.getTime())) {
    return badRequest(
      'INVALID_DATE',
      'scheduled_payment_date must be a valid ISO date.',
      [{ field: 'scheduled_payment_date', issue: 'invalid date format' }]
    );
  }

  if (scheduledDate > new Date(paymentReq.expires_at)) {
    return badRequest(
      'INVALID_SCHEDULE_DATE',
      'scheduled_payment_date must be on or before the expiration date.',
      [
        {
          field: 'scheduled_payment_date',
          issue: `must be before ${paymentReq.expires_at}`,
        },
      ]
    );
  }

  const { data: updated, error: updateError } = await admin
    .from('payment_requests')
    .update({
      status: 5,
      scheduled_payment_date: scheduledDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return internalError(updateError.message);

  return NextResponse.json(updated);
}
