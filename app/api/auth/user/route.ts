import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { unauthorized, notFound } from '@/lib/errors';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, balance')
    .eq('id', user.id)
    .single();

  if (!profile) return notFound('USER_NOT_FOUND', 'Profile not found.');

  return NextResponse.json(profile);
}
