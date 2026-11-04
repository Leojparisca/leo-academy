# Leo Academy — Engineering Notes

Phases 1–4 of an elite, mobile-first PWA for a piano & music-theory academy. The
interface is in Spanish; the code and this document are in English.

The product is offline-first: lessons, practice sessions and teacher evaluations
keep working without a connection, then reconcile with a server-owned SQLite
database.

---

## Non-negotiable architecture: Zero-Client-DB

These rules are part of the product contract. Do not relax them for convenience.

1. **The database never reaches the browser.**
   - Drizzle, `@libsql/client`, the schema, the seed and every query live under
     `src/server/db/` (and `src/server/queries/`).
   - `src/server/db/schema.ts` and `src/server/db/client.ts` start with
     `import "server-only";`. Importing them from a Client Component must fail
     the build.
   - Never expose a DB URL, path, key or SDK through `NEXT_PUBLIC_*`.

2. **The only client ↔ server channel is a Server Action.**
   - Every mutation/query the browser needs is an exported `"use server"`
     function in `src/server/actions/`.
   - Inputs are validated with Zod on the server. Never trust the client.
   - Actions return a discriminated `ActionResult<T>` (`{ ok: true, data }` or
     `{ ok: false, error, code }`) instead of throwing across the boundary.

3. **Dexie is a cache and an outbox, not the source of truth.**
   - On boot the client seeds local Dexie data for instant paint, then fetches
     the server snapshot and caches it.
   - Mutations write locally first (optimistic UI) and are sent to the server
     immediately. If the request fails or the app is in "Modo Sin Luz", the
     mutation is stored in `offlineQueue` and replayed later.
   - Pending local students win over the server copy during a merge, so a
     refresh cannot erase unsynced work.

4. **Teacher authentication is server-side.**
   - The 4-digit PIN is compared against `TEACHER_PIN` on the server only.
   - A successful login sets an HMAC-signed, `httpOnly`, `sameSite=lax` cookie
     (`leo_teacher`). The client never sees the PIN or the signing secret.
   - PIN attempts are rate-limited in memory (5 attempts / 10 minutes / IP).

---

## Stack

| Concern        | Choice                                              |
| -------------- | --------------------------------------------------- |
| Framework      | Next.js 16.4.3 (App Router) + React 19.3.1          |
| Language       | TypeScript 5.9                                      |
| Styling        | Tailwind CSS 3.4 + custom CSS design system         |
| Motion         | Framer Motion 14.9                                  |
| Icons          | Lucide React                                        |
| Audio          | Custom Web Audio engine (no samples, no Tone.js)    |
| Local cache    | Dexie 4.4 + `dexie-react-hooks`                     |
| Server DB      | Drizzle ORM 0.45 + LibSQL (`@libsql/client`)        |
| Validation     | Zod 4                                               |
| PWA            | Web manifest + hand-written service worker          |

---

## Commands

```bash
npm run dev        # Next dev server (http://localhost:3000)
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run db:generate# generate a migration from src/server/db/schema.ts
npm run db:studio  # Drizzle Studio
npm run icons      # regenerate PWA icons from public/publiclogo.jpg
```

Migrations are generated through `scripts/drizzle-kit.mjs` because `drizzle-kit`
cannot import a module guarded by `server-only` under a normal Node resolution.
Use `npm run db:generate`, never a bare `drizzle-kit generate`.

---

## Environment

Copy `.env.example` to `.env.local` (gitignored):

| Variable                | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `DATABASE_URL`          | `file:local.db` or `libsql://…` (Turso). Optional.  |
| `DATABASE_AUTH_TOKEN`   | Turso token; only needed for a remote database.     |
| `PROFESSOR_PIN`         | Exactly 4 digits. Default `1006`.                   |
| `TEACHER_SESSION_SECRET`| Long random string used to sign the session cookie. |
| `STUDENT_SESSION_SECRET`| Optional secret for student cookies.                |
| `LEO_MIGRATIONS_DIR`    | Optional override for the `drizzle/` folder.        |
| `SITE_URL`              | Public origin used by metadata / Open Graph.        |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`PROFESSOR_PIN` and the session secrets must **never** be prefixed with
`NEXT_PUBLIC_`.

