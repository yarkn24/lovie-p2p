import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { unauthorized, internalError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('expire_pending_requests');

  if (error) {
    console.error('Error expiring requests:', error);
    return internalError(error.message);
  }

  return NextResponse.json({ success: true, message: 'Requests expired' });
}
