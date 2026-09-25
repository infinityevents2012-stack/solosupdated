
REVOKE EXECUTE ON FUNCTION public.consume_daily_connection(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_referral(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.watch_ad(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_use_premium(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.consume_daily_connection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.watch_ad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_premium(uuid) TO authenticated;
