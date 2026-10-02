import type { Metadata } from "next";
import { EmergencyNote } from "@/components/EmergencyNote";
import { PageHeader } from "@/components/nav/PageHeader";

export const metadata: Metadata = { title: "Safety & privacy" };

// Plain-language guidelines. Not legal advice: have counsel review before launch.
export default function LegalPage() {
  return (
    <main className="min-h-dvh pb-safe">
      <PageHeader title="Safety & privacy" back="/profile" />
      <article className="mx-auto max-w-lg space-y-8 px-5 pb-12 pt-5 text-[15px] leading-relaxed text-text/90">
        <EmergencyNote />

        <section id="safety" className="scroll-mt-20 space-y-3">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">Community guidelines</h2>
          <p>Haven helps neighbors share what&apos;s happening nearby. It is not an emergency service and doesn&apos;t notify police, fire or medical responders.</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Report only what you have seen or heard yourself, from a safe place.</li>
            <li>Never approach, follow, film or confront anyone to get information.</li>
            <li>Describe events, not people. Don&apos;t post names, faces, plates, addresses or contact details.</li>
            <li>Don&apos;t describe people by race or ethnicity. &quot;Suspicious&quot; means behavior, never appearance.</li>
            <li>No threats, harassment or false reports. Reports flagged by several people are hidden for review.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">How information is labeled</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><b>Community · unverified</b>: one person reported it and nobody has confirmed it yet.</li>
            <li><b>Community · confirmed</b>: other people nearby confirmed it.</li>
            <li><b>Official feed</b>: from a public agency feed, with attribution on the incident.</li>
            <li><b>Demo</b>: fictional examples for testing. They do not describe real events.</li>
          </ul>
        </section>

        <section id="privacy" className="scroll-mt-20 space-y-3">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">Privacy</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your identity is never shown on reports. Others see &quot;someone nearby&quot;.</li>
            <li>Your exact position never leaves your device. Everything below is rounded on your phone first.</li>
            <li>To load what&apos;s nearby, your phone sends a position rounded to about a block (about 100 m). Haven uses it to answer and does not save it to your account. Like any website, the hosting provider keeps short-lived request logs.</li>
            <li>If you turn on &quot;alerts near me&quot;, Haven keeps one rougher point (rounded to about 1 km, so within about half a mile of you) from the last time the app was open. It is deleted when you turn that setting off, turn alerts off, or block location in your browser.</li>
            <li>Report locations and saved places are rounded to about a block before they are stored. Saved places are private and only used to match alerts.</li>
            <li>Address search, and the street name shown for a report, are looked up through OpenStreetMap&apos;s geocoder using the search text or the rounded point. Map images load from the map provider (OpenFreeMap or OpenStreetMap, and MapTiler for satellite view), which can see which part of the map you are viewing but not who you are in Haven.</li>
            <li>Phone numbers, emails, links and similar details are removed from text automatically.</li>
            <li>Payments are handled by Stripe. Haven never sees your card number.</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