---

## Directory map

```
src/
  app/
    (academy)/                 # authenticated-feeling app shell
      mapa/                    # learning path (home)
      estudio/                 # harmonic visor, keybed, lab, rhythm
      juegos/                  # Phase 2 previews
      profesor/                # PIN gate + teacher dashboard
      template.tsx             # page fade transition
    globals.css               # entire design system
    manifest.ts               # PWA manifest
  components/
    shell/                    # header, nav, toasts, offline toggle
    curriculum/               # map (15 nodes), 4-step lesson runner
    games/                    # groove pad, interval hunter, chord architect,
                              # games hub + group rotation
    studio/                   # keybed, harmonic visor, synth studio, labs
    teacher/                  # PIN keypad, dashboard, guide drawer, radar
    providers/                # AcademyProvider: Dexie + sync state
    ui/                       # progress ring, section heading
  data/
    curriculum.ts             # 3 branches × 5 levels, steps, drills, XP rules
    teacher-guide.ts          # 15 “Guía Docente de Leo” teleprompter entries
  lib/
    academy.ts                # shared domain types, levels, skill metadata
    local-db.ts               # Dexie schema + outbox helpers
    audio-engine.ts           # polyphonic Web Audio instrument + percussion
    harmony.ts                # naming, staff mapping, chord/interval analysis
    use-audio-engine.ts       # shared-engine React bridge
    use-midi.ts               # USB-OTG Web MIDI (hot-plug, sustain)
    use-metronome.ts          # audio-clock metronome hook
  server/
    actions/                  # "use server" boundary (students, teacher)
    auth/                     # PIN hashing/compare, signed cookie session
    db/                       # server-only client, schema, migrations, seed
    queries/                  # read models for the teacher dashboard
drizzle/                      # generated SQL migrations
scripts/                      # drizzle-kit wrapper, icon generator
```

---

## Offline data flow

1. `AcademyProvider` boots, calls `seedLocalDb()` and paints from IndexedDB.
2. If online and not in "Modo Sin Luz", it flushes `offlineQueue`, then calls
   `fetchStudentsAction()` and merges the server snapshot with local rows that
   still have pending mutations.
3. `logPractice()` writes `students`, `lessonProgress` and `skillScores` to
   Dexie, updates React state, then either calls `logPracticeAction()` or
   queues the payload.
4. Turning "Modo Sin Luz" off (or the browser `online` event) calls
   `flushQueue()`, which sends queued payloads through
   `syncPracticeSessionsAction()` and clears successful entries.
5. Server actions are idempotent by `clientId` (`onConflictDoNothing`), so a
   retry cannot double-count minutes.

Dexie database name: `leo-academy`.

| Table            | Key / indexes                                        |
| ---------------- | ---------------------------------------------------- |
| `students`       | `id`, `name`, `updatedAt`                            |
| `lessonProgress` | `++id`, `studentId`, `levelId`, `[studentId+levelId]`|
| `skillScores`    | `++id`, `studentId`, `skill`, `[studentId+skill]`    |
| `curriculumProgress` | `++id`, `studentId`, `nodeId`, `[studentId+nodeId]` |
| `xpLedger`       | `++id`, `studentId`, `source`, `[studentId+source]`  |
| `offlineQueue`   | `++id`, `clientId`, `status`, `kind`, `createdAt`    |

The offline flag and active student persist in `localStorage`
(`leo.unplugged`, `leo.activeStudent`).

---

## Server data model

`src/server/db/schema.ts` defines:

- `students` — profile, level, age, private teacher notes, streak, minutes,
  accuracy, weekly goal.
