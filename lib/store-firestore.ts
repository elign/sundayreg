import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { DataStore } from "./store";
import type {
  AttendanceEntry,
  AttendanceMethod,
  Gender,
  ListPeopleOptions,
  ListPeopleResult,
  MarkAttendanceInput,
  MarkAttendanceResult,
  Person,
  PeopleSort,
  ProgramStats,
  RegisterInput,
  RegisterResult,
} from "./types";
import { NEW_THIS_WEEK_DAYS } from "./validation";
import { addDays } from "./date";
import { looksLikePhone, parsePhone } from "./phone";
import { generatePassId } from "./passid";

const PEOPLE = "people";
const ATTENDANCE = "attendance";
const ENTRIES = "entries";

const ALREADY_EXISTS = 6;

/** recordAttendance always has a person, so it never returns "unknown_pass". */
type AttendanceOutcome = Exclude<MarkAttendanceResult, { status: "unknown_pass" }>;

function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: number | string })?.code;
  return code === ALREADY_EXISTS || code === "already-exists";
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  return 0;
}

function personFromData(phoneKey: string, data: Record<string, unknown>): Person {
  return {
    phoneKey,
    phone: String(data.phone ?? `+${phoneKey}`),
    passId: String(data.passId ?? ""),
    name: String(data.name ?? ""),
    gender: (data.gender as Gender) ?? "unspecified",
    selfReportedReturning: data.selfReportedReturning === true,
    createdAtMs: toMillis(data.createdAtMs),
    createdDate: String(data.createdDate ?? ""),
    lastVisitDate: String(data.lastVisitDate ?? ""),
    totalVisits: Number(data.totalVisits ?? 0),
  };
}

function entryFromData(phoneKey: string, data: Record<string, unknown>): AttendanceEntry {
  return {
    phoneKey,
    passId: String(data.passId ?? ""),
    name: String(data.name ?? ""),
    method: (data.method as AttendanceMethod) ?? "scan",
    atMs: toMillis(data.at),
  };
}

function orderFor(sort: PeopleSort | undefined) {
  switch (sort) {
    case "recent":
      return { field: "createdAtMs" as const, direction: "desc" as const };
    case "visits":
      return { field: "totalVisits" as const, direction: "desc" as const };
    default:
      return { field: "name" as const, direction: "asc" as const };
  }
}

export class FirestoreStore implements DataStore {
  constructor(private readonly db: Firestore = getDb()) {}

  private personRef(phoneKey: string) {
    return this.db.collection(PEOPLE).doc(phoneKey);
  }

  private entryRef(date: string, phoneKey: string) {
    return this.db.collection(ATTENDANCE).doc(date).collection(ENTRIES).doc(phoneKey);
  }

  /**
   * Records attendance for a known person. A Firestore transaction keeps the
   * once-per-day guarantee and the visit counter in step, even if two
   * volunteers scan the same pass at the same moment.
   */
  private async recordAttendance(
    person: Person,
    date: string,
    atMs: number,
    method: AttendanceMethod,
  ): Promise<AttendanceOutcome> {
    const entryRef = this.entryRef(date, person.phoneKey);
    const personRef = this.personRef(person.phoneKey);

    return this.db.runTransaction(async (tx) => {
      const existing = await tx.get(entryRef);
      if (existing.exists) {
        return {
          status: "already_checked_in",
          person,
          entry: entryFromData(person.phoneKey, existing.data() ?? {}),
        } satisfies AttendanceOutcome;
      }

      tx.set(entryRef, {
        passId: person.passId,
        name: person.name,
        method,
        at: FieldValue.serverTimestamp(),
      });
      tx.set(
        personRef,
        { lastVisitDate: date, totalVisits: FieldValue.increment(1) },
        { merge: true },
      );

      return {
        status: "checked_in",
        person: {
          ...person,
          lastVisitDate: date,
          totalVisits: person.totalVisits + 1,
        },
        entry: {
          phoneKey: person.phoneKey,
          passId: person.passId,
          name: person.name,
          method,
          atMs,
        },
        isNewVisit: person.lastVisitDate !== date,
      } satisfies AttendanceOutcome;
    });
  }

