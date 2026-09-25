
-- ============ PROFILES: add referral_code + phone ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone text UNIQUE;

-- Auto-generate referral_code for existing & new profiles
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

UPDATE public.profiles SET referral_code = public.gen_referral_code() WHERE referral_code IS NULL;

-- Trigger: assign code on insert if missing
CREATE OR REPLACE FUNCTION public.profiles_set_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.gen_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_referral_code();

-- ============ DAILY CONNECTION USAGE ============
CREATE TABLE IF NOT EXISTS public.daily_connection_usage (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now()::date),
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.daily_connection_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dcu_select_own" ON public.daily_connection_usage
  FOR SELECT USING (auth.uid() = user_id);

-- No insert/update policies: only the SECURITY DEFINER function may write.

CREATE OR REPLACE FUNCTION public.consume_daily_connection(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_prem boolean;
  cur_count int;
  today date := (now() AT TIME ZONE 'UTC')::date;
  daily_limit int := 10;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT is_premium INTO is_prem FROM public.profiles WHERE id = _user_id;
  IF is_prem THEN
    RETURN jsonb_build_object('ok', true, 'remaining', -1, 'premium', true);
  END IF;

  INSERT INTO public.daily_connection_usage (user_id, day, count)
    VALUES (_user_id, today, 0)
    ON CONFLICT (user_id, day) DO NOTHING;

  SELECT count INTO cur_count FROM public.daily_connection_usage
    WHERE user_id = _user_id AND day = today
    FOR UPDATE;

  IF cur_count >= daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached', 'remaining', 0);
  END IF;

  UPDATE public.daily_connection_usage
    SET count = count + 1
    WHERE user_id = _user_id AND day = today;

  RETURN jsonb_build_object('ok', true, 'remaining', daily_limit - (cur_count + 1));
END;
$$;

-- ============ CONSENT RECEIPTS ============
CREATE TABLE IF NOT EXISTS public.consent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  dpdp_accepted boolean NOT NULL DEFAULT false,
  is_over_18 boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.consent_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_select_own" ON public.consent_receipts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "consent_insert_own" ON public.consent_receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "consent_update_own" ON public.consent_receipts
  FOR UPDATE USING (auth.uid() = user_id);

-- ============ REFERRALS ============
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  referred_phone text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

-- Only SECURITY DEFINER function writes here.

-- ============ REFERRAL STATUS (per-user counter / candidate window / ad) ============
CREATE TABLE IF NOT EXISTS public.referral_status (
  user_id uuid PRIMARY KEY,
  successful_count int NOT NULL DEFAULT 0,
  cycle_started_at timestamptz,
  candidate_until timestamptz,
  last_ad_watched_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rs_select_own" ON public.referral_status
  FOR SELECT USING (auth.uid() = user_id);

-- Apply referral code: called by newly-onboarded user with their phone + the code
CREATE OR REPLACE FUNCTION public.apply_referral(_code text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  ref_user uuid;
  cnt int;
  cycle_start timestamptz;
  cand_until timestamptz;
BEGIN
  IF me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  -- Phone must be unique (not already used as a referral)
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_phone = _phone) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'phone_already_referred');
  END IF;

  -- Self-referral check
  SELECT id INTO ref_user FROM public.profiles WHERE referral_code = upper(_code);
  IF ref_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  IF ref_user = me THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  -- Cannot apply twice
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = me) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_user_id, referred_phone)
    VALUES (ref_user, me, _phone);

  -- Bump referrer's status; if reaches 5, start 30-day window
  INSERT INTO public.referral_status (user_id, successful_count, cycle_started_at)
    VALUES (ref_user, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET successful_count = public.referral_status.successful_count + 1,
          cycle_started_at = COALESCE(public.referral_status.cycle_started_at, now()),
          updated_at = now();

  SELECT successful_count, cycle_started_at INTO cnt, cycle_start
    FROM public.referral_status WHERE user_id = ref_user;

  IF cnt >= 5 AND (SELECT candidate_until FROM public.referral_status WHERE user_id = ref_user) IS NULL THEN
    cand_until := now() + interval '30 days';
    UPDATE public.referral_status
      SET candidate_until = cand_until,
          successful_count = 0,
          cycle_started_at = NULL
      WHERE user_id = ref_user;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Watch ad: records the ad watch if within candidate window
CREATE OR REPLACE FUNCTION public.watch_ad(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cand timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT candidate_until INTO cand FROM public.referral_status WHERE user_id = _user_id;

  IF cand IS NULL OR cand < now() THEN
    -- Window expired? reset
    IF cand IS NOT NULL AND cand < now() THEN
      UPDATE public.referral_status
        SET candidate_until = NULL, successful_count = 0, last_ad_watched_at = NULL
        WHERE user_id = _user_id;
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'no_candidate_window');
  END IF;

  UPDATE public.referral_status
    SET last_ad_watched_at = now(), updated_at = now()
    WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'unlocked_until', now() + interval '24 hours');
END;
$$;

-- Premium gate: premium OR (in candidate window AND ad watched in last 24h)
CREATE OR REPLACE FUNCTION public.can_use_premium(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_prem boolean;
  cand timestamptz;
  ad timestamptz;
BEGIN
  SELECT is_premium INTO is_prem FROM public.profiles WHERE id = _user_id;
  IF is_prem THEN RETURN true; END IF;

  SELECT candidate_until, last_ad_watched_at INTO cand, ad
    FROM public.referral_status WHERE user_id = _user_id;

  IF cand IS NULL OR cand < now() THEN RETURN false; END IF;
  IF ad IS NULL OR ad < now() - interval '24 hours' THEN RETURN false; END IF;

  RETURN true;
END;
$$;
