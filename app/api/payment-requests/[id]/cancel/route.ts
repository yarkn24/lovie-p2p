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
      'Only the sender can cancel this request.'
    );
  }

  if (paymentReq.status !== 1) {
    return conflict(
      'INVALID_STATUS',
      `Only pending requests can be cancelled (current status: ${paymentReq.status}).`
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('payment_requests')
    .update({ status: 6, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return internalError(updateError.message);

  return NextResponse.json(updated);
}
