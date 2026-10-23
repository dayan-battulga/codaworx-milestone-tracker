# CODAworx homepage clone

An editable, buildless clone of the [reference homepage](https://codaworx-engineer.vercel.app/index.html). It uses plain HTML, CSS, and JavaScript with local artwork assets. No package installation or build step is needed.

## Run it

Open `index.html` directly in a browser. You can also serve the folder locally:

```sh
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

## Make changes

- **Page sections and labels:** edit `index.html`.
- **Layout, color, typography, mobile styles:** edit `styles.css`.
- **Project names, locations, artists, and image choices:** edit `projects.js`.
- **Search, saved projects, dialogs, and card behavior:** edit `main.js`.
- **Images and logos:** replace files in `assets/`, then update their names in `projects.js` or `styles.css`.

Search, saved projects, project details, and Load More work locally. The Upload Project form stores new entries in your browser's `localStorage`; it does not publish them or sync across devices. The page has no account system, live chat, translations, or server API. Some navigation and footer items are visual placeholders from the reference prototype.

Run `node verify.mjs` to check project data and local image paths.

## Publish an update

Run `node build.mjs` after editing the source files. The generated `dist/` folder is the static site used for hosting.
