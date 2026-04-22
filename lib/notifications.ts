import { createAdminClient } from './supabase/admin';

export async function createNotification(
  userId: string,
  message: string,
  requestId?: string
) {
  const admin = createAdminClient();
  await admin.from('notifications').insert({
    user_id: userId,
    message,
    request_id: requestId ?? null,
  });
}
