import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type CallMode = "voice" | "video";
export type CallStatus =
  | "ringing"
  | "accepted"
  | "declined"
  | "ended"
  | "missed";

export type EndReason = "declined" | "missed" | "ended" | "cancelled" | "failed";

export interface DBCall {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  mode: CallMode;
  status: CallStatus;
  created_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  end_reason: EndReason | null;
}

/** Fallback STUN-only config */
export const STUN_ONLY_ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/** Fetches TURN credentials from edge function, falls back to STUN. */
export async function getIceConfig(opts?: { stunOnly?: boolean }): Promise<RTCConfiguration> {
  if (opts?.stunOnly) return STUN_ONLY_ICE;
  try {
    const { data, error } = await supabase.functions.invoke("get-turn-credentials");
    if (error) throw error;
    return { iceServers: data.iceServers };
  } catch (e) {
    console.warn("TURN fetch failed, falling back to STUN:", e);
    return STUN_ONLY_ICE;
  }
}

/** Recent calls involving the current user, newest first. */
export async function listMyCalls(uid: string, limit = 50): Promise<DBCall[]> {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .or(`caller_id.eq.${uid},callee_id.eq.${uid}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DBCall[];
}

export async function createCall(
  convId: string,
  callerId: string,
  calleeId: string,
  mode: CallMode
): Promise<DBCall> {
  const { data, error } = await supabase
    .from("calls")
    .insert({
      conversation_id: convId,
      caller_id: callerId,
      callee_id: calleeId,
      mode,
      status: "ringing",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DBCall;
}

export async function updateCallStatus(
  callId: string,
  status: CallStatus,
  endedAt?: string,
  extra?: { duration_seconds?: number; end_reason?: EndReason }
) {
  const patch: { status: string; ended_at?: string; duration_seconds?: number; end_reason?: string } = { status };
  if (endedAt) patch.ended_at = endedAt;
  if (extra?.duration_seconds != null) patch.duration_seconds = extra.duration_seconds;
  if (extra?.end_reason) patch.end_reason = extra.end_reason;
  await supabase.from("calls").update(patch).eq("id", callId);
}

export async function getCall(callId: string): Promise<DBCall | null> {
  const { data } = await supabase
    .from("calls")
    .select("*")
    .eq("id", callId)
    .single();
  return (data as DBCall) ?? null;
}

/** Subscribe to status changes for a single call row. */
export function subscribeCall(
  callId: string,
  onChange: (c: DBCall) => void
) {
  const channel = supabase
    .channel(`call-row:${callId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "calls",
        filter: `id=eq.${callId}`,
      },
      (p) => onChange(p.new as DBCall)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/** Listen for incoming calls to me. */
export function subscribeIncomingCalls(
  myUid: string,
  onCall: (c: DBCall) => void
) {
  const channel = supabase
    .channel(`incoming-calls:${myUid}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "calls",
        filter: `callee_id=eq.${myUid}`,
      },
      (p) => onCall(p.new as DBCall)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ============ WebRTC signaling over Supabase Realtime broadcast ============ */

type SignalPayload =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit; from: string }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit; from: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { kind: "bye"; from: string };

export interface SignalingChannel {
  channel: RealtimeChannel;
  send: (p: SignalPayload) => void;
  cleanup: () => void;
}

export function openSignaling(
  callId: string,
  myUid: string,
  onSignal: (p: SignalPayload) => void
): SignalingChannel {
  const channel = supabase.channel(`call-sig:${callId}`, {
    config: { broadcast: { self: false, ack: false } },
  });
  channel
    .on("broadcast", { event: "sig" }, (msg) => {
      const p = msg.payload as SignalPayload;
      if (p.from !== myUid) onSignal(p);
    })
    .subscribe();
  return {
    channel,
    send: (p) => {
      channel.send({ type: "broadcast", event: "sig", payload: p });
    },
    cleanup: () => {
      supabase.removeChannel(channel);
    },
  };
}
