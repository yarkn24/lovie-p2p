const BAD_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'dick',
  'pussy',
  'bastard',
  'whore',
  'slut',
  'nigger',
  'faggot',
  'retard',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function containsBadWords(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const word of BAD_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(lower)) return word;
  }
  return null;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export const MAX_NOTE_LENGTH = 500;
