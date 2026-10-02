import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { AdminGate } from "@/components/admin-gate";
import { ManualAttendance } from "@/components/manual-attendance";
import { StaffDate, StaffHeader } from "@/components/staff-header";
import { formatClock, formatShortDate, todayInTimezone } from "@/lib/date";
import { GENDERS, type PeopleSort } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]));

function isSort(value: string | undefined): value is PeopleSort {
  return value === "name" || value === "recent" || value === "visits";
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  if (!(await isAdmin())) {
    return <AdminGate next="/admin" />;
  }

  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const sort: PeopleSort = isSort(typeof sp.sort === "string" ? sp.sort : undefined)
    ? (sp.sort as PeopleSort)
    : "name";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const today = todayInTimezone();
  const store = getStore();

  const [stats, listing, roster, searchResults] = await Promise.all([
    store.getStats(today),
    query ? Promise.resolve(null) : store.listPeople({ sort, limit: PAGE_SIZE, offset }),
    store.getRoster(today),
    query ? store.searchPeople(query) : Promise.resolve(null),
  ]);

  const people = searchResults ?? listing?.people ?? [];
  const total = searchResults ? searchResults.length : (listing?.total ?? 0);
  const lastPage = searchResults ? 1 : Math.max(1, Math.ceil((listing?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <StaffHeader active="admin" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
          <StaffDate />
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Present today" value={stats.todayCount} highlight />
          <Stat label="Total people" value={stats.totalPeople} />
          <Stat label="New this week" value={stats.newThisWeek} />
        </dl>

        <div className="mt-6">
          <ManualAttendance />
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-ink-900">
            Today&apos;s attendance ({roster.length})
          </h2>
          {roster.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-cream-300 bg-white/60 px-4 py-6 text-center text-sm text-ink-700">
              Nobody has been marked present yet today.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-cream-200 overflow-hidden rounded-xl border border-cream-300 bg-white">
              {roster.map((entry) => (
                <li key={entry.phoneKey} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="truncate font-medium text-ink-900">{entry.name}</span>
                  <span className="shrink-0 text-xs text-ink-500">
                    {formatClock(entry.atMs)} · {methodLabel(entry.method)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink-900">
              {query ? `Search results for “${query}”` : "All people"}
            </h2>
            <form method="get" action="/admin" className="flex flex-wrap items-center gap-2">
              {sort !== "name" && <input type="hidden" name="sort" value={sort} />}
              <input
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Name or phone number"
                aria-label="Search by name or phone number"
                className="w-52 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-saffron-500 focus:ring-2 focus:ring-saffron-200"
              />
              <button
                type="submit"
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-cream-50"
              >
                Search
              </button>
              {query && (
                <Link
                  href={`/admin${sort !== "name" ? `?sort=${sort}` : ""}`}
                  className="text-sm font-medium text-saffron-700 hover:underline"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          {!query && (
            <nav className="mt-3 flex gap-1 text-sm" aria-label="Sort people">
              {(["name", "recent", "visits"] as const).map((option) => (
                <Link
                  key={option}
                  href={`/admin?sort=${option}`}
                  aria-current={sort === option ? "true" : undefined}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    sort === option
                      ? "bg-saffron-100 text-saffron-900"
                      : "text-ink-700 hover:bg-cream-100"
                  }`}
                >
                  {option === "name" ? "A–Z" : option === "recent" ? "Newest" : "Most visits"}
                </Link>
              ))}
            </nav>
          )}

          {people.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-cream-300 bg-white/60 px-4 py-6 text-center text-sm text-ink-700">
              {query
                ? "No match. Search matches the start of a name, or a full phone number."
                : "No records yet."}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-cream-300 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-cream-200 text-xs tracking-wide text-ink-500 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Phone</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Gender</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Visits</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {people.map((person) => (
                    <tr key={person.phoneKey} className="hover:bg-cream-50">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-ink-900">{person.name}</span>
                        {person.selfReportedReturning && (
                          <span
                            title="Said they had attended before, but this was a new record"
                            className="ml-2 cursor-help rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                          >
                            check
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-700">{person.phone}</td>
                      <td className="px-4 py-2.5 text-ink-700">
                        {GENDER_LABEL[person.gender] ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-ink-900">
                        {person.totalVisits}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-700">
                        {formatShortDate(person.lastVisitDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!query && lastPage > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? (
                <Link href={pageHref(page - 1, sort)} className="font-medium text-saffron-700 hover:underline">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-500">
                Page {page} of {lastPage} · {total} people
              </span>
              {page < lastPage ? (
                <Link href={pageHref(page + 1, sort)} className="font-medium text-saffron-700 hover:underline">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </main>
    </>
  );
}

function pageHref(page: number, sort: PeopleSort): string {
  return `/admin?page=${page}${sort !== "name" ? `&sort=${sort}` : ""}`;
}

function methodLabel(method: string): string {
  if (method === "register") return "at welcome desk";
  if (method === "manual") return "entered by hand";
  return "scanned";
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-saffron-300 bg-saffron-50"
          : "border-cream-300 bg-white"
      }`}
    >
      <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="mt-1 text-3xl font-bold text-ink-900">{value}</dd>
    </div>
  );
}
