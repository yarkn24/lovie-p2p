import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) return internalError(error.message);

  return NextResponse.redirect(new URL('/auth/login', request.url));
}
