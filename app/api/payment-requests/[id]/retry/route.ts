import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, scheduled_payment_date } = await request.json();

  if (!action || !['pay_now', 'reschedule'].includes(action)) {
    return NextResponse.json({ error: 'action must be "pay_now" or "reschedule"' }, { status: 400 });
  }

  const { data: paymentReq, error: reqError } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (reqError || !paymentReq) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  // Only recipient can retry
  const isRecipient =
    paymentReq.recipient_id === user.id || paymentReq.recipient_email === user.email;

  if (!isRecipient) {
    return NextResponse.json({ error: 'Only recipient can retry' }, { status: 403 });
  }

  // Can only retry failed requests
  if (paymentReq.status !== 7) {
    return NextResponse.json({ error: 'Can only retry failed requests' }, { status: 400 });
  }

  if (paymentReq.expired === 1 || new Date(paymentReq.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Request expired' }, { status: 400 });
  }

  if (action === 'pay_now') {
    // Get sender balance
    const { data: sender } = await supabase
      .from('users')
      .select('balance')
      .eq('id', paymentReq.sender_id)
      .single();

    if (!sender || sender.balance < paymentReq.amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Ensure recipient_id is set
    let recipient_id = paymentReq.recipient_id;
    if (!recipient_id) {
      const { data: recipient } = await supabase
        .from('users')
        .select('id')
        .eq('email', paymentReq.recipient_email)
        .single();

      if (!recipient) {
        return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
      }
      recipient_id = recipient.id;
    }

    const { error: executeError } = await supabase.rpc('execute_payment', {
      p_request_id: id,
      p_from_user_id: paymentReq.sender_id,
      p_to_user_id: recipient_id,
      p_amount: paymentReq.amount,
    });

    if (executeError) {
      return NextResponse.json({ error: executeError.message }, { status: 400 });
    }

    const { data: updated } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json(updated);
  } else {
    // Reschedule
    if (!scheduled_payment_date) {
      return NextResponse.json(
        { error: 'scheduled_payment_date required for reschedule' },
        { status: 400 }
      );
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
}
