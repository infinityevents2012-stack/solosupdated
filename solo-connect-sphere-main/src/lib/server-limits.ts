import { supabase } from "@/integrations/supabase/client";

/** Server-enforced daily nearby-connection limit. Returns true if the user may proceed. */
export async function consumeDailyConnection(uid: string): Promise<{ ok: boolean; remaining: number; reason?: string }> {
  const { data, error } = await supabase.rpc("consume_daily_connection", { _user_id: uid });
  if (error) {
    console.error("consume_daily_connection error", error);
    return { ok: false, remaining: 0, reason: "error" };
  }
  const r = (data ?? {}) as { ok: boolean; remaining?: number; reason?: string };
  return { ok: !!r.ok, remaining: r.remaining ?? 0, reason: r.reason };
}

export interface ReferralStatus {
  user_id: string;
  successful_count: number;
  cycle_started_at: string | null;
  candidate_until: string | null;
  last_ad_watched_at: string | null;
}

export async function getReferralStatus(uid: string): Promise<ReferralStatus | null> {
  const { data } = await supabase
    .from("referral_status")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  return (data as ReferralStatus | null) ?? null;
}

export async function getMyReferralCode(uid: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", uid)
    .single();
  return (data?.referral_code as string | null) ?? null;
}

export async function applyReferral(code: string, phone: string) {
  const { data, error } = await supabase.rpc("apply_referral", { _code: code, _phone: phone });
  if (error) return { ok: false, reason: error.message };
  return data as { ok: boolean; reason?: string };
}

export async function watchAd(uid: string) {
  const { data, error } = await supabase.rpc("watch_ad", { _user_id: uid });
  if (error) return { ok: false, reason: error.message };
  return data as { ok: boolean; unlocked_until?: string; reason?: string };
}

/** True if the user can use premium-locked features right now (premium OR ad-unlocked candidate). */
export function isPremiumActive(profileIsPremium: boolean, status: ReferralStatus | null): boolean {
  if (profileIsPremium) return true;
  if (!status?.candidate_until) return false;
  if (new Date(status.candidate_until) < new Date()) return false;
  if (!status.last_ad_watched_at) return false;
  const adAge = Date.now() - new Date(status.last_ad_watched_at).getTime();
  return adAge < 24 * 60 * 60 * 1000;
}

export function inCandidateWindow(status: ReferralStatus | null): boolean {
  if (!status?.candidate_until) return false;
  return new Date(status.candidate_until) > new Date();
}
