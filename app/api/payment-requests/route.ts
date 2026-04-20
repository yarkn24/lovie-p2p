import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { recipient_email, amount, note } = await request.json();

  if (!recipient_email || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let recipient_id = null;
  if (recipient_email !== user.email) {
    const { data: recipient } = await supabase
      .from('users')
      .select('id')
      .eq('email', recipient_email)
      .single();

    if (recipient) {
      recipient_id = recipient.id;
    }
  }

  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      sender_id: user.id,
      recipient_id,
      recipient_email,
      amount: Math.round(amount * 100),
      status: 1,
      expires_at,
      note,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const direction = request.nextUrl.searchParams.get('direction') || 'incoming';
  const statuses = request.nextUrl.searchParams.getAll('status');
  const search = request.nextUrl.searchParams.get('search') || '';

  let query = supabase
    .from('payment_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (direction === 'incoming') {
    query = query.or(`recipient_id.eq.${user.id},recipient_email.eq.${user.email}`);
  } else {
    query = query.eq('sender_id', user.id);
  }

  if (statuses.length > 0) {
    const statusNums = statuses.map(Number);
    query = query.in('status', statusNums);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data || []);
}
