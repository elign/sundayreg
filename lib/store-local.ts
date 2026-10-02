import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DataStore } from "./store";
import type {
  AttendanceEntry,
  AttendanceMethod,
  ListPeopleOptions,
  ListPeopleResult,
  MarkAttendanceInput,
  MarkAttendanceResult,
  Person,
  ProgramStats,
  RegisterInput,
  RegisterResult,
} from "./types";
import { NEW_THIS_WEEK_DAYS } from "./validation";
import { addDays } from "./date";
import { looksLikePhone, parsePhone } from "./phone";
import { generatePassId } from "./passid";

/**
 * DEVELOPMENT ONLY. A JSON file standing in for Firestore so the app can be
 * run and demoed before a Firebase project exists. Never used in production:
 * gated behind FIREBASE_USE_LOCAL_STORE=1.
 *
 * Records are held in memory and flushed to disk after every write.
 */

interface Snapshot {
  people: Record<string, Person>;
  /** date -> phoneKey -> entry */
  attendance: Record<string, Record<string, AttendanceEntry>>;
}

// Statically scoped so the bundler does not trace the whole project into the
// deployment output just because of this development-only file.
const DATA_FILE = path.join(process.cwd(), ".data", "local-store.json");

const EMPTY: Snapshot = { people: {}, attendance: {} };

/** Serialises writes so two concurrent requests cannot clobber the file. */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export class LocalStore implements DataStore {
  private data: Snapshot | null = null;
  private loaded: Promise<Snapshot> | null = null;

  private async load(): Promise<Snapshot> {
    if (this.data) return this.data;
    if (!this.loaded) {
      this.loaded = (async () => {
        try {
          const raw = await readFile(DATA_FILE, "utf8");
          const parsed = JSON.parse(raw) as Partial<Snapshot>;
          this.data = {
            people: parsed.people ?? {},
            attendance: parsed.attendance ?? {},
          };
        } catch {
          this.data = structuredClone(EMPTY);
        }
        return this.data;
      })();
    }
    return this.loaded;
  }

  private async flush(data: Snapshot): Promise<void> {
    this.data = data;
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    // Write to a sibling file then rename, so a crash cannot truncate the store.
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await rename(tmp, DATA_FILE);
  }

  private async mutate<T>(fn: (data: Snapshot) => Promise<T> | T): Promise<T> {
    return withLock(async () => {
      const data = await this.load();
      const result = await fn(data);
      await this.flush(data);
      return result;
    });
  }

  private recordAttendance(
    data: Snapshot,
    person: Person,
    date: string,
    atMs: number,
    method: AttendanceMethod,
  ): MarkAttendanceResult {
    const day = (data.attendance[date] ??= {});
    const existing = day[person.phoneKey];
    if (existing) {
      return { status: "already_checked_in", person, entry: existing };
    }

    const isNewVisit = person.lastVisitDate !== date;
    const entry: AttendanceEntry = {
      phoneKey: person.phoneKey,
      passId: person.passId,
      name: person.name,
      method,
      atMs,
    };
    day[person.phoneKey] = entry;
    person.lastVisitDate = date;
    person.totalVisits += 1;

    return { status: "checked_in", person, entry, isNewVisit };
  }

  async registerPerson(input: RegisterInput): Promise<RegisterResult> {
    return this.mutate((data) => {
      const existing = data.people[input.phoneKey];
      if (existing) {
        this.recordAttendance(data, existing, input.date, input.atMs, "register");
        return { status: "existing", person: existing } satisfies RegisterResult;
      }

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
      data.people[input.phoneKey] = person;
      this.recordAttendance(data, person, input.date, input.atMs, "register");
      return { status: "created", person } satisfies RegisterResult;
    });
  }

  async getPersonByPassId(passId: string): Promise<Person | null> {
    const data = await this.load();
    return Object.values(data.people).find((p) => p.passId === passId) ?? null;
  }

  async getPersonByPhone(phoneKey: string): Promise<Person | null> {
    const data = await this.load();
    return data.people[phoneKey] ?? null;
  }

  async markAttendance(input: MarkAttendanceInput): Promise<MarkAttendanceResult> {
    const person = await this.getPersonByPassId(input.passId);
    if (!person) return { status: "unknown_pass", passId: input.passId };
    return this.mutate((data) => {
      const current = data.people[person.phoneKey] ?? person;
      return this.recordAttendance(data, current, input.date, input.atMs, input.method);
    });
  }

  async listPeople(options: ListPeopleOptions = {}): Promise<ListPeopleResult> {
    const { limit = 25, offset = 0 } = options;
    const data = await this.load();
    const people = [...Object.values(data.people)];

    switch (options.sort) {
      case "recent":
        people.sort((a, b) => b.createdAtMs - a.createdAtMs);
        break;
      case "visits":
        people.sort((a, b) => b.totalVisits - a.totalVisits || a.name.localeCompare(b.name));
        break;
      default:
        people.sort((a, b) => a.name.localeCompare(b.name));
    }

    return { people: people.slice(offset, offset + limit), total: people.length };
  }

  async getRoster(date: string): Promise<AttendanceEntry[]> {
    const data = await this.load();
    return Object.values(data.attendance[date] ?? {}).sort((a, b) => b.atMs - a.atMs);
  }

  async getStats(date: string): Promise<ProgramStats> {
    const data = await this.load();
    const people = Object.values(data.people);
    return {
      totalPeople: people.length,
      todayCount: Object.keys(data.attendance[date] ?? {}).length,
      newThisWeek: people.filter(
        (p) => p.createdDate >= addDays(date, -NEW_THIS_WEEK_DAYS),
      ).length,
    };
  }

  async searchPeople(query: string): Promise<Person[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const data = await this.load();

    if (looksLikePhone(trimmed)) {
      const parsed = parsePhone(trimmed);
      const person = parsed ? data.people[parsed.phoneKey] : undefined;
      return person ? [person] : [];
    }

    const prefix = trimmed.toLowerCase();
    return Object.values(data.people)
      .filter((p) => p.name.toLowerCase().startsWith(prefix))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }
}
