// Thrown for a known, safe-to-display failure (e.g. "no Google account
// connected" from getSheetsClient()) — its message is written by this app,
// not by an external library, so it's fine to show a user directly. Any
// other thrown value (a raw Drizzle/Postgres error, an unrecognized
// Google API error, etc.) is treated as unexpected below and never shown
// verbatim, since its message could contain internal details never meant
// for the client.
export class GoogleSheetsUserError extends Error {}

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
  if (err instanceof GoogleSheetsUserError && err.message) {
    return err.message;
  }
  console.error("Unexpected error generating Google Sheet:", err);
  return "Something went wrong generating the sheet. Check the server logs if this keeps happening.";
}
