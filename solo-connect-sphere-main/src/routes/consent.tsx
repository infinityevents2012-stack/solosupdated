import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/store";
import { getConsentReceipt, type ConsentReceipt } from "@/lib/consent";
import { ArrowLeft, ShieldCheck, Check, X, FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/consent")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: ConsentReceiptScreen,
});

function ConsentReceiptScreen() {
  const navigate = useNavigate();
  const uid = useAuth((s) => s.profile?.uid);
  const profile = useAuth((s) => s.profile);
  const [receipt, setReceipt] = useState<ConsentReceipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const r = await getConsentReceipt(uid);
      if (!cancelled) {
        setReceipt(r);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const dpdp = receipt?.dpdp_accepted ?? profile?.consentAccepted ?? false;
  const over18 = receipt?.is_over_18 ?? profile?.isOver18 ?? false;
  const acceptedAt = receipt?.accepted_at ? new Date(receipt.accepted_at) : null;

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
          <h1 className="font-display text-xl">Consent receipt</h1>
        </div>
      </header>

      <main className="px-5 py-6">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl glass p-4">
              <FileCheck2 className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  DPDP Act, 2023 receipt
                </p>
                <p className="text-sm font-semibold">
                  Your consent record is on file.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-card/40 p-4">
              <Row label="Account" value={`@${profile?.username ?? "—"}`} />
              <Row
                label="Age verification (18+)"
                value={over18 ? "Confirmed" : "Not confirmed"}
                ok={over18}
              />
              <Row
                label="DPDP Act consent"
                value={dpdp ? "Granted" : "Not granted"}
                ok={dpdp}
              />
              <Row
                label="Accepted at"
                value={acceptedAt ? acceptedAt.toLocaleString() : "—"}
              />
              {receipt?.user_agent && (
                <Row label="Device" value={receipt.user_agent.slice(0, 40) + "…"} />
              )}
            </div>

            <div className="rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-semibold">Your rights under DPDP Act, 2023</span>
              </div>
              You can withdraw consent or request data deletion at any time from
              Settings → Privacy. SoloS will erase your personal data within 7
              days, except where retention is required by Indian law.
            </div>

            <button
              onClick={() => navigate({ to: "/privacy" })}
              className="w-full rounded-2xl bg-white/10 py-3.5 text-sm font-semibold"
            >
              Read full Privacy Policy
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm">
        {ok === true && <Check className="h-3.5 w-3.5 text-emerald-400" />}
        {ok === false && <X className="h-3.5 w-3.5 text-destructive" />}
        {value}
      </span>
    </div>
  );
}
