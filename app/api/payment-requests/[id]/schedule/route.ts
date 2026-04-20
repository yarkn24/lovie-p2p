import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { scheduled_payment_date } = await request.json();

  if (!scheduled_payment_date) {
    return NextResponse.json({ error: 'scheduled_payment_date is required' }, { status: 400 });
  }

  const { data: paymentReq, error: reqError } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (reqError || !paymentReq) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  // Only recipient can schedule
  const isRecipient =
    paymentReq.recipient_id === user.id || paymentReq.recipient_email === user.email;

  if (!isRecipient) {
    return NextResponse.json({ error: 'Only recipient can schedule' }, { status: 403 });
  }

  // Can only schedule pending or failed requests
  if (paymentReq.status !== 1 && paymentReq.status !== 7) {
    return NextResponse.json(
      { error: 'Can only schedule pending or failed requests' },
      { status: 400 }
    );
  }

  if (paymentReq.expired === 1 || new Date(paymentReq.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Request expired' }, { status: 400 });
  }

  const scheduledDate = new Date(scheduled_payment_date);
  const expiresDate = new Date(paymentReq.expires_at);

  if (scheduledDate > expiresDate) {
    return NextResponse.json(
      { error: 'scheduled_payment_date must be before expiration' },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('payment_requests')
    .update({
      status: 5,
      scheduled_payment_date: scheduledDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json(updated);
}
