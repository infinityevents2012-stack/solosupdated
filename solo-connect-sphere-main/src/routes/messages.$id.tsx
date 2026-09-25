import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Video,
  Image as ImageIcon,
  Send,
  Smile,
  Plus,
  MoreVertical,
  Ban,
  Flag,
  Check,
  CheckCheck,
  Reply,
  X as XIcon,
} from "lucide-react";
import { useAuth } from "@/lib/store";
import { GoldBadge } from "@/components/GoldBadge";
import {
  DBMessage,
  fetchMessagesPage,
  getConversation,
  PAGE_SIZE,
  sendImageMessage,
  sendTextMessage,
  subscribeToConversation,
  subscribeTyping,
  updatePresence,
  markConversationRead,
  isBlocked as isBlockedLookup,
  blockUser,
  unblockUser,
} from "@/lib/messaging";
import { createCall } from "@/lib/calls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/messages/$id")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: ChatThread,
});

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ChatThread() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const uid = useAuth((s) => s.profile?.uid);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const typingSendRef = useRef<((typing: boolean) => void) | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollHeightRef = useRef(0);

  const [peer, setPeer] = useState<{
    id: string;
    username: string | null;
    avatar_url: string | null;
    is_premium: boolean;
    last_seen: string;
  } | null>(null);
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [block, setBlock] = useState<{ blocked: boolean; iBlocked: boolean }>({
    blocked: false,
    iBlocked: false,
  });
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<DBMessage | null>(null);

  // Initial load + realtime + typing
  useEffect(() => {
    if (!uid) return;
    let cleanupMsgs: (() => void) | null = null;
    let cleanupTyping: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const conv = await getConversation(id, uid);
      if (!conv) {
        toast.error("Conversation not found");
        navigate({ to: "/messages" });
        return;
      }
      if (!cancelled) setPeer(conv.peer);

      if (conv.peer) {
        const b = await isBlockedLookup(uid, conv.peer.id);
        if (!cancelled) setBlock(b);
      }

      const initial = await fetchMessagesPage(id);
      if (!cancelled) {
        setMessages(initial);
        setHasMore(initial.length === PAGE_SIZE);
      }

      cleanupMsgs = subscribeToConversation(
        id,
        (m) =>
          setMessages((prev) =>
            prev.some((p) => p.id === m.id) ? prev : [...prev, m]
          ),
        (m) =>
          setMessages((prev) => prev.map((p) => (p.id === m.id ? m : p)))
      );

      const typing = subscribeTyping(id, uid, (t) => setPeerTyping(t));
      typingSendRef.current = typing.sendTyping;
      cleanupTyping = typing.cleanup;

      await updatePresence();
      await markConversationRead(id, uid);
    })();

    return () => {
      cancelled = true;
      cleanupMsgs?.();
      cleanupTyping?.();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [id, uid, navigate]);

  // Auto-scroll on new tail message
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    if (uid) markConversationRead(id, uid);
  }, [messages.length, id, uid]);

  // Infinite scroll
  const onScroll = async () => {
    const el = scrollerRef.current;
    if (!el || loadingMore || !hasMore || messages.length === 0) return;
    if (el.scrollTop < 60) {
      setLoadingMore(true);
      lastScrollHeightRef.current = el.scrollHeight;
      const oldest = messages[0].created_at;
      try {
        const older = await fetchMessagesPage(id, oldest);
        if (older.length === 0) {
          setHasMore(false);
        } else {
          setMessages((prev) => [...older, ...prev]);
          requestAnimationFrame(() => {
            if (!scrollerRef.current) return;
            const diff =
              scrollerRef.current.scrollHeight - lastScrollHeightRef.current;
            scrollerRef.current.scrollTop = diff + 1;
          });
          if (older.length < PAGE_SIZE) setHasMore(false);
        }
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const onTyping = (val: string) => {
    setText(val);
    if (!typingSendRef.current) return;
    typingSendRef.current(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingSendRef.current?.(false);
    }, 1500);
  };

  const send = async () => {
    if (!text.trim() || !uid || sending) return;
    if (block.blocked) {
      toast.error(
        block.iBlocked ? "Unblock to send a message" : "You can't message this user"
      );
      return;
    }
    const t = text.trim();
    setText("");
    typingSendRef.current?.(false);
    setSending(true);
    try {
      await sendTextMessage(id, uid, t, replyTo?.id ?? null);
      setReplyTo(null);
    } catch {
      toast.error("Failed to send");
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File) => {
    if (!uid) return;
    if (block.blocked) {
      toast.error("Blocked — can't send image");
      return;
    }
    setSending(true);
    try {
      await sendImageMessage(id, uid, file, replyTo?.id ?? null);
      setReplyTo(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send image";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const startCall = async (callMode: "voice" | "video") => {
    if (!uid || !peer) return;
    if (block.blocked) {
      toast.error("Cannot call a blocked user");
      return;
    }
    try {
      const c = await createCall(id, uid, peer.id, callMode);
      navigate({
        to: "/call/$id",
        params: { id: c.id },
        search: { mode: callMode, role: "caller" },
      });
    } catch {
      toast.error("Could not start call");
    }
  };

  const onBlockConfirm = async () => {
    if (!uid || !peer) return;
    setBlockDialogOpen(false);
    const wasBlocked = block.iBlocked;
    try {
      if (wasBlocked) {
        await unblockUser(uid, peer.id);
        setBlock({ blocked: false, iBlocked: false });
        toast.success(`Unblocked @${peer.username}`, {
          duration: 6000,
          action: {
            label: "Undo",
            onClick: async () => {
              await blockUser(uid, peer.id);
              setBlock({ blocked: true, iBlocked: true });
            },
          },
        });
      } else {
        await blockUser(uid, peer.id);
        setBlock({ blocked: true, iBlocked: true });
        toast.success(`Blocked @${peer.username}`, {
          duration: 6000,
          action: {
            label: "Undo",
            onClick: async () => {
              await unblockUser(uid, peer.id);
              setBlock({ blocked: false, iBlocked: false });
            },
          },
        });
      }
    } catch {
      toast.error("Action failed");
    }
  };

  const onReport = () => {
    if (!peer) return;
    toast.success(
      `Report received for @${peer.username}. Our Grievance Officer will review within 24 hours per IT Rules 2021.`
    );
  };

  const online =
    peer && Date.now() - new Date(peer.last_seen).getTime() < 2 * 60 * 1000;

  // Find the last read message index for the "Read" divider
  const lastPeerReadIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === uid && messages[i].read_at) return i;
    }
    return -1;
  })();

  const messageMap = new Map(messages.map((m) => [m.id, m]));

  const quotedTextPreview = (m: DBMessage | null | undefined) => {
    if (!m) return "Original message unavailable";
    if (m.content) return m.content.length > 80 ? m.content.slice(0, 80) + "…" : m.content;
    if (m.image_url) return "Photo";
    return "Message";
  };

  const QuotedBubble = ({ quoted, mine }: { quoted: DBMessage | null | undefined; mine: boolean }) => {
    const missing = !quoted;
    return (
      <div
        className={`mb-1.5 flex items-center gap-2 rounded-xl border-l-2 px-2 py-1.5 text-[11px] ${
          mine
            ? "border-background/40 bg-background/10 text-background/70"
            : "border-foreground/40 bg-white/5 text-muted-foreground"
        } ${missing ? "italic opacity-70" : ""}`}
      >
        {quoted?.image_url && (
          <img
            src={quoted.image_url}
            alt="quoted"
            className="h-9 w-9 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold opacity-80">
            {missing ? "Deleted" : quoted!.sender_id === uid ? "You" : `@${peer?.username ?? ""}`}
          </p>
          <p className="truncate">{quotedTextPreview(quoted)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col">
      <header className="sticky top-0 z-40 glass-strong">
        <div className="flex items-center gap-3 px-3 py-3">
          <button
            onClick={() => navigate({ to: "/messages" })}
            className="flex h-9 w-9 items-center justify-center rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative">
            <img
              src={peer?.avatar_url ?? ""}
              alt={peer?.username ?? "user"}
              className="h-9 w-9 rounded-full bg-secondary"
            />
            {online && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
            )}
          </div>
          <div className="flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">
                @{peer?.username ?? "loading…"}
              </p>
              <GoldBadge premium={peer?.is_premium} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {peerTyping ? "typing…" : online ? "Active now" : "Offline"}
            </p>
          </div>
          <button
            onClick={() => startCall("voice")}
            className="flex h-9 w-9 items-center justify-center rounded-full glass"
            aria-label="Voice call"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            onClick={() => startCall("video")}
            className="flex h-9 w-9 items-center justify-center rounded-full glass"
            aria-label="Video call"
          >
            <Video className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full glass"
                aria-label="More"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setBlockDialogOpen(true)}>
                <Ban className="mr-2 h-4 w-4" />
                {block.iBlocked ? "Unblock user" : "Block user"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onReport}>
                <Flag className="mr-2 h-4 w-4" />
                Report chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Block AlertDialog */}
      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {block.iBlocked ? "Unblock" : "Block"} @{peer?.username}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {block.iBlocked
                ? "They will be able to send you messages and calls again."
                : "They won't be able to message or call you. You can undo this."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onBlockConfirm}>
              {block.iBlocked ? "Unblock" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {block.blocked && (
        <div className="border-y border-white/10 bg-white/5 px-4 py-2 text-center text-[11px] text-muted-foreground">
          {block.iBlocked
            ? "You blocked this user. Unblock to resume messaging."
            : "Messaging is unavailable."}
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
      >
        {loadingMore && (
          <div className="py-2 text-center text-[11px] text-muted-foreground">
            Loading older…
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Beginning of conversation
          </div>
        )}
        {messages.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No messages yet. Say hi 👋
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => {
              const mine = m.sender_id === uid;
              const showReadDivider = mine && idx === lastPeerReadIdx && idx < messages.length - 1;
              const quoted = m.quoted_message_id ? messageMap.get(m.quoted_message_id) : null;
              return (
                <div key={m.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: 0, right: 90 }}
                      dragElastic={0.15}
                      dragMomentum={false}
                      whileDrag={{ scale: 0.98 }}
                      onDragEnd={(_, info) => {
                        const triggered =
                          (info.offset.x > 70 || info.velocity.x > 500) && !block.blocked;
                        if (triggered) {
                          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                            try { navigator.vibrate?.(15); } catch { /* noop */ }
                          }
                          setReplyTo(m);
                        }
                      }}
                      className="flex max-w-[78%] flex-col items-end gap-0.5"
                    >
                      <div
                        className={`${
                          m.image_url && !quoted
                            ? "overflow-hidden rounded-3xl"
                            : "rounded-3xl px-4 py-2"
                        } ${
                          mine
                            ? "bg-foreground text-background"
                            : "bg-white/10 text-foreground"
                        }`}
                      >
                        {m.quoted_message_id && (
                          <QuotedBubble quoted={quoted} mine={mine} />
                        )}
                        {m.image_url ? (
                          <img
                            src={m.image_url}
                            alt="sent"
                            className={`max-h-80 w-full object-cover ${quoted ? "rounded-xl" : ""}`}
                          />
                        ) : (
                          <p className="text-sm">{m.content}</p>
                        )}
                        <p
                          className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                            mine ? "text-background/60" : "text-muted-foreground"
                          } ${m.image_url && !quoted ? "px-3 pb-2" : ""}`}
                        >
                          {fmtTime(m.created_at)}
                          {mine && (
                            m.read_at ? (
                              <CheckCheck className="ml-1 inline h-3 w-3 text-sky-400" />
                            ) : (
                              <Check className="ml-1 inline h-3 w-3" />
                            )
                          )}
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                  {showReadDivider && (
                    <div className="my-2 flex items-center gap-2">
                      <div className="flex-1 border-t border-sky-400/30" />
                      <span className="text-[10px] text-sky-400/70">Read</span>
                      <div className="flex-1 border-t border-sky-400/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </AnimatePresence>
        )}

        {peerTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-3xl bg-white/10 px-4 py-2">
              <Dot delay={0} />
              <Dot delay={0.15} />
              <Dot delay={0.3} />
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 glass-strong px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border-l-2 border-sky-400 bg-white/5 px-3 py-2">
            <Reply className="h-4 w-4 text-sky-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-sky-400">
                Replying to {replyTo.sender_id === uid ? "yourself" : `@${peer?.username ?? ""}`}
              </p>
              <p className="truncate text-xs text-muted-foreground">{quotedTextPreview(replyTo)}</p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"
              aria-label="Cancel reply"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={block.blocked}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"
            aria-label="Send image"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) sendImage(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white/5 px-4 py-2">
            <input
              value={text}
              onChange={(e) => onTyping(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={block.blocked ? "Messaging disabled" : "Message…"}
              disabled={block.blocked}
              className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50"
            />
            <Smile className="h-5 w-5 text-muted-foreground" />
          </div>
          {text.trim() ? (
            <button
              onClick={send}
              disabled={sending || block.blocked}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="block h-1.5 w-1.5 rounded-full bg-muted-foreground"
      animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}
