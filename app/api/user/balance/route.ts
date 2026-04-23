import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import {
  badRequest,
  unauthorized,
  notFound,
  internalError,
  ApiErrorDetail,
} from '@/lib/errors';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const { data, error } = await supabase
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (error) return internalError(error.message);

  return NextResponse.json({ balance: data.balance });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const { action, amount } = body ?? {};

  const details: ApiErrorDetail[] = [];
  if (!action || !['add', 'subtract'].includes(action)) {
    details.push({ field: 'action', issue: 'must be "add" or "subtract"' });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    details.push({ field: 'amount', issue: 'must be a positive number' });
  }
  if (details.length > 0) {
    return badRequest('MISSING_FIELD', 'Request validation failed.', details);
  }

  const amountInCents = Math.round(amount * 100);
  if (amountInCents <= 0) {
    return badRequest('INVALID_AMOUNT', 'Amount rounds to zero.', [
      { field: 'amount', issue: 'rounds to zero' },
    ]);
  }

  const admin = createAdminClient();

  // For the demo Add/Sub buttons: subtract clamps to zero (never negative).
  // Read-then-RPC has a small race, but the RPC still enforces balance >= 0
  // so worst case is a retriable error, not a bad-state write. `pay` / retry
  // paths still use adjust_balance directly and surface INSUFFICIENT_BALANCE.
  let delta: number;
  if (action === 'add') {
    delta = amountInCents;
  } else {
    const { data: cur } = await admin.from('users').select('balance').eq('id', user.id).single();
    const bal = cur?.balance ?? 0;
    if (bal === 0) return NextResponse.json({ balance: 0 });
    delta = -Math.min(amountInCents, bal);
  }

  const { data: newBalance, error: rpcErr } = await admin.rpc('adjust_balance', {
    p_user_id: user.id,
    p_delta: delta,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('INSUFFICIENT_BALANCE')) {
      return badRequest(
        'INSUFFICIENT_BALANCE',
        'Your balance is insufficient for this adjustment.'
      );
    }
    return internalError(msg || 'Failed to update balance.');
  }

  if (newBalance === null || newBalance === undefined) {
    return notFound('USER_NOT_FOUND', 'User not found.');
  }

  return NextResponse.json({ balance: newBalance });
}
