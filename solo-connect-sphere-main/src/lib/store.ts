import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  phone: string;
  username: string;
  avatar: string;
  consentAccepted: boolean;
  isOver18: boolean;
  isPremium: boolean;
  dailyConnections: number;
  bonusConnections: number;
  lastConnectionDate: string;
  /** Supabase auth user id (set after onboarding) */
  uid?: string;
}

/** Transient state for an in-flight manual WhatsApp OTP verification.
 *  This is NOT an authentication signal — it only tracks what's needed to
 *  render the OTP screen and call the phone-otp Edge Function. Nothing here
 *  grants access to anything; only a successful server-side "verify" call
 *  (see src/lib/phone-otp.ts) can do that. */
export interface PendingVerification {
  verificationId: string;
  phone: string;
  whatsappUrl: string;
  expiresAt: string;
  resendCooldownSeconds: number;
  requestedAt: number;
}

interface AuthState {
  isAuthenticated: boolean;
  profile: UserProfile | null;
  pendingVerification: PendingVerification | null;
  setPhone: (phone: string) => void;
  setPendingVerification: (v: PendingVerification | null) => void;
  completeOnboarding: (data: Partial<UserProfile>) => void;
  logout: () => void;
  useConnection: () => boolean;
  addBonusConnections: (n: number) => void;
  setPremium: (v: boolean) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      profile: null,
      pendingVerification: null,
      setPhone: (phone) =>
        set({
          profile: {
            phone,
            username: "",
            avatar: "",
            consentAccepted: false,
            isOver18: false,
            isPremium: false,
            dailyConnections: 0,
            bonusConnections: 0,
            lastConnectionDate: today(),
          },
        }),
      setPendingVerification: (v) => set({ pendingVerification: v }),
      completeOnboarding: (data) => {
        const cur = get().profile;
        if (!cur) return;
        set({
          isAuthenticated: true,
          profile: { ...cur, ...data },
        });
      },
      logout: () => set({ isAuthenticated: false, profile: null, pendingVerification: null }),
      useConnection: () => {
        const p = get().profile;
        if (!p) return false;
        if (p.isPremium) return true;
        const t = today();
        const daily = p.lastConnectionDate === t ? p.dailyConnections : 0;
        const bonus = p.bonusConnections;
        if (daily < 10) {
          set({
            profile: {
              ...p,
              dailyConnections: daily + 1,
              lastConnectionDate: t,
            },
          });
          return true;
        }
        if (bonus > 0) {
          set({ profile: { ...p, bonusConnections: bonus - 1 } });
          return true;
        }
        return false;
      },
      addBonusConnections: (n) => {
        const p = get().profile;
        if (!p) return;
        set({ profile: { ...p, bonusConnections: p.bonusConnections + n } });
      },
      setPremium: (v) => {
        const p = get().profile;
        if (!p) return;
        set({ profile: { ...p, isPremium: v } });
      },
    }),
    { name: "solos-auth" }
  )
);
