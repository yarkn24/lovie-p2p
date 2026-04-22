import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ registered: false });

  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  return NextResponse.json({ registered: !!data });
}
