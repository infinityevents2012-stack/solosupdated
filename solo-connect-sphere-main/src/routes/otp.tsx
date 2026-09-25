import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/store";
import { requestOtp, verifyOtp } from "@/lib/phone-otp";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/otp")({
  component: Otp,
});

function reasonMessage(reason: string, attemptsRemaining?: number): string {
  switch (reason) {
    case "invalid_code":
      return typeof attemptsRemaining === "number"
        ? `Wrong code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} left.`
        : "Wrong code. Please try again.";
    case "expired":
      return "That code has expired. Request a new one.";
    case "too_many_attempts":
      return "Too many wrong attempts. Request a new code.";
    case "already_used":
    case "verified":
    case "superseded":
      return "That code was already used. Request a new one.";
    case "not_found":
      return "Verification not found. Please request a new code.";
    case "cooldown":
      return "Please wait before requesting another code.";
    case "too_many_requests":
      return "Too many requests for this number. Try again later.";
    case "session_error":
      return "Couldn't finish signing you in. Please try again.";
    case "server_misconfigured":
      return "Verification is temporarily unavailable. Please try again shortly.";
    default:
      return "Something went wrong. Please check your connection and try again.";
  }
}

function Otp() {
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);
  const pending = useAuth((s) => s.pendingVerification);
  const setPendingVerification = useAuth((s) => s.setPendingVerification);
  const completeOnboarding = useAuth((s) => s.completeOnboarding);

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [consumed, setConsumed] = useState(false); // true once OTP is exhausted/expired/used
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!profile?.phone || !pending || pending.phone !== profile.phone) {
      navigate({ to: "/login" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown countdown, driven by the server-provided cooldown window.
  useEffect(() => {
    if (!pending) return;
    const tick = () => {
      const elapsed = (Date.now() - pending.requestedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(pending.resendCooldownSeconds - elapsed));
      setCooldown(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pending]);

  const code = digits.join("");

  const doVerify = async () => {
    if (!pending || code.length !== 6 || verifying || consumed) return;
    setVerifying(true);
    setError("");

    const result = await verifyOtp(pending.verificationId, pending.phone, code);

    if (!result.ok) {
      setVerifying(false);
      setError(reasonMessage(result.reason, result.attemptsRemaining));
      if (["expired", "too_many_attempts", "already_used", "verified", "superseded", "not_found"].includes(result.reason)) {
        setConsumed(true);
      }
      setDigits(Array(6).fill(""));
      refs.current[0]?.focus();
      return;
    }

    // Real Supabase Auth session now exists (auth.uid() === result.uid).
    // Attach it to local profile state; onboarding/feed read from here.
    if (result.hasUsername) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", result.uid)
        .maybeSingle();
      completeOnboarding({
        uid: result.uid,
        username: prof?.username ?? "",
        avatar: prof?.avatar_url ?? "",
        consentAccepted: true,
        isOver18: true,
      });
      setPendingVerification(null);
      navigate({ to: "/feed" });
      return;
    }

    // New (or not-yet-onboarded) user: keep isAuthenticated false until
    // onboarding finishes, but attach the real uid so onboarding can use it.
    useAuth.setState((s) => ({
      profile: s.profile ? { ...s.profile, uid: result.uid } : s.profile,
    }));
    setPendingVerification(null);
    navigate({ to: "/onboarding" });
  };

  useEffect(() => {
    if (code.length === 6) {
      doVerify();
    } else {
      setError((e) => (e && consumed ? e : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    if (!profile?.phone || cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    const result = await requestOtp(profile.phone);
    setResending(false);

    if (!result.ok) {
      setError(reasonMessage(result.reason));
      return;
    }

    setPendingVerification({
      verificationId: result.verificationId,
      phone: result.phone,
      whatsappUrl: result.whatsappUrl,
      expiresAt: result.expiresAt,
      resendCooldownSeconds: result.resendCooldownSeconds,
      requestedAt: Date.now(),
    });
    setConsumed(false);
    setDigits(Array(6).fill(""));
    refs.current[0]?.focus();

    try {
      window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      /* fallback link below still works */
    }
  };

  const update = (i: number, v: string) => {
    if (consumed) return;
    const c = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = c;
    setDigits(next);
    if (c && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12">
      <button
        onClick={() => navigate({ to: "/login" })}
        className="flex h-10 w-10 items-center justify-center rounded-full glass"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 flex-1"
      >
        <h1 className="font-display text-4xl tracking-tight">Enter code</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sent manually via WhatsApp to {profile?.phone}.{" "}
          <button className="underline" onClick={() => navigate({ to: "/login" })}>
            Change
          </button>
        </p>

        {pending?.whatsappUrl && (
          <a
            href={pending.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-full glass px-4 py-3 text-sm font-medium"
          >
            <MessageCircle className="h-4 w-4" /> Open WhatsApp for your code
          </a>
        )}

        <div className="mt-8 flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) {
                  refs.current[i - 1]?.focus();
                }
              }}
              inputMode="numeric"
              maxLength={1}
              disabled={verifying || consumed}
              autoFocus={i === 0}
              className="h-14 w-12 rounded-2xl glass text-center font-display text-2xl outline-none focus:border-foreground disabled:opacity-40"
            />
          ))}
        </div>

        {verifying && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
          </p>
        )}

        {error && !verifying && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}

        <button
          onClick={() => void doVerify()}
          disabled={code.length !== 6 || verifying || consumed}
          className="mt-6 w-full rounded-full bg-foreground py-3.5 text-sm font-semibold text-background disabled:opacity-30"
        >
          Verify
        </button>

        <button
          onClick={() => void resend()}
          disabled={cooldown > 0 || resending}
          className="mt-4 w-full text-center text-xs text-muted-foreground underline disabled:no-underline disabled:opacity-50"
        >
          {resending
            ? "Sending new code…"
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Resend code"}
        </button>
      </motion.div>
    </div>
  );
}
