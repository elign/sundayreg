export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "unspecified", label: "Prefer not to say" },
] as const;

export type Gender = (typeof GENDERS)[number]["value"];

export type AttendanceMethod = "register" | "scan" | "manual";

export interface Person {
  /** Document id. Normalised phone digits, e.g. "919876543210". Unique. */
  phoneKey: string;
  /** Human readable phone for staff, e.g. "+91 98765 43210". */
  phone: string;
  /** Random unguessable id encoded in the pass QR code. */
  passId: string;
  name: string;
  gender: Gender;
  /** Visitor ticked "I have attended before" but had no existing record. */
  selfReportedReturning: boolean;
  /** Epoch milliseconds. */
  createdAtMs: number;
  /** Local program date the person was registered, "YYYY-MM-DD". */
  createdDate: string;
  /** Local program date of the most recent attendance, "YYYY-MM-DD". */
  lastVisitDate: string;
  totalVisits: number;
}

export interface AttendanceEntry {
  phoneKey: string;
  passId: string;
  name: string;
  method: AttendanceMethod;
  /** Epoch milliseconds. */
  atMs: number;
}

export type PeopleSort = "name" | "recent" | "visits";

export interface ListPeopleOptions {
  sort?: PeopleSort;
  limit?: number;
  offset?: number;
}

export interface ListPeopleResult {
  people: Person[];
  total: number;
}

export interface RegisterInput {
  name: string;
  phoneKey: string;
  phone: string;
  gender: Gender;
  selfReportedReturning: boolean;
  date: string;
  atMs: number;
}

export type RegisterResult =
  | { status: "created"; person: Person }
  | { status: "existing"; person: Person };

export interface MarkAttendanceInput {
  passId: string;
  date: string;
  atMs: number;
  method: AttendanceMethod;
}

export type MarkAttendanceResult =
  | {
      status: "checked_in";
      person: Person;
      entry: AttendanceEntry;
      isNewVisit: boolean;
    }
  | { status: "already_checked_in"; person: Person; entry: AttendanceEntry }
  | { status: "unknown_pass"; passId: string };

export interface ProgramStats {
  totalPeople: number;
  todayCount: number;
  newThisWeek: number;
}
