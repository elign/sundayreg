# Sunday Program Pass

Registration and attendance for an ISKCON Sunday program.

A visitor enters their details once and is issued a pass with a QR code. On
every later Sunday the same visitor either:

- **enters their name and contact number again** — the site finds their
  existing pass, issues it again, and marks their attendance, or
- **shows their pass** — a volunteer scans the QR code at the door, which marks
  their attendance.

New registrations also count towards that day's attendance, because the
visitor is standing at the welcome desk when they register.

---

## Quick start (no Firebase needed)

```bash
npm install
cp .env.example .env.local
# .env.example already enables FIREBASE_USE_LOCAL_STORE=1. Add throwaway
# development values: ADMIN_PASSWORD=temple123 and
# ADMIN_SESSION_SECRET=$(openssl rand -base64 32). This app then runs entirely
# on a local JSON file. (For the real Firebase setup, see below.)
npm run dev
```

Open <http://localhost:3000>. Data is written to `.data/local-store.json`,
which is gitignored. Delete that file to start over.

To try the staff side, open <http://localhost:3000/admin> and sign in with the
`ADMIN_PASSWORD` from `.env.local`.

---

## Setting up Firebase

Only needed for real deployments. Steps assume the Firebase console.

### 1. Create the project

1. <https://console.firebase.google.com> → **Add project**.
2. Disable Google Analytics (not needed).
3. In the project overview, click the **Web** icon (`</>`) to register a web
   app. You do **not** need the config it shows — this site talks to Firestore
   only from the server. Give it any nickname and skip the rest.

### 2. Create the database

1. **Build → Firestore Database → Create database**.
2. Choose **Start in production mode**. The rules in this repo already deny all
   client access, so the wizard's test-mode rules are not needed.
3. Pick the location closest to your temple. This cannot be changed later.

### 3. Create a service account key

1. **Project settings (gear icon) → Service accounts → Generate new private key**.
2. Download the JSON file. It contains a private key — treat it like a password
   and never commit it.
3. Put its contents in `.env.local`. Either paste the whole file into
   `FIREBASE_SERVICE_ACCOUNT_JSON`, or set `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` individually. See
   `.env.example` for the exact format.

### 4. Turn off the local store and deploy the rules

In `.env.local`, remove `FIREBASE_USE_LOCAL_STORE=1` and fill in the service
account values. Then:

```bash
npx firebase login
npx firebase use --add          # pick your project
npx firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` denies all client reads and writes. That is intentional: the
Admin SDK bypasses rules, so the app still works while nobody can read your
congregation's phone numbers and dates of birth straight out of Firestore.

### 5. Set the staff password

Generate a session secret and choose a password:

```bash
openssl rand -base64 32
```

Set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in `.env.local`. Changing
`ADMIN_SESSION_SECRET` signs every volunteer out.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIREBASE_USE_LOCAL_STORE` | no | `1` runs on a local JSON file. Refuses to run in production. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | yes\* | Whole service account JSON on one line. |
| `FIREBASE_PROJECT_ID` | yes\* | Firebase project id. |
| `FIREBASE_CLIENT_EMAIL` | yes\* | Service account email. |
| `FIREBASE_PRIVATE_KEY` | yes\* | Service account private key, `\n` escapes are converted. |
| `ADMIN_PASSWORD` | yes | Shared password for `/admin` and `/checkin`. |
| `ADMIN_SESSION_SECRET` | yes | Signs the session cookie. Minimum 16 characters. |
| `TEMPLE_TIMEZONE` | no | IANA timezone, default `Asia/Kolkata`. Decides which program day a visit belongs to. |
| `DEFAULT_COUNTRY_CODE` | no | Dialing code for bare 10 digit numbers, default `91`. |
| `PUBLIC_BASE_URL` | no | Set when behind a proxy that hides the real host, so the QR code points at the right address. |

\* Required unless the local store is enabled.

---

## How it works

### Why there is no Firebase code in the browser

Every read and write goes through the Next.js server using the Admin SDK. This
means the public site ships no Firebase credentials, and `firestore.rules` can
deny everything. The alternative — letting visitors write to Firestore
directly — would mean any phone number in the congregation is readable by
anyone who opens the browser console.

### Data model

```
people/{phoneKey}                        phoneKey = normalised digits, e.g. 919876543210
  passId      20 random characters       ← encoded in the QR code, not the phone number
  name, phone, gender
  selfReportedReturning
  createdDate, lastVisitDate             local program dates, "YYYY-MM-DD"
  createdAtMs, totalVisits

