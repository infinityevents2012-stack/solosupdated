import { supabase } from "@/integrations/supabase/client";

export interface ConsentReceipt {
  id: string;
  user_id: string;
  dpdp_accepted: boolean;
  is_over_18: boolean;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export async function saveConsentReceipt(uid: string, dpdp: boolean, over18: boolean) {
  const { error } = await supabase
    .from("consent_receipts")
    .upsert({
      user_id: uid,
      dpdp_accepted: dpdp,
      is_over_18: over18,
      accepted_at: new Date().toISOString(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }, { onConflict: "user_id" });
  if (error) console.warn("saveConsentReceipt", error.message);
}

export async function getConsentReceipt(uid: string): Promise<ConsentReceipt | null> {
  const { data } = await supabase
    .from("consent_receipts")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  return (data as ConsentReceipt | null) ?? null;
}
