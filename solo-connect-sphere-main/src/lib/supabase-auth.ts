import { supabase } from "@/integrations/supabase/client";

/**
 * Thin helpers around the REAL Supabase Auth session.
 *
 * The old dev-only mechanism that derived a deterministic email/password
 * from the phone number (and silently signed the user up/in with it) has
 * been removed. Authentication now happens exclusively via the manual
 * WhatsApp OTP relay in src/lib/phone-otp.ts, which redeems a one-time
 * token from the `phone-otp` Edge Function to establish a real session.
 */

export async function getCurrentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function signOutSupabase() {
  await supabase.auth.signOut();
}
