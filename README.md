# Leo Academy

A mobile-first PWA for an elite piano and music-theory academy. Built around an
offline-first practice loop: play, log the session, keep the streak — even
without a connection.

> **Phase 1 – 5** — foundations, design system, offline cache, SQLite backend,
> the full app shell, the Sapphire acoustic studio (visor, multi-touch keybed,
> Web MIDI, rhythm lab), the graded curriculum (15 lesson nodes, three
> ear-training games, “Clase en Grupo”), the teacher's desk (Guía Docente de Leo
> teleprompter, live four-axis rubric, manual unlocks, attendance) and a
> hardened Dexie → SQLite backup with an installable standalone PWA.

## Highlights

- **Sapphire Tactile Neumorphism** — a custom mineral-dark design system built
  from the academy's brushed-sapphire logo.
- **A real instrument** — a hand-built polyphonic Web Audio engine with
  additive partials, velocity-sensitive filters, hammer noise, sustain and a
  procedural room. Rhodes, grand piano and glass presets, no samples.
- **Harmonic visor** — vector grand staff with live noteheads, chord/interval
  detection and an FFT spectrum, all in a sunken neumorphic display.
- **Hardware keybed** — 1 or 2 octaves, fullscreen landscape mode, true
  multi-touch chords, four naming systems and automatic USB-OTG MIDI.
- **Rhythm lab** — 3/4 · 4/4 · 6/8 metronome plus kick, snare, woodblock and
  click pads scheduled on the audio clock.
- **Harmony lab** — interactive circle of fifths with playable triads.
- **Curriculum path** — three synchronized branches (Ritmo, Melodía, Armonía) ×
  five levels. Every level runs the same four steps — Sentir, Escuchar,
  Comprender, Reto — and unlocks the next tier only when all three branches are
  sealed.
- **Three ear-training games** — Groove Pad Dual (sub-35 ms timing judge),
  Cazador de Intervalos y Lectura (timed staff reading) and Arquitecto de
  Acordes (triads → sevenths → `I–V–vi–IV`).
- **Clase en Grupo** — “pasa el teléfono” rotation for 2–5 students in Modo Sin
  Luz, with per-student XP and an end-of-class ranking.
- **Offline-first** — Dexie caches the academy locally and queues mutations in
  an outbox; server actions replay them when the connection returns.
- **Blindado backup** — the teacher panel can promote the whole device cache to
  SQLite in one Zod-validated transaction. Stable ids make repeated backups
  idempotent, and the card shows “100% Guardado en Dispositivo” vs
  “Sincronizado con Servidor”.
- **Teacher's desk** — PIN-protected (server-verified) dashboard with a live
  four-axis rubric (ritmo, melodía, armonía, postura), manual level unlocks,
  private student profiles and attendance, including “Clase en Modo Sin Luz”.
- **Guía Docente de Leo** — a teacher-only slide-out teleprompter on every map
  lesson: a 60-second hook, a two-minute physical dynamic before the keyboard
  and an error diagnosis for wrist, fingering and muscular tension.
- **Student radar** — a hand-built SVG triangle comparing each student's
  melodic, harmonic and rhythmic balance, with posture on a separate dial.
- **PWA** — installable, standalone, portrait-locked, fullscreen on Android and
  iOS, with an offline service worker and app icons generated from `/logo.jpg`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion ·
Web Audio API · Dexie · Drizzle ORM · LibSQL (Turso / local SQLite) · Zod.

## Quickstart

```bash
npm install
cp .env.example .env.local   # optionally set DATABASE_URL + PROFESSOR_PIN
npm run dev                  # http://localhost:3000
```

With no environment variables the app creates, migrates and seeds a local LibSQL
database at `./.data/leo-academy.db` on first use. Set `DATABASE_URL=libsql://…`
plus `DATABASE_AUTH_TOKEN` to point the same code at a free Turso database.
Only the curriculum reference rows are seeded — every student, grade and
practice session comes from real use. The teacher PIN is read from the server
environment (`TEACHER_PIN` / `PROFESSOR_PIN`) and never published in the UI.

### Scripts

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Development server                       |
| `npm run build`     | Production build                         |
| `npm run start`     | Serve the production build               |
| `npm run typecheck` | TypeScript check                         |
| `npm run db:generate` | Generate a Drizzle migration           |
| `npm run db:studio` | Open Drizzle Studio                      |
| `npm run icons`     | Regenerate PWA icons from the source art |

## Security model

- The database layer (Drizzle + `@libsql/client`) is **server-only**
  (`src/server/db/`, guarded by `import "server-only"`).
- The browser talks to the academy **only through Server Actions**.
- No database secret is ever exposed with `NEXT_PUBLIC_`.
- The teacher PIN is verified server-side; the session is an HMAC-signed,
  `httpOnly` cookie. Attempts are rate-limited.
- The teacher can export the full server database as JSON; PIN hashes and other
  secrets are never included.

## Project structure

```
src/app        routes, PWA manifest, global design system
src/components shell, curriculum, games, studio, teacher, providers, UI
src/data       curriculum tree: branches, levels, steps and drills
src/lib        domain types, Dexie cache, audio engine, harmony, hooks
src/server     server actions, auth, Drizzle schema/client/seed, queries
drizzle        generated SQL migrations
```

## Docs

See [`CLAUDE.md`](./CLAUDE.md) for the architecture contract, data model,
design tokens, environment variables and QA notes.

## Roadmap

- **Phase 1** — foundations + shell (done).
- **Phase 2** — acoustic engine, harmonic visor, multi-touch keybed, Web MIDI,
  rhythm lab (done).
- **Phase 3** — curriculum tree, graded ear-training games, scoring, group
  mode and Modo Sin Luz (done).
- **Phase 4** — teacher access, “Guía Docente de Leo” teleprompter, live rubric,
  manual unlocks, attendance and student radar (done).
- **Phase 5** — hardened local-to-server backup (`syncBackupAction`), teacher
  “Sincronizar respaldo” card and installable portrait-locked PWA (done).
- **Phase 6** — repertoire mode, practice reminders, multi-teacher support.