- `levels` — 8-level curriculum (ordinal, title, focus, minutes, XP).
- `unlockedLevels` — teacher-granted access per student/level.
- `lessonProgress` — per-student, per-level status/progress/best score.
- `skillScores` — melody / harmony / rhythm history with source + sync origin.
- `practiceSessions` — minutes, skill, score, `source: "live" | "offline"`.
- `teacherEvaluations` — melody / harmony / rhythm / posture (0–100), feedback
  and homework.
- `attendance` — one row per student/day (`mode: "normal" | "unplugged"`) with
  optional notes; unique on `(studentId, date)` so marking the same class twice
  updates instead of duplicating.

The DB opens lazily, runs migrations from `drizzle/`, then idempotently seeds the
curriculum reference rows (`src/server/db/seed.ts`). No students, grades or
sessions are invented. With no configuration the database is a local LibSQL file
at `./.data/leo-academy.db`; on a serverless host it falls back to
`/tmp/leo-academy.db`. Set `DATABASE_URL` (and `DATABASE_AUTH_TOKEN`) to use a
free Turso database so data survives cold starts. Dexie stays the offline-first
store, and the teacher panel can export the whole server database as JSON.

---

## Design system — "Sapphire Tactile Neumorphism"

Inspired by the brushed-sapphire logo (`public/logo.jpg`). The aesthetic is
mineral, tactile and editorial — not a generic dashboard.

### Palette

```css
--bg-abyss: #050B14;
--bg-sapphire-surface: #0B1729;
--bg-sapphire-elevated: #10223D;
--accent-royal: #0D6EFD;
--accent-cyan-glow: #38BDF8;
--text-ivory: #F8FAFC;
```

Extended tokens: muted/faint text, ember accent, hairlines, glow shadows,
`--radius-card`, `--ease-silk`.

### Core classes (exact values)

- `.neu-card` — `linear-gradient(145deg, #0E1E36, #091322)`, dual shadows
  `8px 8px 18px #03070D` and `-6px -6px 16px rgba(30,95,180,0.12)`, 1px white
  6% border, 24px radius.
- `.neu-button` — raised surface with a pressed/`:active` inset state.
- `.neu-inset` — recessed wells for inputs and controls.

Supporting utilities: `.neu-inset--deep`, `.neu-pill`, `.neu-icon`,
`.piano-key-white`, `.piano-key-black`, `.range-neu`, `.wave-bar`,
`.header-shell`, `.bottom-nav`, `.nav-pool`, `.sapphire-text`, `.eyebrow`.

### Rules

- Do not introduce flat `bg-slate-800 border-slate-700` cards.
- Typography pairs a serif display face (headings, italic accents) with a
  compact uppercase micro-label system.
- Motion is restrained: soft springs for the active tab/nav pool, short fades,
  staggered reveals. Respect `prefers-reduced-motion`.
- Mobile-first: content maxes at 560px; header is fixed and fades content under
  it; bottom nav floats above the safe area.
- Interactions must work with touch, mouse and keyboard. Piano keys use pointer
  events with `touch-action: none`.

---

## Teacher flow

- `/profesor` renders `TeacherGate` when no valid session cookie exists.
- The keypad auto-submits on the 4th digit. Wrong PINs show an inline error and
  count toward the rate limit.
- A valid PIN sets `leo_teacher` and the server-rendered dashboard appears.
- The Phase 4/5 dashboard has five live sections:
  1. **Evaluador en vivo** — four neumorphic sliders (ritmo, melodía, armonía,
     postura), a live radar preview, feedback/homework, and an optional
     “unlock next level” switch. Saving writes the evaluation, mirrors the three
     musical axes into `skillScores` with `source: "teacher"` and can raise the
     student's `currentLevel`.
  2. **Alumnos** — profile creator (name, age, level, weekly goal, private
     notes) plus an expandable editor per student, eight manual unlock chips and
     the posture dial with the latest private note.
  3. **Asistencia** — student, calendar date, `normal` or `unplugged` mode,
     optional note. Upserts on `(studentId, date)`.
  4. **Últimas evaluaciones** — the four-axis history.
  5. **Respaldo blindado** — the Dexie-to-SQLite backup card (Phase 5), with the
     device/server status indicator and “Sincronizar respaldo”.
