export interface ParsedPhone {
  /** Normalised digits, no "+", no leading zero. 10-15 digits. */
  phoneKey: string;
  /** Display form, e.g. "+91 98765 43210". */
  display: string;
  countryCode: string;
}

const PHONE_KEY_PATTERN = /^[1-9]\d{9,14}$/;

/** Dialing code assumed when a visitor types a bare 10 digit number. */
export function defaultCountryCode(): string {
  const value = process.env.DEFAULT_COUNTRY_CODE?.replace(/\D/g, "") ?? "";
  return value.length === 2 || value.length === 3 ? value : "91";
}

/**
 * Accepts the many ways people type a phone number and returns a stable
 * document id plus a readable display form. Returns null when the input
 * cannot be a real phone number.
 *
 * A bare 10 digit number is assumed to be local. Anything longer is treated as
 * already carrying its own country code.
 */
export function parsePhone(
  raw: string,
  defaultCode = defaultCountryCode(),
): ParsedPhone | null {
  // Keep digits and a single leading "+"; a "+" anywhere else is a typo.
  let value = raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (value.startsWith("00")) value = value.slice(2);

  let digits = value.replace(/\D/g, "");
  if (digits.length === 0) return null;

  const cc = defaultCode;
  let countryCode = "";

  if (digits.length === 10) {
    // Bare national number.
    countryCode = cc;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    // National number with a trunk prefix, e.g. 09876543210.
    digits = digits.slice(1);
    countryCode = cc;
  } else if (cc && digits.startsWith(cc) && digits.length - cc.length >= 10) {
    // Already carries the default country code.
    countryCode = cc;
    digits = digits.slice(cc.length);
  } else {
    // Assume an international number in some other country.
    countryCode = "";
  }

  if (!PHONE_KEY_PATTERN.test(digits)) return null;

  const phoneKey = `${countryCode}${digits}`;
  if (!PHONE_KEY_PATTERN.test(phoneKey)) return null;

  return { phoneKey, display: formatPhone(phoneKey), countryCode };
}

/** True when the input looks like a phone number the user is searching for. */
export function looksLikePhone(raw: string): boolean {
  return parsePhone(raw) !== null;
}

/** Country codes we recognise well enough to split off for display. */
const KNOWN_COUNTRY_CODES = ["91", "1", "44", "971", "61", "7"];

export function formatPhone(phoneKey: string): string {
  for (const cc of KNOWN_COUNTRY_CODES) {
    if (!phoneKey.startsWith(cc)) continue;
    const national = phoneKey.slice(cc.length);
    if (national.length < 10) continue;
    // 5+5 is the Indian convention. Other countries are shown ungrouped rather
    // than guessing at a national format we do not have metadata for.
    const body =
      cc === "91" && national.length === 10
        ? `${national.slice(0, 5)} ${national.slice(5)}`
        : national;
    return `+${cc} ${body}`;
  }
  return `+${phoneKey}`;
}

/** Masks the middle of the number so a pass can be shown publicly. */
export function maskPhone(phone: string): string {
  const visible = phone.replace(/\D/g, "").slice(-4);
  const masked = "\u2022".repeat(6);
  return phone.startsWith("+")
    ? `${phone.slice(0, phone.indexOf(" ") + 1 || 3)}${masked} ${visible}`
    : `${masked} ${visible}`;
}
