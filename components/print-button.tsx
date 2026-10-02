"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-saffron-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-saffron-700"
    >
      Print this pass
    </button>
  );
}
