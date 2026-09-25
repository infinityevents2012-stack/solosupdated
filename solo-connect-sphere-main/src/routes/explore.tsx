import { createFileRoute, redirect } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { explorePosts } from "@/lib/mock-data";

export const Route = createFileRoute("/explore")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: Explore,
});

function Explore() {
  return (
    <AppShell>
      <header className="sticky top-0 z-40 glass-strong px-5 py-3">
        <div className="flex items-center gap-3 rounded-full glass px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search people, places, tags"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-0.5 pt-1">
        {explorePosts.map((p, i) => (
          <div
            key={p.id}
            className={`relative overflow-hidden bg-secondary ${
              i % 7 === 3 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"
            }`}
          >
            <img
              src={p.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
