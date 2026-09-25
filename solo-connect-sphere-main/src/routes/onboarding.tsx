import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, MapPin, ShieldCheck, Loader2, Gift } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { checkUsernameAvailable } from "@/lib/connections";
import { applyReferral } from "@/lib/server-limits";
import { saveConsentReceipt } from "@/lib/consent";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const avatarSeed = (s: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${s}&backgroundColor=000000`;

function Onboarding() {
  const navigate = useNavigate();
  const completeOnboarding = useAuth((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(avatarSeed("default"));
  const [locationGranted, setLocationGranted] = useState(false);
  const [over18, setOver18] = useState(false);
  const [consent, setConsent] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Onboarding requires a phone number that has already passed the manual
    // WhatsApp OTP relay (real Supabase Auth uid attached). Anyone without
    // that gets sent back to start verification — this can't be skipped by
    // navigating here directly.
    const p = useAuth.getState().profile;
    if (!p?.phone || !p?.uid) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const handleUsernameChange = useCallback((val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setUsername(clean);
    setUsernameStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (clean.length < 3) return;
    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(clean);
      setUsernameStatus(available ? "available" : "taken");
    }, 500);
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationGranted(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationGranted(true),
      () => setLocationGranted(true) // proceed regardless for demo
    );
  };

  const [submitting, setSubmitting] = useState(false);

  const finish = async () => {
    setSubmitting(true);
    const phone = useAuth.getState().profile?.phone ?? "";

    // By the time a user reaches onboarding, phone verification (the manual
    // WhatsApp OTP relay) has already produced a REAL Supabase Auth session
    // — see src/lib/phone-otp.ts. We never create or derive credentials here;
    // we just attach the chosen username/avatar to that already-authenticated
    // auth.uid()'s profile row.
    const { data: userRes } = await supabase.auth.getUser();
    const uid = useAuth.getState().profile?.uid ?? userRes.user?.id ?? null;
    if (!uid) {
      toast.error("Your session expired. Please verify your phone again.");
      setSubmitting(false);
      navigate({ to: "/login" });
      return;
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ username, avatar_url: avatar })
      .eq("id", uid);
    if (profileErr) {
      console.error("[onboarding] profile update failed:", profileErr.message);
      toast.error("Couldn't set up your account. Please try again.");
      setSubmitting(false);
      return;
    }

    // Persist consent receipt server-side (DPDP record)
    await saveConsentReceipt(uid, true, true);

    // Apply referral code if entered
    if (referralCode.trim().length >= 4) {
      const r = await applyReferral(referralCode.trim().toUpperCase(), phone);
      if (r.ok) {
        toast.success("Referral applied! 🎉");
      } else if (r.reason && r.reason !== "invalid_code") {
        toast.warning(`Referral skipped: ${r.reason.replace(/_/g, " ")}`);
      } else if (r.reason === "invalid_code") {
        toast.warning("Referral code not recognised — skipped");
      }
    }

    completeOnboarding({
      username,
      avatar,
      consentAccepted: true,
      isOver18: true,
      uid,
    });
    navigate({ to: "/feed" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-foreground" : "bg-white/15"
            }`}
          />
        ))}
      </div>

      <div className="mt-10 flex-1">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h1 className="font-display text-4xl tracking-tight">
                Pick a username
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                This is how others will find you on SoloS.
              </p>

              <div className="mt-10 flex flex-col items-center">
                <div className="relative">
                  <img
                    src={avatar}
                    alt="avatar"
                    className="h-28 w-28 rounded-full bg-secondary object-cover ring-2 ring-foreground/20"
                  />
                  <button
                    onClick={() =>
                      setAvatar(avatarSeed(Math.random().toString(36)))
                    }
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Username
                </label>
                <div className="mt-3 flex items-center gap-2 rounded-2xl glass px-4 py-4">
                  <span className="text-muted-foreground">@</span>
                  <input
                    autoFocus
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="your_handle"
                    className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                  />
                  {usernameStatus === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {usernameStatus === "available" && (
                    <Check className="h-4 w-4 text-emerald-400" />
                  )}
                  {usernameStatus === "taken" && (
                    <span className="text-xs text-destructive">Taken</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h1 className="font-display text-4xl tracking-tight">
                Allow location
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                SoloS is built around proximity. We need your location to show
                you who's nearby. Required to use the app.
              </p>

              <div className="mt-10 flex justify-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative flex h-40 w-40 items-center justify-center rounded-full glass"
                >
                  <div className="absolute inset-4 rounded-full bg-foreground/5" />
                  <MapPin className="relative h-16 w-16 text-foreground" />
                </motion.div>
              </div>

              <button
                onClick={requestLocation}
                className={`mt-10 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[15px] font-semibold transition ${
                  locationGranted
                    ? "bg-white/10 text-foreground"
                    : "bg-foreground text-background"
                }`}
              >
                {locationGranted ? (
                  <>
                    <Check className="h-4 w-4" /> Location enabled
                  </>
                ) : (
                  "Allow location access"
                )}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Legal & Consent
                </span>
              </div>
              <h1 className="mt-2 font-display text-3xl tracking-tight">
                Before you enter
              </h1>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setOver18(!over18)}
                  className="flex w-full items-start gap-3 rounded-2xl glass p-4 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      over18
                        ? "border-foreground bg-foreground"
                        : "border-white/30"
                    }`}
                  >
                    {over18 && <Check className="h-3.5 w-3.5 text-background" />}
                  </span>
                  <span className="text-sm">
                    I confirm that I am <b>18 years or older</b> and eligible to
                    use SoloS.
                  </span>
                </button>

                <button
                  onClick={() => setConsent(!consent)}
                  className="flex w-full items-start gap-3 rounded-2xl glass p-4 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      consent
                        ? "border-foreground bg-foreground"
                        : "border-white/30"
                    }`}
                  >
                    {consent && <Check className="h-3.5 w-3.5 text-background" />}
                  </span>
                  <span className="text-sm">
                    I consent to the processing of my personal data
                    (incl. location) per the{" "}
                    <span className="underline">Privacy Policy</span>, in
                    compliance with the <b>Digital Personal Data Protection Act, 2023</b>.
                  </span>
                </button>
              </div>

              <p className="mt-6 text-xs text-muted-foreground">
                You can withdraw consent and request data deletion anytime from
                Settings → Privacy.
              </p>

              <div className="mt-6 rounded-2xl glass p-4">
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Gift className="h-3.5 w-3.5" />
                  Referral code (optional)
                </label>
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                  placeholder="ABCD1234"
                  className="mt-2 w-full bg-transparent font-mono text-lg tracking-widest outline-none placeholder:text-muted-foreground/50"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Got a code from a friend? Enter it to credit them.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        disabled={
          submitting ||
          (step === 0 && (username.length < 3 || usernameStatus === "taken" || usernameStatus === "checking")) ||
          (step === 1 && !locationGranted) ||
          (step === 2 && !(over18 && consent))
        }
        onClick={() => {
          if (step < 2) setStep(step + 1);
          else finish();
        }}
        className="w-full rounded-full bg-foreground py-4 text-[15px] font-semibold text-background disabled:opacity-30"
      >
        {submitting ? "Setting up…" : step < 2 ? "Continue" : "Enter SoloS"}
      </button>
    </div>
  );
}
