import { create } from "zustand";

/**
 * Transient (non-persisted) state for the in-flight phone verification.
 * Deliberately NOT stored in localStorage/persisted zustand: none of this
 * data is an authentication credential (the verificationId is meaningless
 * without the correct OTP, which only the WhatsApp message carries), but
 * keeping it in memory only means a closed tab cleanly drops any in-flight
 * verification instead of leaving stale state around.
 */
interface OtpFlowState {
  phone: string | null;
  verificationId: string | null;
  whatsappUrl: string | null;
  expiresAt: string | null;
  resendCooldownSeconds: number;
  requestedAt: number | null;
  start: (data: {
    phone: string;
    verificationId: string;
    whatsappUrl: string;
    expiresAt: string;
    resendCooldownSeconds: number;
  }) => void;
  clear: () => void;
}

export const useOtpFlow = create<OtpFlowState>((set) => ({
  phone: null,
  verificationId: null,
  whatsappUrl: null,
  expiresAt: null,
  resendCooldownSeconds: 60,
  requestedAt: null,
  start: (data) => set({ ...data, requestedAt: Date.now() }),
  clear: () =>
    set({
      phone: null,
      verificationId: null,
      whatsappUrl: null,
      expiresAt: null,
      requestedAt: null,
    }),
}));
