# Focus Forest

A calm, local-first focus timer. Complete a session to plant a permanent pine, birch, or maple in your dawn forest.

**Use it:** https://gracebilliris.github.io/focus-forest/

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:5192. `npm run build` creates the static site in `dist`; `npm run preview` serves that build on the same port.

## Your rhythm

- Choose whole-minute focus and break durations from 1–180, a tree species, and an optional session label.
- Start, pause, resume, or cancel. An incomplete session adds no time or trees.
- Your tree grows with the completed fraction. A successful focus session records its minutes and plants exactly one permanent tree. Breaks begin manually and do not plant additional trees.
- Try the explicitly marked **10-second demo**. It plants a demo tree and records only ten seconds (0.17 minutes displayed), never a fictitious full focus session.
- View today's local-date totals, all-time totals, and complete session history. Demo sessions are marked in history and included in totals.
- Enable an optional gentle completion chime and reduced motion. System reduced-motion preferences are also honored.
- Export completed history as JSON. Reset requires confirmation and deletes completed history, not the current timer or settings.

## Persistence and limitations

No accounts, analytics, external assets, APIs, or remote storage. Data stays in this browser's local storage on this device and origin. Clearing browser data removes it; use export for a backup. Storage failure is reported visibly. Export does not include an active timer; there is no import.

Running sessions use absolute wall-clock deadlines, not interval counts. Reloads and background tabs catch up and finalize an expired focus session once. Paused sessions retain their remaining time. Changing the system clock can affect elapsed time. The display refresh interval is not the timer's source of truth.

No browser-closed notifications are requested or promised: completion is reconciled when the app is open again. Background audio can be suspended by the browser. The optional chime requires enabling sound and a user gesture in the current page; after a reload it may remain silent until another gesture. Chimes are never guaranteed.

Use one active tab for timer controls; other tabs synchronize saved changes but simultaneous writes are not transactionally locked. A forest displays the latest 18 trees; every completed session remains in history and totals. No time-on-task or attention monitoring is performed.

## Deploy

The public repository uses GitHub Pages with **GitHub Actions** as the Pages source. `.github/workflows/deploy.yml` runs Node 22, `npm ci`, unit tests, and the production build before publishing `dist`. Vite's `base: './'` makes assets work under `/focus-forest/`.

Push to `main` or run **Deploy Focus Forest** manually. The workflow requires `contents: read`, `pages: write`, and `id-token: write`; no repository secrets are required.