- `/mapa` is `force-dynamic` and passes `teacherMode={isTeacherAuthenticated()}`.
  When true, every curriculum tile grows a small book button that opens the
  “Guía Docente de Leo” drawer. Students never receive that affordance.
- `students.currentLevel` now means “unlocked through N”. The map's active tier
  is `max(unlockedLevel(localProgress), min(5, currentLevel))`, so a manual
  unlock is visible immediately without waiting for lessons. Tiers below that
  threshold are `available` (playable, marked “Abierto”) rather than `locked`,
  so a teacher unlock that skips tiers never hides the lower lessons.
- All mutations are Server Actions guarded by `isTeacherAuthenticated()`.
- Unauthenticated HTML must never contain student/evaluation data. If you change
  the page, verify this by fetching `/profesor` without cookies.

---

## Phase 1 scope

- [x] Project setup + strict TypeScript/Tailwind configs + security headers.
- [x] Full neumorphic design system.
- [x] Dexie offline cache/outbox + server sync.
- [x] Drizzle/SQLite schema, migration and seed.
- [x] App shell (header, student selector, streak, offline toggle, nav).
- [x] Mapa, Estudio (piano + lab), Juegos previews, Profesor dashboard.
- [x] PWA manifest, service worker, icons and OG metadata.

**Phase 2:** playable Melodía / Armonía / Ritmo games, scoring, spaced
repetition, richer teacher analytics, push reminders.

---

## Phase 2 — Sapphire acoustic engine & Estudio

- [x] `src/lib/audio-engine.ts`: hand-built polyphonic instrument — additive
      partials with a detuned twin, per-partial decay, velocity-sensitive
      low-pass filter, hammer-noise transient, ADSR + natural decay, sustain
      pedal, voice stealing, soft clip and a procedural convolution room.
- [x] Percussion: kick, snare, woodblock and metronome click, scheduled on the
      audio clock.
- [x] `src/lib/harmony.ts`: solfège/letters/degrees/clean naming, diatonic staff
      mapping, interval vocabulary, chord detection (triads → 9ths, inversions,
      slash chords, Roman numerals).
- [x] Harmonic visor: vector grand staff (G/F clefs, ledger lines, stems, ghost
      chord) plus a live FFT spectrum.
- [x] Hardware keybed: 1/2 octaves, fullscreen/theater, real multi-touch for
      3–4 note chords, velocity from touch position, QWERTY and Web MIDI.
- [x] Rhythm tab: sample-accurate 3/4 · 4/4 · 6/8 metronome and drum pads.
- [x] Lab migrated to the shared engine; Tone.js removed.

**Next:** graded ear-training games, scoring and spaced repetition.

---

## Phase 3 — Curriculum, games & group mode

- [x] `src/data/curriculum.ts`: 15 typed nodes (`cur-{branch}-{level}`) across
      three synchronized branches (Ritmo, Melodía, Armonía) × 5 levels, from
      Fundamentos to Dominio de Acordes con 7ma y Enlaces.
- [x] Every node carries the same four steps: 1) Sentir, 2) Escuchar,
      3) Comprender (interactive micro-lesson), 4) Reto Práctico, plus a
      discriminated drill (`rhythm` / `melody` / `harmony`).
- [x] `/mapa` renders the path as physical neumorphic nodes: `locked`,
      `active` (sapphire pulse) and `done` (gold stars). Level 1 is always open;
      level N unlocks when all three branches of N−1 are complete.
