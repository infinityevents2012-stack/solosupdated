import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/store";

/**
 * Makes the REAL Supabase Auth session authoritative for protected screens.
 *
 * The route-level `beforeLoad` guards check the Zustand `isAuthenticated`
 * flag for a fast, synchronous redirect (good UX, no flash of protected
 * content). But that flag is only ever set as a *result* of a real Supabase
 * session being established (see src/lib/phone-otp.ts) — it must never be
 * treated as the authority on its own. This hook double-checks against the
 * actual session and signs the user out locally if it's gone (expired,
 * revoked, cleared) even though local state still thinks they're logged in.
 */
export function useSessionGuard() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session && useAuth.getState().isAuthenticated) {
        logout();
        navigate({ to: "/" });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && useAuth.getState().isAuthenticated) {
        logout();
        navigate({ to: "/" });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, logout]);
}
