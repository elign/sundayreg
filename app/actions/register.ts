"use server";

import { getStore } from "@/lib/store";
import { qrSvg } from "@/lib/qr";
import { rateLimit } from "@/lib/rate-limit";
import { clientAddress, passUrl } from "@/lib/url";
import { maskPhone } from "@/lib/phone";
import { todayInTimezone } from "@/lib/date";
import { validateRegistration } from "@/lib/validation";
import type { RegisterState } from "@/lib/register-state";

const SUBMISSIONS_PER_WINDOW = 8;
const WINDOW_MS = 10 * 60 * 1000;

export async function registerVisitor(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const limit = rateLimit(
    `register:${await clientAddress()}`,
    SUBMISSIONS_PER_WINDOW,
    WINDOW_MS,
  );
  if (!limit.allowed) {
    return {
      status: "error",
      message: `Too many submissions. Please wait ${limit.retryAfterSeconds} seconds and try again.`,
    };
  }

  const validation = validateRegistration(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      errors: validation.errors,
    };
  }

  const { data } = validation;
  const programDate = todayInTimezone();

  let result;
  try {
    result = await getStore().registerPerson({
      name: data.name,
      phoneKey: data.phoneKey,
      phone: data.phone,
      gender: data.gender,
      selfReportedReturning: data.selfReportedReturning,
      date: programDate,
      atMs: Date.now(),
    });
  } catch (error) {
    console.error("registerVisitor failed", error);
    return {
      status: "error",
      message:
        "We could not save your details just now. Please try again, or tell a volunteer at the welcome desk.",
    };
  }

  const url = await passUrl(result.person.passId);

  return {
    status: "success",
    created: result.status === "created",
    passId: result.person.passId,
    name: result.person.name,
    phoneMasked: maskPhone(result.person.phone),
    passUrl: url,
    qrSvg: await qrSvg(url),
    totalVisits: result.person.totalVisits,
    mismatch: data.selfReportedReturning && result.status === "created",
    programDate,
  };
}