- [x] Games:
      - **Groove Pad Dual** — two large touch pads, 4-beat playhead, quarter /
        eighth / rest / syncopation patterns, judged “Perfecto (<35 ms)”,
        “Bueno (<80 ms)”, “Fuera de tiempo”.
      - **Cazador de Intervalos y Lectura** — direction, interval
        (2ª / 3ª / 5ª / octava) and timed staff reading.
      - **Arquitecto de Acordes** — triads, maj7/m7/dom7, Sus4/dim and the
        `I–V–vi–IV` progression.
- [x] “Modo Sin Luz” header switch: `#03060C` background and reduced ambient
      brightness; it also unlocks “Clase en Grupo”.
- [x] “Clase en Grupo (Pasa el Teléfono)”: 2–5 students rotate through Ritmo
      Táctil, Dictado Auditivo and Construcción de Acordes; activity is
      `(turnIndex + round) % 3`. Per-student XP is written to `xpLedger` with
      `source: "group"` and shown in the end-of-class ranking.
- [x] Progress and XP persist in Dexie (`curriculumProgress`, `xpLedger`).
      Replaying a node never lowers stars; full XP is granted only when the star
      result improves, otherwise 20%.

### Progression & XP rules

- `xpLedger` rows are the single source of truth for the profile XP pill.
- `recordCurriculumResult` adds full XP on a star upgrade and 20% on a replay.
- Games accept `drill`, `barsOverride` / `roundsOverride`, `compact`,
  `persist`, `finishLabel`, `xpNote` and `onFinish`. Solo mode persists; the
  lesson runner and group turns pass `persist={false}` and credit XP themselves,
  so `GameResultCard` shows `xpNote` instead of claiming the XP was saved.
- XP and curriculum rows live in Dexie as the offline-first store; the teacher
  “Sincronizar respaldo” action reconciles them into the server database, and
  “Descargar respaldo JSON” exports the authoritative server snapshot.

**Next:** repertoire mode (perform, record, share) and teacher-side curriculum
overrides.

---

## Phase 4 — Teacher desk, teleprompter & attendance

- [x] PIN default is now `1006` (server env `TEACHER_PIN` always wins).
- [x] `src/data/teacher-guide.ts`: 15 teleprompter entries keyed by curriculum
      node id. Each one carries:
      - a 60-second hook (everyday/psychological analogy + landing line),
      - a two-minute physical dynamic with voice and hands before the keyboard,
      - three error diagnostics (signal, what to watch, positive fix),
      - one mantra to repeat while the student plays.
- [x] `TeacherGuideSheet`: right-hand portal drawer, spring slide, Escape, Tab
      trap, focus restore and an `inert` map behind it. It is rendered only when
      the server passes `teacherMode`.
- [x] Live rubric: `RUBRIC_AXES` in `src/lib/academy.ts`; thick neumorphic
      `.rubric-range` sliders with per-axis CSS variables.
- [x] `StudentRadar`: hand-built SVG triangle (Melodía / Armonía / Ritmo) with
      a gradient fill and axis values. `compact` hides the labels on thumbnails.
- [x] Posture is the fourth axis and is shown as a separate circular dial, not a
      fourth radar vertex (the brief asks for a three-axis balance).
- [x] Student profile creator + editor: name, age, level, weekly goal and
      private teacher notes.
- [x] Manual unlock: `unlockCurriculumLevelAction` raises `currentLevel` and
      grants every level up to it (`unlocked_levels` + `lesson_progress`).
- [x] Attendance: `saveAttendanceAction` upserts `(studentId, date)` with
      `normal` / `unplugged` and optional notes.
- [x] Migration `drizzle/0001_sweet_cobalt_man.sql` adds `students.age`,
      `students.teacher_notes`, `teacher_evaluations.posture` and `attendance`.
- [x] Seed backfill: databases created before Phase 4 receive access codes and
      keep teacher-created rows; legacy prototype students are purged on boot.

**Next:** repertoire mode, practice reminders and multi-teacher support.

---

## Phase 5 — Hardened sync & installable PWA

