import { GENDERS, type Gender } from "./types";
import { parsePhone } from "./phone";

export type FieldErrors = Partial<Record<"name" | "phone" | "gender", string>>;

export interface ValidRegistration {
  name: string;
  phoneKey: string;
  phone: string;
  gender: Gender;
  selfReportedReturning: boolean;
}

export type ValidationResult =
  | { ok: true; data: ValidRegistration }
  | { ok: false; errors: FieldErrors };

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}$/u;

export function validateRegistration(
  formData: FormData,
): ValidationResult {
  const errors: FieldErrors = {};

  const rawName = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!rawName) {
    errors.name = "Please enter your full name.";
  } else if (rawName.length < 2) {
    errors.name = "Please enter your full name.";
  } else if (!NAME_PATTERN.test(rawName)) {
    errors.name = "Use letters, spaces, apostrophes and hyphens only.";
  }

  const rawPhone = String(formData.get("phone") ?? "").trim();
  const parsed = parsePhone(rawPhone);
  if (!rawPhone) {
    errors.phone = "Please enter your contact number.";
  } else if (!parsed) {
    errors.phone = "That does not look like a valid phone number.";
  }

  const rawGender = String(formData.get("gender") ?? "").trim();
  const gender = GENDERS.find((g) => g.value === rawGender)?.value;
  if (!gender) {
    errors.gender = "Please select an option.";
  }

  if (Object.keys(errors).length > 0 || !parsed || !gender) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name: rawName,
      phoneKey: parsed.phoneKey,
      phone: parsed.display,
      gender,
      selfReportedReturning: formData.get("firstTime") !== "on",
    },
  };
}

/** How far back "new this week" reaches, in days. */
export const NEW_THIS_WEEK_DAYS = 6;
