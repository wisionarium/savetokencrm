"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { audit, hashEmail } from "@/lib/audit";
import { env } from "@/lib/env";

const resendSchema = z.object({
  email: z.string().email(),
});

export type ResendEmailResult =
  | { ok: true }
  | { ok: false; error: "rate_limited" | "invalid_email" | "resend_failed" };

export async function resendSignUpEmail(email: string): Promise<ResendEmailResult> {
  const parsed = resendSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, error: "invalid_email" };
  }

  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? env.NEXT_PUBLIC_APP_URL;
  const requestId = hdrs.get("x-request-id") ?? crypto.randomUUID();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?type=signup`,
      },
    });

    if (error) {
      if (error.status === 429) {
        return { ok: false, error: "rate_limited" };
      }
      return { ok: false, error: "resend_failed" };
    }

    await audit({
      action: "auth.signup_requested",
      metadata: { email_hash: hashEmail(parsed.data.email), reason: "resend" },
      requestId,
      ip,
      userAgent,
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "resend_failed" };
  }
}
