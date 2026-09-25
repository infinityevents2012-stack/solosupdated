import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { GoldBadge } from "@/components/GoldBadge";
import { Edit3, Search, MessageCircle, Check, X, UserPlus, Phone as PhoneIcon, PhoneMissed, PhoneIncoming, PhoneOutgoing, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/store";
import {
  getOrCreateDemoConversations,
  listConversations,
  updatePresence,
} from "@/lib/messaging";
import {
  listIncomingPendingRequests,
  respondToConnectionRequest,
  type DBConnectionRequest,
} from "@/lib/connections";
import { listMyCalls, type DBCall } from "@/lib/calls";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: Messages,
});

interface Row {
  id: string;
  peerId: string;
  peer: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    is_premium: boolean;
    last_seen: string;
  } | null;
  lastMessage: string;
  lastAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function isOnline(last_seen: string) {
  return Date.now() - new Date(last_seen).getTime() < 2 * 60 * 1000;
}

function Messages() {
  const uid = useAuth((s) => s.profile?.uid);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<(DBConnectionRequest & { peer?: { username: string | null; avatar_url: string | null } })[]>([]);
  const [calls, setCalls] = useState<(DBCall & { peer?: { id: string; username: string | null; avatar_url: string | null } })[]>([]);
  const [tab, setTab] = useState<"chats" | "calls">("chats");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [autoSwitched, setAutoSwitched] = useState(false);

  const refreshPending = useCallback(async (myUid: string) => {
    const reqs = await listIncomingPendingRequests(myUid);
    if (reqs.length === 0) {
      setPending([]);
      return;
    }
    const senderIds = Array.from(new Set(reqs.map((r) => r.sender_id)));
    const { data: peers } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", senderIds);
    const peerMap = new Map((peers ?? []).map((p) => [p.id, p]));
    setPending(reqs.map((r) => ({ ...r, peer: peerMap.get(r.sender_id) ?? undefined })));
  }, []);

  const refreshCalls = useCallback(async (myUid: string) => {
    const c = await listMyCalls(myUid, 30);
    if (c.length === 0) {
      setCalls([]);
      return;
    }
    const peerIds = Array.from(new Set(c.map((x) => x.caller_id === myUid ? x.callee_id : x.caller_id)));
    const { data: peers } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", peerIds);
    const peerMap = new Map((peers ?? []).map((p) => [p.id, p]));
    setCalls(c.map((x) => {
      const pid = x.caller_id === myUid ? x.callee_id : x.caller_id;
      return { ...x, peer: peerMap.get(pid) ?? undefined };
    }));
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      await updatePresence();
      await getOrCreateDemoConversations(uid);
      const data = await listConversations(uid);
      if (!cancelled) {
        setRows(data as Row[]);
        setLoading(false);
      }
      await refreshPending(uid);
      await refreshCalls(uid);
    })();

    // Refresh on any new message
    const channel = supabase
      .channel("inbox-refresh")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async () => {
          const data = await listConversations(uid);
          if (!cancelled) setRows(data as Row[]);
        }
      )
      .subscribe();

    const crChannel = supabase
      .channel("inbox-cr")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        () => { refreshPending(uid); }
      )
      .subscribe();

    const callsChannel = supabase
      .channel("inbox-calls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => { refreshCalls(uid); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(crChannel);
      supabase.removeChannel(callsChannel);
    };
  }, [uid, refreshPending, refreshCalls]);

  // Auto-switch to chats once when pending requests arrive
  useEffect(() => {
    if (!autoSwitched && pending.length > 0 && tab !== "chats") {
      setTab("chats");
      setAutoSwitched(true);
    }
  }, [pending.length, tab, autoSwitched]);

  const respond = async (req: DBConnectionRequest, status: "accepted" | "rejected") => {
    if (respondingId) return;
    setRespondingId(req.id);
    try {
      await respondToConnectionRequest(req.id, status);
      toast.success(status === "accepted" ? "Request accepted" : "Request rejected");
      if (uid) await refreshPending(uid);
    } catch {
      toast.error("Action failed");
    } finally {
      setRespondingId(null);
    }
  };

  const filtered = rows.filter((r) =>
    (r.peer?.username ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell>
      <header className="sticky top-0 z-40 glass-strong px-5 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl">Messages</h1>
          <button className="flex h-9 w-9 items-center justify-center rounded-full glass">
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <div className="mt-3 flex gap-2 text-xs">
          <button
            onClick={() => setTab("chats")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-semibold ${tab === "chats" ? "bg-foreground text-background" : "bg-white/5 text-muted-foreground"}`}
          >
            Chats
            {pending.length > 0 && (
              <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${tab === "chats" ? "bg-background text-foreground" : "bg-rose-500 text-white"}`}>
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("calls")}
            className={`flex-1 rounded-full py-1.5 font-semibold ${tab === "calls" ? "bg-foreground text-background" : "bg-white/5 text-muted-foreground"}`}
          >
            Calls
          </button>
        </div>
      </header>

      {pending.length > 0 && tab === "chats" && (
        <section className="border-b border-white/10 px-5 py-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <UserPlus className="h-3 w-3" />
            Connection requests · {pending.length}
          </div>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                <img
                  src={p.peer?.avatar_url ?? ""}
                  alt={p.peer?.username ?? "user"}
                  className="h-10 w-10 rounded-full bg-secondary"
                />
                <p className="flex-1 truncate text-sm font-semibold">
                  @{p.peer?.username ?? "unknown"}
                </p>
                <button
                  onClick={() => respond(p, "accepted")}
                  disabled={respondingId !== null}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 disabled:opacity-50"
                  aria-label="Accept"
                >
                  {respondingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => respond(p, "rejected")}
                  disabled={respondingId !== null}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 disabled:opacity-50"
                  aria-label="Reject"
                >
                  {respondingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "chats" ? (
        loading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Loading conversations…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No conversations yet. Connect with someone nearby on the map to
              start chatting.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((c) => {
              const online = c.peer ? isOnline(c.peer.last_seen) : false;
              return (
                <li key={c.id}>
                  <Link
                    to="/messages/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/5"
                  >
                    <div className="relative">
                      <img
                        src={c.peer?.avatar_url ?? ""}
                        alt={c.peer?.username ?? "user"}
                        className="h-12 w-12 rounded-full bg-secondary"
                      />
                      {online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">
                            @{c.peer?.username ?? "unknown"}
                          </p>
                          <GoldBadge premium={c.peer?.is_premium} />
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(c.lastAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessage}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <PhoneIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No calls yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {calls.map((c) => {
            const outgoing = c.caller_id === uid;
            const dur = c.duration_seconds ?? 0;
            const mins = Math.floor(dur / 60);
            const secs = dur % 60;
            const isMissed = c.end_reason === "missed" || c.end_reason === "declined";
            const Icon = isMissed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
            const reasonLabel = c.end_reason === "missed" ? "Missed" : c.end_reason === "declined" ? "Declined" : c.end_reason === "cancelled" ? "Cancelled" : c.end_reason === "failed" ? "Failed" : dur > 0 ? `${mins}m ${secs}s` : "Ended";
            return (
              <li key={c.id}>
                <Link
                  to="/messages/$id"
                  params={{ id: c.conversation_id }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/5"
                >
                  <img
                    src={c.peer?.avatar_url ?? ""}
                    alt={c.peer?.username ?? "user"}
                    className="h-12 w-12 rounded-full bg-secondary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">@{c.peer?.username ?? "unknown"}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className={`h-3 w-3 ${isMissed ? "text-rose-400" : ""}`} />
                      {c.mode === "video" ? "Video" : "Voice"} · {reasonLabel}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
