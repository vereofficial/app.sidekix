const ADMIN_EMAILS = new Set(['zazaonu@icloud.com', 'mmguandolo@gmail.com']);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
