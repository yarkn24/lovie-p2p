import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: paymentReq, error: reqError } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (reqError || !paymentReq) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  // Only recipient can pay
  const isRecipient =
    paymentReq.recipient_id === user.id || paymentReq.recipient_email === user.email;

  if (!isRecipient) {
    return NextResponse.json({ error: 'Only recipient can pay' }, { status: 403 });
  }

  if (paymentReq.status !== 1) {
    return NextResponse.json({ error: 'Request is not pending' }, { status: 400 });
  }

  if (paymentReq.expired === 1 || new Date(paymentReq.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Request expired' }, { status: 400 });
  }

  const { data: payer } = await supabase
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (!payer || payer.balance < paymentReq.amount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
  }

  const { error: updateError } = await supabase.rpc('execute_payment', {
    p_request_id: id,
    p_from_user_id: user.id,
    p_to_user_id: paymentReq.sender_id,
    p_amount: paymentReq.amount,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { data: updated } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  return NextResponse.json(updated);
}
