import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, PlayCircle, X, Zap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/store";

export function LimitReachedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { addBonusConnections } = useAuth();
  const [stage, setStage] = useState<"intro" | "ad" | "done">("intro");
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (!open) {
      setStage("intro");
      setSeconds(30);
    }
  }, [open]);

  useEffect(() => {
    if (stage !== "ad") return;
    if (seconds <= 0) {
      addBonusConnections(5);
      setStage("done");
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, seconds, addBonusConnections]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center"
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 24 }}
            className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-card p-6 sm:rounded-3xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>

            {stage === "intro" && (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                  <Zap className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-center font-display text-2xl">
                  Daily limit reached
                </h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  You've used all 10 free connections today. Watch a short ad
                  to unlock 5 more, or go unlimited with Gold.
                </p>

                <button
                  onClick={() => {
                    setSeconds(30);
                    setStage("ad");
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3.5 font-semibold text-background"
                >
                  <PlayCircle className="h-5 w-5" />
                  Watch Ad to Unlock 5 More
                </button>

                <button
                  onClick={() => {
                    onClose();
                    navigate({ to: "/subscribe" });
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 py-3.5 font-semibold"
                >
                  <Crown className="h-5 w-5 text-gold" />
                  <span className="text-gradient-gold">Go Unlimited · Gold</span>
                </button>
              </>
            )}

            {stage === "ad" && (
              <div className="py-6">
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/30 via-pink-500/20 to-orange-500/30">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="font-display text-3xl">AD</p>
                      <p className="mt-1 text-xs text-white/70">
                        Sponsored content
                      </p>
                    </div>
                  </div>
                  <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium tabular-nums">
                    {seconds}s
                  </div>
                  <div className="absolute bottom-0 left-0 h-1 bg-foreground transition-all"
                    style={{ width: `${((30 - seconds) / 30) * 100}%` }}
                  />
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Please wait — your reward will unlock automatically.
                </p>
              </div>
            )}

            {stage === "done" && (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <Zap className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-display text-2xl">+5 connections</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Unlocked. Go connect with someone amazing.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 w-full rounded-2xl bg-foreground py-3.5 font-semibold text-background"
                >
                  Continue
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
