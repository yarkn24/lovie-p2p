import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const admin = createAdminClient();

  const { data: current } = await admin
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const newBalance = Math.max(0, current.balance + delta);

  const { data: updated, error: updateErr } = await admin
    .from('users')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('balance')
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Failed to update balance.' }, { status: 500 });
  }

  return NextResponse.json({ balance: updated.balance });
}
