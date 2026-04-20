import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData, error } = await supabase
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ balance: userData.balance });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, amount } = await request.json();

  if (!action || !['add', 'subtract'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "add" or "subtract"' },
      { status: 400 }
    );
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  // Use RLS to ensure user can only modify their own balance
  const amountInCents = Math.round(amount * 100);
  const delta = action === 'add' ? amountInCents : -amountInCents;

  // Get current balance first
  const { data: current } = await supabase
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (!current) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const newBalance = current.balance + delta;

  const { data: updated, error } = await supabase
    .from('users')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('balance')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ balance: updated.balance });
}
