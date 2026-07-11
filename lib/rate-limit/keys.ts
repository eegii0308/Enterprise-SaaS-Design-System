// Matches the email normalization already used for account lookups (see
// requestPasswordReset in lib/auth/password-reset.ts) so an account-scoped
// rate-limit key always lines up with the same account regardless of the
// casing/whitespace a client submits.
export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}
