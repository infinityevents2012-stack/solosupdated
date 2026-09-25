# SoloS

A proximity-first social app for discovering and connecting with people nearby. Built as a web app with optional Android APK packaging via Capacitor.

- **Live preview:** https://id-preview--1579382c-c0fe-4045-83f0-047b2b93e442.lovable.app
- **Published web:** https://solo-connect-sphere.lovable.app

## What it does

SoloS lets users:

- Discover people nearby on a **Leaflet map** with a 1–50 km range slider.
- Post and watch **24-hour disappearing Stories**.
- Send **text and image DMs** with real-time delivery, read receipts, and typing indicators.
- Make **voice/video calls** through WebRTC with signaling and TURN fallback.
- Comment on posts with **nested replies**.
- Track profile views and analytics behind a premium gate.
- Unlock **SoloS Gold** subscriptions or earn temporary premium via referrals + rewarded ads.
- Manage privacy, consent receipts, DPDP policy, and block/report users.

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19 + Vite 7) |
| Styling | Tailwind CSS v4, shadcn/ui Radix primitives |
| State | Zustand (client), TanStack Query (server) |
| Backend / Auth / Realtime | Lovable Cloud (Supabase) — Postgres, Auth, Realtime, Storage |
| Map | Leaflet + React-Leaflet |
| Mobile wrapper | Capacitor 8 (Android) |
| Notifications | FCM (ready to wire) |

## Project structure

```
├── src/
│   ├── components/          # AppShell, BottomNav, GoldBadge, LimitReachedModal, IncomingCallListener
│   ├── hooks/               # use-mobile, etc.
│   ├── integrations/        # Auto-generated Supabase clients
│   ├── lib/                 # Business logic (auth, calls, comments, connections, messaging, store, etc.)
│   ├── routes/              # TanStack file routes
│   ├── router.tsx           # Router setup
│   ├── styles.css           # Tailwind v4 theme tokens
│   └── __root.tsx           # Root layout
├── supabase/
│   ├── config.toml          # Supabase local config (auto-generated)
│   └── functions/           # Edge functions (TURN credentials)
├── capacitor.config.ts      # Capacitor Android wrapper config
├── BUILD_APK.md             # Step-by-step APK build instructions
└── README.md                # You are here
```

## Key routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page with Sign in / Create account |
| `/login` | Phone-based auth (OTP flow) |
| `/onboarding` | Username, avatar, location consent, referral code |
| `/feed` | Stories tray + post feed + welcome-back toast |
| `/map` | Nearby people map with distance range slider |
| `/messages` | DM inbox + pending connection requests |
| `/messages/$id` | Conversation thread with swipe-to-reply |
| `/call/$id` | Voice/video call screen with WebRTC |
| `/post/$id` | Post detail with nested comments |
| `/stories/$id` | Story viewer with 24h progress |
| `/profile` | Own profile, Gold upsell, settings links |
| `/insights` | Profile viewers + analytics (premium-only) |
| `/subscribe` | SoloS Gold checkout |
| `/referrals` | Referral tracker + ad unlock |
| `/privacy` | DPDP Act privacy policy |
| `/consent` | Consent receipt viewer |

## Getting started

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Run the dev server**

   ```bash
   bun run dev
   ```

   The app will be available at `http://localhost:8080`.

3. **Build for production**

   ```bash
   bun run build
   ```

## Environment variables

The Supabase client credentials are auto-injected by Lovable Cloud. The project already has:

```bash
SUPABASE_URL=https://jhdpellucppdsqidajto.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

For production integrations you will need to add secrets via the Lovable secrets panel:

- `METERED_TURN_USERNAME`, `METERED_TURN_CREDENTIAL` — TURN relay for calls.
- MSG91 / Twilio credentials — real OTP.
- Stripe / Razorpay keys — real payments.
- AdMob App ID / Unit IDs — rewarded ads.
- FCM server key + `google-services.json` — push notifications.

## Backend schema highlights

- `profiles` — public user profile (username, avatar, is_premium, referral_code, etc.).
- `messages` — DM messages with read receipts, typing status, and `quoted_message_id`.
- `calls` — call records with status, duration, end reason, SDP/ICE signaling.
- `connection_requests` — pending connection requests between users.
- `blocks` — user-level blocks used by messaging RLS.
- `comments` / `posts` — nested comment threads with `parent_id`.
- `referrals` / `ad_unlocks` — referral tracking and daily ad-unlock records.
- `consent_receipts` — DPDP consent audit log.

All public tables use Row Level Security (RLS) with GRANTs to `authenticated` and `service_role`.

## Android APK build

SoloS is wrapped with Capacitor for Android. See [`BUILD_APK.md`](BUILD_APK.md) for the full local build steps.

Quick summary:

```bash
bun install
npx cap add android          # first time only
bun run build
npx cap sync android
npx cap open android         # opens Android Studio
```

Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

> The current `capacitor.config.ts` loads the published web URL for hot-reload-style updates. Before a release APK, remove the `server` block so assets are bundled from `dist/`.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `bun run dev` | Local Vite dev server |
| Build | `bun run build` | Production build |
| Preview | `bun run preview` | Preview production build |
| Lint | `bun run lint` | ESLint |
| Format | `bun run format` | Prettier write |

## Current feature status

Implemented:

- Phone auth with OTP (currently demo OTP `123456` for rapid testing).
- Onboarding, username uniqueness, avatar, location, consent, referral code.
- Feed, stories, posts, likes, nested comments.
- Nearby map with distance slider and daily 10-connection limit.
- Real-time DMs (text + images), read receipts, typing indicators, swipe-to-reply.
- WebRTC voice/video calls with TURN fallback and call history.
- Block/report, pending connection requests.
- SoloS Gold subscription + referral-based temporary premium + simulated rewarded ads.
- Profile insights (premium-gated), DPDP privacy policy, consent receipt.

Still needs real third-party integrations for production:

1. **Real OTP provider** (MSG91 / Twilio).
2. **Real payments** (Stripe / Razorpay) with webhooks for premium entitlement.
3. **Real rewarded ads** (AdMob) with server-side verification.
4. **Push notifications** (FCM) for messages/calls.
5. **TURN credentials** from Metered.ca or a self-hosted coturn server.

## License

Proprietary — SoloS.
