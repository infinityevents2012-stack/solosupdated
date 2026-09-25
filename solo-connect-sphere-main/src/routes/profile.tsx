import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/store";
import { explorePosts } from "@/lib/mock-data";
import { GoldBadge } from "@/components/GoldBadge";
import { signOutSupabase } from "@/lib/supabase-auth";
import { Settings, Grid3x3, Bookmark, LogOut, Crown, BarChart3, Shield, Gift, FileCheck2, PlayCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { getReferralStatus, isPremiumActive, inCandidateWindow, type ReferralStatus } from "@/lib/server-limits";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const [refStatus, setRefStatus] = useState<ReferralStatus | null>(null);

  useEffect(() => {
    if (!profile?.uid) return;
    getReferralStatus(profile.uid).then(setRefStatus);
  }, [profile?.uid]);

  if (!profile) return null;

  const myPosts = explorePosts.slice(0, 9);
  const successful = refStatus?.successful_count ?? 0;
  const inWindow = inCandidateWindow(refStatus);
  const premiumActive = isPremiumActive(profile.isPremium, refStatus);
  const lastAd = refStatus?.last_ad_watched_at ? new Date(refStatus.last_ad_watched_at) : null;
  const adValidNow = lastAd && (Date.now() - lastAd.getTime() < 24 * 60 * 60 * 1000);

  return (
    <AppShell>
      <header className="sticky top-0 z-40 glass-strong px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h1 className="font-display text-lg">@{profile.username}</h1>
            <GoldBadge premium={profile.isPremium} />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-full glass">
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={async () => {
                await signOutSupabase();
                logout();
                navigate({ to: "/" });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full glass"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="flex items-center gap-6">
          <div className="story-ring rounded-full p-[2px]">
            <img
              src={profile.avatar}
              alt={profile.username}
              className="h-20 w-20 rounded-full bg-secondary"
            />
          </div>
          <div className="flex flex-1 justify-around text-center">
            <Stat n="9" label="Posts" />
            <Stat n="248" label="Followers" />
            <Stat n="312" label="Following" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{profile.username}</p>
            <GoldBadge premium={profile.isPremium} />
          </div>
          <p className="text-sm text-muted-foreground">
            New on SoloS · Mumbai 📍
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-semibold">
            Edit profile
          </button>
          <button
            onClick={() => navigate({ to: "/insights" })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2 text-sm font-semibold"
          >
            <BarChart3 className="h-4 w-4" />
            Insights
          </button>
        </div>

        {!profile.isPremium && (
          <button
            onClick={() => navigate({ to: "/subscribe" })}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-gold" />
              <div className="text-left">
                <p className="text-sm font-semibold text-gradient-gold">
                  Upgrade to SoloS Gold
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Unlimited connections · ₹99 + GST/mo
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">→</span>
          </button>
        )}

        {/* Referral tracker card */}
        <button
          onClick={() => navigate({ to: "/referrals" })}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-card/40 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            <Gift className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Referral Tracker</p>
              <p className="text-[11px] text-muted-foreground">
                {successful}/5 friends joined
                {inWindow && ` · candidate active`}
                {premiumActive && ` · premium unlocked`}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">→</span>
        </button>

        {inWindow && !premiumActive && !adValidNow && (
          <button
            onClick={() => navigate({ to: "/referrals" })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3 font-semibold text-background"
          >
            <PlayCircle className="h-5 w-5" />
            Watch Ad to Unlock Today
          </button>
        )}
        {premiumActive && !profile.isPremium && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
            <Sparkles className="h-4 w-4" />
            Premium unlocked for the next 24 hours
          </div>
        )}


      </section>

      <div className="mt-6 flex border-t border-white/10">
        <button className="flex flex-1 items-center justify-center gap-2 border-t-2 border-foreground py-3">
          <Grid3x3 className="h-5 w-5" />
        </button>
        <button className="flex flex-1 items-center justify-center gap-2 py-3 text-muted-foreground">
          <Bookmark className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-0.5">
        {myPosts.map((p) => (
          <div key={p.id} className="aspect-square overflow-hidden bg-secondary">
            <img
              src={p.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-4 px-5 pb-6 text-[11px] text-muted-foreground">
        <button
          onClick={() => navigate({ to: "/privacy" })}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <Shield className="h-3 w-3" />
          Privacy Policy
        </button>
        <span>·</span>
        <button
          onClick={() => navigate({ to: "/consent" })}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <FileCheck2 className="h-3 w-3" />
          Consent receipt
        </button>
        <span>·</span>
        <span>DPDP Act, 2023</span>
      </div>
    </AppShell>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <p className="font-display text-lg">{n}</p>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
