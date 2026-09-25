import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/store";
import {
  getMyReferralCode,
  getReferralStatus,
  watchAd,
  inCandidateWindow,
  isPremiumActive,
  type ReferralStatus,
} from "@/lib/server-limits";
import { ArrowLeft, Copy, Gift, PlayCircle, Sparkles, Crown, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/referrals")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: Referrals,
});

function Referrals() {
  const navigate = useNavigate();
  const uid = useAuth((s) => s.profile?.uid);
  const profile = useAuth((s) => s.profile);
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAd, setShowAd] = useState(false);
  const [adSecs, setAdSecs] = useState(5);

  const reload = async () => {
    if (!uid) return;
    const [c, s] = await Promise.all([getMyReferralCode(uid), getReferralStatus(uid)]);
    setCode(c);
    setStatus(s);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!showAd) return;
    if (adSecs <= 0) {
      (async () => {
        if (!uid) return;
        const r = await watchAd(uid);
        if (r.ok) {
          toast.success("Premium unlocked for 24 hours!");
          await reload();
        } else {
          toast.error(r.reason ?? "Couldn't grant unlock");
        }
        setShowAd(false);
        setAdSecs(5);
      })();
      return;
    }
    const t = setTimeout(() => setAdSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAd, adSecs]);

  const successful = status?.successful_count ?? 0;
  const inWindow = inCandidateWindow(status);
  const premium = isPremiumActive(profile?.isPremium ?? false, status);
  const candidateUntil = status?.candidate_until ? new Date(status.candidate_until) : null;
  const lastAd = status?.last_ad_watched_at ? new Date(status.last_ad_watched_at) : null;
  const adValidUntil = lastAd ? new Date(lastAd.getTime() + 24 * 60 * 60 * 1000) : null;
  const adValidNow = adValidUntil ? adValidUntil > new Date() : false;
  const daysLeft = candidateUntil ? Math.max(0, Math.ceil((candidateUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 0;

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <AppShell>
      <header className="sticky top-0 z-40 glass-strong px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="flex h-9 w-9 items-center justify-center rounded-full glass"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-xl">Referrals</h1>
        </div>
      </header>

      <main className="space-y-5 px-5 py-6">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {/* Status banner */}
            {profile?.isPremium ? (
              <Banner icon={<Crown className="h-5 w-5 text-gold" />} title="Gold member" body="You have unlimited premium access." tint="gold" />
            ) : premium ? (
              <Banner icon={<Sparkles className="h-5 w-5 text-emerald-400" />} title="Premium unlocked" body={`Active until ${adValidUntil?.toLocaleString()}`} tint="ok" />
            ) : inWindow ? (
              <Banner icon={<PlayCircle className="h-5 w-5 text-sky-400" />} title="Candidate status" body={`Watch a quick ad to unlock premium for 24h. ${daysLeft} day(s) left in window.`} tint="info" />
            ) : (
              <Banner icon={<Lock className="h-5 w-5 text-muted-foreground" />} title="Premium locked" body="Refer 5 friends to unlock the 30-day ad-rewarded premium window." tint="muted" />
            )}

            {/* Tracker */}
            <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Referral Tracker</p>
                  <p className="mt-1 font-display text-3xl">{successful}<span className="text-muted-foreground">/5</span></p>
                </div>
                <Gift className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all"
                  style={{ width: `${Math.min(100, (successful / 5) * 100)}%` }}
                />
              </div>
              {inWindow && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Counter resets when the 30-day window ends. Refer again for another month.
                </p>
              )}
            </div>

            {/* Watch ad CTA — only during candidate window when ad not active */}
            {inWindow && !premium && !adValidNow && (
              <button
                onClick={() => { setAdSecs(5); setShowAd(true); }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 font-semibold text-background"
              >
                <PlayCircle className="h-5 w-5" />
                Watch Ad to Unlock Today
              </button>
            )}

            {/* My code */}
            <div className="rounded-2xl border border-white/10 p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Your code</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-mono text-2xl tracking-widest">{code ?? "—"}</span>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Share this code. When 5 friends sign up with their phone using
                this code, you unlock 30 days of ad-rewarded premium.
              </p>
            </div>
          </>
        )}
      </main>

      {/* Ad modal */}
      <AnimatePresence>
        {showAd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 px-6"
          >
            <div className="w-full max-w-sm">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/30 via-pink-500/20 to-orange-500/30">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="font-display text-3xl">AD</p>
                    <p className="mt-1 text-xs text-white/70">Sponsored</p>
                  </div>
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium tabular-nums">
                  {adSecs}s
                </div>
                <div
                  className="absolute bottom-0 left-0 h-1 bg-foreground transition-all"
                  style={{ width: `${((5 - adSecs) / 5) * 100}%` }}
                />
              </div>
              <p className="mt-4 text-center text-xs text-white/70">
                Reward unlocks automatically.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function Banner({ icon, title, body, tint }: { icon: React.ReactNode; title: string; body: string; tint: "gold" | "ok" | "info" | "muted" }) {
  const bg = {
    gold: "from-yellow-500/15 to-orange-500/5 border-yellow-500/20",
    ok: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/20",
    info: "from-sky-500/15 to-sky-500/0 border-sky-500/20",
    muted: "from-white/5 to-transparent border-white/10",
  }[tint];
  return (
    <div className={`flex items-start gap-3 rounded-2xl border bg-gradient-to-r p-4 ${bg}`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
