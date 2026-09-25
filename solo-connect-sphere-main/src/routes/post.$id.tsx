import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/store";
import {
  addComment,
  deleteComment,
  getOrCreateMockPost,
  getPostById,
  listComments,
  subscribeComments,
  type CommentNode,
  type PostWithAuthor,
} from "@/lib/comments";
import { posts as mockPosts } from "@/lib/mock-data";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/post/$id")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: PostDetail,
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PostDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const meId = useAuth((s) => s.profile?.uid);

  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const MAX_DEPTH = 2; // visual nesting cap; deeper replies collapse behind expander

  // Resolve post (real UUID or mock slug)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPost(true);
      let p: PostWithAuthor | null = null;
      if (UUID_RE.test(id)) {
        p = await getPostById(id);
      } else {
        // Mock id like "p1" — surface mock display data and back-fill DB row.
        p = await getOrCreateMockPost(id);
        const mock = mockPosts.find((m) => m.id === id);
        if (p && mock) {
          p = {
            ...p,
            image_url: p.image_url ?? mock.image,
            caption: p.caption ?? mock.caption,
            location: p.location ?? mock.location ?? null,
            author: p.author && {
              ...p.author,
              username: p.author.username ?? mock.user,
              avatar_url: p.author.avatar_url ?? mock.avatar,
            },
          };
        }
      }
      if (!cancelled) {
        setPost(p);
        setLoadingPost(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load + subscribe comments
  const refresh = useCallback(async (postId: string) => {
    const list = await listComments(postId);
    setComments(list);
    setLoadingComments(false);
  }, []);

  useEffect(() => {
    if (!post?.id) return;
    setLoadingComments(true);
    refresh(post.id);
    const unsub = subscribeComments(post.id, () => refresh(post.id));
    return () => unsub();
  }, [post?.id, refresh]);

  const submit = async () => {
    if (!post || !text.trim() || submitting) return;
    setSubmitting(true);
    const created = await addComment(post.id, text, replyTo?.id ?? null);
    setSubmitting(false);
    if (!created) {
      toast.error("Couldn't post comment");
      return;
    }
    setText("");
    setReplyTo(null);
    // realtime will refresh, but refresh immediately for snappiness
    refresh(post.id);
  };

  const onReply = (c: CommentNode) => {
    setReplyTo(c);
    // Highlight the comment being replied to and scroll the composer into view.
    setHighlightId(c.id);
    const el = commentRefs.current.get(c.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.focus({ preventScroll: true });
    }, 350);
    setTimeout(() => setHighlightId((id) => (id === c.id ? null : id)), 1800);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onDelete = async (c: CommentNode) => {
    const ok = await deleteComment(c.id);
    if (!ok) toast.error("Couldn't delete");
    else if (post) refresh(post.id);
  };

  if (loadingPost) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">Post not found</p>
        <button
          onClick={() => navigate({ to: "/feed" })}
          className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
        >
          Back to feed
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 glass-strong px-4 py-3">
        <button
          onClick={() => navigate({ to: "/feed" })}
          className="flex h-9 w-9 items-center justify-center rounded-full glass"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg">Post</h1>
      </header>

      {/* Post */}
      <article className="border-b border-border/40 pb-4">
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="story-ring rounded-full p-[1.5px]">
            <img
              src={post.author?.avatar_url ?? ""}
              alt={post.author?.username ?? "user"}
              className="h-9 w-9 rounded-full bg-secondary"
            />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">
              @{post.author?.username ?? "user"}
            </p>
            {post.location && (
              <p className="text-[11px] text-muted-foreground">{post.location}</p>
            )}
          </div>
        </div>
        {post.image_url && (
          <div className="aspect-[4/5] w-full overflow-hidden bg-secondary">
            <img
              src={post.image_url}
              alt={post.caption ?? "post"}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {post.caption && (
          <p className="px-5 pt-3 text-sm">
            <span className="font-semibold">@{post.author?.username ?? "user"}</span>{" "}
            {post.caption}
          </p>
        )}
      </article>

      {/* Comments */}
      <section className="px-5 pt-5">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Comments ({countAll(comments)})
        </h2>
        {loadingComments ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Be the first to comment ✨
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                node={c}
                meId={meId}
                onReply={onReply}
                onDelete={onDelete}
                highlightId={highlightId}
                expanded={expanded}
                toggleExpand={toggleExpand}
                maxDepth={MAX_DEPTH}
                registerRef={(id, el) => {
                  if (el) commentRefs.current.set(id, el);
                  else commentRefs.current.delete(id);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Composer */}
      <div ref={composerRef} className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs">
            <span className="truncate">
              Replying to <span className="font-semibold">@{replyTo.author?.username ?? "user"}</span>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
            className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || submitting}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
            aria-label="Send"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function countAll(nodes: CommentNode[]): number {
  let n = 0;
  const walk = (arr: CommentNode[]) => {
    arr.forEach((x) => {
      n++;
      if (x.replies.length) walk(x.replies);
    });
  };
  walk(nodes);
  return n;
}

function CommentItem({
  node,
  meId,
  onReply,
  onDelete,
  depth = 0,
  highlightId,
  expanded,
  toggleExpand,
  maxDepth,
  registerRef,
}: {
  node: CommentNode;
  meId?: string;
  onReply: (c: CommentNode) => void;
  onDelete: (c: CommentNode) => void;
  depth?: number;
  highlightId: string | null;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  maxDepth: number;
  registerRef: (id: string, el: HTMLLIElement | null) => void;
}) {
  const isMine = meId && node.user_id === meId;
  const isHighlighted = highlightId === node.id;
  const atCap = depth >= maxDepth;
  const hasReplies = node.replies.length > 0;
  const isExpanded = expanded.has(node.id);
  const showReplies = hasReplies && (!atCap || isExpanded);

  return (
    <motion.li
      ref={(el) => registerRef(node.id, el)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`scroll-mt-24 rounded-2xl transition-colors ${
        isHighlighted ? "ring-2 ring-foreground/40 bg-foreground/5" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <img
          src={node.author?.avatar_url ?? ""}
          alt={node.author?.username ?? "user"}
          className={`${depth === 0 ? "h-8 w-8" : "h-7 w-7"} shrink-0 rounded-full bg-secondary`}
        />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-muted px-3 py-2">
            <p className="text-xs font-semibold">
              @{node.author?.username ?? "user"}
            </p>
            <p className="mt-0.5 break-words text-sm">{node.content}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1 text-[11px] text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
            </span>
            <button
              onClick={() => onReply(node)}
              className="font-semibold hover:text-foreground"
            >
              Reply
            </button>
            {isMine && (
              <button
                onClick={() => onDelete(node)}
                className="flex items-center gap-1 hover:text-destructive"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>
          {hasReplies && atCap && !isExpanded && (
            <button
              onClick={() => toggleExpand(node.id)}
              className="mt-2 text-[11px] font-semibold text-foreground/80 hover:text-foreground"
            >
              View {countDeep(node.replies)} more {countDeep(node.replies) === 1 ? "reply" : "replies"}
            </button>
          )}
          {showReplies && (
            <ul className="mt-3 space-y-3 border-l-2 border-foreground/15 pl-3">
              {node.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  node={r}
                  meId={meId}
                  onReply={onReply}
                  onDelete={onDelete}
                  depth={atCap && isExpanded ? depth : depth + 1}
                  highlightId={highlightId}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                  maxDepth={maxDepth}
                  registerRef={registerRef}
                />
              ))}
              {atCap && isExpanded && (
                <li>
                  <button
                    onClick={() => toggleExpand(node.id)}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Hide replies
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function countDeep(nodes: CommentNode[]): number {
  let n = 0;
  const walk = (arr: CommentNode[]) => arr.forEach((x) => { n++; walk(x.replies); });
  walk(nodes);
  return n;
}
