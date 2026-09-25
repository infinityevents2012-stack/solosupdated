import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Volume2,
} from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/store";
import {
  getCall,
  getIceConfig,
  openSignaling,
  subscribeCall,
  updateCallStatus,
  type DBCall,
  type EndReason,
} from "@/lib/calls";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const search = z.object({
  mode: z.enum(["voice", "video"]).catch("voice"),
  role: z.enum(["caller", "callee"]).catch("caller"),
});

export const Route = createFileRoute("/call/$id")({
  validateSearch: search,
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: CallScreen,
});

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function CallScreen() {
  const { id: callId } = Route.useParams();
  const { mode, role } = Route.useSearch();
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);
  const myUid = profile?.uid ?? "";

  const isVideo = mode === "video";

  const [call, setCall] = useState<DBCall | null>(null);
  const [peer, setPeer] = useState<{
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null>(null);

  const [status, setStatus] = useState<"ringing" | "connecting" | "connected" | "ended">(
    role === "callee" ? "connecting" : "ringing"
  );
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(isVideo);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sigRef = useRef<ReturnType<typeof openSignaling> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const connectedAtRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const retriedStunRef = useRef(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [turnFailed, setTurnFailed] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Load call + peer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getCall(callId);
      if (!c) {
        toast.error("Call not found");
        navigate({ to: "/messages" });
        return;
      }
      if (!cancelled) setCall(c);
      const peerId = c.caller_id === myUid ? c.callee_id : c.caller_id;
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", peerId)
        .single();
      if (!cancelled) setPeer(p as typeof peer);
    })();
    return () => {
      cancelled = true;
    };
  }, [callId, myUid, navigate]);

  // Subscribe to call status changes
  useEffect(() => {
    const unsub = subscribeCall(callId, (c) => {
      setCall(c);
      if (c.status === "declined" || c.status === "ended" || c.status === "missed") {
        setStatus("ended");
        setEndReason(c.end_reason ?? (c.status as EndReason));
        setTimeout(() => doEndCall(false, c.end_reason ?? (c.status as EndReason)), 1500);
      }
      if (c.status === "accepted" && status === "ringing") {
        setStatus("connecting");
      }
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // Set up media + peer connection + signaling
  useEffect(() => {
    if (!call || !myUid) return;
    let disposed = false;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? { width: 640, height: 480 } : false,
        });
      } catch {
        toast.error("Camera/mic permission denied");
        doEndCall(true, "failed");
        return;
      }
      if (disposed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream;
      }

      const iceConfig = await getIceConfig({ stunOnly: retriedStunRef.current });
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (ev) => {
        const [remote] = ev.streams;
        if (isVideo && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remote;
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("connected");
          connectedAtRef.current = Date.now();
        }
        if (pc.connectionState === "failed") {
          if (!retriedStunRef.current) {
            retriedStunRef.current = true;
            setTurnFailed(true);
            toast.warning("TURN failed — retrying with STUN only");
            try { pc.close(); } catch { /* ignore */ }
            pcRef.current = null;
            sigRef.current?.cleanup();
            sigRef.current = null;
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
            setStatus("connecting");
            setRetryAttempt((n) => n + 1);
            return;
          }
          toast.error("Connection failed");
          doEndCall(true, "failed");
        }
        if (pc.connectionState === "connected") {
          setTurnFailed(false);
        }
      };

      const sig = openSignaling(callId, myUid, async (p) => {
        if (!pcRef.current) return;
        if (p.kind === "offer" && role === "callee") {
          await pcRef.current.setRemoteDescription(p.sdp);
          for (const c of pendingIceRef.current) {
            await pcRef.current.addIceCandidate(c);
          }
          pendingIceRef.current = [];
          const ans = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(ans);
          sig.send({ kind: "answer", sdp: ans, from: myUid });
          await updateCallStatus(callId, "accepted");
        } else if (p.kind === "answer" && role === "caller") {
          await pcRef.current.setRemoteDescription(p.sdp);
        } else if (p.kind === "ice") {
          if (pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(p.candidate);
          } else {
            pendingIceRef.current.push(p.candidate);
          }
        } else if (p.kind === "bye") {
          doEndCall(false, "ended");
        }
      });
      sigRef.current = sig;

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sig.send({ kind: "ice", candidate: ev.candidate.toJSON(), from: myUid });
        }
      };

      if (role === "caller") {
        setTimeout(async () => {
          if (!pcRef.current || disposed) return;
          const offer = await pcRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideo,
          });
          await pcRef.current.setLocalDescription(offer);
          sig.send({ kind: "offer", sdp: offer, from: myUid });
        }, 800);
      }
    })();

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id, myUid, retryAttempt]);

  // Connected timer
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Mute / cam toggles
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);
  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);

  const doEndCall = useCallback((notify: boolean, reason: EndReason = "ended") => {
    if (endedRef.current) return;
    endedRef.current = true;
    setStatus("ended");
    setEndReason(reason);

    const durationSec = connectedAtRef.current
      ? Math.round((Date.now() - connectedAtRef.current) / 1000)
      : 0;

    if (notify) {
      sigRef.current?.send({ kind: "bye", from: myUid });
      updateCallStatus(callId, "ended", new Date().toISOString(), {
        duration_seconds: durationSec > 0 ? durationSec : undefined,
        end_reason: reason,
      });
    }
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    sigRef.current?.cleanup();
    sigRef.current = null;

    setTimeout(() => {
      if (call) {
        navigate({
          to: "/messages/$id",
          params: { id: call.conversation_id },
        });
      } else {
        navigate({ to: "/messages" });
      }
    }, 1200);
  }, [callId, myUid, call, navigate]);

  const endReasonLabel = (r: EndReason | null) => {
    switch (r) {
      case "declined": return "Call declined";
      case "missed": return "No answer";
      case "ended": return "Call ended";
      case "cancelled": return "Call cancelled";
      case "failed": return "Connection failed";
      default: return "Call ended";
    }
  };

  const headerLabel = useMemo(() => {
    if (status === "ended") {
      const dur = connectedAtRef.current
        ? Math.round((Date.now() - connectedAtRef.current) / 1000)
        : seconds;
      return `${endReasonLabel(endReason)}${dur > 0 ? ` · ${fmt(dur)}` : ""}`;
    }
    if (status === "ringing")
      return `Ringing… ${isVideo ? "video" : "voice"} call`;
    if (status === "connecting") return "Connecting…";
    return `${isVideo ? "Video" : "Voice"} · ${fmt(seconds)}`;
  }, [status, seconds, isVideo, endReason]);

  const manualRetry = useCallback(() => {
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    sigRef.current?.cleanup();
    sigRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setStatus("connecting");
    setRetryAttempt((n) => n + 1);
    toast.info("Retrying connection…");
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {/* Remote */}
      <div className="absolute inset-0">
        {isVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full bg-black object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-5">
            <motion.div
              animate={{ scale: status === "ringing" ? [1, 1.06, 1] : 1 }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="story-ring rounded-full p-1"
            >
              <img
                src={peer?.avatar_url ?? ""}
                alt={peer?.username ?? "user"}
                className="h-36 w-36 rounded-full bg-secondary"
              />
            </motion.div>
          </div>
        )}
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      {/* Top bar */}
      <div className="relative z-10 px-6 pt-10 text-center">
        <p className="font-display text-3xl">@{peer?.username ?? "…"}</p>
        <p className="mt-1 text-sm text-white/70">{headerLabel}</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-white/40">
          End-to-end · WebRTC
        </p>
        {turnFailed && status !== "connected" && status !== "ended" && (
          <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-left">
            <p className="text-xs font-semibold text-amber-200">
              TURN relay unavailable
            </p>
            <p className="mt-0.5 text-[11px] text-amber-100/80">
              Retrying with STUN-only — your network may be blocking media relays.
            </p>
            <button
              onClick={manualRetry}
              className="mt-2 rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-semibold text-black"
            >
              Retry now
            </button>
          </div>
        )}
      </div>

      {/* Self preview (video mode) */}
      {isVideo && (
        <div className="absolute right-4 top-24 z-10 h-40 w-28 overflow-hidden rounded-2xl border border-white/20 bg-zinc-900 shadow-2xl">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-[10px] text-white/60">
              Camera off
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="relative z-10 mt-auto flex flex-col items-center gap-6 px-6 pb-12">
        {status === "ended" ? (
          <p className="text-sm text-white/50">{endReasonLabel(endReason)}</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <CtrlBtn
                active={!muted}
                onClick={() => setMuted((m) => !m)}
                label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </CtrlBtn>
              {isVideo && (
                <CtrlBtn
                  active={camOn}
                  onClick={() => setCamOn((c) => !c)}
                  label={camOn ? "Cam off" : "Cam on"}
                >
                  {camOn ? (
                    <VideoIcon className="h-6 w-6" />
                  ) : (
                    <VideoOff className="h-6 w-6" />
                  )}
                </CtrlBtn>
              )}
              <CtrlBtn active label="Speaker">
                <Volume2 className="h-6 w-6" />
              </CtrlBtn>
            </div>

            <button
              onClick={() => doEndCall(true, "ended")}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xl"
              aria-label="End call"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({
  children,
  active,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur transition-colors ${
        active ? "bg-white/15 text-white" : "bg-white text-black"
      }`}
    >
      {children}
    </button>
  );
}
