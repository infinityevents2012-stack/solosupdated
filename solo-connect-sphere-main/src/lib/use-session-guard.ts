/*import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/store";*/

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
/*export function useSessionGuard() {
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
}*/

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/store";

export function useSessionGuard() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    /*const evaluate = (session: unknown) => {
      if (cancelled || settled) return;
      settled = true;
      if (!session && useAuth.getState().isAuthenticated) {
        logout();
        navigate({ to: "/" });
      }
    };*/

    const evaluate = (session: unknown, source: string) => {
      if (cancelled || settled) return;
      settled = true;
      console.log(`[session-guard] evaluate via ${source} — session:`, session, "isAuthenticated:", useAuth.getState().isAuthenticated);
      if (!session && useAuth.getState().isAuthenticated) {
        console.log("[session-guard] logging out — no session but isAuthenticated was true");
        logout();
        navigate({ to: "/" });
      }
    };


    /*const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        evaluate(session);
        return;
      }
      if (event === "SIGNED_OUT" && useAuth.getState().isAuthenticated) {
        logout();
        navigate({ to: "/" });
      }
    });

    const fallback = setTimeout(async () => {
      if (settled || cancelled) return;
      const { data } = await supabase.auth.getSession();
      evaluate(data.session);
    }, 1500);*/

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[session-guard] onAuthStateChange event:", event, "session:", session);
      if (event === "INITIAL_SESSION") {
        evaluate(session, "INITIAL_SESSION");
        return;
      }
      if (event === "SIGNED_OUT" && useAuth.getState().isAuthenticated) {
        console.log("[session-guard] logging out — SIGNED_OUT event");
        logout();
        navigate({ to: "/" });
      }
    });

    const fallback = setTimeout(async () => {
      if (settled || cancelled) return;
      const { data } = await supabase.auth.getSession();
      evaluate(data.session, "fallback timeout");
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, [navigate, logout]);
}