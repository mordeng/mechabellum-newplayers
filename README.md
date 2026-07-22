# Mechabellum Companion

A mobile-first companion app for **new Mechabellum players**. The core question it answers:

> *"I keep losing to unit X — what should I build?"*

## Features

- **🎯 Counter Finder** — pick the enemy unit that's giving you trouble and get a ranked list of answers, each with a short "why it works" and a hard/good/soft counter rating.
- **⚔️ Live Match Helper** — during a game, tap in what your opponent is fielding (with counts). The app aggregates counters across their whole board and tells you what to build next, including which threats each suggestion covers.
- **🤖 Unit Browser** — every unit with cost, role description, what it beats, what beats it, and practical tips (tech upgrades worth buying, positioning, common mistakes).
- **💡 New Player Tips** — the fundamentals: economy, supply drops, positioning, specialists, and common beginner mistakes.
- **🗳️ Community adjustable** — vote counters up/down based on your own games (the ranking adapts), add your own counter entries, and export/import your adjustments to share them. The underlying database is a plain JSON file anyone can improve via pull request.

Counter baseline adapted from the excellent unit guides at [mechamonarch.com](https://mechamonarch.com/unit/) — go read them. Unit portraits in `img/units/` are Mechabellum game art (© Game River), sourced via mechamonarch, used here for a non-commercial fan project. Not affiliated with Game River or mechamonarch.

## Using it on your phone

The app is a static PWA — no build step, no backend.

**Hosted:** enable GitHub Pages for this repo (Settings → Pages → deploy from branch, root folder) and open the URL on your phone. Use your browser's *Add to Home Screen* — it installs like an app and works offline.

**Local:** any static file server works:

```bash
npx serve .          # or: python3 -m http.server 8080
```

Then open `http://localhost:8080` (opening `index.html` directly via `file://` won't work — the app fetches `data/units.json`).

## Improving the counter data

All game knowledge lives in [`data/units.json`](data/units.json). Wrong counter? Missing matchup? Outdated after a balance patch? See [CONTRIBUTING.md](CONTRIBUTING.md) — fixing it is a small JSON edit, and there's an in-app "Suggest a change" button that opens a pre-filled GitHub issue.

## Project layout

```
index.html            app shell
css/style.css         styles (dark, mobile-first)
js/app.js             all logic (vanilla JS, no dependencies)
data/units.json       ← the community counter database
sw.js                 service worker (offline support)
manifest.webmanifest  PWA manifest
```

Your personal adjustments (votes, custom counters, live board) are stored in `localStorage` on your device only.