  async registerPerson(input: RegisterInput): Promise<RegisterResult> {
    const person: Person = {
      phoneKey: input.phoneKey,
      phone: input.phone,
      passId: generatePassId(),
      name: input.name,
      gender: input.gender,
      selfReportedReturning: input.selfReportedReturning,
      createdAtMs: input.atMs,
      createdDate: input.date,
      lastVisitDate: input.date,
      totalVisits: 0,
    };

    try {
      // create() is the duplicate check: it fails atomically if this phone
      // number is already registered.
      await this.personRef(input.phoneKey).create({
        ...person,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;

      const snap = await this.personRef(input.phoneKey).get();
      const existing = personFromData(input.phoneKey, snap.data() ?? {});
      const attendance = await this.recordAttendance(
        existing,
        input.date,
        input.atMs,
        "register",
      );
      return { status: "existing", person: attendance.person };
    }

    const attendance = await this.recordAttendance(person, input.date, input.atMs, "register");
    return { status: "created", person: attendance.person };
  }

  async getPersonByPassId(passId: string): Promise<Person | null> {
    const snap = await this.db
      .collection(PEOPLE)
      .where("passId", "==", passId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return personFromData(snap.docs[0].id, snap.docs[0].data());
  }

  async getPersonByPhone(phoneKey: string): Promise<Person | null> {
    const snap = await this.personRef(phoneKey).get();
    return snap.exists ? personFromData(snap.id, snap.data() ?? {}) : null;
  }

  async markAttendance(input: MarkAttendanceInput): Promise<MarkAttendanceResult> {
    const person = await this.getPersonByPassId(input.passId);
    if (!person) return { status: "unknown_pass", passId: input.passId };
    return this.recordAttendance(person, input.date, input.atMs, input.method);
  }

  async listPeople(options: ListPeopleOptions = {}): Promise<ListPeopleResult> {
    const { limit = 25, offset = 0 } = options;
    const order = orderFor(options.sort);

    const [countSnap, pageSnap] = await Promise.all([
      this.db.collection(PEOPLE).count().get(),
      this.db
        .collection(PEOPLE)
        .orderBy(order.field, order.direction)
        .limit(limit)
        .offset(offset)
        .get(),
    ]);

    return {
      people: pageSnap.docs.map((doc) => personFromData(doc.id, doc.data())),
      total: countSnap.data().count,
    };
  }

  async getRoster(date: string): Promise<AttendanceEntry[]> {
    const snap = await this.db
      .collection(ATTENDANCE)
      .doc(date)
      .collection(ENTRIES)
      .orderBy("at", "desc")
      .limit(300)
      .get();
    return snap.docs.map((doc) => entryFromData(doc.id, doc.data()));
  }

  async getStats(date: string): Promise<ProgramStats> {
    const [totalPeople, todayCount, newThisWeek] = await Promise.all([
      this.db.collection(PEOPLE).count().get(),
      this.db.collection(ATTENDANCE).doc(date).collection(ENTRIES).count().get(),
      this.db
        .collection(PEOPLE)
        .where("createdDate", ">=", addDays(date, -NEW_THIS_WEEK_DAYS))
        .count()
        .get(),
    ]);

    return {
      totalPeople: totalPeople.data().count,
      todayCount: todayCount.data().count,
      newThisWeek: newThisWeek.data().count,
    };
  }

  async searchPeople(query: string): Promise<Person[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (looksLikePhone(trimmed)) {
      const parsed = parsePhone(trimmed);
      const person = parsed ? await this.getPersonByPhone(parsed.phoneKey) : null;
      return person ? [person] : [];
    }

    // Firestore cannot do substring search, so match a name prefix.
    const snap = await this.db
      .collection(PEOPLE)
      .where("name", ">=", trimmed)
      .where("name", "<=", `${trimmed}\uf8ff`)
      .orderBy("name")
      .limit(50)
      .get();

    return snap.docs.map((doc) => personFromData(doc.id, doc.data()));
  }
}
