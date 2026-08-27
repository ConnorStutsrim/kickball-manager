// A stored Google refresh token can stop working without anything in this
// app changing — most commonly because the Google Cloud OAuth consent
// screen is left in "Testing" publishing status, where Google auto-expires
// every refresh token after exactly 7 days regardless of use. That
// surfaces as a Gaxios `invalid_grant` error on the first real API call,
// not as getSheetsClient() throwing (it only checks whether a token is
// stored at all, not whether it still works) — give a specific, actionable
// message for that case rather than letting a generic "invalid_grant"
// bubble up. Kept dependency-free (no `db` import, unlike client.ts) so
// it's testable without a database connection.
export function describeGoogleSheetsError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
  if (data?.error === "invalid_grant") {
    return "Your Google connection has expired — reconnect at /settings/google.";
  }
  return err instanceof Error ? err.message : "Google Sheets error.";
}
