import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/store";
import { listMyCalls, type DBCall, type EndReason } from "@/lib/calls";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, MessageCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/calls")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: CallsHistory,
});

function fmtDur(seconds: number | null) {
  if (!seconds || seconds < 1) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function reasonLabel(r: EndReason | null): string {
  switch (r) {
    case "declined": return "Declined";
    case "missed": return "Missed";
    case "ended": return "Ended";
    case "cancelled": return "Cancelled";
    case "failed": return "Failed";
    default: return "Ended";
  }
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

interface CallRow extends DBCall {
  peer: { id: string; username: string | null; avatar_url: string | null } | null;
}

function CallsHistory() {
  const navigate = useNavigate();
  const uid = useAuth((s) => s.profile?.uid);
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const calls = await listMyCalls(uid);
      const peerIds = Array.from(new Set(calls.map((c) => (c.caller_id === uid ? c.callee_id : c.caller_id))));
      const { data: peers } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", peerIds);
      const peerMap = new Map((peers ?? []).map((p) => [p.id, p]));
      const enriched: CallRow[] = calls.map((c) => ({
        ...c,
        peer: peerMap.get(c.caller_id === uid ? c.callee_id : c.caller_id) ?? null,
      }));
      if (!cancelled) {
        setRows(enriched);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const openMessage = async (peerId: string) => {
    if (!uid) return;
    const [a, b] = [uid, peerId].sort();
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (conv?.id) {
      navigate({ to: "/messages/$id", params: { id: conv.id } });
    } else {
      const { data: created } = await supabase
        .from("conversations")
        .insert({ user_a: a, user_b: b })
        .select("id")
        .single();
      if (created?.id) navigate({ to: "/messages/$id", params: { id: created.id } });
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
          <h1 className="font-display text-xl">Call history</h1>
        </div>
      </header>

      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <Phone className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No calls yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((c) => {
            const outgoing = c.caller_id === uid;
            const Icon = c.end_reason === "missed" || c.status === "missed"
              ? PhoneMissed
              : outgoing
                ? PhoneOutgoing
                : PhoneIncoming;
            const iconColor = (c.end_reason === "missed" || c.status === "missed" || c.end_reason === "failed")
              ? "text-destructive"
              : "text-muted-foreground";
            return (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <img
                  src={c.peer?.avatar_url ?? ""}
                  alt={c.peer?.username ?? "user"}
                  className="h-11 w-11 rounded-full bg-secondary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                    <p className="truncate text-sm font-semibold">@{c.peer?.username ?? "unknown"}</p>
                    {c.mode === "video" && <Video className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {reasonLabel(c.end_reason)} · {fmtDur(c.duration_seconds)} · {timeLabel(c.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => c.peer && openMessage(c.peer.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
                  aria-label="Message"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
