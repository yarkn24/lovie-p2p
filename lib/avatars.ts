export const DEMO_AVATARS: Record<string, string> = {
  'sarah.demo@lovie.co': '/avatars/sarah.jpg',
  'michael.demo@lovie.co': '/avatars/michael.png',
  'david.demo@lovie.co': '/avatars/david.png',
};

export function getAvatar(email?: string | null): string | null {
  if (!email) return null;
  return DEMO_AVATARS[email] ?? null;
}
