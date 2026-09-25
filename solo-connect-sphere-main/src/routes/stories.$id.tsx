import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Heart, MoreHorizontal } from "lucide-react";
import { stories } from "@/lib/mock-data";
import { useAuth } from "@/lib/store";

export const Route = createFileRoute("/stories/$id")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: StoryViewer,
});

const SEGMENT_MS = 5000;

function StoryViewer() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);

  const visible = stories.filter(
    (s) => s.id !== "you" && s.media && s.media.length > 0
  );
  const startIdx = Math.max(
    0,
    visible.findIndex((s) => s.id === id)
  );
  const [storyIdx, setStoryIdx] = useState(startIdx);
  const [segIdx, setSegIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef<number>(Date.now());
  const elapsedRef = useRef(0);

  const story = visible[storyIdx];
  const segments = story?.media ?? [];

  useEffect(() => {
    setSegIdx(0);
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = Date.now();
  }, [storyIdx]);

  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = Date.now();
  }, [segIdx]);

  useEffect(() => {
    if (paused) {
      elapsedRef.current += Date.now() - startRef.current;
      return;
    }
    startRef.current = Date.now();
    let raf: number;
    const tick = () => {
      const e = elapsedRef.current + (Date.now() - startRef.current);
      const p = Math.min(1, e / SEGMENT_MS);
      setProgress(p);
      if (p >= 1) {
        advance();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, segIdx, storyIdx]);

  const advance = () => {
    if (segIdx + 1 < segments.length) {
      setSegIdx(segIdx + 1);
    } else if (storyIdx + 1 < visible.length) {
      setStoryIdx(storyIdx + 1);
    } else {
      navigate({ to: "/feed" });
    }
  };

  const back = () => {
    if (segIdx > 0) {
      setSegIdx(segIdx - 1);
    } else if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
    }
  };

  if (!story) return null;
  const expiresIn = Math.max(0, 24 - (story.postedAgo ?? 0));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div className="relative mx-auto h-full w-full max-w-md overflow-hidden">
        {/* Media */}
        <AnimatePresence mode="wait">
          <motion.img
            key={`${story.id}-${segIdx}`}
            src={segments[segIdx]}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>

        {/* Top gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        {/* Bottom gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Progress bars */}
        <div className="absolute left-2 right-2 top-2 flex gap-1">
          {segments.map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                className="h-full bg-white"
                style={{
                  width:
                    i < segIdx
                      ? "100%"
                      : i === segIdx
                        ? `${progress * 100}%`
                        : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-0 right-0 top-6 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img
              src={story.avatar}
              alt={story.user}
              className="h-9 w-9 rounded-full bg-secondary"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">{story.user}</p>
              <p className="text-[11px] text-white/70">
                {story.postedAgo}h ago · expires in {expiresIn}h
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-white/90">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <button onClick={() => navigate({ to: "/feed" })} className="text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tap zones */}
        <button
          onClick={back}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute bottom-20 left-0 top-16 w-1/3"
          aria-label="Previous"
        />
        <button
          onClick={advance}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute bottom-20 right-0 top-16 w-2/3"
          aria-label="Next"
        />

        {/* Reply bar */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 px-4 pb-6">
          <div className="flex flex-1 items-center rounded-full border border-white/30 bg-white/5 px-4 py-2.5 backdrop-blur">
            <input
              placeholder={`Reply to ${story.user}…`}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none"
            />
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-full text-white">
            <Heart className="h-6 w-6" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-full text-white">
            <Send className="h-6 w-6" />
          </button>
        </div>

        {profile && (
          <div className="pointer-events-none absolute bottom-24 left-4 text-[10px] text-white/40">
            viewing as @{profile.username}
          </div>
        )}
      </div>
    </div>
  );
}
