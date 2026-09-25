import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SoloS" },
      {
        name: "description",
        content:
          "How SoloS collects, processes and protects your personal data under India's Digital Personal Data Protection Act, 2023.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  const navigate = useNavigate();
  const updated = "29 April 2026";

  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-16">
      <header className="sticky top-0 z-40 glass-strong">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg">Privacy Policy</h1>
        </div>
      </header>

      <article className="space-y-6 px-5 pt-5 text-sm leading-relaxed text-foreground/85">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-foreground">
            <Shield className="h-4 w-4 text-gold" />
            <p className="font-semibold">DPDP Act, 2023 compliant</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Last updated: {updated} · Governed by the laws of India
          </p>
        </div>

        <Section title="1. Who we are">
          <p>
            SoloS ("we", "us", "our") is a proximity-first social product
            operated in India. For the purposes of the Digital Personal Data
            Protection Act, 2023 ("DPDP Act"), SoloS is the{" "}
            <em>Data Fiduciary</em> and you, the user, are the{" "}
            <em>Data Principal</em>.
          </p>
        </Section>

        <Section title="2. Data we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Identity:</b> mobile number (for OTP login), username, profile
              picture, date of birth (for 18+ verification).
            </li>
            <li>
              <b>Location:</b> approximate GPS coordinates, used only while the
              app is in use, to power the Nearby map and connection radius.
            </li>
            <li>
              <b>Content:</b> posts, stories, direct messages, voice/video call
              metadata (not call content).
            </li>
            <li>
              <b>Device:</b> device model, OS version, IP address, app version,
              crash logs.
            </li>
            <li>
              <b>Payment:</b> for SoloS Gold, transaction reference is stored.
              Card details are never stored on our servers — they are handled by
              our PCI-DSS certified payment processor.
            </li>
          </ul>
        </Section>

        <Section title="3. Why we use it (purpose)">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To provide the SoloS service: feed, stories, DMs, calls, map.</li>
            <li>To enforce daily connection limits and detect abuse.</li>
            <li>To process subscription payments and prevent fraud.</li>
            <li>To comply with Indian legal obligations (IT Act, DPDP Act).</li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            We do <b>not</b> sell your personal data to advertisers.
          </p>
        </Section>

        <Section title="4. Legal basis for processing">
          <p>
            We process your personal data on the basis of your{" "}
            <b>free, specific, informed and unambiguous consent</b> obtained
            during onboarding (Section 6, DPDP Act), or where processing is
            necessary for certain legitimate uses such as compliance with law,
            response to a medical emergency, or fulfilling a contract you
            entered into with us.
          </p>
        </Section>

        <Section title="5. Your rights as a Data Principal">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Right to access a summary of personal data processed.</li>
            <li>Right to correction, completion and updating.</li>
            <li>Right to erasure of personal data.</li>
            <li>Right to grievance redressal.</li>
            <li>Right to nominate another individual to exercise your rights.</li>
            <li>Right to withdraw consent at any time.</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, email{" "}
            <a className="underline" href="mailto:privacy@solos.app">
              privacy@solos.app
            </a>
            . We respond within the statutory 30-day timeline.
          </p>
        </Section>

        <Section title="6. Data retention">
          <p>
            Account data is retained while your account is active and for up to
            180 days after deletion to comply with applicable Indian law. Backup
            copies are purged within 12 months.
          </p>
        </Section>

        <Section title="7. Children & 18+ only service">
          <p>
            SoloS is intended for users <b>18 years and older</b>. We do not
            knowingly process personal data of children. Age is verified at
            onboarding. If we learn we have collected data from a person under
            18, we will delete it without delay.
          </p>
        </Section>

        <Section title="8. Sharing & cross-border transfer">
          <p>
            We share data only with vetted processors (cloud hosting, payment,
            SMS OTP, analytics) under written contracts. Cross-border transfer
            is limited to jurisdictions not restricted by the Government of
            India.
          </p>
        </Section>

        <Section title="9. Security">
          <p>
            We use TLS in transit, encryption at rest, role-based access
            control, and routine vulnerability scanning. No system is perfectly
            secure — please use a strong unique password and keep your device
            up to date.
          </p>
        </Section>

        <Section title="10. Grievance Officer (India)">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="font-semibold">Ms. Aanya Sharma</p>
            <p className="text-xs text-muted-foreground">Grievance Officer, SoloS</p>
            <p className="mt-2 text-xs">
              Email:{" "}
              <a className="underline" href="mailto:grievance@solos.app">
                grievance@solos.app
              </a>
            </p>
            <p className="text-xs">Response SLA: 72 hours · Resolution: 30 days</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            You may also lodge a complaint with the Data Protection Board of
            India if your concern is not resolved.
          </p>
        </Section>

        <Section title="11. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will
            be notified in-app at least 7 days before they take effect.
          </p>
        </Section>

        <p className="pt-4 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} SoloS · Made in India
        </p>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-base">{title}</h2>
      <div className="text-sm text-foreground/85">{children}</div>
    </section>
  );
}
