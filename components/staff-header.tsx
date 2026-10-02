import Link from "next/link";
import { logOut } from "@/app/actions/admin";
import { siteConfig } from "@/lib/config";
import { formatLongDate, todayInTimezone } from "@/lib/date";

export function StaffHeader({ active }: { active: "admin" | "checkin" }) {
  return (
    <header className="border-b border-cream-300 bg-white">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-saffron-700 uppercase">
            {siteConfig.centreName}
          </p>
          <p className="text-lg font-bold text-ink-900">{siteConfig.name}</p>
        </div>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/admin" active={active === "admin"}>
            Dashboard
          </NavLink>
          <NavLink href="/checkin" active={active === "checkin"}>
            Check-in
          </NavLink>
          <form action={logOut}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 font-medium text-ink-700 transition hover:bg-cream-100"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-2 font-medium transition ${
        active
          ? "bg-saffron-100 text-saffron-900"
          : "text-ink-700 hover:bg-cream-100"
      }`}
    >
      {children}
    </Link>
  );
}

export function StaffDate() {
  return (
    <p className="text-sm font-medium text-ink-700">
      {formatLongDate(todayInTimezone())}
    </p>
  );
}
