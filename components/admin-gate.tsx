"use client";

import { useActionState } from "react";
import { unlockAdmin } from "@/app/actions/admin";
import { siteConfig } from "@/lib/config";

export function AdminGate({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(unlockAdmin, {
    status: "idle",
  });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-cream-300 bg-white p-7 shadow-sm"
      >
        <h1 className="text-xl font-bold text-ink-900">Staff sign in</h1>
        <p className="mt-1 text-sm text-ink-700">
          {siteConfig.centreName} volunteer access.
        </p>

        <input type="hidden" name="next" value={next} />

        <label htmlFor="password" className="mt-6 block text-sm font-semibold text-ink-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-cream-300 px-3.5 py-2.5 text-base shadow-sm outline-none focus:border-saffron-500 focus:ring-2 focus:ring-saffron-200"
        />

        {state.status === "error" && (
          <p
            role="alert"
            aria-live="polite"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-lg bg-saffron-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-saffron-700 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
