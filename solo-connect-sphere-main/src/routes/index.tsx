import { createFileRoute, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MapPin, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/lib/store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (raw && JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/feed" });
      }
    }
  },
  component: Landing,
});

function Landing() {
  // touch the store so persistence hydrates
  useAuth();
  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <div className="h-9 w-9 rounded-2xl bg-foreground" />
        <span className="font-display text-2xl tracking-tight">SoloS</span>
      </motion.div>

      <div className="mt-20 flex-1">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-5xl leading-[1.05] tracking-tight"
        >
          Connect to
          <br />
          <span className="text-gradient-gold">who's near.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 text-base text-muted-foreground"
        >
          Proximity-first social. Stories, DMs, and a live map of friends
          within your range.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 space-y-3"
        >
          {[
            { icon: MapPin, label: "Friend finder map, 1–50km" },
            { icon: Users, label: "Daily curated nearby connections" },
            { icon: Sparkles, label: "Stories that disappear in 24h" },
          ].map((f) => (
            <div
              key={f.label}
              className="glass flex items-center gap-3 rounded-2xl px-4 py-3"
            >
              <f.icon className="h-5 w-5 text-foreground" />
              <span className="text-sm text-foreground/90">{f.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3"
      >
        <button
          onClick={() => {
            window.location.href = "/login";
          }}
          className="block w-full rounded-full bg-foreground py-4 text-center text-[15px] font-semibold text-background transition-transform active:scale-[0.98]"
        >
          Sign in
        </button>
        <button
          onClick={() => {
            window.location.href = "/login";
          }}
          className="block w-full rounded-full border border-foreground/20 py-4 text-center text-[15px] font-semibold text-foreground transition-transform active:scale-[0.98]"
        >
          Create account
        </button>
        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <span className="underline">Terms</span> and{" "}
          <span className="underline">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}
