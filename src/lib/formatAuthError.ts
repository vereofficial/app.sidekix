/** Maps Supabase / GoTrue errors to clearer copy for the sign-up flow. */
export function formatAuthError(message: string | null | undefined): string | null {
  if (!message) return null;
  if (/unsupported phone provider/i.test(message)) {
    return 'Phone sign-in needs an SMS provider on your Supabase project. Dashboard → Authentication → Providers → Phone: enable it and add Twilio (or another SMS provider). For local dev, confirm auth env/config is wired to a provider.';
  }
  return message;
}
