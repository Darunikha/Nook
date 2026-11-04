# 📚 Nook

A cozy 3D library you sit inside. Study at your table, and every finished session becomes a book on the shelves.

Drag to look around, then tap a tag to use something.

## What's in the room

| Spot | What it does |
| --- | --- |
| **Your table** | A focus timer. Each finished session adds a new book to the shelves. |
| **The stacks** | Your study history, by subject. |
| **Card catalog** | Your study history, by day. |
| **Window seat** | A reading log. |
| **Mochi** | The library cat. Pet her or wake her up. |
| **Fireside** | Soft ambient sound: fire, rain and a little music. |

The light follows your real time of day (morning, day, golden hour, night). You can also switch it by hand from the window.

## Two ways to see the library

- **Painted (default):** the illustrated reading room, with living light (lamp, candle, sconces), rain on the windows, drifting dust and steam. Click the notebook, mug, lamp, candle, cat, books, armchair, window or shelves. The welcome note, Pomodoro timer and today's goals sit beside the room like journal pages.
- **3D room:** the real-time 3D library you can look around. Switch in **Settings > The library**.

The painting lives in `public/scene/library-dusk.webp` (the design reference, with its mock-up panels retouched out). Make sure you have the rights to the artwork before publishing the site publicly.

## The library menu

A parchment menu runs down the left of the screen (a tab bar along the bottom on phones). Every page is also reachable by address, so the back button works.

| Page | Address | What it does |
| --- | --- | --- |
| **Study Room** | `#/room` | Back to your seat. |
| **My Notes** | `#/notes` | A notebook: write, add pages, and it is handwritten onto the journal on your desk. |
| **Pomodoro** | `#/timer` | The focus timer on the desk. |
| **Study Goals** | `#/goals` | A daily checklist on an index card. |
| **Settings** | `#/settings` | Light of day, reduced motion, picture quality, default session, export or clear notes. |

Notes, goals and settings are saved in this browser (localStorage). Nothing is sent anywhere.

## Run it

You'll need [Node.js](https://nodejs.org) installed.

```bash
npm install
npm run dev
```

Then open the address it prints, usually http://localhost:5173.

## Build it

```bash
npm run build
```

This makes a static site in `dist/` that you can host anywhere.

## Built with

- [three.js](https://threejs.org) for the 3D room
- [Vite](https://vitejs.dev) for dev and build

Everything runs in your browser. All sounds are generated live, and nothing is sent anywhere.
