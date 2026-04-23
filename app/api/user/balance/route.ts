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

  const delta = action === 'add' ? amountInCents : -amountInCents;
  const admin = createAdminClient();

  // Atomic: adjust_balance runs a single UPDATE with a balance+delta >= 0
  // guard and RAISEs INSUFFICIENT_BALANCE when the invariant would break.
  // Replaces the prior read-compute-write (which races under concurrency)
  // and the Math.max(0, …) silent clamp (which hid errors rather than
  // surfacing them as a structured error to the caller).
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
