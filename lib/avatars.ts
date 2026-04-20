export const DEMO_AVATARS: Record<string, string> = {
  'user1@demo.lovie.co': '/avatars/sarah.jpg',
  'user2@demo.lovie.co': '/avatars/michael.png',
  'user3@demo.lovie.co': '/avatars/david.png',
};

export function getAvatar(email?: string | null): string | null {
  if (!email) return null;
  return DEMO_AVATARS[email] ?? null;
}
