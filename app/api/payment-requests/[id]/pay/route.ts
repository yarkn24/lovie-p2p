import { createClient } from '@/lib/supabase/server';
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

  const { error: execError } = await supabase.rpc('execute_payment', {
    p_request_id: id,
    p_from_user_id: user.id,
    p_to_user_id: paymentReq.sender_id,
    p_amount: paymentReq.amount,
  });

  if (execError) {
    const msg = execError.message;
    if (msg.includes('INSUFFICIENT_BALANCE'))
      return badRequest('INSUFFICIENT_BALANCE', 'Your balance is insufficient to complete this payment.');
    if (msg.includes('INVALID_STATUS'))
      return conflict('INVALID_STATUS', 'Request is no longer pending.');
    if (msg.includes('REQUEST_NOT_FOUND'))
      return notFound('REQUEST_NOT_FOUND', 'Payment request not found.');
    return internalError(msg);
  }

  const { data: updated } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  return NextResponse.json(updated);
}
