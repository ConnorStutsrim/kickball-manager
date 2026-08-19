import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { exchangeCodeAndStoreToken } from "@/lib/google/client";

export async function GET(request: NextRequest) {
  await requireUser();

  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/settings/google?error=missing_code`);
  }

  try {
    await exchangeCodeAndStoreToken(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error connecting Google.";
    return NextResponse.redirect(`${origin}/settings/google?error=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(`${origin}/settings/google?connected=1`);
}
