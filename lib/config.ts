export const siteConfig = {
  name: "Sunday Program Pass",
  tagline: "Your pass to the Sunday program",
  /** Placeholder. Replace with the name of your ISKCON centre. */
  centreName: "ISKCON Centre",
  centreAddress: "Centre address goes here",
  programmeTime: "Sunday morning",
  supportNote:
    "Having trouble? Please speak to a temple volunteer at the welcome desk.",
} as const;

/** IANA timezone used to decide which program day a visit belongs to. */
export function programTimezone(): string {
  return process.env.TEMPLE_TIMEZONE?.trim() || "Asia/Kolkata";
}

export function isLocalStoreEnabled(): boolean {
  return process.env.FIREBASE_USE_LOCAL_STORE === "1";
}

/**
 * `next build` runs with NODE_ENV=production but is not serving traffic, and it
 * often does not have the runtime secrets. Only assert when actually serving.
 */
function isBuildPhase(): boolean {
  return (process.env.NEXT_PHASE ?? "").includes("build");
}

/**
 * Fails fast, on the first request, if a production deployment is not wired to
 * a real database. A misconfigured deployment would otherwise accept visitor
 * registrations and quietly write them somewhere that gets thrown away.
 *
 * Checks environment variables only, so it is safe to call while rendering.
 */
export function assertStorageConfig(): void {
  if (process.env.NODE_ENV !== "production" || isBuildPhase()) return;

  if (isLocalStoreEnabled()) {
    throw new Error(
      "FIREBASE_USE_LOCAL_STORE=1 is set in production. Visitor records would " +
        "be written to a local JSON file and lost. Remove it and configure the " +
        "Firebase service account instead.",
    );
  }

  const hasJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
  const hasParts = Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
      process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
      process.env.FIREBASE_PRIVATE_KEY?.trim(),
  );
  if (!hasJson && !hasParts) {
    throw new Error(
      "No Firebase credentials in production. Set FIREBASE_SERVICE_ACCOUNT_JSON, " +
        "or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }
}