- [x] `src/lib/backup.ts`: one Zod contract shared by browser and server —
      `BackupDump` (version, device id, students, lesson progress, skill scores,
      curriculum progress, XP ledger, pending practice sessions) plus hard row
      ceilings in `BACKUP_LIMITS`. Oversized or malformed dumps are rejected
      before any SQL runs.
- [x] `src/server/actions/sync.ts` — `syncBackupAction`:
      - requires a valid `leo_teacher` session (`UNAUTHORIZED` otherwise);
      - validates again with the same schema (`INVALID_BACKUP`);
      - writes everything inside one `db.transaction`;
      - inserts unknown students and merges only device-derived metrics for
        existing ones (`totalMinutes`, `weeklyMinutes`, `accuracy`, `streakDays`);
      - never overwrites teacher-owned `name`, `firstName`, `initials`,
        `avatarTone`, `currentLevel`, `age`, `teacherNotes` or `weeklyGoalMinutes`;
      - upserts `lesson_progress` by `(studentId, levelId)` with max semantics
        (status can only move forward);
      - upserts `curriculum_progress` by `(studentId, nodeId)` with max
        stars/accuracy;
      - gives every skill score and XP entry a SHA-1 stable id, so re-sending a
        dump is idempotent;
      - inserts practice sessions as `sess_${clientId}` with
        `onConflictDoNothing` and never double-counts their minutes.
- [x] Dexie helpers in `src/lib/local-db.ts`: `readBackupDump`,
      `readBackupStats`, `markBackupSynced`, `readBackupStamp`,
      `writeBackupStamp`. The newest rows survive when a table exceeds its
      ceiling. `markBackupSynced` flags every cached row and clears the pending
      practice outbox, because those sessions are already in the accepted dump.
- [x] Provider: `backupState` (`device | syncing | synced | error`),
      `backupStats`, `lastBackupAt` (localStorage key `leo.lastBackupAt`) and
      `backupToServer()`. A new local mutation makes `dirtyRows > 0` and the UI
      falls back to “100% Guardado en Dispositivo”.
- [x] `BackupPanel` — section **05 · Respaldo blindado** in `/profesor`, with
      the required status copy, live row/pending counters, last backup stamp and
      a guarded “Sincronizar respaldo” button (disabled in Modo Sin Luz).
- [x] Migration `drizzle/0002_moaning_big_bertha.sql` adds
      `curriculum_progress` and `xp_ledger`.
- [x] PWA: manifest uses `/logo.jpg` (1024×1024) and `/logo-512.jpg`, keeps the
      PNG/maskable icons, `display: "standalone"`, `orientation: "portrait"`,
      theme/background `#050B14`. Root layout adds `maximum-scale=1`,
      `user-scalable=no`, `viewport-fit=cover` and
      `apple-mobile-web-app-capable`. Service-worker cache is `leo-academy-v3`.
- [x] Animation audit: the active-curriculum “breathe” no longer animates
      `box-shadow`; it is an `::after` overlay that only changes `opacity`.
      Running map animations now touch only `transform`/`opacity`.

**Next:** repertoire mode, practice reminders and multi-teacher support.

---

## QA notes & gotchas

- **Smooth scrolling:** `html { scroll-behavior: smooth }` means automated
  `scrollIntoView` must use `behavior: "instant"` before clicking; otherwise a
  click can land on the floating nav.
- **Hydration:** SVG coordinates derived from `Math.sin/cos` must be rounded
  (`round3` in `lab-studio.tsx`). Raw floating-point serialization differs
  between server and client and causes a hydration mismatch.
- **`server-only` + drizzle-kit:** always use `npm run db:generate`.
- **Audio engine:** one lazy `AudioEngine` singleton via `getAudioEngine()`.
  Always go through `useAudioEngine()` so the keyboard, lab and rhythm lab share
  one AudioContext; never create a second context. The first gesture calls
  `unlock()`, and tab changes release voices so nothing keeps ringing.
