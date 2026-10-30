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
