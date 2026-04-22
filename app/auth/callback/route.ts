import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const supabase = await createClient();
  const { data: session, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session.user) {
    return NextResponse.redirect(new URL('/auth/login?error=Invalid+or+expired+link', request.url));
  }

  // Auto-create profile in public.users using signup metadata (first_name, last_name).
  // Uses admin client to bypass RLS — the auth exchange above already authenticated the user.
  const user = session.user;
  const metadata = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string };

  if (metadata.first_name && metadata.last_name) {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existing) {
      await admin.from('users').insert({
        id: user.id,
        email: user.email!,
        first_name: metadata.first_name,
        last_name: metadata.last_name,
      });
    }
  }

  // If no metadata (e.g. magic-link login for an older account), fall back
  // to the profile-completion page when the profile row is still missing.
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.redirect(new URL('/auth/complete-profile', request.url));
  }
  const confirmedUrl = new URL('/auth/confirmed', request.url);
  confirmedUrl.searchParams.set('next', next);
  return NextResponse.redirect(confirmedUrl);
}