attendance/{YYYY-MM-DD}/entries/{phoneKey}    one subcollection per program day
  passId, name, method                    method = "register" | "scan" | "manual"
  at                                      server timestamp
```

Two details do most of the work:

- **The document id is the phone number.** Creating the record is the duplicate
  check. If the phone is already registered the create fails and the visitor is
  treated as returning, so two people submitting the same number at the same
  moment can never produce two records.
- **The attendance document id is also the phone number, within that day's
  subcollection.** Scanning the same pass twice on one Sunday is therefore a
  no-op rather than a second attendance. This is what stops a queue of
  volunteers double-counting the same person.

The QR code encodes the pass URL, not the phone number, so scanning someone's
pass does not hand over their contact number.

### Which Sunday a visit belongs to

`TEMPLE_TIMEZONE` decides this, not the server clock and not the visitor's
phone. A Sunday evening program that starts after midnight UTC still counts
for that Sunday.

---

## Sunday morning runbook

For volunteers. No technical knowledge needed.

1. Open the check-in station on a phone or tablet:
   <https://your-site/checkin> and sign in with the staff password. It stays
   signed in for 30 days, so this is a one-time step per device.
2. Tap **Start camera** and allow camera access.
3. Visitors show their pass on their phone. Hold it in front of the camera.
4. A green card means checked in. An amber card means they were already
   checked in today. Red means the pass is not recognised.
5. If a pass will not scan — a cracked screen, no phone — look the pass ID up
   on the **Dashboard** and type it into **Mark attendance by hand**.

If the camera cannot be used at all, everyone can simply register at
<https://your-site> instead. Entering an existing contact number still marks
attendance correctly.

---

## Deploying to Vercel

1. Push the code to a private Git repository.
2. Import it at <https://vercel.com/new>.
3. Add the environment variables under **Settings → Environment Variables**:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
   `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `TEMPLE_TIMEZONE`.
   Do **not** set `FIREBASE_USE_LOCAL_STORE` — the app throws if you do.
4. Deploy.

The camera on `/checkin` needs HTTPS, which Vercel provides by default.
`localhost` is exempt, so camera testing works in development.

---

## Things worth knowing

- **The Firestore code paths have been type-checked but not run against a real
  database**, because no Firebase project existed when this was built. The
  local JSON store implements the same interface and is what the end-to-end
  tests exercise. Run through a real Sunday's attendance on a scratch project
  before relying on it.
- **Rate limiting is per server instance** and resets on deploy. It is a speed
  bump against casual form spam, not a security control. Real protection comes
  from Firestore being unreachable except through the server.
- **Name search matches the start of a name, or a full phone number.** Firestore
  cannot do substring matching natively. A "contains" search would need
  Algolia or Typesense.
- **Phone numbers are only grouped for India** (5+5). Other countries are shown
  ungrouped rather than guessing a national format. Grouping them properly
  needs a library such as `libphonenumber-js`.
- **There is one shared staff password, not individual accounts.** It keeps the
  congregation's data away from the public. If you need per-volunteer logins
  and revocable access, that means adding Firebase Auth.
- **The dashboard paginates by offset**, so a rename or new signup while
  someone is paging can make a row appear twice or be skipped. Firestore cursor
  pagination would fix it; it is not noticeable at a few hundred people.
- **No test framework** is set up. The suites used during development were
  throwaway scripts driving the running app. Adding `vitest` would be worth it
  before this code is changed heavily.
