"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.email();

export type LoginState = { error?: string; sent?: boolean };

export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { sent: true };
}