- **Audio facade identity:** the object returned by `useAudioEngine()` is
  memoized on `ready`/`analyser`, so it changes identity right after the first
  `unlock()`. Never key an unmount cleanup or a timer on `[audio]`: doing so
  cancels the work you just scheduled (this stalled the Groove Pad at bar 1 on
  a cold start). Capture the facade in a ref and use a stable dependency list.
- **Lesson overlay:** `LessonRunner` portals into `document.body`. `<main>` is
  `relative z-10`, which is a stacking context, so a `fixed z-[70]` sheet nested
  inside it painted *below* the `z-40` header and bottom nav and the sheet’s own
  close button was unreachable. Keep the portal, and keep the Tab trap,
  Escape-to-close, `inert` background and focus restore in sync.
- **Press states in tests:** CSS `uppercase` changes what `innerText` reports,
  so assert on `textContent`. Scope clicks to `.lesson-sheet` — the map nodes
  behind the dialog also match these labels.
- **Multi-touch:** `PianoKeyboard` tracks pointer ids and releases every voice
  on `pointerup`, `pointercancel`, window blur and visibility change, so chords
  never leave a stuck note.
- **Web MIDI:** `useMidiInput` waits for the first gesture, then wires every
  input and hot-plugged device, including sustain (CC64) and all-notes-off. On
  unsupported browsers the chip stays quiet instead of prompting.
- **Visor gradients:** SVG gradients painted on zero-height horizontal lines
  must use `gradientUnits="userSpaceOnUse"`; the default object bounding box is
  degenerate and hides the staff.
- **Dev PIN:** `1006` by default outside production (or `TEACHER_PIN` in
  `.env.local`). Change it before deploying.
- **Phone-number dates:** `formatShortDate` appends `T12:00:00` to plain
  `YYYY-MM-DD` values. Parsing them as UTC midnight showed the previous day in
  western timezones (attendance listed the 29th as the 28th).
- **`innerText` + uppercase:** `.eyebrow` and several labels use CSS
  `text-transform: uppercase`, which changes what `innerText` returns during
  automated QA. Compare lowercased text or use `textContent`.
- **Guide drawer stacking:** `TeacherGuideSheet` also portals to `document.body`
  for the same `<main class="relative z-10">` reason as the lesson sheet.
- **Build warning:** Turbopack may warn about dynamic filesystem access in
  `src/server/db/client.ts`; it is expected for a runtime SQLite path.
- **PWA:** `public/sw.js` is registered in production. Bump its cache name when
  shipping breaking asset changes. `/profesor` HTML is deliberately excluded
  from precache and navigation caching so private academy data never outlives
  the httpOnly teacher session on disk; offline it falls back to `/mapa`.
- **Backup + migrations:** `getDb()` applies `drizzle/` lazily. After generating
  a migration, restart `next dev` (or trigger a DB-backed page) before testing;
  a stale dev bundle can keep serving the old schema and the new tables will not
  exist yet. `syncBackupAction` is teacher-guarded on purpose — the backup panel
  lives behind the PIN.
- **Backup idempotency:** skill scores and XP rows use SHA-1 ids derived from
  their content. Two backups with the same device rows must not grow those
  tables; verify counts stay stable. Practice sessions use
  `sess_${clientId}` and are never inserted twice.
- **Backup status semantics:** “Sincronizado con Servidor” requires a stored
  `leo.lastBackupAt` stamp *and* zero dirty rows. Any new local lesson, game or
  XP write flips the card back to “100% Guardado en Dispositivo” until the next
  successful backup.
- **PWA zoom lock:** the viewport is intentionally non-scalable
  (`maximum-scale=1`, `user-scalable=no`) to feel native. Do not remove it
  without checking accessibility on iOS and Android.
- **Active-node glow:** keep `.curriculum-node--active::after` on `opacity`
  only. Animating `box-shadow` on fifteen nodes is a paint-heavy path and drops
  frames on low-end phones.
