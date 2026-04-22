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

  const { data: current } = await admin
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (!current) return notFound('USER_NOT_FOUND', 'User not found.');

  const newBalance = Math.max(0, current.balance + delta);

  const { data: updated, error: updateErr } = await admin
    .from('users')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('balance')
    .single();

  if (updateErr || !updated) {
    return internalError('Failed to update balance.');
  }

  return NextResponse.json({ balance: updated.balance });
}
