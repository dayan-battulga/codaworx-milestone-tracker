# CODAworx clone and milestone demo

This is an editable remake of the [reference homepage](https://codaworx-engineer.vercel.app/index.html), with an interactive post-award tracker at `/tracker.html`. The [source repository](https://github.com/dayan-battulga/codaworx-milestone-tracker) is public. The [live demo](https://codaworx-gallery-remake-2026.fluffyrice14.chatgpt.site/tracker.html) opens without a login.

## Run it locally

Install Node.js 22.13 or newer, then:

```sh
git clone https://github.com/dayan-battulga/codaworx-milestone-tracker.git
cd codaworx-milestone-tracker
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`. The gallery is at `/index.html` and the tracker is at `/tracker.html`. For a simple static preview of the demo, `python3 -m http.server 8000 -d public` also works after `npm run sync:home`.

## Try the tracker

The demo starts with two sample commissions. In **Commissioner** view, open Riverfront Light Sculpture to approve or request a revision of the first submission. Switch to **Artist** view to accept or request changes to the Community Garden Mural plan. You can also create plans, submit notes and files, put work on hold, record payment status, download CSV, and print a report. See the [walkthrough](docs/milestone-walkthrough.md).

The role switch simulates both people in one browser. Data is saved in that browser's local storage; attachments use IndexedDB. **Visitors do not see or change each other's demo projects.** The artist email is sample plan data and sends no invitation. Payment status does not move money. Publishing a completed commission adds it to the gallery in the same browser only. Use **Reset sample projects** on the dashboard to start over; this clears demo records and attachments in that browser.

## Edit and publish

| Purpose | Files |
| --- | --- |
| Homepage | `index.html`, `styles.css`, `main.js`, `projects.js`, `assets/` |
| Tracker UI | `public/tracker.html`, `public/tracker.css`, `public/tracker.js` |
| Demo data and actions | `public/demo-store.mjs` |
| Legacy account-backed API, unused by the demo | `app/api/tracker/route.ts`, `app/api/upload/route.ts`, `app/api/file/route.ts`, `db/`, `drizzle/` |

`npm run dev` and `npm run build` copy root homepage files into `public/`. While the dev server runs, use `npm run sync:home` after editing a root homepage file, then refresh. Edit tracker files directly in `public/`.

```sh
npm test
npx tsc --noEmit
npm run build
```

To publish changes to the existing public URL, ask Codex in this project to publish the current folder to the Site ID in `.openai/hosting.json`. A production version with real collaboration would need user accounts, access control, durable shared storage, and email delivery. The legacy account-backed API remains in the repo for that later work but is not called by the public demo tracker.

Anyone can view or clone the GitHub repository. Contributors who need to push can be invited through its **Settings → Collaborators** page. The gallery contains third-party artwork and CODAworx branding; this repository does not grant reuse rights to those assets.
