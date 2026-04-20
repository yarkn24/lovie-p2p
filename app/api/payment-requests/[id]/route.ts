import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Check authorization: must be sender or recipient
  const isAuthorized =
    paymentReq.sender_id === user.id ||
    paymentReq.recipient_id === user.id ||
    paymentReq.recipient_email === user.email;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check and update expiry if needed
  if (paymentReq.expired === 0 && new Date(paymentReq.expires_at) < new Date()) {
    await supabase
      .from('payment_requests')
      .update({ expired: 1, status: 4, updated_at: new Date().toISOString() })
      .eq('id', id);

    paymentReq.expired = 1;
    paymentReq.status = 4;
  }

  return NextResponse.json(paymentReq);
}
