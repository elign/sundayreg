"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CheckinResult =
  | { status: "checked_in"; name: string; totalVisits: number; isNewVisit: boolean }
  | { status: "already_checked_in"; name: string; totalVisits: number }
  | { status: "unknown_pass" }
  | { status: "invalid_code" }
  | { status: "unauthorised" };

type ScannerState = "idle" | "starting" | "scanning" | "error";

/** Subset of the Barcode Detection API that we use. */
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

/** Ignore repeat reads of the same pass for this long. */
const COOLDOWN_MS = 3000;
const DETECT_INTERVAL_MS = 250;

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);

  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [scannerError, setScannerError] = useState<string>("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [recent, setRecent] = useState<{ name: string; status: string; at: string }[]>([]);
  const [manualCode, setManualCode] = useState("");

  const router = useRouter();

  const checkIn = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const response = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const payload = (await response.json()) as CheckinResult;
        setResult(payload);
        setRecent((previous) =>
          [
            {
              name: "name" in payload ? payload.name : "Unknown pass",
              status: payload.status,
              at: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
            ...previous,
          ].slice(0, 8),
        );
        router.refresh();
      } catch {
        setResult({ status: "invalid_code" });
      } finally {
        busyRef.current = false;
      }
    },
    [router],
  );

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerState("idle");
  }, []);

  // Release the camera when the volunteer leaves the page.
  useEffect(() => stop, [stop]);

  const handleCode = useCallback(
    (code: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last.code === code && now - last.at < COOLDOWN_MS) return;
      lastScanRef.current = { code, at: now };
      void checkIn(code);
    },
    [checkIn],
  );

  const start = useCallback(async () => {
    setScannerError("");
    setResult(null);
    setScannerState("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
    } catch (error) {
      setScannerState("error");
      setScannerError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow the camera, or type the pass ID below."
          : "No camera is available. Type the pass ID below instead.",
      );
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stop();
      return;
    }
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    setScannerState("scanning");

    const Ctor = window.BarcodeDetector;
    if (Ctor) {
      // Native detection: cheapest path, no extra library in the bundle.
      const detector = new Ctor({ formats: ["qr_code"] });
      let lastDetect = 0;
      const tick = async (time: number) => {
        if (streamRef.current !== stream) return;
        if (time - lastDetect > DETECT_INTERVAL_MS) {
          lastDetect = time;
          try {
            const codes = await detector.detect(video);
            const value = codes[0]?.rawValue;
            if (value) handleCode(value);
          } catch {
            // A frame can fail to decode; keep scanning.
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Fallback for browsers without the Barcode Detection API.
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result) => {
          if (result) handleCode(result.getText());
        },
      );
    } catch {
      setScannerState("error");
      setScannerError("Could not start the scanner. Type the pass ID below instead.");
      stop();
    }
  }, [handleCode, stop]);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-cream-300 bg-ink-900">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview"
          className="aspect-3/4 w-full object-cover sm:aspect-square"
        />
        {scannerState !== "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="rounded-lg bg-ink-900/80 px-4 py-3 text-sm text-cream-100">
              {scannerState === "starting"
                ? "Starting the camera…"
                : "Camera is off"}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {scannerState === "scanning" || scannerState === "starting" ? (
          <button
            type="button"
            onClick={stop}
            className="flex-1 rounded-lg border border-cream-300 bg-white px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-cream-50"
          >
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="flex-1 rounded-lg bg-saffron-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-saffron-700"
          >
            Start camera
          </button>
        )}
      </div>

      {scannerError && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {scannerError}
        </p>
      )}

      <div aria-live="assertive">
        {result && <ResultCard result={result} />}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const code = manualCode.trim();
          if (code) void checkIn(code);
          setManualCode("");
        }}
        className="rounded-xl border border-cream-300 bg-white p-4"
      >
        <label htmlFor="manual-code" className="text-sm font-semibold text-ink-900">
          Or type the pass ID
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="manual-code"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="4YYDK7X9FZ934JAYXL8H"
            spellCheck={false}
            autoCapitalize="characters"
            className="flex-1 rounded-lg border border-cream-300 px-3.5 py-2.5 font-mono text-sm tracking-wider uppercase outline-none focus:border-saffron-500 focus:ring-2 focus:ring-saffron-200"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="rounded-lg bg-saffron-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-saffron-700 disabled:opacity-50"
          >
            Check in
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-ink-900">This session</h2>
          <ul className="mt-2 divide-y divide-cream-200 overflow-hidden rounded-xl border border-cream-300 bg-white text-sm">
            {recent.map((item, index) => (
              <li key={`${item.at}-${index}`} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate font-medium text-ink-900">{item.name}</span>
                <span className="shrink-0 text-xs text-ink-500">{item.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: CheckinResult }) {
  if (result.status === "unauthorised") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-900">
        <p className="font-bold">Session expired</p>
        <p className="text-sm">Sign in again at the dashboard.</p>
      </div>
    );
  }

  if (result.status === "unknown_pass") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-900">
        <p className="font-bold">Pass not found</p>
        <p className="text-sm">Ask the visitor to register at the welcome desk.</p>
      </div>
    );
  }

  if (result.status === "invalid_code") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-900">
        <p className="font-bold">Could not read that code</p>
        <p className="text-sm">Try again, or type the pass ID by hand.</p>
      </div>
    );
  }

  if (result.status === "already_checked_in") {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-amber-950">
        <p className="text-lg font-bold">{result.name}</p>
        <p className="text-sm">Already checked in today. Welcome back.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-emerald-950">
      <p className="text-lg font-bold">{result.name}</p>
      <p className="text-sm">
        Checked in{result.isNewVisit ? " · first time on the roll" : ""} · visit{" "}
        {result.totalVisits}
      </p>
    </div>
  );
}
