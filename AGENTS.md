# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a single-page Angular 20 app ("MBOM Viewer") using AG Grid to display manufacturing parts data. There is no backend — data comes from a static `public/mock.json` file served by the Angular dev server.

### Services

| Service | Command | Port |
|---------|---------|------|
| Angular dev server | `npm start` | 4200 |

### Running

- **Dev server:** `npm start` (alias for `ng serve`), serves at `http://localhost:4200/`
- **Build (dev):** `npx ng build --configuration development` — production build fails due to AG Grid exceeding the default bundle size budget; use development configuration for builds.
- **Tests:** `CHROME_BIN=$(which google-chrome) npx ng test --no-watch --browsers=ChromeHeadless` — the test infrastructure (Karma + ChromeHeadless) works, but the existing `app.spec.ts` has pre-existing failures due to missing `HttpClient` provider in the test setup.

### Gotchas

- The production build (`ng build`) fails with a budget error because AG Grid pushes the initial bundle past the 1 MB limit. Always use `--configuration development` for local builds.
- No lint script is configured in `package.json`. There is no ESLint setup in this project.
- Prettier config is embedded in `package.json` but no `lint` or `format` npm script exists.
