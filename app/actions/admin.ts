"use server";

import { redirect } from "next/navigation";
import { endAdminSession, isAdmin, startAdminSession, verifyAdminPassword } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { parsePassCode } from "@/lib/passid";
import { todayInTimezone } from "@/lib/date";
import { rateLimit } from "@/lib/rate-limit";
import { clientAddress } from "@/lib/url";

const UNLOCK_ATTEMPTS = 10;
const UNLOCK_WINDOW_MS = 15 * 60 * 1000;

export type GateState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function unlockAdmin(
  _prev: GateState,
  formData: FormData,
): Promise<GateState> {
  const limit = rateLimit(
    `unlock:${await clientAddress()}`,
    UNLOCK_ATTEMPTS,
    UNLOCK_WINDOW_MS,
  );
  if (!limit.allowed) {
    return {
      status: "error",
      message: `Too many attempts. Please wait ${Math.ceil(
        limit.retryAfterSeconds / 60,
      )} minutes.`,
    };
  }

  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    return { status: "error", message: "That password is not correct." };
  }

  await startAdminSession();
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/admin");
}

export async function logOut(): Promise<void> {
  await endAdminSession();
  redirect("/");
}

export type ManualState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; message: string };

/** Marks attendance for a pass id typed in by hand, for damaged or lost QR codes. */
export async function markAttendanceManually(
  _prev: ManualState,
  formData: FormData,
): Promise<ManualState> {
  if (!(await isAdmin())) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const passId = parsePassCode(String(formData.get("passId") ?? ""));
  if (!passId) {
    return {
      status: "error",
      message: "That does not look like a pass ID. It is 20 characters long.",
    };
  }

  const result = await getStore().markAttendance({
    passId,
    date: todayInTimezone(),
    atMs: Date.now(),
    method: "manual",
  });

  switch (result.status) {
    case "unknown_pass":
      return { status: "error", message: "No pass found with that ID." };
    case "already_checked_in":
      return {
        status: "ok",
        message: `${result.person.name} was already checked in today.`,
      };
    default:
      return {
        status: "ok",
        message: `Marked attendance for ${result.person.name} (visit ${result.person.totalVisits}).`,
      };
  }
}
