import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/store";
import { requestOtp } from "@/lib/phone-otp";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const setPhone = useAuth((s) => s.setPhone);
  const setPendingVerification = useAuth((s) => s.setPendingVerification);
  const [number, setNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const valid = number.replace(/\D/g, "").length === 10;
  const fullPhone = "+91" + number;

  const proceed = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError("");

    // Server-side: generates a secure OTP, hashes + stores it, and returns a
    // wa.me deep link to SoloS's FIXED verification WhatsApp number (never
    // to the user's own number). Nothing is sent automatically — a human
    // operator has to open the link and manually tap Send.
    const result = await requestOtp(fullPhone);

    if (!result.ok) {
      setSending(false);
      if (result.reason === "cooldown") {
        setError(`Please wait ${result.retryAfterSeconds ?? 60}s before requesting another code.`);
      } else if (result.reason === "too_many_requests") {
        setError("Too many attempts for this number. Please try again later.");
      } else if (result.reason === "invalid_phone") {
        setError("That doesn't look like a valid phone number.");
      } else if (result.reason === "server_misconfigured") {
        setError("Verification is temporarily unavailable. Please try again shortly.");
      } else {
        setError("Something went wrong. Please check your connection and try again.");
      }
      return;
    }

    setPhone(fullPhone);
    setPendingVerification({
      verificationId: result.verificationId,
      phone: result.phone,
      whatsappUrl: result.whatsappUrl,
      expiresAt: result.expiresAt,
      resendCooldownSeconds: result.resendCooldownSeconds,
      requestedAt: Date.now(),
    });

    // Open WhatsApp so the verification operator can review + manually send
    // the prefilled message. This is a best-effort convenience — the OTP
    // screen also shows a persistent "Open WhatsApp" link in case the popup
    // is blocked or the user closes it.
    try {
      window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      /* ignore popup-blocked errors; the OTP screen offers a fallback link */
    }

    setSending(false);
    navigate({ to: "/otp" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12">
      <button
        onClick={() => navigate({ to: "/" })}
        className="flex h-10 w-10 items-center justify-center rounded-full glass"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 flex-1"
      >
        <h1 className="font-display text-4xl tracking-tight">
          What's your number?
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We'll send a verification code through WhatsApp. The code is sent
          manually by our verification team — this keeps SoloS authentic.
        </p>

        <div className="mt-8">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Phone number
          </label>
          <div className="mt-3 flex items-center gap-3 rounded-2xl glass px-4 py-4">
            <span className="text-lg font-medium">🇮🇳 +91</span>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={10}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
                setError("");
              }}
              placeholder="98765 43210"
              className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The verification code will be sent to you manually through
            WhatsApp — SoloS doesn't send it automatically.
          </p>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-xs text-destructive"
            >
              {error}
            </motion.p>
          )}
        </div>
      </motion.div>

      <button
        disabled={!valid || sending}
        onClick={proceed}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[15px] font-semibold text-background disabled:opacity-30"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Send OTP on WhatsApp <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}
