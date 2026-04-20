import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentScheduledEmail } from '@/lib/email';
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
  if (!body?.scheduled_payment_date) {
    return badRequest('MISSING_FIELD', 'scheduled_payment_date is required.', [
      { field: 'scheduled_payment_date', issue: 'required' },
    ]);
  }

  const scheduledDate = new Date(body.scheduled_payment_date);
  if (Number.isNaN(scheduledDate.getTime())) {
    return badRequest(
      'INVALID_DATE',
      'scheduled_payment_date must be a valid ISO date.',
      [{ field: 'scheduled_payment_date', issue: 'invalid date format' }]
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
      'Only the recipient can schedule this payment.'
    );
  }

  if (paymentReq.status !== 1 && paymentReq.status !== 7) {
    return conflict(
      'INVALID_STATUS',
      `Only pending or failed requests can be scheduled (current status: ${paymentReq.status}).`
    );
  }

  if (
    paymentReq.expired === 1 ||
    new Date(paymentReq.expires_at) < new Date()
  ) {
    return badRequest('REQUEST_EXPIRED', 'This payment request has expired.');
  }

  if (scheduledDate <= new Date()) {
    return badRequest(
      'INVALID_SCHEDULE_DATE',
      'scheduled_payment_date must be in the future.',
      [{ field: 'scheduled_payment_date', issue: 'must be in the future' }]
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

  const admin = createAdminClient();
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

  ;(async () => {
    const { data: sender } = await supabase.from('users').select('email').eq('id', paymentReq.sender_id).single();
    const { data: payer } = await supabase.from('users').select('first_name, last_name').eq('id', user.id).single();
    if (sender?.email && payer) {
      await sendPaymentScheduledEmail({
        senderEmail: sender.email,
        payerName: `${payer.first_name} ${payer.last_name}`,
        amount: paymentReq.amount,
        scheduledDate: scheduledDate.toISOString(),
        requestId: id,
      });
    }
  })().catch(() => {});

  return NextResponse.json(updated);
}
