import { Crown } from "lucide-react";

interface Props {
  premium?: boolean | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Inline badge shown next to a username.
 * - Gold crown for SoloS Gold subscribers
 * - Subtle "Free" pill for non-subscribers (only when explicitly shown)
 */
export function GoldBadge({ premium, size = "sm", className = "" }: Props) {
  if (!premium) return null;
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      title="SoloS Gold member"
      aria-label="SoloS Gold member"
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-500 p-[3px] shadow-[0_0_12px_rgba(234,179,8,0.45)] ${className}`}
    >
      <Crown className={`${dim} text-black`} strokeWidth={2.5} />
    </span>
  );
}
