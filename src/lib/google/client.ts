import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleAuth } from "@/db/schema";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/google/callback`,
  );
}

export function getGoogleAuthUrl(): string {
  return getOAuth2Client().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeAndStoreToken(code: string): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. Remove the app's access at " +
        "https://myaccount.google.com/permissions and try connecting again " +
        "to force a fresh consent screen.",
    );
  }

  const existing = await db.query.googleAuth.findFirst();
  if (existing) {
    await db
      .update(googleAuth)
      .set({ refreshToken: tokens.refresh_token, connectedAt: new Date() })
      .where(eq(googleAuth.id, existing.id));
  } else {
    await db.insert(googleAuth).values({ refreshToken: tokens.refresh_token });
  }
}

export async function isGoogleConnected(): Promise<boolean> {
  const row = await db.query.googleAuth.findFirst();
  return !!row;
}

export async function getSheetsClient() {
  const row = await db.query.googleAuth.findFirst();
  if (!row) {
    throw new Error("Google account not connected. Connect it at /settings/google.");
  }

  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: row.refreshToken });
  return google.sheets({ version: "v4", auth: client });
}
