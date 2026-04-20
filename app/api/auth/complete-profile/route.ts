import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { unauthorized, badRequest, internalError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const firstName = body?.first_name?.trim();
  const lastName = body?.last_name?.trim();

  if (!firstName || !lastName) {
    return badRequest('MISSING_FIELD', 'first_name and last_name are required.');
  }

  const { error } = await supabase.from('users').upsert({
    id: user.id,
    email: user.email!,
    first_name: firstName,
    last_name: lastName,
    // balance intentionally omitted — DB DEFAULT 1000000 applies to new rows;
    // existing rows keep their current balance (upsert won't overwrite it).
  }, { ignoreDuplicates: false });

  if (error) return internalError(error.message);

  return NextResponse.json({ ok: true });
}
