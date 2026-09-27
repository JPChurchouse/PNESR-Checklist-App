# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: dev server at http://localhost:5173
- `npm test`: Vitest, run once. Test files have their own `tsconfig.test.json` (Node types allowed there, not in app code) (`npm run test:watch` to watch; `npx vitest run src/domain/sets.test.ts` for one file, `-t "<name>"` for one test)
- `npm run typecheck` / `npm run lint` (oxlint) / `npm run build`; `npm run preview` serves the build (the service worker only runs there, not in dev)
- `PDF_PREVIEW=<dir> npx vitest run src/pdf`: writes sample PDFs into `<dir>` to look at the layout
- `npm run images`: regenerate `public/fleet/*.webp` and `public/brand/*` from the originals in `fleet-images/` and `brand-images/`. Run it after adding or replacing a photo.

The full requirements are in `prompt.md`. All planned phases are done: fleet admin, safety check, ticket sheets, staff list, and phase 4 (offline/PWA, backup and restore, practice mode, sharing PDFs, printable blank forms, season stats, GitHub Pages workflow).

## Architecture

React 19 + TypeScript + Vite, with `createHashRouter` and `base: './'` so the build runs from any static folder.

- `src/domain/`: pure types and rules with no React or storage code (`types.ts`, `seed.ts` default fleet, `sets.ts` set validation). Money/ticket logic belongs here too, with tests.
- `src/storage/`: `repository.ts` is the only interface the UI uses. `DexieRepository` (IndexedDB) seeds the fleet on first open. A future Raspberry Pi backend would be another `Repository` implementation passed in from `main.tsx`. Screens use `useRepository()` / `useFleet()` from `hooks.ts`. `StorageRuleError` messages are shown to the user.
- `src/domain/safetyCheck.ts`: check definitions, `buildChecklist()` (which checks apply to the day's trains), progress and sign-off rules. Results are keyed `"<vehicleId|track>:<itemId>"`. A check stores snapshots of the vehicles, so fleet edits never alter a completed record, and it becomes read-only once `completedAt` is set.
- `src/domain/revisions.ts`: safety checks and ticket sheets are corrected by adding a new revision (`amendsId` → the one it replaces, `revision` number, `amendmentReason`), never by editing a signed-off record. `currentRecords()` hides superseded ones.
- `src/domain/tickets.ts` + `money.ts`: ticket sheets (`kind` regular or special `event`, which uses `eventTicketTypes`). A sheet is filled in two sittings: the start of the shift is saved (`startSavedAt`) before the end-of-shift part opens. The float is ticked per denomination (`FloatCheckEntry`); anything unticked needs a note. Sign-off takes the shift manager's name and signature. Also EFTPOS (any two of takings/surcharge/total charged; the third is derived), and `reconcile()`. Money is integer cents throughout. Sheets snapshot ticket types/prices/float from settings (`getTicketSettings()`, editable at `/settings/tickets`) when started.
- All displayed dates and times are ISO style in local time (`2026-09-28`, `17:48`, `2026-09-28 17:48`). Use `src/lib/dates.ts`, never `toLocale*String`.
- Number inputs (`src/ui/inputs.tsx`) keep the typed text and store `null` while it's invalid, so NaN never reaches storage.
- `src/pdf/`: jsPDF + jspdf-autotable. Build docs with `createDoc()`, which passes all text through `pdfSafe()`: the built-in fonts only cover Windows-1252, so macrons become plain vowels, `−` becomes `-` and `→` becomes `->`. The user prefers small PDFs to embedding a font. Tests search the raw PDF bytes (`compress: false`) and must unescape `\(`/`\)`. It's loaded with `import()` only when a PDF is made, to keep the main bundle small. In dev, Vite reloads the page the first time that chunk loads.
- `SafetyCheckPage` saves on every change. `update()` takes a function and builds on a `latest` ref, because building from the render's copy lost rapid taps.
- `src/pages/fleet/`: `FleetLayout` loads the fleet once and passes it down via outlet context (`useFleetData()`).
- Vehicles have an internal `id` separate from the user-facing `code`, so an ID can be renamed without breaking set references. Liveries are their own records, referenced by `liveryId`.
- A `Photo` is either a path under `public/` or a `data:` URL from an in-app upload (resized to 960px). Keep it JSON-serialisable.
- Use `newId()` (`src/lib/ids.ts`), not `crypto.randomUUID()`, which doesn't exist on plain-HTTP LAN hosts.
- Styling is plain CSS in `src/index.css` with tokens on `:root` (light/dark). Fern green is the UI colour; brand red is only an accent, so it's never confused with a failed/error state.

## What the app is

A web app replacing two paper forms for a miniature ride-on railway (PNESR):

1. **Pre-operation safety check**: track checks, then per-locomotive and per-carriage checks for the trains running that day. Exported as a PDF with completion date/time and the shift manager's name/signature.
2. **Ticket sales sheet**: one per station (Victoria and Playground), each exported as a **separate PDF**. Records ticket serial numbers, float, cash/EFTPOS takings and donations, and reconciles tickets sold against money taken.

## Hosting

Decided for now: device-only (IndexedDB on each phone/tablet). A Raspberry Pi server on the club Wi-Fi may come later, so keep all persistence behind the `Repository` interface; don't let UI code talk to IndexedDB or an HTTP API directly.

## Domain rules that shape the design

- **Reference data must be editable, not hard-coded**: locomotive and carriage liveries, carriage set names and set composition are all expected to change. Locos also carry an in-service status, free-text notes and a reference photo; carriages have a photo too.
- **Carriage roles**: each carriage has a specialty (Driver, Guard, Wheelchair, Crew Only, or none). Crew Only (carriage `A`, retired from passenger service) stays in the fleet list but is excluded from carriage sets and safety checks. A carriage set is ordered: a Driver carriage first, a Guard carriage last, and 0 to 4 standard carriages between them (2 to 6 total). Validate this.
- **Checks depend on role**: every carriage gets the base checks. Driver carriages add a fire extinguisher check. Guard carriages add extinguisher, tail lights, signal button and first aid kit checks. Wheelchair carriages add "removable seats installed correctly" and "wheelchair tie-down straps present and working" (its door check is the same as the others). 1 to 3 trains run at once.
- **Ticket counting**: tickets sold = end serial − start serial, per ticket type per station. The end serial is the first unsold ticket left on the roll (tomorrow's first ticket), so no +1. The four types are One-way $2, Return $3, Supporter $0 and Concession $20. Each station uses different ticket colours for the same types, so colour is per station.
- **Float**: counted by denomination both before the shift and after the reset ($250: $1×30, $2×40, $5×12, $10×8). Show a clear "good to go" or "issue" indicator, naming the denominations that don't match.
- **Reconciliation**: takings (cash left after the float reset) are counted by NZ denomination ($0.10 to $100). EFTPOS surcharge is recorded but **excluded** from calculations. For EFTPOS the user enters any two of takings, total charged and surcharge (total charged = takings + surcharge) and the app derives the third, because the machine's receipt labelling is unclear. Cash and EFTPOS donations have to be accounted for. The PDF must state explicitly whether takings match ticket value and, if not, which direction the discrepancy goes.
- An EFTPOS receipt photo is attached when available (optional).

## Known inconsistencies in the spec

- The user has no spell checker, so `prompt.md` has typos ("Locmotives", "Speacialty", "Burgandy", "wether", "maintainance", "discrepincy", "seperate", "ammount"). Use the correct spellings in code and UI, and write "KiwiRail" rather than "Kiwirail".

## Phase 4 pieces

- **Practice mode** (`src/lib/mode.ts`, `useMode()`): a separate IndexedDB (`pnesr-practice`) chosen at startup in `main.tsx`, seeded with `generateStaff()`. `generateSampleSeason()` (`src/domain/practiceData.ts`) makes seeded, realistic records. Practice PDFs are marked via `createDoc({ practice })`. Use practice mode (or another origin) for browser testing, never the live database: it may hold real staff details.
- **Backup** (`src/domain/backup.ts`, `Repository.exportAll/restoreAll`): one JSON file of everything. Bump `version` and handle old files in `parseBackup` if the shape changes.
- **Sharing** (`src/lib/files.ts`, `ui/PdfActions.tsx`): Web Share with the file, falling back to download plus `mailto:`.
- **Blank forms** (`src/pdf/blankForms.ts`): built from the same checklist and ticket settings, so they follow config changes.
- **Stats** (`src/domain/stats.ts`, `pages/stats/`): signed-off, latest-revision records only; a current year is compared with last year up to the same date. Charts are hand-made SVG following the dataviz rules: validated colours `--viz-accent` / `--viz-context`, tooltips, table view.
- **PWA**: `vite-plugin-pwa` with `registerType: 'prompt'` (`ui/AppUpdates.tsx` shows the update toast and install prompt).

## Staff data

`src/domain/staff.ts` imports the club's Google Sheets CSV export (Staff page). Columns are matched by heading: Name, Surname, Mobile, Land Line, DOS (= qualified manager; old name), Cashier, Guard, Driver, Class A (locos they may drive with passengers), Roster Entry (display name, e.g. "Jamie C (CD)"). Drivers are always guards too. Addresses, emails, DOB etc. are ignored. Phone numbers are kept on purpose, for a future rostering link and mass texts. Staff pickers suggest names, but free text is always allowed, and qualification problems are warnings, not blockers.

`staff-list*.csv` is gitignored because it holds real personal details. Test fixtures use made-up people.

## Assets

`fleet-images/` (`loco-<id>.jpg`, `car-<id>.jpg`, about 3 MB each) and `brand-images/` are local originals and stay out of git. The resized copies in `public/fleet` and `public/brand` (about 1.9 MB) are committed and ship with the app; after replacing an original, run `npm run images` and commit the result. The code still copes with a missing photo (placeholder) or logo.
