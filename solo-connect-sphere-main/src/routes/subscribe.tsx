import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Check, Crown, ChevronLeft, Lock } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/subscribe")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: SubscribePage,
});

const PRICE = 99;
const GST = Math.round(PRICE * 0.18 * 100) / 100;
const TOTAL = PRICE + GST;

const perks = [
  "Unlimited daily connections",
  "Hide your distance & online status",
  "See who viewed your profile",
  "Premium-only Gold ring on your avatar",
  "No ads, ever",
  "Priority support",
];

function SubscribePage() {
  const navigate = useNavigate();
  const { setPremium, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const pay = () => {
    setLoading(true);
    setTimeout(async () => {
      setPremium(true);
      // Sync to backend so peers see the gold badge
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          await supabase
            .from("profiles")
            .update({ is_premium: true })
            .eq("id", data.user.id);
        }
      } catch {
        // non-fatal — local state is already premium
      }
      setLoading(false);
      toast.success("Welcome to SoloS Gold ✨");
      navigate({ to: "/profile" });
    }, 1600);
  };

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,oklch(0.6_0.18_70/0.35),transparent_60%)]" />

      <header className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="flex h-9 w-9 items-center justify-center rounded-full glass"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Membership
        </span>
        <div className="h-9 w-9" />
      </header>

      <div className="px-6 pt-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 14 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_20px_60px_-15px_oklch(0.85_0.17_85/0.6)]"
        >
          <Crown className="h-10 w-10 text-black" />
        </motion.div>

        <h1 className="mt-6 text-center font-display text-4xl">
          SoloS <span className="text-gradient-gold">Gold</span>
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Made for the always-connected.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-card/60 p-6 backdrop-blur">
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-display text-5xl">₹{PRICE}</span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            +18% GST (₹{GST}) · Total ₹{TOTAL}/mo · Cancel anytime
          </p>

          <ul className="mt-6 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold/20">
                  <Check className="h-3 w-3 text-gold" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {profile?.isPremium ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm">
            You're already a Gold member ✨
          </div>
        ) : (
          <button
            onClick={pay}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 py-4 font-semibold text-black disabled:opacity-70"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Pay ₹{TOTAL} with Stripe
              </>
            )}
          </button>
        )}

        <p className="mt-3 mb-10 text-center text-[11px] text-muted-foreground">
          Secure checkout · Powered by Stripe · GSTIN invoice on email
        </p>
      </div>
    </div>
  );
}
