import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
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
      'Only the sender can repeat this request.'
    );
  }

  if (paymentReq.status !== 3) {
    return conflict(
      'INVALID_STATUS',
      `Only declined requests can be repeated (current status: ${paymentReq.status}).`
    );
  }

  if (paymentReq.repeated === 1) {
    return conflict(
      'ALREADY_REPEATED',
      'This request has already been repeated.'
    );
  }

  const { data: newRequestId, error: repeatError } = await supabase.rpc(
    'repeat_payment_request',
    { p_request_id: id }
  );

  if (repeatError) return internalError(repeatError.message);

  const { data: newRequest } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', newRequestId)
    .single();

  return NextResponse.json(newRequest, { status: 201 });
}
