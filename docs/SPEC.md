# Orbit: Study Planner and Pomodoro (Desktop App)

A personal, local-only desktop app. Elegant, simple, modern. The planner and the Pomodoro timer feed each other: plan, do, rate, and the plan adjusts.

## 1. Stack

- Electron + React + TypeScript + Vite + Tailwind CSS
- **TypeScript is pinned to `~6.0.x`. Do NOT upgrade to TypeScript 7** (typescript-eslint does not support it yet and `npm install` will fail).
- ESLint (already configured by the Vite template)
- FullCalendar (`timeGrid` for week/day, `dayGrid` for month, plus the interaction plugin)
- Zustand for state
- Vitest for tests of the logic layer
- Persistence: JSON file in Electron's `userData` folder
- Target OS: Ubuntu 22.04 (packaging later with electron-builder: AppImage and/or .deb)

The project already exists (created with `npm create vite@latest orbit -- --template react-ts`). Add Electron on top of it; do not recreate the project.

## 2. Design

Minimal, modern, soft. Nothing cluttered.

- Rounded buttons (`rounded-xl` or more), generous spacing, subtle shadows
- 150 to 200 ms transitions; hover and press feedback on every button
- Light and dark theme
- One clean sans-serif font
- Sidebar navigation with three tabs: **Home**, **Calendar**, **Pomodoro**
- Tab changes animate gently

## 3. Architecture rules

- All business rules live in **pure functions under `src/logic/`**, each with Vitest tests.
- Components never contain rules inline; they call the logic functions.
- All tunable numbers live in `src/logic/config.ts`.
- Persistence is behind a `Storage` interface (see section 12).

## 4. Config constants (`src/logic/config.ts`)

```ts
export const STEP = 5                 // all planned/generated durations round to 5 min
export const MIN_DURATION = 10        // minimum planned/generated duration (min)
export const PASS_RATING = 7          // rating >= 7 is "productive"
export const PENALTY_PCT = { 1: 1.0, 2: 0.8, 3: 0.6, 4: 0.4, 5: 0.2, 6: 0.1 } // 7-10: none
export const GAP_MAX_FRACTION = 0.25  // make-up must be <= 25% of the gap size
export const END_OF_DAY_BUFFER_MIN = 15
export const DAY_END = '24:00'        // midnight is the cutoff
export const AFTERNOON_WINDOW = { start: '12:00', end: '18:00' }
```

## 5. Data model

```ts
type Subject = { id: string; name: string; color: string; archived: boolean }

type Block = {
  id: string
  subjectId: string
  title: string                       // editable, shown centered in the block
  start: string                       // ISO
  end: string                         // ISO
  kind: 'planned' | 'makeup'
  makeupSourceSessionIds?: string[]   // for stacked make-up blocks
  manual?: boolean                    // created via the unlock override
}

type Session = {                      // one completed Pomodoro
  id: string
  blockId: string
  subjectId: string
  title: string
  start: string                       // actual, NOT rounded
  end: string                         // actual, NOT rounded
  focusMinutes: number
  breakMinutes: number
  rating: number                      // 1-10
  manual: boolean                     // true if logged via the unlock override
}

type TimerState = {
  status: 'idle' | 'running' | 'paused'
  blockId: string | null
  preset: { focus: number; break: number }
  phase: 'focus' | 'break'
  endTimestamp?: number               // while running
  remainingMs?: number                // while paused
}

type Settings = {
  dayStart: string                    // e.g. "08:00"
  dailyTargetMinutes: number
  presets: { focus: number; break: number }[]   // 25/5, 50/10, 90/15
  defaultPreset: number
}

type AppData = {
  schemaVersion: 1
  subjects: Subject[]
  blocks: Block[]
  sessions: Session[]
  settings: Settings
  timer: TimerState
}
```

## 6. Rounding (one helper, used everywhere)

```ts
roundDuration(min) = min <= 0 ? 0 : Math.max(MIN_DURATION, Math.round(min / STEP) * STEP)
```

Examples: 4 -> 10, 7 -> 10, 12.67 -> 15, 22 -> 20, 23 -> 25.

- Applies to every **planned or generated** duration: blocks, make-up blocks, Pomodoro chunks.
- Does **not** apply to logged sessions: actual start/end times are stored exactly as they happened so stats stay honest.
- Calendar: `snapDuration: '00:05:00'`; minimum block length 10 min, enforced in `selectAllow` and on resize.
- Generated block start times snap to a 5-minute boundary (e.g. 10:07 becomes 10:10).

## 7. Editing rules (the "no editing the past" rule)

Everything goes through one function: **`isEditable(time, now, unlocked)`**. It returns false for any time before `now` unless `unlocked` is true.

- A block fully in the past is read-only (no move, resize, delete, or subject change).
- A block straddling `now`: its start is locked. You can still change its **end** (new end must be after `now`) and its **title**.
- Future blocks are fully editable (drag, resize, retitle, change subject, delete).
- **Unlock override:** a toggle in the Calendar header with a confirmation dialog. While on, past edits are allowed and you can log a manual session (`manual: true`). Anything created through it shows a small **"manual"** badge.

## 8. Calendar tab

