# Implementation notes — Seismology Lab

Developer-facing architecture notes for `seismology-lab`.

## Architecture

Screens: src/regional/, src/global/

- Models own state and `step` / `reset`; views observe Properties and never integrate physics.
- Colors live in `src/SeismologyLabColors.ts`; strings in `src/i18n/` via `StringManager`.
- Preferences shell: `src/preferences/` (empty until sim-specific prefs are added).

## Notes

*Record design decisions, performance constraints, and known limitations here.*
