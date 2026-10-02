import { isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { parsePassCode } from "@/lib/passid";
import { todayInTimezone } from "@/lib/date";
import type { MarkAttendanceResult } from "@/lib/types";

/**
 * Check-in endpoint for the scanning station.
 *
 * The response is deliberately narrow: the name and visit count only. Date of
 * birth and the full phone number are never sent to the browser.
 */
type CheckinResponse =
  | { status: "checked_in"; name: string; totalVisits: number; isNewVisit: boolean }
  | { status: "already_checked_in"; name: string; totalVisits: number }
  | { status: "unknown_pass" }
  | { status: "invalid_code" }
  | { status: "unauthorised" };

function narrow(result: MarkAttendanceResult): CheckinResponse {
  switch (result.status) {
    case "checked_in":
      return {
        status: "checked_in",
        name: result.person.name,
        totalVisits: result.person.totalVisits,
        isNewVisit: result.isNewVisit,
      };
    case "already_checked_in":
      return {
        status: "already_checked_in",
        name: result.person.name,
        totalVisits: result.person.totalVisits,
      };
    default:
      return { status: "unknown_pass" };
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ status: "unauthorised" } satisfies CheckinResponse, {
      status: 401,
    });
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    return Response.json({ status: "invalid_code" } satisfies CheckinResponse, { status: 400 });
  }

  const passId = parsePassCode(code);
  if (!passId) {
    return Response.json({ status: "invalid_code" } satisfies CheckinResponse, { status: 400 });
  }

  const result = await getStore().markAttendance({
    passId,
    date: todayInTimezone(),
    atMs: Date.now(),
    method: "scan",
  });

  return Response.json(narrow(result));
}
