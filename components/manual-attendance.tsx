"use client";

import { useActionState } from "react";
import { markAttendanceManually } from "@/app/actions/admin";

export function ManualAttendance() {
  const [state, formAction, pending] = useActionState(markAttendanceManually, {
    status: "idle",
  });

  return (
    <form
      action={formAction}
      className="rounded-xl border border-cream-300 bg-white p-5"
    >
      <h2 className="text-sm font-bold text-ink-900">Mark attendance by hand</h2>
      <p className="mt-1 text-sm text-ink-700">
        For a lost or damaged QR code. Type the 20 character pass ID.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="passId"
          type="text"
          required
          spellCheck={false}
          autoCapitalize="characters"
          placeholder="e.g. 4YYDK7X9FZ934JAYXL8H"
          aria-label="Pass ID"
          className="flex-1 rounded-lg border border-cream-300 px-3.5 py-2.5 font-mono text-sm tracking-wider uppercase outline-none focus:border-saffron-500 focus:ring-2 focus:ring-saffron-200"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-saffron-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-saffron-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Mark present"}
        </button>
      </div>

      {state.status !== "idle" && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium ${
            state.status === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
