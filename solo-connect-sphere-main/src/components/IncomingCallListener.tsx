import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import { subscribeIncomingCalls, type DBCall } from "@/lib/calls";

/** Listens for inbound calls anywhere in the app and offers Accept/Decline. */
export function IncomingCallListener() {
  const uid = useAuth((s) => s.profile?.uid);
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) return;
    const cleanup = subscribeIncomingCalls(uid, (call: DBCall) => {
      if (call.status !== "ringing") return;
      toast(`Incoming ${call.mode} call`, {
        duration: 25000,
        action: {
          label: "Answer",
          onClick: () =>
            navigate({
              to: "/call/$id",
              params: { id: call.id },
              search: { mode: call.mode, role: "callee" },
            }),
        },
        cancel: { label: "Dismiss", onClick: () => undefined },
      });
    });
    return () => {
      cleanup();
    };
  }, [uid, navigate]);

  return null;
}
