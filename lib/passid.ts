const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASS_ID_LENGTH = 20;

/**
 * Unguessable pass id. Excludes 0/O/1/I so volunteers can read it aloud or
 * type it from a printed pass without ambiguity.
 */
export function generatePassId(): string {
  const bytes = new Uint8Array(PASS_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

export function isValidPassId(value: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${PASS_ID_LENGTH}}$`).test(value);
}

/**
 * Accepts anything a camera might hand us: a raw pass id, the "SP:" prefixed
 * form, or a full pass URL. Returns the pass id, or null if none is present.
 */
export function parsePassCode(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (isValidPassId(value)) return value;

  const urlMatch = value.match(/\/pass\/([A-Za-z0-9]+)/);
  if (urlMatch && isValidPassId(urlMatch[1])) return urlMatch[1];

  const prefixed = value.replace(/^SP:/i, "").trim().toUpperCase();
  if (isValidPassId(prefixed)) return prefixed;

  return null;
}
