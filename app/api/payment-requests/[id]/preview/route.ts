import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { notFound } from '@/lib/errors';

// Public preview — no auth required. Returns only the minimum data needed to
// render the "Sarah requested $X from you" splash on the share landing page.
// Sensitive fields (note, recipient_id, full profile) are omitted.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: req } = await admin
    .from('payment_requests')
    .select('id, amount, status, expires_at, sender_id, recipient_email')
    .eq('id', id)
    .maybeSingle();

  if (!req) return notFound('REQUEST_NOT_FOUND', 'Payment request not found.');

  const { data: sender } = await admin
    .from('users')
    .select('first_name, last_name')
    .eq('id', req.sender_id)
    .maybeSingle();

  return NextResponse.json({
    id: req.id,
    amount: req.amount,
    status: req.status,
    expires_at: req.expires_at,
    sender_name: sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Someone',
    recipient_email: req.recipient_email,
  });
}
