import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, TrendingUp, Users, Heart, Crown } from "lucide-react";
import { profileViewers } from "@/lib/mock-data";
import { useAuth } from "@/lib/store";

export const Route = createFileRoute("/insights")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: Insights,
});

function Insights() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isPremium = profile?.isPremium;

  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-20">
      <header className="sticky top-0 z-40 glass-strong">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="flex h-9 w-9 items-center justify-center rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg">Profile insights</h1>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 px-5 pt-5">
        <Stat icon={<Eye className="h-4 w-4" />} value="1,284" label="Profile views" sub="+18% this week" />
        <Stat icon={<Users className="h-4 w-4" />} value="248" label="Followers" sub="+12 this week" />
        <Stat icon={<Heart className="h-4 w-4" />} value="9.2K" label="Total likes" sub="across 9 posts" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} value="3.4%" label="Engagement" sub="above average" />
      </section>

      <section className="mt-8 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base">Recently viewed your profile</h2>
          <span className="text-[11px] text-muted-foreground">last 7 days</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          {profileViewers.map((v, i) => {
            const blurred = !isPremium;
            return (
              <div
                key={v.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i !== profileViewers.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div className="relative">
                  <img
                    src={v.avatar}
                    alt={v.user}
                    className={`h-10 w-10 rounded-full bg-secondary ${
                      blurred ? "blur-sm" : ""
                    }`}
                  />
                  {v.online && !blurred && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${blurred ? "blur-sm" : ""}`}>
                    @{v.user}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {blurred ? "Hidden — upgrade to reveal" : (
                      <>
                        {v.online ? (
                          <span className="text-emerald-400">● Online now</span>
                        ) : (
                          <span>Last seen recently</span>
                        )}
                        <span className="mx-1.5">·</span>
                        {v.viewedAt}
                      </>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {!isPremium && (
          <button
            onClick={() => navigate({ to: "/subscribe" })}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 px-4 py-3"
          >
            <Crown className="h-4 w-4 text-gold" />
            <span className="text-sm font-semibold text-gradient-gold">
              See everyone — upgrade to Gold
            </span>
          </button>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
