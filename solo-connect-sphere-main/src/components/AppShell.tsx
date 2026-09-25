import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { useSessionGuard } from "@/lib/use-session-guard";

export function AppShell({ children }: { children: ReactNode }) {
  // Keeps local "logged in" state honest against the real Supabase session.
  useSessionGuard();
  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
