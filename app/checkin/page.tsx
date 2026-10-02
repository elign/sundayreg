import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { AdminGate } from "@/components/admin-gate";
import { QrScanner } from "@/components/qr-scanner";
import { StaffDate, StaffHeader } from "@/components/staff-header";
import { todayInTimezone } from "@/lib/date";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Check-in station",
  robots: { index: false, follow: false },
};

export default async function CheckinPage() {
  if (!(await isAdmin())) {
    return <AdminGate next="/checkin" />;
  }

  const today = todayInTimezone();
  const [stats, roster] = await Promise.all([
    getStore().getStats(today),
    getStore().getRoster(today),
  ]);

  return (
    <>
      <StaffHeader active="checkin" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Check-in station</h1>
            <p className="mt-1 text-sm text-ink-700">
              Point the camera at a visitor&apos;s pass QR code.
            </p>
          </div>
          <div className="text-right">
            <StaffDate />
            <p className="text-3xl font-bold text-saffron-700">{stats.todayCount}</p>
            <p className="text-xs text-ink-500">present today</p>
          </div>
        </div>

        <div className="mt-6">
          <QrScanner />
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-bold text-ink-900">
            Latest arrivals ({roster.length})
          </h2>
          {roster.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-cream-300 bg-white/60 px-4 py-5 text-center text-sm text-ink-700">
              No arrivals yet today.
            </p>
          ) : (
            <ul className="mt-2 max-h-64 divide-y divide-cream-200 overflow-y-auto rounded-xl border border-cream-300 bg-white text-sm">
              {roster.slice(0, 25).map((entry) => (
                <li
                  key={entry.phoneKey}
                  className="flex items-center justify-between gap-3 px-4 py-2"
                >
                  <span className="truncate font-medium text-ink-900">{entry.name}</span>
                  <span className="shrink-0 text-xs text-ink-500">
                    {entry.method === "register"
                      ? "welcome desk"
                      : entry.method === "manual"
                        ? "by hand"
                        : "scanned"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-ink-500">
          {siteConfig.centreName} · {siteConfig.programmeTime}
        </p>
      </main>
    </>
  );
}
