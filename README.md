# CODAworx clone and milestone tracker

This is an editable remake of the [reference homepage](https://codaworx-engineer.vercel.app/index.html), with a post-award milestone tracker at `/tracker.html`. The [source repository](https://github.com/dayan-battulga/codaworx-milestone-tracker) is public, and the live site is at [codaworx-gallery-remake-2026.fluffyrice14.chatgpt.site](https://codaworx-gallery-remake-2026.fluffyrice14.chatgpt.site). Changes in this folder are local until a new Site version is published.

For a visual tour of the milestone workflow, see the [screenshot walkthrough](docs/milestone-walkthrough.md).

## Run it locally

Install Node.js 22.13 or newer, then clone the project and run:

```sh
git clone https://github.com/dayan-battulga/codaworx-milestone-tracker.git
cd codaworx-milestone-tracker
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_real_moira_mactaggert.sql
npm run dev
```

Open the **Local** URL printed by Vite, usually `http://127.0.0.1:5173/`. The gallery is at `/index.html`; the tracker is at `/tracker.html`. Click **Sign in with ChatGPT** in the local preview to use its test account (`seedy@sites.test`). This local sign-in is for development only. The hosted site uses the platform's real sign-in.

Run the migration only once for a new local database. Local data and uploaded files live under ignored `.wrangler/state/`. Press Control-C to stop the dev server.

`python3 -m http.server` still previews the homepage, but it cannot run sign-in, database, uploads, or milestone actions. Use `npm run dev` for the complete site.

## Use the tracker

1. A commissioner signs in, opens **My Projects**, and creates an award plan with 3–5 milestones. Optional payout percentages must total 100%.
2. The commissioner shares the tracker URL with the artist. The artist signs in with the exact email entered on the plan, then accepts or requests changes. The commissioner can revise the plan until it is accepted.
3. The artist submits a progress note and up to five files per submission (20 MB each). The commissioner approves or requests a revision. Activity and in-app notifications record each step.
4. The commissioner can put the project on hold, resume it, and manually record PO, check, or other payment status after approval. No money moves through this site.
5. Either party can download a CSV or choose **Print / PDF** to save a progress report. When every milestone is approved, the commissioner can publish the project to the public homepage gallery.

Invitation and due-date notices appear **inside the tracker**. There is no automatic email delivery yet: an email provider and scheduled job must be configured for unattended messages. Due-date notices are generated when a project participant visits the dashboard. The commissioner should share the URL with the artist directly for the pilot.

The homepage's original **Upload Project** dialog and Save buttons still use each visitor's browser storage. Publishing a completed commission from the tracker creates a shared gallery entry.

## Edit the site

| Purpose | File |
| --- | --- |
| Homepage content and navigation | `index.html` |
| Homepage styles and interactions | `styles.css`, `main.js` |
| Built-in gallery data and images | `projects.js`, `assets/` |
| Tracker page, styles, and interactions | `public/tracker.html`, `public/tracker.css`, `public/tracker.js` |
| Tracker API and file routes | `app/api/tracker/route.ts`, `app/api/upload/route.ts`, `app/api/file/route.ts` |
| Data tables and migration | `db/schema.ts`, `drizzle/` |
| Validation and templates | `lib/tracker-core.ts` |

`npm run dev` and `npm run build` copy the root homepage files and `assets/` into `public/`. While the dev server is running, run `npm run sync:home` after editing a root homepage file, then refresh the browser. Edit tracker files directly in `public/`.

Add built-in gallery projects in `projects.js` as `[title, location, artist, imageFilename, avatarFilename]`, with images in `assets/`. A project entered through the homepage dialog is saved only in that browser. A completed tracker project published to the showcase is shared with all visitors.

## Check and publish

```sh
npm test
npx tsc --noEmit
npm run build
```

`node build.mjs` is an alias for `npm run build`. The output in `dist/` is a Cloudflare Worker build with database and file-storage bindings; it is not a standalone static folder. To update the public site, ask Codex in this project to **publish the current CodaWorx folder to the existing Site in `.openai/hosting.json`**. The public URL stays the same. Codex Sites applies new migrations during publication.

The public Site uses ChatGPT sign-in, D1 for milestone records, and R2 for attachments. Project data and private files are limited to the commissioner and invited artist by the API. A selected showcase image becomes public only when the commissioner publishes that project.

Anyone can view or clone the GitHub repository. Contributors who need to push changes can be invited through its **Settings → Collaborators** page. The gallery contains third-party artwork and CODAworx branding; this repository does not grant reuse rights to those assets.
