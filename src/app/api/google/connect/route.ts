import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGoogleAuthUrl } from "@/lib/google/client";

export async function GET() {
  await requireUser();
  return NextResponse.redirect(getGoogleAuthUrl());
}
