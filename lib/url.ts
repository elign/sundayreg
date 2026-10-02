import { headers } from "next/headers";

const SAFE_HOST = /^[A-Za-z0-9.\-]+(?::\d{1,5})?$/;

/**
 * The visitor-facing origin, used to build the absolute URL encoded in the pass
 * QR code. Header values are validated because they end up in rendered output.
 */
export async function getBaseUrl(): Promise<string> {
  const store = await headers();
  const host = (store.get("x-forwarded-host") ?? store.get("host") ?? "").split(",")[0].trim();
  if (!SAFE_HOST.test(host)) {
    return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  }
  const proto =
    store.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") || `${proto}://${host}`;
}

export async function passUrl(passId: string): Promise<string> {
  return `${await getBaseUrl()}/pass/${passId}`;
}

/** Best-effort client address, for rate limiting the public form. */
export async function clientAddress(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return store.get("x-real-ip")?.trim() || "unknown";
}
