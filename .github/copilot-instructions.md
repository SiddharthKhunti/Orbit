Read docs/SPEC.md before any task.
Keep business logic in pure functions under src/logic/ with unit tests. Never put rules inline in components.
All tunable numbers live in src/logic/config.ts.
Keep TypeScript pinned to ~6.0.x. Do not upgrade to TypeScript 7 or run `npm audit fix --force`.
The project already exists as a Vite + React + TypeScript app; add to it, do not recreate it.
Target OS is Ubuntu 22.04.
