import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ balance: data.balance });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { action, amount } = body ?? {};

  if (!action || !['add', 'subtract'].includes(action)) {
    return NextResponse.json({ error: 'action must be "add" or "subtract"' }, { status: 400 });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  const amountInCents = Math.round(amount * 100);
  if (amountInCents <= 0) {
    return NextResponse.json({ error: 'amount rounds to zero' }, { status: 400 });
  }

  const delta = action === 'add' ? amountInCents : -amountInCents;

  // Try adjust_balance RPC (atomic, migration 0004) first; fall back to
  // optimistic-lock loop so code deploys safely before migration is applied.
  const { data: rpcData, error: rpcError } = await supabase.rpc('adjust_balance', {
    p_user_id: user.id,
    p_delta: delta,
  });

  if (!rpcError) {
    return NextResponse.json({ balance: rpcData });
  }

  // RPC not yet deployed — optimistic-lock fallback (C2+C3 partial fix)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current } = await supabase
      .from('users')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const newBalance = current.balance + delta;
    if (newBalance < 0) {
      return NextResponse.json(
        { error: { type: 'validation_error', code: 'INSUFFICIENT_BALANCE', message: 'Balance would go negative.' } },
        { status: 400 }
      );
    }

    const { data: updated } = await supabase
      .from('users')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .eq('balance', current.balance) // optimistic lock — only write if nobody else changed it
      .select('balance')
      .single();

    if (updated) return NextResponse.json({ balance: updated.balance });
    // Another request won the race — retry with fresh balance
  }

  return NextResponse.json({ error: 'Concurrent update conflict — please retry' }, { status: 409 });
}
