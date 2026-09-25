import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, MapPin, MessageCircle, User } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { to: "/feed", icon: Home, label: "Home" },
  { to: "/explore", icon: Search, label: "Explore" },
  { to: "/map", icon: MapPin, label: "Nearby" },
  { to: "/messages", icon: MessageCircle, label: "DMs" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-glass-border">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className="relative flex flex-1 flex-col items-center justify-center py-2"
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 h-0.5 w-8 rounded-full bg-foreground"
                />
              )}
              <Icon
                className={`h-6 w-6 transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
                strokeWidth={active ? 2.4 : 1.8}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
