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
    // Atomic via execute_retry_payment_v2 — SELECT ... FOR UPDATE + all
    // mutations in a single transaction. Prevents partial-failure states
    // (e.g. payer deducted but status not flipped) and double-retry races.
    const { error: rpcErr } = await admin.rpc('execute_retry_payment_v2', {
      p_request_id: id,
      p_payer_id: user.id,
    });

    if (rpcErr) {
      const msg = rpcErr.message ?? '';
      if (msg.includes('INSUFFICIENT_BALANCE')) {
        return badRequest('INSUFFICIENT_BALANCE', 'Your balance is insufficient to complete this payment.');
      }
      if (msg.includes('INVALID_STATUS')) {
        return conflict('INVALID_STATUS', 'Request is no longer in a failed state.');
      }
      if (msg.includes('REQUEST_EXPIRED')) {
        return badRequest('REQUEST_EXPIRED', 'This payment request has expired.');
      }
      if (msg.includes('REQUEST_NOT_FOUND')) {
        return notFound('REQUEST_NOT_FOUND', 'Payment request not found.');
      }
      if (msg.includes('FORBIDDEN_NOT_RECIPIENT')) {
        return forbidden('FORBIDDEN_NOT_RECIPIENT', 'Only the recipient can retry this request.');
      }
      return internalError(msg || 'Retry payment failed.');
    }

    const { data: updated } = await admin
      .from('payment_requests')
      .select('*')
      .eq('id', id)
      .single();

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

  // CAS guard: only transition status=7 → 5. If a concurrent request has
  // already moved this row (repeat, re-retry, expire), .maybeSingle() returns
  // null and we surface 409 rather than silently overwriting.
  const { data: updated, error: updateError } = await admin
    .from('payment_requests')
    .update({
      status: 5,
      scheduled_payment_date: scheduledDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 7)
    .select()
    .maybeSingle();

  if (updateError) return internalError(updateError.message);
  if (!updated) {
    return conflict(
      'INVALID_STATUS',
      'Request is no longer in a failed state.'
    );
  }

  return NextResponse.json(updated);
}
