import { createClient } from '@/lib/supabase/server';
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
  MAX_NOTE_LENGTH,
} from '@/lib/validation';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) {
    return badRequest('MISSING_FIELD', 'Request body must be valid JSON.');
  }

  const { recipient_email, amount, note } = body as {
    recipient_email?: string;
    amount?: number;
    note?: string | null;
  };

  const details: ApiErrorDetail[] = [];

  if (!recipient_email) {
    details.push({ field: 'recipient_email', issue: 'required' });
  } else if (!isValidEmail(recipient_email)) {
    details.push({ field: 'recipient_email', issue: 'invalid email format' });
  }

  if (amount === undefined || amount === null) {
    details.push({ field: 'amount', issue: 'required' });
  } else if (typeof amount !== 'number' || Number.isNaN(amount)) {
    details.push({ field: 'amount', issue: 'must be a number' });
  } else if (amount <= 0) {
    details.push({ field: 'amount', issue: 'must be greater than zero' });
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
  if (recipient_email !== user.email) {
    const { data: recipient } = await supabase
      .from('users')
      .select('id')
      .eq('email', recipient_email!)
      .single();

    if (recipient) recipient_id = recipient.id;
  }

  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      sender_id: user.id,
      recipient_id,
      recipient_email,
      amount: Math.round(amount! * 100),
      status: 1,
      expires_at,
      note: note || null,
    })
    .select()
    .single();

  if (error) return internalError(error.message);

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

  return NextResponse.json(data || []);
}
