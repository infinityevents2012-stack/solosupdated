import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Map as MapIcon, Navigation, Sparkles, Users } from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { nearbyUsers } from "@/lib/mock-data";
import { useAuth } from "@/lib/store";
import { LimitReachedModal } from "@/components/LimitReachedModal";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { consumeDailyConnection } from "@/lib/server-limits";

export const Route = createFileRoute("/map")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("solos-auth");
      if (!raw || !JSON.parse(raw)?.state?.isAuthenticated) {
        throw redirect({ to: "/" });
      }
    }
  },
  component: MapPage,
});

const CENTER: [number, number] = [19.076, 72.8777]; // Mumbai

function MapPage() {
  const [range, setRange] = useState(15);
  const [selected, setSelected] = useState<string | null>(null);
  const [showLimit, setShowLimit] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { profile, useConnection } = useAuth();

  useEffect(() => setMounted(true), []);

  const visible = useMemo(
    () => nearbyUsers.filter((u) => u.distance <= range),
    [range]
  );

  const remaining = profile?.isPremium
    ? Infinity
    : Math.max(0, 10 - (profile?.dailyConnections ?? 0)) +
      (profile?.bonusConnections ?? 0);

  // Track which users have been "requested"
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const handleConnect = useCallback(async (username: string) => {
    if (pending) return;
    if (requested.has(username)) {
      // Cancel
      setRequested((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
      toast("Connection request cancelled");
      return;
    }

    setPending(true);
    try {
      // Server-side enforcement first
      if (profile?.uid) {
        const result = await consumeDailyConnection(profile.uid);
        if (!result.ok) {
          if (result.reason === "limit_reached") {
            setShowLimit(true);
            return;
          }
          toast.error("Couldn't send request. Please try again.");
          return;
        }
      }
      // Mirror locally for the existing UI counter
      useConnection();
      setRequested((prev) => new Set(prev).add(username));
      toast.success(`Connection request sent to @${username}`);
      setSelected(null);
    } finally {
      setPending(false);
    }
  }, [requested, useConnection, profile?.uid, pending]);

  return (
    <AppShell>
      <header className="sticky top-0 z-40 glass-strong px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            <h1 className="font-display text-xl">Nearby</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium">{visible.length}</span>
            <span className="text-muted-foreground">within {range}km</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Navigation className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[range]}
            min={1}
            max={50}
            step={1}
            onValueChange={(v) => setRange(v[0])}
            className="flex-1"
          />
          <span className="w-12 text-right text-sm tabular-nums">{range}km</span>
        </div>

        {!profile?.isPremium && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {remaining} connection{remaining === 1 ? "" : "s"} left today
            </span>
            <span className="flex items-center gap-1 text-gold">
              <Sparkles className="h-3 w-3" /> Go Gold
            </span>
          </div>
        )}
      </header>

      <div className="relative h-[58vh] w-full overflow-hidden">
        {mounted && <LeafletMap range={range} onSelect={setSelected} />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <section className="px-5 pt-2 pb-6">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          People nearby
        </h2>
        <div className="space-y-2">
          {visible.slice(0, 12).map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-card/40 p-3"
            >
              <img src={u.avatar} alt={u.username} className="h-11 w-11 rounded-full bg-secondary" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">@{u.username}</p>
                <p className="text-xs text-muted-foreground">{u.distance} km away</p>
              </div>
              <button
                onClick={() => handleConnect(u.username)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                  requested.has(u.username)
                    ? "bg-white/10 text-muted-foreground"
                    : "bg-foreground text-background"
                }`}
              >
                {requested.has(u.username) ? "Cancel" : "Connect"}
              </button>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No one in this radius. Try widening it.
            </p>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          >
            {(() => {
              const u = nearbyUsers.find((x) => x.id === selected);
              if (!u) return null;
              return (
                <motion.div
                  initial={{ y: 200 }}
                  animate={{ y: 0 }}
                  exit={{ y: 200 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-card p-6"
                >
                  <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
                  <div className="flex items-center gap-4">
                    <img src={u.avatar} alt={u.username} className="h-16 w-16 rounded-full bg-secondary" />
                    <div>
                      <p className="font-display text-xl">@{u.username}</p>
                      <p className="text-sm text-muted-foreground">{u.distance} km away</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleConnect(u.username)}
                    className={`mt-5 w-full rounded-2xl py-3.5 font-semibold ${
                      requested.has(u.username)
                        ? "bg-white/10 text-muted-foreground"
                        : "bg-foreground text-background"
                    }`}
                  >
                    {requested.has(u.username) ? "Cancel request" : "Send connection request"}
                  </button>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <LimitReachedModal open={showLimit} onClose={() => setShowLimit(false)} />
    </AppShell>
  );
}

function LeafletMap({
  range,
  onSelect,
}: {
  range: number;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;

      const map = L.map(ref.current, {
        center: CENTER,
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      L.marker(CENTER, {
        icon: L.divIcon({
          className: "",
          html: `<div style="position:relative;width:18px;height:18px;">
            <div style="position:absolute;inset:0;border-radius:9999px;background:white;border:3px solid black;box-shadow:0 0 0 2px white;"></div>
            <div style="position:absolute;inset:-12px;border-radius:9999px;background:white;opacity:.25;animation:pulse 2s infinite;"></div>
          </div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // update markers + circle when range changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      if (layerRef.current) {
        mapRef.current.removeLayer(layerRef.current);
      }
      const group = L.layerGroup();
      L.circle(CENTER, {
        radius: range * 1000,
        color: "#ffffff",
        weight: 1,
        opacity: 0.4,
        fillColor: "#ffffff",
        fillOpacity: 0.04,
      }).addTo(group);

      nearbyUsers
        .filter((u) => u.distance <= range)
        .forEach((u) => {
          const marker = L.marker([u.lat, u.lng], {
            icon: L.divIcon({
              className: "",
              html: `<div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9999px;background:#000;border:2px solid #fff;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.5);">
                <img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;" />
              </div>`,
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            }),
          });
          marker.on("click", () => onSelect(u.id));
          marker.addTo(group);
        });

      group.addTo(mapRef.current);
      layerRef.current = group;
    })();
    return () => {
      cancelled = true;
    };
  }, [range, onSelect]);

  return (
    <>
      <div ref={ref} className="absolute inset-0" style={{ background: "#000" }} />
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: .35; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .leaflet-container { background: #000 !important; font-family: inherit; }
      `}</style>
    </>
  );
}
