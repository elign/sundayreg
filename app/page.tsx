import Link from "next/link";
import { RegistrationForm } from "@/components/registration-form";
import { siteConfig } from "@/lib/config";
import { formatLongDate, todayInTimezone } from "@/lib/date";

// The page shows today's date, so it must be rendered per request. Without
// this it is prerendered at build time and the date goes stale.
export const dynamic = "force-dynamic";

export default function Home() {
  const today = formatLongDate(todayInTimezone());

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
        <header className="text-center">
          <p className="text-sm font-semibold tracking-widest text-saffron-700 uppercase">
            {siteConfig.centreName}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            {siteConfig.name}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-ink-700">
            Register once, keep your pass on your phone, and show it at the door
            every Sunday.
          </p>
          <p className="mt-3 text-sm font-medium text-saffron-800">
            {siteConfig.programmeTime} · {today}
          </p>
        </header>

        <div className="mt-10">
          <RegistrationForm />
        </div>

        <section className="mt-8 rounded-xl border border-cream-300 bg-white/70 p-5">
          <h2 className="text-sm font-bold text-ink-900">Already have a pass?</h2>
          <p className="mt-1.5 text-sm text-ink-700">
            If you have attended before, just enter the same name and contact
            number. We will find your existing pass and mark your attendance
            for today — no need to register again.
          </p>
        </section>

        <p className="mt-8 text-center text-sm text-ink-700">
          {siteConfig.supportNote}
        </p>
      </div>

      <footer className="border-t border-cream-300 py-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 text-center text-xs text-ink-500 sm:flex-row sm:justify-between">
          <p>{siteConfig.centreAddress}</p>
          <Link href="/checkin" className="font-medium text-saffron-700 hover:underline">
            Volunteer check-in
          </Link>
        </div>
      </footer>
    </main>
  );
}
