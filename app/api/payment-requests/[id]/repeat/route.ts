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

  // Only sender can repeat
  if (paymentReq.sender_id !== user.id) {
    return NextResponse.json({ error: 'Only sender can repeat' }, { status: 403 });
  }

  // Can only repeat declined requests
  if (paymentReq.status !== 3) {
    return NextResponse.json({ error: 'Can only repeat declined requests' }, { status: 400 });
  }

  // Check if already repeated
  if (paymentReq.repeated === 1) {
    return NextResponse.json(
      { error: 'You already repeated this request' },
      { status: 400 }
    );
  }

  const { data: newRequestId, error: repeatError } = await supabase.rpc(
    'repeat_payment_request',
    { p_request_id: id }
  );

  if (repeatError) {
    return NextResponse.json({ error: repeatError.message }, { status: 400 });
  }

  // Fetch and return the new request
  const { data: newRequest } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', newRequestId)
    .single();

  return NextResponse.json(newRequest, { status: 201 });
}