- Default view: **week**. Switchable to **day** and **month**.
- Dates across the top, times down the left side.
- In day and week views: **drag to create** a block, drag to move, resize from the edges.
- Click a block to open a popover: edit title, change subject, delete.
- Block title is centered in the block and editable.
- Block colour comes from its subject. Archived subjects keep their colour and name on existing blocks.
- Make-up blocks use the subject colour plus a small "make-up" tag.
- Productive sessions draw a **completed overlay** (see section 11).

## 9. Home tab

- **Subject manager:** add, rename, recolour, archive. Archived subjects cannot be picked for new blocks. Deleting means archiving (existing blocks are unaffected).
- **Legend box:** small box listing subjects with their colours.
- **Stat cards:** study hours today / this week / this month (from completed sessions), planned vs. actual comparison, study score, afternoon efficiency.

## 10. Pomodoro tab

Shows only: an elegant timer, the current task (title + subject colour), and Pause / Resume.

- Presets: 25/5, 50/10, 90/15. Default 25/5. A preset selector is available.
- **Starts paused** by default.
- Current task = the block covering `now`, or the next upcoming block if none.
- **Sizing:** use the preset, but cap focus to the time left in the current block. A 10-minute block gets a 10-minute focus session with no break. Chunks are rounded with `roundDuration`; if the leftover chunk would be under 10 minutes, fold it into the previous chunk (a 15-minute block is one 15-minute Pomodoro, never 10 + 5).
- **Timer implementation:** never use `setInterval` as the source of truth.
  - Running: store `endTimestamp`. Paused: store `remainingMs`.
  - Remaining time is always computed from `Date.now()`. A UI tick only triggers re-render.
  - Keeps running across tab switches, sleep, and app restarts (timer state is persisted).
- On completion: play a sound and show a desktop notification, then show the **rating prompt (1 to 10)**.
- After the rating is submitted, save the Session, then load the next Pomodoro of the block (paused).

## 11. Feedback loop after a rating

**Rating 7 to 10 (productive):**
- No make-up time.
- Draw a **celebration overlay** over exactly that session's time range inside the block: distinct celebratory colour (not in the subject palette), label "Completed! 🎉". Do not split the block; overlays are rendered from Session records.

**Rating 1 to 6:** create or stack make-up time.

```
raw    = focusMinutes * PENALTY_PCT[rating]
makeup = roundDuration(raw)
```

Make-up block rules:
1. Find or create a make-up block (`kind: 'makeup'`) for the **same subject and same title** on that day. Stack into it and record the session ID.
2. **Stacking:** sum the raw minutes first, then call `roundDuration` once on the total (never round each session separately).
3. **Placement:**
   - Look at free gaps **after the source block and after `now`**. Never place into the past.
   - Take the first gap where `makeup <= GAP_MAX_FRACTION * gapSize` (gap size measured **before** the make-up was placed: the make-up block plus the free space around it, so it does not fail its own check after placement). Place it at the start of that gap, snapped to 5 minutes.
   - Example: a 60-min gap fits up to 15 min; a 120-min gap fits up to 30 min; a gap under 40 min fits nothing.
   - If no gap fits: place after the last block of the day plus `END_OF_DAY_BUFFER_MIN`, snapped to 5 minutes.
4. If stacking makes a gap-placed block exceed 25% of its gap, move the whole block to the end of the day (with the 15-minute buffer).
5. If placement would pass 24:00, roll to **tomorrow at `dayStart`**, in the first free slot.

## 12. Storage (local only)

- `Storage` interface: `load()` and `save(data)`. The JSON file is the only implementation now; cloud sync could replace it later.
- **Safe writes:** write to a temp file, then rename over the real one.
- **Automatic backups:** keep the last 7 daily snapshots in a `backups/` folder. Settings has Export and Import buttons.
- **`schemaVersion`** is stored in the file; migrations upgrade old data.
- Timer state is saved in the same file.
- Data location: Electron `app.getPath('userData')`.

## 13. Stats and score

Stats are based on **completed sessions (actual time)**. Show today, this week, this month, plus planned vs. actual.

Single file `src/logic/score.ts`, weights as constants at the top:

```
score = 100 * (0.5 * avgRating/10 + 0.3 * min(1, completed/planned) + 0.2 * min(1, focusMin/dailyTarget))
```

`getScore(sessions, blocks, window?)` takes an optional time window; "afternoon efficiency" is the same function with 12:00 to 18:00.

## 14. Debug helpers (development only)

- "Reset today" button that clears today's blocks and sessions, for testing make-up logic repeatedly.

## 15. Required tests (Vitest)

- `roundDuration`: inputs 4, 7, 12.67, 22, 23
- Make-up for ratings 5 and 6 on 25, 50, and 90-minute sessions (never increases as rating improves)
- Three stacked sessions round once, not individually
- A 15-minute block produces a single Pomodoro; a 10-minute block gets a 10-minute focus with no break
- Gap placement: 40-min gap fits 10 but not 15; 60-min gap fits 15 but not 20; 120-min gap fits 30
- A gap-placed block that grows past 25% relocates to end of day
- No placement before `now`
- Midnight rollover to tomorrow at `dayStart`
- `isEditable` and a block straddling `now`
- Score function including the afternoon window
