// Supabase Edge Function: phone-otp
//
// Implements the server-side half of SoloS's manual WhatsApp OTP relay:
//   - "request": generate a secure OTP, hash + store it, build (but never
//     send) a wa.me deep link to the FIXED verification WhatsApp number.
//   - "verify": check the OTP server-side (hash compare, expiry, attempts,
//     single-use), then mint a real Supabase Auth session for the phone
//     via the Admin API and hand the client a one-time token to redeem.
//
// This function is the ONLY place that touches SUPABASE_SERVICE_ROLE_KEY
// for this feature. The key never reaches the browser or Capacitor app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Config (Supabase secrets; see project README / manual setup notes) ----
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// The fixed administrator/verification WhatsApp number. Digits only
// (with country code, no "+", no spaces), e.g. "919876543210".
// This is configuration, not a secret — but it's centralized here rather
// than scattered through the client bundle.
const VERIFICATION_WHATSAPP_NUMBER = "919603560337";
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_HOUR = 8; // reasonable per-phone request cap

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalize a user-entered phone number to a consistent "+<country><number>" form.
 *  Defaults bare 10-digit numbers to India (+91), matching SoloS's existing
 *  India-only phone entry UI. Returns null if the input can't be normalized. */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

function randomHex(byteLen: number) {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cryptographically secure, uniformly distributed 6-digit OTP (000000-999999). */
function generateOtp(): string {
  const RANGE = 1_000_000; // 10^6
  const MAX_UINT32 = 0xffffffff;
  const LIMIT = MAX_UINT32 - (MAX_UINT32 % RANGE); // avoid modulo bias
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n > LIMIT);
  return String(n % RANGE).padStart(6, "0");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function buildWhatsAppUrl(userPhone: string, otp: string): string | null {
  if (!VERIFICATION_WHATSAPP_NUMBER) return null;
  const message =
    `SoloS verification request\n` +
    `User phone: ${userPhone}\n` +
    `OTP: ${otp}`;
  return `https://wa.me/${VERIFICATION_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, reason: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[phone-otp] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secret");
    return json({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "invalid_body" }, 400);
  }

  const action = body?.action;
  const clientIp =
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? null;

  // ------------------------------------------------------------------
  // REQUEST: generate + store a new OTP, return a WhatsApp deep link.
  // ------------------------------------------------------------------
  if (action === "request") {
    const phone = normalizePhone(String(body?.phone ?? ""));
    if (!phone) return json({ ok: false, reason: "invalid_phone" }, 400);

    const nowIso = new Date().toISOString();

    // Cooldown + per-phone rate limit, enforced server-side (never trust the client).
    const { data: recent, error: recentErr } = await admin
      .from("phone_verifications")
      .select("id, created_at")
      .eq("phone_number", phone)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(MAX_REQUESTS_PER_HOUR + 1);

    if (recentErr) {
      console.error("[phone-otp] request lookup failed", recentErr.message);
      return json({ ok: false, reason: "server_error" }, 500);
    }

    if (recent && recent.length > 0) {
      const lastCreated = new Date(recent[0].created_at).getTime();
      const sinceLast = Date.now() - lastCreated;
      if (sinceLast < RESEND_COOLDOWN_MS) {
        return json({
          ok: false,
          reason: "cooldown",
          retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000),
        });
      }
    }
    if (recent && recent.length >= MAX_REQUESTS_PER_HOUR) {
      return json({ ok: false, reason: "too_many_requests" }, 429);
    }

    // Invalidate any still-active OTP for this phone — a new one supersedes it.
    await admin
      .from("phone_verifications")
      .update({ used: true, used_at: nowIso, consumed_reason: "superseded" })
      .eq("phone_number", phone)
      .eq("used", false);

    const otp = generateOtp();
    const salt = randomHex(16);
    const otpHash = await sha256Hex(`${salt}:${otp}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { data: inserted, error: insertErr } = await admin
      .from("phone_verifications")
      .insert({
        phone_number: phone,
        otp_hash: otpHash,
        otp_salt: salt,
        expires_at: expiresAt,
        max_attempts: MAX_ATTEMPTS,
        request_ip: clientIp,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[phone-otp] insert failed", insertErr?.message);
      return json({ ok: false, reason: "server_error" }, 500);
    }

    const whatsappUrl = buildWhatsAppUrl(phone, otp);
    if (!whatsappUrl) {
      console.error("[phone-otp] SOLOS_VERIFICATION_WHATSAPP_NUMBER secret not set");
      return json({ ok: false, reason: "server_misconfigured" }, 500);
    }

    return json({
      ok: true,
      verificationId: inserted.id,
      phone,
      expiresAt,
      resendCooldownSeconds: RESEND_COOLDOWN_MS / 1000,
      whatsappUrl,
    });
  }

  // ------------------------------------------------------------------
  // VERIFY: check the OTP, then mint a real Supabase Auth session.
  // ------------------------------------------------------------------
  if (action === "verify") {
    const phone = normalizePhone(String(body?.phone ?? ""));
    const verificationId = String(body?.verificationId ?? "");
    const code = String(body?.code ?? "").trim();

    if (!phone || !verificationId || !/^\d{6}$/.test(code)) {
      return json({ ok: false, reason: "invalid_request" }, 400);
    }

    const { data: row, error: fetchErr } = await admin
      .from("phone_verifications")
      .select("*")
      .eq("id", verificationId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[phone-otp] verify lookup failed", fetchErr.message);
      return json({ ok: false, reason: "server_error" }, 500);
    }
    // The verification row must belong to the phone the client claims to be
    // verifying — prevents swapping phone/verificationId to hijack another
    // account's in-flight verification.
    if (!row || row.phone_number !== phone) {
      return json({ ok: false, reason: "not_found" }, 404);
    }

    if (row.used) {
      return json({ ok: false, reason: row.consumed_reason ?? "already_used" });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await admin
        .from("phone_verifications")
        .update({ used: true, used_at: new Date().toISOString(), consumed_reason: "expired" })
        .eq("id", row.id);
      return json({ ok: false, reason: "expired" });
    }

    if (row.attempts >= row.max_attempts) {
      await admin
        .from("phone_verifications")
        .update({ used: true, used_at: new Date().toISOString(), consumed_reason: "too_many_attempts" })
        .eq("id", row.id);
      return json({ ok: false, reason: "too_many_attempts" });
    }

    const candidateHash = await sha256Hex(`${row.otp_salt}:${code}`);
    const matches = timingSafeEqual(candidateHash, row.otp_hash);

    if (!matches) {
      const nextAttempts = row.attempts + 1;
      const exhausted = nextAttempts >= row.max_attempts;
      await admin
        .from("phone_verifications")
        .update({
          attempts: nextAttempts,
          ...(exhausted
            ? { used: true, used_at: new Date().toISOString(), consumed_reason: "too_many_attempts" }
            : {}),
        })
        .eq("id", row.id);
      return json({
        ok: false,
        reason: exhausted ? "too_many_attempts" : "invalid_code",
        attemptsRemaining: Math.max(0, row.max_attempts - nextAttempts),
      });
    }

    // OTP is correct. Mark it consumed before doing anything else so a
    // retried/duplicate request can't be verified twice.
    await admin
      .from("phone_verifications")
      .update({ used: true, used_at: new Date().toISOString(), consumed_reason: "verified" })
      .eq("id", row.id);

    // ---- Resolve (or create) the real Supabase Auth identity for this phone ----
    const digits = digitsOnly(phone);
    let uid: string | null = null;
    let email: string | null = null;

    // 1) Known phone -> existing profile -> existing auth user.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, username")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile) {
      uid = existingProfile.id;
      const { data: userRes, error: getUserErr } = await admin.auth.admin.getUserById(uid);
      if (getUserErr || !userRes?.user?.email) {
        console.error("[phone-otp] could not load existing auth user", getUserErr?.message);
        return json({ ok: false, reason: "server_error" }, 500);
      }
      email = userRes.user.email;
    } else {
      // 2) Fallback: a pre-existing dev-era account signed up with the old
      //    deterministic email scheme (u<digits>@solos.app) but never had
      //    profiles.phone backfilled. Detect it without scanning all users
      //    by attempting to generate a link for that address.
      const legacyEmail = `u${digits}@solos.app`;
      const legacyLink = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: legacyEmail,
      });
      if (!legacyLink.error && legacyLink.data?.user?.id) {
        uid = legacyLink.data.user.id;
        email = legacyEmail;
      }
    }

    let tokenHash: string | null = null;

    if (uid && email) {
      // Backfill profiles.phone for legacy accounts (ignore races/duplicates).
      await admin.from("profiles").update({ phone }).eq("id", uid).is("phone", null);

      const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error || !link.data?.properties?.hashed_token) {
        console.error("[phone-otp] generateLink (existing user) failed", link.error?.message);
        return json({ ok: false, reason: "server_error" }, 500);
      }
      tokenHash = link.data.properties.hashed_token;
    } else {
      // 3) Brand new user. Email is a stable, non-secret identifier only —
      // it is never used as a login credential (no password auth here).
      email = `p${digits}@phone.solos.internal`;
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        phone: digits,
        phone_confirm: true,
      });
      if (created.error || !created.data?.user) {
        console.error("[phone-otp] createUser failed", created.error?.message);
        return json({ ok: false, reason: "server_error" }, 500);
      }
      uid = created.data.user.id;

      // The on-signup trigger (handle_new_user) already created the profile
      // row; just attach the verified phone number to it.
      await admin.from("profiles").update({ phone }).eq("id", uid);

      const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error || !link.data?.properties?.hashed_token) {
        console.error("[phone-otp] generateLink (new user) failed", link.error?.message);
        return json({ ok: false, reason: "server_error" }, 500);
      }
      tokenHash = link.data.properties.hashed_token;
    }

    const { data: profileRow } = await admin
      .from("profiles")
      .select("username")
      .eq("id", uid)
      .maybeSingle();
    const hasUsername = !!profileRow?.username && !profileRow.username.startsWith("user_");

    return json({
      ok: true,
      email,
      tokenHash,
      hasUsername,
    });
  }

  return json({ ok: false, reason: "unknown_action" }, 400);
});
