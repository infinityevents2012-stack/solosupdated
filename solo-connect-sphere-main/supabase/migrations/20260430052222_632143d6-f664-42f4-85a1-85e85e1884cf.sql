ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.calls
  DROP CONSTRAINT IF EXISTS calls_end_reason_check;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_end_reason_check
  CHECK (end_reason IS NULL OR end_reason IN ('declined','missed','ended','cancelled','failed'));