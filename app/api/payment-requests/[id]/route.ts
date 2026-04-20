import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { unauthorized, forbidden, notFound } from '@/lib/errors';

export async function GET(
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

  const isAuthorized =
    paymentReq.sender_id === user.id ||
    paymentReq.recipient_id === user.id ||
    paymentReq.recipient_email === user.email;

  if (!isAuthorized) {
    return forbidden(
      'FORBIDDEN_NOT_PARTICIPANT',
      'You do not have access to this payment request.'
    );
  }

  if (
    paymentReq.expired === 0 &&
    new Date(paymentReq.expires_at) < new Date()
  ) {
    await supabase
      .from('payment_requests')
      .update({ expired: 1, status: 4, updated_at: new Date().toISOString() })
      .eq('id', id);

    paymentReq.expired = 1;
    paymentReq.status = 4;
  }

  return NextResponse.json(paymentReq);
}
