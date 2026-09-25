-- ============================================================
-- Phone OTP verification (manual WhatsApp relay auth milestone)
-- ============================================================
-- This table is the server-side source of truth for phone OTP
-- verification. It is intentionally NOT reachable by the anon or
-- authenticated PostgREST roles: RLS is enabled with zero policies,
-- so only the service_role (used exclusively inside the
-- `phone-otp` Supabase Edge Function) can read or write it.
--
-- Ordinary clients cannot:
--   - read OTP hashes
--   - change OTP hashes / expiry / attempts
--   - mark an OTP as used/verified
--   - reset attempt counters
-- because no policy grants them any access at all.

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Normalized E.164-style phone, e.g. +919876543210
  phone_number text NOT NULL,
  -- SHA-256(otp_salt || otp) hex digest. Plaintext OTP is never stored.
  otp_hash text NOT NULL,
  otp_salt text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  -- Why the row stopped being active: 'verified' | 'expired' | 'too_many_attempts' | 'superseded'
  consumed_reason text,
  request_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lookups during request (cooldown / rate-limit) and verify (by id + phone)
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_created
  ON public.phone_verifications (phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_active
  ON public.phone_verifications (phone_number)
  WHERE used = false;

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
-- No policies are created on purpose: default-deny for anon/authenticated.
-- The service_role key (used only inside the phone-otp Edge Function)
-- bypasses RLS entirely, which is the only way this table is touched.

REVOKE ALL ON public.phone_verifications FROM anon, authenticated;

-- ============================================================
-- profiles.phone: canonical mapping from verified phone -> auth user
-- ============================================================
-- The column + unique constraint already exist from an earlier
-- migration (profiles.phone unique). We only ensure it's present
-- here defensively for environments that may have skipped it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
  END IF;
END $$;
