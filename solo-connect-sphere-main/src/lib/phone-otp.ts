import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side helpers for SoloS's manual WhatsApp OTP relay.
 *
 * All OTP generation, hashing, storage, expiry, attempt-limiting and
 * Supabase Auth session issuance happen server-side inside the `phone-otp`
 * Edge Function (see supabase/functions/phone-otp/index.ts). This module
 * only calls that function and, on success, redeems the one-time token it
 * returns to establish a real Supabase Auth session.
 */

export type RequestOtpResult =
  | {
      ok: true;
      verificationId: string;
      phone: string;
      expiresAt: string;
      resendCooldownSeconds: number;
      whatsappUrl: string;
    }
  | { ok: false; reason: string; retryAfterSeconds?: number };

export type VerifyOtpResult =
  | { ok: true; uid: string; hasUsername: boolean }
  | { ok: false; reason: string; attemptsRemaining?: number };

/** Loose client-side normalization, purely for display/validation.
 *  The server independently (and authoritatively) re-normalizes the phone. */
export function normalizePhoneForDisplay(raw: string): string | null {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  try {
    const { data, error } = await supabase.functions.invoke("phone-otp", {
      body: { action: "request", phone },
    });
    if (error) {
      // supabase-js surfaces non-2xx responses as an error but the JSON
      // body (with our `reason`) is usually still available via context.
      const context = (error as any)?.context;
      let parsed: any = null;
      try {
        parsed = context ? await context.json() : null;
      } catch {
        /* ignore */
      }
      return { ok: false, reason: parsed?.reason ?? "network_error", retryAfterSeconds: parsed?.retryAfterSeconds };
    }
    return data as RequestOtpResult;
  } catch (e) {
    console.error("[phone-otp] requestOtp failed", e);
    return { ok: false, reason: "network_error" };
  }
}

export async function verifyOtp(
  verificationId: string,
  phone: string,
  code: string
): Promise<VerifyOtpResult> {
  try {
    const { data, error } = await supabase.functions.invoke("phone-otp", {
      body: { action: "verify", verificationId, phone, code },
    });
    if (error) {
      const context = (error as any)?.context;
      let parsed: any = null;
      try {
        parsed = context ? await context.json() : null;
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        reason: parsed?.reason ?? "network_error",
        attemptsRemaining: parsed?.attemptsRemaining,
      };
    }

    if (!data?.ok) {
      return { ok: false, reason: data?.reason ?? "unknown_error", attemptsRemaining: data?.attemptsRemaining };
    }

    // Redeem the one-time token to establish a REAL Supabase Auth session.
    // This is the only step that turns "OTP was correct" into an actual
    // authenticated auth.uid() session — nothing before this point creates
    // a session of any kind.
    const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "magiclink",
    });

    if (verifyErr || !sessionData?.session || !sessionData?.user) {
      console.error("[phone-otp] session redemption failed", verifyErr?.message);
      return { ok: false, reason: "session_error" };
    }

    return { ok: true, uid: sessionData.user.id, hasUsername: !!data.hasUsername };
  } catch (e) {
    console.error("[phone-otp] verifyOtp failed", e);
    return { ok: false, reason: "network_error" };
  }
}
