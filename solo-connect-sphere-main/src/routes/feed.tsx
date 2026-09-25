import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, Bookmark, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { posts as initialPosts, stories, type Post } from "@/lib/mock-data";
import { useAuth } from "@/lib/store";

export const Route = createFileRoute("/feed")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: Feed,
});

function Feed() {
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  useEffect(() => {
    try {
      const w = sessionStorage.getItem("solos-welcome-back");
      if (w) {
        sessionStorage.removeItem("solos-welcome-back");
        const name = profile?.username ? `@${profile.username}` : w;
        toast.success(`Welcome back, ${name} 👋`);
      }
    } catch {}
  }, [profile?.username]);

  const toggleLike = (id: string) => {
    setPosts((p) =>
      p.map((x) =>
        x.id === id
          ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }
          : x
      )
    );
  };

  return (
    <AppShell>
      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong">
        <div className="flex items-center justify-between px-5 py-3">
          <h1 className="font-display text-2xl tracking-tight">SoloS</h1>
          <div className="flex items-center gap-3">
            <button className="flex h-9 w-9 items-center justify-center rounded-full glass">
              <Heart className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full glass">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stories tray */}
        <div className="scrollbar-hide flex gap-4 overflow-x-auto px-5 pb-4">
          {stories.map((s, i) => (
            <button
              key={s.id}
              onClick={() =>
                s.id !== "you" && navigate({ to: "/stories/$id", params: { id: s.id } })
              }
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className={`relative rounded-full p-[2px] ${
                  s.id === "you"
                    ? "bg-white/15"
                    : s.seen
                      ? "bg-white/15"
                      : "story-ring"
                }`}
              >
                <div className="rounded-full bg-background p-[2px]">
                  <img
                    src={i === 0 ? profile?.avatar || s.avatar : s.avatar}
                    alt={s.user}
                    className="h-14 w-14 rounded-full bg-secondary object-cover"
                  />
                </div>
                {s.id === "you" && (
                  <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background">
                    <Plus className="h-3 w-3" strokeWidth={3} />
                  </div>
                )}
              </div>
              <span className="max-w-[64px] truncate text-[11px] text-muted-foreground">
                {s.id === "you" ? "Your story" : s.user}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Feed */}
      <div className="space-y-8 pt-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onLike={() => toggleLike(p.id)} />
        ))}
        <p className="pb-4 text-center text-xs text-muted-foreground">
          You're all caught up ✨
        </p>
      </div>
    </AppShell>
  );
}

function PostCard({ post, onLike }: { post: Post; onLike: () => void }) {
  const navigate = useNavigate();
  const [burst, setBurst] = useState(0);
  const lastTap = useState({ t: 0 })[0];

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.t < 280) {
      if (!post.liked) onLike();
      setBurst((b) => b + 1);
    }
    lastTap.t = now;
  };

  return (
    <article>
      <header className="flex items-center justify-between px-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="story-ring rounded-full p-[1.5px]">
            <img
              src={post.avatar}
              alt={post.user}
              className="h-9 w-9 rounded-full bg-secondary"
            />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{post.user}</p>
            {post.location && (
              <p className="text-[11px] text-muted-foreground">
                {post.location}
              </p>
            )}
          </div>
        </div>
        <button className="text-xl text-muted-foreground">⋯</button>
      </header>

      <div
        className="relative aspect-[4/5] w-full overflow-hidden bg-secondary"
        onClick={handleTap}
      >
        <img
          src={post.image}
          alt={post.caption}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <AnimatePresence>
          {burst > 0 && (
            <motion.div
              key={burst}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 0.8 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <Heart className="h-28 w-28 fill-white text-white drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-5 pt-3">
        <div className="flex items-center gap-4">
          <motion.button whileTap={{ scale: 0.85 }} onClick={onLike}>
            <Heart
              className={`h-7 w-7 transition-colors ${
                post.liked ? "fill-destructive text-destructive" : ""
              }`}
            />
          </motion.button>
          <button
            onClick={() => navigate({ to: "/post/$id", params: { id: post.id } })}
            aria-label="Comments"
          >
            <MessageCircle className="h-7 w-7" />
          </button>
          <button>
            <Send className="h-7 w-7" />
          </button>
        </div>
        <button>
          <Bookmark className="h-7 w-7" />
        </button>
      </div>

      <div className="px-5 pt-2">
        <p className="text-sm font-semibold">
          {post.likes.toLocaleString()} likes
        </p>
        <p className="mt-1 text-sm">
          <span className="font-semibold">{post.user}</span>{" "}
          <span className="text-foreground/90">{post.caption}</span>
        </p>
        <p className="mt-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          {post.time}
        </p>
      </div>
    </article>
  );
}
