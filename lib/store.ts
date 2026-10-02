import { assertStorageConfig, isLocalStoreEnabled } from "./config";
import { FirestoreStore } from "./store-firestore";
import { LocalStore } from "./store-local";
import type {
  AttendanceEntry,
  ListPeopleOptions,
  ListPeopleResult,
  MarkAttendanceInput,
  MarkAttendanceResult,
  Person,
  ProgramStats,
  RegisterInput,
  RegisterResult,
} from "./types";

/**
 * Every read and write of visitor data goes through this interface.
 *
 * Firestore is the real implementation. There is a JSON file implementation
 * for local development only (FIREBASE_USE_LOCAL_STORE=1) so the app can be
 * run before a Firebase project exists.
 */
export interface DataStore {
  /**
   * Creates a person, or reports the existing record for the same phone
   * number. Either way attendance is recorded for `input.date`.
   */
  registerPerson(input: RegisterInput): Promise<RegisterResult>;

  getPersonByPassId(passId: string): Promise<Person | null>;

  getPersonByPhone(phoneKey: string): Promise<Person | null>;

  /** Records attendance once per program date. Repeat calls are no-ops. */
  markAttendance(input: MarkAttendanceInput): Promise<MarkAttendanceResult>;

  listPeople(options?: ListPeopleOptions): Promise<ListPeopleResult>;

  /** Everyone checked in on a given program date, newest first. */
  getRoster(date: string): Promise<AttendanceEntry[]>;

  getStats(date: string): Promise<ProgramStats>;

  /** Exact phone match, or a case-insensitive prefix match on name. */
  searchPeople(query: string): Promise<Person[]>;
}

// Cached on globalThis so the store survives dev server hot reloads.
const globalCache = globalThis as typeof globalThis & {
  __sundayPassStore?: DataStore;
};

export function getStore(): DataStore {
  if (!globalCache.__sundayPassStore) {
    // Server Actions do not necessarily render the layout, so check here too.
    assertStorageConfig();
    globalCache.__sundayPassStore = isLocalStoreEnabled()
      ? new LocalStore()
      : new FirestoreStore();
  }
  return globalCache.__sundayPassStore;
}
