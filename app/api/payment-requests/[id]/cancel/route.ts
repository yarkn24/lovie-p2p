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

  if (paymentReq.sender_id !== user.id) {
    return NextResponse.json({ error: 'Only sender can cancel' }, { status: 403 });
  }

  if (paymentReq.status !== 1) {
    return NextResponse.json({ error: 'Can only cancel pending requests' }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('payment_requests')
    .update({ status: 6, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json(updated);
}
