import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import {
  badRequest,
  unauthorized,
  internalError,
  ApiErrorDetail,
} from '@/lib/errors';
import {
  containsBadWords,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  MAX_NOTE_LENGTH,
} from '@/lib/validation';
import { sendNewRequestEmail, sendNewRequestRegisteredEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) {
    return badRequest('MISSING_FIELD', 'Request body must be valid JSON.');
  }

  const { recipient_email, recipient_phone, amount, note } = body as {
    recipient_email?: string;
    recipient_phone?: string | null;
    amount?: number;
    note?: string | null;
  };

  const details: ApiErrorDetail[] = [];

  // Email is always required. Phone is optional secondary contact.
  if (!recipient_email) {
    details.push({ field: 'recipient_email', issue: 'required' });
  } else if (!isValidEmail(recipient_email)) {
    details.push({ field: 'recipient_email', issue: 'invalid email format' });
  } else if (recipient_email === user.email) {
    details.push({ field: 'recipient_email', issue: 'cannot request money from yourself' });
  }

  let normalizedPhone: string | null = null;
  if (recipient_phone) {
    const n = normalizePhone(recipient_phone);
    if (!isValidPhone(n)) {
      details.push({ field: 'recipient_phone', issue: 'invalid phone number' });
    } else {
      normalizedPhone = n;
    }
  }

  if (amount === undefined || amount === null) {
    details.push({ field: 'amount', issue: 'required' });
  } else if (typeof amount !== 'number' || Number.isNaN(amount)) {
    details.push({ field: 'amount', issue: 'must be a number' });
  } else if (amount <= 0) {
    details.push({ field: 'amount', issue: 'must be greater than zero' });
  } else if (amount > 10000) {
    details.push({ field: 'amount', issue: 'must be $10,000 or less' });
  }

  if (note && typeof note !== 'string') {
    details.push({ field: 'note', issue: 'must be a string' });
  } else if (note && note.length > MAX_NOTE_LENGTH) {
    details.push({
      field: 'note',
      issue: `must be ${MAX_NOTE_LENGTH} characters or fewer`,
    });
  }

  if (details.length > 0) {
    return badRequest('MISSING_FIELD', 'Request validation failed.', details);
  }

  const badWord = containsBadWords(note);
  if (badWord) {
    return badRequest(
      'BAD_WORDS_IN_NOTE',
      'Note contains inappropriate language. Please revise.',
      [{ field: 'note', issue: `contains prohibited word: "${badWord}"` }]
    );
  }

  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let recipient_id: string | null = null;
  const { data: recipient } = await supabase
    .from('users')
    .select('id')
    .eq('email', recipient_email!)
    .single();
  if (recipient) recipient_id = recipient.id;

  const insertPayload: Record<string, unknown> = {
    sender_id: user.id,
    recipient_id,
    recipient_email,
    amount: Math.round(amount! * 100),
    status: 1,
    expires_at,
    note: note || null,
  };
  // Only include phone if provided — keeps the insert working before the
  // DB migration (recipient_phone column) has been applied.
  if (normalizedPhone) insertPayload.recipient_phone = normalizedPhone;

  const { data, error } = await supabase
    .from('payment_requests')
    .insert(insertPayload)
    .select()
    .single();

  if (error) return internalError(error.message);

  // Fire-and-forget email — failure must not block the response
  ;(async () => {
    const { data: senderProfile } = await supabase
      .from('users').select('first_name, last_name').eq('id', user.id).single();
    const senderName = senderProfile
      ? `${senderProfile.first_name} ${senderProfile.last_name}` : user.email!;
    const amountCents = Math.round(amount! * 100);

    if (!recipient_id) {
      await sendNewRequestEmail({ recipientEmail: recipient_email!, senderName, amount: amountCents, note: note || null, requestId: data.id });
    } else {
      const { data: recipientProfile } = await supabase
        .from('users').select('email').eq('id', recipient_id).single();
      if (recipientProfile?.email) {
        await sendNewRequestRegisteredEmail({ recipientEmail: recipientProfile.email, senderName, amount: amountCents, note: note || null, requestId: data.id });
      }
    }
  })().catch(() => {});

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const direction = request.nextUrl.searchParams.get('direction') || 'incoming';
  const statuses = request.nextUrl.searchParams.getAll('status');

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
  if (error) return internalError(error.message);
  const rows = data ?? [];

  const ids = Array.from(
    new Set(
      rows.flatMap((r) =>
        [r.sender_id, r.recipient_id].filter((x): x is string => Boolean(x))
      )
    )
  );

  let profiles: Record<string, { first_name: string; last_name: string; email: string }> = {};
  if (ids.length > 0) {
    const { data: users } = await createAdminClient()
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', ids);
    profiles = Object.fromEntries(
      (users ?? []).map((u) => [
        u.id,
        { first_name: u.first_name, last_name: u.last_name, email: u.email },
      ])
    );
  }

  const enriched = rows.map((r) => ({
    ...r,
    sender: r.sender_id ? profiles[r.sender_id] ?? null : null,
    recipient: r.recipient_id ? profiles[r.recipient_id] ?? null : null,
  }));

  return NextResponse.json(enriched);
}
